import assert from 'node:assert/strict';
import {
 FX_KEY,standaloneFoodEffectTable,effectsForStandaloneFood,nextPersistentUntil
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food/standalone_food_effect_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('shared persistent FX key stays aligned with A2.1',()=>{
 assert.equal(FX_KEY,'kaleidoscope_grilling:a21_fx');
});

t('roasted sweet potato keeps warmth 600 max-until semantics',()=>{
 assert.deepEqual(effectsForStandaloneFood('kaleidoscope_grilling:roasted_sweet_potato'),[{
  kind:'persistent_fx',effect:'warmth',ticks:600,amplifier:0,stacking:'max_until'
 }]);
 assert.equal(nextPersistentUntil(100,0,600),700);
 assert.equal(nextPersistentUntil(100,1200,600),1200);
 assert.equal(nextPersistentUntil(100,500,600),700);
});

t('cold houttuynia keeps native fire resistance for 1200 ticks',()=>{
 assert.deepEqual(effectsForStandaloneFood('kaleidoscope_grilling:cold_houttuynia'),[{
  kind:'native',effect:'fire_resistance',ticks:1200,options:{showParticles:true}
 }]);
});

t('unregistered foods do not gain effects',()=>{
 assert.deepEqual(effectsForStandaloneFood('minecraft:apple'),[]);
});

t('registry callers receive defensive copies',()=>{
 const row=()=>standaloneFoodEffectTable().find(x=>x.itemId==='kaleidoscope_grilling:roasted_sweet_potato');
 const first=row();first.effects[0].ticks=1;
 assert.equal(row().effects[0].ticks,600);
});

console.log('A2.7.32 standalone food effect core: '+n+'/'+n);
