import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';

// The override is for an isolated source checkout, never for production packs.
const scripts = process.env.KG_CODEC_SCRIPTS
  ? pathToFileURL(process.env.KG_CODEC_SCRIPTS.replace(/[\\/]$/, '') + '/')
  : new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/', import.meta.url);
const {captureSkewerMetadata, restoreSkewerMetadata, metadataSignature, ingredientContentSignature} =
  await import(new URL('skewer_item_snapshot.js', scripts));
const {configureItemDataWorld} = await import(new URL('core/persist.js', scripts));
const {bottleLoreSignature, isOwnedBottleLore} = await import(new URL('bottle_lore_core.js', scripts));
const copy = value => JSON.parse(JSON.stringify(value));
const INGREDIENTS = 'kaleidoscope_grilling:seasonings';
const lines = [
  {translate: 'tooltip.kaleidoscope_grilling.seasoning.ingredients', with: ['3', '8']},
  {translate: 'tooltip.kaleidoscope_grilling.seasoning.ready'},
  {text: '§aCustom bottle'}
];
function wrapped(line) {
  const node = typeof line === 'string' ? {text: line} : copy(line);
  if (Array.isArray(node.with)) node.with = {rawtext: node.with.map(text => ({text}))};
  return {rawtext: [node]};
}
function snapshot(rawLore = lines) {
  return {version: 1, id: 'kaleidoscope_grilling:pending_seasoning_f3',
    name: 'My bottle', rawLore: copy(rawLore), props: {
      [INGREDIENTS]: JSON.stringify(['kaleidoscope_grilling:green_chili_powder',
        'kaleidoscope_grilling:sichuan_pepper', 'kaleidoscope_grilling:onion_powder']),
      'kaleidoscope_grilling:uses': 0, 'example:flag': true,
      'example:position': {x: 1, y: 2, z: 3}
    }, keepOnDeath: true, lockMode: 'inventory', canDestroy: ['minecraft:stone'],
    canPlaceOn: ['minecraft:dirt']};
}

// Deliberately models more than one legal RawMessage readback representation.
// This is a codec unit double, not evidence of a Minecraft client/server run.
class Stack {
  constructor(id, amount = 1, maxAmount = 1, readback = rows => rows.map(wrapped)) {
    this.typeId = id; this.amount = amount; this.maxAmount = maxAmount;
    this.nameTag = undefined; this.keepOnDeath = false; this.lockMode = 'none';
    this.lore = []; this.props = {}; this.destroy = []; this.place = [];
    this.readback = readback;
    this.durability = {damage: 0}; this.enchantments = [];
  }
  getRawLore() { return copy(this.lore); }
  setLore(rows) { this.lore = this.readback(copy(rows)); }
  getDynamicPropertyIds() { return Object.keys(this.props); }
  getDynamicProperty(key) { return this.props[key]; }
  setDynamicProperty(key, value) {
    assert.equal(this.maxAmount, 1, 'stackable metadata must use world records');
    if (value === undefined) delete this.props[key]; else this.props[key] = copy(value);
  }
  getCanDestroy() { return [...this.destroy]; }
  setCanDestroy(value) { this.destroy = [...value]; }
  getCanPlaceOn() { return [...this.place]; }
  setCanPlaceOn(value) { this.place = [...value]; }
  getComponent(id) {
    if (id === 'minecraft:durability') return this.durability;
    if (id === 'minecraft:enchantable') return {
      getEnchantments: () => this.enchantments,
      removeAllEnchantments: () => { this.enchantments = []; },
      addEnchantments: values => { this.enchantments.push(...values); }
    };
    return undefined;
  }
}
const restore = (data, options = {}) => restoreSkewerMetadata(data,
  (id, amount) => new Stack(id, amount, options.maxAmount ?? 1, options.readback),
  id => ({id}));

for (const [name, a, b] of [
  ['literal strings and text nodes', ['§aBottle'], [{text: '§aBottle'}]],
  ['single-node rawtext wrappers', lines, lines.map(wrapped)],
  ['literal translation arguments', [lines[0]], [{translate: lines[0].translate,
    with: {rawtext: [{text: '3'}, {rawtext: [{text: '8'}]}]}}]]
]) {
  test('snapshot comparison accepts ' + name, () => {
    assert.equal(metadataSignature(snapshot(a)), metadataSignature(snapshot(b)));
    assert.equal(bottleLoreSignature(a), bottleLoreSignature(b));
  });
}

test('retyped pending bottle survives equivalent engine readback without losing data', () => {
  const before = snapshot(), saved = copy(before);
  before.damage = 2; before.enchantments = [{id: 'unbreaking', level: 1}];
  const expected = copy(before), out = restore(before);
  assert.equal(metadataSignature(captureSkewerMetadata(out)), metadataSignature(expected));
  assert.deepEqual(before, expected, 'comparison must not rewrite persisted snapshots');
  assert.deepEqual(out.props, saved.props);
  assert.equal(out.nameTag, 'My bottle');
  assert.equal(out.typeId, before.id);
  assert.equal(out.amount, 1);
  assert.equal(out.durability.damage, 2);
  assert.equal(out.enchantments[0].level, 1);
  assert.notDeepEqual(out.getRawLore(), before.rawLore, 'fixture really changes representation');
});

