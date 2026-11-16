import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../helpers/minecraft-fixture.mjs';

// Java crop loot reaches Block.popResource, which respects doTileDrops.
// These scenarios execute the actual registered crop callbacks, not a copy
// of their logic. They do not model Java neighbor-update scheduling or BDS.
const CROPS = [
  {name: 'canola', output: 'canola_seeds', mature: 2},
  {name: 'onion', output: 'onion', mature: 2},
  {name: 'sweet_potato', output: 'sweet_potato', mature: 3},
  {name: 'houttuynia', output: 'houttuynia', mature: 2},
];
const AGE = 'kaleidoscope_grilling:age';

async function cropFixture(crop, {age, doTileDrops, ground}) {
  const f = createFixture();
  await f.load(crop.name === 'houttuynia'
    ? 'world/houttuynia_crop_runtime.js'
    : 'world/farmland_crop_host_runtime.js');
  f.startup();
  f.world.gameRules = {doTileDrops};
  // Public Dimension API boundary only. The crop/loot logic stays unchanged.
  f.dimension.getLightLevel = () => 15;
  f.dimension.setBlockType = (position, typeId) => f.dimension.getBlock(position).setType(typeId);
  f.crop = f.block(`kaleidoscope_grilling:${crop.name}_crop`, {x: 0, y: 64, z: 0}, {states: {[AGE]: age}});
  f.block(ground, {x: 0, y: 63, z: 0});
  f.randomTick = () => f.component(`kaleidoscope_grilling:${crop.name}_crop_logic`,
    'onRandomTick', {block: f.crop, dimension: f.dimension});
  return f;
}

for (const crop of CROPS) {
  for (const age of [0, 7]) {
    for (const doTileDrops of [false, true]) {
      test(`${crop.name} age ${age}: lost support respects doTileDrops=${doTileDrops}`, async () => {
        const f = await cropFixture(crop, {age, doTileDrops, ground: 'minecraft:stone'});
        const random = Math.random;
        try {
          Math.random = () => .99; // No optional mature bonus.
          f.randomTick();
          assert.equal(f.crop.typeId, 'minecraft:air', 'invalid crops are removed under either rule value');
          assert.deepEqual(f.drops.map(drop => [drop.stack.typeId, drop.stack.amount]),
            doTileDrops ? [[`kaleidoscope_grilling:${crop.output}`, age === 7 ? crop.mature : 1]] : []);
        } finally { Math.random = random; f.dispose(); }
      });
    }
  }

  for (const doTileDrops of [false, true]) {
    test(`${crop.name}: valid crops still grow with doTileDrops=${doTileDrops}`, async () => {
      const f = await cropFixture(crop, {age: 3, doTileDrops, ground: 'minecraft:farmland'});
      const random = Math.random;
      try {
        Math.random = () => 0;
        f.randomTick();
        assert.equal(f.crop.typeId, `kaleidoscope_grilling:${crop.name}_crop`);
        assert.equal(f.crop.permutation.getState(AGE), 4);
        assert.equal(f.drops.length, 0);
      } finally { Math.random = random; f.dispose(); }
    });
  }
}
