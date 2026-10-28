
import {createFixture} from '../helpers/minecraft-fixture.mjs';
import * as layout from '../../projects/grilling/gameplay_core/behavior_pack/scripts/advanced_rack_layout.js';
import {planInventoryInsert, slotWrite} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/rack_transfer_plan.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../../projects/grilling/gameplay_core/behavior_pack/scripts/rack/advanced_rack_core.js';

test('Java public rack tags are independent per slot, including dual-tag items',()=>{
 const seasoningTag='kaleidoscope_grilling:advanced_rack_seasonings',toolTag='kaleidoscope_grilling:advanced_rack_tools';
 for(let slot=0;slot<9;slot++){
  assert.equal(core.rackCanPlace(slot,'custom:both',[seasoningTag,toolTag]),true);
  const filter=core.rackCanonicalFilter('custom:both',[seasoningTag,toolTag],slot);
  assert.equal(filter.kind,slot<5?'seasoning':'tool');assert.equal(core.rackCanPlace(slot,'custom:both',[seasoningTag,toolTag],filter),true);
  assert.equal(core.rackCanPlace(slot,'custom:one',[seasoningTag]),slot<5);
  assert.equal(core.rackCanPlace(slot,'custom:one',[toolTag]),slot>=5);
  assert.equal(core.rackCanPlace(slot,'custom:none',[]),false);
 }
});

// Native registered-event scenarios retained from PR250; pure assertions above remain unchanged.
{
/** Native ESM rack scenarios. Only the Minecraft host is doubled. */

const SEASONING_TAG = 'kaleidoscope_grilling:advanced_rack_seasonings';
const TOOL_TAG = 'kaleidoscope_grilling:advanced_rack_tools';
const BINDING = 'kaleidoscope_grilling:rack_binding_0';
const RACK_COMMAND = 'kaleidoscope_grilling:rack';

async function fixture() {
 const f = createFixture();
 f.tx = await f.load('rack_transactions.js');
 f.state = await f.load('rack/rack_state_adapter.js');
 f.automation = await f.load('rack/rack_automation_api.js');
 f.codec = await f.load('rack/rack_item_codec.js');
 f.storage = await f.load('family_station_storage.js');
 await f.load('rack/advanced_rack_runtime.js');
 f.holder = f.player({location: {x: 0, y: 64, z: 0}});
 f.inv = f.holder.inventory;
 f.racks = [];
 f.rack = (x = 0, y = 64, z = 0, options = {}) => {
  const b = f.block(core.ADVANCED_RACK_BLOCK_ID, {x, y, z}, {
   states: {'minecraft:cardinal_direction': 'north', 'kaleidoscope_grilling:spice_level': 0,
    [layout.RACK_OCCUPANCY_STATE]: 0, [layout.RACK_OCCUPANCY_HIGH_STATE]: 0},
   inventorySize: 9, ...options
  });
  f.racks.push(b);
  return b;
 };
 f.startup();
 // Let real dependency startup work finish before fault injection or snapshots.
 f.flush();
 return f;
}

function stack(f, typeId, amount = 1, tags = []) {
 const item = f.item(typeId, amount, {tags});
 item.nameTag = 'Named original';
 item.setLore(['Original lore', {rawtext: [{text: 'Second line'}]}]);
 item.keepOnDeath = false;
 item.lockMode = 'none';
 item.setCanDestroy(['minecraft:stone']);
 item.setCanPlaceOn(['minecraft:dirt']);
 return item;
}
// Tagged extensions may stack; the canonical native bottle itself has capacity one.
const seasoning = (f, amount = 1) => stack(f, 'custom:test_seasoning', amount, [SEASONING_TAG]);
function tool(f, typeId = 'kaleidoscope_cookery:iron_kitchen_knife') {
 const item = stack(f, typeId);
 item.maxAmount = 1;
 item.setDynamicProperty('test:public', 'original metadata');
 item.setDynamicProperty('test:vector', {x: 1, y: 2, z: 3});
 const durability = item.getComponent('minecraft:durability');
 if (durability) durability.damage = 19;
 item.getComponent('minecraft:enchantable').addEnchantments([{type: new f.server.EnchantmentType('unbreaking'), level: 3}]);
 return item;
}
const contents = c => Array.from({length: c.size}, (_, i) => c.getItem(i));
const properties = o => Object.fromEntries(o.getDynamicPropertyIds().sort().map(k => [k, o.getDynamicProperty(k)]));

// Compare public ItemStack data, never clone-specific method closures.
function observed(value) {
 if (value && typeof value.getRawLore === 'function' && 'amount' in value) {
  const damage = value.getComponent('minecraft:durability');
  return {typeId: value.typeId, amount: value.amount, maxAmount: value.maxAmount,
   nameTag: value.nameTag, keepOnDeath: value.keepOnDeath, lockMode: value.lockMode,
   tags: value.getTags().sort(), lore: value.getRawLore(), dynamic: properties(value),
   durability: damage ? {damage: damage.damage, maxDurability: damage.maxDurability} : undefined,
   enchantments: value.getComponent('minecraft:enchantable')?.getEnchantments().map(e => ({id: e.type.id, level: e.level})),
   canDestroy: value.getCanDestroy(), canPlaceOn: value.getCanPlaceOn()};
 }
 if (Array.isArray(value)) return value.map(observed);
 if (value && Object.getPrototypeOf(value) === Object.prototype)
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, observed(child)]));
 return value;
}
function same(actual, expected, message) {assert.deepEqual(observed(actual), observed(expected), message);}

function snapshot(f) {
 return {inventory: contents(f.inv), player: properties(f.holder), world: properties(f.world),
  racks: f.racks.map(b => contents(b.inventory))};
}
const receipt = (f, b, slot = 0) => ({dimension: f.dimension.id, ...b.location, slot});
function failWrite(f, target, method, key, phase = 'after') {
 f.faults.failNext(target, method, {phase, predicate: actual => actual === key});
}
function fill(c, item) {for (let i = 0; i < c.size; i++) c.setItem(i, item);}
function seedFilter(f, b, slot, item) {
 const filters = Array(9).fill(null);
 filters[slot] = core.rackCanonicalFilter(item.typeId, item.getTags(), slot);
 assert.equal(f.state.writeRackFilters(b, filters), true);
}
function click(f, b, slot, options = {}) {
 const {player: p = f.holder, oblique = 0, ...eventOptions} = options;
 const direction = b.permutation.getState('minecraft:cardinal_direction');
 const x = slot < 5 ? layout.RACK_SEASONING_X[slot] : layout.RACK_TOOL_X[slot - 5];
 const at = layout.rackDisplayPose(b, x, slot < 5 ? 12 / 16 : layout.RACK_TOOL_VISUAL_Y,
  slot < 5 ? .35 : layout.RACK_TOOL_VISUAL_Z).location;
 const outward = {north: {x: 0, z: -1}, south: {x: 0, z: 1}, east: {x: 1, z: 0}, west: {x: -1, z: 0}}[direction];
 p.eye = {x: at.x + outward.x * 2 + outward.z * oblique, y: at.y,
  z: at.z + outward.z * 2 - outward.x * oblique};
 p.view = {x: at.x - p.eye.x, y: 0, z: at.z - p.eye.z};
 p.getHeadLocation = () => ({...p.eye});
 p.getViewDirection = () => ({...p.view});
 p.inputInfo ??= {lastInputModeUsed: 'KeyboardAndMouse'};
 const e = {cancel: false, isFirstEvent: true, block: b, player: p,
  itemStack: p.inventory.getItem(p.selectedSlotIndex),
  faceLocation: {x: at.x - b.x, y: at.y - b.y, z: at.z - b.z}, ...eventOptions};
 f.emit('world.beforeEvents.playerInteractWithBlock', e);
 return e;
}
function use(f, b, slot, options = {}) {const event = click(f, b, slot, options); f.flush(); return event;}
function command(f) {f.command(RACK_COMMAND, {sourceEntity: f.holder});}
function activeDrops(f) {return f.drops.filter(drop => drop.isValid !== false);}
function droppedStack(drop) {return drop.itemStack ?? drop.stack ?? drop.getComponent('minecraft:item')?.itemStack;}

