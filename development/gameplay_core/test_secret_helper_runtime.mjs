import * as failureSkewers from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_visual_core.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {secretVisualState,partialVisualState} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state.js';
import {secretVisualIndex} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/integration_registry_core.js';
import {isBottleHeldVisualItem} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/bottle_held_visual_core.js';
import {captureEatingIdentity,eatingStillCurrent} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_eating_transaction.js';

const file=new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_held_runtime.js',import.meta.url);
const source=readFileSync(file,'utf8').replace(/^import .*;\n/gm,'').replaceAll('export function ','function ');
const shared=name=>readFileSync(new URL(name,file),'utf8').replace(/^import .*;\n/gm,'').replace(/\bexport (?=(const|function))/g,'');
const raw=[{id:'minecraft:apple'},{id:'minecraft:carrot'},{id:'minecraft:beef',name:'Original raw snapshot',props:{foreign:7}}];
const cooked=[{id:'minecraft:apple'},{id:'minecraft:carrot'},{id:'minecraft:cooked_beef'}];
const serving=(id='kaleidoscope_grilling:secret_skewer',amount=1)=>({typeId:id,amount,raw:structuredClone(raw),cooked:structuredClone(cooked),creator:'Preserved creator',maxAmount:1,getDynamicProperty(){return undefined}});
function fixture(main,off){
 const held={main,off},properties={},writes=[];
 const callbacks={},events=Object.fromEntries(['playerInventoryItemChange','playerHotbarSelectedSlotChange','playerSpawn','playerLeave'].map(name=>[name,{subscribe:f=>callbacks[name]=f}]));
 const player={id:'owner',selectedSlotIndex:3,setProperty(k,v){properties[k]=v;writes.push([k,v]);}};
 const context={...failureSkewers,canonicalFoodId,isBottleHeldVisualItem,secretVisualIndex,secretVisualState,partialVisualState,eatingStillCurrent,isCreative:()=>!!held.creative,getMainHand:()=>held.main,getOffHand:()=>held.off,world:{afterEvents:events,getAllPlayers:()=>[player]},system:{currentTick:100,run:f=>f(),runInterval(){}},console};
 vm.runInNewContext(shared('slime_frame_core.js')+'\n'+shared('held_visual_transport.js')+'\n'+shared('held_visual_dispatch_runtime.js')+'\n'+source+'\nthis.api={configureSecretHeldReader,syncSecretHeld};',context);
 const api=context.api;api.configureSecretHeldReader(s=>s.cooked,s=>s.raw);
 return {api,player,held,properties,writes,callbacks};
}
test('effective cooked main slots and original raw last helper are separate read-only indices',()=>{
 const item=serving(),before=JSON.stringify(item),f=fixture(item);f.api.syncSecretHeld(f.player);
 assert.equal(f.properties['kaleidoscope_grilling:secret_main_2'],secretVisualIndex('minecraft:cooked_beef'));
 assert.equal(f.properties['kaleidoscope_grilling:secret_main_piece'],secretVisualIndex('minecraft:beef'));
 assert.equal(JSON.stringify(item),before);const written=f.writes.length;
 f.api.syncSecretHeld(f.player);assert.equal(f.writes.length,written);
});
test('canonical and ALT resolve both owning hands without selecting visual-bite rows',()=>{
 const main=serving('kaleidoscope_grilling:secret_skewer_java_three_alt'),off=serving();off.raw[2]={id:'minecraft:potato'};
 const f=fixture(main,off);f.api.syncSecretHeld(f.player);
 assert.equal(f.properties['kaleidoscope_grilling:secret_main_piece'],secretVisualIndex('minecraft:beef'));
 assert.equal(f.properties['kaleidoscope_grilling:secret_off_piece'],secretVisualIndex('minecraft:potato'));
 for(const stage of [0,1,2,3]){main.biteStage=stage;f.api.syncSecretHeld(f.player);assert.equal(f.properties['kaleidoscope_grilling:secret_main_piece'],secretVisualIndex('minecraft:beef'));}
});
test('missing raw reader fails closed instead of borrowing cooked helper food',()=>{
 const f=fixture(serving());f.api.configureSecretHeldReader(s=>s.cooked);f.api.syncSecretHeld(f.player);
 assert.equal(f.properties['kaleidoscope_grilling:secret_main_piece'],0);
 assert.equal(f.properties['kaleidoscope_grilling:secret_main_2'],secretVisualIndex('minecraft:cooked_beef'));
});
test('raw-last-only change refreshes the visual signature while cooked slots remain intact',()=>{
 const f=fixture(serving());f.api.syncSecretHeld(f.player);const n=f.writes.length;
 f.held.main.raw[2]={id:'minecraft:porkchop'};f.api.syncSecretHeld(f.player);
 assert.ok(f.writes.length>n);assert.equal(f.properties['kaleidoscope_grilling:secret_main_piece'],secretVisualIndex('minecraft:porkchop'));
 assert.equal(f.properties['kaleidoscope_grilling:secret_main_2'],secretVisualIndex('minecraft:cooked_beef'));
});
test('post-debit empty hand clears every owner mesh index; retained/new serving stays visible',()=>{
 const item=serving(undefined,2),f=fixture(item);f.api.syncSecretHeld(f.player);
 f.held.main=undefined;f.api.syncSecretHeld(f.player);assert.equal(Object.values(f.properties).every(x=>x===0),true);
 f.held.main=serving(undefined,1);f.api.syncSecretHeld(f.player);
 assert.equal(f.properties['kaleidoscope_grilling:secret_main_0'],secretVisualIndex('minecraft:apple'));
 assert.equal(f.properties['kaleidoscope_grilling:secret_main_piece'],secretVisualIndex('minecraft:beef'));
});
test('completion sync precedes presentation reset and release sync follows unchanged settlement',()=>{
 const main=readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/main.js',import.meta.url),'utf8');
 const complete=main.slice(main.indexOf('world.afterEvents.itemCompleteUse.subscribe'),main.indexOf('world.afterEvents.itemStopUse.subscribe'));
 assert.ok(complete.indexOf('syncSecretHeld(e.source,{completedUse:a.use})')<complete.indexOf('setProperty(EAT_PROFILE_PROPERTY,0)'));
 const stop=main.slice(main.indexOf('world.afterEvents.itemStopUse.subscribe'),main.indexOf('// Native use poses cancel'));
 assert.ok(stop.indexOf('hungerSettle(e.source,a.id,a)')<stop.indexOf('syncSecretHeld(e.source)'));
 assert.ok(main.includes('configureSecretHeldReader(readEffectiveSkewerRows,readSkewerRows)'));
});

