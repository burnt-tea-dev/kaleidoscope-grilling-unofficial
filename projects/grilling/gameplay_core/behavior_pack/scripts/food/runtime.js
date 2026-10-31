import {clearEatingPresentation,updatePlayerPresentation,flushPlayerPresentation} from '../core/player_props.js';
import {WOK_FOOD_IDS} from "./wok_food_core.js";
import {STOCKPOT_FOOD_IDS} from "./stockpot_food_core.js";
import {seasoningFinished,seasoningShakeSound,stopSoundHandle} from "../immersion_audio_runtime.js";
import {EquipmentSlot,ItemStack,system,world} from "@minecraft/server";
import {SKEWER_EATING_IDS,canonicalFoodId,isPlainEatingId} from "../eating_profile_ids.js";
import {applyFixedEffect,applyOrdinary,applySeasoning,dangerousPreservation,doubleNewFx,doubleNewNative,fxSnapshot,nativeSnapshot} from "../effect/runtime.js";
import {awardEatItHot} from "../advancement/advancement_event_runtime.js";
import {awardMentalPreparationFailed,awardSeasoningFinishedChallenges} from "../advancement/advancement_challenge_runtime.js";
import {grillingConfig} from "../server_config_runtime.js";
import {goldenSkewerFeedback} from "../immersion_effect_feedback.js";
import {hotUntil,isHotFood as isHot,readFoodSeasonings as readSeasonings,setFoodSeasonings as setSeasonings} from "./food_state_adapter.js";
import {finishedFoodMeta} from "../food_finish_core.js";
import {copyOne,now} from "../core/actions.js";
import {getHand as heldByHand,getMainHand as heldMain,getOffHand as heldOff,isCreative as creative,playerInventory as mainContainer} from "../core/player_io.js";
import {captureEatingIdentity,commitEating,completedEatingStillCurrent,eatingEventMatches,eatingStillCurrent} from "../core/eating_transaction.js";
import {SECRET_ID} from "../skewer/skewering_core.js";
import {addNestedNutrition,addSecretNutrition,dynamicFood,hasPendingHandAction,scheduleSkewerAction,secretEatingData,secretRemainders,skewerAction} from "../skewer/runtime.js";
import {DARK_ID,FOOD_DATA,MYSTERIOUS_ID,PROFILE_BY_ITEM,RAW_NAUSEA} from "../eating_data_lookup.js";
import {eatingElapsedTicks,eatingNativeTicks,eatingProfile,nativeEatingCompleted} from "../core/player_props.js";
import {completedUseStillCurrent} from "../core/use_transaction.js";
import {a25PlateItem,a25PlateRows,a25RestoreStack} from "../plate/plate_recipe_runtime.js";
import {PLATE_ID,plateHighestNutritionIndex} from "../plate/plate_recipe_core.js";
import {captureInteractionIntent,interactionIntentStillCurrent,primitiveStackProps} from "../core/interaction_intent_adapter.js";
import {SEASONING_MAX_USES,SEASONING_VARIANT_KEY as SEASON_VARIANT_KEY,SEASONING_VARIANT_MAX,isPendingSeasoningId} from "../seasoning/seasoning_contract_core.js";
import {specialSeasoningVisualId} from "../seasoning/special_seasoning_visual_core.js";
import {getUses,setUses} from "../grill/runtime.js";
import {setItemLore,setItemProperty} from "../core/persist.js";
import {seasoningLore} from "../localized_lore_core.js";
import {syncSeasoningMotion} from "../seasoning_motion_runtime.js";
import {canUseCuisineFood,captureCuisineUse,completedCuisineUse,cuisineUseEventMatches} from "../cuisine_eating_core.js";
import {forgetJavaEatingHud,hideJavaEatingHud,showJavaEatingHud} from "../java_eating_hud_runtime.js";
import {forgetEatingItem,prepareChangedEatingItems,prepareEatingItems,selectedEatingProfile} from "../eating_item_runtime.js";
import {syncSecretHeld} from "../secret_held_runtime.js";
import {admitEatingProjection,selectEatingProjection} from "../eating_projection_routes.js";
import {clearEffects} from "../effect_state_runtime.js";
import {isFailureSkewer} from "../failure_skewer_visual_core.js";
import {compactMatchingHotFood,isFoodStack} from "../skewer/hot_runtime.js";
import {syncSlimeHeld} from "../slime_frame_runtime.js";
import {syncOilBrushVisual} from "../oil_brush_visual_runtime.js";
import {prepareBottleFillItems} from "../bottle_fill_item_runtime.js";
// Java MultiBiteSkewerItem: readiness remains 25 ticks; release alone gets one tick of grace.
const MINIMUM_EAT_TICKS=25;
const RELEASE_CHECKPOINT_GRACE_TICKS=1;

