import assert from 'node:assert/strict';
import {
 ADVANCEMENT_PREFIX,MOUNTAIN_FRAGRANCE,advancementPropertyKey,advancementAwardPlan
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2753_advancement_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Mountain Fragrance mirrors Java advancement metadata',()=>{
 assert.equal(MOUNTAIN_FRAGRANCE.id,'mountain_fragrance');
 assert.equal(MOUNTAIN_FRAGRANCE.parent,'human_fireworks');
 assert.equal(MOUNTAIN_FRAGRANCE.frame,'goal');
 assert.equal(MOUNTAIN_FRAGRANCE.xp,25);
 assert.equal(MOUNTAIN_FRAGRANCE.announce,true);
 assert.equal(MOUNTAIN_FRAGRANCE.showToast,true);
 assert.equal(MOUNTAIN_FRAGRANCE.hidden,false);
});

t('advancement property key is stable and namespaced',()=>{
 assert.equal(ADVANCEMENT_PREFIX,'kaleidoscope_grilling:adv_');
 assert.equal(advancementPropertyKey('Mountain Fragrance'),'kaleidoscope_grilling:adv_mountain_fragrance');
 assert.equal(MOUNTAIN_FRAGRANCE.propertyKey,'kaleidoscope_grilling:adv_mountain_fragrance');
});

t('first award grants exactly once',()=>{
 const p=advancementAwardPlan(MOUNTAIN_FRAGRANCE,false);
 assert.equal(p.grant,true);assert.equal(p.xp,25);assert.equal(p.announce,true);
 assert.equal(p.propertyKey,MOUNTAIN_FRAGRANCE.propertyKey);
 assert.equal(p.frame,'goal');
 const again=advancementAwardPlan(MOUNTAIN_FRAGRANCE,true);
 assert.deepEqual(again,{grant:false,xp:0,announce:false});
});

console.log('A2.7.53 advancement core: '+n+'/'+n);
