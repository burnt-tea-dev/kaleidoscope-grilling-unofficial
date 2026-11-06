/** Stable ItemStack API doubles, not simulated Minecraft players. */
import test from 'node:test';import assert from 'node:assert/strict';
import {captureSkewerMetadata,restoreSkewerMetadata,metadataSignature} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js';
import {configureItemDataWorld,setItemProperty,getItemProperty,setItemLore,getItemRawLore} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/core/persist.js';
const records=new Map();configureItemDataWorld({getDynamicProperty:k=>records.get(k),setDynamicProperty:(k,v)=>records.set(k,v)});
class Stack{
 constructor(typeId,amount=1){Object.assign(this,{typeId,amount,maxAmount:typeId.includes('sword')?1:64,lore:[],props:{},keepOnDeath:false,lockMode:'none',destroy:[],place:[],enchantments:[],damage:0});}
 getRawLore(){return this.lore.map(x=>typeof x==='string'?{text:x}:structuredClone(x))}setLore(v){this.lore=structuredClone(v)}
 getDynamicPropertyIds(){return Object.keys(this.props)}getDynamicProperty(k){return this.props[k]}setDynamicProperty(k,v){this.props[k]=v}
 getCanDestroy(){return this.destroy}getCanPlaceOn(){return this.place}setCanDestroy(v){this.destroy=[...v]}setCanPlaceOn(v){this.place=[...v]}
 getComponent(id){const s=this;if(id==='minecraft:durability'&&this.maxAmount===1)return {get damage(){return s.damage},set damage(n){s.damage=n}};
 if(id==='minecraft:enchantable'&&this.maxAmount===1)return {getEnchantments:()=>s.enchantments,removeAllEnchantments:()=>s.enchantments=[],addEnchantments:rows=>s.enchantments=rows};}
}
const restore=row=>restoreSkewerMetadata(row,(id,n)=>new Stack(id,n),id=>({id}));
for(const id of ['minecraft:apple','minecraft:diamond_sword'])test('metadata roundtrip '+id,()=>{
 const s=new Stack(id,17);s.nameTag='named';s.keepOnDeath=true;s.lockMode='slot';s.destroy=['minecraft:stone'];s.place=['minecraft:dirt'];
 setItemLore(s,[{translate:'item.apple.name'},{rawtext:[{text:'prefix '},{translate:'item.diamond.name'}]}]);
 setItemProperty(s,'test:vector',{x:1,y:2,z:3});setItemProperty(s,'test:false',false);setItemProperty(s,'test:zero',0);
 if(s.maxAmount===1){s.damage=31;s.enchantments=[{type:{id:'unbreaking'},level:3},{type:{id:'sharpness'},level:2}]}
 const data=captureSkewerMetadata(s),out=restore(JSON.parse(JSON.stringify(data)));
 assert.equal(out.amount,1);assert.equal(metadataSignature(captureSkewerMetadata(out)),metadataSignature(data));
 assert.deepEqual(getItemRawLore(out),getItemRawLore(s));assert.deepEqual(getItemProperty(out,'test:vector'),{x:1,y:2,z:3});
});
test('metadata has stable identity independent of dynamic-property insertion order',()=>{const a=new Stack('minecraft:apple'),b=new Stack('minecraft:apple');setItemProperty(a,'x:a',1);setItemProperty(a,'x:b',2);setItemProperty(b,'x:b',2);setItemProperty(b,'x:a',1);assert.equal(metadataSignature(captureSkewerMetadata(a)),metadataSignature(captureSkewerMetadata(b)));});
test('captures actual RawMessage rather than erasing translated lore',()=>{const s=new Stack('minecraft:apple');s.setLore([{translate:'test:key',with:['a']}]);assert.deepEqual(captureSkewerMetadata(s).rawLore,[{translate:'test:key',with:['a']}]);});
test('unreadable metadata is rejected rather than captured empty',()=>{const s=new Stack('minecraft:diamond_sword');s.getDynamicPropertyIds=()=>{throw Error('unreadable')};assert.throws(()=>captureSkewerMetadata(s),/unreadable/);});
test('metadata setter failure aborts restoration',()=>{const d=captureSkewerMetadata(new Stack('minecraft:apple'));assert.throws(()=>restoreSkewerMetadata(d,()=>{const s=new Stack(d.id);s.setCanPlaceOn=()=>{throw Error('denied')};return s},id=>({id})),/denied/);});
test('silently rejected field fails readback',()=>{const s=new Stack('minecraft:apple');s.keepOnDeath=true;const d=captureSkewerMetadata(s);assert.throws(()=>restoreSkewerMetadata(d,()=>{const out=new Stack(d.id);Object.defineProperty(out,'keepOnDeath',{get:()=>false,set(){}});return out},id=>({id})),/readback/);});
test('unknown snapshot version refuses lossy fallback',()=>assert.throws(()=>restore({version:2,id:'minecraft:apple'}),/unsupported/));
test('separate damage and raw-lore contents have different ingredient identity',()=>{const a=new Stack('minecraft:diamond_sword'),b=new Stack('minecraft:diamond_sword');b.damage=1;assert.notEqual(metadataSignature(captureSkewerMetadata(a)),metadataSignature(captureSkewerMetadata(b)));b.damage=0;b.lore=[{translate:'test:key'}];assert.notEqual(metadataSignature(captureSkewerMetadata(a)),metadataSignature(captureSkewerMetadata(b)));});
const {ingredientContentSignature}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js');
const {secretFood}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer/skewering_core.js');
test('mixed legacy and native snapshots retain duplicate ingredient penalty',()=>{const legacy={id:'minecraft:apple',name:'named',lore:['text'],props:{'x:a':1},nutrition:4,saturation:.3};const s=new Stack(legacy.id);s.nameTag=legacy.name;s.setLore(legacy.lore);setItemProperty(s,'x:a',1);const current={...legacy,native:captureSkewerMetadata(s)};assert.equal(ingredientContentSignature(legacy),ingredientContentSignature(current));assert.equal(secretFood([legacy,current],true).duplicate,true);current.native.rawLore=[{translate:'different'}];assert.equal(secretFood([legacy,current],true).duplicate,false);});
test('five ordinary cooked-secret plate snapshots fit native string storage',()=>{
 const rows=['minecraft:apple','minecraft:carrot','minecraft:beef'].map(id=>({id,nutrition:4,saturation:.3,convertTo:'',edible:true,tags:[],native:captureSkewerMetadata(new Stack(id))}));
 const skewer=new Stack('kaleidoscope_grilling:secret_skewer');setItemLore(skewer,['Three ingredients']);setItemProperty(skewer,'kaleidoscope_grilling:skewer_ingredients',JSON.stringify(rows));setItemProperty(skewer,'kaleidoscope_grilling:secret_cooked_ingredients',JSON.stringify(rows));
 const row={id:skewer.typeId,native:captureSkewerMetadata(skewer),nutrition:7,saturation:.3};const payload=JSON.stringify(Array.from({length:5},()=>row));
 assert.ok(Buffer.byteLength(payload,'utf8')<32767,Buffer.byteLength(payload));
 const wrapped=JSON.stringify({'kaleidoscope_grilling:plate_skewers':payload});assert.ok(Buffer.byteLength(wrapped,'utf8')<32767,Buffer.byteLength(wrapped));
});