// Transactions use the actual exported functions, and all runtime actions below
// enter through registered events or the registered command. No private exports.
test('public rack tags admit each correct slot independently, including dual-tag items', () => {
 for (let slot = 0; slot < 9; slot++) {
  const filter = core.rackCanonicalFilter('custom:both', [SEASONING_TAG, TOOL_TAG], slot);
  assert.equal(filter.kind, slot < 5 ? 'seasoning' : 'tool');
  assert.equal(core.rackCanPlace(slot, 'custom:both', [SEASONING_TAG, TOOL_TAG], filter), true);
  assert.equal(core.rackCanPlace(slot, 'custom:one', [SEASONING_TAG]), slot < 5);
  assert.equal(core.rackCanPlace(slot, 'custom:one', [TOOL_TAG]), slot >= 5);
  assert.equal(core.rackCanPlace(slot, 'custom:none', []), false);
 }
});

test('exported deposit preserves native metadata and uses the explicit source inventory slot', async () => {
 const f = await fixture(), b = f.rack(), original = tool(f);
 original.keepOnDeath = true; original.lockMode = 'inventory';
 f.inv.setItem(3, original);
 f.inv.setItem(0, seasoning(f, 4));
 assert.equal(f.tx.depositInventorySlot(f.inv, 3, b, 5), 1);
 assert.equal(f.inv.getItem(3), undefined);
 assert.equal(f.inv.getItem(0).amount, 4);
 same(b.inventory.getItem(5), original);
 assert.ok(f.state.readRackFilters(b)[5]);
});

for (const target of ['filter', 'rack', 'source']) test(`deposit ${target} post-write failure restores metadata and absent filters`, async () => {
 const f = await fixture(), b = f.rack();
 f.inv.setItem(0, seasoning(f, 8));
 const before = snapshot(f);
 if (target === 'filter') failWrite(f, f.world, 'setDynamicProperty', f.state.rackFiltersKey(b));
 else failWrite(f, target === 'rack' ? b.inventory : f.inv, 'setItem', 0);
 assert.equal(f.tx.depositInventorySlot(f.inv, 0, b, 0), 0);
 same(snapshot(f), before);
});

test('insert plan limits capacity, respects existing metadata, and preserves the source remainder', async () => {
 const f = await fixture(), b = f.rack();
 b.inventory.setItem(0, seasoning(f, 60));
 f.inv.setItem(0, seasoning(f, 8));
 assert.equal(f.tx.depositInventorySlot(f.inv, 0, b, 0), 4);
 assert.equal(b.inventory.getItem(0).amount, 64);
 assert.equal(f.inv.getItem(0).amount, 4);
 const before = snapshot(f);
 assert.equal(f.tx.depositInventorySlot(f.inv, 0, b, 0), 0);
 same(snapshot(f), before);
 const different = seasoning(f, 1); different.nameTag = 'Different';
 b.inventory.setItem(1, different);
 assert.equal(f.tx.planRackInsert(b, 1, seasoning(f, 2)), undefined);
 same(b.inventory.getItem(1), different);
});

for (const target of ['destination', 'source']) test(`exported withdrawal plan rolls back earlier merges on ${target} rejection`, async () => {
 const f = await fixture(), b = f.rack();
 b.inventory.setItem(0, seasoning(f, 8));
 f.inv.setItem(0, seasoning(f, 60));
 const before = snapshot(f), stored = b.inventory.getItem(0);
 const plan = planInventoryInsert(f.inv, stored);
 assert.equal(plan.moved, 8);
 failWrite(f, target === 'destination' ? f.inv : b.inventory, 'setItem', target === 'destination' ? 1 : 0);
 assert.equal(f.tx.commitRackTransfer([b], [...plan.steps, slotWrite(b.inventory, 0, plan.remainder)]), false);
 same(snapshot(f), before);
});

for (const slot of [0, 1, 2]) test(`sneak swap rolls back inventory write ${slot} and the requested rack item`, async () => {
 const f = await fixture(), b = f.rack();
 b.inventory.setItem(0, seasoning(f, 7));
 f.inv.setItem(0, stack(f, 'minecraft:cobblestone', 8));
 f.inv.setItem(1, stack(f, 'minecraft:cobblestone', 60));
 f.holder.isSneaking = true;
 const before = snapshot(f);
 failWrite(f, f.inv, 'setItem', slot);
 use(f, b, 0);
 same(snapshot(f), before);
 assert.equal(f.sounds.length, 0);
});

test('sneak swap rack-source rejection leaves all native items and metadata intact', async () => {
 const f = await fixture(), b = f.rack();
 b.inventory.setItem(0, seasoning(f, 7)); f.inv.setItem(0, stack(f, 'minecraft:cobblestone', 8));
 f.holder.isSneaking = true;
 const before = snapshot(f); failWrite(f, b.inventory, 'setItem', 0);
 use(f, b, 0); same(snapshot(f), before); assert.equal(f.sounds.length, 0);
});

test('full inventory rejects unsafe swaps; matching sneak pickup moves only available capacity', async () => {
 const f = await fixture(), b = f.rack();
 b.inventory.setItem(0, seasoning(f, 8)); fill(f.inv, stack(f, 'minecraft:stone', 64));
 f.inv.setItem(0, stack(f, 'minecraft:cobblestone', 8));
 const before = snapshot(f);
 use(f, b, 0); f.holder.isSneaking = true; use(f, b, 0);
 same(snapshot(f), before); assert.equal(f.sounds.length, 0);
 f.inv.setItem(0, seasoning(f, 60)); use(f, b, 0);
 assert.equal(f.inv.getItem(0).amount, 64); assert.equal(b.inventory.getItem(0).amount, 4);
 same(JSON.parse(f.holder.getDynamicProperty(BINDING)), receipt(f, b));
});

