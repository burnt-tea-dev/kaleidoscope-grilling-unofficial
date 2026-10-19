import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
import leveldb from 'leveldb-zlib'
import { parseRoots, parseSubchunk, parseScheduledTicks } from './world_nbt.mjs'
import { analyzeWorldProperties, analyzeStackProperties } from './world_properties.mjs'
const { LevelDB } = leveldb
const NS = 'kaleidoscope_grilling:'
const hidden = new Set(['inventory_grill_v1', 'inventory_rack_v1', 'inventory_seasoning_v1'].map(x => NS + x))
const target = value => typeof value === 'string' && value.startsWith(NS)
const targetBytes = value => value.includes(Buffer.from(NS))
const keyName = key => key.toString('latin1')
const locationKey = value => `${value.dimension}/${value.x}/${value.z}`
const safeCode = error => /^[A-Z][A-Z0-9_]{0,70}$/.test(error?.code ?? '') ? error.code : 'PARSE_FAILED'
const sorted = map => [...map.values()].sort((a, b) => a.id.localeCompare(b.id) || a.location_type.localeCompare(b.location_type))

export function chunkKey (dimension, x, z, tag, y, explicitOverworld = false) {
  const dim = dimension === 0 && !explicitOverworld ? Buffer.alloc(0) : Buffer.alloc(4)
  if (dim.length) dim.writeInt32LE(dimension)
  const coords = Buffer.alloc(8); coords.writeInt32LE(x, 0); coords.writeInt32LE(z, 4)
  return Buffer.concat([coords, dim, Buffer.from(y === undefined ? [tag] : [tag, y & 255])])
}

export function decodeChunkKey (key) {
  const sub = (key.length === 10 || key.length === 14) && key[key.length - 2] === 0x2f
  if (!sub && key.length !== 9 && key.length !== 13) return null
  const explicit = key.length === 13 || key.length === 14
  const tag = key[sub ? key.length - 2 : key.length - 1]
  if (!sub && !((tag >= 0x2b && tag <= 0x41) || tag === 0x76)) return null
  return { x: key.readInt32LE(0), z: key.readInt32LE(4), dimension: explicit ? key.readInt32LE(8) : 0,
    tag: key[sub ? key.length - 2 : key.length - 1], y: sub ? key.readInt8(key.length - 1) : undefined }
}

function addQuantity (map, id, location, quantity, stacks = 1) {
  if (!target(id)) return
  if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(stacks) || stacks < 0) throw Object.assign(new Error(), { code: 'INVALID_QUANTITY' })
  const key = JSON.stringify([id, location])
  const row = map.get(key) ?? { id, location_type: location, quantity: 0, stacks: 0 }
  row.quantity += quantity; row.stacks += stacks
  if (!Number.isSafeInteger(row.quantity) || !Number.isSafeInteger(row.stacks)) throw Object.assign(new Error(), { code: 'QUANTITY_OVERFLOW' })
  map.set(key, row)
}
function reference (map, id, location, occurrences = 1) {
  if (!target(id)) return
  const key = JSON.stringify([id, location]); const row = map.get(key) ?? { id, location_type: location, occurrences: 0 }
  row.occurrences += occurrences; map.set(key, row)
}
function amount (tag) {
  if (!tag || !['byte', 'short', 'int'].includes(tag.type)) throw Object.assign(new Error(), { code: 'ITEM_COUNT_TYPE' })
  const value = tag.type === 'byte' && tag.value < 0 ? tag.value + 256 : tag.value
  if (!Number.isSafeInteger(value) || value < 0) throw Object.assign(new Error(), { code: 'ITEM_COUNT_VALUE' })
  return value
}

