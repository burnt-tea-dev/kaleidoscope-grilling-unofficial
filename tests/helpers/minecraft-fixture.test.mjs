import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from './minecraft-fixture.mjs';

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
  const [first, other] = await Promise.all([a.load('a25_plate_recipe_runtime.js'), b.load('a25_plate_recipe_runtime.js')]);
  assert.equal(await a.load('a25_plate_recipe_runtime.js'), first);
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
  await f.load('a2746_advanced_rack_runtime.js');
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
