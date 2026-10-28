import assert from 'node:assert/strict';
import {
 HOUTTUYNIA_PORK_ID,GREEN_PEPPER_SQUID_ID,BRAISED_WINGS_ID,WOK_FOOD_IDS,WOK_FOODS,wokRecipes
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food/wok_food_core.js';
import {
 COOKERY_POT_ID,COOKERY_STOCKPOT_ID,potHotTicks,metadataPlan,planSeasoningUse,
 oilTypeFromHeld,inventoryGains,stateBeforeSeasoning,planPotOilTransition
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food/cookery_cuisine_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('three Java Wok dishes keep food values and stack 16',()=>{
 assert.deepEqual(WOK_FOOD_IDS,[HOUTTUYNIA_PORK_ID,GREEN_PEPPER_SQUID_ID,BRAISED_WINGS_ID]);
 assert.deepEqual(WOK_FOODS[HOUTTUYNIA_PORK_ID],{nutrition:9,saturation:0.7,maxStack:16});
 assert.deepEqual(WOK_FOODS[GREEN_PEPPER_SQUID_ID],{nutrition:8,saturation:0.6,maxStack:16});
 assert.deepEqual(WOK_FOODS[BRAISED_WINGS_ID],{nutrition:10,saturation:0.8,maxStack:16});
});

t('strict Java Pot recipes map to three Cookery Wok registrations',()=>{
 const rows=wokRecipes();assert.equal(rows.length,3);
 assert.deepEqual(rows[0].ingredients,[
  'kaleidoscope_grilling:houttuynia','kaleidoscope_grilling:houttuynia','kaleidoscope_grilling:houttuynia',
  'minecraft:porkchop','minecraft:porkchop','minecraft:porkchop'
 ]);
 assert.deepEqual(rows[1].ingredients,[
  'kaleidoscope_cookery:green_chili','kaleidoscope_cookery:green_chili',
  'kaleidoscope_grilling:squid_tentacle','kaleidoscope_grilling:squid_tentacle','kaleidoscope_grilling:onion'
 ]);
 assert.deepEqual(rows[2].ingredients,[
  'kaleidoscope_grilling:chicken_wing','kaleidoscope_grilling:chicken_wing','kaleidoscope_grilling:chicken_wing',
  'minecraft:sugar','minecraft:sugar','minecraft:sugar'
 ]);
 for(const row of rows){assert.equal(row.carrier,'minecraft:bowl');assert.equal(row.count,1);assert.equal(row.time,200)}
});

t('shared cuisine bridge preserves Java hot duration mapping',()=>{
 assert.equal(COOKERY_POT_ID,'kaleidoscope_cookery:pot');
 assert.equal(COOKERY_STOCKPOT_ID,'kaleidoscope_cookery:stockpot');
 assert.equal(potHotTicks('default'),1200);
 assert.equal(potHotTicks('canola'),1200);
 assert.equal(potHotTicks('secret_chili'),12000);
 assert.equal(potHotTicks('premium_chili'),24000);
 assert.equal(metadataPlan('stockpot',{seasoning:['minecraft:redstone']}).hotTicks,1200);
});

t('seasoning consumes one of existing 16 uses',()=>{
 let p=planSeasoningUse({ingredients:['minecraft:redstone'],uses:14});
 assert.equal(p.ok,true);assert.equal(p.nextUses,15);assert.equal(p.replaceEmpty,false);
 p=planSeasoningUse({ingredients:['minecraft:redstone'],uses:15});
 assert.equal(p.nextUses,16);assert.equal(p.replaceEmpty,true);
});

t('typed Cookery oil path preserves Grilling oil kind',()=>{
 assert.equal(oilTypeFromHeld('kaleidoscope_cookery:oil_pot_filled','premium_chili'),'premium_chili');
 assert.equal(oilTypeFromHeld('kaleidoscope_cookery:oil_pot_filled',''),'default');
 const fresh=stateBeforeSeasoning('pot',{seasoning:['minecraft:redstone'],oilType:''},false);
 const next=planPotOilTransition(fresh,false,true,'secret_chili');
 assert.equal(next.changed,true);assert.equal(next.state.oilType,'secret_chili');assert.deepEqual(next.state.seasoning,['minecraft:redstone']);
});

t('inventory delta isolates new Cookery servings',()=>{
 const before=[{id:'x',amount:3,name:'',lore:[],props:{},damage:null},null];
 const after=[{id:'x',amount:4,name:'',lore:[],props:{},damage:null},{id:'y',amount:1,name:'',lore:[],props:{},damage:null}];
 assert.deepEqual(inventoryGains(before,after),[{slot:0,id:'x',count:1},{slot:1,id:'y',count:1}]);
});

console.log('A2.7.50 Wok Cuisine core: '+n+'/'+n);
