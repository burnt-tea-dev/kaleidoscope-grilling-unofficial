/** Actual ingredient/extension functions and finish bodies; no native certification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {FOOD_DATA,COOKED_EFFECTS,RAW_NAUSEA} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/data.js';
import {RANDOM_EATING_IDS,eatingItemId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {ingredientBehavior,rolledIngredientEffects} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_ingredient_effects.js';
import {registerSecretIngredientBehavior,secretIngredientRegistration,resetSecretCompatRegistry} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_compat_core.js';
import {configureItemDataWorld,setItemLore,setItemProperty,getItemRawLore,getItemProperty} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/itemDataCore.js';
const records=new Map();configureItemDataWorld({getDynamicProperty:key=>records.get(key),setDynamicProperty:(key,value)=>records.set(key,value)});
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
class ContainerStack{
 constructor(typeId,amount){this.typeId=typeId;this.amount=amount;this.maxAmount=64;this.nameTag='';this.lore=[];this.props={}}
 getRawLore(){return this.lore.map(row=>typeof row==='string'?{text:row}:structuredClone(row))}setLore(value){this.lore=structuredClone(value)}
 getDynamicPropertyIds(){return Object.keys(this.props)}getDynamicProperty(key){return this.props[key]}setDynamicProperty(key,value){this.props[key]=value}
}
const source=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/main.js',import.meta.url),'utf8');
function body(name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);let end=source.indexOf('{',start)+1,depth=1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++}return source.slice(start,end)}
for(const base of ['kaleidoscope_grilling:mysterious_skewer','kaleidoscope_grilling:dark_grilling','kaleidoscope_grilling:ordinary_skewer'])for(const actualExtension of [false,true])test(`actual secret finish delivers container metadata and original consumed snapshot ${base} explicit=${actualExtension}`,()=>{
 resetSecretCompatRegistry();const actual=eatingItemId(base,true),input=row(actual,base),before=structuredClone(input),which=actualExtension?'actual':'canonical';
 assert(registerSecretIngredientBehavior({input:base,behavior:extension('canonical',111)}));if(actualExtension)assert(registerSecretIngredientBehavior({input:actual,behavior:extension('actual',222)}));
 const delivered=[],native=[],persistent=[],emitted=[];let ordinary=0;
 const player={addEffect:(...args)=>native.push(structuredClone(args)),removeEffect(){}};
 const ctx=vm.createContext({ItemStack:ContainerStack,setItemLore,setItemProperty,readEffectiveSkewerRows:()=>[input],rolledIngredientEffects:row=>rolledIngredientEffects(row,()=>0),fxGet:()=>undefined,fxApply:(_player,...args)=>persistent.push(args),now:()=>100,applyOrdinary:()=>ordinary++,dangerousPreservation(){},give:(_player,stack)=>delivered.push(stack),emitSecretIngredientConsumed:(_player,row)=>emitted.push(row)});
 vm.runInContext(body('behaviorRemainder')+'\n'+body('secretRemainders'),ctx);ctx.secretRemainders(player,{});
 const behavior=ingredientBehavior(input);assert.equal(ordinary,base.endsWith('ordinary_skewer')?1:0);
 assert.deepEqual(native,behavior.effects.filter(e=>e.kind!=='persistent_fx').map(e=>[e.effect,e.ticks,{...(e.options??{}),amplifier:e.amplifier??0,showParticles:true}]));
 assert.deepEqual(persistent,behavior.effects.filter(e=>e.kind==='persistent_fx').map(e=>[e.effect,e.ticks,e.amplifier??0]));
 assert.equal(delivered.length,2);const main=delivered[0],expected=container(which);assert.equal(main.typeId,expected.id);assert.equal(main.amount,expected.count);assert.equal(main.nameTag,expected.name);assert.deepEqual(getItemRawLore(main),expected.lore.map(text=>({text})));
 for(const [key,value] of Object.entries(expected.props))assert.deepEqual(getItemProperty(main,key),value);
 assert.equal(delivered[1].typeId,'fixture:extra');assert.equal(delivered[1].amount,3);assert.equal(delivered[1].nameTag,'Extra container');assert.equal(getItemProperty(delivered[1],'fixture:marker'),'kept');
 assert.equal(emitted[0],input);assert.deepEqual(input,before);assert.equal(input.native.id,actual);
});
test('non-edible variants do not gain finish behavior through canonical aliases or extensions',()=>{
 resetSecretCompatRegistry();const base='kaleidoscope_grilling:mysterious_skewer',actual=eatingItemId(base,true);assert(registerSecretIngredientBehavior({input:base,behavior:extension('canonical',111)}));
 const input=freeze({...row(actual,base),edible:false,nutrition:0});assert.deepEqual(ingredientBehavior(input),{effects:[],convertTo:''});
});
