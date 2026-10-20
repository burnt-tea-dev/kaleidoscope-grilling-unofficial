import assert from 'node:assert/strict';
import {
 SPECIAL_SEASONING_CANONICAL_ID,
 isSpecialSeasoningId,
 isSpecialSeasoningVisualId,
 parseSpecialSeasoningVisualId,
 specialSeasoningRemainingBucket,
 specialSeasoningVisualId
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2766_special_seasoning_visual_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Java remaining bucket uses two-use visual steps',()=>{
 assert.deepEqual(Array.from({length:17},(_,uses)=>specialSeasoningRemainingBucket(uses)),[8,8,7,7,6,6,5,5,4,4,3,3,2,2,1,1,0]);
});

t('visual ids cover 8 remaining by 8 variants',()=>{
 const ids=new Set();
 for(let uses=0;uses<16;uses++)for(let v=0;v<8;v++)ids.add(specialSeasoningVisualId(uses,v));
 assert.equal(ids.size,64);
 assert.equal(specialSeasoningVisualId(0,0),'kaleidoscope_grilling:special_seasoning_r8_v0');
 assert.equal(specialSeasoningVisualId(15,7),'kaleidoscope_grilling:special_seasoning_r1_v7');
});

t('exhausted state falls back to canonical id',()=>{
 assert.equal(specialSeasoningVisualId(16,4),SPECIAL_SEASONING_CANONICAL_ID);
});

t('family parser accepts canonical and visual ids',()=>{
 assert.equal(isSpecialSeasoningId(SPECIAL_SEASONING_CANONICAL_ID),true);
 assert.equal(isSpecialSeasoningId('kaleidoscope_grilling:special_seasoning_r4_v5'),true);
 assert.equal(isSpecialSeasoningVisualId(SPECIAL_SEASONING_CANONICAL_ID),false);
 assert.deepEqual(parseSpecialSeasoningVisualId('kaleidoscope_grilling:special_seasoning_r4_v5'),{special:true,canonical:false,remaining:4,variant:5});
});

t('family parser rejects malformed ids',()=>{
 for(const id of ['','kaleidoscope_grilling:special_seasoning_r0_v0','kaleidoscope_grilling:special_seasoning_r9_v0','kaleidoscope_grilling:special_seasoning_r1_v8','minecraft:stick'])
  assert.equal(isSpecialSeasoningId(id),false,id);
});

console.log('A2.7.66 special seasoning visual core: '+n+'/'+n);
