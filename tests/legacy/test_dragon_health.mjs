import test from 'node:test';import assert from 'node:assert/strict';
import {dragonHealthGain} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/dragon_health_core.js';
test('Java first application heals six or ten; refresh heals zero; upgrade adds four',()=>{
 assert.equal(dragonHealthGain(undefined,0),6);assert.equal(dragonHealthGain(undefined,1),10);
 assert.equal(dragonHealthGain(0,0),0);assert.equal(dragonHealthGain(0,1),4);assert.equal(dragonHealthGain(1,0),0);
});
