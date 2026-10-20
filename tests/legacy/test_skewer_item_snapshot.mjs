/** Stable ItemStack API doubles, not simulated Minecraft players. */
import test from 'node:test';import assert from 'node:assert/strict';
import {captureSkewerMetadata,restoreSkewerMetadata,metadataSignature} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js';
import {configureItemDataWorld,setItemProperty,getItemProperty,setItemLore,getItemRawLore} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/itemDataCore.js';
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
const {secretFood}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js');
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
async function nativeSecretFixture(options={}){
 const f=createFixture(options);await f.load('main.js');f.startup();f.flush();
 const data=await f.load('itemData.js'),snapshot=await f.load('skewer_item_snapshot.js');
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
 const state=await f.load('a2740_grill_state_adapter.js'),storage=await f.load('family_station_storage.js'),core=await f.load('core_logic.js');
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