const ACTIVE_EATS=new Map();
const CUISINE_EATS=new Map();
const PLATE_EATS=new Map();
const PENDING_USES=new Map();
const SETTLED=new Map();

const CUISINE_FOOD_SET=new Set([...WOK_FOOD_IDS,...STOCKPOT_FOOD_IDS]);

const DANGEROUS_FOODS=new Set(['minecraft:rotten_flesh','minecraft:chicken','minecraft:poisonous_potato','minecraft:pufferfish','minecraft:spider_eye']);

const BITE_TIMES=Object.freeze({
 ONE:[1.16667,3.08333],TWO:[0.95833,4.0],THREE:[0.95833,2.33333,3.54167],THREE_ALT:[0.95833,2.16667,3.5],FOUR:[0.95833,2.33333,3.45833,4.08333]
});

function soundFor(profile){return profile==='ONE'?'one_skewer_eat':profile==='TWO'?'two_skewer_eat':profile==='FOUR'?'four_skewer_eat':'three_skewer_eat'}

function stopEatSound(player,profile){stopSoundHandle(ACTIVE_EATS.get(player.id)?.audio)}

function startEatingSound(player,a){if(a.audioStarted)return;try{a.audio=player.playSound('kg_imm.'+soundFor(a.profile));a.audioStarted=true;}catch(error){a.audioAttempts=(a.audioAttempts??0)+1;console.warn('[Grilling eating audio] '+error);}}

function spawnBiteCrumbs(player){
 try{
  const h=player.getHeadLocation(),v=player.getViewDirection();
  for(let i=0;i<5;i++)player.dimension.spawnParticle('kaleidoscope_grilling:skewer_crumb',{x:h.x+v.x*.32+(Math.random()-.5)*.14,y:h.y-.08+(Math.random()-.5)*.12,z:h.z+v.z*.32+(Math.random()-.5)*.14});
 }catch{}
}

function advanceBites(player,a){
 const elapsed=(system.currentTick-a.start)/20,times=a.biteTimes??[];
 while((a.nextBite??0)<times.length&&elapsed+1e-6>=times[a.nextBite]){spawnBiteCrumbs(player);a.nextBite++}
}

function afterCommitted(player,id,meta,active,fullNative){
 id=canonicalFoodId(id);
 applyFixedEffect(player,id);
 awardEatItHot(player,id,meta.hot);
 awardMentalPreparationFailed(player,id);
 if(meta.hot){doubleNewNative(player,active.nativeBefore);doubleNewFx(player,active.fxBefore)}
 if(meta.hot&&fullNative&&active.saturationBefore!==undefined){const h=player.getComponent('minecraft:player.hunger'),sat=player.getComponent('minecraft:player.saturation');if(h&&sat){const gained=Math.max(0,sat.currentValue-active.saturationBefore);sat.setCurrentValue(Math.min(h.currentValue,active.saturationBefore+gained*grillingConfig().saturationMultiplier))}}
 if(meta.hot)applySeasoning(player,meta.seasonings);
 if(id==='kaleidoscope_grilling:grilled_golden_skewer')goldenSkewerFeedback(player);
 if(id==='kaleidoscope_grilling:ordinary_skewer')applyOrdinary(player);
}

function stackMeta(stack){return {hot:isHot(stack),seasonings:readSeasonings(stack),hotUntil:hotUntil(stack)}}