test('legacy literal lore restores through documented string-to-RawMessage readback', () => {
  const before = snapshot(['§aLegacy bottle']);
  const out = restore(before, {readback: rows => rows.map(x => typeof x === 'string' ? {text: x} : x)});
  assert.equal(metadataSignature(captureSkewerMetadata(out)), metadataSignature(before));
});

test('stackable metadata token survives equivalent RawMessage wrapping', () => {
  const records = new Map();
  configureItemDataWorld({getDynamicProperty: key => records.get(key),
    setDynamicProperty: (key, value) => records.set(key, value)});
  const before = snapshot(), out = restore(before, {maxAmount: 64});
  assert.equal(metadataSignature(captureSkewerMetadata(out)), metadataSignature(before));
  assert.equal(out.getRawLore().length, before.rawLore.length + 1, 'one metadata token');
  assert.ok(records.size > 0);
});

test('native ingredient comparison ignores only equivalent lore representation', () => {
  const a = {id: 'minecraft:carrot', native: {version: 1, id: 'minecraft:carrot', rawLore: lines}};
  const b = copy(a); b.native.rawLore = lines.map(wrapped);
  assert.equal(ingredientContentSignature(a), ingredientContentSignature(b));
});

const differences = [
  ['translation key', [lines[0]], [{...lines[0], translate: 'example:different'}]],
  ['translation argument', [lines[0]], [{...lines[0], with: ['4', '8']}]],
  ['argument order', [lines[0]], [{...lines[0], with: ['8', '3']}]],
  ['line order', lines, [...lines].reverse()],
  ['line count', lines, lines.slice(0, 2)],
  ['formatting', [{text: '§aBottle'}], [{text: '§cBottle'}]],
  ['mixed messages', [{rawtext: [{text: 'a'}, {text: 'b'}]}], [{text: 'ab'}]],
  ['dynamic scores', [{score: {name: 'a', objective: 'b'}}], [{text: '0'}]],
  ['unknown fields', [{text: 'a', custom: true}], [{text: 'a'}]],
  ['dynamic translation arguments', [{translate: 'x', with: {rawtext: [{score: {name: 'a', objective: 'b'}}]}}], [{translate: 'x', with: ['0']}]],
  ['absent and empty argument lists', [{translate: 'x'}], [{translate: 'x', with: []}]]
];
for (const [name, a, b] of differences) {
  test('real lore changes remain fail-closed: ' + name, () => {
    assert.notEqual(metadataSignature(snapshot(a)), metadataSignature(snapshot(b)));
    assert.throws(() => restore(snapshot(a), {readback: () => copy(b)}), /metadata readback differs/);
  });
}

test('non-lore metadata is still compared exactly', () => {
  const original = snapshot();
  for (const change of [x => {x.id += '_other';}, x => {x.name += '!';},
    x => {x.props[INGREDIENTS] = '[]';}, x => {x.props['kaleidoscope_grilling:uses'] = 1;},
    x => {x.props['example:position'].x = 2;}, x => {x.keepOnDeath = false;},
    x => {x.lockMode = 'slot';}, x => {x.canDestroy = [];}, x => {x.canPlaceOn = [];}]) {
    const altered = copy(original); change(altered);
    assert.notEqual(metadataSignature(original), metadataSignature(altered));
  }
});

test('comparison does not normalize a nested custom property named rawLore', () => {
  assert.notEqual(metadataSignature({props: {rawLore: [{text: 'x'}]}}),
    metadataSignature({props: {rawLore: [{rawtext: [{text: 'x'}]}]}}));
});

test('failed lore write and changed type still abort restoration', () => {
  assert.throws(() => restore(snapshot(), {readback: () => []}), /metadata readback differs/);
  assert.throws(() => restoreSkewerMetadata(snapshot(),
    () => new Stack('minecraft:stone'), id => ({id})), /metadata readback differs/);
});

test('generic signatures retain previous stable ordering and array semantics', () => {
  assert.equal(metadataSignature({b: 2, a: 1}), '{"a":1,"b":2}');
  assert.notEqual(metadataSignature([1, 2]), metadataSignature([2, 1]));
  assert.equal(metadataSignature(null), 'null');
});

test('bottle lore ownership is unchanged and does not swallow custom messages', () => {
  assert.equal(isOwnedBottleLore(wrapped(lines[0])), true);
  assert.equal(isOwnedBottleLore({rawtext: [lines[0], {text: 'custom'}]}), false);
  assert.equal(isOwnedBottleLore({translate: 'example:custom', with: ['3', '8']}), false);
});

// Use identical lore on both sides: these failures must be caused by the
// unrelated metadata loss, not by the RawMessage bug under test.
test('restoration rejects dropped metadata even with unchanged lore', () => {
  for (const corrupt of [
    stack => { stack.setDynamicProperty = () => {}; },
    stack => { stack.setCanDestroy = () => {}; },
    stack => { stack.setCanPlaceOn = () => {}; },
    stack => { stack.getComponent = () => undefined; }
  ]) {
    const before = snapshot();
    before.damage = 2;
    before.enchantments = [{id: 'unbreaking', level: 1}];
    assert.throws(() => restoreSkewerMetadata(before, (id, amount) => {
      const stack = new Stack(id, amount, 1, rows => rows);
      corrupt(stack);
      return stack;
    }, id => ({id})), /metadata readback differs|ingredient durability unavailable/);
  }
});
