import {scriptEvents} from '../host_api/event_router.js';
/** Cookery Guidebook API v1 publisher. Does not import or overwrite Cookery files.
 * Built into Grilling: no separate pack, world writes, itemUse hooks, or extra guidebook.
 */
export const EVENTS = Object.freeze({
  ready: 'kaleidoscope_cookery:guidebook_ready', ping: 'kaleidoscope_cookery:guidebook_ping',
  begin: 'kaleidoscope_cookery:guidebook_begin', chunk: 'kaleidoscope_cookery:guidebook_chunk',
  end: 'kaleidoscope_cookery:guidebook_end'
});
export const SOURCE = 'kg_grilling';
export const REVISION = 'kg-guide-a3-28155';
export const CHUNK_SIZE = 1600;
const PACKETS_PER_TICK = 2;
const PREPARE_CHARS_PER_SLICE = 256;
const PREPARE_STEPS_PER_TICK = 16;
const PREPARE_BUDGET_MS = 2;

export function* prepareEncodeMessages(payload) {
  if (!payload || payload.api !== 1 || payload.id !== 'kg_a1:grilling')
    throw new TypeError('Invalid Grilling guide payload.');
  // ASCII encoding makes both character and UTF-8 byte limits unambiguous.
  // Splits inside a JSON escape are harmless: only the fully reconstructed string is parsed.
  const serialized = JSON.stringify(payload);
  yield;
  const chunks = [];
  let chunk = '', chars = 0, sliceStarted = Date.now();
  for (let i = 0; i < serialized.length; i++) {
    const code = serialized.charCodeAt(i);
    const encoded = code >= 0x20 && code <= 0x7e
      ? serialized[i]
      : '\\u' + code.toString(16).padStart(4, '0');
    let offset = 0;
    while (offset < encoded.length) {
      const count = Math.min(CHUNK_SIZE - chunk.length, encoded.length - offset);
      chunk += encoded.slice(offset, offset + count);
      offset += count;
      if (chunk.length === CHUNK_SIZE) {chunks.push(chunk);chunk = '';}
    }
    if (++chars >= PREPARE_CHARS_PER_SLICE || Date.now() - sliceStarted >= PREPARE_BUDGET_MS) {
      chars = 0; sliceStarted = Date.now(); yield;
    }
  }
  if (chunk) chunks.push(chunk);
  if (!chunks.length || chunks.length > 512) throw new RangeError('Guide exceeds v1 transfer capacity.');
  const envelope = {api: 1, source: SOURCE, id: payload.id, revision: REVISION};
  const messages = [{id: EVENTS.begin, message: JSON.stringify({...envelope, chunks: chunks.length})}];
  for (let index = 0; index < chunks.length; index++) {
    messages.push({id: EVENTS.chunk, message: [SOURCE, payload.id, REVISION, index, chunks[index]].join('\n')});
    if ((index + 1) % PREPARE_CHARS_PER_SLICE === 0) yield;
  }
  messages.push({id: EVENTS.end, message: JSON.stringify(envelope)});
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index].message;
    if (message.length > 2048 || /[^\x00-\x7f]/.test(message))
      throw new RangeError('Unsafe Script Event message size.');
    if ((index + 1) % PREPARE_CHARS_PER_SLICE === 0) yield;
  }
  return messages;
}

export function encodeMessages(payload) {
  const job = prepareEncodeMessages(payload);
  let step;
  do {step = job.next();} while (!step.done);
  return step.value;
}

export function installPublisher(system, payload, warn = console.warn) {
  if (!system?.afterEvents?.scriptEventReceive || typeof system.sendScriptEvent !== 'function')
    throw new TypeError('Stable Script Events are required.');
  let active = false, disposed = false, hostReady = false, lastSent = -Infinity;
  let successfulTransfers = 0, sendFailures = 0, runningHandle;
  let preparationJob = prepareEncodeMessages(payload), preparationBuilds = 1, preparationSlices = 0;
  let maxPreparationSliceMs = 0, preparationFailures = 0, preparationSteps = 0, messages, messageCount = 0;
  const scheduled = new Set();
  const later = (fn, ticks) => {
    const handle = system.runTimeout(() => { scheduled.delete(handle); if (!disposed) fn(); }, ticks);
    scheduled.add(handle); return handle;
  };
  function transmit() {
    if (disposed || active || !messages || system.currentTick - lastSent < 120) return false;
    active = true; let cursor = 0;
    const step = () => {
      if (disposed) {active = false; return;}
      try {
        // A 512-chunk transfer has 514 packets including begin/end; at two per tick it takes 257 ticks.
        for (let n = 0; n < PACKETS_PER_TICK && cursor < messages.length; n++, cursor++) {
          const m = messages[cursor]; system.sendScriptEvent(m.id, m.message);
        }
        if (cursor < messages.length) runningHandle = later(step, 1);
        else {active = false; lastSent = system.currentTick; successfulTransfers++;}
      } catch (error) {
        active = false; sendFailures++;
        warn(`[Grilling guide] Publish failed: ${String(error)}`);
        if (sendFailures <= 2) later(transmit, 40); // A new begin discards partial data safely.
      }
    };
    runningHandle = later(step, 1); return true;
  }
  function prepareStep() {
    if (disposed || !preparationJob) return;
    const started = Date.now();
    try {
      for (let n = 0; n < PREPARE_STEPS_PER_TICK; n++) {
        const result = preparationJob.next();
        preparationSteps++;
        if (result.done) {
          messages = result.value; preparationJob = null; messageCount = messages.length;
          if (hostReady) transmit();
          return;
        }
        if (Date.now() - started >= PREPARE_BUDGET_MS) break;
      }
      runningHandle = later(prepareStep, 1);
    } catch (error) {
      preparationJob = null; preparationFailures++;
      warn(`[Grilling guide] Build failed: ${String(error)}`);
      if (preparationFailures <= 2) later(() => {
        preparationBuilds++;
        preparationJob = prepareEncodeMessages(payload);
        runningHandle = later(prepareStep, 1);
      }, 40);
    } finally {
      preparationSlices++;
      maxPreparationSliceMs = Math.max(maxPreparationSliceMs, Date.now() - started);
    }
  }
  const receive = ev => {
    if (disposed || ev.id !== EVENTS.ready) return;
    try { if (Number(JSON.parse(String(ev.message ?? '')).api) === 1) {hostReady = true; transmit();} }
    catch { /* Ignore unrelated/malformed ready events. */ }
  };
  const unsubscribe=scriptEvents(system)('guide-publisher',receive);
  const ping = () => {
    try { system.sendScriptEvent(EVENTS.ping, JSON.stringify({api: 1, source: SOURCE})); }
    catch (error) { warn(`[Grilling guide] Ping failed: ${String(error)}`); }
  };
  runningHandle = later(prepareStep, 1);
  for (const ticks of [1, 40, 200]) later(ping, ticks);
  return Object.freeze({
    getStatus: () => ({active, disposed, successfulTransfers, sendFailures, preparing:!!preparationJob,
      preparationBuilds, preparationSlices, preparationSteps, maxPreparationSliceMs, messageCount,
      acknowledgementAvailable: false}),
    dispose: () => {
      if (disposed) return; disposed = true; active = false;
      unsubscribe();
      for (const h of scheduled) system.clearRun(h);
      scheduled.clear(); if (runningHandle != null) system.clearRun(runningHandle);
    }
  });
}