test('matching-return command source failure does not duplicate a stack', async () => {
 const f = await fixture(), b = f.rack(); f.inv.setItem(0, seasoning(f, 8));
 seedFilter(f, b, 0, f.inv.getItem(0)); const before = snapshot(f);
 failWrite(f, f.inv, 'setItem', 0); command(f); f.flush();
 same(snapshot(f), before); assert.equal(f.sounds.length, 0);
});

test('malformed filters fail before native item mutations', async () => {
 const f = await fixture(), b = f.rack(); f.inv.setItem(0, seasoning(f, 8));
 f.world.setDynamicProperty(f.state.rackFiltersKey(b), '[{"kind":"tool","category":"exact","typeId":"custom:wrong"}]');
 const before = snapshot(f);
 assert.throws(() => f.tx.depositInventorySlot(f.inv, 0, b, 0), /Invalid rack filters/);
 same(snapshot(f), before);
 use(f, b, 0); same(snapshot(f), before); assert.equal(f.sounds.length, 0);
});

for (const target of ['requested', 'return', 'hand', 'filter']) test(`bound cross-rack swap failure at ${target} restores both racks and binding`, async () => {
 const f = await fixture(), b = f.rack(), other = f.rack(2);
 b.inventory.setItem(0, seasoning(f, 7)); f.inv.setItem(0, stack(f, 'custom:spice', 8, [SEASONING_TAG]));
 f.holder.setDynamicProperty(BINDING, JSON.stringify(receipt(f, other, 1)));
 f.holder.isSneaking = true; const before = snapshot(f);
 if (target === 'filter') failWrite(f, f.world, 'setDynamicProperty', f.state.rackFiltersKey(other));
 else failWrite(f, target === 'requested' ? b.inventory : target === 'return' ? other.inventory : f.inv,
  'setItem', target === 'return' ? 1 : 0);
 use(f, b, 0); same(snapshot(f), before); assert.equal(f.sounds.length, 0);
});

test('bound cross-rack swap returns the held original before switching its binding', async () => {
 const f = await fixture(), b = f.rack(), other = f.rack(2), held = stack(f, 'custom:spice', 8, [SEASONING_TAG]);
 b.inventory.setItem(0, seasoning(f, 7)); f.inv.setItem(0, held);
 f.holder.setDynamicProperty(BINDING, JSON.stringify(receipt(f, other, 1))); f.holder.isSneaking = true;
 use(f, b, 0);
 assert.equal(b.inventory.getItem(0), undefined); same(other.inventory.getItem(1), held);
 assert.equal(f.inv.getItem(0).amount, 7); same(JSON.parse(f.holder.getDynamicProperty(BINDING)), receipt(f, b));
});

test('native click inserts and retrieves every slot with exact metadata for all facings', async () => {
 for (const facing of ['north', 'east', 'south', 'west']) for (let slot = 0; slot < 9; slot++) {
  const f = await fixture(), b = f.rack();
  b.setPermutation(b.permutation.withState('minecraft:cardinal_direction', facing));
  for (let i = 0; i < 9; i++) if (i !== slot) b.inventory.setItem(i, i < 5 ? seasoning(f, 3) : tool(f));
  const neighbors = contents(b.inventory), held = slot < 5 ? seasoning(f, 9) : tool(f);
  f.inv.setItem(0, held);
  assert.equal(use(f, b, slot).cancel, true); same(b.inventory.getItem(slot), held); assert.equal(f.inv.getItem(0), undefined);
  use(f, b, slot); same(f.inv.getItem(0), held); same(contents(b.inventory), neighbors);
  same(f.sounds.map(row => row.sound), ['block.itemframe.add_item', 'block.itemframe.remove_item']);
 }
});

test('only empty-hand sneak clears an empty persistent filter, with rollback on rejection', async () => {
 const f = await fixture(), b = f.rack(); f.inv.setItem(0, seasoning(f, 8));
 use(f, b, 0); use(f, b, 0); assert.ok(f.state.readRackFilters(b)[0]);
 f.inv.setItem(0, undefined); use(f, b, 0); assert.ok(f.state.readRackFilters(b)[0]);
 f.holder.isSneaking = true; const before = snapshot(f);
 failWrite(f, f.world, 'setDynamicProperty', f.state.rackFiltersKey(b)); use(f, b, 0);
 same(snapshot(f), before);
 use(f, b, 0); assert.equal(f.state.readRackFilters(b)[0], null);
});

for (const target of ['filter', 'rack', 'hand']) test(`event insert ${target} failure rolls back before any success sound`, async () => {
 const f = await fixture(), b = f.rack(); f.inv.setItem(0, seasoning(f, 8)); const before = snapshot(f);
 if (target === 'filter') failWrite(f, f.world, 'setDynamicProperty', f.state.rackFiltersKey(b));
 else failWrite(f, target === 'rack' ? b.inventory : f.inv, 'setItem', 0);
 use(f, b, 0); same(snapshot(f), before); assert.equal(f.sounds.length, 0);
});

test('deferred clicks reject stale player, selected slot, hand metadata, sneak, facing and block identity', async () => {
 const mutations = [
  f => {f.holder.selectedSlotIndex = 1;},
  f => {const s = f.inv.getItem(0); s.amount--; f.inv.setItem(0, s);},
  f => {const s = f.inv.getItem(0); s.setCanDestroy(['minecraft:obsidian']); f.inv.setItem(0, s);},
  f => {f.holder.isSneaking = true;}, f => {f.holder.location.x = 100;},
  f => {f.holder.dimension = {id: 'minecraft:nether'};}, f => {f.holder.isValid = false;},
  (f, b) => {b.setPermutation(b.permutation.withState('minecraft:cardinal_direction', 'east'));},
  (f, b) => {b.setType('minecraft:air');}
 ];
 for (const mutate of mutations) {
  const f = await fixture(), b = f.rack(); f.inv.setItem(0, seasoning(f, 8)); click(f, b, 0); mutate(f, b);
  const held = f.inv.getItem(0); f.flush();
  same(f.inv.getItem(0), held); assert.equal(b.inventory.getItem(0), undefined); assert.equal(f.sounds.length, 0);
 }
});

test('repeat and offhand events never mutate rack or either hand', async () => {
 for (const repeated of [true, false]) {
  const f = await fixture(), b = f.rack(); f.inv.setItem(0, seasoning(f, 8));
  f.holder.equipment.setEquipment('Offhand', tool(f)); const before = snapshot(f);
  use(f, b, 0, repeated ? {isFirstEvent: false} : {itemStack: f.holder.equipment.getEquipment('Offhand')});
  same(snapshot(f), before); same(f.holder.equipment.getEquipment('Offhand'), tool(f));
 }
});

