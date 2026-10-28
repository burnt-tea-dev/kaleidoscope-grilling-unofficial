import {onBlockInteraction} from './core/events.js';
import {every} from './core/scheduler.js';
import {interactionParticleBurst} from './immersion_particles_runtime.js';
import {queueStationContentsVisual} from './station_contents_visual_queue.js';
import {oilImpactPitch} from './immersion_particles_core.js';
import {getItemProperty,setItemProperty,getItemPropertyIds,getItemLore,setItemLore} from './itemData.js';
import {interactionFeedback,javaInteractionFeedback} from './a283_interaction_feedback.js';
import {world,system,ItemStack,BlockPermutation} from '@minecraft/server';
import {
 PRESS_MAX_CAKES,PRESS_REQUIRED_PROGRESS,PRESS_COOLDOWN_TICKS,PRESS_IMPACT_TICK,PRESS_COMPLETION_DELAY,PRESS_DURATION_TICKS,
 PRESS_OUTPUT_BUCKETS,VAT_CAPACITY_BUCKETS,OIL_POT_CAPACITY,OIL_BUCKET_POINTS,
 OIL_CAKE_ID,OIL_RESIDUE_ID,OIL_PRESS_ID,BIG_VAT_ID,
 toolProgress,pressVisualStage,normalizePress,pressAddCake,impactPress,finishPressTransfer,
 normalizeVat,vatVisualLevel,vatInsert,vatExtract,potFillPlan,nearbyOffsets
} from './a26_oil_machine_core.js';
import {COOKERY_EMPTY_ID as COOKERY_EMPTY,COOKERY_FILLED_ID as COOKERY_FILLED,readCookeryOilPot,buildCookeryOilPot} from './a2734_cookery_oil_pot_adapter.js';
import {playerInventory as playerContainer,getMainHand as main,getOffHand as off,setMainHand as setMain,setOffHand as setOff,findHand as handFor,getHand as held,setHand,isCreative as creative} from './a2735_player_io.js';
import {isInitialBlockPress} from './a275_grill_input_core.js';
import {captureInteractionIntent,interactionIntentStillCurrent} from './a2762_interaction_intent_adapter.js';
import {captureWritableHand} from './a2735_player_io.js';
import {commitSteps} from './a277_grill_transaction_core.js';
import {nativeItemSignature,ownedItemStep} from './owned_item_transaction_core.js';
import {suppressNumbVisual} from './numb_visual_runtime.js';
import {createOilPressRegistry,createOilPressScheduler} from './oil_press_registry.js';
import {ensureOilHandPublished} from './oil_api_client.js';
import {hasPlantFertilizer,usePlantFertilizer,samePlantPermutation} from './plant_fertilizer.js';

const PRESS_PREFIX='kaleidoscope_grilling:a26_press_';
const PRESS_INSTANCE_PREFIX='kaleidoscope_grilling:a26_press_instance_';
const VAT_PREFIX='kaleidoscope_grilling:a26_vat_';
const VAT_INSTANCE_PREFIX='kaleidoscope_grilling:a26_vat_instance_';
const PRESS_REG='kaleidoscope_grilling:a26_press_registry';
const pressRegistry=createOilPressRegistry(world,PRESS_REG);
const pressScheduler=createOilPressScheduler({now:()=>system.currentTick,step:tickPress,
 report:error=>console.warn('[Grilling oil press schedule] '+error)});
const VAT_ITEM_TYPE='kaleidoscope_grilling:vat_type';
const VAT_ITEM_BUCKETS='kaleidoscope_grilling:vat_buckets';
const OIL_BUCKETS=Object.freeze({
 'kaleidoscope_grilling:canola_oil_bucket':'canola',
 'kaleidoscope_grilling:secret_chili_oil_bucket':'secret_chili',
 'kaleidoscope_grilling:premium_chili_oil_bucket':'premium_chili'
});
const TYPE_BUCKETS=Object.freeze({
 canola:'kaleidoscope_grilling:canola_oil_bucket',
 secret_chili:'kaleidoscope_grilling:secret_chili_oil_bucket',
 premium_chili:'kaleidoscope_grilling:premium_chili_oil_bucket',
 water:'minecraft:water_bucket',
 lava:'minecraft:lava_bucket'
});
const VANILLA_BUCKETS=Object.freeze({'minecraft:water_bucket':'water','minecraft:lava_bucket':'lava'});
const PRESS_COOLDOWNS=new Map();
const TRANSACTION_FAULTS=new Set(),FAULT_PREFIX='kaleidoscope_grilling:oil_transaction_fault_';
let pressPlacementSequence=0,oilBreakSequence=0;

function enc(n){return n<0?'m'+Math.abs(n):'p'+n}
function key(prefix,block){return prefix+block.dimension.id.replace(/[^a-z0-9]/gi,'_')+'_'+enc(block.x)+'_'+enc(block.y)+'_'+enc(block.z)}
function registryRow(block){return {d:block.dimension.id,x:block.x,y:block.y,z:block.z}}
function registerPress(block){
 pressRegistry.add(registryRow(block));
 pressScheduler.ensure(block);
}
function removePressReg(block){pressRegistry.remove(registryRow(block));pressScheduler.cancel(block)}
function decHand(p,hand,count=1){
 if(creative(p))return true;const s=held(p,hand);if(!s||s.amount<count)return false;
 if(s.amount===count)setHand(p,hand,undefined);else{s.amount-=count;setHand(p,hand,s)}return true;
}
const msg=interactionFeedback;
function faceName(face){return String(face??'').toLowerCase()}
function faceOffset(face){
 switch(faceName(face)){case'north':return{x:0,y:0,z:-1};case'south':return{x:0,y:0,z:1};case'west':return{x:-1,y:0,z:0};case'east':return{x:1,y:0,z:0};case'up':return{x:0,y:1,z:0};case'down':return{x:0,y:-1,z:0};default:return null}
}
function targetFor(block,face){const o=faceOffset(face);return o?block.dimension.getBlock({x:block.x+o.x,y:block.y+o.y,z:block.z+o.z}):undefined}
function replaceable(b){return !!b&&['minecraft:air','minecraft:short_grass','minecraft:tall_grass','minecraft:snow_layer'].includes(b.typeId)}

