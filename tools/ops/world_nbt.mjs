import nbt from 'prismarine-nbt'
import { TextDecoder } from 'node:util'

// Disk NBT uses fixed-width little-endian values, not network varints.
// Preflight the bytes because prismarine-nbt accepts EOF without TAG_End and
// stores compound names in an object, where duplicates would disappear.
const MAX_BYTES = 64 * 1024 * 1024
const MAX_DEPTH = 128
const MAX_TAGS = 1_000_000
const MAX_ARRAY_ELEMENTS = 1_000_000
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const idFields = new Set(['Name', 'name', 'identifier', 'id'])
const scalarBytes = new Map([[1, 1], [2, 2], [3, 4], [4, 8], [5, 4], [6, 8]])
const legalBits = new Set([0, 1, 2, 3, 4, 5, 6, 8, 16])

export class WorldNbtError extends Error {
  constructor (code, offset) {
    // Do not include NBT names, values, player IDs or coordinates in errors.
    super(`${code} at byte ${offset}`)
    this.name = 'WorldNbtError'
    this.code = code
    this.byteOffset = offset
  }
}

function fail (code, offset) { throw new WorldNbtError(code, offset) }

function checkInput (buffer, offset = 0) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('Expected a Buffer')
  if (buffer.length > MAX_BYTES) fail('NBT_BYTE_BUDGET', 0)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > buffer.length) fail('NBT_OFFSET', 0)
}

function requireBytes (buffer, offset, count) {
  if (!Number.isSafeInteger(count) || count < 0 || count > buffer.length - offset) fail('NBT_TRUNCATED', offset)
}

function decodeUtf8 (bytes, offset) {
  try { return utf8.decode(bytes) } catch { fail('NBT_INVALID_UTF8', offset) }
}

function readStringBytes (buffer, cursor) {
  requireBytes(buffer, cursor.pos, 2)
  const count = buffer.readUInt16LE(cursor.pos)
  cursor.pos += 2
  requireBytes(buffer, cursor.pos, count)
  const offset = cursor.pos
  const bytes = buffer.subarray(offset, offset + count)
  cursor.pos += count
  return { bytes, offset }
}

function readName (buffer, cursor) {
  const { bytes, offset } = readStringBytes(buffer, cursor)
  const name = decodeUtf8(bytes, offset)
  if (name.includes('\0')) fail('NBT_NAME_NUL', offset)
  // Assignment to this name changes the prototype in the library's decoder.
  if (name === '__proto__') fail('NBT_UNREPRESENTABLE_NAME', offset)
  return name
}

function readLength (buffer, cursor) {
  requireBytes(buffer, cursor.pos, 4)
  const offset = cursor.pos
  const count = buffer.readInt32LE(offset)
  cursor.pos += 4
  if (count < 0) fail('NBT_NEGATIVE_LENGTH', offset)
  if (count > MAX_ARRAY_ELEMENTS) fail('NBT_ARRAY_BUDGET', offset)
  return count
}

function preflightPayload (buffer, cursor, type, depth, fieldName, path, context) {
  if (depth > MAX_DEPTH) fail('NBT_DEPTH_BUDGET', cursor.pos)
  if (++context.tags > MAX_TAGS) fail('NBT_TAG_BUDGET', cursor.pos)
  if (type < 1 || type > 12) fail('NBT_UNKNOWN_TAG', cursor.pos)
  const fixed = scalarBytes.get(type)
  if (fixed !== undefined) {
    requireBytes(buffer, cursor.pos, fixed)
    cursor.pos += fixed
    return
  }
  if (type === 8) {
    const { bytes, offset } = readStringBytes(buffer, cursor)
    if (idFields.has(fieldName)) {
      decodeUtf8(bytes, offset)
    } else if (fieldName === 'StorageKey') {
      context.binaryStrings.push({ path, bytes, reason: 'opaque_storage_key' })
    } else {
      try { utf8.decode(bytes) } catch {
        context.binaryStrings.push({ path, bytes, reason: 'invalid_utf8' })
      }
    }
    return
  }
  if (type === 10) {
    const names = new Set()
    for (;;) {
      requireBytes(buffer, cursor.pos, 1)
      const childType = buffer[cursor.pos++]
      if (childType === 0) return
      if (childType > 12) fail('NBT_UNKNOWN_TAG', cursor.pos - 1)
      const name = readName(buffer, cursor)
      if (names.has(name)) fail('NBT_DUPLICATE_NAME', cursor.pos)
      names.add(name)
      preflightPayload(buffer, cursor, childType, depth + 1, name, [...path, name, 'value'], context)
    }
  }
  if (type === 9) {
    requireBytes(buffer, cursor.pos, 1)
    const childType = buffer[cursor.pos++]
    if (childType > 12) fail('NBT_UNKNOWN_LIST_TAG', cursor.pos - 1)
    const count = readLength(buffer, cursor)
    if (childType === 0 && count !== 0) fail('NBT_NONEMPTY_END_LIST', cursor.pos)
    if (count > MAX_TAGS - context.tags) fail('NBT_TAG_BUDGET', cursor.pos)
    for (let i = 0; i < count; i++) {
      preflightPayload(buffer, cursor, childType, depth + 1, fieldName, [...path, 'value', i], context)
    }
    return
  }
  const count = readLength(buffer, cursor)
  const width = type === 7 ? 1 : type === 11 ? 4 : 8
  requireBytes(buffer, cursor.pos, count * width)
  cursor.pos += count * width
}