test('two queued players reread live rack capacity before insertion and pickup', async () => {
 const f = await fixture(), b = f.rack(), p2 = f.player({location: {x: 0, y: 64, z: 0}});
 f.inv.setItem(0, seasoning(f, 8)); p2.inventory.setItem(0, seasoning(f, 9));
 click(f, b, 0); click(f, b, 0, {player: p2}); f.flush();
 assert.equal(b.inventory.getItem(0).amount, 17); assert.equal(f.inv.getItem(0), undefined); assert.equal(p2.inventory.getItem(0), undefined);
 click(f, b, 0); click(f, b, 0, {player: p2}); f.flush();
 assert.equal(f.inv.getItem(0).amount, 17); assert.equal(p2.inventory.getItem(0), undefined); assert.equal(b.inventory.getItem(0), undefined);
 f.inv.setItem(0, tool(f)); p2.inventory.setItem(0, tool(f));
 click(f, b, 8); click(f, b, 8, {player: p2}); f.flush();
 assert.ok(b.inventory.getItem(8)); assert.equal(f.inv.getItem(0), undefined); assert.ok(p2.inventory.getItem(0));
});

test('registered return command handles matching slots and identical main/offhand items, but rejects stale mainhand', async () => {
 const f = await fixture(), b = f.rack();
 f.inv.setItem(0, stack(f, 'minecraft:totem_of_undying')); f.holder.equipment.setEquipment('Offhand', f.inv.getItem(0));
 f.inv.setItem(1, seasoning(f, 8)); seedFilter(f, b, 0, f.inv.getItem(1));
 command(f); f.flush(); assert.equal(b.inventory.getItem(0).amount, 8); assert.equal(f.inv.getItem(1), undefined);
 assert.equal(f.inv.getItem(0).typeId, 'minecraft:totem_of_undying'); assert.equal(f.sounds.length, 1);
 f.inv.setItem(1, seasoning(f, 9)); command(f);
 const changed = f.inv.getItem(0); changed.setCanDestroy(['minecraft:obsidian']); f.inv.setItem(0, changed); f.flush();
 assert.equal(b.inventory.getItem(0).amount, 8); assert.equal(f.inv.getItem(1).amount, 9); assert.equal(f.sounds.length, 1);
});

test('automation simulated borrow and return are read-only and real transfer preserves metadata', async () => {
 const f = await fixture(), b = f.rack(), held = tool(f); b.inventory.setItem(5, held); const before = snapshot(f);
 const simulated = f.automation.borrowAdvancedRackItem(f.dimension, b.location, s => s.typeId === held.typeId, true);
 assert.equal(simulated.success, true); same(simulated.stack, held); same(simulated.receipt, receipt(f, b, 5));
 same(snapshot(f), before);
 const borrowed = f.automation.borrowAdvancedRackItem(f.dimension, b.location, s => s.typeId === held.typeId);
 assert.equal(borrowed.success, true); assert.equal(b.inventory.getItem(5), undefined);
 const empty = snapshot(f);
 assert.equal(f.automation.returnAdvancedRackItem(f.dimension, borrowed.receipt, borrowed.stack, true).success, true);
 same(snapshot(f), empty);
 same(f.automation.returnAdvancedRackItem(f.dimension, borrowed.receipt, borrowed.stack), {success: true, remainder: undefined});
 same(b.inventory.getItem(5), held);
});

test('automation filter or source rejection reports no transfer and preserves original native stack', async () => {
 const f = await fixture(), b = f.rack(), returned = seasoning(f, 8), before = snapshot(f);
 failWrite(f, f.world, 'setDynamicProperty', f.state.rackFiltersKey(b));
 same(f.automation.returnAdvancedRackItem(f.dimension, receipt(f, b), returned), {success: false, remainder: returned});
 same(snapshot(f), before);
 b.inventory.setItem(0, returned); failWrite(f, b.inventory, 'setItem', 0);
 const result = f.automation.borrowAdvancedRackItem(f.dimension, b.location);
 assert.equal(result.success, false); assert.equal(result.stack, undefined); assert.equal(result.receipt, undefined);
 same(b.inventory.getItem(0), returned);
});

test('automation honors predicate, dimension, category, full-slot capacity and fallback slot', async () => {
 const f = await fixture(), b = f.rack(), held = seasoning(f, 8);
 b.inventory.setItem(0, seasoning(f, 60));
 for (let slot = 1; slot < 5; slot++) b.inventory.setItem(slot, seasoning(f, 64));
 const before = snapshot(f);
 assert.equal(f.automation.borrowAdvancedRackItem(f.dimension, b.location, () => false).success, false);
 same(f.automation.returnAdvancedRackItem(f.dimension, {...receipt(f, b), dimension: 'minecraft:nether'}, held), {success: false, remainder: held});
 same(f.automation.returnAdvancedRackItem(f.dimension, receipt(f, b), held), {success: false, remainder: held});
 same(snapshot(f), before);
 b.inventory.setItem(4, undefined);
 assert.equal(f.automation.returnAdvancedRackItem(f.dimension, receipt(f, b), held).success, true);
 same(b.inventory.getItem(4), held); assert.equal(b.inventory.getItem(0).amount, 60);
});

for (const kind of ['deposit', 'automation']) test(`${kind} incomplete rollback quarantines the rack instead of returning ambiguous ownership`, async () => {
 const f = await fixture(), b = f.rack(), item = seasoning(f, 8); f.inv.setItem(0, item);
 const nativeSet = b.inventory.setItem.bind(b.inventory);
 b.inventory.setItem = (slot, value) => {nativeSet(slot, value); throw new Error('Persistent post-write failure');};
 const action = kind === 'deposit' ? () => f.tx.depositInventorySlot(f.inv, 0, b, 0)
  : () => f.automation.returnAdvancedRackItem(f.dimension, receipt(f, b), item);
 assert.throws(action, /recovery required/);
 b.inventory.setItem = nativeSet;
 assert.ok(f.world.getDynamicProperty(f.state.rackFiltersKey(b) + '_transaction_fault'));
 assert.throws(() => f.state.rackContainer(b), /quarantined/);
 assert.throws(() => f.automation.borrowAdvancedRackItem(f.dimension, b.location), /recovery required/);
 same(f.inv.getItem(0), item);
});

test('foreign managed storage owner is rejected by the real storage adapter without item mutation', async () => {
 const f = await fixture(), b = f.rack(); f.inv.setItem(0, seasoning(f, 8));
 const key = f.storage.storageKey(b);
 f.world.setDynamicProperty(key, JSON.stringify({v: 1, key, block: core.ADVANCED_RACK_BLOCK_ID, entity: 'foreign-owner', token: 'foreign-token'}));
 const before = snapshot(f);
 assert.throws(() => f.tx.depositInventorySlot(f.inv, 0, b, 0), /both legacy native and managed inventory/);
 use(f, b, 0); same(snapshot(f), before); assert.equal(f.sounds.length, 0); assert.equal(activeDrops(f).length, 0);
});