test('confirmed completed single serving stays visually empty while its exact old snapshot lingers',()=>{
 for(const hand of ['main','off']){
  const item=serving(),other=serving();other.creator='Opposite hand';
  const f=fixture(hand==='main'?item:other,hand==='off'?item:other),use=captureEatingIdentity(item,hand,3);
  f.api.syncSecretHeld(f.player);f.api.syncSecretHeld(f.player,{completedUse:use});
  const rows=()=>['0','1','2','piece'].map(s=>f.properties[`kaleidoscope_grilling:secret_${hand}_${s}`]);
  assert.deepEqual(rows(),[0,0,0,0]);f.api.syncSecretHeld(f.player);assert.deepEqual(rows(),[0,0,0,0]);
  assert.ok(f.properties[`kaleidoscope_grilling:secret_${hand==='main'?'off':'main'}_0`]>0);
  assert.equal(item.amount,1);assert.deepEqual(item.raw,raw);
 }
});
test('pre-checkpoint interruption, creative and retained count never suppress a serving',()=>{
 for(const kind of ['interrupted','creative','retained']){
  const item=serving(undefined,kind==='retained'?2:1),f=fixture(item);f.held.creative=kind==='creative';
  f.api.syncSecretHeld(f.player,{beginHand:'main'});
  f.api.syncSecretHeld(f.player,kind==='interrupted'?{}:{completedUse:captureEatingIdentity(item,'main',3)});
  assert.ok(f.properties['kaleidoscope_grilling:secret_main_0']>0);
 }
});
test('replacement, fresh use, hotbar switch and rejoin release completion ownership',()=>{
 for(const reset of ['replacement','fresh-use','inventory-identical','hotbar','rejoin']){
  const item=serving(),f=fixture(item),use=captureEatingIdentity(item,'main',3);
  f.api.syncSecretHeld(f.player,{completedUse:use});
  assert.equal(f.properties['kaleidoscope_grilling:secret_main_0'],0);
  if(reset==='replacement')f.held.main={...serving(),nameTag:'Fresh distinct serving'};
  if(reset==='fresh-use')f.api.syncSecretHeld(f.player,{beginHand:'main'});
  if(reset==='inventory-identical')f.callbacks.playerInventoryItemChange({player:f.player});
  if(reset==='hotbar')f.callbacks.playerHotbarSelectedSlotChange({player:f.player});
  if(reset==='rejoin')f.callbacks.playerLeave({playerId:f.player.id});
  f.api.syncSecretHeld(f.player);assert.ok(f.properties['kaleidoscope_grilling:secret_main_0']>0,reset);
 }
 const item=serving(),f=fixture(item);
 f.player.selectedSlotIndex=4;
 f.api.syncSecretHeld(f.player,{completedUse:captureEatingIdentity(item,'main',3)});
 assert.ok(f.properties['kaleidoscope_grilling:secret_main_0']>0,'another main slot must never be suppressed');
});
