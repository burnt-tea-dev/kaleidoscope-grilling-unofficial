import {admitEatingProjection,selectEatingProjection} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_projection_routes.js';
import {PLATE_SPECIAL_HELD_START} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_special_visual_data.js';
/** Combined production modules/subscribers with native API doubles. No native Minecraft client or visual acceptance is claimed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as failure from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_visual_core.js';
import * as projection from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_projection.js';
import * as slime from '../../projects/grilling/gameplay_core/behavior_pack/scripts/slime_frame_core.js';
import * as presentation from '../../projects/grilling/gameplay_core/behavior_pack/scripts/player_presentation_core.js';
import * as profiles from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import * as transaction from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_eating_transaction.js';
import * as bottle from '../../projects/grilling/gameplay_core/behavior_pack/scripts/bottle_held_visual_core.js';
import * as seasonings from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2743_seasoning_contract_core.js';
import * as rawOne from '../../projects/grilling/gameplay_core/behavior_pack/scripts/raw_one_projection.js';
import * as reviewed from '../../projects/grilling/gameplay_core/behavior_pack/scripts/review_three_projection.js';
import {supportsJavaEatingProjection} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_projection_items.js';
import {FOOD_DATA,PROFILE_BY_ITEM} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_data_lookup.js';
import {getItemProperty} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/itemDataCore.js';
import {secretVisualState,partialVisualState} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state.js';
import {secretVisualIndex} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/integration_registry_core.js';
import {plateHeldVisualPlan} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_held_visual_core.js';
import {decodePlateStorage} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_transaction_core.js';
import {PLATE_ID,PLATE_SKEWERS_KEY} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a25_plate_recipe_core.js';
const N='kaleidoscope_grilling:',root=new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/',import.meta.url);
const source=readFileSync(new URL('main.js',root),'utf8');
function section(from,to){const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,from);return source.slice(a,b)}
function body(name){return readFileSync(new URL(name,root),'utf8').replace(/^import .*;\n/gm,'').replace(/^export \{.*\} from .*;\n/gm,'').replace(/\bexport (?=(const|function))/g,'')}
function stack(typeId,props={}){return {typeId,amount:1,maxAmount:1,nameTag:'Original serving',raw:[{id:'minecraft:beef'}],cooked:[{id:'minecraft:cooked_beef'}],props,getDynamicProperty:k=>props[k],getDynamicPropertyIds:()=>Object.keys(props),getLore:()=>[],getRawLore:()=>[]}}
function items(){return {slime:stack(slime.SLIME_ID),failure:stack(failure.FAILURE_IDS[0],{[failure.FAILED_SOURCE_KEY]:N+'raw_beef_skewer',[N+'model_variants']:'[1,2,3]'}),secret:stack(N+'secret_skewer'),bottle:stack(seasonings.EMPTY_BOTTLE_ID,{[seasonings.SEASONING_LIST_KEY]:JSON.stringify(seasonings.BASE_SEASONINGS)}),plate:stack(PLATE_ID,{[PLATE_SKEWERS_KEY]:JSON.stringify([{id:N+'raw_fish_skewer'}])}),empty:undefined}}
function fixture(){
 const held={},values=new Map(),writes=[],animations=[],queue=[],callbacks={},intervals=[],commits=[],settlements=[],warnings=[];let fail;
 const player={id:'combined-holder',selectedSlotIndex:3,getComponent(){},addEffect(){},setProperty(k,v){writes.push([k,v]);if(fail?.(k,v))throw Error('injected native property failure');values.set(k,v)},playAnimation:(name,options)=>animations.push({name,options})};
 const ctx={admitEatingProjection,selectEatingProjection,...failure,...projection,...slime,...presentation,...profiles,...transaction,...bottle,...seasonings,...rawOne,...reviewed,supportsJavaEatingProjection,FOOD_DATA,PROFILE_BY_ITEM,getItemProperty,secretVisualState,partialVisualState,secretVisualIndex,plateHeldVisualPlan,decodePlateStorage,PLATE_ID,PLATE_SKEWERS_KEY,PLATE_SPECIAL_HELD_START,
  world:{getAbsoluteTime:()=>1000000009,getAllPlayers:()=>[player],afterEvents:Object.fromEntries(['playerInventoryItemChange','playerHotbarSelectedSlotChange','playerSpawn','playerLeave','itemStartUse','itemCompleteUse','itemStopUse'].map(k=>[k,{subscribe:f=>(callbacks[k]??=[]).push(f)}]))},
  system:{currentTick:100,run:f=>queue.push(f),runInterval:(f,n)=>intervals.push({f,n})},console:{warn:x=>warnings.push(x)},getMainHand:()=>held.main,getOffHand:()=>held.off,isCreative:()=>false,
  ACTIVE_EATS:new Map(),SETTLED:new Map(),PLATE_EATS:new Map(),PENDING_USES:new Map(),CUISINE_EATS:new Map(),CUISINE_FOOD_SET:new Set(),SECRET_ID:N+'secret_skewer',MYSTERIOUS_ID:failure.FAILURE_IDS[0],DARK_ID:failure.FAILURE_IDS[1],RAW_NAUSEA:{},
  captureInteractionIntent:()=>({hand:held.useHand??'main'}),stackMeta:()=>({hot:false}),stopSoundHandle(){},grillingConfig:()=>({graphicalEatingHud:false}),heldByHand:(_p,h)=>held[h],startEatingSound(){},stopEatSound(){},hideJavaEatingHud(){},forgetEatingItem(){},now:()=>ctx.system.currentTick,hungerSettle:()=>{settlements.push('settled');return true},cuisineUseEventMatches:()=>false,dangerousPreservation(){},finishedFoodMeta:m=>m,afterCommitted:(...a)=>commits.push(a),addSecretNutrition(){},secretRemainders(){}};
 vm.runInNewContext(['held_visual_transport.js','held_visual_dispatch_runtime.js','secret_held_runtime.js','bottle_held_visual_runtime.js','plate_held_visual_runtime.js','slime_frame_runtime.js'].map(body).join('\n')+'\nthis.api={configureSecretHeldReader,syncSecretHeld,syncBottleHeld,syncPlateHeld,syncSlimeHeld,writeHeldVisual,heldVisualPropertyNames,forgetHeldVisual};',ctx);
 ctx.api.configureSecretHeldReader(s=>s.cooked,s=>s.raw);
 const constants=source.match(/const MINIMUM_EAT_TICKS=\d+,RELEASE_CHECKPOINT_GRACE_TICKS=\d+;/)[0]+'\n'+source.match(/const BITE_TIMES=Object.freeze\(\{[\s\S]*?\}\);/)[0];
 const selected=readFileSync(new URL('eating_item_runtime.js',root),'utf8').match(/export function selectedEatingProfile[^\n]+/)[0].replace(/^export /,'');
 vm.runInNewContext(constants+'\n'+selected+'\n'+section('function resolvedProfile(','function writeUseHand(')+'\n'+section('world.afterEvents.itemStartUse.subscribe(e=>{','// Native use poses cancel'),ctx);
 const emit=(name,event={})=>{for(const cb of callbacks[name]??[])cb({source:player,player,...event})};
 const flush=()=>{while(queue.length)queue.shift()()};
 const sync=()=>{emit('playerInventoryItemChange');flush();ctx.api.syncSlimeHeld(player,slime.readSlimeWorldFrame(ctx.world))};
 const read=hand=>Array.from(ctx.api.heldVisualPropertyNames(hand),k=>values.get(k));
 const start=(item,hand='main',duration=100)=>{held[hand]=item;held.useHand=hand;emit('itemStartUse',{itemStack:item,useDuration:duration})};
 return {ctx,held,values,writes,animations,queue,callbacks,intervals,commits,settlements,warnings,player,emit,flush,sync,read,start,fail:f=>fail=f};
}
for(const hand of ['main','off'])test(`combined providers: all directed cross-kind transitions, ${hand}`,()=>{
 const f=fixture(),all=items(),other=hand==='main'?'off':'main';f.held[other]=all.failure;f.sync();const untouched=f.read(other);
 for(const from of Object.keys(all))for(const to of Object.keys(all)){
  f.held[hand]=all[from];f.sync();const before=JSON.stringify(all);f.writes.length=0;f.held[hand]=all[to];f.sync();
  const actual=f.read(hand);assert.deepEqual(f.read(other),untouched,`${from}->${to} other hand`);assert.equal(JSON.stringify(all),before,'presentation must not mutate items');
  const marker={slime:217,failure:220,secret:secretVisualIndex('minecraft:beef'),bottle:214,plate:255,empty:0}[to];assert.equal(actual[11],marker,`${from}->${to}`);
  if(to==='slime'||to==='empty')assert.deepEqual(actual.slice(0,11),Array(11).fill(0));
  if(to==='failure')assert.deepEqual(actual.slice(3,11),Array(8).fill(0));
  if(from!==to){const keys=f.ctx.api.heldVisualPropertyNames(hand),own=f.writes.filter(([k])=>keys.includes(k));assert.deepEqual(own[0],[keys[11],254],`${from}->${to}: invalidate first`);assert.deepEqual(own.at(-1),[keys[11],marker],`${from}->${to}: publish last`)}
 }
});
for(const hand of ['main','off'])for(const kind of ['slime','failure','secret','bottle','plate','empty'])test(`combined providers recover each payload write failure: ${kind} ${hand}`,()=>{
 for(const index of [0,5,10,11]){
  const f=fixture(),all=items();f.held[hand]=all.plate;f.sync();f.ctx.api.forgetHeldVisual(f.player.id);f.held[hand]=all[kind];const key=f.ctx.api.heldVisualPropertyNames(hand)[index];f.fail(k=>k===key);f.sync();
  const failedWrites=f.writes.length;f.fail();f.sync();assert.ok(f.writes.length>failedWrites);assert.notEqual(f.read(hand)[11],254);assert.equal(f.warnings.length>0,true);
  const expected=fixture();expected.held[hand]=all[kind];expected.sync();assert.deepEqual(f.read(hand),expected.read(hand));
 }
});
for(const hand of ['main','off'])test(`spawn/leave clears shared cache and stale native properties: ${hand}`,()=>{
 const f=fixture();f.held[hand]=items().failure;f.sync();const expected=f.read(hand);for(const k of f.ctx.api.heldVisualPropertyNames(hand))f.values.set(k,999);
 f.emit('playerLeave',{playerId:f.player.id});f.emit('playerSpawn');f.flush();assert.deepEqual(f.read(hand),expected);assert.equal(f.intervals.length,1);assert.equal(f.intervals[0].n,5);
});
const routes=[
 [failure.FAILURE_IDS[0],'animation.kg_failure_held.player.three.'],[failure.FAILURE_IDS[1],'animation.kg_failure_held.player.three.'],
 [failure.FAILURE_IDS[0]+'_java_three_alt','animation.kg_failure_held.player.three_alt.'],
 [N+'raw_fish_skewer','animation.kg_raw_one.player.one.'],[N+'raw_caterpillar_skewer','animation.kg_raw_one.player.one.'],
 [N+'grilled_fish_skewer','animation.kg_java_eating.player.one.'],[N+'grilled_gluten_skewer',null]
];
for(const hand of ['main','off'])for(const [id,prefix] of routes)test(`actual main dispatch retains route and native clock: ${id} ${hand}`,()=>{
 const f=fixture(),item=stack(id);f.start(item,hand,100);const a=f.ctx.ACTIVE_EATS.get(f.player.id);assert.ok(a);assert.equal(a.start,100);assert.equal(a.nativeDuration,100);assert.equal(f.ctx.system.currentTick,100);assert.equal(f.values.get(presentation.EAT_ELAPSED_TICKS_PROPERTY),0);
 const projected=f.animations.find(x=>x.options.controller==='kg_java_eating_first_person');const expected=prefix?prefix+(hand==='main'?'right':'left'):hand==='main'?'animation.kg_review_three.player.three.right':'animation.kg_offhand_projection.player.three.left';assert.equal(projected?.name,expected);
 assert.equal(f.values.get(presentation.EAT_NATIVE_TICKS_PROPERTY),100);if(projected){assert.match(projected.options.stopExpression,/!q.is_using_item/);assert.ok(projected.options.stopExpression.includes(id));}
 f.ctx.system.currentTick=101;f.emit('itemStopUse',{itemStack:item,useDuration:99});f.flush();assert.equal(f.ctx.ACTIVE_EATS.size,0);assert.equal(f.values.get(presentation.EAT_PROJECTION_PROPERTY),false);assert.equal(f.settlements.length,0);assert.equal(item.amount,1);
});
for(const hand of ['main','off'])for(const kind of ['failure','secret'])test(`actual completion masks only captured ${kind} identity and releases on replacement: ${hand}`,()=>{
 const f=fixture(),item=items()[kind];f.start(item,hand);const a=f.ctx.ACTIVE_EATS.get(f.player.id);assert.ok(a);f.ctx.system.currentTick=200;
 f.emit('itemCompleteUse',{itemStack:{...item,nameTag:'Wrong serving'},useDuration:0});assert.equal(f.ctx.ACTIVE_EATS.get(f.player.id),a);assert.equal(f.commits.length,0);
 f.emit('itemCompleteUse',{itemStack:item,useDuration:0});assert.equal(f.ctx.ACTIVE_EATS.size,0);assert.equal(f.commits.length,1);assert.equal(f.read(hand)[11],kind==='failure'?254:0);assert.equal(f.values.get(presentation.EAT_PROJECTION_PROPERTY),false);
 f.ctx.api.syncSecretHeld(f.player);assert.equal(f.read(hand)[11],kind==='failure'?254:0);
 f.held[hand]={...item,nameTag:'Replacement'};f.ctx.api.syncSecretHeld(f.player);assert.equal(f.read(hand)[11],kind==='failure'?220:secretVisualIndex('minecraft:beef'));
 f.emit('itemStopUse',{itemStack:item,useDuration:0});f.flush();assert.equal(f.commits.length,1);assert.equal(f.settlements.length,0);
});
for(const hand of ['main','off'])test(`occupied helper and invalid duration exclude projection; stale flags reset: ${hand}`,()=>{
 for(const id of [failure.FAILURE_IDS[0],N+'raw_fish_skewer',N+'grilled_gluten_skewer'])for(const duration of [100,0,-1,1.5,72001]){
  const f=fixture();f.values.set(presentation.EAT_PROJECTION_PROPERTY,true);f.held[hand==='main'?'off':'main']=stack('minecraft:torch');f.start(stack(id),hand,duration);assert.equal(f.values.get(presentation.EAT_PROJECTION_PROPERTY),false);assert.ok(f.animations.every(a=>a.options.controller!=='kg_java_eating_first_person'));
 }
 const f=fixture();f.start(stack(N+'raw_fish_skewer'),hand);f.start(stack('minecraft:cod'),hand);assert.equal(f.values.get(presentation.EAT_PROJECTION_PROPERTY),false);
});
test('slime world frame changes only its marker and never advances the eating clock',()=>{
 const f=fixture();f.held.off=stack(slime.SLIME_ID);f.start(stack(N+'raw_fish_skewer'),'main',90);const session=f.ctx.ACTIVE_EATS.get(f.player.id);f.sync();const before=f.read('main');f.writes.length=0;
 f.ctx.api.syncSlimeHeld(f.player,4);assert.deepEqual(f.writes,[[N+'secret_off_piece',219]]);assert.deepEqual(f.read('main'),before);assert.equal(f.ctx.ACTIVE_EATS.get(f.player.id),session);assert.equal(session.start,100);assert.equal(session.nativeDuration,90);assert.equal(f.ctx.system.currentTick,100);
});
for(const hand of ['main','off'])test(`reserved markers reject cross-owner payload before native writes: ${hand}`,()=>{
 const f=fixture(),all=items();
 for(const kind of ['slime','failure','secret','bottle','plate','empty']){
  f.held[hand]=all[kind];f.sync();const packet=f.read(hand);
  for(const other of ['slime','failure','secret','bottle','plate','empty'].filter(k=>k!==kind)){
   // An all-zero empty packet is intentionally also a valid empty secret visual.
   if(kind==='empty'&&other==='secret')continue;
   const n=f.writes.length;assert.throws(()=>f.ctx.api.writeHeldVisual(f.player,hand,other,packet),`${kind} packet as ${other}`);assert.equal(f.writes.length,n);
  }
 }
 for(const marker of [254,221,253,256]){const n=f.writes.length;assert.throws(()=>f.ctx.api.writeHeldVisual(f.player,hand,'failure',[...Array(11).fill(0),marker]));assert.equal(f.writes.length,n)}
});
for(const hand of ['main','off'])for(const stopFirst of [true,false])test(`native completion and terminal stop settle once in either event order: ${hand}, stopFirst=${stopFirst}`,()=>{
 const f=fixture(),item=items().failure;f.start(item,hand,100);f.ctx.system.currentTick=200;const event={itemStack:item,useDuration:0};
 if(stopFirst)f.emit('itemStopUse',event);f.emit('itemCompleteUse',event);if(!stopFirst)f.emit('itemStopUse',event);f.flush();
 assert.equal(f.commits.length,1);assert.equal(f.settlements.length,0);assert.equal(f.ctx.ACTIVE_EATS.size,0);assert.equal(f.read(hand)[11],254);
});
for(const hand of ['main','off'])test(`release, fresh session, and mismatched stop retain exact ownership: ${hand}`,()=>{
 const f=fixture(),item=items().failure;f.start(item,hand,100);const first=f.ctx.ACTIVE_EATS.get(f.player.id);f.ctx.system.currentTick=101;
 f.emit('itemStopUse',{itemStack:{...item,nameTag:'Unrelated'},useDuration:99});f.flush();assert.equal(f.ctx.ACTIVE_EATS.get(f.player.id),first);
 f.emit('itemStopUse',{itemStack:item,useDuration:99});f.start({...item,nameTag:'New serving'},hand,100);const next=f.ctx.ACTIVE_EATS.get(f.player.id);f.flush();assert.equal(f.ctx.ACTIVE_EATS.get(f.player.id),next);assert.equal(f.values.get(presentation.EAT_PROJECTION_PROPERTY),true);
 f.ctx.system.currentTick=131;f.emit('itemStopUse',{itemStack:f.held[hand],useDuration:70});f.flush();assert.equal(f.ctx.ACTIVE_EATS.size,0);assert.equal(f.settlements.length,1);assert.equal(f.read(hand)[11],220);
});
for(const hand of ['main','off'])test(`plain aliases keep native duration without custom animation: ${hand}`,()=>{
 for(const id of [failure.FAILURE_IDS[0],N+'raw_fish_skewer',N+'grilled_gluten_skewer']){
  const f=fixture(),item=stack(id+'_native_plain');f.start(item,hand,25);const a=f.ctx.ACTIVE_EATS.get(f.player.id);assert.equal(a.plain,true);assert.equal(a.nativeDuration,25);assert.equal(a.start,100);assert.deepEqual(f.animations,[]);assert.equal(f.values.get(presentation.EAT_PROJECTION_PROPERTY),false);
 }
});
for(const hand of ['main','off'])test(`payload and final-marker failures stay invalid until full recovery: ${hand}`,()=>{
 for(const phase of ['payload','publish']){
  const f=fixture();f.held[hand]=items().bottle;f.sync();f.held[hand]=items().failure;const keys=f.ctx.api.heldVisualPropertyNames(hand);f.writes.length=0;
  f.fail((k,v)=>phase==='payload'?k===keys[0]:k===keys[11]&&v===220);f.sync();assert.equal(f.read(hand)[11],254);
  if(phase==='payload')assert.equal(f.writes.some(([k,v])=>k===keys[11]&&v===220),false,'no ready marker after payload error');
  f.fail();f.writes.length=0;f.sync();const own=f.writes.filter(([k])=>keys.includes(k));assert.deepEqual(own[0],[keys[11],254]);assert.deepEqual(own.at(-1),[keys[11],220]);assert.equal(f.read(hand)[0],1);
 }
});
for(const hand of ['main','off'])test(`invalid native duration alone excludes new and retained projections: ${hand}`,()=>{
 for(const id of [failure.FAILURE_IDS[0],N+'raw_fish_skewer',N+'grilled_gluten_skewer'])for(const duration of [0,-1,1.5,72001]){
  const f=fixture();f.start(stack(id),hand,duration);assert.equal(f.values.get(presentation.EAT_PROJECTION_PROPERTY),false);assert.ok(f.animations.every(a=>a.options.controller!=='kg_java_eating_first_person'));assert.equal(f.ctx.system.currentTick,100);
 }
});

for(const hand of ['main','off'])test(`held plate animates only saved cooked slime and retains exact failure slots: ${hand}`,()=>{
 const f=fixture(),rows=[{id:failure.FAILURE_IDS[0],native:{version:1,id:failure.FAILURE_IDS[0],props:{[failure.FAILED_SOURCE_KEY]:N+'raw_beef_skewer'}}},{id:slime.SLIME_ID},{id:N+'raw_slime_skewer'},{id:failure.FAILURE_IDS[1],props:{[N+'model_variants']:'[4,5,6]'}},{id:slime.SLIME_ID}];
 const item=stack(PLATE_ID,{[PLATE_SKEWERS_KEY]:JSON.stringify(rows)}),before=JSON.stringify(item);
 f.held[hand]=item;f.sync();assert.deepEqual(f.read(hand),plateHeldVisualPlan(rows,2));
 let decodes=0;const decode=f.ctx.decodePlateStorage;f.ctx.decodePlateStorage=(...args)=>{decodes++;return decode(...args)};
 assert.ok(f.read(hand)[0]>44&&f.read(hand)[6]>44);
 for(let frame=0;frame<5;frame++){
  f.writes.length=0;f.ctx.api.syncSlimeHeld(f.player,frame);assert.deepEqual(f.read(hand),plateHeldVisualPlan(rows,frame));
  f.writes.length=0;f.ctx.api.syncSlimeHeld(f.player,frame);assert.equal(f.writes.length,0,'unchanged frame does not redraw');
  assert.equal(JSON.stringify(item),before,'frame presentation never changes saved items');assert.equal(decodes,0,'frame updates do not decode saved rows');
 }
 item.props[PLATE_SKEWERS_KEY]=JSON.stringify([{id:N+'raw_fish_skewer'}]);f.writes.length=0;
 f.ctx.api.syncSlimeHeld(f.player,0);assert.equal(f.writes.length,0,'changed saved rows cannot reuse old frame payload');
 f.sync();assert.deepEqual(f.read(hand),plateHeldVisualPlan([{id:N+'raw_fish_skewer'}],2));
});
for(const hand of ['main','off'])test(`plate frame fault invalidates cached packet and event refresh recovers: ${hand}`,()=>{
 const f=fixture();f.held[hand]=stack(PLATE_ID,{[PLATE_SKEWERS_KEY]:JSON.stringify([{id:slime.SLIME_ID}])});f.sync();
 f.fail((k,v)=>k===N+'bottle_'+hand+'_0'&&v===44);f.ctx.api.syncSlimeHeld(f.player,4);assert.equal(f.read(hand)[11],254);
 f.fail();f.writes.length=0;f.ctx.api.syncSlimeHeld(f.player,3);assert.equal(f.writes.length,0,'failed cache is not retried blindly');
 f.sync();assert.equal(f.read(hand)[11],255);assert.equal(f.read(hand)[0],42);
});

test('actual held plate decoder shows failure/slime only for the owning item, valid marker and populated slot',()=>{
 const attach=JSON.parse(readFileSync(new URL('../../resource_pack/attachables/skewer_plate.attachable.json',root),'utf8'))['minecraft:attachable'].description;
 const controller=JSON.parse(readFileSync(new URL('../../resource_pack/render_controllers/plate_held.render_controllers.json',root),'utf8')).render_controllers['controller.render.kg_plate_held.fixed_0'];
 const expression=controller.part_visibility.find(row=>Object.hasOwn(row,'plate_row_0')).plate_row_0;
 for(const hand of ['main','off'])for(const item of [PLATE_ID,'minecraft:apple'])for(const marker of [255,254,220])for(const count of [0,1]){
  const f=fixture(),rows=[{id:failure.FAILURE_IDS[0],props:{[failure.FAILED_SOURCE_KEY]:N+'raw_beef_skewer'}}];
  const words=plateHeldVisualPlan(rows);words[10]=count;words[11]=marker;
  const names=f.ctx.api.heldVisualPropertyNames(hand),values=Object.fromEntries(names.map((name,i)=>[name,words[i]]));
  const owner={property:k=>values[k]??0,has_property:k=>Object.hasOwn(values,k),is_item_name_any:(slot,id)=>slot===(hand==='main'?'slot.weapon.mainhand':'slot.weapon.offhand')&&id===item};
  const v={},c={item_slot:hand==='main'?'main_hand':'off_hand'},math={floor:Math.floor};
  const scoped=code=>code.replaceAll('c.owning_entity->q.','owner.');
  new Function('v','c','owner','math',scoped(attach.scripts.pre_animation.join('\n')))(v,c,owner,math);
  assert.equal(Boolean(new Function('v','return '+expression)(v)),item===PLATE_ID&&marker===255&&count===1);
 }
});
