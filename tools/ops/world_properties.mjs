// Low-level, offline persisted-data interpretation. No world/LevelDB API imports.
// Sources: family_station_storage.js, itemDataCore.js, a25_plate_recipe_runtime.js,
// a2746_rack_item_codec.js and the public station-key producers at G155.
const KG = 'kaleidoscope_grilling:'
const ITEM_META = 'senluo:grilling_item_'
const TOKEN_PREFIX = '§r§0§r§1§r§2'
const RACK = KG + 'rack_payload'
const PLATE = KG + 'plate_skewers'
const ID = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/
const DIMENSIONS = new Map([['minecraft_overworld', 'minecraft:overworld'], ['minecraft_nether', 'minecraft:nether'], ['minecraft_the_end', 'minecraft:the_end']])
const MAX_DEPTH = 40
const MAX_NODES = 100000
const MAX_JSON = 1024 * 1024
// These values describe identity, provenance, user-visible text or a persisted
// property locator. They are not item/block IDs even when their text resembles
// a qualified identifier. In particular, never publish coordinate-bearing keys.
const NON_ID_FIELDS = new Set(['key', 'storageKey', 'ledgerKey', 'stationKey', 'player', 'playerId', 'owner', 'ownerId', 'entity', 'token', 'dimension', 'dimensionId', 'd', 'creator', 'name', 'nameTag', 'rawLore', 'lore', 'reason', 'error', 'rollback'])
const RESOURCE_FIELDS = new Set(['id', 'typeId', 'Name', 'identifier', 'resultId', 'block', 'type', 'itemId', 'outputId', 'inputId', 'sourceId', 'targetId'])
const RESOURCE_LISTS = new Set(['customIngredients', 'ingredients', 'seasoning', 'seasonings', 'canPlaceOn', 'canDestroy'])
const resourceField = field => RESOURCE_FIELDS.has(field) || RESOURCE_LISTS.has(field) || [KG + 'seasonings', KG + 'skewer_ingredients', KG + 'secret_cooked_ingredients', KG + 'failed_skewer_source', RACK, PLATE].includes(field)
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const fields = tag => tag?.type === 'compound' && record(tag.value) ? tag.value : null
const safeCount = value => Number.isSafeInteger(value) && value >= 0

