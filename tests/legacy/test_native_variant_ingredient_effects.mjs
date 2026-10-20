/** Actual ingredient/extension functions; no native certification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../helpers/minecraft-fixture.mjs';


import {FOOD_DATA,COOKED_EFFECTS,RAW_NAUSEA} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/data.js';
import {RANDOM_EATING_IDS,eatingItemId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {ingredientBehavior,rolledIngredientEffects} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_ingredient_effects.js';
import {registerSecretIngredientBehavior,secretIngredientRegistration,resetSecretCompatRegistry} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_compat_core.js';
function freeze(value){if(value&&typeof value==='object'){for(const row of Object.values(value))freeze(row);Object.freeze(value)}return value}
function row(id,base=id){return freeze({id,...(FOOD_DATA[base]??{nutrition:6,saturation:.3}),edible:true,convertTo:'fixture:original_container',tags:['fixture:ingredient'],name:'Original ingredient',lore:['foreign lore'],props:{'fixture:marker':'retained'},
 native:{version:1,id,name:'Native original',rawLore:[{translate:'fixture:foreign_lore',with:['kept']}],props:{'fixture:false':false,'fixture:zero':0,'fixture:vector':{x:1,y:2,z:3}},damage:7,enchantments:[{id:'unbreaking',level:3}],keepOnDeath:true,lockMode:'slot',canDestroy:['minecraft:stone'],canPlaceOn:['minecraft:dirt']}})}
for(const base of RANDOM_EATING_IDS)test(`all behavior flags/effects/remainder match for the actual alternate ingredient ${base}`,()=>{
 resetSecretCompatRegistry();const canonical=row(base),alternate=row(eatingItemId(base,true),base),before=structuredClone(alternate);
 assert.deepEqual(ingredientBehavior(alternate),ingredientBehavior(canonical));assert.deepEqual(rolledIngredientEffects(alternate,()=>0),rolledIngredientEffects(canonical,()=>0));
 assert.deepEqual(alternate,before);assert.equal(alternate.native.id,alternate.id);assert.deepEqual(ingredientBehavior(alternate).remainder,{id:'fixture:original_container',count:1});
});
for(const id of Object.keys(FOOD_DATA))test(`all fixed/raw ingredient effects retain released food behavior ${id}`,()=>{
 resetSecretCompatRegistry();const input=row(id),before=structuredClone(input),behavior=ingredientBehavior(input),fixed=COOKED_EFFECTS[id];
 const expected=[];
 if(fixed?.effect)expected.push({kind:fixed.effect.startsWith('minecraft:')?'native':'persistent_fx',effect:fixed.effect.split(':')[1],ticks:fixed.seconds*20,amplifier:0});
 if(RAW_NAUSEA[id])expected.push({kind:'native',effect:'nausea',ticks:60});
 if(id==='kaleidoscope_grilling:mysterious_skewer')expected.push({kind:'native',effect:'nausea',ticks:100});
 if(id==='kaleidoscope_grilling:dark_grilling')expected.push({kind:'native',effect:'blindness',ticks:200});
 assert.deepEqual(behavior.effects,expected);assert.equal(behavior.ordinary,id==='kaleidoscope_grilling:ordinary_skewer');assert.deepEqual(input,before);
});
for(const [base,effect,ticks,ordinary] of [
 ['kaleidoscope_grilling:mysterious_skewer','nausea',100,false],['kaleidoscope_grilling:dark_grilling','blindness',200,false],['kaleidoscope_grilling:ordinary_skewer','',0,true]
])test(`hidden special ingredient keeps its exact finish contract ${base}`,()=>{
 resetSecretCompatRegistry();const input=row(eatingItemId(base,true),base),behavior=ingredientBehavior(input);
 assert.deepEqual(behavior.effects,effect?[{kind:'native',effect,ticks}]:[]);assert.equal(behavior.ordinary,ordinary);
});
const container=(which)=>({id:'fixture:'+which+'_container',count:2,name:'Kept '+which+' container',lore:['foreign container lore'],props:{'fixture:text':'retained','fixture:false':false,'fixture:zero':0,'fixture:vector':{x:1,y:2,z:3}}});
const extension=(which,ticks)=>({mode:'merge',effects:[{effect:'fixture_'+which,ticks}],remainder:container(which),remainders:[{id:'fixture:extra',count:3,name:'Extra container',props:{'fixture:marker':'kept'}}]});
for(const base of RANDOM_EATING_IDS)test(`actual ID extension wins canonical fallback and tags without changing the original snapshot ${base}`,()=>{
 resetSecretCompatRegistry();const actual=eatingItemId(base,true),input=row(actual,base),before=structuredClone(input);
 assert(registerSecretIngredientBehavior({tag:'fixture:ingredient',behavior:extension('tag',333)}));
 assert(registerSecretIngredientBehavior({input:base,behavior:extension('canonical',111)}));
 const canonicalRegistration=secretIngredientRegistration({id:base}),fallback=ingredientBehavior(input);
 assert.equal(fallback.effects.at(-1).effect,'fixture_canonical');assert.deepEqual(fallback.remainder,container('canonical'));assert.deepEqual(secretIngredientRegistration(input),canonicalRegistration);
 assert(registerSecretIngredientBehavior({input:actual,behavior:extension('actual',222)}));
 const explicit=ingredientBehavior(input);assert.equal(explicit.effects.at(-1).effect,'fixture_actual');assert.equal(explicit.effects.some(e=>['fixture_canonical','fixture_tag'].includes(e.effect)),false);
 assert.deepEqual(explicit.remainder,container('actual'));assert.deepEqual(explicit.remainders,[{id:'fixture:extra',count:3,name:'Extra container',props:{'fixture:marker':'kept'}}]);
 assert.equal(ingredientBehavior(row(base)).effects.at(-1).effect,'fixture_canonical');assert.deepEqual(input,before);assert.equal(input.native.id,actual);
});
// Run real script-event registrations and native eating subscribers. Remainder
// data is inspected after production give()/inventory merging, not intercepted.
for(const base of ['kaleidoscope_grilling:mysterious_skewer','kaleidoscope_grilling:dark_grilling','kaleidoscope_grilling:ordinary_skewer'])for(const actualExtension of [false,true])test(`native secret completion delivers container metadata and preserves consumed ingredient ${base} explicit=${actualExtension}`,async t=>{
 const f=createFixture();t.after(()=>f.dispose());await f.load('main.js');
 const data=await f.load('itemData.js'),compat=await f.load('secret_compat_core.js'),effects=await f.load('a285_ingredient_effects.js');
 const {secretEatingRows}=await f.load('secret_eating_core.js'),{readEffects}=await f.load('effect_state_runtime.js');
 const {SECRET_BEHAVIOR_REGISTER_EVENT,SECRET_CONSUMED_EVENT}=await f.load('secret_compat_runtime.js');
 const actual=eatingItemId(base,true),input=row(actual,base),before=structuredClone(input),which=actualExtension?'actual':'canonical';
 const registration=(kind,ticks)=>({...extension(kind,ticks),effects:[{effect:kind==='actual'?'haste':'speed',ticks},{kind:'persistent_fx',effect:'warmth',ticks:ticks+100}]});
 function register(input,behavior){
  f.emit('system.afterEvents.scriptEventReceive',{sourceType:'Server',id:SECRET_BEHAVIOR_REGISTER_EVENT,message:JSON.stringify({input,behavior})});
  assert.ok(compat.secretIngredientRegistration({id:input}));
 }
 register(base,registration('canonical',111));if(actualExtension)register(actual,registration('actual',222));
 const rows=[input,...['minecraft:apple','minecraft:carrot'].map(id=>({id,edible:true,nutrition:0,saturation:0,convertTo:''}))];
 const normalized=secretEatingRows(rows,id=>f.item(id));
 assert.equal(normalized[0],input,'the public row normalizer preserves the complete original snapshot');
 const stack=f.item('kaleidoscope_grilling:secret_skewer_java_three_alt');
 data.setItemProperty(stack,'kaleidoscope_grilling:skewer_ingredients',JSON.stringify(rows));
 const stored=data.getItemProperty(stack,'kaleidoscope_grilling:skewer_ingredients');
 const player=f.player({main:stack}),damage=[];
 player.applyDamage=(...args)=>{damage.push(args);return true;};
 f.emit('world.afterEvents.itemStartUse',{source:player,itemStack:stack.clone(),useDuration:90});f.tick(90);
 player.main=undefined; // The native engine has consumed this single serving.
 f.emit('world.afterEvents.itemCompleteUse',{source:player,itemStack:stack.clone(),useDuration:0});
 const behavior=effects.ingredientBehavior(input);
 assert.deepEqual(f.effects.filter(e=>e.source===player).map(e=>[e.effect,e.duration,e.options]),behavior.effects.filter(e=>e.kind!=='persistent_fx').map(e=>[e.effect,e.ticks,{...(e.options??{}),amplifier:e.amplifier??0,showParticles:true}]));
 for(const e of behavior.effects.filter(e=>e.kind==='persistent_fx'))assert.deepEqual(readEffects(player)[e.effect],{until:f.world.getAbsoluteTime()+e.ticks,amp:e.amplifier??0});
 const delivered=player.inventory.items().filter(Boolean);assert.equal(delivered.length,2);assert.equal(f.drops.length,0);
 const main=delivered.find(item=>item.typeId===container(which).id),expected=container(which);assert.ok(main);
 assert.equal(main.amount,expected.count);assert.equal(main.nameTag,expected.name);assert.deepEqual(data.getItemLore(main),expected.lore);
 for(const [key,value] of Object.entries(expected.props))assert.deepEqual(data.getItemProperty(main,key),value);
 const extra=delivered.find(item=>item.typeId==='fixture:extra');assert.equal(extra.amount,3);assert.equal(extra.nameTag,'Extra container');assert.equal(data.getItemProperty(extra,'fixture:marker'),'kept');
 const consumed=f.scriptEvents.filter(e=>e.id===SECRET_CONSUMED_EVENT).map(e=>JSON.parse(e.message));
 assert.deepEqual(consumed,rows.map(row=>({version:1,playerId:player.id,playerName:player.name,itemId:row.id})));
 assert.deepEqual(input,before);assert.equal(input.native.id,actual);
 assert.equal(data.getItemProperty(stack,'kaleidoscope_grilling:skewer_ingredients'),stored,'completion never rewrites the original ingredient payload');
 f.tick();assert.equal(damage.length,base.endsWith('ordinary_skewer')?1:0);
 if(damage.length)assert.deepEqual(damage[0],[3.4028234663852886e38,{cause:'override'}]);
});
test('non-edible variants do not gain finish behavior through canonical aliases or extensions',()=>{
 resetSecretCompatRegistry();const base='kaleidoscope_grilling:mysterious_skewer',actual=eatingItemId(base,true);assert(registerSecretIngredientBehavior({input:base,behavior:extension('canonical',111)}));
 const input=freeze({...row(actual,base),edible:false,nutrition:0});assert.deepEqual(ingredientBehavior(input),{effects:[],convertTo:''});
});