// records is an iterable/async iterable of raw [key,value] Buffers. The backend
// prefetches world properties and supplies a stable read-only get callback.
export async function census (records, options = {}) {
  const items = new Map(), entities = new Map(), blocks = new Map(), paletteEntries = new Map(), blockStates = new Map()
  const serialized = new Map(), references = new Map(), errors = new Map(), warnings = new Map(), tickStates = new Map()
  const coverage = { records: 0, record_types: {}, actor_records: 0, legacy_entities: 0, player_data_records: 0, player_mapping_records: 0, subchunks: 0, storages: 0 }
  const actorKeys = new Set(), actorRefs = new Map(), identities = new Map(), chunks = new Set()
  let actorScope = null
  let opaqueScope = null
  const knownReferenceIds = new Set([...(options.knownItems ?? []), ...(options.knownEntities ?? []), ...Object.keys(options.knownBlocks ?? {})])
  const stationCounts = {}; let properties = { prefixCounts: {}, stations: [], metadata: new Map(), serializedItems: [], references: [], errors: [] }
  const problem = (code, location = 'record') => {
    if (actorScope) actorScope.failed = true
    const key = `${code}/${location}`; const row = errors.get(key) ?? { code, location_type: location, records: 0 }
    row.records++; errors.set(key, row)
  }
  const warning = code => warnings.set(code, (warnings.get(code) ?? 0) + 1)
  const count = (map, id, location, quantity, stacks = 1) => {
    if (actorScope && target(id)) actorScope.owned = true
    if (target(id) && knownReferenceIds.size && !knownReferenceIds.has(id)) { problem('UNKNOWN_TARGET_IDENTIFIER', location); return }
    if (opaqueScope) { if (target(id)) opaqueScope.owned = true; return }
    addQuantity(map, id, location, quantity, stacks)
  }
  const typeCount = type => { coverage.record_types[type] = (coverage.record_types[type] ?? 0) + 1 }
  const addReference = (id, location, occurrences = 1) => {
    if (actorScope && target(id)) actorScope.owned = true
    if (target(id) && knownReferenceIds.size && !knownReferenceIds.has(id)) { problem('UNKNOWN_REFERENCE_IDENTIFIER', location); return }
    if (opaqueScope) { if (target(id)) opaqueScope.owned = true; return }
    reference(references, id, location, occurrences)
  }
  const mergeAnalysis = (analysis, location) => {
    if (!analysis || typeof analysis !== 'object') { problem('PROPERTY_ANALYSIS_MISSING', location); return }
    for (const row of analysis.serializedItems ?? []) count(serialized, row.id, row.location_type ?? location, row.quantity, row.stacks ?? 1)
    for (const row of analysis.references ?? []) addReference(row.id, row.location_type ?? location, row.occurrences ?? 1)
    for (const row of analysis.errors ?? []) problem(/^[A-Z0-9_]+$/.test(row.code) ? row.code : 'PROPERTY_ANALYSIS_FAILED', location)
  }
  let dp = options.dynamicProperties
  if (dp === undefined && Array.isArray(records)) dp = records.find(([key]) => key.equals(Buffer.from('DynamicProperties')))?.[1] ?? null
  if (dp) {
    try {
      const roots = await parseRoots(dp)
      properties = await analyzeWorldProperties(roots[0], options.persistedKeys ?? [])
      mergeAnalysis(properties, 'world_dynamic_properties')
    } catch (error) { problem(safeCode(error), 'world_dynamic_properties') }
  }
  const validatedStates = (entry, location) => {
    if (!target(entry.name)) return null
    if (knownReferenceIds.size && !knownReferenceIds.has(entry.name)) return null
    const states = Object.fromEntries(Object.entries(entry.states ?? {}).sort(([a], [b]) => a.localeCompare(b)))
    const engineStates = { 'minecraft:cardinal_direction': ['north', 'south', 'east', 'west'],
      'minecraft:block_face': ['up', 'down', 'north', 'south', 'east', 'west'] }
    if (options.knownBlocks !== undefined) {
      const declared = options.knownBlocks[entry.name]
      if (!declared) { problem('BLOCK_IDENTIFIER_NOT_IN_LOCK', location); return null }
      for (const [key, value] of Object.entries(states)) {
        const allowed = declared[key] ? declared[key].map(value => JSON.parse(value)) : engineStates[key]
        if (!allowed) { problem('UNKNOWN_BLOCK_STATE', location); return null }
        if (!allowed.some(candidate => candidate === value || (typeof candidate === 'boolean' && Number(candidate) === value))) {
          problem('UNKNOWN_BLOCK_STATE_VALUE', location); return null
        }
      }
    }
    const types = Object.fromEntries(Object.entries(entry.state_types ?? {}).sort(([a], [b]) => a.localeCompare(b)))
    return { states, types }
  }
  const stateRow = (entry, layer, quantity) => {
    const parsed = validatedStates(entry, 'block_states')
    if (!parsed) return
    const { states, types } = parsed
    const key = JSON.stringify([entry.name, layer, states, types, entry.val ?? null])
    const row = blockStates.get(key) ?? { id: entry.name, location_type: `placed_block_layer_${layer}`,
      states, state_types: types, legacy_val: entry.val ?? null, quantity: 0, palette_entries: 0 }
    row.quantity += quantity; row.palette_entries++; blockStates.set(key, row)
  }
  const inventoryLocation = (field, kind, current, nested, entityType) => {
    if (field === 'Items' && nested) return `${current}/nested_container`
    if (kind === 'player' && ['Inventory', 'Mainhand', 'Offhand', 'Armor', 'EnderChestInventory'].includes(field)) return `player_${{ Inventory: 'inventory', Mainhand: 'mainhand', Offhand: 'offhand', Armor: 'armor', EnderChestInventory: 'ender_chest' }[field]}`
    if (kind === 'actor' && ['Items', 'Inventory', 'Mainhand', 'Offhand', 'Armor', 'ChestItems', 'Item'].includes(field)) {
      if (field === 'Item' && entityType === 'minecraft:item') return 'dropped_item'
      if (hidden.has(entityType)) return 'hidden_inventory'
      if (entityType === NS + 'equipment_visual') return 'visual_inventory'
      return `entity_${{ Items: 'inventory', Inventory: 'inventory', Mainhand: 'mainhand', Offhand: 'offhand', Armor: 'armor', ChestItems: 'chest_inventory', Item: 'item_payload' }[field]}`
    }
    if (kind === 'container' && field === 'Items') return 'container'
    return current
  }
  const walk = async (tag, location, kind, entityType = '', nested = false, depth = 0, carrier = false) => {
    if (!tag || typeof tag !== 'object') throw Object.assign(new Error(), { code: 'NBT_TREE_SHAPE' })
    if (depth > 128) throw Object.assign(new Error(), { code: 'NBT_DEPTH_BUDGET' })
    if (tag.type === 'compound') {
      const fields = tag.value
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw Object.assign(new Error(), { code: 'NBT_COMPOUND_SHAPE' })
      if (carrier && target(fields.Name?.value) && fields.Count === undefined) throw Object.assign(new Error(), { code: 'INVENTORY_SCHEMA' })
      let isStack = false
      if (fields.Name?.type === 'string' && fields.Count !== undefined) {
        const quantity = amount(fields.Count); isStack = true
        if (target(fields.Name.value)) {
          if (quantity) count(items, fields.Name.value, location, quantity)
          else addReference(fields.Name.value, `${location}/empty_stack`)
        }
        if (quantity) mergeAnalysis(await analyzeStackProperties(tag, properties.metadata), location)
      } else if (target(fields.Name?.value)) addReference(fields.Name.value, `${location}/named_reference`)
      if (target(fields.name?.value)) addReference(fields.name.value, `${location}/palette_reference`)
      if (depth && target(fields.identifier?.value)) addReference(fields.identifier.value, `${location}/entity_reference`)
      if (depth && target(fields.id?.value)) addReference(fields.id.value, `${location}/id_reference`)
      for (const [field, child] of Object.entries(fields)) {
        const inventoryField = (depth === 0 && kind === 'player' && ['Inventory', 'Mainhand', 'Offhand', 'Armor', 'EnderChestInventory'].includes(field)) ||
          (depth === 0 && kind === 'actor' && ['Items', 'Inventory', 'Mainhand', 'Offhand', 'Armor', 'ChestItems', 'Item'].includes(field)) ||
          (depth === 0 && kind === 'container' && field === 'Items') ||
          ((nested || isStack) && field === 'Items')
        // Reject unsupported carrier schemas instead of silently counting an
        // inventory as empty. An empty list has no payload to lose; TAG_End is
        // the conventional element type for that valid NBT representation.
        const inventoryShape = child.type === 'compound' || (child.type === 'list' &&
          Array.isArray(child.value?.value) && (child.value.value.length === 0 || child.value.type === 'compound'))
        if (inventoryField && !inventoryShape) throw Object.assign(new Error(), { code: 'INVENTORY_SCHEMA' })
        const next = inventoryLocation(field, kind, location, nested || isStack, entityType)
        await walk(child, next, kind, entityType, nested || isStack, depth + 1, inventoryField)
      }
    } else if (tag.type === 'list') {
      if (!tag.value || !Array.isArray(tag.value.value)) throw Object.assign(new Error(), { code: 'NBT_LIST_SHAPE' })
      for (const child of tag.value.value) await walk({ type: tag.value.type, value: child }, location, kind, entityType, nested, depth + 1, carrier)
    }
  }
  const entity = async (root, location) => {
    if (root.type !== 'compound') throw Object.assign(new Error(), { code: 'ENTITY_NBT_ROOT' })
    const previous = actorScope
    actorScope = { owned: false, failed: false }
    let token
    try {
      const fields = root.value; const id = fields.identifier?.value ?? fields.id?.value
      if (typeof id !== 'string') problem('ENTITY_IDENTIFIER_UNKNOWN', location)
      if (fields.UniqueID !== undefined) {
        if (fields.UniqueID.type !== 'long') problem('ENTITY_IDENTITY_TYPE', location)
        token = String(fields.UniqueID.value)
      }
      count(entities, id, location, 1)
      await walk(root, 'entity_other', 'actor', id)
    } catch (error) {
      actorScope.failed = true
      throw error
    } finally {
      if (token !== undefined) {
        const group = identities.get(token) ?? []
        group.push(actorScope); identities.set(token, group)
      }
      actorScope = previous
    }
  }
  const parseGeneric = async (key, value, strict) => {
    const previous = opaqueScope
    try {
      const roots = await parseRoots(value)
      // Unknown records and blueprints must never become active inventory.
      // Still resolve carriers' metadata: a vanilla stack can refer to owned
      // serialized contents without a literal owned namespace in this record.
      opaqueScope = { owned: false }
      await walk(roots[0], strict ? 'saved_structure_or_entity_data' : 'other_nbt', 'other')
      if (targetBytes(value) || opaqueScope.owned) problem('UNCLASSIFIED_TARGET_NBT_SCHEMA', strict ? 'saved_structure_or_entity_data' : 'other_nbt')
      return true
    } catch (error) {
      if (strict || targetBytes(value) || opaqueScope?.owned) problem(safeCode(error), 'other_nbt')
      return false
    } finally {
      opaqueScope = previous
    }
  }
  for await (const pair of records) {
    coverage.records++
    if (!Array.isArray(pair) || !Buffer.isBuffer(pair[0]) || !Buffer.isBuffer(pair[1])) { problem('RAW_RECORD_SHAPE'); continue }
    const [key, value] = pair; const name = keyName(key)
    try {
      if (name === 'DynamicProperties') {
        typeCount('world_dynamic_properties')
        if (!dp || !dp.equals(value)) problem('WORLD_PROPERTIES_NOT_PREFETCHED_OR_CHANGED', 'world_dynamic_properties')
      } else if (key.subarray(0, 11).equals(Buffer.from('actorprefix'))) {
        typeCount('actor'); coverage.actor_records++
        if (key.length <= 11) throw Object.assign(new Error(), { code: 'ACTOR_KEY_LENGTH' })
        // A noncanonical storage key can still retain an inventory. Keep its
        // exact opaque suffix, scan it, and report the anomaly without trying
        // to truncate, repair or convert it into an eight-byte digp target.
        if (key.length !== 19) warning('NONCANONICAL_ACTOR_KEY_SCANNED')
        actorKeys.add(key.subarray(11).toString('hex'))
        await entity((await parseRoots(value))[0], 'actor')
      } else if (key.subarray(0, 4).equals(Buffer.from('digp'))) {
        typeCount('actor_index')
        if (![12, 16].includes(key.length) || value.length % 8) throw Object.assign(new Error(), { code: 'ACTOR_INDEX_LENGTH' })
        for (let i = 0; i < value.length; i += 8) {
          const id = value.subarray(i, i + 8).toString('hex'); actorRefs.set(id, (actorRefs.get(id) ?? 0) + 1)
        }
      } else if (name.startsWith('player_') || name.startsWith('~local_player') || name.startsWith('legacy_console_player_')) {
        typeCount('player')
        const root = (await parseRoots(value))[0]
        if (root.type !== 'compound') throw Object.assign(new Error(), { code: 'PLAYER_NBT_ROOT' })
        const hasInventory = ['Inventory', 'Mainhand', 'Offhand', 'Armor', 'EnderChestInventory'].some(field => root.value[field] !== undefined)
        if (root.value.ServerId && !hasInventory) coverage.player_mapping_records++
        else coverage.player_data_records++
        // Classification must never skip saved contents: a mapping-shaped
        // record may still contain another supported player inventory.
        await walk(root, name.endsWith('.Editor') ? 'editor_player' : 'player_other', 'player')
      } else {
        const chunk = decodeChunkKey(key)
        if (chunk) {
          chunks.add(locationKey(chunk))
          if (chunk.tag === 0x2f) {
            typeCount('subchunk'); coverage.subchunks++
            const decoded = await parseSubchunk(value, chunk.y)
            for (const [layer, storage] of decoded.storages.entries()) {
              coverage.storages++
              const frequencies = new Uint32Array(storage.palette.length)
              for (const index of storage.indices) frequencies[index]++
              for (const [index, entry] of storage.palette.entries()) {
                count(paletteEntries, entry.name, `block_palette_layer_${layer}`, 1)
                stateRow(entry, layer, frequencies[index])
                if (frequencies[index]) count(blocks, entry.name, `placed_block_layer_${layer}`, frequencies[index], 1)
              }
            }
          } else if (chunk.tag === 0x31 || chunk.tag === 0x32) {
            const kind = chunk.tag === 0x31 ? 'container' : 'legacy_entity'; typeCount(kind)
            for (const root of await parseRoots(value, true)) {
              if (chunk.tag === 0x32) { coverage.legacy_entities++; await entity(root, 'legacy_entity') }
              else await walk(root, 'container_other', 'container')
            }
          } else if (chunk.tag === 0x33) {
            typeCount('scheduled_ticks')
            for (const entry of await parseScheduledTicks(value)) {
              addReference(entry.name, 'scheduled_tick')
              const parsed = validatedStates(entry, 'scheduled_tick_states')
              if (!parsed) continue
              const key = JSON.stringify([entry.name, parsed.states, parsed.types])
              const row = tickStates.get(key) ?? { id: entry.name, states: parsed.states, state_types: parsed.types, occurrences: 0 }
              row.occurrences++; tickStates.set(key, row)
            }
          } else if (chunk.tag === 0x30) {
            typeCount('legacy_terrain'); problem('LEGACY_TERRAIN_UNSUPPORTED', 'chunk')
          } else {
            typeCount('chunk_metadata')
            if (targetBytes(value)) await parseGeneric(key, value, true)
          }
        } else {
          const strict = /AutonomousEntities|LimboEntities|^structuretemplate_/.test(name)
          if (strict || value[0] === 10 || value[0] === 9 || targetBytes(value)) {
            const parsed = await parseGeneric(key, value, strict)
            typeCount(parsed ? 'other_nbt' : 'opaque')
            if (!parsed && targetBytes(value)) problem('UNCLASSIFIED_TARGET_RECORD')
          } else typeCount('opaque_without_target_namespace')
        }
      }
    } catch (error) { problem(safeCode(error), 'record') }
  }
  const identityCounts = { unique_identities: identities.size, duplicate_groups: 0, duplicate_records: 0, target_ambiguous_groups: 0, unrelated_duplicate_groups: 0 }
  for (const group of identities.values()) {
    if (group.length < 2) continue
    identityCounts.duplicate_groups++; identityCounts.duplicate_records += group.length - 1
    if (group.some(row => row.owned || row.failed)) {
      identityCounts.target_ambiguous_groups++
      for (let i = 1; i < group.length; i++) problem('DUPLICATE_ENTITY_IDENTITY', 'actor')
    } else {
      identityCounts.unrelated_duplicate_groups++
      for (let i = 1; i < group.length; i++) warning('DUPLICATE_NON_TARGET_ENTITY_IDENTITY')
    }
  }
  const indexCounts = { indexed_ids: actorRefs.size, missing_actor_records: 0, unindexed_actor_records: 0, duplicate_index_references: 0 }
  for (const [id, n] of actorRefs) { if (!actorKeys.has(id)) indexCounts.missing_actor_records++; if (n > 1) indexCounts.duplicate_index_references += n - 1 }
  for (const id of actorKeys) if (!actorRefs.has(id)) indexCounts.unindexed_actor_records++
  if (indexCounts.missing_actor_records) warning('ACTOR_INDEX_HAS_ABSENT_RECORDS')
  if (indexCounts.duplicate_index_references) warning('ACTOR_INDEX_DUPLICATES_NOT_RECOUNTED')
  const lookup = options.recordLookup ?? (Array.isArray(records) ? async key => records.find(([k]) => k.equals(key))?.[1] ?? null : null)
  for (const station of properties.stations ?? []) {
    let status = 'unavailable'
    try {
      const dimensions = { 'minecraft:overworld': 0, 'minecraft:nether': 1, 'minecraft:the_end': 2 }
      const dimension = typeof station.dimension === 'number' ? station.dimension : dimensions[station.dimension]
      if (!Number.isInteger(dimension) || ![station.x, station.y, station.z].every(Number.isSafeInteger)) throw Object.assign(new Error(), { code: 'STATION_COORDINATES_UNSUPPORTED' })
      if (!lookup) throw Object.assign(new Error(), { code: 'STATION_LOOKUP_UNAVAILABLE' })
      const x = Math.floor(station.x / 16), z = Math.floor(station.z / 16), y = Math.floor(station.y / 16)
      let value = await lookup(chunkKey(dimension, x, z, 0x2f, y))
      if (!value && dimension === 0) value = await lookup(chunkKey(dimension, x, z, 0x2f, y, true))
      if (!value) status = chunks.has(locationKey({ dimension, x, z })) ? 'air' : 'chunk_unavailable'
      else {
        const decoded = await parseSubchunk(value, y)
        const storage = decoded.storages[0]
        const mod = value => ((value % 16) + 16) % 16
        const index = (mod(station.x) << 8) | (mod(station.z) << 4) | mod(station.y)
        const actual = storage ? storage.palette[storage.indices[index]].name : 'minecraft:air'
        status = station.expectedIds.includes(actual) ? 'present' : actual === 'minecraft:air' ? 'air' : 'wrong_block'
      }
    } catch (error) { problem(safeCode(error), 'station') }
    const prefix = station.prefix
    stationCounts[prefix] ??= { present: 0, air: 0, wrong_block: 0, chunk_unavailable: 0, unavailable: 0 }
    stationCounts[prefix][status]++
  }
  return { schema: 1, task: 'T1.6', complete: errors.size === 0,
    runtime: { node: process.version, leveldb_zlib: require('leveldb-zlib/package.json').version, prismarine_nbt: require('prismarine-nbt/package.json').version },
    coverage, items: sorted(items), entities: sorted(entities), blocks: sorted(blocks), palette_entries: sorted(paletteEntries),
    block_states: [...blockStates.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    scheduled_tick_states: [...tickStates.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    serialized_items: sorted(serialized), references: sorted(references), dynamic_property_prefix_counts: properties.prefixCounts,
    station_keys: stationCounts, station_orphan_keys: Object.values(stationCounts).reduce((n, row) => n + row.air + row.wrong_block, 0),
    station_unavailable_keys: Object.values(stationCounts).reduce((n, row) => n + row.chunk_unavailable + row.unavailable, 0),
    actor_index: indexCounts, actor_identity: identityCounts, errors: [...errors.values()], warnings: [...warnings].map(([code, records]) => ({ code, records })),
    count_semantics: { items: 'Stack quantities at each persisted location; nested contents counted separately.',
      blocks: 'Actual palette index usage across every storage layer; unused palette entries are separate references.',
      serialized_items: 'Owned serialized contents; distinct from physical NBT stacks and metadata/journal references.',
      references: 'Encoded metadata, saved blueprints and recovery copies; not extra physical inventory.',
      actor_index: 'Every actor record scanned once; digp is an index, including duplicates and absent targets.' },
    client: false, production_ready: false }
}

async function main () {
  let raw = ''; for await (const part of process.stdin) raw += part
  const config = JSON.parse(raw)
  if (!config || typeof config.db !== 'string' || !Array.isArray(config.persistedKeys) || !Array.isArray(config.knownItems) || !Array.isArray(config.knownEntities) || !config.knownBlocks || typeof config.knownBlocks !== 'object') throw new Error('CONFIG_INVALID')
  const db = new LevelDB(config.db, { createIfMissing: false }); let iterator
  try {
    await db.open()
    const properties = await db.get(Buffer.from('DynamicProperties'))
    iterator = db.getIterator({ keyAsBuffer: true, valueAsBuffer: true, fillCache: false })
    async function * records () {
      for (;;) {
        const row = await iterator.next()
        if (!row) return
        const [value, key] = row
        if (key === undefined || key === null) return
        yield [key, value]
      }
    }
    const result = await census(records(), { persistedKeys: config.persistedKeys, dynamicProperties: properties,
      recordLookup: async key => await db.get(key), knownItems: config.knownItems, knownEntities: config.knownEntities, knownBlocks: config.knownBlocks })
    await iterator.end(); iterator = undefined
    await db.close()
    process.stdout.write(JSON.stringify(result))
    process.exitCode = result.complete ? 0 : 1
  } catch (error) {
    if (iterator) await iterator.end().catch(() => {})
    await db.close().catch(() => {})
    process.stdout.write(JSON.stringify({ schema: 1, task: 'T1.6', complete: false, errors: [{ code: 'DATABASE_READ_FAILED' }] }))
    console.error(error)
    process.exitCode = 1
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error)
    process.stdout.write(JSON.stringify({ schema: 1, task: 'T1.6', complete: false, errors: [{ code: 'BACKEND_FAILED' }] }))
    process.exitCode = 1
  })
}