function makeResult (prefixes = []) {
  return { prefixCounts: Object.fromEntries(prefixes.map(prefix => [prefix, 0])), stations: [], serializedItems: [], references: [], metadata: new Map(), errors: [] }
}
function error (result, code, prefix = '') { result.errors.push({ code, prefix }) }
function longest (key, prefixes) { return prefixes.find(prefix => key.startsWith(prefix)) }
function getPrefixes (prefixes) { return [...new Set(prefixes)].filter(x => typeof x === 'string').sort((a, b) => b.length - a.length || a.localeCompare(b)) }
function valueOf (tag) {
  if (!tag || typeof tag !== 'object') throw Error('DP_TYPE')
  if (tag.type === 'string') {
    if (typeof tag.value !== 'string' || tag.encoding === 'binary') throw Error('DP_STRING_ENCODING')
    return tag.value
  }
  if (['byte', 'short', 'int', 'float', 'double'].includes(tag.type) && Number.isFinite(tag.value)) return tag.value
  if (tag.type === 'compound') {
    const f = fields(tag)
    if (f && Object.keys(f).length === 3 && ['x', 'y', 'z'].every(k => f[k] && ['float', 'double', 'int'].includes(f[k].type) && Number.isFinite(f[k].value))) return Object.fromEntries(['x', 'y', 'z'].map(k => [k, f[k].value]))
  }
  throw Error('DP_TYPE')
}
function dynamicScopes (root, result, isWorld = false) {
  const f = fields(root)
  if (!f) { error(result, 'DYNAMIC_ROOT_TYPE'); return [] }
  let dp = root.name === 'DynamicProperties' ? root : f.DynamicProperties
  // World DB records may place the opaque owner compounds directly at root.
  if (!dp && isWorld && Object.values(f).every(v => fields(v))) dp = root
  if (!dp) { if (isWorld) error(result, 'WORLD_DYNAMIC_ROOT_MISSING'); return [] }
  const owners = fields(dp)
  if (!owners) { error(result, 'DYNAMIC_OWNERS_TYPE'); return [] }
  const scopes = []
  for (const [owner, tag] of Object.entries(owners)) {
    const props = fields(tag)
    if (!props) { error(result, 'DYNAMIC_OWNER_TYPE'); continue }
    scopes.push({ owner, props })
  }
  return scopes
}
function json (value, result, prefix) {
  if (typeof value !== 'string' || value.length > MAX_JSON) { error(result, 'PERSISTED_JSON_TYPE_OR_BUDGET', prefix); return undefined }
  try { return JSON.parse(value) } catch { error(result, 'PERSISTED_JSON_INVALID', prefix); return undefined }
}
function ownedId (id) { return typeof id === 'string' && ID.test(id) && id.startsWith(KG) }
function reference (result, id, location) {
  if (ownedId(id)) result.references.push({ id, location_type: location, occurrences: 1 })
}
function references (value, result, prefix, location, budget = { nodes: 0 }, depth = 0, allowIdentifier = true) {
  if (budget.failed) return
  if (++budget.nodes > MAX_NODES || depth > MAX_DEPTH) { budget.failed = true; error(result, 'REFERENCE_BUDGET', prefix); return }
  if (typeof value === 'string') {
    if (allowIdentifier && ownedId(value)) reference(result, value, location)
    else if (/^\s*[\[{]/.test(value)) {
      // Opaque user lore/names may begin with a bracket. Only known payload
      // readers below reject invalid JSON; generic reference search does not.
      if (value.length > MAX_JSON) { error(result, 'REFERENCE_JSON_BUDGET', prefix); return }
      let decoded
      try { decoded = JSON.parse(value) } catch { return }
      references(decoded, result, prefix, location, budget, depth + 1, allowIdentifier)
    }
  } else if (Array.isArray(value)) {
    for (const child of value) references(child, result, prefix, location, budget, depth + 1, allowIdentifier)
  } else if (record(value)) {
    for (const [field, child] of Object.entries(value)) {
      if (!NON_ID_FIELDS.has(field)) references(child, result, prefix, location, budget, depth + 1, resourceField(field))
    }
  }
}
function serialized (result, id, amount, multiplier, location, prefix) {
  if (typeof id !== 'string' || !ID.test(id) || !Number.isSafeInteger(amount) || amount < 1 || !Number.isSafeInteger(amount * multiplier)) {
    error(result, 'SERIALIZED_ITEM_SCHEMA', prefix); return false
  }
  if (multiplier === 0) { error(result, 'EMPTY_CARRIER_CONTENTS', prefix); reference(result, id, location + '/empty_carrier_reference'); return false }
  if (ownedId(id) && amount * multiplier > 0) result.serializedItems.push({ id, location_type: location, quantity: amount * multiplier, stacks: 1 })
  return true
}
function plainProperties (props, result, prefix, wrapped = false) {
  if (props === undefined) return {}
  if (!record(props)) { error(result, 'SERIALIZED_PROPERTIES_TYPE', prefix); return {} }
  const out = Object.create(null)
  for (const [key, row] of Object.entries(props)) {
    const primitive = value => typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
    const vector = value => record(value) && Object.keys(value).length === 3 && ['x', 'y', 'z'].every(k => Number.isFinite(value[k]))
    if (!wrapped) {
      if (primitive(row) || vector(row)) out[key] = row
      else error(result, 'SERIALIZED_PROPERTY_VALUE_SCHEMA', prefix)
    } else if (record(row) && Object.hasOwn(row, 'value') && (
      (row.kind === 'string' && typeof row.value === 'string') ||
      (row.kind === 'number' && typeof row.value === 'number' && Number.isFinite(row.value)) ||
      (row.kind === 'boolean' && typeof row.value === 'boolean') ||
      (row.kind === 'vector' && vector(row.value)))) out[key] = row.value
    else error(result, 'RACK_DYNAMIC_SCHEMA', prefix)
  }
  return out
}
function loreText (row) {
  if (typeof row === 'string') return row
  if (record(row) && typeof row.text === 'string') return row.text
  if (record(row) && Array.isArray(row.rawtext)) return row.rawtext.map(loreText).join('')
  return ''
}
function tokenProperties (lore, metadata, result) {
  if (lore !== undefined && !Array.isArray(lore)) { error(result, 'ITEM_LORE_SCHEMA', ITEM_META); return {} }
  const tokens = new Set()
  for (const row of lore ?? []) {
    const text = loreText(row)
    if (!text.startsWith(TOKEN_PREFIX)) continue
    const token = text.slice(TOKEN_PREFIX.length).replace(/§r$/, '').replace(/§/g, '')
    if (!/^[0-9a-f]{16}$/.test(token)) { error(result, 'ITEM_METADATA_TOKEN_INVALID', ITEM_META); continue }
    tokens.add(token)
  }
  if (tokens.size > 1) { error(result, 'ITEM_METADATA_TOKEN_AMBIGUOUS', ITEM_META); return {} }
  if (!tokens.size) return {}
  const candidates = metadata?.get([...tokens][0])
  if (!Array.isArray(candidates) || !candidates.length) { error(result, 'ITEM_METADATA_MISSING', ITEM_META); return {} }
  const unique = new Map(candidates.map(row => [row.raw, row.properties]))
  if (unique.size !== 1) { error(result, 'ITEM_METADATA_OWNER_AMBIGUOUS', ITEM_META); return {} }
  return unique.values().next().value
}
function mergeProperties (target, source, result, prefix) {
  for (const [key, value] of Object.entries(source)) {
    if (Object.hasOwn(target, key) && JSON.stringify(target[key]) !== JSON.stringify(value)) error(result, 'ITEM_PROPERTY_SOURCE_CONFLICT', prefix)
    else target[key] = value
  }
  return target
}
function analyzeProperties (props, metadata, result, multiplier, location, depth = 0) {
  if (depth > MAX_DEPTH) { error(result, 'SERIALIZED_DEPTH_BUDGET'); return }
  for (const [key, value] of Object.entries(props)) {
    if (key === RACK) {
      const data = json(value, result, RACK)
      if (data === undefined) continue
      if (!record(data) || data.version !== 1 || !Array.isArray(data.items) || data.items.length !== 9) { error(result, 'RACK_PAYLOAD_SCHEMA', RACK); continue }
      references(data.filters, result, RACK, 'rack_filter_reference')
      for (const row of data.items) {
        if (row === null) continue
        if (!record(row)) { error(result, 'RACK_PAYLOAD_SCHEMA', RACK); continue }
        if (!serialized(result, row.typeId, row.amount, multiplier, location + '/rack_payload', RACK)) continue
        const nested = plainProperties(row.dynamic, result, RACK, true)
        mergeProperties(nested, tokenProperties(row.rawLore, metadata, result), result, RACK)
        analyzeProperties(nested, metadata, result, multiplier * row.amount, location + '/rack_payload', depth + 1)
      }
    } else if (key === PLATE) {
      const data = json(value, result, PLATE)
      if (data !== undefined) plateRows(data, metadata, result, multiplier, location + '/plate_skewers', PLATE, depth + 1)
    } else {
      // Recipe ingredients/results, filters and state are references, never
      // physical carried items merely because they have an `id` field.
      if (key !== KG + 'secret_creator') references(value, result, longest(key, metadata?.prefixes ?? [KG, ITEM_META]) ?? '', 'item_property_reference')
    }
  }
}
function plateRows (rows, metadata, result, multiplier, location, prefix, depth) {
  if (!Array.isArray(rows) || rows.length > 5) { error(result, 'PLATE_PAYLOAD_SCHEMA', prefix); return }
  for (const row of rows) {
    if (!record(row) || (row.native !== undefined && (!record(row.native) || row.native.version !== 1 || row.native.id !== row.id))) { error(result, 'PLATE_ROW_SCHEMA', prefix); continue }
    if (!serialized(result, row.id, 1, multiplier, location, prefix)) continue
    // `id` and `native.id` describe the same stack, not two stacks.
    const props = plainProperties(row.native !== undefined ? row.native.props : row.props, result, prefix)
    mergeProperties(props, tokenProperties(row.native !== undefined ? row.native.rawLore : row.lore, metadata, result), result, prefix)
    analyzeProperties(props, metadata, result, multiplier, location, depth + 1)
  }
}
function encodedDimension (token, result, prefix) {
  const dimension = DIMENSIONS.get(token)
  if (!dimension) error(result, 'STATION_DIMENSION_UNRESOLVED', prefix)
  return dimension ?? null
}
function locationFromSuffix (suffix, format, result, prefix) {
  let match, dimension, dimensionToken
  if (format === 'pm') {
    match = /^(.+)_([pm]\d+)_([pm]\d+)_([pm]\d+)$/.exec(suffix)
    if (match) { dimensionToken = match[1]; dimension = encodedDimension(match[1], result, prefix) }
  } else if (format === 'signed') {
    match = /^(.+)_(-?\d+)_(-?\d+)_(-?\d+)$/.exec(suffix)
    if (match) { dimensionToken = match[1]; dimension = encodedDimension(match[1], result, prefix) }
  } else if (format === 'colon') {
    match = /^(.+):(-?\d+),(-?\d+),(-?\d+)$/.exec(suffix)
    if (match) dimension = match[1]
  } else {
    match = /^(.+)\/(-?\d+)\/(-?\d+)\/(-?\d+)$/.exec(suffix)
    if (match) dimension = match[1]
  }
  if (!match) { error(result, 'STATION_KEY_SCHEMA', prefix); return null }
  const xyz = match.slice(2).map(s => format === 'pm' ? (s[0] === 'm' ? -1 : 1) * Number(s.slice(1)) : Number(s))
  if (!xyz.every(Number.isSafeInteger)) { error(result, 'STATION_COORDINATE_SCHEMA', prefix); return null }
  return { dimension, ...(dimensionToken ? { dimensionToken } : {}), x: xyz[0], y: xyz[1], z: xyz[2] }
}
function station (result, location, prefix, role, expectedIds) {
  if (location) result.stations.push({ ...location, prefix, role, expectedIds })
}
function legacyRegistry (key, value, prefix, result) {
  // a2_grills is no longer produced by G155 runtime. Its historical canonical
  // producer is retained in development/gameplay_core/{runtime,a21_runtime}.js.
  // G155 a23_oil_world.loadReg still imports the legacy oil-source array through
  // oil_source_registry_core.normalizeOilSourceRow. Neither array is inventory.
  const oil = key === KG + 'a23_oil_sources'
  const code = oil ? 'LEGACY_OIL_REGISTRY_SCHEMA' : 'LEGACY_GRILL_REGISTRY_SCHEMA'
  const data = json(value, result, prefix)
  if (data === undefined) return
  if (!Array.isArray(data)) { error(result, code, prefix); return }
  if (!Object.hasOwn(result.metadata, 'locators')) Object.defineProperty(result.metadata, 'locators', { value: [], enumerable: false })
  const allowed = new Set(oil ? ['k', 'd', 'x', 'y', 'z', 'type', 'cells', 'nextTick'] : ['k', 'd', 'x', 'y', 'z'])
  for (const row of data) {
    if (!record(row) || Object.keys(row).some(k => !allowed.has(k)) || typeof row.d !== 'string' || !row.d ||
      !['x', 'y', 'z'].every(k => Number.isSafeInteger(row[k]))) { error(result, code, prefix); continue }
    const locatorKey = row.d + '|' + row.x + '|' + row.y + '|' + row.z
    if ((!oil && row.k !== locatorKey) || (oil && row.k !== undefined && row.k !== locatorKey)) { error(result, code, prefix); continue }
    if (oil && (!['canola', 'secret_chili', 'premium_chili'].includes(row.type) ||
      (row.nextTick !== undefined && (!Number.isSafeInteger(row.nextTick) || row.nextTick < 0)) ||
      (row.cells !== undefined && (!Array.isArray(row.cells) || row.cells.length > 512 || row.cells.some(cell => typeof cell !== 'string' || !cell))))) { error(result, code, prefix); continue }
    const expected = oil ? KG + row.type + '_oil' : KG + 'grill'
    const locator = { prefix, role: oil ? 'legacy_oil_registry' : 'legacy_grill_registry', dimension: row.d, x: row.x, y: row.y, z: row.z, expectedIds: [expected] }
    if (oil && row.cells !== undefined) locator.flowCells = [...row.cells]
    // Internal locator evidence is retained for nonempty arrays. These are
    // references to separately counted block palettes, never extra stations.
    result.metadata.locators.push(locator)
    reference(result, expected, 'legacy_registry_reference')
  }
}
function worldProperty (key, value, prefix, result) {
  const meta = result.metadata
  if (key === KG + 'a23_oil_sources' || key === KG + 'a2_grills') {
    legacyRegistry(key, value, prefix, result)
    return
  }
  // Transaction and delivery snapshots are references only; their saved
  // contents are not additional active inventory and they are not stations.
  if (/_delivery$/.test(key) || key.includes('_registry') || key.startsWith(KG + 'player_item_receipt_')) {
    const data = json(value, result, prefix)
    if (data !== undefined) {
      const legacyRegistry = key === KG + 'a26_press_registry'
      if (legacyRegistry ? !Array.isArray(data) : !record(data)) error(result, 'RECOVERY_OR_REGISTRY_SCHEMA', prefix)
      else references(data, result, prefix, 'recovery_reference')
    }
    return
  }
  if (/_transaction_fault$/.test(key) || key.startsWith(KG + 'oil_transaction_fault_')) {
    if (typeof value !== 'string') error(result, 'TRANSACTION_FAULT_SCHEMA', prefix)
    else references(value, result, prefix, 'recovery_reference')
    return
  }
  if (key.startsWith(KG + 'storage_v1/')) {
    const data = json(value, result, prefix)
    if (data === undefined) return
    const allowed = [KG + 'grill', KG + 'advanced_rack_block', KG + 'seasoning_bottle']
    if (!record(data) || data.v !== 1 || data.key !== key || !allowed.includes(data.block) || typeof data.entity !== 'string' || !data.entity || typeof data.token !== 'string' || !data.token) { error(result, 'STORAGE_LEDGER_SCHEMA', prefix); return }
    const ids = data.block === KG + 'seasoning_bottle' ? [1, 2, 3, 4].map(n => KG + 'seasoning_bottle_' + n) : [data.block]
    station(result, locationFromSuffix(key.slice((KG + 'storage_v1/').length), 'slash', result, prefix), prefix, data.retiredEmpty === true ? 'retired_empty_storage_ledger' : 'hidden_inventory_ledger', ids)
    // Native hidden entities are counted by the caller's physical census.
    // seasoning_bottle is a storage-type alias, not a real registered resource.
    if (data.block !== KG + 'seasoning_bottle') references(data.block, result, prefix, 'storage_ledger_reference')
    return
  }
  if (key.startsWith(KG + 'a23_oil_source_')) {
    const data = json(value, result, prefix)
    if (data === undefined) return
    if (!record(data) || typeof data.d !== 'string' || !data.d || !['x', 'y', 'z'].every(k => Number.isSafeInteger(data[k])) || !['canola', 'secret_chili', 'premium_chili'].includes(data.type)) { error(result, 'OIL_SOURCE_SCHEMA', prefix); return }
    station(result, { dimension: data.d, x: data.x, y: data.y, z: data.z }, prefix, 'oil_source', [KG + data.type + '_oil'])
    return
  }
  const pmStations = [
    ['a26_press_instance_', 'oil_press_instance', [KG + 'oil_press']],
    ['a26_vat_instance_', 'big_vat_instance', [KG + 'big_vat']],
    ['a26_press_', 'oil_press', [KG + 'oil_press']], ['a26_vat_', 'big_vat', [KG + 'big_vat']],
    ['a2736_oilpot_type_', 'legacy_oil_type', ['kaleidoscope_cookery:oil_pot']],
    ['g_', 'grill_state', [KG + 'grill']], ['sb_', 'seasoning_state', [1, 2, 3, 4].map(n => KG + 'seasoning_bottle_' + n)],
    ['rack_filters_', 'rack_filters', [KG + 'advanced_rack_block']],
    ['a25_plate_', 'plate_contents', [KG + 'skewer_plate_block']], ['a25_recipe_', 'recipe_book', [KG + 'skewer_recipe']]
  ]
  const rule = pmStations.find(([p]) => key.startsWith(KG + p))
  if (rule) {
    const [short, role, ids] = rule
    const location = locationFromSuffix(key.slice((KG + short).length), 'pm', result, prefix)
    station(result, location, prefix, role, ids)
    if (role === 'plate_contents') {
      const data = json(value, result, prefix)
      if (data !== undefined) plateRows(data, meta, result, 1, 'world_plate_serialized', prefix, 0)
    } else if (role === 'recipe_book') {
      const row = json(value, result, prefix)
      if (!record(row) || row.id !== KG + 'skewer_recipe_book' || (row.native !== undefined && (!record(row.native) || row.native.version !== 1 || row.native.id !== row.id))) error(result, 'RECIPE_BOOK_SCHEMA', prefix)
      else {
        serialized(result, row.id, 1, 1, 'world_recipe_serialized', prefix)
        const props = plainProperties(row.native !== undefined ? row.native.props : row.props, result, prefix)
        mergeProperties(props, tokenProperties(row.native !== undefined ? row.native.rawLore : row.lore, meta, result), result, prefix)
        analyzeProperties(props, meta, result, 1, 'world_recipe_serialized')
      }
    } else if (['grill_state', 'seasoning_state', 'rack_filters', 'oil_press', 'big_vat'].includes(role)) {
      const data = json(value, result, prefix)
      if (data !== undefined) {
        const array = ['seasoning_state', 'rack_filters'].includes(role)
        if (array ? !Array.isArray(data) : !record(data)) error(result, 'STATION_VALUE_SCHEMA', prefix)
        else references(data, result, prefix, 'station_state_reference')
      }
    } else references(value, result, prefix, 'station_state_reference')
    return
  }
  if (key.startsWith(KG + 'cuisine_')) {
    station(result, locationFromSuffix(key.slice((KG + 'cuisine_').length), 'signed', result, prefix), prefix, 'cuisine_state', ['kaleidoscope_cookery:pot', 'kaleidoscope_cookery:stockpot'])
    const data = json(value, result, prefix)
    if (data !== undefined && !record(data)) error(result, 'CUISINE_STATE_SCHEMA', prefix)
    references(data, result, prefix, 'cuisine_state_reference'); return
  }
  const colon = ['kc_oilpot:', 'senluo:oil_api_placed:', 'senluo:oil_api_recovery:'].find(p => key.startsWith(p))
  if (colon) {
    station(result, locationFromSuffix(key.slice(colon.length), 'colon', result, prefix), prefix, colon.includes('recovery') ? 'oil_recovery' : 'oil_station', ['kaleidoscope_cookery:oil_pot'])
    if (colon === 'kc_oilpot:') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) error(result, 'OIL_COUNT_SCHEMA', prefix)
    } else {
      const data = json(value, result, prefix)
      if (data !== undefined && !record(data)) error(result, 'OIL_STATE_SCHEMA', prefix)
      references(data, result, prefix, 'oil_state_reference')
    }
    return
  }
  if (key.startsWith('senluo:cuisine_metadata:')) {
    station(result, locationFromSuffix(key.slice('senluo:cuisine_metadata:'.length), 'colon', result, prefix), prefix, 'host_cuisine_metadata', ['kaleidoscope_cookery:pot', 'kaleidoscope_cookery:stockpot'])
    const data = json(value, result, prefix)
    if (data !== undefined && !record(data)) error(result, 'CUISINE_STATE_SCHEMA', prefix)
    references(data, result, prefix, 'world_property_reference')
    return
  }
  if (key !== KG + 'secret_creator') references(value, result, prefix, 'world_property_reference')
  if (prefix === KG) error(result, 'UNRECOGNIZED_WORLD_PROPERTY', prefix)
}

