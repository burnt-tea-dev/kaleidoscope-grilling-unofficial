import {onExplosion} from '../core/events.js';
import {isNativeBottleItem,readNativeBottles} from "../seasoning_native_storage.js";
import {isSpecialSeasoningId,specialSeasoningVisualId} from "./special_seasoning_visual_core.js";
import {PENDING_SEASONING_ID as PENDING_SEASONING,SEASONING_CAPACITY,SEASONING_MAX_BOTTLES,SEASONING_MAX_USES,SEASONING_PLACE_BLOCK_ID as SEASONING_BLOCK,SEASONING_VARIANT_KEY as SEASON_VARIANT_KEY,hasSeasoningBase,isPendingSeasoningId,isSeasoningBlockId as isSeasoningBlock,isSeasoningIngredient,seasoningFillVisualId} from "./seasoning_contract_core.js";
import {readFoodSeasonings as readSeasonings,setFoodSeasonings as setSeasonings} from "../food/food_state_adapter.js";
import {getUses,setUses} from "../grill/runtime.js";
import {specialSeasoningVariant} from "./special_seasoning_visual_runtime.js";
import {EMPTY_SEASONING_ID} from "../eating_data_lookup.js";
import {BlockPermutation,GameMode,ItemStack,system,world} from "@minecraft/server";
import {getItemProperty,getItemPropertyIds,getItemRawLore,setItemLore,setItemProperty} from "../itemData.js";
import {seasoningLore} from "../localized_lore_core.js";
import {inspectStationStorage,quarantineStation,retireEmptyStationContainer,storageKey as stationStorageKey} from "../family_station_storage.js";
import {copyOne,reducedStack,transactionStatus} from "../core/actions.js";
import {readPlacedSeasoningStack as readBottleStack,seasoningBlockKey,writePlacedSeasoningStack as writeBottleStack} from "./seasoning_block_adapter.js";
import {markPlacedVisualDirty} from "../presentation/placed_visual_queue.js";
import {commitSteps} from "../grill/grill_transaction_core.js";
import {slotWrite} from "../rack_transfer_plan.js";
import {captureWritableHand,getHand as heldByHand,isCreative as creative} from "../core/player_io.js";
import {interactionFailure,javaInteractionChat,javaInteractionFeedback} from "../core/interaction_feedback.js";
import {blockSound} from "../immersion_audio_runtime.js";
import {bottleLoreMismatch,bottleLoreSignature,isOwnedBottleLore} from "../bottle_lore_core.js";
import {metadataSignature} from "../skewer_item_snapshot.js";
import {retargetBottleFillStack} from "../bottle_fill_item_runtime.js";
import {awardSeasoningMilestones} from "../advancement/advancement_event_runtime.js";
import {interactionParticleBurst} from "../immersion_particles_runtime.js";
import {refreshPlacedBottleAfterPickup} from "../presentation/placed_visual_runtime.js";
import {hasSolidTop} from "../blockSupport.js";
import {captureInteractionIntent,interactionIntentStillCurrent} from "../core/interaction_intent_adapter.js";
function bottleDataFromItem(stack){
 if(!isNativeBottleItem(stack))throw new Error('Unknown item cannot become a seasoning bottle');
 const kind=isSpecialSeasoningId(stack?.typeId)?'special':isPendingSeasoningId(stack?.typeId)?'pending':'empty';
 return {kind,ingredients:readSeasonings(stack),uses:kind==='special'?getUses(stack):0,variant:kind==='special'?specialSeasoningVariant(stack):0};
}

function bottleItem(data){
 const id=data.kind==='special'?specialSeasoningVisualId(data.uses??0,data.variant??0):seasoningFillVisualId(data.kind==='pending'?PENDING_SEASONING:EMPTY_SEASONING_ID,data.ingredients??[]),stack=new ItemStack(id,1);setSeasonings(stack,data.ingredients??[]);
 if(data.kind==='special'){setUses(stack,data.uses??0);try{setItemProperty(stack,SEASON_VARIANT_KEY,data.variant??0);setItemLore(stack,seasoningLore(SEASONING_MAX_USES-(data.uses??0),data.ingredients?.length??0))}catch{}}
 else try{if(data.ingredients?.length)setItemLore(stack,seasoningLore(undefined,data.ingredients.length,{pending:data.kind==='pending',missingBase:data.kind!=='pending'}))}catch{}
 if(JSON.stringify(bottleDataFromItem(stack))!==JSON.stringify({kind:data.kind,ingredients:data.ingredients??[],uses:data.uses??0,variant:data.variant??0}))throw new Error('Bottle reconstruction did not preserve its mechanic fields');
 return stack;
}

