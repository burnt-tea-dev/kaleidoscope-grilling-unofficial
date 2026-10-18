/** Cookery Guidebook API v1 publisher. Does not import or overwrite Cookery files.
 * Built into Grilling: no separate pack, world writes, itemUse hooks, or extra guidebook.
 */
export const EVENTS = Object.freeze({
  ready: 'kaleidoscope_cookery:guidebook_ready', ping: 'kaleidoscope_cookery:guidebook_ping',
  begin: 'kaleidoscope_cookery:guidebook_begin', chunk: 'kaleidoscope_cookery:guidebook_chunk',
  end: 'kaleidoscope_cookery:guidebook_end'
});
export const SOURCE = 'kg_grilling';
export const REVISION = 'kg-guide-a3-28154';
export const CHUNK_SIZE = 1600;

export function encodeMessages(payload) {
  if (!payload || payload.api !== 1 || payload.id !== 'kg_a1:grilling')
    throw new TypeError('Invalid Grilling guide payload.');
  // ASCII encoding makes both character and UTF-8 byte limits unambiguous.
  // Splits inside a JSON escape are harmless: only the fully reconstructed string is parsed.
  const raw = JSON.stringify(payload).replace(/[^\x20-\x7e]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  const chunks = [];
  for (let i = 0; i < raw.length; i += CHUNK_SIZE) chunks.push(raw.slice(i, i + CHUNK_SIZE));
  if (!chunks.length || chunks.length > 512) throw new RangeError('Guide exceeds v1 transfer capacity.');
  const envelope = {api: 1, source: SOURCE, id: payload.id, revision: REVISION};
  const messages = [
    {id: EVENTS.begin, message: JSON.stringify({...envelope, chunks: chunks.length})},
    ...chunks.map((data, index) => ({id: EVENTS.chunk,
      message: [SOURCE, payload.id, REVISION, index, data].join('\n')})),
    {id: EVENTS.end, message: JSON.stringify(envelope)}
  ];
  for (const m of messages) if (m.message.length > 2048 || /[^\x00-\x7f]/.test(m.message))
    throw new RangeError('Unsafe Script Event message size.');
  return messages;
}

export function installPublisher(system, payload, warn = console.warn) {
  if (!system?.afterEvents?.scriptEventReceive || typeof system.sendScriptEvent !== 'function')
    throw new TypeError('Stable Script Events are required.');
  const messages = encodeMessages(payload);
  let active = false, disposed = false, lastSent = -Infinity;
  let successfulTransfers = 0, sendFailures = 0, runningHandle;
  const scheduled = new Set();
  const later = (fn, ticks) => {
    const handle = system.runTimeout(() => { scheduled.delete(handle); if (!disposed) fn(); }, ticks);
    scheduled.add(handle); return handle;
  };
  function transmit() {
    if (disposed || active || system.currentTick - lastSent < 120) return false;
    active = true; let cursor = 0;
    const step = () => {
      if (disposed) {active = false; return;}
      try {
        // Bound work per tick. Even the maximum transfer finishes before host's 600-tick TTL.
        for (let n = 0; n < 8 && cursor < messages.length; n++, cursor++) {
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
  const receive = ev => {
    if (disposed || ev.id !== EVENTS.ready) return;
    try { if (Number(JSON.parse(String(ev.message ?? '')).api) === 1) transmit(); }
    catch { /* Ignore unrelated/malformed ready events. */ }
  };
  system.afterEvents.scriptEventReceive.subscribe(receive);
  const ping = () => {
    try { system.sendScriptEvent(EVENTS.ping, JSON.stringify({api: 1, source: SOURCE})); }
    catch (error) { warn(`[Grilling guide] Ping failed: ${String(error)}`); }
  };
  for (const ticks of [1, 40, 200]) later(ping, ticks);
  return Object.freeze({
    getStatus: () => ({active, disposed, successfulTransfers, sendFailures, messageCount: messages.length,
      acknowledgementAvailable: false}),
    dispose: () => {
      if (disposed) return; disposed = true; active = false;
      system.afterEvents.scriptEventReceive.unsubscribe(receive);
      for (const h of scheduled) system.clearRun(h);
      scheduled.clear(); if (runningHandle != null) system.clearRun(runningHandle);
    }
  });
}