function hungerSettle(player,id,active){
 active={...active,meta:finishedFoodMeta(active.meta,now())};
 const current=heldByHand(player,active.hand);
 if(!current||canonicalFoodId(current.typeId)!==id||!eatingStillCurrent(active.use,current,player.selectedSlotIndex,now()))return false;
 const d=id===SECRET_ID?dynamicFood(current):FOOD_DATA[id],h=player.getComponent('minecraft:player.hunger'),sat=player.getComponent('minecraft:player.saturation');
 if(!d||!h||!sat)return false;
 const consumed=copyOne(current),before=current.clone(),next=current.amount>1?current.clone():undefined;
 if(next)next.amount--;
 const oldH=h.currentValue,oldS=sat.currentValue,hunger=Math.min(h.effectiveMax,oldH+d.nutrition);
 const saturation=Math.min(hunger,oldS+d.nutrition*d.saturation*2*(active.meta.hot?grillingConfig().saturationMultiplier:1));
 const write=stack=>{
  if(active.hand==='off'){
   const eq=player.getComponent('minecraft:equippable');
   if(!eq||!eq.setEquipment(EquipmentSlot.Offhand,stack))throw new Error('Offhand unavailable');
  }else{
   const c=mainContainer(player);if(!c)throw new Error('Inventory unavailable');c.setItem(active.use.slot,stack);
  }
 };
 if(!commitEating({debit:()=>{if(!creative(player))write(next)},reward:()=>{
  h.setCurrentValue(hunger);
  // As with plate nutrition, the pre-hunger saturation view may retain its
  // old cap. Refresh inside the transaction so failure restores the serving.
  const currentSat=player.getComponent('minecraft:player.saturation');
  if(!currentSat)throw new Error('Grilling: saturation component unavailable after nutrition update');
  currentSat.setCurrentValue(Math.min(saturation,currentSat.effectiveMax));
 },
  restoreFood:()=>{if(!creative(player))write(before)},restoreNutrition:()=>{h.setCurrentValue(oldH);sat.setCurrentValue(oldS)}}))return false;

 if(RAW_NAUSEA[id])try{player.addEffect('nausea',60,{showParticles:true})}catch{};if(id===MYSTERIOUS_ID)try{player.addEffect('nausea',100,{showParticles:true})}catch{};if(id===DARK_ID)try{player.addEffect('blindness',200,{showParticles:true})}catch{}
 if(id===SECRET_ID)secretRemainders(player,consumed);
 afterCommitted(player,id,active.meta,active,false);return true;
}

function resolvedProfile(profile,nativeDuration){return eatingProfile(profile,undefined,nativeDuration).profile}

function profileDuration(profile){return profile==='THREE'?100:90}

function writeUseHand(player,use,stack){
 if(use.hand==='off'){
  const eq=player.getComponent('minecraft:equippable');
  if(!eq||!eq.setEquipment(EquipmentSlot.Offhand,stack))throw new Error('Offhand unavailable');
 }else{
  const c=mainContainer(player);if(!c)throw new Error('Inventory unavailable');c.setItem(use.slot,stack);
 }
}