test('explosion cancellation is checked both immediately and after deferral before any packed drop', async () => {
 for (const mode of ['valid', 'before', 'after', 'unreadable_before', 'unreadable_after']) {
  const f = await fixture(), b = f.rack(), held = tool(f, 'minecraft:flint_and_steel'); b.inventory.setItem(5, held); seedFilter(f, b, 5, held);
  let deferred = false, edits = 0, kept; const other = f.block('minecraft:stone', {x: 1, y: 64, z: 0});
  const event = {get cancel() {
   if (mode === 'unreadable_before' || (mode === 'unreadable_after' && deferred)) throw new Error('Event unreadable');
   return mode === 'before' || (mode === 'after' && deferred);
  }, getImpactedBlocks: () => [other, b], setImpactedBlocks(rows) {edits++; kept = rows;}};
  f.emit('world.beforeEvents.explosion', event); deferred = true; f.flush();
  assert.equal(edits, ['before', 'unreadable_before'].includes(mode) ? 0 : 1, mode);
  if (edits) {assert.equal(kept.length, 1); assert.equal(kept[0], other);}
  if (mode === 'valid') {
   assert.equal(b.typeId, 'minecraft:air'); assert.equal(b.inventory.getItem(5), undefined);
   assert.equal(activeDrops(f).length, 1);
   const packed = droppedStack(activeDrops(f)[0]); assert.equal(packed.typeId, core.ADVANCED_RACK_ITEM_ID);
   same(f.codec.readRackPayloadItem(packed).items[5], held);
   assert.equal(f.world.getDynamicProperty(f.state.rackFiltersKey(b)), undefined);
  } else {
   assert.equal(b.typeId, core.ADVANCED_RACK_BLOCK_ID); same(b.inventory.getItem(5), held);
   assert.equal(activeDrops(f).length, 0, mode); assert.ok(f.state.readRackFilters(b)[5]);
  }
 }
});

for (const change of ['type', 'owner', 'filter', 'facing']) test(`deferred explosion rejects a changed rack ${change}`, async () => {
 const f = await fixture(), b = f.rack(), item = seasoning(f, 7); b.inventory.setItem(0, item);
 f.emit('world.beforeEvents.explosion', {cancel: false, getImpactedBlocks: () => [b], setImpactedBlocks() {}});
 if (change === 'type') b.setType('minecraft:stone');
 if (change === 'owner') f.world.setDynamicProperty(f.storage.storageKey(b), 'replacement-owner');
 if (change === 'filter') f.world.setDynamicProperty(f.state.rackFiltersKey(b), '[]');
 if (change === 'facing') b.setPermutation(b.permutation.withState('minecraft:cardinal_direction', 'east'));
 f.flush(); same(b.inventory.getItem(0), item); assert.equal(activeDrops(f).length, 0);
 assert.equal(b.typeId, change === 'type' ? 'minecraft:stone' : core.ADVANCED_RACK_BLOCK_ID);
});

test('unreadable rack snapshot stays excluded from native explosion destruction without payout', async () => {
 const f = await fixture(), b = f.rack(); b.inventory.setItem(0, seasoning(f, 7));
 b.permutation.getAllStates = () => {throw new Error('Unreadable state');}; let kept;
 f.emit('world.beforeEvents.explosion', {cancel: false, getImpactedBlocks: () => [b], setImpactedBlocks(rows) {kept = rows;}}); f.flush();
 same(kept, []); assert.equal(b.typeId, core.ADVANCED_RACK_BLOCK_ID); assert.equal(b.inventory.getItem(0).amount, 7);
 assert.equal(activeDrops(f).length, 0);
});

test('break event ignores cancellation and replacement, then drops exactly one packed original rack', async () => {
 const f = await fixture(), b = f.rack(), item = tool(f, 'minecraft:flint_and_steel'); b.inventory.setItem(5, item);
 f.emit('world.beforeEvents.playerBreakBlock', {cancel: true, block: b, player: f.holder}); f.flush();
 assert.equal(b.typeId, core.ADVANCED_RACK_BLOCK_ID); assert.equal(activeDrops(f).length, 0);
 f.emit('world.beforeEvents.playerBreakBlock', {cancel: false, block: b, player: f.holder});
 seedFilter(f, b, 5, item); f.flush(); assert.equal(activeDrops(f).length, 0); same(b.inventory.getItem(5), item);
 const event = {cancel: false, block: b, player: f.holder};
 f.emit('world.beforeEvents.playerBreakBlock', event); f.flush();
 assert.equal(event.cancel, true); assert.equal(b.typeId, 'minecraft:air'); assert.equal(activeDrops(f).length, 1);
 same(f.codec.readRackPayloadItem(droppedStack(activeDrops(f)[0])).items[5], item);
});

for (const target of ['inventory', 'filter', 'block']) test(`failed packed break at ${target} restores native contents and removes escrow`, async () => {
 const f = await fixture(), b = f.rack(), held = tool(f, 'minecraft:flint_and_steel'); b.inventory.setItem(5, held); seedFilter(f, b, 5, held);
 const before = snapshot(f);
 if (target === 'inventory') failWrite(f, b.inventory, 'setItem', 5);
 if (target === 'filter') failWrite(f, f.world, 'setDynamicProperty', f.state.rackFiltersKey(b));
 if (target === 'block') failWrite(f, b, 'setType', 'minecraft:air');
 f.emit('world.beforeEvents.playerBreakBlock', {cancel: false, block: b, player: f.holder}); f.flush();
 assert.equal(b.typeId, core.ADVANCED_RACK_BLOCK_ID); same(snapshot(f), before); assert.equal(activeDrops(f).length, 0);
});

test('display rebuild projects all occupancy masks without changing native items, filters or facing', async () => {
 for (let mask = 0; mask < 32; mask++) {
  const f = await fixture(), b = f.rack();
  for (let slot = 0; slot < 9; slot++) if (slot >= 5 || (mask & (1 << slot))) b.inventory.setItem(slot, slot < 5 ? seasoning(f, slot + 2) : tool(f));
  seedFilter(f, b, 0, seasoning(f)); const before = snapshot(f);
  const level = Math.min(4, [0, 1, 2, 3, 4].filter(slot => mask & (1 << slot)).length);
  let writes = 0; const setPermutation = b.setPermutation.bind(b); b.setPermutation = p => {writes++; setPermutation(p);};
  assert.equal(f.state.syncRackDisplay(b), level);
  assert.equal(b.permutation.getState(layout.RACK_OCCUPANCY_STATE), mask & 15);
  assert.equal(b.permutation.getState(layout.RACK_OCCUPANCY_HIGH_STATE), mask >> 4);
  assert.equal(b.permutation.getState('kaleidoscope_grilling:spice_level'), level);
  assert.equal(b.permutation.getState('minecraft:cardinal_direction'), 'north');
  const permutation = b.permutation; assert.equal(writes, mask === 0 ? 0 : 1);
  f.state.syncRackDisplay(b); assert.equal(b.permutation, permutation); assert.equal(writes, mask === 0 ? 0 : 1);
  same(snapshot(f), before);
 }
});

