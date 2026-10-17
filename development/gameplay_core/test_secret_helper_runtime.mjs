import * as failureSkewers from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_visual_core.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalFoodId,eatingItemId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {secretVisualState,partialVisualState} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state.js';
import {secretVisualIndex} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/integration_registry_core.js';
import {secretHeldMarker,SECRET_FOOD_COUNT} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state_core.js';
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
 const context={...failureSkewers,canonicalFoodId,isBottleHeldVisualItem,secretVisualIndex,secretHeldMarker,secretVisualState,partialVisualState,eatingStillCurrent,isCreative:()=>!!held.creative,getMainHand:()=>held.main,getOffHand:()=>held.off,world:{afterEvents:events,getAllPlayers:()=>[player]},system:{currentTick:100,run:f=>f(),runInterval(){}},console};
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
test('animation-off serving reaches real ingredient passes in both views/hands without a Java helper',()=>{
 const resource=new URL('../../resource_pack/',file),read=path=>JSON.parse(readFileSync(new URL(path,resource),'utf8'));
 const description=read('attachables/secret_skewer_native_plain.attachable.json')['minecraft:attachable'].description;
 const controllers=read('render_controllers/secret_held.render_controllers.json').render_controllers;
 const geometries=new Map(read('models/entity/secret_held.geo.json')['minecraft:geometry'].map(g=>[g.description.identifier,g]));
 assert.equal(description.identifier,eatingItemId('kaleidoscope_grilling:secret_skewer',false,false));
 assert.deepEqual(description.render_controllers,['controller.render.kg_secret_held.stick',...Array.from({length:3},(_,i)=>'controller.render.kg_secret_held.'+i)]);
 assert.ok(!JSON.stringify(description.scripts).includes('eat_profile'));
 assert.ok(!JSON.stringify(description.scripts).includes('kg_secret_piece'));
 assert.ok(!Object.keys(description.geometry).some(key=>key==='java_secret_piece'||key.startsWith('piece_')));
 const evaluate=(expression,v)=>new Function('v','return '+expression)(v);
 for(const hand of ['main','off'])for(const cookedState of [false,true]){
  const item=serving(description.identifier),other=serving();
  const data={'kaleidoscope_grilling:model_variants':'[4,5,9]','kaleidoscope_grilling:secret_cooked':cookedState,
   'kaleidoscope_grilling:secret_cooked_ingredients':JSON.stringify(item.cooked)};
  item.getDynamicProperty=key=>data[key];
  const f=fixture(hand==='main'?item:other,hand==='off'?item:other);
  f.api.configureSecretHeldReader((s,cooked)=>cooked?s.cooked:s.raw,s=>s.raw);f.api.syncSecretHeld(f.player);
  const before=JSON.stringify(item),slot=hand+'_hand',weapon='slot.weapon.'+(hand==='main'?'mainhand':'offhand');
  const owner={has_property:key=>Object.hasOwn(f.properties,key),property:key=>f.properties[key],is_item_name_any:(selected,...ids)=>selected===weapon&&ids.includes(f.held[hand].typeId)};
  const program=description.scripts.pre_animation.join('\n').replaceAll('c.owning_entity->q.','owner.');
  const decode=new Function('c','owner','math','v',program),math={floor:Math.floor,clamp:(n,a,b)=>Math.max(a,Math.min(b,n))};
  for(const first of [0,1])for(const using of [false,true]){
   const c={item_slot:slot,is_first_person:first},v={};decode(c,owner,math,v);
   assert.equal(Boolean(v.kg_secret_owner_occupied),true);assert.equal(v.kg_bite_stage,0);
   assert.equal(v.kg_secret_state,27);
   assert.deepEqual([0,1,2].map(i=>v['kg_secret_food_'+i]),(cookedState?item.cooked:item.raw).map(row=>secretVisualIndex(row.id)));
   const active=description.scripts.animate.flatMap(row=>Object.entries(row).filter(([,expression])=>new Function('c','q','return '+expression)(c,{is_using_item:using})).map(([alias])=>alias));
   assert.deepEqual(active,[(first?'fp_':'tp_')+(hand==='main'?'right':'left')]);
   for(let i=0;i<3;i++){
    const controller=controllers['controller.render.kg_secret_held.'+i];
    assert.equal(Boolean(evaluate(controller.part_visibility[1].skewer_model,v)),true);
    const geometry=controller.arrays.geometries['Array.states'][v.kg_secret_state].split('.')[1];
    assert.ok(geometries.get(description.geometry[geometry]).bones.some(bone=>bone.cubes?.length));
    const texture=controller.arrays.textures['Array.food'][v['kg_secret_food_'+i]+v['kg_secret_style_'+i]*(SECRET_FOOD_COUNT+1)].split('.')[1];
    assert.equal(description.textures[texture],`textures/secret_food_palette/food_${v['kg_secret_food_'+i]}_${cookedState?6:0}`);
   }
  }
  assert.equal(JSON.stringify(item),before);
  // Reattaching on an animation-setting toggle must retain the same bank, but
  // the old plain owner must hide until that exact alias is equipped again.
  const bank=JSON.stringify(f.properties);
  for(const animations of [true,false]){
   f.held[hand].typeId=eatingItemId('kaleidoscope_grilling:secret_skewer',true,animations);f.api.syncSecretHeld(f.player);
   assert.equal(JSON.stringify(f.properties),bank);
   const v={};decode({item_slot:slot},owner,math,v);assert.equal(Boolean(v.kg_secret_owner_occupied),!animations);
  }
 }
});
test('Cookery 1.6.1 food writers use escaped helper owners in both hands without changing stack data',()=>{
 const ids=['tea_egg','butter_tea','clay_pot_milk_tea','mystery_tea'].map(name=>'kaleidoscope_cookery:'+name);
 for(const hand of ['main','off'])for(const [ordinal,id]of ids.entries())for(const alias of ['secret_skewer','secret_skewer_java_three_alt','secret_skewer_native_plain','unfinished_skewer']){
  const item=serving('kaleidoscope_grilling:'+alias),other=serving();
  item.raw=Array.from({length:alias==='unfinished_skewer'?2:3},()=>({id,native:{version:1,id,amount:1,props:{'foreign:preserved':17}}}));item.cooked=structuredClone(item.raw);
  const before=JSON.stringify(item),f=fixture(hand==='main'?item:other,hand==='off'?item:other);f.api.syncSecretHeld(f.player);
  assert.equal(f.properties['kaleidoscope_grilling:secret_'+hand+'_piece'],alias==='unfinished_skewer'?0:221+ordinal);
  assert.equal(f.properties['kaleidoscope_grilling:secret_'+hand+'_0']%256,214+ordinal);
  assert.equal(f.properties['kaleidoscope_grilling:secret_'+(hand==='main'?'off':'main')+'_piece'],secretVisualIndex('minecraft:beef'));
  assert.equal(JSON.stringify(item),before);
 }
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