function completePlateUse(player,eventStack){
 const a=PLATE_EATS.get(player.id);PLATE_EATS.delete(player.id);
 if(!a||!completedUseStillCurrent(a.use,eventStack,heldByHand(player,a.hand),player.selectedSlotIndex,!creative(player)))return;
 let eaten,meta,next;
 const h=player.getComponent('minecraft:player.hunger'),sat=player.getComponent('minecraft:player.saturation');
 try{
  if(!h||!sat)throw new Error('Nutrition unavailable');
  const rows=a25PlateRows(a.plate),index=plateHighestNutritionIndex(rows);
  if(index<0)throw new Error('Empty plate');
  const row=rows.splice(index,1)[0];eaten=a25RestoreStack(row);if(!eaten)throw new Error('Plate food unavailable');
  const restored=primitiveStackProps(eaten);
  for(const key of Object.keys(row.props??{}))if(JSON.stringify(restored[key])!==JSON.stringify(row.props[key]))throw new Error('Plate food metadata unavailable');
  meta=stackMeta(eaten);next=rows.length?a25PlateItem(rows,a.plate):undefined;
  if(rows.length&&(!next||JSON.stringify(a25PlateRows(next))!==JSON.stringify(rows)))throw new Error('Plate data write failed');
 }catch(error){writeUseHand(player,a.use,a.plate);console.warn('[Grilling plate] '+error);return}
 const oldH=h.currentValue,oldS=sat.currentValue;
 if(!commitEating({debit:()=>writeUseHand(player,a.use,next),reward:()=>addNestedNutrition(player,eaten,meta),
  restoreFood:()=>writeUseHand(player,a.use,a.plate),restoreNutrition:()=>{h.setCurrentValue(oldH);sat.setCurrentValue(oldS)}}))return;
 const id=canonicalFoodId(eaten.typeId);dangerousPreservation(player,id);

 if(RAW_NAUSEA[id])try{player.addEffect('nausea',60,{showParticles:true})}catch{};if(id===MYSTERIOUS_ID)try{player.addEffect('nausea',100,{showParticles:true})}catch{};if(id===DARK_ID)try{player.addEffect('blindness',200,{showParticles:true})}catch{}
 if(id===SECRET_ID)secretRemainders(player,eaten);
 afterCommitted(player,id,meta,{...a,meta},false);
}

function completePending(player,stack){
 const a=PENDING_USES.get(player.id);
 if(!a||!completedUseStillCurrent(a.use,stack,heldByHand(player,a.hand),player.selectedSlotIndex))return;
 PENDING_USES.delete(player.id);stopSoundHandle(a.audio);
 // Both current Java branches finish any PENDING identity. Legacy pending
 // bottles may lack a base ingredient; EMPTY promotion owns that requirement.
 const list=readSeasonings(stack);
 const variant=Math.floor(Math.random()*(SEASONING_VARIANT_MAX+1)),out=new ItemStack(specialSeasoningVisualId(0,variant),1);setSeasonings(out,list);setUses(out,0);
 setItemProperty(out,SEASON_VARIANT_KEY,variant);setItemLore(out,seasoningLore(SEASONING_MAX_USES,list.length));
 if(JSON.stringify(readSeasonings(out))!==JSON.stringify(list)||getUses(out)!==0)throw new Error('Seasoning data write failed');
 if(commitEating({debit:()=>writeUseHand(player,a.use,out),reward:()=>{},restoreFood:()=>writeUseHand(player,a.use,a.stack),restoreNutrition:()=>{}})){seasoningFinished(player);awardSeasoningFinishedChallenges(player,list)}
}

function showEatingPresentation(e,a){
 const {id,profile,hand}=a;
 if(grillingConfig().graphicalEatingHud)showJavaEatingHud(e.source,a,system.currentTick);
 try{updatePlayerPresentation(e.source,{eat_profile:eatingProfile(profile).code,eat_hand:hand==='off'?2:1,eat_native_ticks:eatingNativeTicks(a.nativeDuration)})}catch(error){console.warn('[Grilling eating profile] '+error)}
 // Separate Java NONE-context first-person path. Do not replace the RP player
 // definition or reset body/head channels. The JSON branch gates upright use.
 if(eatingNativeTicks(a.nativeDuration)>0&&admitEatingProjection(e,profile,hand,heldByHand)){
  try{
   updatePlayerPresentation(e.source,{eat_projection:true});
   e.source.playAnimation(selectEatingProjection(e,profile,hand,heldByHand),{
    // Do not stop on a client-synced property before its update packet arrives.
    // The animation blend gate still masks inactive projection immediately.
    controller:'kg_java_eating_first_person',blendOutTime:0,
    stopExpression:"!q.is_using_item || !q.is_item_name_any('"+(hand==='off'?'slot.weapon.offhand':'slot.weapon.mainhand')+"','"+e.itemStack.typeId+"')"});
  }catch(error){console.warn('[Grilling Java first-person projection] '+error);try{updatePlayerPresentation(e.source,{eat_projection:false})}catch{}}
 }
 // Native use_item_progress can remain zero for custom food in third person.
 // Supply only its arm rotation there; retain native movement and the authored
 // attachable curves. No camera-space limb translations or whole-player reset.
 if(id.endsWith("_skewer")){
  const slot=hand==='off'?'slot.weapon.offhand':'slot.weapon.mainhand';
  try{e.source.playAnimation('animation.kg_eating.player.native_'+(hand==='off'?'left':'right'),{blendOutTime:.08,stopExpression:"!q.is_using_item || !q.is_item_name_any('"+slot+"','"+e.itemStack.typeId+"')"})}catch(error){console.warn('[Grilling eating arm pose] '+error)}
 }
 startEatingSound(e.source,a);
}

