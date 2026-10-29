import {onScriptEvent} from './core/events.js';
/** Server-script API. No polling inference, item delivery, player impersonation or vanilla worldgen scan. */
import {world,system,BlockPermutation} from '@minecraft/server';
import {prepareProducedFood,publicStackFingerprint,samePublicStack,stableJson,utf8Bytes,ITEM_ID} from './integration_stack_core.js';
import {replaceSeasoningData,registerProducer,producerFor,registerProjectionDescriptor,registerHeldVisual,secretVisualIndex,integrationRegistrySnapshot,restoreIntegrationRegistry} from './integration_registry_core.js';
import {stationProjection} from './station_projection_core.js';
import {readPublicFood} from './host_api/food_api_core.js';
import {normalizeFreshFortress,fortressReplacementAt} from './fortress_generation_core.js';
import {grillingConfig} from './server_config_runtime.js';
export const INTEGRATION_REQUEST='kaleidoscope_grilling:integration_request';
export const INTEGRATION_RESPONSE='kaleidoscope_grilling:integration_response';
const REGISTRY_KEY='kaleidoscope_grilling:integration_registry_v1',JOURNAL_PREFIX='kaleidoscope_grilling:integration_operation:',TOUCHED_PREFIX='kaleidoscope_grilling:player_touched_nether:';
let ready=false,storageFault='',ledgerFault='';
const write=(key,value)=>{const bytes=JSON.stringify(value);if(utf8Bytes(bytes)>30000)throw Error('API storage capacity');world.setDynamicProperty(key,bytes);if(world.getDynamicProperty(key)!==bytes)throw Error('API storage readback');};
const read=key=>{const raw=world.getDynamicProperty(key);return raw===undefined?undefined:JSON.parse(String(raw));};
const chunkKey=(x,z)=>TOUCHED_PREFIX+Math.floor(x/16)+','+Math.floor(z/16);
function targetSlot(target){
 if(!target||!Number.isInteger(target.slot)||target.slot<0)throw Error('output slot schema');
 let container;
 if(target.kind==='block_slot'){
  if(!['minecraft:overworld','minecraft:nether','minecraft:the_end'].includes(target.dimensionId)||!['x','y','z'].every(k=>Number.isSafeInteger(target[k])))throw Error('output location schema');
  container=world.getDimension(target.dimensionId).getBlock({x:target.x,y:target.y,z:target.z})?.getComponent('minecraft:inventory')?.container;
 }else if(target.kind==='entity_slot'){
  if(typeof target.entityId!=='string'||target.entityId.length>128)throw Error('output entity schema');
  container=world.getEntity(target.entityId)?.getComponent('minecraft:inventory')?.container;
 }else if(target.kind==='player_slot')container=world.getAllPlayers().find(p=>p.id===target.playerId)?.getComponent('minecraft:inventory')?.container;
 else throw Error('unsupported output target');
 if(!container||target.slot>=container.size)throw Error('output target unavailable');return {get:()=>container.getItem(target.slot),set:s=>container.setItem(target.slot,s)};
}
function commitOperation(request,prepare){
 if(!ITEM_ID.test(request.producerId??'')||!Number.isSafeInteger(request.sequence)||request.sequence<1)throw Error('producer sequence schema');
 const key=JOURNAL_PREFIX+request.producerId,signature=stableJson(Object.fromEntries(Object.entries(request).filter(([k])=>k!=='requestId'))),old=read(key);
 if(old&&request.sequence===old.sequence){
  if(old.signature!==signature)throw Error('operation conflict');
  if(old.phase==='committed')return {...old.result,replayed:true};
  if(old.phase!=='rolled_back')throw Error('operation outcome unresolved');
 }else{
  if(old&&!['committed','rolled_back'].includes(old.phase))throw Error('producer outcome unresolved');
  if(request.sequence!==(old?.sequence??0)+1)throw Error('stale or skipped producer sequence');
 }
 const plan=prepare(),journal={sequence:request.sequence,signature,phase:'prepared'};write(key,journal);
 try{plan.apply()}catch(error){
  try{plan.rollback();journal.phase='rolled_back';write(key,journal)}catch(rollback){journal.phase='quarantined';journal.reason=String(rollback).slice(0,256);try{write(key,journal)}catch{}}
  throw error;
 }
 journal.phase='committed';journal.result=plan.result;
 try{write(key,journal);return {...plan.result,replayed:false}}catch{return {...plan.result,replayed:false,recoveryPending:true};}
}
function decorate(request){
 producerFor(request.producerId,request.kind,request.expected?.id);
 return commitOperation(request,()=>{
  const slot=targetSlot(request.target),before=slot.get();if(!samePublicStack(before,request.expected))throw Error('output changed');
  const next=prepareProducedFood(before,{...request.metadata,kind:request.kind},Number(world.getAbsoluteTime()),grillingConfig());
  const expected=publicStackFingerprint(next);
  return {apply(){slot.set(next);if(!samePublicStack(slot.get(),expected))throw Error('output write readback');},rollback(){slot.set(before);if(!samePublicStack(slot.get(),request.expected))throw Error('output rollback readback');},result:{decorated:true,output:{id:next.typeId,amount:next.amount},metadata:readPublicFood(next).state}};
 });
}
function replaceFortress(request){
 if(ledgerFault)throw Error(ledgerFault);
 producerFor(request.producerId,'fresh_fortress');
 return commitOperation(request,()=>{
  const batch=normalizeFreshFortress(request.generation,Number(world.getAbsoluteTime())),dimension=world.getDimension(batch.dimensionId);
  if(world.getDynamicProperty(chunkKey(batch.positions[0].x,batch.positions[0].z))!==undefined)throw Error('generated chunk already touched by a player');
  const changes=[];for(const position of batch.positions){
   const block=dimension.getBlock(position);if(block?.typeId!=='minecraft:nether_wart'||dimension.getBlock({...position,y:position.y-1})?.typeId!=='minecraft:soul_sand')throw Error('generated wart evidence changed');
   const age=block.permutation.getState('age');if(![0,1,2,3].includes(age))throw Error('native wart age');
   if(fortressReplacementAt(position))changes.push({block,before:block.permutation,next:BlockPermutation.resolve('kaleidoscope_grilling:houttuynia_crop',{'kaleidoscope_grilling:age':age===0?0:age===1?3:7,'kaleidoscope_grilling:red_variant':true})});
  }
  let attempted=0;return {apply(){for(const c of changes){attempted++;c.block.setPermutation(c.next);if(c.block.typeId!=='kaleidoscope_grilling:houttuynia_crop'||c.block.permutation.getState('kaleidoscope_grilling:red_variant')!==true||c.block.permutation.getState('kaleidoscope_grilling:age')!==c.next.getState('kaleidoscope_grilling:age'))throw Error('fortress replacement readback');}},rollback(){for(const c of changes.slice(0,attempted)){c.block.setPermutation(c.before);if(c.block.typeId!=='minecraft:nether_wart'||c.block.permutation.getState('age')!==c.before.getState('age'))throw Error('fortress rollback readback');}},result:{inspected:batch.positions.length,replaced:changes.length,vanillaCallbackInstalled:false}};
 });
}
function persistRegistration(action){
 const before=integrationRegistrySnapshot();let attempted=false;try{const result=action();attempted=true;write(REGISTRY_KEY,integrationRegistrySnapshot());return result}catch(e){
  // A post-write fault may have persisted the new value. Restore both stores or fail closed.
  restoreIntegrationRegistry(before);if(attempted)try{write(REGISTRY_KEY,before)}catch{storageFault='registration outcome unresolved';}throw e;
 }
}
export function handleIntegrationRequest(request){
 if(!ready||storageFault)throw Error(storageFault||'API not ready');
 if(!request||request.api!==1||typeof request.requestId!=='string'||!/^[a-zA-Z0-9_.:/-]{1,64}$/.test(request.requestId))throw Error('request schema');
 switch(request.op){
  case 'discover':{const config=grillingConfig();return {api:1,capabilities:['output_metadata_v1','public_stack_projection_v1','held_catalog_alias_v1','fresh_fortress_batch_v1','producer_sequence_receipt_v1','seasoning_data_roots_v1'],vanillaFortressCallbackInstalled:false,arbitraryRuntimeTextures:false,smeltedFood:{enabled:config.enableSmeltedFoodHeat,seconds:config.smeltedFoodSeconds}};}
  case 'replace_seasoning_data':return persistRegistration(()=>replaceSeasoningData(request.roots));
  case 'register_producer':return persistRegistration(()=>registerProducer(request.registration));
  case 'register_projection':return persistRegistration(()=>registerProjectionDescriptor(request.registration));
  case 'register_held_visual':return persistRegistration(()=>registerHeldVisual(request.registration));
  case 'inspect_projection':{const current=targetSlot(request.target).get();if(!samePublicStack(current,request.expected))throw Error('output changed');const food=readPublicFood(current);if(food.present&&!food.valid)throw Error('food metadata unreadable');return stationProjection(current,food.state);}
  case 'inspect_held_visual':{if(!ITEM_ID.test(request.itemId??''))throw Error('held visual item');return {index:secretVisualIndex(request.itemId)};}
  case 'inspect_producer':{producerFor(request.producerId,request.kind);const j=read(JOURNAL_PREFIX+request.producerId);return {sequence:j?.sequence??0,phase:j?.phase??'unused'};}
  case 'decorate_output':return decorate(request);
  case 'fresh_fortress':return replaceFortress(request);
  default:throw Error('unknown integration operation');
 }
}
system.run(()=>{try{const saved=read(REGISTRY_KEY);if(saved)restoreIntegrationRegistry(saved);ready=true;}catch(error){storageFault='integration registry unreadable';console.warn('[Grilling integration API] '+error)}});
onScriptEvent('integration_api_runtime.js:0',event=>{
 if(event.id!==INTEGRATION_REQUEST||event.sourceType!=='Server')return;
 let request;try{if(typeof event.message!=='string'||utf8Bytes(event.message)>8192)throw Error('request capacity');request=JSON.parse(event.message);}catch{return;}
 let response;try{response={api:1,requestId:request.requestId,ok:true,result:handleIntegrationRequest(request)}}catch(error){response={api:1,requestId:typeof request?.requestId==='string'?request.requestId.slice(0,64):'',ok:false,error:String(error).slice(0,256)}}
 try{system.sendScriptEvent(INTEGRATION_RESPONSE,JSON.stringify(response))}catch(error){console.warn('[Grilling integration API] response deferred '+error)}
});
// Whole touched chunks are excluded; no existing farm is inferred from nearby bricks or scans.
for(const name of ['playerPlaceBlock','playerBreakBlock'])world.afterEvents[name].subscribe(e=>{
 if(e.block?.dimension.id==='minecraft:nether')try{const key=chunkKey(e.block.x,e.block.z);if(world.getDynamicProperty(key)===undefined){world.setDynamicProperty(key,true);if(world.getDynamicProperty(key)!==true)throw Error('touched-chunk readback');}}catch(error){ledgerFault='player touched-chunk ledger unavailable';console.warn('[Grilling integration API] '+error)}
});