test('known display snapshot does not reread inventory and detects high-bit-only changes', async () => {
 const f = await fixture(), b = f.rack();
 b.inventory.getItem = () => {throw new Error('Known snapshot must not reread storage');};
 for (const mask of [15, 31, 16, 0]) {
  const items = Array.from({length: 9}, (_, slot) => mask & (1 << slot) ? seasoning(f, slot + 2) : undefined), before = items.map(s => s?.clone());
  f.state.syncRackDisplay(b, items);
  assert.equal(b.permutation.getState(layout.RACK_OCCUPANCY_STATE), mask & 15);
  assert.equal(b.permutation.getState(layout.RACK_OCCUPANCY_HIGH_STATE), mask >> 4);
  same(items, before);
 }
});

for (const phase of ['before', 'after']) test(`display ${phase}-write failure preserves contents and permits derived-state retry`, async () => {
 const f = await fixture(), b = f.rack(); b.inventory.setItem(4, seasoning(f, 6)); seedFilter(f, b, 4, seasoning(f));
 const before = snapshot(f); f.faults.failNext(b, 'setPermutation', {phase});
 assert.equal(f.state.syncRackDisplay(b), 1); same(snapshot(f), before);
 assert.equal(b.permutation.getState(layout.RACK_OCCUPANCY_HIGH_STATE), phase === 'before' ? 0 : 1);
 f.state.syncRackDisplay(b); assert.equal(b.permutation.getState(layout.RACK_OCCUPANCY_HIGH_STATE), 1); same(snapshot(f), before);
});

test('negative-Y and same-event ray snapshots keep the selected row despite misleading native hit or later aim', async () => {
 for (const slot of [2, 7]) {
  const f = await fixture(), b = f.rack(320, -59, 319); f.holder.location = {x: 320.5, y: -60, z: 317};
  const held = slot < 5 ? seasoning(f) : tool(f); f.inv.setItem(0, held);
  click(f, b, slot, {blockFace: 'North', faceLocation: {x: .5001525879, y: slot < 5 ? .3255882263 : .6744117737, z: .0625}});
  f.holder.eye = {x: 99, y: 99, z: 99}; f.holder.view = {x: 0, y: -1, z: 0}; f.flush();
  same(b.inventory.getItem(slot), held); assert.equal(f.inv.getItem(0), undefined);
  assert.equal(contents(b.inventory).filter(Boolean).length, 1);
 }
});

test('direct touch follows the tapped lower row while crosshair points to the upper row', async () => {
 const f = await fixture(), b = f.rack(320, -59, 319); f.holder.location = {x: 320.5, y: -60, z: 317};
 f.holder.inputInfo = {lastInputModeUsed: 'Touch', touchOnlyAffectsHotbar: false}; const held = tool(f); f.inv.setItem(0, held);
 use(f, b, 2, {blockFace: 'North', faceLocation: {x: .5, y: .6, z: .0625}});
 same(b.inventory.getItem(7), held); assert.equal(b.inventory.getItem(2), undefined); assert.equal(f.inv.getItem(0), undefined);
});

test('missing crosshair ray and actual backing-block events never access rack storage', async () => {
 for (const backing of [false, true]) {
  const f = await fixture(), b = f.rack(); f.inv.setItem(0, seasoning(f)); const before = contents(b.inventory), held = f.inv.getItem(0);
  let reads = 0; const nativeGet = b.inventory.getItem.bind(b.inventory);
  b.inventory.getItem = () => {reads++; throw new Error('Must not access rack storage');};
  f.holder.getHeadLocation = () => undefined; f.holder.getViewDirection = () => undefined;
  const target = backing ? f.block('minecraft:stone', {x: 0, y: 64, z: 1}) : b;
  f.emit('world.beforeEvents.playerInteractWithBlock', {player: f.holder, block: target, isFirstEvent: true, blockFace: 'North', faceLocation: {x: .5, y: .72, z: .0625}, itemStack: held}); f.flush();
  assert.equal(reads, 0); b.inventory.getItem = nativeGet; same(contents(b.inventory), before); same(f.inv.getItem(0), held);
 }
});

test('oblique pickup returns each supported original tool and leaves neighboring slots intact', async () => {
 const ids = ['iron_kitchen_knife', 'gold_kitchen_knife', 'diamond_kitchen_knife', 'netherite_kitchen_knife', 'kitchen_shovel']
  .map(id => 'kaleidoscope_cookery:' + id).concat('minecraft:flint_and_steel');
 for (const facing of ['north', 'east', 'south', 'west']) for (let slot = 5; slot < 9; slot++) {
  const f = await fixture(), b = f.rack(); b.setPermutation(b.permutation.withState('minecraft:cardinal_direction', facing));
  for (let i = 0; i < 9; i++) if (i !== slot) b.inventory.setItem(i, i < 5 ? seasoning(f, 3) : tool(f));
  const neighbors = contents(b.inventory);
  for (const [index, id] of ids.entries()) {
   const held = tool(f, id); held.nameTag = 'Exact ' + id; held.setLore(['Original ' + id, 'Slot ' + slot]);
   f.inv.setItem(0, held); const oblique = index % 2 ? 2 : -2;
   use(f, b, slot, {oblique}); same(b.inventory.getItem(slot), held); assert.equal(f.inv.getItem(0), undefined);
   use(f, b, slot, {oblique}); same(f.inv.getItem(0), held); same(contents(b.inventory), neighbors);
   // Each next tool exercises an empty slot, rather than the previous exact filter.
   f.inv.setItem(0, undefined); f.holder.isSneaking = true; use(f, b, slot, {oblique}); f.holder.isSneaking = false;
  }
 }
});


test('canonical seasoning bottle has one-item capacity and its family filter survives pickup', async () => {
 const f = await fixture(), b = f.rack(), bottle = stack(f, 'kaleidoscope_grilling:empty_seasoning_bottle');
 assert.equal(bottle.maxAmount, 1);
 f.inv.setItem(0, bottle); assert.equal(f.tx.depositInventorySlot(f.inv, 0, b, 0), 1);
 f.inv.setItem(0, bottle); const full = snapshot(f);
 assert.equal(f.tx.depositInventorySlot(f.inv, 0, b, 0), 0); same(snapshot(f), full);
 f.inv.setItem(0, undefined); use(f, b, 0); same(f.inv.getItem(0), bottle);
 assert.equal(f.state.readRackFilters(b)[0].category, 'seasoning_bottle');
 assert.equal(b.inventory.getItem(0), undefined);
});

