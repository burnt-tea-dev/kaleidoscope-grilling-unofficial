import test from 'node:test';
import assert from 'node:assert/strict';
import * as lore from '../../projects/grilling/gameplay_core/behavior_pack/scripts/bottle_lore_core.js';
import {seasoningLore} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/localized_lore_core.js';
const old=seasoningLore(undefined,3,{pending:true}),fresh=seasoningLore(undefined,8,{pending:true});

test('owned identification never strips mixed or unknown custom messages',()=>{
 const owned=old[0];for(const line of [{rawtext:[{text:'prefix'},owned]},{rawtext:[owned,{text:'suffix'}]},{translate:owned.translate,text:'custom'}, {rawtext:[owned],text:'custom'}, {rawtext:[{translate:owned.translate,with:{rawtext:[{translate:'custom.argument'}]}}]}])assert.equal(lore.isOwnedBottleLore(line),false);
 assert.equal(lore.isOwnedBottleLore({rawtext:[{rawtext:[owned]}]}),true);
});
test('semantic signatures preserve argument/line order, translation identity and unknown structure',()=>{
 const good=fresh;for(const bad of [[...fresh].reverse(),seasoningLore(undefined,7,{pending:true}),[{...fresh[0],translate:'other'},fresh[1]],[{...fresh[0],with:['8','7']},fresh[1]],[{rawtext:[fresh[0],{text:'extra'}]},fresh[1]]])assert.notEqual(lore.bottleLoreSignature(good),lore.bottleLoreSignature(bad));
 assert.equal(lore.bottleLoreSignature([{text:'x'}]),lore.bottleLoreSignature(['x']));assert.equal(lore.bottleLoreSignature([{rawtext:[fresh[0]]}]),lore.bottleLoreSignature([fresh[0]]));
});
test('mismatch diagnostics never contain custom text or metadata values',()=>{
 const message=lore.bottleLoreMismatch([{text:'private text'}],[{text:'private other'}]);assert.equal(message,'line 0 (object -> object)');assert.ok(!message.includes('private'));
});
test('argument order, unknown extra keys and literal values remain fail-closed',()=>{
 const translation={translate:'custom.key',with:['first','second']};assert.notEqual(lore.bottleLoreSignature([translation]),lore.bottleLoreSignature([{...translation,with:['second','first']}]));
 const extra={rawtext:[old[0]],unknown:'retained'};assert.equal(lore.isOwnedBottleLore(extra),false);assert.notEqual(lore.bottleLoreSignature([extra]),lore.bottleLoreSignature([{rawtext:[old[0]]}]));
 assert.equal(lore.bottleLoreSignature(['custom']),lore.bottleLoreSignature([{text:'custom'}]));assert.notEqual(lore.bottleLoreSignature(['custom']),lore.bottleLoreSignature([{text:'changed'}]));
});
test('empty and depth-limited wrappers stay unknown rather than becoming owned or equivalent',()=>{
 let within=old[0];for(let i=0;i<15;i++)within={rawtext:[within]};assert.equal(lore.isOwnedBottleLore(within),true);
 const deep={rawtext:[within]};assert.equal(lore.isOwnedBottleLore(deep),false);assert.notEqual(lore.bottleLoreSignature([deep]),lore.bottleLoreSignature([old[0]]));
 const empty={rawtext:[]};assert.equal(lore.isOwnedBottleLore(empty),false);assert.notEqual(lore.bottleLoreSignature([empty]),lore.bottleLoreSignature([{text:''}]));
});