function readPress(block){
 try{const raw=world.getDynamicProperty(key(PRESS_PREFIX,block));return normalizePress(typeof raw==='string'?JSON.parse(raw):{})}catch{return normalizePress({})}
}
function pressPermutationSignature(permutation){return JSON.stringify(Object.entries(permutation.getAllStates()).sort(([a],[b])=>a.localeCompare(b)))}
function pressTargetSnapshot(block){
 if(!block||block.typeId!==OIL_PRESS_ID)throw Error('Oil press replaced or unavailable');
 return {dimension:block.dimension,location:{...block.location},permutation:block.permutation,
  states:pressPermutationSignature(block.permutation),raw:world.getDynamicProperty(key(PRESS_PREFIX,block)),
  instance:world.getDynamicProperty(key(PRESS_INSTANCE_PREFIX,block))};
}
function samePressTarget(snapshot,checkState=true){
 const block=snapshot.dimension.getBlock(snapshot.location);
 if(!block||block.typeId!==OIL_PRESS_ID||world.getDynamicProperty(key(PRESS_INSTANCE_PREFIX,block))!==snapshot.instance)return;
 if(checkState&&(pressPermutationSignature(block.permutation)!==snapshot.states||world.getDynamicProperty(key(PRESS_PREFIX,block))!==snapshot.raw))return;
 return block;
}
function capturedPressState(snapshot){
 if(snapshot.raw===undefined)return normalizePress({});
 if(typeof snapshot.raw!=='string')throw Error('Oil press saved state unreadable');
 const saved=JSON.parse(snapshot.raw);
 if(!saved||typeof saved!=='object'||Array.isArray(saved))throw Error('Oil press saved state unreadable');
 return normalizePress(saved);
}
function syncPress(block,s){
 const state=normalizePress(s);
 try{
  let p=block.permutation.withState('kaleidoscope_grilling:cake_count',state.cakes);
  p=p.withState('kaleidoscope_grilling:press_stage',pressVisualStage(state.progress));block.setPermutation(p);
 }catch{}
}
function writePress(block,s,ensureRegistered=true){
 if(!block||block.typeId!==OIL_PRESS_ID)throw Error('Oil press replaced or unavailable');const state=normalizePress(s);
 const pending=state.completionDelay>0||state.progress>=PRESS_REQUIRED_PROGRESS;
 if(ensureRegistered&&pending)registerPress(block);
 const saved=JSON.stringify(state);world.setDynamicProperty(key(PRESS_PREFIX,block),saved);
 if(world.getDynamicProperty(key(PRESS_PREFIX,block))!==saved)throw Error('Oil press state write not confirmed');
 syncPress(block,state);
 if(!pending)removePressReg(block);
}
function clearPress(block){world.setDynamicProperty(key(PRESS_PREFIX,block));removePressReg(block)}

// Debit only a captured hand; a failed save must remove our cake credit before
// refunding it. Neither rollback may overwrite an unrelated replacement value.
function insertPressCake(block,p,hand,snapshot,state,next){
 const storage=captureWritableHand(p,hand),before=storage.before;
 if(before?.typeId!==OIL_CAKE_ID||before.amount<1||!samePressTarget(snapshot))return false;
 const after=before.amount===1?undefined:before.clone();if(after)after.amount--;
 const saved=JSON.stringify(normalizePress(next)),stateKey=key(PRESS_PREFIX,block);
 const projected=snapshot.permutation.withState('kaleidoscope_grilling:cake_count',next.cakes)
  .withState('kaleidoscope_grilling:press_stage',pressVisualStage(next.progress));
 const projectedSignature=pressPermutationSignature(projected);let attempted=false,recovered=true;
 const credit={
  apply(){
   if(!samePressTarget(snapshot))throw Error('Oil press changed before cake credit');
   attempted=true;recovered=false;writePress(block,next);
   if(world.getDynamicProperty(stateKey)!==saved||pressPermutationSignature(block.permutation)!==projectedSignature)
    throw Error('Oil press cake credit not confirmed');
  },
  rollback(){
   if(!attempted)return;
   const current=samePressTarget(snapshot,false);if(!current)throw Error('Oil press rollback owner changed');
   const raw=world.getDynamicProperty(stateKey),states=pressPermutationSignature(current.permutation);
   if((raw!==snapshot.raw&&raw!==saved)||(states!==snapshot.states&&states!==projectedSignature))throw Error('Oil press rollback state changed');
   if(raw!==snapshot.raw)world.setDynamicProperty(stateKey,snapshot.raw);
   if(world.getDynamicProperty(stateKey)!==snapshot.raw)throw Error('Oil press rollback save not confirmed');
   if(states!==snapshot.states)current.setPermutation(snapshot.permutation);
   if(pressPermutationSignature(current.permutation)!==snapshot.states)throw Error('Oil press rollback projection not confirmed');
   if(state.completionDelay>0||state.progress>=PRESS_REQUIRED_PROGRESS)registerPress(current);else removePressReg(current);
   recovered=true;
  }
 };
 const input=ownedItemStep({read:()=>storage.read(),write:s=>storage.write(s),before,after,canRestore:()=>recovered});
 const debit={apply(){if(!samePressTarget(snapshot))throw Error('Oil press changed before cake debit');return input.apply()},rollback:()=>input.rollback()};
 oilTransaction(creative(p)?[credit]:[debit,credit],[block]);return true;
}