function setBottleVisual(block,count){
 const target=count>0?'kaleidoscope_grilling:seasoning_bottle_'+Math.max(1,Math.min(SEASONING_MAX_BOTTLES,count)):'minecraft:air';
 if(block.typeId!==target)block.setType(target);
}

function nativeBottles(block,options){return readNativeBottles(block,bottleDataFromItem,bottleItem,options)}

function bottleRollbackStatus(block,result){
 if(result.rollbackErrors){
  try{quarantineStation(block,'bottle transaction rollback incomplete')}catch(error){console.warn('[Grilling bottle quarantine] '+error)}
  throw new Error('Bottle transaction recovery required; rollback incomplete');
 }
 return transactionStatus(result,'bottle/native-hand');
}

function bottleProjectionStep(block,items){
 const savedKey=seasoningBlockKey(block),savedRaw=world.getDynamicProperty(savedKey),rows=items.map(bottleDataFromItem);
 return {apply(){
  if(!writeBottleStack(block,rows))return false;
  return JSON.stringify(readBottleStack(block,true))===JSON.stringify(rows);
 },rollback(){world.setDynamicProperty(savedKey,savedRaw);markPlacedVisualDirty(block);return world.getDynamicProperty(savedKey)===savedRaw;}};
}

function commitBottleAndHand(block,current,nextItems,storage,nextHand,mutateHand=true){
 if(nextItems.length>SEASONING_MAX_BOTTLES||nextItems.some(x=>!isNativeBottleItem(x)||x.amount!==1))throw new Error('Invalid native bottle stack');
 const permutation=block.permutation;
 const result=commitSteps([
  ...Array.from({length:SEASONING_MAX_BOTTLES},(_,i)=>slotWrite(current.container,i,nextItems[i])),
  bottleProjectionStep(block,nextItems),
  {apply(){setBottleVisual(block,nextItems.length)},rollback(){block.setPermutation(permutation)}},
  {apply(){if(mutateHand)return storage.write(nextHand)},rollback(){if(mutateHand)return storage.write(storage.before)}}
 ]);
 const ok=bottleRollbackStatus(block,result);
 if(ok&&!nextItems.length)try{retireEmptyStationContainer(block)}catch(error){console.warn('[Grilling bottle empty storage retirement] '+error)}
 return ok;
}

function pushBottle(block,player,held,hand='main'){
 const current=nativeBottles(block);if(current.items.length>=SEASONING_MAX_BOTTLES)return false
 const storage=captureWritableHand(player,hand),free=creative(player),next=free?storage.before:reducedStack(storage.before);
 const items=[...current.items,copyOne(storage.before)];
 const ok=commitBottleAndHand(block,current,items,storage,next,!free);
 if(!ok)interactionFailure(player,'§c放瓶失敗，已嘗試回復調料與手持物品');
 else blockSound(block,'seasoning_bottle_stack',1);return ok;
}

function refreshBottleIngredientLore(stack,data){
 // Only derived Grilling count/status lines change; native metadata stays owned.
 const derived=data.ingredients.length||data.kind==='pending'?seasoningLore(undefined,data.ingredients.length,{pending:data.kind==='pending',missingBase:data.kind==='empty'}):[];
 const lore=[...getItemRawLore(stack).filter(line=>!isOwnedBottleLore(line)),...derived];
 const properties=()=>metadataSignature(Object.fromEntries(getItemPropertyIds(stack).map(key=>[key,getItemProperty(stack,key)]))),beforeProperties=properties();
 setItemLore(stack,lore);if(properties()!==beforeProperties)throw new Error('Bottle lore metadata write rejected');const actual=getItemRawLore(stack);if(bottleLoreSignature(actual)!==bottleLoreSignature(lore))throw new Error('Bottle ingredient lore write rejected: '+bottleLoreMismatch(lore,actual));
}