test('failed filter creation restores the exact preexisting property, including formatting', async () => {
 const f = await fixture(), b = f.rack(), key = f.state.rackFiltersKey(b);
 const raw = '[ null,  null ]'; f.world.setDynamicProperty(key, raw); f.inv.setItem(0, seasoning(f, 8));
 const before = snapshot(f); failWrite(f, b.inventory, 'setItem', 0);
 assert.equal(f.tx.depositInventorySlot(f.inv, 0, b, 0), 0);
 assert.equal(f.world.getDynamicProperty(key), raw); same(snapshot(f), before);
});

test('managed rack backing inventory refuses a foreign owner token without resetting existing contents', async () => {
 const f = await fixture(), b = f.rack(0, 64, 0, {inventorySize: 0});
 const c = f.state.rackContainer(b), held = seasoning(f, 7); c.setItem(0, held);
 const record = JSON.parse(f.world.getDynamicProperty(f.storage.storageKey(b)));
 const entity = f.world.getEntity(record.entity), owner = JSON.parse(entity.getDynamicProperty(f.storage.STORAGE_OWNER));
 entity.setDynamicProperty(f.storage.STORAGE_OWNER, JSON.stringify({...owner, token: 'foreign-token'}));
 f.inv.setItem(0, seasoning(f, 8));
 const before = {world: properties(f.world), inventory: contents(f.inv), backing: contents(c)};
 assert.throws(() => f.tx.depositInventorySlot(f.inv, 0, b, 0), /inventory owner mismatch/);
 assert.throws(() => f.automation.borrowAdvancedRackItem(f.dimension, b.location), /inventory owner mismatch/);
 use(f, b, 0);
 same({world: properties(f.world), inventory: contents(f.inv), backing: contents(c)}, before);
 assert.equal(entity.isValid, true); assert.equal(activeDrops(f).length, 0); assert.equal(f.sounds.length, 0);
});

test('automation borrows exactly one original from a tagged stack and returns it to its receipt', async () => {
 const f = await fixture(), b = f.rack(), item = seasoning(f, 8); b.inventory.setItem(2, item);
 const borrowed = f.automation.borrowAdvancedRackItem(f.dimension, b.location, s => s.typeId === item.typeId);
 assert.equal(borrowed.success, true); assert.equal(borrowed.stack.amount, 1);
 same(borrowed.receipt, receipt(f, b, 2)); assert.equal(b.inventory.getItem(2).amount, 7);
 assert.equal(f.automation.returnAdvancedRackItem(f.dimension, borrowed.receipt, borrowed.stack).success, true);
 same(b.inventory.getItem(2), item);
});

test('opt-in rack diagnostics report admission and result without leaking identity or item metadata', async () => {
 for (const enabled of [false, true]) {
  const f = await fixture(), b = f.rack(); if (enabled) f.holder.addTag('kg_rack_qa');
  f.holder.name = 'PRIVATE_PLAYER'; f.inv.setItem(0, seasoning(f)); use(f, b, 2, {blockFace: 'North'});
  assert.equal(b.inventory.getItem(2).amount, 1);
  const lines = f.logs.map(row => row.text).filter(line => line.startsWith('[Grilling rack QA] '));
  if (!enabled) {assert.equal(lines.length, 0); continue;}
  const rows = lines.map(line => JSON.parse(line.slice('[Grilling rack QA] '.length)));
  same(rows.map(row => row.stage), ['target', 'resolved', 'admission', 'result']);
  assert.equal(rows[1].slot, 2); assert.equal(rows[1].row, 'seasoning');
  assert.equal(rows[2].canPlace, true); assert.equal(rows[3].action, 'insert');
  assert.doesNotMatch(lines.join(''), /PRIVATE_|Original lore|original metadata|location|dimension/);
 }
});

test('opt-in rack diagnostics distinguish invalid hit and stale intent without permitting transfer', async () => {
 for (const reason of ['hit', 'intent']) {
  const f = await fixture(), b = f.rack(); f.holder.addTag('kg_rack_qa'); f.inv.setItem(0, seasoning(f));
  if (reason === 'hit') {
   f.holder.getHeadLocation = () => ({x: .5, y: 64.95, z: -2});
   f.holder.getViewDirection = () => ({x: 0, y: 0, z: 1});
   f.holder.inputInfo = {lastInputModeUsed: 'KeyboardAndMouse'};
   f.emit('world.beforeEvents.playerInteractWithBlock', {player: f.holder, block: b, isFirstEvent: true,
    blockFace: 'North', faceLocation: {x: .5, y: .95, z: .0625}, itemStack: f.inv.getItem(0)});
  } else {click(f, b, 2); f.inv.setItem(0, seasoning(f, 2));}
  f.flush(); assert.equal(contents(b.inventory).filter(Boolean).length, 0);
  assert.ok(f.logs.some(row => row.text.includes(reason === 'hit' ? 'missing_or_missed_ray' : 'intent_changed')));
 }
});

test('opt-in negative-Y diagnostics preserve raw event and relative ray coordinates without absolute location', async () => {
 const f = await fixture(), b = f.rack(320, -59, 319);
 f.holder.location = {x: 320.5, y: -60, z: 317}; f.holder.addTag('kg_rack_qa'); f.inv.setItem(0, seasoning(f));
 use(f, b, 2, {blockFace: 'North', faceLocation: {x: .5001525879, y: .3255882263, z: .0625}});
 const lines = f.logs.map(row => row.text).filter(line => line.startsWith('[Grilling rack QA] '));
 const rows = lines.map(line => JSON.parse(line.slice('[Grilling rack QA] '.length))), resolved = rows.find(row => row.stage === 'resolved');
 assert.equal(rows[0].hit.y, .3255882263); assert.equal(resolved.source, 'eye_ray'); assert.equal(resolved.mode, 'KeyboardAndMouse');
 assert.equal(resolved.headRelative.y, .75); assert.equal(resolved.used.y, .75); assert.equal(resolved.slot, 2);
 assert.doesNotMatch(lines.join(''), /320|319|"y":-59|PRIVATE_|Original lore|original metadata|location|dimension/);
});


test('persistent exact filters reject different tagged items while native bottle filters accept their family', async () => {
 const f = await fixture(), b = f.rack(), first = seasoning(f, 3);
 f.inv.setItem(0, first); use(f, b, 0); use(f, b, 0);
 const other = stack(f, 'custom:other_seasoning', 2, [SEASONING_TAG]); f.inv.setItem(0, other);
 const before = snapshot(f); use(f, b, 0); same(snapshot(f), before);
 f.inv.setItem(0, undefined); f.holder.isSneaking = true; use(f, b, 0); f.holder.isSneaking = false;
 f.inv.setItem(0, other); use(f, b, 0); same(b.inventory.getItem(0), other);
 const bottle = stack(f, 'kaleidoscope_grilling:empty_seasoning_bottle');
 f.inv.setItem(0, bottle); use(f, b, 1); use(f, b, 1);
 const pending = stack(f, 'kaleidoscope_grilling:pending_seasoning'); f.inv.setItem(0, pending);
 use(f, b, 1); same(b.inventory.getItem(1), pending); assert.equal(f.inv.getItem(0), undefined);
 assert.equal(f.state.readRackFilters(b)[1].category, 'seasoning_bottle');
});
}