function readVat(block){
 try{const raw=world.getDynamicProperty(key(VAT_PREFIX,block));return normalizeVat(typeof raw==='string'?JSON.parse(raw):{})}catch{return normalizeVat({})}
}
function syncVat(block,v){
 const state=normalizeVat(v);
 try{
  let p=block.permutation.withState('kaleidoscope_grilling:vat_level',vatVisualLevel(state.buckets));
  p=p.withState('kaleidoscope_grilling:vat_fluid',state.type||'empty');block.setPermutation(p);
  queueStationContentsVisual(block);
 }catch{}
}
function writeVat(block,v){
 if(!block||block.typeId!==BIG_VAT_ID)throw Error('Oil vat replaced or unavailable');const state=normalizeVat(v);
 world.setDynamicProperty(key(VAT_PREFIX,block),JSON.stringify(state));syncVat(block,state);
}
function clearVat(block){world.setDynamicProperty(key(VAT_PREFIX,block))}

function vatPacked(stack){
 let type='',buckets=0;
 try{type=String(getItemProperty(stack,VAT_ITEM_TYPE)??'');buckets=Number(getItemProperty(stack,VAT_ITEM_BUCKETS)??0)|0}catch{}
 if(!type||buckets<=0)try{
  for(const line of getItemLore(stack)??[]){const m=String(line).match(/^§7Fluid: ([a-z_]+) (\d+)\/8$/);if(m){type=m[1];buckets=Number(m[2]);break}}
 }catch{}
 return normalizeVat({type,buckets});
}
function vatItem(v){
 const state=normalizeVat(v);let out;try{out=new ItemStack(BIG_VAT_ID,1)}catch{return undefined}
 try{
  const lore=state.buckets?['§7Fluid: '+state.type+' '+state.buckets+'/'+VAT_CAPACITY_BUCKETS]:[];
  if(lore.length)setItemLore(out,lore);
  setItemProperty(out,VAT_ITEM_TYPE,state.type||undefined);setItemProperty(out,VAT_ITEM_BUCKETS,state.buckets||undefined);
 }catch{}
 return out;
}
function bucketType(id){return OIL_BUCKETS[id]??VANILLA_BUCKETS[id]??null}

function assertOilMachineSafe(block){
 const id=key(FAULT_PREFIX,block);
 if(TRANSACTION_FAULTS.has(id)||world.getDynamicProperty(id)!==undefined)throw Error('Oil machine requires recovery after an incomplete rollback');
}
function oilTransaction(steps,blocks,recovery){
 for(const block of blocks)assertOilMachineSafe(block);
 const result=commitSteps(steps);
 if(result.rollbackErrors)for(const block of blocks){
  const id=key(FAULT_PREFIX,block);TRANSACTION_FAULTS.add(id);
  try{if(recovery)recovery(block,result);else world.setDynamicProperty(id,'incomplete rollback; inspect before recovery')}catch(error){console.warn('[Grilling oil recovery marker failed] '+error);}
 }
 if(!result.ok)throw Error('Oil transaction failed; rollback failures='+result.rollbackErrors);
}
// One filled bucket: reserve an exact inventory slot, or retain the spawned
// entity for rollback. Never overwrite the rest of a stack of empty buckets.
function bucketDelivery(p,hand,output){
 const container=playerContainer(p);if(!container)throw Error('Oil bucket inventory unavailable');
 let slot=-1,before,after,drop;
 for(let i=0;i<container.size;i++){
  if(hand==='main'&&i===p.selectedSlotIndex)continue;
  const item=container.getItem(i);
  if(!item||(item.isStackableWith(output)&&item.amount<item.maxAmount)){
   slot=i;before=item?.clone();after=item?.clone()??output;
   if(item)after.amount++;break;
  }
 }
 return {apply(){if(slot>=0)container.setItem(slot,after);else{drop=p.dimension.spawnItem(output,{...p.location,y:p.location.y+.5});if(!drop)throw Error('Oil bucket drop unavailable')}},
  rollback(){if(slot>=0)container.setItem(slot,before);else if(drop)drop.remove()}};
}