function applyBinaryStrings (root, entries) {
  if (!entries.length) return
  for (const entry of entries) {
    let target = root
    for (const component of entry.path.slice(0, -1)) {
      if (target === null || typeof target !== 'object' || !Object.hasOwn(target, component)) fail('NBT_DECODER_PATH', 0)
      target = target[component]
    }
    const last = entry.path.at(-1)
    if (target === null || typeof target !== 'object' || !Object.hasOwn(target, last)) fail('NBT_DECODER_PATH', 0)
    // Preserve every original byte. These fields are binary, not decoded IDs.
    target[last] = entry.bytes.toString('latin1')
    if (last === 'value' && target.type === 'string') {
      Object.defineProperty(target, 'rawBytes', { value: Buffer.from(entry.bytes) })
      Object.defineProperty(target, 'encoding', { value: 'binary' })
    }
  }
  Object.defineProperty(root, 'binaryStrings', {
    value: entries.map(({ path, bytes, reason }) => ({ path, bytes: Buffer.from(bytes), reason }))
  })
}

async function parseValidatedOne (buffer, offset, budget) {
  const cursor = { pos: offset }
  requireBytes(buffer, cursor.pos, 1)
  const type = buffer[cursor.pos++]
  if (type < 1 || type > 12) fail('NBT_UNKNOWN_ROOT_TAG', offset)
  const name = readName(buffer, cursor)
  const context = { tags: budget.tags, binaryStrings: [] }
  preflightPayload(buffer, cursor, type, 0, name, ['value'], context)
  budget.tags = context.tags
  const bounded = buffer.subarray(offset, cursor.pos)
  let parsed
  try {
    parsed = await nbt.parseAs(bounded, 'little', { noArraySizeCheck: false })
  } catch {
    fail('NBT_LIBRARY_REJECTED', offset)
  }
  if (parsed.metadata.size !== bounded.length) fail('NBT_DECODER_LENGTH', offset)
  applyBinaryStrings(parsed.data, context.binaryStrings)
  return { root: parsed.data, nextOffset: cursor.pos }
}

export async function parseOneNbt (buffer, offset = 0) {
  checkInput(buffer, offset)
  return parseValidatedOne(buffer, offset, { tags: 0 })
}

export async function parseRoots (buffer, multiple = false) {
  checkInput(buffer)
  if (typeof multiple !== 'boolean') throw new TypeError('Expected a boolean')
  if (!buffer.length) {
    if (multiple) return []
    fail('NBT_EMPTY_ROOT', 0)
  }
  const roots = []
  const budget = { tags: 0 }
  let offset = 0
  do {
    const result = await parseValidatedOne(buffer, offset, budget)
    roots.push(result.root)
    if (result.nextOffset <= offset) fail('NBT_NONPROGRESS', offset)
    offset = result.nextOffset
    if (!multiple && offset !== buffer.length) fail('NBT_TRAILING_BYTES', offset)
  } while (multiple && offset < buffer.length)
  return roots
}