// Native boundary validation, including canonical rack occupancy domains.
{

const N = 'kaleidoscope_grilling:';

test('owned rack permutations enforce canonical state names, types, values and defaults', () => {
  const f = createFixture(), rack = f.BlockPermutation.resolve(N + 'advanced_rack_block');
  assert.deepEqual(rack.getAllStates(), {
    [N + 'spice_level']: 0,
    [N + 'seasoning_occupancy']: 0,
    [N + 'seasoning_occupancy_high']: 0,
    'minecraft:cardinal_direction': 'north',
  });
  for (const value of [-1, 16, 1.5, '1', true]) {
    assert.throws(() => rack.withState(N + 'seasoning_occupancy', value), /Invalid state/);
  }
  assert.throws(() => rack.withState(N + 'seasoning_occupancy_high', 2), /Invalid state/);
  assert.throws(() => rack.withState(N + 'occupancy_typo', 0), /Unknown state/);
  assert.throws(() => rack.withState('minecraft:cardinal_direction', 'up'), /Invalid state/);
  assert.equal(rack.withState(N + 'seasoning_occupancy', 15).getState(N + 'seasoning_occupancy'), 15);
  assert.equal(rack.getState(N + 'seasoning_occupancy'), 0, 'permutation changes are immutable');
});

test('each owned block has its own state schema; external schemas are explicit boundaries', () => {
  const f = createFixture();
  const vat = f.BlockPermutation.resolve(N + 'big_vat');
  assert.deepEqual(vat.getAllStates(), {[N + 'vat_level']: 0, [N + 'vat_fluid']: 'empty'});
  assert.throws(() => vat.withState(N + 'cake_count', 0), /Unknown state/);
  assert.throws(() => vat.withState(N + 'vat_fluid', 'unknown_oil'), /Invalid state/);
  assert.throws(() => f.BlockPermutation.resolve(N + 'oil_press', {[N + 'cake_count']: 5}), /Invalid state/);
  assert.equal(f.BlockPermutation.resolve('minecraft:oak_stairs', {weirdo_direction: 2}).getState('weirdo_direction'), 2);
  assert.throws(() => f.BlockPermutation.resolve('minecraft:oak_stairs', {'minecraft:cardinal_direction': 'up'}), /Invalid state/);
});

test('fixture imports share one native graph while separate fixtures isolate state and subscribers', async () => {
  const a = createFixture(), b = createFixture();
  const [first, other] = await Promise.all([a.load('plate/plate_recipe_runtime.js'), b.load('plate/plate_recipe_runtime.js')]);
  assert.equal(await a.load('plate/plate_recipe_runtime.js'), first);
  assert.notEqual(first, other);
  assert.equal(a.subscribers.get('world.beforeEvents.playerInteractWithBlock').length, 1);
  assert.equal(b.subscribers.get('world.beforeEvents.playerInteractWithBlock').length, 1);
  const left = await a.load('itemData.js'), right = await b.load('itemData.js');
  const stack = a.item(N + 'grilled_beef_skewer');
  left.setItemProperty(stack, 'test:identity', 'left world');
  assert.equal(left.getItemProperty(stack.clone(), 'test:identity'), 'left world');
  assert.throws(() => right.getItemProperty(stack, 'test:identity'), /Missing Grilling item metadata/);
});

test('native inventory copies preserve item metadata and faults distinguish rejected from applied writes', () => {
  const f = createFixture();
  const original = f.item('minecraft:diamond_sword', 1, {
    nameTag: 'Original', rawLore: [{translate: 'foreign.label', with: ['kept']}],
    keepOnDeath: true, lockMode: 'inventory', canDestroy: ['minecraft:stone'],
    canPlaceOn: ['minecraft:dirt'], damage: 19,
    enchantments: [{id: 'unbreaking', level: 2}],
    dynamicProperties: {'foreign:vector': {x: 1, y: 2, z: 3}},
  });
  const inventory = f.container(1); inventory.setItem(0, original);
  assert.deepEqual(inventory.getItem(0), original);
  const read = inventory.getItem(0); read.nameTag = 'Detached copy';
  assert.equal(inventory.getItem(0).nameTag, 'Original');
  f.faults.failNext(inventory, 'setItem');
  assert.throws(() => inventory.setItem(0, undefined), /before-write/);
  assert.deepEqual(inventory.getItem(0), original);
  f.faults.failNext(inventory, 'setItem', {phase: 'after'});
  assert.throws(() => inventory.setItem(0, undefined), /after-write/);
  assert.equal(inventory.getItem(0), undefined);
});

test('registered startup callbacks and scheduler run in deterministic tick order', async () => {
  const f = createFixture();
  await f.load('rack/advanced_rack_runtime.js');
  f.startup();
  assert.equal(typeof f.commands.get(N + 'rack').callback, 'function');
  const called = [];
  const repeat = f.system.runInterval(() => called.push(`interval:${f.system.currentTick}`), 2);
  f.system.run(() => {called.push('first'); f.system.run(() => called.push('nested'));});
  f.system.runTimeout(() => called.push('timeout'), 2);
  f.flush(); assert.deepEqual(called, ['first']);
  f.flush(); assert.deepEqual(called, ['first', 'interval:2', 'timeout', 'nested']);
  f.system.clearRun(repeat); f.tick(2);
  assert.equal(called.length, 4);
});

test('reloading persisted properties creates a fresh graph without losing portable item metadata', async () => {
  const before = createFixture(), itemData = await before.load('itemData.js');
  const stack = before.item(N + 'grilled_beef_skewer');
  itemData.setItemProperty(stack, 'test:persisted', true);
  const after = createFixture({dynamicProperties: before.snapshotProperties()});
  const reloaded = await after.load('itemData.js');
  assert.notEqual(reloaded, itemData);
  assert.equal(reloaded.getItemProperty(stack, 'test:persisted'), true);
});

test('native effects expire on deterministic ticks and accept short or namespaced identities', () => {
  const f = createFixture(), player = f.player();
  player.addEffect('speed', 4, {amplifier: 1});
  assert.deepEqual(player.getEffect('minecraft:speed'), {typeId: 'minecraft:speed', duration: 4, amplifier: 1});
  f.tick(3);
  assert.equal(player.getEffect('speed').duration, 1);
  f.tick(); assert.deepEqual(player.getEffects(), []);
  player.addEffect('poison', 10);
  assert.equal(player.removeEffect('minecraft:poison'), true);
  assert.equal(player.getEffect('poison'), undefined);
});
}