function fillVatFromBucket(block,p,hand,item){
 const type=bucketType(item?.typeId);if(!type)return false;
 const v=readVat(block),next=vatInsert(v,type,1);
 if(!next.ok){javaInteractionFeedback(p,'big_vat_reject');return true}
 const storage=captureWritableHand(p,hand),free=creative(p);
 oilTransaction([
  {apply(){if(!free)storage.write(new ItemStack('minecraft:bucket',1))},rollback(){if(!free)storage.write(storage.before)}},
  {apply(){writeVat(block,next.state)},rollback(){writeVat(block,v)}}
 ],[block]);
 try{block.dimension.playSound(type==='lava'||type==='premium_chili'?'bucket.empty_lava':'bucket.empty_water',block.location,{volume:.9,pitch:.8+.5*next.state.buckets/VAT_CAPACITY_BUCKETS})}catch{}
 return true;
}
function takeVatBucket(block,p,hand){
 const v=readVat(block);if(!v.type||v.buckets<=0)return false;
 const id=TYPE_BUCKETS[v.type];if(!id)return false;
 const next=vatExtract(v,v.type,1);if(!next.ok)return false;
 const storage=captureWritableHand(p,hand),before=storage.before;
 if(before?.typeId!=='minecraft:bucket'||before.amount<1)return false;
 const steps=[];
 // NeoForge FluidUtil: creative drains the tank but keeps its input and gives
 // no filled bucket. Survival single replaces; a stack stows/drops the result.
 if(!creative(p)){
  const output=new ItemStack(id,1),after=before.amount===1?output:before.clone();
  if(before.amount>1)after.amount--;
  steps.push({apply(){storage.write(after)},rollback(){storage.write(before)}});
  if(before.amount>1)steps.push(bucketDelivery(p,hand,output));
 }
 steps.push({apply(){writeVat(block,next.state)},rollback(){writeVat(block,v)}});
 oilTransaction(steps,[block]);return true;
}
function fillPotFromVat(block,p,hand,item){
 if(block?.typeId!=='kaleidoscope_grilling:big_vat')return true;
 if(!ensureOilHandPublished(p,hand,()=>fillPotFromVat(block,p,hand,held(p,hand))))return true;
 item=held(p,hand);
 const v=readVat(block);if(!['canola','secret_chili','premium_chili'].includes(v.type))return false;
 const oil=readCookeryOilPot(item),type=item.typeId===COOKERY_FILLED?oil.type:'',count=item.typeId===COOKERY_FILLED?oil.count:0;
 const plan=potFillPlan(v,type,count);if(!plan.ok){javaInteractionFeedback(p,'oil_type_mismatch');return true}
 const next=vatExtract(v,v.type,plan.buckets);if(!next.ok)return true;
 const pot=buildCookeryOilPot(plan.type,plan.nextCount,item);if(!pot)return true;
 const storage=captureWritableHand(p,hand);
 oilTransaction([
  {apply(){storage.write(pot)},rollback(){storage.write(storage.before)}},
  {apply(){writeVat(block,next.state)},rollback(){writeVat(block,v)}}
 ],[block]);return true;
}