world.afterEvents.itemStartUse.subscribe(e=>{
 try{clearEatingPresentation(e.source)}catch{}
 const id=canonicalFoodId(e.itemStack?.typeId);
 if(isPendingSeasoningId(id)){const hand=captureInteractionIntent(e.source,e.itemStack).hand;
  stopSoundHandle(PENDING_USES.get(e.source.id)?.audio);
  PENDING_USES.set(e.source.id,{stack:e.itemStack.clone(),hand,use:captureEatingIdentity(e.itemStack,hand,e.source.selectedSlotIndex),audio:seasoningShakeSound(e.source)});
  try{syncSeasoningMotion(e.source,PENDING_USES.get(e.source.id))}catch(error){console.warn('[Grilling seasoning motion] '+error)}
  try{e.source.playAnimation('animation.kg_a21.player.shake.'+hand,{controller:'kg_seasoning_shake',blendOutTime:0,stopExpression:"!q.is_using_item || !q.is_item_name_any('"+(hand==='off'?'slot.weapon.offhand':'slot.weapon.mainhand')+"','"+e.itemStack.typeId+"')"})}catch{}return}
 if(id===PLATE_ID){
  const rows=a25PlateRows(e.itemStack),index=plateHighestNutritionIndex(rows);if(index<0)return;
  const selected=a25RestoreStack(rows[index]),meta=stackMeta(selected),sat=e.source.getComponent('minecraft:player.saturation'),hand=captureInteractionIntent(e.source,e.itemStack).hand;
  PLATE_EATS.set(e.source.id,{id,plate:e.itemStack.clone(),hand,use:captureEatingIdentity(e.itemStack,hand,e.source.selectedSlotIndex),meta,nativeBefore:meta.hot?nativeSnapshot(e.source):{},fxBefore:meta.hot?fxSnapshot(e.source):{},saturationBefore:meta.hot?sat?.currentValue:undefined});return;
 }
  if(CUISINE_FOOD_SET.has(id)){
   const use=captureCuisineUse(e.itemStack,heldMain(e.source),heldOff(e.source),e.source.selectedSlotIndex,system.currentTick,e.useDuration,now());
   if(!use){CUISINE_EATS.delete(e.source.id);return;}
   const meta=stackMeta(e.itemStack),sat=e.source.getComponent('minecraft:player.saturation');
   CUISINE_EATS.set(e.source.id,{id,use,meta,nativeBefore:meta.hot?nativeSnapshot(e.source):{},fxBefore:meta.hot?fxSnapshot(e.source):{},saturationBefore:meta.hot?sat?.currentValue:undefined});
   return;
  }
  if(!FOOD_DATA[id]&&id!==SECRET_ID)return;
  if(id===SECRET_ID&&!canUseSecretSkewer(e.itemStack)){stopSoundHandle(ACTIVE_EATS.get(e.source.id)?.audio);ACTIVE_EATS.delete(e.source.id);hideJavaEatingHud(e.source);forgetEatingItem(e.source.id);return;}
  const requested=PROFILE_BY_ITEM[id]??'THREE_RANDOM',hand=captureInteractionIntent(e.source,e.itemStack).hand,profile=resolvedProfile(selectedEatingProfile(requested,e.itemStack.typeId),e.useDuration),meta=stackMeta(e.itemStack),sat=e.source.getComponent('minecraft:player.saturation');
  try{syncSecretHeld(e.source,{beginHand:hand})}catch(error){console.warn('[Grilling held ingredients] '+error)}
 const a={plain:isPlainEatingId(e.itemStack.typeId),id,start:system.currentTick,nativeDuration:Math.max(0,Number(e.useDuration)||0),requested,profile,hand,use:captureEatingIdentity(e.itemStack,hand,e.source.selectedSlotIndex),meta,biteTimes:BITE_TIMES[profile]??BITE_TIMES.THREE,nextBite:0,nativeBefore:meta.hot?nativeSnapshot(e.source):{},fxBefore:meta.hot?fxSnapshot(e.source):{},saturationBefore:meta.hot?sat?.currentValue:undefined};
 stopSoundHandle(ACTIVE_EATS.get(e.source.id)?.audio);ACTIVE_EATS.set(e.source.id,a);
 if(a.plain)return; // JSON owns 25-tick vanilla use; no custom motion, sound or HUD.
 showEatingPresentation(e,a);
});