function handleSeasoningBlock(block,player,hand='main'){
 const current=nativeBottles(block),items=current.items.map(x=>x.clone());
 const held=heldByHand(player,hand),id=held?.typeId;
 if(isNativeBottleItem(held)){pushBottle(block,player,held,hand);return}
 const topItem=items.at(-1),top=bottleDataFromItem(topItem);
 if(id&&isSeasoningIngredient(id)){
  if(top.kind==='special'){javaInteractionFeedback(player,top.ingredients.length>=SEASONING_CAPACITY?'bottle_full':'invalid_seasoning');return}
  if(top.ingredients.length>=SEASONING_CAPACITY){javaInteractionFeedback(player,'bottle_full');return}
  const storage=captureWritableHand(player,hand),free=creative(player),next=free?storage.before:reducedStack(storage.before);
  top.ingredients.push(id);
  // Java's explicit EMPTY -> PENDING promotion creates a fresh semantic item.
  // Same-kind fill changes preserve all stable-API metadata through readback.
  if(top.kind==='empty'&&hasSeasoningBase(top.ingredients))items[items.length-1]=bottleItem({...top,kind:'pending'});
  else{setSeasonings(topItem,top.ingredients);if(JSON.stringify(readSeasonings(topItem))!==JSON.stringify(top.ingredients))throw new Error('Bottle seasoning data write rejected');refreshBottleIngredientLore(topItem,top);items[items.length-1]=retargetBottleFillStack(topItem);}
  if(!commitBottleAndHand(block,current,items,storage,next,!free)){interactionFailure(player,'§c加料失敗，已嘗試回復原料');return}
  awardSeasoningMilestones(player,top.ingredients);
  blockSound(block,'action_success',.65);
  interactionParticleBurst(block.dimension,block.location,'seasoningAdded');
  return;
 }
 if(!id){
  const storage=captureWritableHand(player,hand);let item=items.pop();const data=bottleDataFromItem(item);
  if(storage.before)throw new Error('Grilling: take-bottle hand is no longer empty');
  if(data.kind==='empty'&&hasSeasoningBase(data.ingredients))item=bottleItem({...data,kind:'pending'});
  else{if(data.kind!=='special')refreshBottleIngredientLore(item,data);item=retargetBottleFillStack(item);}
  if(!commitBottleAndHand(block,current,items,storage,item))interactionFailure(player,'§c取瓶失敗，已嘗試回復調料');
  else{refreshPlacedBottleAfterPickup(block);blockSound(block,'seasoning_bottle_place',1);warnMissingSeasoningBase(player,item)}
  return;
 }
 javaInteractionFeedback(player,top.ingredients.length>=SEASONING_CAPACITY?'bottle_full':'invalid_seasoning');
}

function warnMissingSeasoningBase(player,stack){
 const ingredients=readSeasonings(stack);
 if(ingredients.length&&!hasSeasoningBase(ingredients))javaInteractionChat(player,'missing_base_seasoning');
}

function sameBottleTarget(block,snapshot){
 return block&&block.typeId===snapshot.typeId&&Object.entries(snapshot.states).every(([key,value])=>block.permutation.getState(key)===value);
}

function bottleTargetSnapshot(block){return {typeId:block.typeId,states:block.permutation.getAllStates(),permutation:block.permutation}}

function bottleActionSnapshot(block){return {target:bottleTargetSnapshot(block),owner:world.getDynamicProperty(stationStorageKey(block)),projection:world.getDynamicProperty(seasoningBlockKey(block))}}

function bottleActionStillCurrent(block,captured){return sameBottleTarget(block,captured.target)&&world.getDynamicProperty(stationStorageKey(block))===captured.owner&&world.getDynamicProperty(seasoningBlockKey(block))===captured.projection}

// Supplement only known inert full-cube surfaces; hasSolidTop alone also accepts
// interactive blocks and unknown addon blocks whose use must remain untouched.
const bottleInteractionSupports=new Set([
 'stone','cobblestone','mossy_cobblestone','smooth_stone','granite','polished_granite',
 'diorite','polished_diorite','andesite','polished_andesite','deepslate',
 'cobbled_deepslate','polished_deepslate','tuff','calcite','dirt','coarse_dirt',
 'grass_block','podzol','rooted_dirt','netherrack','end_stone','obsidian','bedrock'
].map(id=>'minecraft:'+id));

const pendingBottlePlacements=new Set();