// Registered pickup behavior uses the actual production itemData module.
import {createFixture} from '../helpers/minecraft-fixture.mjs';
// Exercise the registered interaction subscriber with production itemData. The
// SDK serialization variants model legal RawMessage getter shapes, not BDS.
function sdk(node,style){
 if(typeof node==='string')return {text:node};
 if(node.rawtext)return {rawtext:node.rawtext.map(n=>sdk(n,style))};
 if(node.translate){const out={};if(node.with!==undefined)out.with=style==='args'&&Array.isArray(node.with)?{rawtext:node.with.map(text=>({text}))}:structuredClone(node.with);out.translate=node.translate;return out;}
 return structuredClone(node);
}
async function bottleFixture(style,maxAmount=1){
 const f=createFixture();await f.load('main.js');
 const data=await f.load('itemData.js'),storage=await f.load('family_station_storage.js'),placed=await f.load('a2743_seasoning_block_adapter.js');
 const snapshots=await f.load('skewer_item_snapshot.js');
 const nativeSetLore=f.ItemStack.prototype.setLore;let fault,attempts=0;
 f.ItemStack.prototype.setLore=function(lines=[]){
  const refresh=fault&&lines.some(line=>lore.isOwnedBottleLore(line))&&lore.bottleLoreSignature(lines.filter(lore.isOwnedBottleLore))===lore.bottleLoreSignature(fresh);
  if(refresh){attempts++;if(fault==='throw')throw Error('native setLore refused');if(fault==='reject')return;}
  let raw=lines.map(line=>{const n=sdk(line,style);return style==='keys'||n.rawtext?n:{rawtext:[n]};});
  if(refresh&&fault==='dropCustom')raw.shift();
  if(refresh&&fault==='wrongCount'){const at=raw.findIndex(lore.isOwnedBottleLore);raw[at]=sdk(seasoningLore(undefined,7,{pending:true})[0],style);}
  if(refresh&&fault==='dropToken')raw=raw.filter(n=>!JSON.stringify(n).includes('§r§0§r§1§r§2'));
  return nativeSetLore.call(this,raw);
 };
 const stack=f.item('kaleidoscope_grilling:pending_seasoning_f8',1,{maxAmount,nameTag:'kept',keepOnDeath:true});
 data.setItemLore(stack,[{rawtext:[{text:'Custom secret '},{translate:'custom.key',with:['kept']}]},...old]);
 data.setItemProperty(stack,'test:retained','metadata');
 data.setItemProperty(stack,'kaleidoscope_grilling:seasonings',JSON.stringify(Array(8).fill('minecraft:redstone')));
 const player=f.player();
 function seed(item,x=0){
  const block=f.block('kaleidoscope_grilling:seasoning_bottle_1',{x,y:0,z:0});
  f.block('minecraft:stone',{x,y:-1,z:0});
  const inventory=storage.stationContainer(block);inventory.setItem(0,item);
  assert.equal(placed.writePlacedSeasoningStack(block,[{kind:'pending',ingredients:Array(8).fill('minecraft:redstone'),uses:0,variant:0}]),true);
  return {block,inventory};
 }
 function pickup(block){
  const event=f.emit('world.beforeEvents.playerInteractWithBlock',{player,block,itemStack:undefined,isFirstEvent:true,blockFace:'Up',cancel:false});
  assert.equal(event.cancel,true);f.tick();
 }
 return {f,data,stack,player,seed,pickup,snapshot:s=>snapshots.captureSkewerMetadata(s),setFault:value=>{fault=value;},attempts:()=>attempts};
}
// maxAmount=64 deliberately retains the legacy carrier-contract case; released
// bottle definitions are unstackable. Both paths execute actual itemData code.
for(const style of ['keys','wrapper','args'])for(const maxAmount of [1,64])test(style+' actual itemData pickup refresh preserves custom lore and metadata '+maxAmount,async t=>{
 const b=await bottleFixture(style,maxAmount);t.after(()=>b.f.dispose());
 const before=b.snapshot(b.stack),custom=b.data.getItemRawLore(b.stack)[0],station=b.seed(b.stack);
 b.pickup(station.block);const next=b.player.main;
 assert.ok(next,'bottle reached the empty hand');assert.equal(station.inventory.getItem(0),undefined);
 assert.equal(lore.bottleLoreSignature(b.data.getItemRawLore(next)),lore.bottleLoreSignature([custom,...fresh]));
 assert.equal(b.data.getItemRawLore(next).filter(lore.isOwnedBottleLore).length,2);
 assert.deepEqual(b.data.getItemRawLore(next)[0],custom);assert.equal(b.data.getItemProperty(next,'test:retained'),'metadata');
 assert.equal(next.nameTag,'kept');assert.equal(next.keepOnDeath,true);assert.deepEqual(b.snapshot(b.stack),before);
 b.player.main=undefined;const again=b.seed(next,4);b.pickup(again.block);
 assert.equal(b.data.getItemRawLore(b.player.main).filter(lore.isOwnedBottleLore).length,2);
 assert.equal(lore.bottleLoreSignature(b.data.getItemRawLore(b.player.main)),lore.bottleLoreSignature([custom,...fresh]));
});
for(const fault of ['throw','reject','dropCustom','wrongCount','dropToken'])test('failed '+fault+' bottle refresh retains native ownership without committing a damaged clone',async t=>{
 const b=await bottleFixture('wrapper',fault==='dropToken'?64:1);t.after(()=>b.f.dispose());
 const station=b.seed(b.stack),before=b.snapshot(station.inventory.getItem(0)),projection=b.f.snapshotProperties();
 b.setFault(fault);b.pickup(station.block);
 assert.ok(b.attempts()>0,'fault reached production lore refresh');
 assert.equal(b.player.main,undefined);assert.equal(b.f.drops.length,0);
 assert.equal(station.block.typeId,'kaleidoscope_grilling:seasoning_bottle_1');
 assert.deepEqual(b.snapshot(station.inventory.getItem(0)),before);
 assert.equal(b.data.getItemProperty(station.inventory.getItem(0),'test:retained'),'metadata');
 for(const [key,value] of Object.entries(projection))assert.equal(b.f.world.getDynamicProperty(key),value,'original persisted owner/projection remains');
 assert.ok(b.f.logs.some(row=>row.text.includes('[Grilling block action]')),'refusal surfaced through the registered event');
});