world.afterEvents.itemCompleteUse.subscribe(e=>{
 const id=canonicalFoodId(e.itemStack?.typeId);if(id==='minecraft:milk_bucket'){clearEffects(e.source,{milk:true});return}if(isPendingSeasoningId(id)){completePending(e.source,e.itemStack);return}
 if(id===PLATE_ID){completePlateUse(e.source,e.itemStack);return}
  dangerousPreservation(e.source,id);
  if(CUISINE_FOOD_SET.has(id)){
   const a=CUISINE_EATS.get(e.source.id);
   if(!a||a.id!==id||!completedCuisineUse(a.use,e.itemStack,heldByHand(e.source,a.use.hand),e.source.selectedSlotIndex,system.currentTick,e.useDuration,now()))return;
   CUISINE_EATS.delete(e.source.id);a.meta=finishedFoodMeta(a.meta,now());afterCommitted(e.source,id,a.meta,a,true);return;
  }
  if(!FOOD_DATA[id]&&id!==SECRET_ID)return;
 const a=ACTIVE_EATS.get(e.source.id);
 if(!a||a.id!==id||!eatingEventMatches(a.use,e.itemStack,now())||!nativeEatingCompleted(a.start,system.currentTick,a.nativeDuration,e.useDuration))return;
 if(!completedEatingStillCurrent(a.use,e.itemStack,heldByHand(e.source,a.hand),e.source.selectedSlotIndex,now(),!creative(e.source)))return;
 if(id===SECRET_ID&&!canUseSecretSkewer(e.itemStack))return;
 a.meta=finishedFoodMeta(a.meta,now());
 // Publish completion ownership before presentation reset, even if the held
 // snapshot still contains the just-consumed single serving this callback.
 if(id===SECRET_ID||isFailureSkewer(id))try{syncSecretHeld(e.source,{completedUse:a.use})}catch(error){console.warn('[Grilling held completion] '+error)}
 stopEatSound(e.source,a.profile);SETTLED.set(e.source.id,system.currentTick);ACTIVE_EATS.delete(e.source.id);hideJavaEatingHud(e.source);forgetEatingItem(e.source.id);try{clearEatingPresentation(e.source)}catch{}
 if(id===SECRET_ID){addSecretNutrition(e.source,e.itemStack,{hot:false})}
 if(RAW_NAUSEA[id])try{e.source.addEffect('nausea',60,{showParticles:true})}catch{};if(id===MYSTERIOUS_ID)try{e.source.addEffect('nausea',100,{showParticles:true})}catch{};if(id===DARK_ID)try{e.source.addEffect('blindness',200,{showParticles:true})}catch{}
 if(id===SECRET_ID)secretRemainders(e.source,e.itemStack);
 afterCommitted(e.source,id,a.meta,a,true);
});

