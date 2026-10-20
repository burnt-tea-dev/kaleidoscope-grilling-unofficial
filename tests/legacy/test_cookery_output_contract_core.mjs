import assert from 'node:assert/strict';
import {
 COOKERY_OUTPUT_READY_EVENT,normalizeCookeryOutputRequest,authoritativeTargetMatches
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/cookery_output_contract_core.js';
import {metadataPlan} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2750_cookery_cuisine_core.js';

assert.equal(COOKERY_OUTPUT_READY_EVENT,'kaleidoscope_grilling:cookery_output_ready');
const player=normalizeCookeryOutputRequest({
 version:1,station:{dimensionId:'minecraft:overworld',x:1,y:64,z:2},
 target:{kind:'player_slot',playerId:'abc',slot:4,expectedId:'example:meal',expectedAmount:1}
});
assert.equal(player.target.kind,'player_slot');assert.equal(player.target.slot,4);
const block=normalizeCookeryOutputRequest({
 station:{dimensionId:'minecraft:overworld',x:1.9,y:64,z:2.1},
 target:{kind:'block_slot',dimensionId:'minecraft:overworld',x:5,y:63,z:8,slot:2,expectedId:'example:meal',expectedAmount:4}
});
assert.deepEqual(block.station,{dimensionId:'minecraft:overworld',x:1,y:64,z:2});
assert.equal(block.target.expectedAmount,4);
assert.equal(normalizeCookeryOutputRequest({station:{},target:{}}),null);
assert.equal(normalizeCookeryOutputRequest({
 station:{dimensionId:'minecraft:overworld',x:0,y:0,z:0},
 target:{kind:'player_slot',playerId:'p',slot:0,expectedId:'bad id',expectedAmount:1}
}),null);
assert(authoritativeTargetMatches({typeId:'example:meal',amount:4},block.target));
assert(!authoritativeTargetMatches({typeId:'example:meal',amount:3},block.target));

// Java PotBlockEntityMixin.takeOutProduct always refreshes heat for 60 s even
// when no typed oil was captured. Typed oils then override the duration.
assert.equal(metadataPlan('pot',{}).hotTicks,1200);
assert.equal(metadataPlan('pot',{oilType:'secret_chili'}).hotTicks,12000);
assert.equal(metadataPlan('pot',{oilType:'premium_chili'}).hotTicks,24000);
assert.equal(metadataPlan('stockpot',{}).hotTicks,1200);
console.log('Authoritative Cookery output contract + default pot heat: PASS');