function bottleInteract(b,block){
 const event=b.f.emit('world.beforeEvents.playerInteractWithBlock',{player:b.player,block,itemStack:b.player.main,isFirstEvent:true,blockFace:'Up',cancel:false});
 assert.equal(event.cancel,true);b.f.tick();
}
function queueFreshBottle(b){
 const target=b.f.block('minecraft:air',{x:0,y:0,z:0});b.f.block('minecraft:stone',{x:0,y:-1,z:0});
 const event={player:b.player,block:target,face:'Up',permutationToPlace:b.f.BlockPermutation.resolve('kaleidoscope_grilling:seasoning_bottle_1'),cancel:false};
 b.f.component('senluo:grilling_bottle_place','beforeOnPlayerPlace',event);
 assert.equal(event.cancel,true);return target;
}
for(const hand of ['main','off'])test('registered '+hand+' bottle placement and pickup retain raw lore and stable metadata',async t=>{
 const b=await bottleFixture('wrapper');t.after(()=>b.f.dispose());b.f.startup();
 const custom=b.data.getItemRawLore(b.stack)[0];b.data.setItemLore(b.stack,[custom,...fresh]);
 b.player.isSneaking=true;b.player[hand]=b.stack;const before=b.snapshot(b.stack),target=queueFreshBottle(b);
 b.f.tick();assert.equal(b.player[hand],undefined);assert.equal(target.typeId,'kaleidoscope_grilling:seasoning_bottle_1');
 const storage=await b.f.load('family_station_storage.js'),inventory=storage.stationContainer(target);
 assert.deepEqual(b.snapshot(inventory.getItem(0)),before);assert.equal(inventory.getItem(0).amount,1);
 bottleInteract(b,target);assert.deepEqual(b.snapshot(b.player.main),before);assert.equal(b.player.main.amount,1);
 assert.equal(inventory.getItem(0),undefined);assert.equal(b.f.drops.length,0);
});

test('registered bottle placement refuses a changed source hand without restoring over the new item',async t=>{
 const b=await bottleFixture('wrapper');t.after(()=>b.f.dispose());b.f.startup();
 b.player.isSneaking=true;b.player.main=b.stack;
 const before=b.snapshot(b.stack),target=queueFreshBottle(b),foreign=b.f.item('minecraft:diamond',2,{nameTag:'Other transaction'});
 b.player.main=foreign;b.f.tick();
 assert.equal(target.typeId,'minecraft:air');assert.equal(b.player.main.typeId,foreign.typeId);assert.equal(b.player.main.amount,2);
 assert.deepEqual(b.snapshot(b.stack),before);assert.equal(b.f.drops.length,0);
});