function scanVat(press){
 let fallback={status:'NO_CONTAINER',block:null};
 for(const o of nearbyOffsets()){
  let b;try{b=press.dimension.getBlock({x:press.x+o.x,y:press.y+o.y,z:press.z+o.z})}catch{continue}
  if(!b||b.typeId!==BIG_VAT_ID)continue;const v=readVat(b);
  if(v.buckets>0&&v.type!=='canola'){
   if(fallback.status==='NO_CONTAINER')fallback={status:'INCOMPATIBLE',block:b};continue;
  }
  if(v.buckets+PRESS_OUTPUT_BUCKETS>VAT_CAPACITY_BUCKETS){fallback={status:'FULL',block:b};continue}
  return {status:'SUCCESS',block:b};
 }
 return fallback;
}
function broadcastPressFailure(block,status,source){
 const text=status==='FULL'?'§c附近大缸容量不足':status==='INCOMPATIBLE'?'§c附近大缸裝有不同流體':'§c附近沒有可接 4 桶菜籽油的大缸';
 if(source)javaInteractionFeedback(source,status==='FULL'?'press_vat_full':status==='INCOMPATIBLE'?'press_wrong_vat':'press_no_vat');
}
function residueEject(block,count){
 if(count<=0)return;let facing='north';try{facing=String(block.permutation.getState('minecraft:cardinal_direction')??'north')}catch{}
 const o=faceOffset(facing)??{x:0,y:0,z:-1},loc={x:block.x+.5+o.x*.72,y:block.y+.58,z:block.z+.5+o.z*.72};
 const entity=block.dimension.spawnItem(new ItemStack(OIL_RESIDUE_ID,count),loc);
 if(!entity)throw Error('Oil residue drop unavailable');return entity;
}
function finishPress(block,source){
 assertOilMachineSafe(block);
 const state=readPress(block),probe=scanVat(block);
 if(probe.status==='SUCCESS'&&probe.block){
  const v=readVat(probe.block),ins=vatInsert(v,'canola',PRESS_OUTPUT_BUCKETS);
  if(!ins.ok){const fail=finishPressTransfer(state,'FULL');writePress(block,fail.state);broadcastPressFailure(block,'FULL',source);return false}
  const done=finishPressTransfer(state,'SUCCESS');let residue;
  oilTransaction([
   {apply(){writeVat(probe.block,ins.state)},rollback(){writeVat(probe.block,v)}},
   {apply(){writePress(block,done.state)},rollback(){writePress(block,state)}},
   {apply(){residue=residueEject(block,done.residue)},rollback(){if(residue)residue.remove()}}
  ],[block,probe.block]);
  try{block.dimension.playSound('piston.in',block.location,{volume:.8,pitch:.9})}catch{};return true;
 }
 const fail=finishPressTransfer(state,probe.status);writePress(block,fail.state);broadcastPressFailure(block,probe.status,source);return false;
}
function startPress(block,p,amount){
 const snapshot=pressTargetSnapshot(block),state=capturedPressState(snapshot);
 if(state.cakes<PRESS_MAX_CAKES){javaInteractionFeedback(p,'press_need_full_batch',[state.cakes,4]);return true}
 if(state.waiting){finishPress(block,p);return true}
 const cd=key(PRESS_PREFIX,block)+'|'+p.id,now=system.currentTick;
 if(now<(PRESS_COOLDOWNS.get(cd)??-1))return true;
 const dry=impactPress(state,amount);if(!dry.ok)return true;
 PRESS_COOLDOWNS.set(cd,now+PRESS_COOLDOWN_TICKS);
 try{p.playAnimation('animation.kg_a26.player.anvil_press',{blendOutTime:.05});suppressNumbVisual(p,system.currentTick,PRESS_DURATION_TICKS+1)}catch{}
 const dim=block.dimension;
 system.runTimeout(()=>{
  try{
   // Other players may hit this same batch during the wind-up. Retain their
   // progress, but never apply this hit to a newly placed machine instance.
   const b=samePressTarget(snapshot,false);if(!b)return;assertOilMachineSafe(b);
   const current=capturedPressState(pressTargetSnapshot(b)),hit=impactPress(current,amount);if(!hit.ok)return;
   writePress(b,hit.state);javaInteractionFeedback(p,'press_status',[hit.state.cakes,hit.state.progress,PRESS_REQUIRED_PROGRESS]);
   try{dim.playSound('random.anvil_land',b.location,{volume:1.15,pitch:oilImpactPitch()})}catch{}
   interactionParticleBurst(dim,b.location,'oilPressImpact');
  }catch(error){console.warn('[Grilling oil press impact] '+error)}
 },PRESS_IMPACT_TICK);
 return true;
}
function interactPress(block,p,item,hand=null){
 if(!block||block.typeId!==OIL_PRESS_ID)return;
 assertOilMachineSafe(block);
 const snapshot=pressTargetSnapshot(block),state=capturedPressState(snapshot);
 if(state.waiting){finishPress(block,p);return}
 const actualHand=hand??(item?handFor(p,item.typeId):null);
 if(item?.typeId===OIL_CAKE_ID){
  const x=pressAddCake(state);if(!x.ok){javaInteractionFeedback(p,'press_full');return}
  if(!actualHand||nativeItemSignature(item)!==nativeItemSignature(held(p,actualHand))||!insertPressCake(block,p,actualHand,snapshot,state,x.state))return;
  try{block.dimension.playSound('dig.grass',block.location,{volume:.8,pitch:1})}catch{};return;
 }
 const amount=toolProgress(item?.typeId,item?.getTags?.()??[]);if(amount>0){startPress(block,p,amount);return}
 javaInteractionFeedback(p,'press_status',[state.cakes,state.progress,PRESS_REQUIRED_PROGRESS]);
}
function oilBreakSnapshot(block){
 if(!block||![OIL_PRESS_ID,BIG_VAT_ID].includes(block.typeId))throw Error('Oil machine replaced or unavailable');
 const press=block.typeId===OIL_PRESS_ID,storageKey=key(press?PRESS_PREFIX:VAT_PREFIX,block),instanceKey=key(press?PRESS_INSTANCE_PREFIX:VAT_INSTANCE_PREFIX,block);
 const registryKey=press?PRESS_REG+'_entry_'+encodeURIComponent(block.dimension.id+'|'+block.x+'|'+block.y+'|'+block.z):undefined;
 return {type:block.typeId,dimension:block.dimension,location:{...block.location},permutation:block.permutation,
  states:pressPermutationSignature(block.permutation),storageKey,instanceKey,raw:world.getDynamicProperty(storageKey),instance:world.getDynamicProperty(instanceKey),
  registryKey,registryRaw:registryKey?world.getDynamicProperty(registryKey):undefined};
}
function sameOilBreakTarget(snapshot,allowTimer=false){
 const block=snapshot.dimension.getBlock(snapshot.location);
 if(!block||block.typeId!==snapshot.type||world.getDynamicProperty(snapshot.instanceKey)!==snapshot.instance||pressPermutationSignature(block.permutation)!==snapshot.states)return;
 const raw=world.getDynamicProperty(snapshot.storageKey);
 if(raw!==snapshot.raw){
  if(!allowTimer||snapshot.type!==OIL_PRESS_ID)return;
  const before=capturedPressState(snapshot),after=capturedPressState({...snapshot,raw});
  if(before.cakes!==after.cakes||before.progress!==after.progress||before.waiting!==after.waiting)return;
  const withoutTimer=value=>JSON.stringify(Object.entries(value===undefined?{}:JSON.parse(value)).filter(([name])=>name!=='completionDelay').sort(([a],[b])=>a.localeCompare(b)));
  if(withoutTimer(snapshot.raw)!==withoutTimer(raw))return;
 }
 return block;
}
function confirmedOilProperty(id,before,after){
 if(world.getDynamicProperty(id)!==before)throw Error('Oil machine property owner changed');
 let error;try{world.setDynamicProperty(id,after)}catch(value){error=value}
 if(world.getDynamicProperty(id)!==after)throw error??Error('Oil machine property write not confirmed');
}
function capturedVatState(snapshot){
 if(snapshot.raw===undefined)return normalizeVat({});
 if(typeof snapshot.raw!=='string')throw Error('Oil vat saved state unreadable');
 const saved=JSON.parse(snapshot.raw);
 if(!saved||typeof saved!=='object'||Array.isArray(saved))throw Error('Oil vat saved state unreadable');
 const state=normalizeVat(saved);
 if((saved.type??'')!==state.type||(saved.buckets??0)!==state.buckets)throw Error('Oil vat contents require recovery');
 return state;
}
function breakOilMachine(block,free){
 assertOilMachineSafe(block);
 // Everything below runs after the before-event. Full native item metadata is
 // forbidden in restricted execution, including getters on cloned ItemStacks.
 const snapshot=oilBreakSnapshot(block),press=snapshot.type===OIL_PRESS_ID;
 const state=press?capturedPressState(snapshot):capturedVatState(snapshot),items=[];
 if(!free){
  if(press){items.push(new ItemStack(OIL_PRESS_ID,1));if(state.cakes)items.push(new ItemStack(OIL_CAKE_ID,state.cakes))}
  else{const packed=vatItem(state);if(!packed||JSON.stringify(vatPacked(packed))!==JSON.stringify(state))throw Error('Packed oil vat was not confirmed');items.push(packed)}
 }
 const outputs=items.map(stack=>({stack,signature:nativeItemSignature(stack),attempted:false,confirmed:false,recovered:false,entity:undefined}));
 const token='break:'+system.currentTick+':'+(++oilBreakSequence)+':'+Math.random().toString(36).slice(2),faultKey=key(FAULT_PREFIX,block);
 const origin={x:block.x+.5,y:block.y+.5,z:block.z+.5},air=BlockPermutation.resolve('minecraft:air'),airStates=pressPermutationSignature(air);
 const receipt={v:1,operation:'oil_machine_break',token,phase:'prepared',dimension:snapshot.dimension.id,location:snapshot.location,type:snapshot.type,
  states:snapshot.permutation.getAllStates(),saved:snapshot.raw??null,instance:snapshot.instance??null,registry:snapshot.registryRaw??null,
  outputs:outputs.map(row=>({type:row.stack.typeId,amount:row.stack.amount,signature:row.signature}))};
 const prepared=JSON.stringify(receipt);let sourceAttempted=false,sourceRecovered=true,sourceRemoved=false;
 const recoveredOutputs=()=>outputs.every(row=>!row.attempted||row.recovered);
 function currentOwner(){
  const current=snapshot.dimension.getBlock(snapshot.location);
  if(!current||world.getDynamicProperty(snapshot.instanceKey)!==token)throw Error('Oil machine removal owner changed');
  const signature=pressPermutationSignature(current.permutation);
  if(!((current.typeId===snapshot.type&&signature===snapshot.states)||(current.typeId==='minecraft:air'&&signature===airStates)))throw Error('Oil machine removal target changed');
  const raw=world.getDynamicProperty(snapshot.storageKey),registry=snapshot.registryKey?world.getDynamicProperty(snapshot.registryKey):undefined;
  if((raw!==undefined&&raw!==snapshot.raw)||(registry!==undefined&&registry!==snapshot.registryRaw))throw Error('Oil machine removal data changed');
  return current;
 }
 function requireRemoved(){
  const current=currentOwner();
  if(current.typeId!=='minecraft:air'||world.getDynamicProperty(snapshot.storageKey)!==undefined||(snapshot.registryKey&&world.getDynamicProperty(snapshot.registryKey)!==undefined))throw Error('Oil machine source removal not confirmed');
 }
 function restoreRegistry(){
  if(!snapshot.registryKey)return;
  const current=world.getDynamicProperty(snapshot.registryKey);
  if(current!==snapshot.registryRaw)confirmedOilProperty(snapshot.registryKey,current,snapshot.registryRaw);
  // Repair the registry cache too: a native setter can apply then throw before
  // createOilPressRegistry updates its in-memory entry.
  if(snapshot.registryRaw===undefined)removePressReg(block);else registerPress(block);
  if(world.getDynamicProperty(snapshot.registryKey)!==snapshot.registryRaw)throw Error('Oil press registry rollback not confirmed');
 }
 const journal={
  apply(){confirmedOilProperty(faultKey,undefined,prepared)},
  rollback(){
   if(!sourceRecovered||!recoveredOutputs())throw Error('Oil machine recovery remains unresolved');
   const current=world.getDynamicProperty(faultKey);if(current===undefined)return;
   confirmedOilProperty(faultKey,prepared,undefined);
  }
 };
 const removeSource={
  apply(){
   if(!sameOilBreakTarget(snapshot))throw Error('Oil machine changed before removal');
   sourceAttempted=true;sourceRecovered=false;
   confirmedOilProperty(snapshot.instanceKey,snapshot.instance,token);
   let error;try{block.setPermutation(air)}catch(value){error=value}
   if(currentOwner().typeId!=='minecraft:air')throw error??Error('Oil machine block removal not confirmed');
   confirmedOilProperty(snapshot.storageKey,snapshot.raw,undefined);
   if(snapshot.registryKey){
    if(world.getDynamicProperty(snapshot.registryKey)!==snapshot.registryRaw)throw Error('Oil press registry changed before removal');
    removePressReg(block);
   }
   requireRemoved();sourceRemoved=true;
  },
  rollback(){
   if(!sourceAttempted)return;
   if(!recoveredOutputs())throw Error('Oil machine drop outcome unknown; source is not refunded');
   // A failed claim may have applied no mutation at all.
   if(sameOilBreakTarget(snapshot)&&(snapshot.registryKey===undefined||world.getDynamicProperty(snapshot.registryKey)===snapshot.registryRaw)){sourceRecovered=true;return}
   let current=currentOwner(),raw=world.getDynamicProperty(snapshot.storageKey);
   if(raw!==snapshot.raw)confirmedOilProperty(snapshot.storageKey,raw,snapshot.raw);
   restoreRegistry();current=currentOwner();
   let error;try{current.setPermutation(snapshot.permutation)}catch(value){error=value}
   current=currentOwner();if(current.typeId!==snapshot.type||pressPermutationSignature(current.permutation)!==snapshot.states)throw error??Error('Oil machine block rollback not confirmed');
   confirmedOilProperty(snapshot.instanceKey,token,snapshot.instance);
   if(!sameOilBreakTarget(snapshot)||(snapshot.registryKey&&world.getDynamicProperty(snapshot.registryKey)!==snapshot.registryRaw))throw Error('Oil machine rollback not confirmed');
   sourceRecovered=true;sourceRemoved=false;
  }
 };
 const deliveries=outputs.map(row=>({
  apply(){
   requireRemoved();row.attempted=true;
   row.entity=snapshot.dimension.spawnItem(row.stack.clone(),origin);
   try{row.entityId=row.entity?.id}catch{}
   if(!row.entity||row.entity.isValid!==true||nativeItemSignature(row.entity.getComponent('minecraft:item')?.itemStack)!==row.signature)throw Error('Oil machine drop was not acknowledged');
   row.confirmed=true;requireRemoved();
  },
  rollback(){
   if(!row.attempted)return;
   if(!row.entity||row.entity.isValid!==true||nativeItemSignature(row.entity.getComponent('minecraft:item')?.itemStack)!==row.signature)throw Error('Oil machine drop ownership/outcome unknown');
   let error;try{row.entity.remove()}catch(value){error=value}
   if(row.entity.isValid!==false)throw error??Error('Oil machine drop recovery not confirmed');
   row.recovered=true;
  }
 }));
 const release={
  apply(){requireRemoved();confirmedOilProperty(faultKey,prepared,undefined)},
  rollback(){const current=world.getDynamicProperty(faultKey);if(current===prepared)return;confirmedOilProperty(faultKey,undefined,prepared)}
 };
 oilTransaction([journal,removeSource,...deliveries,release],[block],(_block,result)=>{
  const current=world.getDynamicProperty(faultKey);
  if(current!==undefined&&current!==prepared)throw Error('Oil machine recovery marker owner changed');
  const detail=JSON.stringify({...receipt,phase:'incomplete',error:String(result.error),sourceRemoved,sourceRecovered,
   outputs:receipt.outputs.map((output,index)=>({...output,attempted:outputs[index].attempted,confirmed:outputs[index].confirmed,recovered:outputs[index].recovered,entityId:outputs[index].entityId??null}))});
  confirmedOilProperty(faultKey,current,detail);
 });
 return true;
}
function breakPress(block,p,free=creative(p)){if(block?.typeId!==OIL_PRESS_ID)return false;return breakOilMachine(block,free)}
function breakVat(block,p,free=creative(p)){if(block?.typeId!==BIG_VAT_ID)return false;return breakOilMachine(block,free)}
function recordOilMachinePlacement(block){
 const prefix=block.typeId===OIL_PRESS_ID?PRESS_INSTANCE_PREFIX:VAT_INSTANCE_PREFIX;
 const instance=system.currentTick+':'+(++pressPlacementSequence)+':'+Math.random().toString(36).slice(2),instanceKey=key(prefix,block);
 confirmedOilProperty(instanceKey,world.getDynamicProperty(instanceKey),instance);
}
function markOilPlacementFault(block,error){
 const id=key(FAULT_PREFIX,block);TRANSACTION_FAULTS.add(id);
 try{if(world.getDynamicProperty(id)===undefined)world.setDynamicProperty(id,'placement identity/state requires recovery')}catch{}
 console.warn('[Grilling oil machine placement] '+error);
}
function placePackedVat(support,face,p,item,hand=null){
 const target=targetFor(support,face);if(!replaceable(target))return false;const actualHand=hand??handFor(p,item?.typeId);if(!actualHand)return false;
 assertOilMachineSafe(target);
 const packed=vatPacked(item);target.setType(BIG_VAT_ID);
 try{recordOilMachinePlacement(target);writeVat(target,packed)}catch(error){markOilPlacementFault(target,error);throw error}
 decHand(p,actualHand,1);return true;
}
function interactVat(block,p,item,hand=null){
 if(block?.typeId!==BIG_VAT_ID)return;
 assertOilMachineSafe(block);
 const actualHand=hand??(item?handFor(p,item.typeId):null);if(!item){const v=readVat(block);javaInteractionFeedback(p,'big_vat_status',[v.buckets,VAT_CAPACITY_BUCKETS]);return}
 if((item.typeId===COOKERY_EMPTY||item.typeId===COOKERY_FILLED)&&actualHand&&fillPotFromVat(block,p,actualHand,item))return;
 if(bucketType(item.typeId)&&actualHand&&fillVatFromBucket(block,p,actualHand,item))return;
 if(item.typeId==='minecraft:bucket'&&actualHand&&takeVatBucket(block,p,actualHand))return;

}