// Layout references: Amulet Core base_leveldb_interface.py _load_subchunks /
// _decode_packed_array / _load_palette_blocks, and Prismarine PalettedStorage.
export async function parseSubchunk (buffer, keyY) {
  checkInput(buffer)
  if (!Number.isInteger(keyY) || keyY < -128 || keyY > 127) fail('SUBCHUNK_KEY_Y', 0)
  requireBytes(buffer, 0, 2)
  const version = buffer[0]
  if (version !== 8 && version !== 9) fail('SUBCHUNK_VERSION', 0)
  const storageCount = buffer[1]
  let offset = 2
  let y = keyY
  if (version === 9) {
    requireBytes(buffer, offset, 1)
    y = buffer.readInt8(offset++)
    if (y !== keyY) fail('SUBCHUNK_Y_MISMATCH', offset - 1)
  }
  const storages = []
  const budget = { tags: 0 }
  for (let storage = 0; storage < storageCount; storage++) {
    requireBytes(buffer, offset, 1)
    const header = buffer[offset++]
    if (header & 1) fail('SUBCHUNK_RUNTIME_PALETTE', offset - 1)
    const bits = header >>> 1
    if (!legalBits.has(bits)) fail('SUBCHUNK_BITS', offset - 1)
    const indices = new Uint16Array(4096)
    let paletteCount = 1
    if (bits) {
      const perWord = Math.floor(32 / bits)
      const words = Math.ceil(4096 / perWord)
      requireBytes(buffer, offset, words * 4 + 4)
      const mask = (1 << bits) - 1
      for (let i = 0; i < 4096; i++) {
        const word = buffer.readUInt32LE(offset + Math.floor(i / perWord) * 4)
        indices[i] = (word >>> ((i % perWord) * bits)) & mask
      }
      offset += words * 4
      paletteCount = buffer.readUInt32LE(offset)
      offset += 4
      if (paletteCount < 1 || paletteCount > 65536) fail('SUBCHUNK_PALETTE_COUNT', offset - 4)
    }
    const palette = []
    for (let i = 0; i < paletteCount; i++) {
      const result = await parseValidatedOne(buffer, offset, budget)
      const root = result.root
      if (root.type !== 'compound' || root.value.name?.type !== 'string' || !root.value.name.value.length) fail('SUBCHUNK_PALETTE_NAME', offset)
      if (root.value.states && root.value.states.type !== 'compound') fail('SUBCHUNK_PALETTE_STATES', offset)
      if (root.value.version && root.value.version.type !== 'int') fail('SUBCHUNK_PALETTE_VERSION', offset)
      if (root.value.val && root.value.val.type !== 'short') fail('SUBCHUNK_PALETTE_LEGACY_VAL', offset)
      const types = Object.fromEntries(Object.entries(root.value.states?.value ?? {}).map(([key, tag]) => [key, tag.type]))
      if (Object.values(types).some(type => !['byte', 'int', 'string'].includes(type))) fail('SUBCHUNK_STATE_TYPE', offset)
      palette.push({ ...nbt.simplify(root), state_types: types })
      offset = result.nextOffset
    }
    for (const index of indices) {
      if (index >= paletteCount) fail('SUBCHUNK_PALETTE_INDEX', offset)
    }
    storages.push({ palette, indices })
  }
  if (offset !== buffer.length) fail('SUBCHUNK_TRAILING_BYTES', offset)
  return { version, y, storages }
}

// Modern PendingTicks (chunk tag 0x33), matching the independently observed
// shape and mcbe-leveldb nbtSchemas.ts PendingTicks. Entries are scheduled
// references to blocks, not additional placed blocks. Never return locations.
export async function parseScheduledTicks (buffer) {
  const [root] = await parseRoots(buffer)
  const int32 = tag => tag?.type === 'int' && Number.isInteger(tag.value) &&
    tag.value >= -2147483648 && tag.value <= 2147483647
  const exactFields = (fields, allowed, code) => {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields) ||
        Object.keys(fields).length !== allowed.length ||
        allowed.some(field => !Object.hasOwn(fields, field))) fail(code, 0)
  }
  if (root.type !== 'compound') fail('TICKS_ROOT_TYPE', 0)
  exactFields(root.value, ['currentTick', 'tickList'], 'TICKS_ROOT_FIELDS')
  if (!int32(root.value.currentTick)) fail('TICKS_CURRENT_TYPE', 0)
  const list = root.value.tickList
  if (list?.type !== 'list' || !Array.isArray(list.value?.value)) fail('TICKS_LIST_TYPE', 0)
  const entries = list.value.value
  if (list.value.type !== 'compound' && !(list.value.type === 'end' && entries.length === 0)) fail('TICKS_LIST_TYPE', 0)
  return entries.map(fields => {
    exactFields(fields, ['blockState', 'time', 'x', 'y', 'z'], 'TICKS_ENTRY_FIELDS')
    if (!['x', 'y', 'z'].every(field => int32(fields[field]))) fail('TICKS_COORD_TYPE', 0)
    const time = fields.time
    if (time?.type !== 'long' || !Array.isArray(time.value) || time.value.length !== 2 ||
        !time.value.every(value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647)) fail('TICKS_TIME_TYPE', 0)
    const state = fields.blockState
    if (state?.type !== 'compound') fail('TICKS_BLOCK_STATE_TYPE', 0)
    exactFields(state.value, ['name', 'states', 'version'], 'TICKS_BLOCK_STATE_FIELDS')
    if (state.value.name?.type !== 'string' || !state.value.name.value.length) fail('TICKS_BLOCK_NAME', 0)
    if (state.value.states?.type !== 'compound') fail('TICKS_BLOCK_STATES_TYPE', 0)
    if (!int32(state.value.version)) fail('TICKS_BLOCK_VERSION_TYPE', 0)
    const stateTypes = Object.fromEntries(Object.entries(state.value.states.value).map(([key, tag]) => [key, tag.type]))
    if (Object.values(stateTypes).some(type => !['byte', 'int', 'string'].includes(type))) fail('TICKS_BLOCK_STATE_VALUE_TYPE', 0)
    if (Object.values(state.value.states.value).some(tag => tag.type === 'string' && tag.encoding === 'binary')) fail('TICKS_BLOCK_STATE_UTF8', 0)
    const simplified = nbt.simplify(state)
    return { name: simplified.name, states: simplified.states, state_types: stateTypes, version: simplified.version }
  })
}