world.afterEvents.itemStopUse.subscribe(e=>{
 // Completion and stop can share a tick. Clear only the stopped session, after
 // completion has had a chance to commit; never delete a new use session.
 const id=e.source.id,plate=PLATE_EATS.get(id),pending=PENDING_USES.get(id),cuisine=CUISINE_EATS.get(id);
 const pendingMatches=!e.itemStack||!pending||eatingEventMatches(pending.use,e.itemStack,now());
 system.run(()=>{if(PLATE_EATS.get(id)===plate)PLATE_EATS.delete(id);if(pendingMatches&&PENDING_USES.get(id)===pending){stopSoundHandle(pending?.audio);PENDING_USES.delete(id)}});
 const cuisineMatches=!e.itemStack||!cuisine||cuisineUseEventMatches(cuisine.use,e.itemStack,now());
 system.run(()=>{if(cuisineMatches&&CUISINE_EATS.get(id)===cuisine)CUISINE_EATS.delete(id)});
 const a=ACTIVE_EATS.get(id);if(!a)return;
 if(e.itemStack&&!eatingEventMatches(a.use,e.itemStack,now()))return;
 if(a.start===system.currentTick&&SETTLED.get(id)===system.currentTick)return;
 const used=system.currentTick-a.start;stopEatSound(e.source,a.profile);
 // Capture elapsed at release, not in the deferred callback: a 23-tick release
 // must not become eligible merely because cleanup runs a tick later.
 // Let native completion win either event order; never delete a newer session.
 const settleReleased=()=>{if(ACTIVE_EATS.get(id)!==a)return;ACTIVE_EATS.delete(id);hideJavaEatingHud(e.source);forgetEatingItem(id);try{clearEatingPresentation(e.source)}catch{};if(!a.plain&&e.itemStack&&used+RELEASE_CHECKPOINT_GRACE_TICKS>=MINIMUM_EAT_TICKS&&hungerSettle(e.source,a.id,a))SETTLED.set(id,system.currentTick);if(a.id===SECRET_ID||isFailureSkewer(a.id))try{syncSecretHeld(e.source)}catch(error){console.warn('[Grilling held release] '+error)}};
 // A proven nonterminal stop cannot race native completion. Settle in this
 // writable after-event, like Java releaseUsing, before leave clears the session.
 // Terminal/unknown clocks retain deferred completion ownership; before-leave
 // stays read-only and no offline Player reference is used for gameplay writes.
 const immediate=!a.plain&&e.itemStack&&used+RELEASE_CHECKPOINT_GRACE_TICKS>=MINIMUM_EAT_TICKS&&
  Number.isInteger(a.nativeDuration)&&a.nativeDuration>0&&a.nativeDuration<=72000&&Number.isInteger(used)&&used>=0&&used+1<a.nativeDuration&&
  Number.isInteger(e.useDuration)&&e.useDuration>0&&e.useDuration<=a.nativeDuration;
 if(immediate)settleReleased();else system.run(settleReleased);
});

function canUseSecretSkewer(stack){
 return !!secretEatingData(stack);
}

world.beforeEvents.itemUse.subscribe(e=>{
 if(e.cancel)return;
 if(!canUseCuisineFood(e.itemStack)){e.cancel=true;return;}
 if(canonicalFoodId(e.itemStack?.typeId)===SECRET_ID&&!canUseSecretSkewer(e.itemStack)){e.cancel=true;return}
 try{
  const action=skewerAction(e.source,e.itemStack);
  if(action){e.cancel=true;scheduleSkewerAction(e.source,action);return}
  if(e.source.isSneaking&&isHot(e.itemStack)&&!heldOff(e.source)&&isFoodStack(e.itemStack)){
   e.cancel=true;const p=e.source,intent=captureInteractionIntent(p,e.itemStack),sample=e.itemStack.clone();
   system.run(()=>{if(interactionIntentStillCurrent(p,intent)){const c=mainContainer(p);if(c)compactMatchingHotFood(c,sample)}});
   return;
  }
 }catch{}
 // Java non-eating interactions above retain priority, even at full hunger.
 const edibleSkewer=!!FOOD_DATA[e.itemStack?.typeId]||canonicalFoodId(e.itemStack?.typeId)===SECRET_ID||e.itemStack?.typeId===PLATE_ID;
 if(!edibleSkewer)return;
 if(e.source.isSneaking){e.cancel=true;return;}
 const animations=grillingConfig().enableEatingAnimations;
 if(SKEWER_EATING_IDS.has(canonicalFoodId(e.itemStack.typeId))&&isPlainEatingId(e.itemStack.typeId)===animations){
  // Offhand-only API writes emit no inventory event on the selected engine.
  // Refuse an unprepared duration at the input boundary; retain the captured
  // hand/metadata check before preparing it outside restricted execution.
  e.cancel=true;const player=e.source,intent=captureInteractionIntent(player,e.itemStack);
  system.run(()=>{if(interactionIntentStillCurrent(player,intent))prepareEatingItems(player,ACTIVE_EATS.has(player.id)||hasPendingHandAction(player.id),grillingConfig().enableEatingAnimations)});return;
 }
 if(!grillingConfig().fullHungerEating){const h=e.source.getComponent('minecraft:player.hunger');if(h&&h.currentValue>=h.effectiveMax)e.cancel=true;}
});


