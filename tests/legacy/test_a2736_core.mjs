import assert from 'node:assert/strict';
import {
 HOST_BLOCK_ID,HOST_FAT_ITEM_ID,HOST_BLOCK_COUNT_PREFIX,TYPE_KEY_PREFIX,OIL_BUCKET_POINTS,
 hostBlockCountKey,typedOilBlockKey,placementCandidateLocations,normalizePlacedOilCount,
 planPlacedTypedOilAddition,blocksNativeCookeryInteraction
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2736_typed_oil_pot_block_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('host block contract stays exact',()=>{
 assert.equal(HOST_BLOCK_ID,'kaleidoscope_cookery:oil_pot');
 assert.equal(HOST_FAT_ITEM_ID,'kaleidoscope_cookery:oil');
 assert.equal(HOST_BLOCK_COUNT_PREFIX,'kc_oilpot:');
 assert.equal(OIL_BUCKET_POINTS,8);
 assert.equal(TYPE_KEY_PREFIX,'kaleidoscope_grilling:a2736_oilpot_type_');
});

t('host and addon persistence keys are coordinate stable',()=>{
 assert.equal(hostBlockCountKey('minecraft:overworld',1,64,-2),'kc_oilpot:minecraft:overworld:1,64,-2');
 assert.equal(typedOilBlockKey('minecraft:overworld',1,64,-2),'kaleidoscope_grilling:a2736_oilpot_type_minecraft_overworld_p1_p64_m2');
});

t('placement bridge checks clicked and adjacent positions',()=>{
 assert.deepEqual(placementCandidateLocations({x:1,y:2,z:3},'Up'),[{x:1,y:2,z:3},{x:1,y:3,z:3}]);
 assert.deepEqual(placementCandidateLocations({x:1,y:2,z:3},'North'),[{x:1,y:2,z:3},{x:1,y:2,z:2}]);
 assert.deepEqual(placementCandidateLocations({x:1,y:2,z:3},'South'),[{x:1,y:2,z:3},{x:1,y:2,z:4}]);
});

t('typed placed count is capped at 64 while native fat may retain 256',()=>{
 assert.equal(normalizePlacedOilCount('premium_chili',999),64);
 assert.equal(normalizePlacedOilCount('',999),256);
 assert.equal(normalizePlacedOilCount('canola',-5),0);
});

t('placed typed oil accepts same oil in 8 point bucket units',()=>{
 assert.deepEqual(planPlacedTypedOilAddition('canola',56,'canola'),{
  ok:true,type:'canola',count:56,added:8,nextCount:64,capacity:64
 });
 assert.equal(planPlacedTypedOilAddition('canola',64,'canola').reason,'full');
});

t('placed pot rejects cross-oil and native-fat retyping',()=>{
 assert.equal(planPlacedTypedOilAddition('secret_chili',8,'premium_chili').reason,'different_oil');
 assert.equal(planPlacedTypedOilAddition('',16,'canola').reason,'native_fat');
});

t('Java parity blocks Cookery extraction/fat insertion only for typed pots',()=>{
 assert.equal(blocksNativeCookeryInteraction('premium_chili',undefined),true);
 assert.equal(blocksNativeCookeryInteraction('premium_chili','kaleidoscope_cookery:oil'),true);
 assert.equal(blocksNativeCookeryInteraction('premium_chili','minecraft:stick'),false);
 assert.equal(blocksNativeCookeryInteraction('','kaleidoscope_cookery:oil'),false);
});

console.log('A2.7.36 typed Cookery oil-pot block core: '+n+'/'+n);
