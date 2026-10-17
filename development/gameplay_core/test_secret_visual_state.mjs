/** Source-backed visual state checks; no Minecraft/client-rendering claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {SECRET_FOOD_COUNT,SECRET_VISUAL_MAX,SECRET_MODEL_VARIANTS_KEY,modelVariant,readModelVariants,appendedModelVariants,encodeSecretVisual,decodeSecretVisual,secretHeldMarker} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state_core.js';
import {configureItemDataWorld,getItemProperty,setItemProperty} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/itemDataCore.js';
import {secretVisualState} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state.js';
import {secretVisualIndex} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/integration_registry_core.js';
const N='kaleidoscope_grilling:';
test('all supported foods, shapes and seven stage styles have collision-free legacy-safe properties',()=>{
 assert.equal(SECRET_FOOD_COUNT,217);assert.equal(SECRET_VISUAL_MAX,5337);
 const seen=new Set();for(let food=1;food<=217;food++)for(let shape=1;shape<=3;shape++)for(let style=0;style<7;style++){
  const value=encodeSecretVisual(food,shape+3,style===6?4:style,style===6);assert.ok(value<=SECRET_VISUAL_MAX);assert.equal(seen.has(value),false);seen.add(value);
  assert.deepEqual(decodeSecretVisual(value),{food,shape,style});
 }
 for(let food=1;food<=217;food++)assert.deepEqual(decodeSecretVisual(food),{food,shape:1,style:0});
 assert.equal(encodeSecretVisual(0,4,5),0);assert.equal(encodeSecretVisual(218,4,0),0);assert.equal(decodeSecretVisual(218).food,0);
 for(let food=0;food<=217;food++)assert.equal(secretHeldMarker(food),food<=213?food:food+7);
 for(const invalid of [-1,218,255,0.5,NaN])assert.throws(()=>secretHeldMarker(invalid));
});
test('Java stored4..9 values retain shapes and old unrecorded variants use stable migration defaults',()=>{
 assert.deepEqual([4,5,6,7,8,9].map(modelVariant),[1,2,3,1,2,3]);
 assert.deepEqual(readModelVariants(undefined,2),[4,4]);assert.deepEqual(readModelVariants('[5,8]',2),[5,8]);
 assert.deepEqual(appendedModelVariants('[5,8]',2,()=>.99),[5,8,9]);assert.deepEqual(appendedModelVariants(undefined,2,()=>0),[4,4,4]);
});
class Stack{
 constructor(){this.typeId=N+'secret_skewer';this.maxAmount=64;this.lore=[];this.raw=[{id:'minecraft:apple'},{id:'minecraft:carrot'},{id:'minecraft:beef'}];this.cached=[...this.raw.slice(0,2),{id:'minecraft:cooked_beef'}]}
 getRawLore(){return structuredClone(this.lore)}setLore(lore){this.lore=structuredClone(lore)}clone(){return Object.assign(new Stack(),structuredClone({...this}))}
}
test('variants persist through real content-addressed metadata cloning and visual reads do not mutate items',()=>{
 const saved=new Map();configureItemDataWorld({getDynamicProperty:k=>saved.get(k),setDynamicProperty:(k,v)=>saved.set(k,v)});
 const stack=new Stack();setItemProperty(stack,SECRET_MODEL_VARIANTS_KEY,'[4,5,9]');setItemProperty(stack,N+'secret_cooked_ingredients',JSON.stringify(stack.cached));
 const read=(s,cooked)=>cooked?s.cached:s.raw,copy=stack.clone();assert.equal(getItemProperty(copy,SECRET_MODEL_VARIANTS_KEY),'[4,5,9]');const before=JSON.stringify(copy);
 for(let stage=0;stage<6;stage++){
  const state=secretVisualState(copy,read,stage).map(decodeSecretVisual);assert.deepEqual(state.map(x=>x.shape),[1,2,3]);
  assert.equal(state[2].food,secretVisualIndex(stage>=4?'minecraft:cooked_beef':'minecraft:beef'));assert.equal(state[2].style,stage===4?6:stage);
 }
 assert.equal(JSON.stringify(copy),before);setItemProperty(copy,N+'secret_cooked',true);
 assert.equal(secretVisualState(copy,read).map(decodeSecretVisual)[2].style,6);
});
test('actual partial rows0/1/2 carry count and shape without cooked rows or fake helper food',async()=>{
 const {partialVisualState}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state.js');
 const metadata=new Map();configureItemDataWorld({getDynamicProperty:k=>metadata.get(k),setDynamicProperty:(k,v)=>metadata.set(k,v)});
 const stack=new Stack();stack.typeId=N+'unfinished_skewer';setItemProperty(stack,SECRET_MODEL_VARIANTS_KEY,'[6,5]');setItemProperty(stack,N+'secret_cooked',true);setItemProperty(stack,N+'secret_cooked_ingredients',JSON.stringify(stack.cached));
 const read=(s,cooked)=>{assert.equal(cooked,false);return s.raw};
 for(let count=0;count<=2;count++){
  stack.raw=[{id:'minecraft:apple'},{id:'minecraft:carrot'}].slice(0,count);const packed=partialVisualState(stack,read),decoded=packed.map(decodeSecretVisual);
  assert.deepEqual(decoded.slice(0,count).map(x=>x.style),Array(count).fill(count));
  assert.deepEqual(decoded.slice(0,count).map(x=>x.shape),[3,2].slice(0,count));assert.equal(packed.slice(count).every(x=>x===0),true);
 }
 stack.raw=[{id:'foreign:unsupported'},{id:'minecraft:carrot'}];const decoded=partialVisualState(stack,read).map(decodeSecretVisual);assert.equal(decoded[0].food,0);assert.equal(decoded[0].shape,3);assert.equal(decoded[0].style,2);
});
test('unsupported completed ingredient retains its source shape for supported neighboring seams',()=>{
 const stack=new Stack();const metadata=new Map();configureItemDataWorld({getDynamicProperty:k=>metadata.get(k),setDynamicProperty:(k,v)=>metadata.set(k,v)});
 setItemProperty(stack,SECRET_MODEL_VARIANTS_KEY,'[6,5,4]');stack.raw[0]={id:'foreign:unsupported'};
 const decoded=secretVisualState(stack,s=>s.raw,0).map(decodeSecretVisual);assert.deepEqual(decoded.map(x=>x.shape),[3,2,1]);assert.equal(decoded[0].food,0);
});