function tickPlayerFood(p,slimeFrame){
syncSlimeHeld(p,slimeFrame);
  syncOilBrushVisual(p,{idle:false});
  try{syncSeasoningMotion(p,PENDING_USES.get(p.id))}catch(error){if(system.currentTick%20===0)console.warn('[Grilling seasoning motion] '+error)}
  const active=ACTIVE_EATS.get(p.id),handActionPending=hasPendingHandAction(p.id);
  try{prepareBottleFillItems(p,!!active||PENDING_USES.has(p.id)||handActionPending)}catch(error){if(system.currentTick%20===0)console.warn('[Grilling native bottle item] '+error)}
  try{prepareChangedEatingItems(p,!!active||handActionPending,grillingConfig().enableEatingAnimations)}catch(error){if(system.currentTick%20===0)console.warn('[Grilling native eating item] '+error)}
  if(active&&eatingStillCurrent(active.use,heldByHand(p,active.hand),p.selectedSlotIndex,now())){
   if(active.presentationHidden){
    if(!active.plain)showEatingPresentation({source:p,itemStack:heldByHand(p,active.hand)},active);
    active.presentationHidden=false;
   }
   // Do not assume a remote custom-item countdown matches the owner's clock.
   // Replicate source session time; native food debit/reward stays event-owned.
   updatePlayerPresentation(p,{eat_elapsed_ticks:eatingElapsedTicks(active.start,system.currentTick,active.nativeDuration)});
   if(!active.plain&&!active.audioStarted&&(active.audioAttempts??0)<3&&system.currentTick%5===0)startEatingSound(p,active);!active.plain&&advanceBites(p,active);if(!active.plain&&grillingConfig().graphicalEatingHud)showJavaEatingHud(p,active,system.currentTick);else hideJavaEatingHud(p);
  }else if(active){
   active.presentationHidden=true;
   hideJavaEatingHud(p);
   // A replaced/switching serving must not leave a projected arm on another item.
   clearEatingPresentation(p);
  }else hideJavaEatingHud(p);
  // A terminal reset may fail after the use session has already ended. Retry
  // its desired presentation through this existing player tick, even at rest.
  try{flushPlayerPresentation(p)}catch(error){if(system.currentTick%20===0)console.warn('[Grilling presentation retry] '+error)}
}
function hasFoodUse(id){return ACTIVE_EATS.has(id)||PENDING_USES.has(id);}
function forgetFoodUse(id){
 stopSoundHandle(ACTIVE_EATS.get(id)?.audio);stopSoundHandle(PENDING_USES.get(id)?.audio);
 for(const cache of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,PENDING_USES,SETTLED])cache.delete(id);
}
function forgetPlayerFood(id){forgetJavaEatingHud(id);forgetEatingItem(id);forgetFoodUse(id);}
export {DANGEROUS_FOODS,canUseSecretSkewer,forgetFoodUse,forgetPlayerFood,hasFoodUse,tickPlayerFood};
