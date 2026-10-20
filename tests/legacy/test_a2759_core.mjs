import assert from 'node:assert/strict';
import {
 PEPPER_LEAVES_ID,PEPPER_WORLDGEN_FRUITING_BRIDGE_ID,
 PEPPER_WORLDGEN_NORMAL_WEIGHT,PEPPER_WORLDGEN_FRUITING_WEIGHT,
 worldgenFruitingProbability,worldgenLeafWeights
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2759_pepper_worldgen_fruiting_core.js';

assert.equal(PEPPER_WORLDGEN_NORMAL_WEIGHT,3);
assert.equal(PEPPER_WORLDGEN_FRUITING_WEIGHT,1);
assert.equal(worldgenFruitingProbability(),0.25);
assert.deepEqual(worldgenLeafWeights(),[
 [PEPPER_LEAVES_ID,3],
 [PEPPER_WORLDGEN_FRUITING_BRIDGE_ID,1]
]);
console.log('A2.7.59 Pepper worldgen fruiting contract: PASS');
