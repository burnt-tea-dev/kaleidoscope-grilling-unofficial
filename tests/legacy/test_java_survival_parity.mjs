import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {recipeTable as hosted,recipesForReady} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2727_cookery_host_recipes_core.js';
import {recipeTable as skewers} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js';
import {COOKED_EFFECTS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/data.js';
import {initialState,light,brush,flip,season,tickState,canInsert,breakDisposition} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/core_logic.js';
const fixtures=new URL('./fixtures/java-1.1.1-recipes/',import.meta.url);
const load=path=>JSON.parse(fs.readFileSync(new URL(path,fixtures),'utf8'));
const runtime=new URL('../../projects/grilling/gameplay_core/behavior_pack/recipes/',import.meta.url);
const actualRecipe=name=>{const d=JSON.parse(fs.readFileSync(new URL(name+'.json',runtime),'utf8'));return d[Object.keys(d).find(k=>k.startsWith('minecraft:recipe_'))]};
let checked=0;
const resolveTag=(tag,seen=[])=>{assert.ok(!seen.includes(tag),'cyclic source tag');return load('tags/'+tag.replace(':','/')+'.json').values.flatMap(x=>{const id=typeof x==='string'?x:x.id;return id.startsWith('#')?resolveTag(id.slice(1),[...seen,tag]):[id]})};
const one=selector=>selector.item??resolveTag(selector.tag)[0];
for(const kind of ['chopping_board','millstone']){
 for(const name of fs.readdirSync(new URL(kind+'/',fixtures))){
  const java=load(kind+'/'+name),id='kaleidoscope_grilling:'+kind+'/'+name.replace(/\.json$/,'');
  const row=hosted().find(r=>r.payload.recipe.id===id)?.payload.recipe;
  assert.ok(row,`Survival chain missing: ${id}`);
  assert.equal(row.input,one(java.ingredient),id+' input');
  const output=kind==='millstone'?row.outputs[0]:{id:row.result,count:row.count};
  assert.equal(output.id,java.result.id,id+' output');assert.equal(output.count,java.result.count??1,id+' count');checked++;
 }
}
assert.equal(recipesForReady({api:1,capabilities:['millstone']}).length,7);
assert.equal(recipesForReady({api:1,capabilities:['chopping_board']}).length,5);
assert.equal(recipesForReady({api:2,capabilities:['millstone']}).length,0);
assert.equal(new Set(hosted().map(r=>r.payload.recipe.id)).size,hosted().length);
for(const name of ['grill','premium_chili_oil','oil_cake','big_vat','pepper_honey','secret_chili_oil','oak_planks_from_pepper_log']){
 const j=load(name+'.json'),b=actualRecipe(name);
 assert.equal(b.result.item,j.result.id);assert.equal(b.result.count,j.result.count??1);
 if(j.pattern)assert.deepEqual(b.pattern,j.pattern);checked++;
}
const grill=actualRecipe('grill');assert.deepEqual(grill.key,{I:{item:'minecraft:iron_ingot'},B:{item:'minecraft:brick'},C:{tag:'minecraft:coals'}});
assert.deepEqual(actualRecipe('premium_chili_oil').ingredients.map(x=>x.item),['kaleidoscope_grilling:secret_chili_oil_bucket','minecraft:lava_bucket','minecraft:redstone','kaleidoscope_grilling:houttuynia_powder']);
for(const wood of ['oak','spruce','birch','jungle','acacia','dark_oak','mangrove','cherry','bamboo','crimson','warped']){
 const b=actualRecipe('empty_seasoning_bottle_'+wood),j=load('empty_seasoning_bottle.json');
 assert.deepEqual(b.pattern,j.pattern);assert.equal(b.key.G.item,'minecraft:glass');
 assert.equal(b.key.B.item,'minecraft:'+(wood==='oak'?'wooden_button':wood+'_button'));
 assert.equal(b.result.item,j.result.id);assert.equal(b.result.count,1);checked++;
}
const jsk=load('skewers.json').skewers;
for(const row of skewers()){
 const j=jsk.find(x=>x.id===row.id);assert.ok(j,row.id);
 const slots=j.ingredients.map(slot=>slot.map(s=>s.startsWith('#')?one({tag:s.slice(1)}):s));
 assert.deepEqual(row.slots,slots,row.id);assert.equal(row.cooked,j.cooked_result??null);checked++;
}
for(const [id,e] of Object.entries(COOKED_EFFECTS)){
 const j=jsk.find(x=>x.id===id);assert.equal(e.effect,j.effect);assert.equal(e.seconds,j.effect_seconds);checked++;
}
let s=light(initialState(),true);s=brush(s,3,1200).state;
for(let i=0;i<4;i++){s=flip(s).state;if(i<3)s=tickState(s,3,20).state;}
assert.equal(s.phase,2);s=season(s,3,['minecraft:redstone']).state;assert.equal(breakDisposition(s),'cooked');
s=tickState(s,3,800).state;assert.equal(s.phase,3);
const burnt=tickState(s,3,400);assert.deepEqual(burnt.events,[{kind:'burn_to_charcoal'}]);
assert.deepEqual(burnt.state,{...initialState(),lit:true});assert.equal(canInsert(burnt.state,0),true);
assert.equal(tickState(light(s,false),3,400).state.phase,3,'unlit pauses burnout');
console.log(`PASS Java 1.1.1 survival parity: ${checked} released recipe/effect rows plus grill cycle and persistent fire`);
const {appendOutcome,completedRecipe,canAppendConfigured}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js');
const wing={id:'example:wing',tags:['kaleidoscope_grilling:ingredients/chicken_wings']};
assert.equal(canAppendConfigured([],wing),true);
assert.equal(appendOutcome([wing,{id:'kaleidoscope_cookery:red_chili'}],wing).id,'kaleidoscope_grilling:raw_mid_wing_skewer');
assert.equal(completedRecipe([wing,{id:'kaleidoscope_cookery:red_chili'},wing]).id,'kaleidoscope_grilling:raw_mid_wing_skewer');
assert.equal(appendOutcome([wing,{id:'minecraft:apple'}],wing,true).kind,'secret');
assert.equal(appendOutcome([],{id:'example:fake_wing',tags:['other:chicken_wings']}).ok,false);
assert.equal(appendOutcome(['kaleidoscope_grilling:chicken_skin'],'kaleidoscope_grilling:chicken_skin').kind,'fixed');
console.log('PASS tag-aware fixed threading, literal ID compatibility and wrong-tag rejection');

const {dragonPowderCount,knifeDamagePlan}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/dragon_powder_core.js');
for(let level=0;level<=3;level++){
 assert.equal(dragonPowderCount(level,0),1);assert.equal(dragonPowderCount(level,.99999),1+level);
}
assert.deepEqual(knifeDamagePlan(4,10,0,0),{mutate:true,broken:false,damage:5});
assert.equal(knifeDamagePlan(9,10,0,0).broken,true);
assert.equal(knifeDamagePlan(9,10,3,.9).mutate,false);
assert.equal(knifeDamagePlan(9,10,0,0,true).mutate,false);
console.log('PASS dragon powder Looting range, durability, Unbreaking and creative mode');
