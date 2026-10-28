import assert from 'node:assert/strict';
import {
 SEASONING_CAPACITY,SEASONING_MAX_BOTTLES,SEASONING_MAX_USES,SEASONING_VARIANT_MAX,
 BASE_SEASONINGS,hasSeasoningBase,normalizeBottleData,remainingSeasoningUses,seasoningEffectRows
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/seasoning/seasoning_contract_core.js';
import {seasoningHudView} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/hud/seasoning_hud_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Java seasoning limits are centralized',()=>{
 assert.equal(SEASONING_CAPACITY,8);
 assert.equal(SEASONING_MAX_BOTTLES,4);
 assert.equal(SEASONING_MAX_USES,16);
 assert.equal(SEASONING_VARIANT_MAX,7);
});

t('base recipe requires all three ingredients',()=>{
 assert.equal(hasSeasoningBase(BASE_SEASONINGS),true);
 assert.equal(hasSeasoningBase(BASE_SEASONINGS.slice(0,2)),false);
});

t('bottle normalization clamps ingredients uses and variant',()=>{
 const d=normalizeBottleData({kind:'special',ingredients:Array(12).fill('minecraft:redstone'),uses:99,variant:99});
 assert.equal(d.ingredients.length,8);
 assert.equal(d.uses,16);
 assert.equal(d.variant,7);
 assert.equal(remainingSeasoningUses(d),0);
});

t('effect preview matches Java effect kinds and numb threshold',()=>{
 const rows=seasoningEffectRows([
  'minecraft:redstone','minecraft:redstone','minecraft:gunpowder',
  'kaleidoscope_grilling:houttuynia_powder','kaleidoscope_grilling:totem_powder',
  'kaleidoscope_grilling:dragon_egg_powder',
  'kaleidoscope_grilling:sichuan_pepper','kaleidoscope_grilling:sichuan_pepper'
 ]);
 assert.deepEqual(rows.map(x=>[x.kind,x.count,x.active]),[
  ['speed',2,true],['strength',1,true],['duration',1,true],['totem',1,true],['vitality',1,true],['numbness',2,false]
 ]);
});

t('four Sichuan peppers activate numbness',()=>{
 const rows=seasoningEffectRows(Array(4).fill('kaleidoscope_grilling:sichuan_pepper'));
 assert.deepEqual(rows,[{kind:'numbness',count:4,active:true}]);
});

t('unfinished HUD shows capacity and required base counts',()=>{
 const v=seasoningHudView({kind:'pending',ingredients:[...BASE_SEASONINGS],uses:0,variant:0});
 assert.equal(v.kind,'pending');
 assert.equal(v.message.rawtext[3].translate,'hud.kaleidoscope_grilling.seasoning.capacity');
 assert.deepEqual(v.message.rawtext[3].with,['3','8','5']);
 assert.equal(v.effects.length,1);
});

t('finished HUD reports remaining uses and includes variant in signature',()=>{
 const a=seasoningHudView({kind:'special',ingredients:[...BASE_SEASONINGS],uses:5,variant:2});
 const b=seasoningHudView({kind:'special',ingredients:[...BASE_SEASONINGS],uses:5,variant:3});
 assert.equal(a.remainingUses,11);
 assert.equal(a.message.rawtext[3].translate,'jade.kaleidoscope_grilling.seasoning.uses');
 assert.notEqual(a.signature,b.signature);
});

console.log('A2.7.43 seasoning HUD core: '+n+'/'+n);