async function seasoningGrillFixture(){
 const b=await bottleFixture('wrapper');
 const visual=await b.f.load('a2766_special_seasoning_visual_core.js'),state=await b.f.load('a2740_grill_state_adapter.js'),storage=await b.f.load('family_station_storage.js'),core=await b.f.load('core_logic.js');
 const grill=b.f.block('kaleidoscope_grilling:grill',{x:3,y:0,z:0}),inventory=storage.stationContainer(grill);
 inventory.setItem(0,b.f.item('kaleidoscope_grilling:raw_beef_skewer',1));
 const bottle=b.f.item(visual.specialSeasoningVisualId(4,0),1,{nameTag:'Special saved',keepOnDeath:true});
 b.data.setItemLore(bottle,[{translate:'foreign:bottle',with:['kept']},...seasoningLore(12,8)]);
 for(const [key,value] of [['kaleidoscope_grilling:uses',4],['kaleidoscope_grilling:variant',0],['kaleidoscope_grilling:seasonings',JSON.stringify(Array(8).fill('minecraft:redstone'))],['foreign:owner','retained']])b.data.setItemProperty(bottle,key,value);
 b.player.main=bottle;
 b.f.world.setDynamicProperty(state.grillStateKey(grill),JSON.stringify({...core.initialState(),lit:true,phase:2,flips:4,heatTicks:1200}));
 return {...b,grill,grillInventory:inventory,state};
}
test('registered grill seasoning spends exactly one use while preserving bottle ownership and custom lore',async t=>{
 const b=await seasoningGrillFixture();t.after(()=>b.f.dispose());
 bottleInteract(b,b.grill);
 assert.equal(b.data.getItemProperty(b.player.main,'kaleidoscope_grilling:uses'),5);
 assert.equal(b.data.getItemProperty(b.player.main,'foreign:owner'),'retained');assert.equal(b.player.main.nameTag,'Special saved');
 assert.equal(b.state.readGrillState(b.grill).seasoned,true);assert.equal(b.grillInventory.getItem(0).amount,1);
});
for(const phase of ['before','after'])test('registered seasoning rolls back a failed bottle debit '+phase+' the hand write',async t=>{
 const b=await seasoningGrillFixture();t.after(()=>b.f.dispose());
 const before=b.snapshot(b.player.main),stateBefore=b.state.readGrillState(b.grill),properties=b.f.snapshotProperties(),slotBefore=b.snapshot(b.grillInventory.getItem(0));
 let matches=0;
 b.f.faults.failNext(b.player.inventory,'setItem',{phase,predicate:slot=>{if(slot!==b.player.selectedSlotIndex)return false;matches++;return true;}});
 bottleInteract(b,b.grill);assert.equal(matches,1);assert.equal(b.f.faults.pending.length,0);
 assert.deepEqual(b.snapshot(b.player.main),before);assert.equal(b.player.main.amount,1);assert.deepEqual(b.state.readGrillState(b.grill),stateBefore);
 assert.deepEqual(b.snapshot(b.grillInventory.getItem(0)),slotBefore);
 for(const [key,value] of Object.entries(properties))assert.equal(b.f.world.getDynamicProperty(key),value);
 assert.equal(b.f.drops.length,0);
});
for(const phase of ['before','after'])test('registered seasoning retains its original bottle when the use-count metadata setter fails '+phase,async t=>{
 const b=await seasoningGrillFixture();t.after(()=>b.f.dispose());
 const before=b.snapshot(b.player.main),stateBefore=b.state.readGrillState(b.grill),properties=b.f.snapshotProperties();
 const clone=b.f.ItemStack.prototype.clone;let attempts=0;
 b.f.ItemStack.prototype.clone=function(){
  const out=clone.call(this),set=out.setDynamicProperty;
  out.setDynamicProperty=function(key,value){
   if(key==='kaleidoscope_grilling:uses'&&value===5){
    attempts++;if(phase==='after')set.call(this,key,value);
    throw Error('Injected use-count metadata failure');
   }
   return set.call(this,key,value);
  };
  return out;
 };
 bottleInteract(b,b.grill);assert.equal(attempts,1,'failure reached the decrement metadata setter');
 assert.deepEqual(b.snapshot(b.player.main),before);assert.deepEqual(b.state.readGrillState(b.grill),stateBefore);
 for(const [key,value] of Object.entries(properties))assert.equal(b.f.world.getDynamicProperty(key),value);
 assert.equal(b.f.drops.length,0);
});

test('failed seasoning debit must not roll back over a replacement owned by another transaction',async t=>{
 const b=await seasoningGrillFixture();t.after(()=>b.f.dispose());
 const foreign=b.f.item('minecraft:diamond',2,{nameTag:'Replacement owner'}),foreignSnapshot=b.snapshot(foreign);
 let replaced=false;
 b.f.faults.failNext(b.player.inventory,'setItem',{phase:'after',predicate:(slot,next)=>{
  if(slot!==b.player.selectedSlotIndex||b.data.getItemProperty(next,'kaleidoscope_grilling:uses')!==5)return false;
  // Simulate an external owner taking the slot at the failing native boundary.
  // Disarm this injector before the external write; the production rollback
  // remains fully active and must decide whether it still owns the slot.
  b.f.faults.clear();b.player.main=foreign;replaced=true;return true;
 }});
 bottleInteract(b,b.grill);assert.equal(replaced,true,'replacement occurred after the actual debit write');
 assert.equal(b.f.faults.pending.length,0);
 assert.deepEqual(b.snapshot(b.player.main),foreignSnapshot,'rollback must retain the replacement owner');
 assert.equal(b.player.main.amount,2);assert.equal(b.f.drops.length,0);
});