export function analyzeWorldProperties (typedRoot, prefixes) {
  const sorted = getPrefixes(prefixes)
  const result = makeResult(sorted)
  result.metadata.prefixes = sorted
  const rows = []
  for (const { owner, props } of dynamicScopes(typedRoot, result, true)) {
    for (const [key, tag] of Object.entries(props)) {
      const prefix = longest(key, sorted)
      if (prefix === undefined) continue
      result.prefixCounts[prefix]++
      let value
      try { value = valueOf(tag) } catch (e) { error(result, e.message, prefix); continue }
      if (key.startsWith(ITEM_META)) {
        const token = key.slice(ITEM_META.length)
        const data = json(value, result, prefix)
        if (!/^[0-9a-f]{16}$/.test(token) || !record(data)) { error(result, 'ITEM_METADATA_SCHEMA', prefix); continue }
        const bucket = result.metadata.get(token) ?? []
        bucket.push({ owner, raw: value, properties: plainProperties(data, result, prefix) })
        result.metadata.set(token, bucket)
        references(data, result, prefix, 'immutable_item_metadata_reference')
      } else rows.push({ key, value, prefix })
    }
  }
  for (const { key, value, prefix } of rows) worldProperty(key, value, prefix, result)
  return result
}

export function analyzeStackProperties (typedItem, worldMetadata, inactiveCarrier = false) {
  const result = makeResult()
  const item = fields(typedItem)
  if (!item) { error(result, 'ITEM_COMPOUND_TYPE'); return result }
  const count = item.Count
  let multiplier = count?.value
  if (count?.type === 'byte' && Number.isInteger(multiplier) && multiplier >= -128 && multiplier <= 255) multiplier &= 255
  else if (!count || !['short', 'int', 'long', 'float', 'double'].includes(count.type) || !safeCount(multiplier)) multiplier = undefined
  if (!safeCount(multiplier)) { error(result, 'ITEM_CARRIER_COUNT'); return result }
  if (inactiveCarrier) multiplier = 0
  const tag = fields(item.tag)
  if (item.tag !== undefined && !tag) { error(result, 'ITEM_TAG_SCHEMA'); return result }
  const props = Object.create(null)
  const prefixes = worldMetadata?.prefixes ?? [KG, ITEM_META, 'kc_oil_count']
  if (tag?.DynamicProperties) {
    for (const { props: scoped } of dynamicScopes(item.tag, result)) {
      for (const [key, value] of Object.entries(scoped)) {
        const prefix = longest(key, prefixes)
        if (prefix === undefined) continue
        try { mergeProperties(props, { [key]: valueOf(value) }, result, prefix) } catch (e) { error(result, e.message, prefix) }
      }
    }
  }
  let lore = []
  const loreTag = fields(tag?.display)?.Lore
  if (loreTag) {
    if (loreTag.type !== 'list' || loreTag.value?.type !== 'string' || !Array.isArray(loreTag.value.value)) error(result, 'ITEM_LORE_SCHEMA', ITEM_META)
    else lore = loreTag.value.value
  }
  mergeProperties(props, tokenProperties(lore, worldMetadata, result), result, ITEM_META)
  analyzeProperties(props, worldMetadata, result, multiplier, 'carried_serialized')
  return result
}