function tryScheduleOffhandBottleInteraction(e){
 if(e.cancel||e.isFirstEvent!==true||e.itemStack!=null||e.blockFace!=='Up')return false;
 const player=e.player;if(!player||pendingBottlePlacements.has(player.id))return false;
 try{
  const mode=player.getGameMode();if(mode!==GameMode.Survival&&mode!==GameMode.Creative)return false;
  const main=captureWritableHand(player,'main').before,off=captureWritableHand(player,'off').before;
  if(main!==undefined||!isNativeBottleItem(off))return false;
  // Java PendingSeasoningItem.useOn only places while sneaking. Ordinary use
  // must leave the pending bottle in its hand for the 80-tick shake.
  if(isPendingSeasoningId(off.typeId)&&!player.isSneaking)return false;
  const support=e.block;
  if(!bottleInteractionSupports.has(support.typeId)||!hasSolidTop(support))return false;
  const block=support.above();if(!block||block.typeId!=='minecraft:air')return false;
  const intent=captureInteractionIntent(player,off);if(intent?.hand!=='off')return false;
  const proposed=BlockPermutation.resolve(SEASONING_BLOCK);
  if(!queueBottlePlacement(player,block,intent,proposed))return false;
  e.cancel=true;return true;
 }catch{return false}
}

function scheduleNativeBottlePlacement(e){
 if(e.cancel)return;e.cancel=true;
 const player=e.player;if(!player||e.face!=='Up')return;
 const mode=player.getGameMode();if(mode!==GameMode.Survival&&mode!==GameMode.Creative)return;
 // This native placement event has no hand/itemStack. Never guess between
 // two bottles sharing its block route, even when their metadata differs.
 let intent;
 try{
  const main=captureWritableHand(player,'main').before,off=captureWritableHand(player,'off').before;
  const isBottle=isNativeBottleItem;
  const mainBottle=isBottle(main),offBottle=isBottle(off);
  if(mainBottle===offBottle)return;
  const hand=offBottle?'off':'main',held=offBottle?off:main;
  if(isPendingSeasoningId(held.typeId)&&!player.isSneaking)return;
  intent=captureInteractionIntent(player,held);
  if(intent?.hand!==hand)return;
 }catch{return} // An unreadable hand cannot establish a unique source.
 const support=e.block.below();if(!hasSolidTop(support))return;
 queueBottlePlacement(player,e.block,intent,e.permutationToPlace);
}

// Both entry points preserve the original stack/hand, snapshots and transaction.
// One pending action per player prevents duplicate callbacks, including rollback.
function queueBottlePlacement(player,targetBlock,intent,proposed){
 const key=player.id;if(typeof key!=='string'||!key||pendingBottlePlacements.has(key))return false;
 const target=bottleTargetSnapshot(targetBlock),below=bottleTargetSnapshot(targetBlock.below()),dimension=targetBlock.dimension,location={...targetBlock.location},slot=player.selectedSlotIndex;
 pendingBottlePlacements.add(key);
 try{system.run(()=>{
  let block,current,freshPreflight=false;
  try{
   if(player.isValid===false||player.dimension.id!==dimension.id||player.selectedSlotIndex!==slot||!interactionIntentStillCurrent(player,intent))return;
   // A released sneak must not turn a later ordinary use into a queued place.
   if(isPendingSeasoningId(heldByHand(player,intent.hand)?.typeId)&&!player.isSneaking)return;
   const mode=player.getGameMode();if(mode!==GameMode.Survival&&mode!==GameMode.Creative)return;
   if(Math.hypot(player.location.x-location.x-.5,player.location.y-location.y-.5,player.location.z-location.z-.5)>8)return;
   block=dimension.getBlock(location);if(!sameBottleTarget(block,target)||!sameBottleTarget(block.below(),below)||!hasSolidTop(block.below()))return;
   if(world.getDynamicProperty(seasoningBlockKey(block))!==undefined)throw new Error('Target has unresolved seasoning data');
   let presence=inspectStationStorage(block);if(presence.retiredEmpty){retireEmptyStationContainer(block);presence=inspectStationStorage(block);}
   if(presence.linked||presence.orphans||block.getComponent('minecraft:inventory')?.container)throw new Error('Target has unresolved native storage');
   freshPreflight=true;
   const storage=captureWritableHand(player,intent.hand),free=creative(player),item=copyOne(storage.before),next=free?storage.before:reducedStack(storage.before);
   const steps=[
    {apply(){block.setPermutation(proposed)},rollback(){block.setPermutation(target.permutation)}},
    {apply(){current=nativeBottles(block,{fresh:true})},rollback(){}},
    {apply(){return current.container.setItem(0,item.clone())},rollback(){if(current)return current.container.setItem(0,undefined)}},
    bottleProjectionStep(block,[item]),
    {apply(){if(!free)return storage.write(next)},rollback(){if(!free)return storage.write(storage.before)}}
   ];
   const result=commitSteps(steps);if(!result.ok){
    bottleRollbackStatus(block,result);
    if(current?.created||freshPreflight)try{retireEmptyStationContainer(block)}catch(error){console.warn('[Grilling bottle placement cleanup] '+error)}
   }else blockSound(block,'seasoning_bottle_place',1);
  }catch(error){console.warn('[Grilling bottle placement] '+error);}
  finally{pendingBottlePlacements.delete(key);}
 });}catch(error){pendingBottlePlacements.delete(key);throw error;}
 return true;
}