// The retained food-tooltip rules share this lore behavior suite.
test('food maxim lore preserves every translated and custom item message',async t=>{
 const f=createFixture();t.after(()=>f.dispose());
 const {MAXIM_ITEMS,foodMaximKey,isHeatLore,planMaximLore}=await f.load('a2769_food_tooltip_core.js');
const id='kaleidoscope_grilling:potato_beef_stew';
const custom={rawtext:[{text:'Custom '},{translate:'other:description',with:['x']}]};
await t.test('all eight translated foods have one canonical maxim',()=>{
 assert.equal(MAXIM_ITEMS.length,8);
 for(const name of MAXIM_ITEMS){
  const key='tooltip.kaleidoscope_grilling.'+name+'.maxim';
  assert.equal(foodMaximKey('kaleidoscope_grilling:'+name),key);
  const next=planMaximLore('kaleidoscope_grilling:'+name,[]);
  assert.deepEqual(next,[{rawtext:[{text:'§r§8§o'},{translate:key},{text:'§r'}]}]);
 }
});
await t.test('foreign/raw skewer items are unchanged',()=>{
 for(const other of ['minecraft:beef','kaleidoscope_grilling:raw_beef_skewer',undefined])
  assert.equal(planMaximLore(other,[custom]),undefined);
});
await t.test('localized user lore remains the same structured value',()=>{
 const original=[custom,{text:'§c🔥 煙火氣 1:00'},{translate:'another:addon'}];
 const before=JSON.stringify(original),next=planMaximLore(id,original);
 assert.deepEqual(next.slice(1),original);assert.equal(JSON.stringify(original),before);
});
await t.test('repeat application is idempotent (no inventory-event loop)',()=>{
 const next=planMaximLore(id,[custom]);
 assert.equal(planMaximLore(id,next),undefined);
});
await t.test('owned duplicate lines are removed without losing custom lines',()=>{
 const first=planMaximLore(id,[])[0];
 const next=planMaximLore(id,[first,custom,first]);
 assert.deepEqual(next,[first,custom]);
});
await t.test('retargeting a food replaces only the owned maxim',()=>{
 const previous=planMaximLore('kaleidoscope_grilling:pepper_honey',[custom]);
 const next=planMaximLore(id,previous);
 assert.equal(next[0].rawtext[1].translate,foodMaximKey(id));assert.deepEqual(next[1],custom);
});
await t.test('unrelated line containing a translation key is not discarded',()=>{
 const customMaxim={rawtext:[{text:'my prefix'},{translate:foodMaximKey(id)}]};
 const next=planMaximLore(id,[customMaxim]);assert.deepEqual(next[1],customMaxim);
});
await t.test('full lore is retained instead of truncating a user line',()=>{
 const full=Array.from({length:20},(_,i)=>({text:String(i)}));
 assert.equal(planMaximLore(id,full),undefined);assert.equal(full.length,20);
});
await t.test('19 existing lines can receive one maxim',()=>{
 const lines=Array.from({length:19},(_,i)=>({text:String(i)}));
 assert.equal(planMaximLore(id,lines).length,20);
});
await t.test('heat filtering recognizes string and RawMessage text only',()=>{
 assert.equal(isHeatLore('§c🔥 煙火氣 1:00'),true);
 assert.equal(isHeatLore({text:'§c🔥 煙火氣 1:00'}),true);
 assert.equal(isHeatLore(custom),false);
 assert.equal(isHeatLore({translate:'§c🔥:foreign'}),false);
 const next=planMaximLore(id,[custom,{text:'§c🔥 煙火氣 1:00'}]).filter(x=>!isHeatLore(x));
 assert.equal(next.length,2);assert.deepEqual(next[1],custom);
});
});

import fs from 'node:fs';
import {creatorLore} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/localized_lore_core.js';
test('runtime lore uses language keys rather than fixed language text',()=>{
 assert.equal(seasoningLore(16,8,{pending:true}).length,3);assert.equal(creatorLore('name').with[0],'name');
 for(const lang of ['en_US','zh_TW','zh_CN']){const text=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/resource_pack/texts/'+lang+'.lang',import.meta.url),'utf8');for(const line of [...seasoningLore(1,2,{missingBase:true}),creatorLore('name')])assert(text.includes(line.translate+'='));}
});