import {secretEatingRows} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_eating_core.js';
import {createFixture} from '../helpers/minecraft-fixture.mjs';
// Exercise the exported decoder itself. Event admission is a separate contract;
// a valid decoded payload alone is not proof that an eating event may commit.
const secretIds=['minecraft:apple','minecraft:carrot','minecraft:beef'];
const registeredIngredients=new Set([...secretIds,'test:a','test:b','test:c','test:food']);
function createIngredient(id){
 if(!registeredIngredients.has(id))throw Error('uninstalled item');
 const item=new Stack(id);
 if(id==='test:food')item.getComponent=component=>component==='minecraft:food'
  ?{nutrition:5,saturationModifier:.7,usingConvertsTo:'minecraft:bowl'}:undefined;
 return item;
}
const plainSecretRows=()=>secretIds.map(id=>({id}));
for(const [name,rows] of [
 ['missing',undefined],['empty',[]],['one ingredient',[{id:'test:a'}]],
 ['two ingredients',[{id:'test:a'},{id:'test:b'}]],['malformed JSON text','{bad'],
 ['non-array object',{}],['four ingredients',[...plainSecretRows(),{id:'test:a'}]]
])test('secret ingredient decoder rejects '+name+' without changing the input',()=>{
 const before=structuredClone(rows);
 assert.equal(secretEatingRows(rows,createIngredient),undefined);assert.deepEqual(rows,before);
});
for(const [name,bad] of [
 ['uninstalled item',{id:'test:missing'}],['air',{id:'minecraft:air'}],
 ['invalid identifier',{id:'not a resource location'}],['array identifier',{id:['minecraft:apple']}],
 ['string nutrition',{id:'minecraft:apple',nutrition:'4'}],
 ['NaN nutrition',{id:'minecraft:apple',nutrition:NaN}],
 ['infinite saturation',{id:'minecraft:apple',saturation:Infinity}],
 ['negative nutrition',{id:'minecraft:apple',nutrition:-1}],
 ['negative saturation',{id:'minecraft:apple',saturation:-1}],
 ['non-boolean edible',{id:'minecraft:apple',edible:'true'}],
 ['non-string remainder',{id:'minecraft:apple',convertTo:4}],
 ['null native envelope',{id:'minecraft:apple',native:null}],
 ['unknown native version',{id:'minecraft:apple',native:{version:2,id:'minecraft:apple'}}],
 ['different native identity',{id:'minecraft:apple',native:{version:1,id:'minecraft:carrot'}}]
])test('raw and cooked secret rows reject '+name+' without losing their saved data',()=>{
 // Both the raw payload and the cooked cache are validated by this same export.
 const rows=[bad,{id:'minecraft:beef'},{id:'minecraft:carrot'}],before=structuredClone(rows);
 assert.equal(secretEatingRows(rows,createIngredient),undefined);assert.deepEqual(rows,before);
});
test('an unavailable or air native item cannot validate an otherwise valid saved ingredient',()=>{
 const rows=plainSecretRows(),before=structuredClone(rows);
 for(const createItem of [()=>undefined,()=>({typeId:'minecraft:air'})]){
  assert.equal(secretEatingRows(rows,createItem),undefined);assert.deepEqual(rows,before);
 }
});
test('three installed nonfood ingredients remain valid without inventing food values',()=>{
 const rows=['test:a','test:b','test:c'].map(id=>({id})),before=structuredClone(rows);
 const decoded=secretEatingRows(rows,createIngredient);
 assert.equal(decoded.length,3);
 for(const row of decoded){assert.equal(row.nutrition,0);assert.equal(row.saturation,0);assert.equal(row.edible,false);assert.equal(row.convertTo,'')}
 assert.equal(secretFood(decoded,false).nutrition,1);assert.deepEqual(rows,before);
});
test('secret rows recover missing food facts but preserve explicit edible zero values',()=>{
 const rows=plainSecretRows(),before=structuredClone(rows),decoded=secretEatingRows(rows,createIngredient);
 assert.equal(secretFood(decoded,true,rows).nutrition,6);assert.deepEqual(rows,before);
 const zero=rows.map(row=>({...row,edible:true,nutrition:0,saturation:0,convertTo:''}));
 const explicit=secretEatingRows(zero,createIngredient);
 assert.deepEqual(explicit,zero);assert.equal(secretFood(explicit,false,zero).nutrition,1);
});
test('missing ingredient facts use the installed food component and preserve metadata',()=>{
 const rows=[{id:'test:food',name:'Kept name',props:{'foreign:owner':'kept'}},{id:'minecraft:apple'},{id:'minecraft:carrot'}],before=structuredClone(rows);
 const decoded=secretEatingRows(rows,createIngredient);
 assert.equal(decoded[0].nutrition,5);assert.equal(decoded[0].saturation,.7);
 assert.equal(decoded[0].edible,true);assert.equal(decoded[0].convertTo,'minecraft:bowl');
 assert.equal(decoded[0].name,'Kept name');assert.deepEqual(decoded[0].props,rows[0].props);assert.deepEqual(rows,before);
});

const secretIngredientsKey='kaleidoscope_grilling:skewer_ingredients';
const secretCookedKey='kaleidoscope_grilling:secret_cooked';
function savedSecretFixture(){
 const originalRecords=new Map();
 configureItemDataWorld({getDynamicProperty:key=>originalRecords.get(key),setDynamicProperty:(key,value)=>originalRecords.set(key,value)});
 const original=new Stack('kaleidoscope_grilling:secret_skewer_native_plain',3);
 setItemLore(original,[{text:'Foreign visible lore'}]);
 setItemProperty(original,secretIngredientsKey,JSON.stringify(plainSecretRows()));
 setItemProperty(original,secretCookedKey,true);setItemProperty(original,'foreign:owner','retained');
 const saved=structuredClone({id:original.typeId,amount:original.amount,lore:original.getRawLore(),records:[...originalRecords]});
 const restoredRecords=new Map(saved.records),restored=new Stack(saved.id,saved.amount);
 restored.setLore(saved.lore);
 configureItemDataWorld({getDynamicProperty:key=>restoredRecords.get(key),setDynamicProperty:(key,value)=>restoredRecords.set(key,value)});
 return {saved,restored,restoredRecords};
}
function restoreDefaultWorld(){configureItemDataWorld({getDynamicProperty:key=>records.get(key),setDynamicProperty:(key,value)=>records.set(key,value)})}
test('saved stackable secret reopens its world record without rewriting item or metadata',()=>{
 try{
  const {saved,restored,restoredRecords}=savedSecretFixture();
  const rows=JSON.parse(getItemProperty(restored,secretIngredientsKey)),decoded=secretEatingRows(rows,createIngredient);
  assert.equal(secretFood(decoded,true,rows).nutrition,6);
  assert.equal(getItemProperty(restored,secretCookedKey),true);
  assert.equal(getItemProperty(restored,'foreign:owner'),'retained');
  assert.deepEqual(captureSkewerMetadata(restored).props,{
   [secretIngredientsKey]:JSON.stringify(plainSecretRows()),[secretCookedKey]:true,'foreign:owner':'retained'
  });
  assert.equal(restored.amount,3);assert.deepEqual(restored.getRawLore(),saved.lore);assert.deepEqual([...restoredRecords],saved.records);
 }finally{restoreDefaultWorld()}
});
test('missing stackable secret world record rejects reads and snapshots without replacing saved item data',()=>{
 try{
  const {saved,restored,restoredRecords}=savedSecretFixture();restoredRecords.clear();
  assert.throws(()=>getItemProperty(restored,secretIngredientsKey),/Missing Grilling item metadata/);
  assert.throws(()=>captureSkewerMetadata(restored),/Missing Grilling item metadata/);
  assert.equal(restored.typeId,saved.id);assert.equal(restored.amount,saved.amount);
  assert.deepEqual(restored.getRawLore(),saved.lore);assert.equal(restoredRecords.size,0);
 }finally{restoreDefaultWorld()}
});
for(const corrupt of ['{bad','null','[]','42','"wrong type"'])test('corrupt stackable secret world record remains unchanged when reads reject '+corrupt,()=>{
 try{
  const {saved,restored,restoredRecords}=savedSecretFixture();
  for(const key of restoredRecords.keys())restoredRecords.set(key,corrupt);
  const before=structuredClone([...restoredRecords]);
  assert.throws(()=>getItemProperty(restored,secretIngredientsKey));
  assert.throws(()=>captureSkewerMetadata(restored));
  assert.deepEqual([...restoredRecords],before);assert.equal(restored.amount,saved.amount);assert.deepEqual(restored.getRawLore(),saved.lore);
 }finally{restoreDefaultWorld()}
});