function scheduleNativeBottleBreak(e){
 if(e.cancel||!isSeasoningBlock(e.block.typeId))return;e.cancel=true;
 try{
  const player=e.player,dimension=e.block.dimension,location={...e.block.location},snapshot=bottleTargetSnapshot(e.block);
  const owner=world.getDynamicProperty(stationStorageKey(e.block)),projection=world.getDynamicProperty(seasoningBlockKey(e.block));
  system.run(()=>{try{
   const block=dimension.getBlock(location);
   if(!sameBottleTarget(block,snapshot)||world.getDynamicProperty(stationStorageKey(block))!==owner||world.getDynamicProperty(seasoningBlockKey(block))!==projection)return;
   breakNativeBottles(block,true,player);
  }catch(error){console.warn('[Grilling bottle break] '+error)}});
 }catch(error){console.warn('[Grilling bottle break capture] '+error)}
}

function breakNativeBottles(block,dropContents=true,player){
 if(!block||!isSeasoningBlock(block.typeId))return false;
 const current=nativeBottles(block),permutation=block.permutation,drops=[];
 const steps=(dropContents?current.items:[]).map(item=>{let entity,attempted=false;return {
  apply(){attempted=true;entity=block.dimension.spawnItem(item.clone(),{x:block.x+.5,y:block.y+.4,z:block.z+.5});if(!entity)throw new Error('Bottle drop not confirmed');drops.push(entity)},
  rollback(){if(entity)entity.remove();else if(attempted)throw new Error('Bottle drop outcome unknown; manual recovery required')}
 }});
 steps.push(...Array.from({length:SEASONING_MAX_BOTTLES},(_,i)=>slotWrite(current.container,i,undefined)),bottleProjectionStep(block,[]),
  {apply(){block.setType('minecraft:air')},rollback(){block.setPermutation(permutation)}});
 const result=commitSteps(steps);if(!bottleRollbackStatus(block,result))return false;
 try{retireEmptyStationContainer(block)}catch(error){console.warn('[Grilling bottle break storage retirement] '+error)}
 if(dropContents&&player)for(const item of current.items)warnMissingSeasoningBase(player,item);
 return true;
}

// Java support loss returns AIR without the playerWillDestroy payout. The
// backing inventory must follow that destructive lifecycle, not become orphaned.
function tickNativeBottleSupport(block){
 if(!block||!isSeasoningBlock(block.typeId))return;
 const below=block.below();if(!below||hasSolidTop(below))return;
 breakNativeBottles(block,false);
}

function scheduleNativeBottleExplosion(e){
 if(e.cancel)return;
 const pending=[],keep=[];
 for(const block of e.getImpactedBlocks()){
  if(isSeasoningBlock(block.typeId))pending.push({dimension:block.dimension,location:{...block.location},captured:bottleActionSnapshot(block)});
  else keep.push(block);
 }
 if(!pending.length)return;e.setImpactedBlocks(keep);
 system.run(()=>{
  // Later before-event subscribers may cancel. Keep native contents intact
  // unless the deferred event still confirms the explosion may proceed.
  try{if(e.cancel!==false)return}catch(error){console.warn('[Grilling bottle explosion status] '+error);return}
  for(const row of pending)try{
   const block=row.dimension.getBlock(row.location);
   if(bottleActionStillCurrent(block,row.captured))breakNativeBottles(block,false);
  }catch(error){console.warn('[Grilling bottle explosion recovery] '+error)}
 });
}

onExplosion('seasoning/runtime.js:0',scheduleNativeBottleExplosion);
export {bottleActionSnapshot,bottleActionStillCurrent,handleSeasoningBlock,scheduleNativeBottleBreak,scheduleNativeBottlePlacement,tickNativeBottleSupport,tryScheduleOffhandBottleInteraction};
