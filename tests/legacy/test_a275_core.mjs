import assert from 'node:assert/strict';
import {VANILLA_SHOVELS,COOKERY_EXTINGUISH_TOOLS,isExtinguishTool,isInitialBlockPress,nextDurability} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a275_grill_input_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('all six vanilla shovels extinguish',()=>{assert.equal(VANILLA_SHOVELS.length,6);for(const id of VANILLA_SHOVELS)assert.equal(isExtinguishTool(id),true)});
t('Cookery kitchen shovel extinguishes',()=>assert.equal(isExtinguishTool('kaleidoscope_cookery:kitchen_shovel'),true));
t('Bedrock Cookery oiled shovel alias extinguishes',()=>assert.equal(isExtinguishTool('kaleidoscope_cookery:oiled_kitchen_shovel'),true));
t('non-shovel does not extinguish',()=>assert.equal(isExtinguishTool('minecraft:diamond_pickaxe'),false));
t('initial interaction is dispatched',()=>assert.equal(isInitialBlockPress(true),true));
t('held repeat interaction is suppressed',()=>assert.equal(isInitialBlockPress(false),false));
t('undefined first-event stays backwards-compatible',()=>assert.equal(isInitialBlockPress(undefined),true));
t('durability increments by one',()=>assert.deepEqual(nextDurability(3,64,1,false),{broken:false,damage:4}));
t('durability breaks exactly at max',()=>assert.deepEqual(nextDurability(63,64,1,false),{broken:true,damage:64}));
t('unbreakable durability is untouched',()=>assert.deepEqual(nextDurability(63,64,1,true),{broken:false,damage:63}));
console.log('A2.7.5 grill input core: '+n+'/'+n);

// Native display regressions share the existing grill interaction suite.
import test from 'node:test';
import {createFixture} from '../helpers/minecraft-fixture.mjs';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const cases = [
  {direction: 'north', yaw: -180, tail: [0, -1], left: [-1, 0]},
  {direction: 'east', yaw: -90, tail: [1, 0], left: [0, -1]},
  {direction: 'south', yaw: 0, tail: [0, 1], left: [1, 0]},
  {direction: 'west', yaw: 90, tail: [-1, 0], left: [0, 1]},
];
for (const {direction, yaw, tail, left} of cases) {
  test(`grill tails face the placer on ${direction}, including birth, flips and respawn`, async () => {
    const f = createFixture();
    const runtime = await f.load('grill_visual_runtime.js');
    const storage = await f.load('family_station_storage.js');
    const adapter = await f.load('a2740_grill_state_adapter.js');
    const {initialState} = await f.load('core_logic.js');
    const block = f.block('kaleidoscope_grilling:grill', {x: 10, y: 80, z: 7}, {
      states: {'minecraft:cardinal_direction': direction},
    });
    const inventory = storage.stationContainer(block);
    for (let slot = 0; slot < 3; slot++) inventory.setItem(slot, new f.ItemStack(
      slot === 2 ? 'kaleidoscope_grilling:secret_skewer' : 'kaleidoscope_grilling:raw_fish_skewer', 1));
    // Observe native IO only. All production dependencies execute through the
    // ordinary ESM fixture graph; no source extraction or domain replacement.
    const spawns = [];
    const spawn = f.dimension.spawnEntity.bind(f.dimension);
    f.dimension.spawnEntity = (type, location, options) => {
      const entity = spawn(type, location, options);
      if (type === 'kaleidoscope_grilling:grill_food_visual') {
        const row = {entity, initialYaw: options?.initialRotation, poses: []};
        const teleport = entity.teleport.bind(entity);
        entity.teleport = (position, settings) => {
          row.poses.push({position: {...position}, rotation: {...settings.rotation}});
          return teleport(position, settings);
        };
        spawns.push(row);
      }
      return entity;
    };
    const viewers = [{dimensionId: f.dimension.id, ...block.location}];
    const check = (rows, flips) => {
      assert.equal(rows.length, 3);
      for (let slot = 0; slot < 3; slot++) {
        const row = rows[slot], pose = row.poses.at(-1);
        close(Math.sin((row.initialYaw - yaw) * Math.PI / 180), 0);
        close(Math.cos((row.initialYaw - yaw) * Math.PI / 180), 1);
        assert.equal(pose.rotation.y, row.initialYaw, 'updates must not turn the helper');
        // The exposed local -Z handle follows entity front. Compare its world
        // direction with the Java grill-facing vector, not a source expression.
        close(-Math.sin(pose.rotation.y * Math.PI / 180), tail[0]);
        close(Math.cos(pose.rotation.y * Math.PI / 180), tail[1]);
        const offset = (1 - slot) * 5 / 16;
        close(pose.position.x, 10.5 + left[0] * offset);
        close(pose.position.y, 80 + 5 / 16);
        close(pose.position.z, 7.5 + left[1] * offset);
        assert.equal(row.entity.getProperty('kaleidoscope_grilling:flips'), flips);
        assert.equal(row.entity.getProperty('kaleidoscope_grilling:ready'), true);
      }
    };
    runtime.syncGrillDisplay(block, viewers);
    check(spawns, 0);
    for (const [phase, flips] of [[1, 1], [1, 3], [2, 4]]) {
      f.world.setDynamicProperty(adapter.grillStateKey(block), JSON.stringify({...initialState(), lit: true, phase, flips}));
      runtime.syncGrillDisplay(block, viewers);
      check(spawns, flips);
    }
    assert.deepEqual(spawns.map(row => row.poses.length), [4, 4, 4]);
    runtime.syncGrillDisplay(block, []);
    assert.ok(spawns.every(row => !row.entity.isValid));
    runtime.syncGrillDisplay(block, viewers);
    assert.equal(spawns.length, 6);
    check(spawns.slice(3), 4);
    for (let slot = 0; slot < 3; slot++) assert.equal(inventory.getItem(slot).amount, 1);
  });
}