onBlockInteraction('a26_oil_machine_runtime',e=>{
 try{
  if(e.cancel)return;
  const b=e.block,p=e.player,intent=captureInteractionIntent(p,e.itemStack),hand=intent.hand,item=held(p,hand),first=isInitialBlockPress(e.isFirstEvent);
  const defer=fn=>system.run(()=>{try{if(!interactionIntentStillCurrent(p,intent)){msg(p,'§7操作已取消：互動後手持物品已改變');return}fn()}catch(error){console.warn('[Grilling oil interaction] '+error)}});
  // Another player's accepted gesture may change this instance's capacity.
  // interactPress captures that latest state before its strict debit/credit.
  if(b.typeId===OIL_PRESS_ID){e.cancel=true;if(!first)return;const snapshot=pressTargetSnapshot(b);defer(()=>{const current=samePressTarget(snapshot,false);if(current)interactPress(current,p,held(p,hand),hand)});return}
  if(b.typeId===BIG_VAT_ID){e.cancel=true;if(!first)return;const snapshot=oilBreakSnapshot(b);defer(()=>{const current=sameOilBreakTarget(snapshot);if(current)interactVat(current,p,held(p,hand),hand)});return}
  if(item?.typeId===BIG_VAT_ID){
   const target=targetFor(b,e.blockFace);if(replaceable(target)){e.cancel=true;if(!first)return;const dim=b.dimension,loc={...b.location},face=e.blockFace;defer(()=>{const current=held(p,hand);if(current?.typeId===BIG_VAT_ID)placePackedVat(dim.getBlock(loc),face,p,current,hand)});return}
  }
  if(item?.typeId===OIL_RESIDUE_ID){
   const secondaryUse=p.isSneaking===true;
   if(hasPlantFertilizer(b,item.typeId,hand,secondaryUse)){
    e.cancel=true;if(!first)return;
    const dim=b.dimension,loc={...b.location},before=b.permutation;
    defer(()=>{
     try{
      const target=dim.getBlock(loc);
      if((p.isSneaking===true)!==secondaryUse||held(p,hand)?.typeId!==OIL_RESIDUE_ID||!target||!samePlantPermutation(target.permutation,before))return;
      usePlantFertilizer(target,p,hand);
     }catch{}
    });return;
   }
  }
 }catch{}
},{"priority":50});
world.afterEvents.playerPlaceBlock.subscribe(({block})=>{
 if(block.typeId!==OIL_PRESS_ID&&block.typeId!==BIG_VAT_ID)return;
 try{
  assertOilMachineSafe(block);recordOilMachinePlacement(block);
  if(block.typeId===OIL_PRESS_ID)writePress(block,normalizePress({}));else writeVat(block,normalizeVat({}));
 }catch(error){markOilPlacementFault(block,error)}
});
world.beforeEvents.playerBreakBlock.subscribe(e=>{
 try{
  if(e.cancel||![OIL_PRESS_ID,BIG_VAT_ID].includes(e.block.typeId))return;
  e.cancel=true;const snapshot=oilBreakSnapshot(e.block),p=e.player,free=creative(p);
  system.run(()=>{try{
   if(e.cancel!==true||p.isValid===false||p.dimension.id!==snapshot.dimension.id)return;
   const current=sameOilBreakTarget(snapshot,true);if(!current)return;
   if(snapshot.type===OIL_PRESS_ID)breakPress(current,p,free);else breakVat(current,p,free);
  }catch(error){console.warn('[Grilling oil machine break] '+error)}});
 }catch{}
});