// Real main.js subscribers own admission and fourth-flip cache writes. Only
// the Minecraft API boundary is replaced; no private function is extracted.
const N='kaleidoscope_grilling:',cookedIngredientsKey=N+'secret_cooked_ingredients';
async function placedGrillFixture(){
 const f=await nativeSecretFixture();
 const state=await f.load('grill/grill_state_adapter.js'),storage=await f.load('core/storage.js');
 const grill=f.block(N+'grill',{x:0,y:80,z:0});f.block('minecraft:stone',{x:0,y:79,z:0});
 f.emit('world.afterEvents.playerPlaceBlock',{block:grill,player:f.p});f.flush();
 function interact(){
  const event=f.emit('world.beforeEvents.playerInteractWithBlock',{block:grill,player:f.p,itemStack:f.p.main,blockFace:'Up',isFirstEvent:true,cancel:false});
  assert.equal(event.cancel,true);f.flush();
 }
 f.p.main=f.item('minecraft:flint_and_steel');interact();
 assert.equal(state.readGrillState(grill).lit,true);
 return Object.assign(f,{grill,grillState:()=>state.readGrillState(grill),contents:storage.stationContainer(grill),interact});
}
async function nativeGrillInteractionFixture(statePatch={}){
 const f=createFixture();await f.load('main.js');f.startup();f.flush();
 const player=f.p=f.player(),grill=f.block(N+'grill',{x:0,y:80,z:0});f.block('minecraft:stone',{x:0,y:79,z:0});
 const state=await f.load('grill/grill_state_adapter.js'),logic=await f.load('core_logic.js');
 f.dp.set(state.grillStateKey(grill),JSON.stringify({...logic.initialState(),phase:1,heatTicks:1200,...statePatch}));
 return Object.assign(f,{grill,grillState:()=>state.readGrillState(grill),nativeInteract(overrides={}){
  return f.component(N+'grill_tick','onPlayerInteract',{block:grill,player,...overrides});
 }});
}
test('placed grill cooks and returns exactly three beef skewers through player callbacks',async()=>{
 const f=await placedGrillFixture();
 try{
  f.p.main=f.item(N+'raw_beef_skewer',3);
  for(let count=2;count>=0;count--){f.interact();assert.equal(f.p.main?.amount??0,count);}
  assert.deepEqual([0,1,2].map(slot=>f.contents.getItem(slot)?.typeId),Array(3).fill(N+'raw_beef_skewer'));
  const oil=await f.load('oil/cookery_oil_pot_adapter.js');
  // The public host oil payload and prepared bottle are explicit external inputs.
  f.p.main=oil.buildCookeryOilPot('canola',3);f.interact();
  assert.equal(oil.readCookeryOilPot(f.p.main).empty,true);
  f.p.main=undefined;
  for(let flip=1;flip<=4;flip++){
   f.interact();assert.equal(f.grillState().flips,flip);
   for(let tick=0;tick<20;tick++){f.tick();f.component(N+'grill_tick','onTick',{block:f.grill});}
  }
  assert.equal(f.grillState().phase,2);
  const food=await f.load('food/food_state_adapter.js'),bottle=f.item(N+'special_seasoning');
  food.setFoodSeasonings(bottle,[N+'green_chili_powder',N+'sichuan_pepper',N+'onion_powder']);
  f.data.setItemProperty(bottle,N+'uses',13);f.p.main=bottle;f.interact();
  assert.equal(f.p.main.typeId,N+'empty_seasoning_bottle');assert.equal(f.grillState().seasoned,true);
  f.p.main=undefined;f.p.isSneaking=true;f.interact();
  assert.deepEqual([0,1,2].map(slot=>f.contents.getItem(slot)),[undefined,undefined,undefined]);
  const ids=await f.load('eating_profile_ids.js');
  const cooked=f.p.inventory.items().filter(item=>ids.canonicalFoodId(item?.typeId)===N+'grilled_beef_skewer');
  assert.equal(cooked.reduce((total,item)=>total+item.amount,0),3);
  assert.ok(cooked.every(item=>food.readFoodSeasonings(item).length===3));
  assert.equal(f.drops.length,0);assert.equal(f.grillState().phase,0);
 }finally{f.dispose();}
});
// Raw-to-cooked IDs change; native ownership metadata must not.
async function oneBeefReadyForExtraction(f,raw){
 f.p.main=raw;f.interact();
 assert.equal(f.contents.getItem(0)?.typeId,N+'raw_beef_skewer');
 const oil=await f.load('oil/cookery_oil_pot_adapter.js');
 f.p.main=oil.buildCookeryOilPot('canola',1);assert.ok(f.p.main);f.interact();
 f.p.main=undefined;
 for(let flip=1;flip<=4;flip++){
  f.interact();assert.equal(f.grillState().flips,flip);
  for(let tick=0;tick<20;tick++){f.tick();f.component(N+'grill_tick','onTick',{block:f.grill});}
 }
 assert.equal(f.grillState().phase,2);
 const food=await f.load('food/food_state_adapter.js'),bottle=f.item(N+'special_seasoning');
 food.setFoodSeasonings(bottle,[N+'green_chili_powder',N+'sichuan_pepper',N+'onion_powder']);
 f.data.setItemProperty(bottle,N+'uses',15);f.p.main=bottle;f.interact();
 assert.equal(f.grillState().seasoned,true);f.p.main=undefined;f.p.isSneaking=true;
}
test('cooked beef from a normal grill preserves native ownership and foreign metadata',async()=>{
 const f=await placedGrillFixture();
 try{
  const raw=f.item(N+'raw_beef_skewer',1,{
   nameTag:'Named by another addon',keepOnDeath:true,lockMode:'slot',
   canDestroy:['minecraft:stone'],canPlaceOn:['minecraft:dirt'],
   rawLore:[{text:'foreign: preserve my note'}]
  });
  f.data.setItemProperty(raw,'foreign:owner','retained');
  await oneBeefReadyForExtraction(f,raw);f.interact();
  const cooked=f.p.inventory.items().find(x=>x?.typeId===N+'grilled_beef_skewer');
  assert.ok(cooked,'the cooked serving must be delivered');
  assert.equal(cooked.amount,1);assert.equal(cooked.nameTag,raw.nameTag);
  assert.equal(cooked.keepOnDeath,true);assert.equal(cooked.lockMode,'slot');
  assert.deepEqual(cooked.getCanDestroy(),['minecraft:stone']);
  assert.deepEqual(cooked.getCanPlaceOn(),['minecraft:dirt']);
  assert.ok(cooked.getRawLore().some(line=>line.text==='foreign: preserve my note'));
  assert.equal(f.data.getItemProperty(cooked,'foreign:owner'),'retained');
  assert.equal(f.contents.getItem(0),undefined);assert.equal(f.drops.length,0);
 }finally{f.dispose()}
});
test('unwritable cooked fields leave the original raw skewer on its grill and permit retry',async()=>{
 const f=await placedGrillFixture(),original=f.ItemStack.prototype.setCanDestroy;
 try{
  await oneBeefReadyForExtraction(f,f.item(N+'raw_beef_skewer',1));
  f.ItemStack.prototype.setCanDestroy=function(list){
   if(this.typeId===N+'grilled_beef_skewer')throw Error('unavailable cooked native field');
   return original.call(this,list);
  };
  f.interact();
  assert.equal(f.contents.getItem(0)?.typeId,N+'raw_beef_skewer');
  assert.equal(f.grillState().seasoned,true);
  assert.equal(f.p.inventory.items().some(x=>x?.typeId===N+'grilled_beef_skewer'),false);
  assert.equal(f.drops.length,0);
  f.ItemStack.prototype.setCanDestroy=original;f.interact();
  assert.equal(f.contents.getItem(0),undefined);
  assert.equal(f.p.inventory.items().filter(x=>x?.typeId===N+'grilled_beef_skewer').length,1);
 }finally{f.ItemStack.prototype.setCanDestroy=original;f.dispose()}
});
test('normal grill before event plus native component flips exactly once and cancels vanilla use',async()=>{
 const f=await nativeGrillInteractionFixture();
 try{
  const event=f.emit('world.beforeEvents.playerInteractWithBlock',{block:f.grill,player:f.p,itemStack:undefined,blockFace:'Up',isFirstEvent:true,cancel:false});
  assert.equal(event.cancel,true);f.nativeInteract();f.flush();
  assert.equal(f.grillState().flips,1);
 }finally{f.dispose();}
});
test('native grill component does not bypass the ordinary long-press filter',async()=>{
 const f=await nativeGrillInteractionFixture();
 try{
  const event=f.emit('world.beforeEvents.playerInteractWithBlock',{block:f.grill,player:f.p,itemStack:undefined,blockFace:'Up',isFirstEvent:false,cancel:false});
  assert.equal(event.cancel,true);f.nativeInteract();f.flush();
  assert.equal(f.grillState().flips,0);
 }finally{f.dispose();}
});
test('native-only grill interaction uses the real component for two readable empty hands',async()=>{
 const f=await nativeGrillInteractionFixture();
 try{
  f.nativeInteract();
  assert.equal(f.grillState().flips,1);assert.equal(f.grillState().flipCooldown,20);
 }finally{f.dispose();}
});
test('native grill component leaves an offhand item untouched and does not guess its hand',async()=>{
 const f=await nativeGrillInteractionFixture();
 try{
  f.p.off=f.item('minecraft:stick',2);f.nativeInteract();
  assert.equal(f.grillState().flips,0);assert.equal(f.p.off.typeId,'minecraft:stick');assert.equal(f.p.off.amount,2);
 }finally{f.dispose();}
});
test('native grill component fails closed when hand readability is unavailable',async()=>{
 const f=await nativeGrillInteractionFixture();
 try{
  f.p.equipment.getEquipment=()=>{throw Error('equippable unreadable')};f.nativeInteract();
  assert.equal(f.grillState().flips,0);
 }finally{f.dispose();}
});
test('native grill component cannot bypass a selected-slot change after normal before admission',async()=>{
 const f=await nativeGrillInteractionFixture({phase:0});
 try{
  f.p.main=f.item('minecraft:flint_and_steel');const original=f.p.main;
  const event=f.emit('world.beforeEvents.playerInteractWithBlock',{block:f.grill,player:f.p,itemStack:original,blockFace:'Up',isFirstEvent:true,cancel:false});
  assert.equal(event.cancel,true);f.p.selectedSlotIndex=1;f.nativeInteract();f.flush();
  assert.equal(f.grillState().lit,false);assert.equal(f.grillState().flips,0);
  assert.equal(f.p.inventory.getItem(0).typeId,'minecraft:flint_and_steel');assert.equal(f.p.main,undefined);
 }finally{f.dispose();}
});
for(const phase of ['before','after'])test('grill insertion '+phase+'-write failure preserves the hand and all three empty slots',async()=>{
 const f=await placedGrillFixture();
 try{
  f.p.main=f.item(N+'raw_beef_skewer',3);
  f.faults.failNext(f.contents,'setItem',{phase,predicate:(_slot,item)=>item?.typeId===N+'raw_beef_skewer'});
  f.interact();
  assert.equal(f.p.main.typeId,N+'raw_beef_skewer');assert.equal(f.p.main.amount,3);
  assert.deepEqual([0,1,2].map(slot=>f.contents.getItem(slot)),[undefined,undefined,undefined]);
  assert.equal(f.drops.length,0);
 }finally{f.dispose();}
});
async function nativeSecretFixture(options={}){
 const f=createFixture(options);await f.load('main.js');f.startup();f.flush();
 const data=await f.load('core/persist.js'),snapshot=await f.load('skewer_item_snapshot.js');
 const config=await f.load('server_config_runtime.js');
 config.setGrillingConfig('enableEatingAnimations',false);config.setGrillingConfig('graphicalEatingHud',false);
 const p=f.player({location:{x:0,y:80,z:2}});
 for(const [kind,value] of [['hunger',4],['saturation',1]])p.components['minecraft:player.'+kind]={
  currentValue:value,effectiveMax:20,setCurrentValue(next){this.currentValue=next}
 };
 function secret(){
  const stack=f.item(N+'secret_skewer_native_plain',3);
  stack.nameTag='Saved secret';data.setItemLore(stack,[{translate:'foreign:secret',with:['kept']}]);
  data.setItemProperty(stack,secretIngredientsKey,JSON.stringify(plainSecretRows()));
  data.setItemProperty(stack,secretCookedKey,true);data.setItemProperty(stack,'foreign:owner','retained');
  return stack;
 }
 function admit(){return f.emit('world.beforeEvents.itemUse',{source:p,itemStack:p.main,cancel:false})}
 function start(){return f.emit('world.afterEvents.itemStartUse',{source:p,itemStack:p.main,useDuration:25})}
 function complete(stack=p.main){f.system.currentTick+=24;return f.emit('world.afterEvents.itemCompleteUse',{source:p,itemStack:stack,useDuration:0})}
 function rawItem(stack){return stack&&{id:stack.typeId,amount:stack.amount,name:stack.nameTag,lore:stack.getRawLore(),keepOnDeath:stack.keepOnDeath,lockMode:stack.lockMode}}
 function saved(){return {inventory:p.inventory.items().map(rawItem),world:f.snapshotProperties(),hunger:p.components['minecraft:player.hunger'].currentValue,saturation:p.components['minecraft:player.saturation'].currentValue}}
 function removeItemRecords(){for(const key of f.world.getDynamicPropertyIds())if(key.startsWith('senluo:grilling_item_'))f.world.setDynamicProperty(key,undefined)}
 return Object.assign(f,{data,snapshot,p,secret,admit,start,complete,saved,removeItemRecords});
}
async function newlyThreadedSecretFixture(animations=true){
 const f=await nativeSecretFixture(),config=await f.load('server_config_runtime.js');
 config.setGrillingConfig('enableEatingAnimations',animations);
 const ingredients=['minecraft:apple','minecraft:carrot','minecraft:bread'];
 f.p.off=f.item('minecraft:stick',3);
 for(const id of ingredients){
  f.p.main=f.item(id,4);
  assert.equal(f.admit().cancel,true);f.flush();assert.equal(f.p.main.amount,3);
 }
 assert.equal(f.p.off.typeId,N+'secret_skewer');assert.equal(f.p.off.amount,1);
 assert.deepEqual(JSON.parse(f.data.getItemProperty(f.p.off,secretIngredientsKey)).map(row=>row.id),ingredients);
 f.p.main=undefined;f.p.isSneaking=true;
 const block=f.block('minecraft:stone',{x:0,y:80,z:0});
 const disassemble=()=>f.emit('world.beforeEvents.playerInteractWithBlock',{block,player:f.p,itemStack:f.p.main,blockFace:'Up',isFirstEvent:true,cancel:false});
 const materialCounts=()=>{
  const counts={};
  for(const stack of [...f.p.inventory.items(),...f.drops.filter(drop=>drop.isValid).map(drop=>drop.itemStack)])if(stack)counts[stack.typeId]=(counts[stack.typeId]??0)+stack.amount;
  return counts;
 };
 return Object.assign(f,{disassemble,materialCounts});
}
for(const [animations,random] of [[true,.25],[true,.75],[false,.75]])test(`newly threaded Secret can be immediately disassembled with animations=${animations}, random=${random}`,async()=>{
 const f=await newlyThreadedSecretFixture(animations),originalRandom=Math.random;
 try{
  Math.random=()=>random;
  assert.equal(f.disassemble().cancel,true);f.flush();assert.equal(f.p.off?.typeId,undefined);
  assert.deepEqual(f.materialCounts(),{'minecraft:stick':3,'minecraft:apple':1,'minecraft:carrot':1,'minecraft:bread':1});
 }finally{Math.random=originalRandom;f.dispose()}
});
for(const changed of ['selected slot','main hand','offhand metadata'])test('pending Secret disassembly rejects changed '+changed+' and permits the next gesture',async()=>{
 const f=await newlyThreadedSecretFixture(),originalRandom=Math.random;
 try{
  Math.random=()=>.75;
  assert.equal(f.disassemble().cancel,true);
  if(changed==='selected slot')f.p.selectedSlotIndex=2;
  if(changed==='main hand')f.p.main=f.item('minecraft:carrot',4);
  if(changed==='offhand metadata'){const replacement=f.p.off;replacement.nameTag='Changed after admission';f.p.off=replacement;}
  const before=f.snapshot.captureSkewerMetadata(f.p.off),inventory=f.materialCounts();
  f.flush();assert.deepEqual(f.snapshot.captureSkewerMetadata(f.p.off),before);assert.deepEqual(f.materialCounts(),inventory);
  // Rejection must release presentation preparation and the next actual press.
  f.flush();assert.equal(f.p.off.typeId,N+'secret_skewer_java_three_alt');
  assert.equal(f.p.off.nameTag,before.name);
  assert.equal(f.disassemble().cancel,true);f.flush();assert.equal(f.p.off?.typeId,undefined);
  const expected={...inventory};for(const id of ['minecraft:stick','minecraft:apple','minecraft:carrot','minecraft:bread'])expected[id]=(expected[id]??0)+1;
  assert.deepEqual(f.materialCounts(),expected);
 }finally{Math.random=originalRandom;f.dispose()}
});
test('failed Secret disassembly releases presentation preparation and permits retry',async()=>{
 const f=await newlyThreadedSecretFixture(),originalRandom=Math.random;
 try{
  Math.random=()=>.75;
  f.faults.failNext(f.p.equipment,'setEquipment',{phase:'before',predicate:slot=>slot===f.EquipmentSlot.Offhand});
  const before=f.snapshot.captureSkewerMetadata(f.p.off),inventory=f.materialCounts();
  assert.equal(f.disassemble().cancel,true);f.flush();
  assert.equal(f.faults.pending.length,0);assert.deepEqual(f.snapshot.captureSkewerMetadata(f.p.off),before);assert.deepEqual(f.materialCounts(),inventory);
  f.flush();
  assert.equal(f.p.off.typeId,N+'secret_skewer_java_three_alt');
  assert.equal(f.disassemble().cancel,true);f.flush();assert.equal(f.p.off?.typeId,undefined);
  assert.deepEqual(f.materialCounts(),{'minecraft:stick':3,'minecraft:apple':1,'minecraft:carrot':1,'minecraft:bread':1});
 }finally{Math.random=originalRandom;f.dispose()}
});
for(const animations of [true,false])test('newly threaded Secret enters a lit grill immediately with animations='+animations,async()=>{
 const f=await newlyThreadedSecretFixture(animations),originalRandom=Math.random;
 try{
  const state=await f.load('grill/grill_state_adapter.js'),storage=await f.load('core/storage.js');
  const grill=f.block(N+'grill',{x:0,y:80,z:0});f.block('minecraft:stone',{x:0,y:79,z:0});
  const input=f.p.off;f.p.off=undefined;f.p.isSneaking=false;
  function interact(){return f.emit('world.beforeEvents.playerInteractWithBlock',{block:grill,player:f.p,itemStack:f.p.main,blockFace:'Up',isFirstEvent:true,cancel:false});}
  f.p.main=f.item('minecraft:flint_and_steel');assert.equal(interact().cancel,true);f.flush();
  assert.equal(state.readGrillState(grill).lit,true);
  f.p.main=input;Math.random=()=>.75;
  assert.equal(interact().cancel,true);f.flush();
  assert.equal(f.p.main?.typeId,undefined,'one raw Secret moves from the hand into the grill');
  const inserted=storage.stationContainer(grill).getItem(0);
  assert.equal(inserted.amount,1);assert.deepEqual(f.snapshot.captureSkewerMetadata(inserted),f.snapshot.captureSkewerMetadata(input));
  assert.equal(storage.stationContainer(grill).getItem(1),undefined);assert.equal(storage.stationContainer(grill).getItem(2),undefined);
 }finally{Math.random=originalRandom;f.dispose()}
});
test('one, two and three ingredient skewers traverse player callbacks through grilling, seasoning, extraction and release eating',async()=>{
 const f=await nativeSecretFixture(),originalRandom=Math.random;
 try{
  Math.random=()=>.25;
  const config=await f.load('server_config_runtime.js');config.setGrillingConfig('enableEatingAnimations',true);
  const state=await f.load('grill/grill_state_adapter.js'),storage=await f.load('core/storage.js');
  const oil=await f.load('oil/cookery_oil_pot_adapter.js'),food=await f.load('food/food_state_adapter.js');
  const ids=await f.load('eating_profile_ids.js');
  // Java recipe/profile data: fish ONE, fried egg TWO, meatball THREE_RANDOM.
  const recipes=[['minecraft:cod','fish',1,90],['kaleidoscope_cookery:fried_egg','fried_egg',2,90],['kaleidoscope_cookery:raw_meatball','meatball',3,100]];
  recipes.forEach(([input],slot)=>f.p.inventory.setItem(slot,f.item(input,4)));
  f.p.off=f.item('minecraft:stick',3);
  for(const [slot,[,name,count]] of recipes.entries()){
   f.p.selectedSlotIndex=slot;
   for(let n=0;n<count;n++){assert.equal(f.admit().cancel,true);f.flush();assert.equal(f.p.main.amount,3-n);}
   assert.equal(ids.canonicalFoodId(f.p.off.typeId),N+'raw_'+name+'_skewer');
   f.p.inventory.setItem(4+slot,f.p.off);f.p.off=undefined;
   if(slot<2){f.p.off=f.p.inventory.getItem(3);f.p.inventory.setItem(3,undefined);}
  }
  assert.deepEqual([0,1,2].map(slot=>f.p.inventory.getItem(slot).amount),[3,2,1]);
  assert.equal(f.p.inventory.getItem(3),undefined);
  const grill=f.block(N+'grill',{x:0,y:80,z:0});f.block('minecraft:stone',{x:0,y:79,z:0});
  function interact(){const event=f.emit('world.beforeEvents.playerInteractWithBlock',{block:grill,player:f.p,itemStack:f.p.main,blockFace:'Up',isFirstEvent:true,cancel:false});assert.equal(event.cancel,true);f.flush();}
  f.p.selectedSlotIndex=7;f.p.main=f.item('minecraft:flint_and_steel');interact();assert.equal(state.readGrillState(grill).lit,true);
  for(let slot=4;slot<=6;slot++){f.p.selectedSlotIndex=slot;interact();assert.equal(f.p.main,undefined);}
  const contents=storage.stationContainer(grill);assert.equal([0,1,2].filter(slot=>contents.getItem(slot)).length,3);
  // Host public oil payload and a prepared seasoning bottle are boundary inputs;
  // this scenario does not claim to have exercised Cookery oil production.
  f.p.selectedSlotIndex=8;f.p.main=oil.buildCookeryOilPot('canola',3);assert.ok(f.p.main);interact();
  assert.equal(oil.readCookeryOilPot(f.p.main).empty,true);assert.equal(f.p.main.amount,1);assert.equal(state.readGrillState(grill).phase,1);
  f.p.selectedSlotIndex=4;
  for(let flip=1;flip<=4;flip++){
   interact();assert.equal(state.readGrillState(grill).flips,flip);
   for(let tick=0;tick<20;tick++){f.tick();f.component(N+'grill_tick','onTick',{block:grill});}
  }
  assert.equal(state.readGrillState(grill).phase,2);
  interact();assert.equal([0,1,2].filter(slot=>contents.getItem(slot)).length,3,'unseasoned cooked skewers stay on the grill');
  f.p.selectedSlotIndex=9;f.p.main=f.item(N+'special_seasoning');
  const bottle=f.p.main;food.setFoodSeasonings(bottle,[N+'green_chili_powder',N+'sichuan_pepper',N+'onion_powder']);f.data.setItemProperty(bottle,N+'uses',13);f.p.main=bottle;
  interact();assert.equal(f.p.main.typeId,N+'empty_seasoning_bottle');assert.equal(f.p.main.amount,1);assert.equal(state.readGrillState(grill).seasoned,true);
  f.p.selectedSlotIndex=4;f.p.isSneaking=true;interact();f.p.isSneaking=false;
  assert.deepEqual([0,1,2].map(slot=>contents.getItem(slot)),[undefined,undefined,undefined]);
  assert.equal(state.readGrillState(grill).phase,0);
  const cookedSlots=recipes.map(([,name])=>f.p.inventory.items().findIndex(stack=>ids.canonicalFoodId(stack?.typeId)===N+'grilled_'+name+'_skewer'));
  assert.ok(cookedSlots.every(slot=>slot>=0));
  for(const [index,slot] of cookedSlots.entries()){
   f.p.selectedSlotIndex=slot;f.flush();const stack=f.p.main,duration=recipes[index][3];
   assert.equal(stack.amount,1);assert.equal(food.readFoodSeasonings(stack).length,3);
   f.p.components['minecraft:player.hunger'].currentValue=4;
   const beforeEffects=f.effects.length;
   assert.equal(f.admit().cancel,false);f.emit('world.afterEvents.itemStartUse',{source:f.p,itemStack:stack,useDuration:duration});
   f.tick(23);f.emit('world.afterEvents.itemStopUse',{source:f.p,itemStack:stack,useDuration:duration-23});f.flush();
   assert.equal(f.p.main.amount,1);assert.equal(f.p.components['minecraft:player.hunger'].currentValue,4);assert.equal(f.effects.length,beforeEffects);
   assert.equal(f.admit().cancel,false);f.emit('world.afterEvents.itemStartUse',{source:f.p,itemStack:stack,useDuration:duration});
   f.tick(25);f.emit('world.afterEvents.itemStopUse',{source:f.p,itemStack:stack,useDuration:duration-25});f.flush();
   assert.equal(f.p.main,undefined,'eligible release consumes exactly the held serving');
   assert.ok(f.p.components['minecraft:player.hunger'].currentValue>4);
   const settled=f.saved(),effects=f.effects.length;
   f.emit('world.afterEvents.itemCompleteUse',{source:f.p,itemStack:stack,useDuration:0});
   assert.deepEqual(f.saved(),settled);assert.equal(f.effects.length,effects);
  }
  assert.deepEqual([0,1,2].map(slot=>f.p.inventory.getItem(slot).amount),[3,2,1]);
  assert.equal(f.p.inventory.getItem(8).amount,1);assert.equal(f.p.inventory.getItem(9).typeId,N+'empty_seasoning_bottle');
 }finally{Math.random=originalRandom;f.dispose()}
});
for(const mode of ['malformed raw JSON','invalid cooked cache','missing world record'])test('native secret item use/start/complete refuses '+mode+' without spending or rewriting the item',async()=>{
 const f=await nativeSecretFixture();
 try{
  const stack=f.secret();
  if(mode==='malformed raw JSON')f.data.setItemProperty(stack,secretIngredientsKey,'{bad');
  if(mode==='invalid cooked cache')f.data.setItemProperty(stack,cookedIngredientsKey,'[{"id":"minecraft:apple"}]');
  f.p.main=stack;if(mode==='missing world record')f.removeItemRecords();
  const before=f.saved(),effects=f.effects.length,drops=f.drops.length;
  assert.equal(f.admit().cancel,true);
  // A later/stale host event is not permission to grant nutrition or effects.
  f.start();f.complete();
  assert.deepEqual(f.saved(),before);assert.equal(f.effects.length,effects);assert.equal(f.drops.length,drops);
 }finally{f.dispose()}
});
test('valid saved secret passes native admission and its matching completion grants nutrition once',async()=>{
 const f=await nativeSecretFixture();
 try{
  f.p.main=f.secret();const before=f.saved();
  assert.equal(f.admit().cancel,false);f.start();
  const consumed=f.p.main,remaining=f.p.main;remaining.amount--;f.p.main=remaining;
  f.complete(consumed);
  assert.equal(f.p.main.amount,2);assert.equal(f.p.components['minecraft:player.hunger'].currentValue,10);
  assert.equal(f.data.getItemProperty(f.p.main,'foreign:owner'),'retained');
  assert.deepEqual(f.p.main.getRawLore(),before.inventory[0].lore);assert.deepEqual(f.snapshotProperties(),before.world);
  const settled=f.saved(),effects=f.effects.length;f.complete(consumed);
  assert.deepEqual(f.saved(),settled);assert.equal(f.effects.length,effects);
 }finally{f.dispose()}
});
for(const mode of ['missing world record','corrupt world record'])test('native completion refuses '+mode+' introduced after a valid start',async()=>{
 const f=await nativeSecretFixture();
 try{
  f.p.main=f.secret();assert.equal(f.admit().cancel,false);f.start();
  if(mode==='missing world record')f.removeItemRecords();
  else for(const key of f.world.getDynamicPropertyIds())if(key.startsWith('senluo:grilling_item_'))f.world.setDynamicProperty(key,'{bad');
  const before=f.saved(),effects=f.effects.length;
  f.complete();assert.deepEqual(f.saved(),before);assert.equal(f.effects.length,effects);assert.equal(f.drops.length,0);
 }finally{f.dispose()}
});
async function fourthFlipFixture(options={}){
 const f=await nativeSecretFixture(options);
 const state=await f.load('grill/grill_state_adapter.js'),storage=await f.load('core/storage.js'),core=await f.load('core_logic.js');
 const grill=f.block(N+'grill',{x:0,y:80,z:0});f.block('minecraft:stone',{x:0,y:79,z:0});
 const inventory=storage.stationContainer(grill);
 f.world.setDynamicProperty(state.grillStateKey(grill),JSON.stringify({...core.initialState(),lit:true,phase:1,flips:3,heatTicks:1200}));
 function flip(){
  f.p.main=undefined;
  const event=f.emit('world.beforeEvents.playerInteractWithBlock',{block:grill,player:f.p,itemStack:undefined,blockFace:'Up',isFirstEvent:true,cancel:false});
  assert.equal(event.cancel,true);f.flush();return state.readGrillState(grill);
 }
 return Object.assign(f,{grill,grillInventory:inventory,grillState:state,flip});
}
test('native fourth flip preserves an existing cooked ingredient cache and its original metadata',async()=>{
 const f=await fourthFlipFixture();
 try{
  const stack=f.secret(),cached=plainSecretRows().map((row,index)=>({...row,name:'Previously cooked '+index,props:{'foreign:cache':index}}));
  f.data.setItemProperty(stack,secretCookedKey,false);f.data.setItemProperty(stack,cookedIngredientsKey,JSON.stringify(cached));
  f.grillInventory.setItem(0,stack);const before=f.snapshot.captureSkewerMetadata(stack),writeStart=f.writes.length;
  const state=f.flip(),after=f.grillInventory.getItem(0);
  assert.equal(state.phase,2);assert.equal(state.flips,4);
  assert.equal(f.data.getItemProperty(after,cookedIngredientsKey),JSON.stringify(cached));
  assert.deepEqual(f.snapshot.captureSkewerMetadata(after),before);
  assert.equal(f.writes.slice(writeStart).filter(write=>write.target===f.world&&write.method==='setDynamicProperty'&&write.args[0].startsWith('senluo:grilling_item_')).length,0,'cached ingredients are not recomputed or rewritten');
 }finally{f.dispose()}
});
test('native fourth flip creates the first cooked cache while retaining raw ingredients and ownership',async()=>{
 const f=await fourthFlipFixture();
 try{
  const stack=f.secret();f.data.setItemProperty(stack,secretCookedKey,false);f.grillInventory.setItem(0,stack);
  const raw=f.data.getItemProperty(stack,secretIngredientsKey),state=f.flip(),after=f.grillInventory.getItem(0);
  assert.equal(state.phase,2);assert.equal(state.flips,4);
  assert.deepEqual(JSON.parse(f.data.getItemProperty(after,cookedIngredientsKey)).map(row=>row.id),['minecraft:apple','minecraft:carrot','minecraft:cooked_beef']);
  assert.equal(f.data.getItemProperty(after,secretIngredientsKey),raw);assert.equal(f.data.getItemProperty(after,secretCookedKey),false);
  assert.equal(f.data.getItemProperty(after,'foreign:owner'),'retained');assert.equal(after.nameTag,stack.nameTag);
 }finally{f.dispose()}
});
for(const mode of ['unmapped','unavailable native result','nonfood result'])test('native fourth flip retains the original ingredient snapshot for '+mode,async()=>{
 const itemDefinitions={};
 if(mode==='unavailable native result')Object.defineProperty(itemDefinitions,'test:unavailable',{get(){throw Error('native item type unavailable')}});
 const f=await fourthFlipFixture({itemDefinitions});
 try{
  const compat=await f.load('secret_compat_core.js'),ingredient=f.item('test:raw');
  ingredient.nameTag='Original ingredient';f.data.setItemLore(ingredient,[{translate:'foreign:ingredient',with:['retained']}]);
  f.data.setItemProperty(ingredient,'foreign:marker','kept');
  const row={id:'test:raw',name:'Original ingredient',native:f.snapshot.captureSkewerMetadata(ingredient)};
  if(mode!=='unmapped')assert.equal(compat.registerSecretSmoking({input:row.id,output:mode==='nonfood result'?'minecraft:stone':'test:unavailable'}),true);
  const stack=f.secret(),rows=[row,...plainSecretRows().slice(0,2)];
  f.data.setItemProperty(stack,secretCookedKey,false);f.data.setItemProperty(stack,secretIngredientsKey,JSON.stringify(rows));
  f.grillInventory.setItem(0,stack);const state=f.flip(),after=f.grillInventory.getItem(0);
  assert.equal(state.phase,2);assert.equal(state.flips,4);
  assert.deepEqual(JSON.parse(f.data.getItemProperty(after,cookedIngredientsKey))[0],row);
  assert.equal(f.data.getItemProperty(after,secretIngredientsKey),JSON.stringify(rows));
 }finally{f.dispose()}
});
for(const field of [secretIngredientsKey,cookedIngredientsKey])test('native fourth flip rejects corrupt '+field+' before changing any grill slot or phase',async()=>{
 const f=await fourthFlipFixture();
 try{
  const first=f.secret(),second=f.secret();f.data.setItemProperty(first,secretCookedKey,false);f.data.setItemProperty(second,secretCookedKey,false);
  f.data.setItemProperty(second,field,'{bad');f.grillInventory.setItem(0,first);f.grillInventory.setItem(1,second);
  const before=f.grillInventory.items().map(stack=>stack&&f.snapshot.captureSkewerMetadata(stack)),stateBefore=f.grillState.readGrillState(f.grill);
  const state=f.flip();
  assert.deepEqual(state,stateBefore);assert.deepEqual(f.grillInventory.items().map(stack=>stack&&f.snapshot.captureSkewerMetadata(stack)),before);
  assert.equal(f.data.getItemProperty(f.grillInventory.getItem(1),field),'{bad');
  assert.equal(f.drops.length,0);
 }finally{f.dispose()}
});