// The native callback retains the old one-loaded-tick transition, including
// the same transaction/finish path. It does not infer offline progress from
// world time, and it does not change any persisted key or ItemStack format.
function tickPress(block){
 if(block.typeId!==OIL_PRESS_ID){pressRegistry.remove(registryRow(block));return false}
 const faultId=key(FAULT_PREFIX,block);
 if(TRANSACTION_FAULTS.has(faultId)||world.getDynamicProperty(faultId)!==undefined){removePressReg(block);return false}
 const state=capturedPressState(pressTargetSnapshot(block));
 if(state.completionDelay>0){
  const next={...state,completionDelay:state.completionDelay-1};writePress(block,next,false);
  if(next.completionDelay===0&&next.progress>=PRESS_REQUIRED_PROGRESS)finishPress(block);
 }else if(state.progress>=PRESS_REQUIRED_PROGRESS&&!state.waiting)finishPress(block);
 else{removePressReg(block);return false}
 const next=capturedPressState(pressTargetSnapshot(block));
 const pending=next.completionDelay>0||(next.progress>=PRESS_REQUIRED_PROGRESS&&!next.waiting);
 if(!pending)removePressReg(block);
 return pending;
}
system.beforeEvents.startup.subscribe(({blockComponentRegistry})=>{
 blockComponentRegistry.registerCustomComponent('kaleidoscope_grilling:oil_press_schedule',{
  onNamedTick:event=>pressScheduler.onNamedTick(event)
 });
});
function repairPressSchedules(){
 let rows;try{rows=pressRegistry.rows()}catch(error){console.warn('[Grilling oil registry] '+error);return}
 for(const row of rows){
  let block;try{block=world.getDimension(row.d).getBlock({x:row.x,y:row.y,z:row.z})}catch{continue}
  // An unloaded chunk is not a removed machine. Keep its recovery entry.
  if(!block)continue;
  try{
   if(block.typeId!==OIL_PRESS_ID){pressRegistry.remove(row);continue}
   const faultId=key(FAULT_PREFIX,block);
   if(TRANSACTION_FAULTS.has(faultId)||world.getDynamicProperty(faultId)!==undefined){removePressReg(block);continue}
   pressScheduler.ensure(block); // schedules only; never advances processing
  }catch(error){console.warn('[Grilling oil press recovery] '+error)}
 }
}
system.run(repairPressSchedules);
// Retain the existing recovery source, but stop scanning it every single tick.
every('a26_oil_machine_runtime:1',repairPressSchedules,20);

export function a26ReadPress(block){return readPress(block)}
export function a26ProbePressContainer(block){return scanVat(block)}
export function a26ReadVat(block){return readVat(block)}
export function a26VatItem(v){return vatItem(v)}