const stageKey=cooked=>'tooltip.kaleidoscope_grilling.secret_skewer.'+(cooked?'cooked':'raw');
const stageLine=cooked=>({rawtext:[{text:cooked?'§r§6':'§r§8'},{translate:stageKey(cooked)},{text:'§r'}]});
function stageRows(f,stack){return f.data.getItemRawLore(stack).filter(line=>line?.rawtext?.[1]?.translate?.startsWith('tooltip.kaleidoscope_grilling.secret_skewer.'));}
test('Secret tooltip follows threading, cooking, cooling and reheating without changing ingredient order or variants',async()=>{
 const f=await nativeSecretFixture();
 const gui=await f.load('secret_gui_core.js');
 const labelsOf=stack=>f.data.getItemRawLore(stack).slice(0,4).map(line=>gui.secretGuiProgress(line)?.base??line);
 try{
  const ingredients=['minecraft:apple','minecraft:beef','minecraft:carrot'];f.p.off=f.item('minecraft:stick',1);
  for(const [index,id] of ingredients.entries()){
   const input=f.item(id,4);if(index===0)input.nameTag='Named apple';f.p.main=input;
   assert.equal(f.admit().cancel,true);f.flush();assert.equal(f.p.main.amount,3);
   assert.deepEqual(gui.secretGuiProgress(f.data.getItemRawLore(f.p.off)[0]).base.with,[String(index+1),'3']);
  }
  const food=await f.load('food/food_state_adapter.js'),state=await f.load('grill/grill_state_adapter.js'),storage=await f.load('core/storage.js');
  const variants=await f.load('secret_visual_state_core.js'),oil=await f.load('oil/cookery_oil_pot_adapter.js');
  const raw=f.p.off,rows=f.data.getItemProperty(raw,secretIngredientsKey),models=f.data.getItemProperty(raw,variants.SECRET_MODEL_VARIANTS_KEY);
  assert.deepEqual(stageRows(f,raw),[stageLine(false)]);
  const labels=labelsOf(raw);
  assert.deepEqual(labels[0].with,['3','3']);
  assert.deepEqual(labels.slice(1).map(line=>line.rawtext[0].with),[['1'],['2'],['3']]);
  assert.deepEqual(labels[1].rawtext[2],{text:'Named apple'});assert.deepEqual(JSON.parse(rows).map(row=>row.id),ingredients);
  f.p.off=undefined;f.p.isSneaking=false;
  const grill=f.block(N+'grill',{x:0,y:80,z:0});f.block('minecraft:stone',{x:0,y:79,z:0});
  const interact=()=>{const e=f.emit('world.beforeEvents.playerInteractWithBlock',{block:grill,player:f.p,itemStack:f.p.main,blockFace:'Up',isFirstEvent:true,cancel:false});assert.equal(e.cancel,true);f.flush();};
  f.p.main=f.item('minecraft:flint_and_steel');interact();f.p.main=raw;interact();
  f.p.main=oil.buildCookeryOilPot('canola',1);interact();f.p.main=undefined;
  for(let flip=0;flip<4;flip++){interact();for(let tick=0;tick<20;tick++){f.tick();f.component(N+'grill_tick','onTick',{block:grill});}}
  assert.equal(state.readGrillState(grill).phase,2);
  const bottle=f.item(N+'special_seasoning');food.setFoodSeasonings(bottle,[N+'green_chili_powder']);f.p.main=bottle;interact();
  f.p.main=undefined;f.p.isSneaking=true;interact();
  const cooked=f.p.inventory.items().find(stack=>stack?.typeId.startsWith(N+'secret_skewer'));assert.ok(cooked);
  assert.equal(cooked.amount,1);assert.equal(f.data.getItemProperty(cooked,secretCookedKey),true);
  assert.deepEqual(JSON.parse(f.data.getItemProperty(cooked,cookedIngredientsKey)).map(row=>row.id),['minecraft:apple','minecraft:cooked_beef','minecraft:carrot']);
  assert.equal(f.data.getItemProperty(cooked,secretIngredientsKey),rows);assert.equal(f.data.getItemProperty(cooked,variants.SECRET_MODEL_VARIANTS_KEY),models);
  assert.deepEqual(labelsOf(cooked),labels);assert.deepEqual(stageRows(f,cooked),[]);
  f.system.currentTick=food.hotUntil(cooked)+1;food.refreshHotLore(cooked);
  assert.equal(food.hotUntil(cooked),0);assert.deepEqual(stageRows(f,cooked),[stageLine(true)]);
  food.setHotFood(cooked,200);assert.deepEqual(stageRows(f,cooked),[]);
  assert.equal(f.data.getItemProperty(cooked,secretIngredientsKey),rows);assert.equal(f.data.getItemProperty(cooked,variants.SECRET_MODEL_VARIANTS_KEY),models);
  assert.equal(storage.stationContainer(grill).getItem(0),undefined);
 }finally{f.dispose()}
});
for(const cooked of [false,true])test('saved cold Secret tooltip restores once in a fresh world graph, cooked='+cooked,async()=>{
 const original=await nativeSecretFixture();let saved;
 try{const stack=original.secret();original.data.setItemProperty(stack,secretCookedKey,cooked);saved={id:stack.typeId,amount:stack.amount,nameTag:stack.nameTag,lore:stack.getRawLore(),world:original.snapshotProperties(),props:original.snapshot.captureSkewerMetadata(stack).props};}finally{original.dispose()}
 const f=await nativeSecretFixture({worldProperties:saved.world});
 try{
  f.p.main=f.item(saved.id,saved.amount,{nameTag:saved.nameTag,lore:saved.lore});
  f.emit('world.afterEvents.playerInventoryItemChange',{player:f.p,slot:0});f.tick();
  assert.deepEqual(stageRows(f,f.p.main),[stageLine(cooked)]);assert.equal(f.p.main.amount,3);assert.equal(f.p.main.nameTag,saved.nameTag);
  assert.deepEqual(f.snapshot.captureSkewerMetadata(f.p.main).props,saved.props);
  const before=f.p.main.getRawLore(),jobs=await f.load('hot_lore_runtime.js');
  f.emit('world.afterEvents.playerInventoryItemChange',{player:f.p,slot:0});f.tick();
  assert.deepEqual(f.p.main.getRawLore(),before);assert.equal(jobs.pendingHeatTooltipJobs(),0);
 }finally{f.dispose()}
});
test('Secret tooltip preserves full foreign lore and near-matching translated lines',async()=>{
 const f=await nativeSecretFixture();
 try{
  const food=await f.load('food/food_state_adapter.js'),near=stageLine(false);near.rawtext[1].with=['foreign'];
  const lore=[near,...Array.from({length:18},(_,i)=>({text:'Foreign '+i}))],stack=f.secret();f.data.setItemLore(stack,lore);
  const before=f.snapshot.captureSkewerMetadata(stack);food.refreshHotLore(stack);
  assert.deepEqual(f.snapshot.captureSkewerMetadata(stack),before);
  assert.equal(food.needsColdSecretTooltip(stack),false);
  f.p.off=stack;f.tick(100);const jobs=await f.load('hot_lore_runtime.js');assert.equal(jobs.pendingHeatTooltipJobs(),0);
 }finally{f.dispose()}
});
test('Secret tooltip background refresh waits for active eating in either hand',async()=>{
 const {createEatingLab,routes}=await import('../helpers/eating-lab.mjs');
 const lab=await createEatingLab();
 try{
  const route=routes.find(row=>row.base===N+'secret_skewer'&&row.kind==='base'),jobs=await lab.f.load('hot_lore_runtime.js');
  for(const hand of ['main','off']){
   const actor=lab.actor(route,hand),before=actor.p[hand].getRawLore();actor.begin();
   lab.f.emit('world.afterEvents.playerInventoryItemChange',{player:actor.p,slot:0});actor.advance(24);
   lab.assertUsing(actor);assert.deepEqual(actor.p[hand].getRawLore(),before);
   actor.event('itemStopUse',route.duration-24);actor.advance(25);
   assert.equal(actor.p[hand].amount,1);assert.deepEqual(stageRows({data:lab.data},actor.p[hand]),[stageLine(false)]);
   const start=lab.f.writes.length;lab.f.tick(100);
   assert.equal(jobs.pendingHeatTooltipJobs(),0);assert.equal(lab.f.writes.slice(start).filter(row=>row.method==='setEquipment').length,0);
   actor.retire();
  }
 }finally{lab.f.dispose()}
});
test('Secret tooltip background refresh does not invalidate pending disassembly',async()=>{
 const f=await newlyThreadedSecretFixture(false);
 try{
  const stack=f.p.off;f.data.setItemLore(stack,f.data.getItemRawLore(stack).filter(line=>line.rawtext?.[1]?.translate!==stageKey(false)));f.p.off=stack;
  // The existing twentieth-tick offhand scan admits the job before the hand
  // action. Both become due on the following tick, exercising their ordering.
  f.tick(20-f.system.currentTick%20);const jobs=await f.load('hot_lore_runtime.js');assert.ok(jobs.pendingHeatTooltipJobs()>0);
  assert.deepEqual(stageRows(f,f.p.off),[]);assert.equal(f.disassemble().cancel,true);f.tick();f.flush();
  assert.equal(f.p.off,undefined);assert.deepEqual(f.materialCounts(),{'minecraft:stick':3,'minecraft:apple':1,'minecraft:carrot':1,'minecraft:bread':1});
 }finally{f.dispose()}
});
test('Secret tooltip cooling reserves both public and private carriers before adding a badge',async()=>{
 const f=await nativeSecretFixture({currentTick:200});
 try{
  const food=await f.load('food/food_state_adapter.js'),api=await f.load('host_api/food_api_core.js');
  for(const count of [0,17,18]){
  const stack=f.secret(),lore=Array.from({length:count},(_,i)=>({text:'Foreign '+i}));
  f.data.setItemProperty(stack,food.HOT_UNTIL_KEY,100);f.data.setItemLore(stack,lore);
  api.writePublicFood(stack,{v:1,hotUntil:100,seasoning:[N+'onion_powder']});assert.equal(stack.getRawLore().length,count+2);
  const before=f.snapshot.captureSkewerMetadata(stack);food.refreshHotLore(stack);
  assert.equal(food.hotUntil(stack),0);assert.deepEqual(food.readFoodSeasonings(stack),[N+'onion_powder']);
  assert.deepEqual(f.data.getItemRawLore(stack).filter(line=>!api.isFoodPayloadLine(line)),count<18?[...lore,stageLine(true)]:lore);
  assert.deepEqual(f.snapshot.captureSkewerMetadata(stack).props,Object.fromEntries(Object.entries(before.props).filter(([key])=>key!==food.HOT_UNTIL_KEY)));
  assert.equal(stack.amount,3);assert.equal(stack.nameTag,before.name);assert.equal(food.needsColdSecretTooltip(stack),false);
  }
 }finally{f.dispose()}
});
