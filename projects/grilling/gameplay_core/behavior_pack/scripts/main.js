import {isOwnedBottleLore,bottleLoreSignature,bottleLoreMismatch} from './bottle_lore_core.js';
import {flatulenceSoundOrigin,flatulenceSoundPitch} from './flatulence_sound_runtime.js';
import {tryProjectileDodgeMovement} from './projectile_dodge_movement_runtime.js';
import {isCookeryLivingEntity} from './cookery_living_class.js';
import {projectileDodgeTeleportFeedback,FLATULENCE_SOUND_ID} from './projectile_dodge_audio_runtime.js';
import {reserveProjectileDodge,settleProjectileDodge,abandonProjectileDodge,forgetProjectileDodge} from './projectile_dodge_runtime.js';
import {handleHeavyMetalBeforeHurt,forgetHeavyMetalRescue} from './heavy_metal_damage_runtime.js';
import {retargetBottleFillStack,prepareBottleFillItems} from './bottle_fill_item_runtime.js';
import {isPlainEatingId,SKEWER_EATING_IDS} from './eating_profile_ids.js';
import {beginSeasoningMotion,syncSeasoningMotion} from './seasoning_motion_runtime.js';
import {supportsJavaEatingProjection} from './java_eating_projection_items.js';
import {canonicalFoodId} from './eating_profile_ids.js';
import {prepareEatingItems,forgetEatingItem,selectedEatingProfile} from './eating_item_runtime.js';
import {invincibleDamageFeedback,invincibleAmbientFeedback,goldenSkewerFeedback,ordinaryShieldFeedback,ordinaryFatalFeedback} from './immersion_effect_feedback.js';
import {interactionParticleBurst,grillAmbientParticles} from './immersion_particles_runtime.js';
import './hot_lore_runtime.js';
import './bottle_held_visual_runtime.js';
import './plate_held_visual_runtime.js';
import './integration_api_runtime.js';
import {grillingConfig} from './server_config_runtime.js';
import {seasoningLore,creatorLore} from './localized_lore_core.js';
import {readEffects,writeEffects,clearEffects} from './effect_state_runtime.js';
import {nativeDragonHealth,forgetDragonHealth} from './dragon_native_health.js';
import {finishedFoodMeta} from './food_finish_core.js';
import {eatingProfile,eatingNativeTicks,eatingElapsedTicks,nativeEatingCompleted,EAT_ELAPSED_TICKS_PROPERTY,EAT_NATIVE_TICKS_PROPERTY,EAT_PROFILE_PROPERTY,EAT_HAND_PROPERTY,EAT_PROJECTION_PROPERTY} from './player_presentation_core.js';
import {SECRET_MODEL_VARIANTS_KEY,appendedModelVariants} from './secret_visual_state_core.js';
import {configureSecretGrillReader} from './grill_visual_runtime.js';
import {configureSecretHeldReader,syncSecretHeld} from './secret_held_runtime.js';
import {configureSecretVisuals} from './station_contents_visual_runtime.js';
import {foodFacts} from './food_snapshot_core.js';
import {canUseCuisineFood,captureCuisineUse,cuisineUseEventMatches,completedCuisineUse} from './cuisine_eating_core.js';
import {updateGrillAudio,removeGrillAudio,blockSound,useSound,seasoningShakeSound,stopSoundHandle,seasoningFinished} from './immersion_audio_runtime.js';
import {updateNumbVisual,forgetNumbVisual,suppressNumbVisual} from './numb_visual_runtime.js';
import {captureSkewerMetadata,restoreSkewerMetadata,metadataSignature} from './skewer_item_snapshot.js';
import {readNativeBottles,isNativeBottleItem} from './seasoning_native_storage.js';
import {slotWrite,planInventoryInsert} from './rack_transfer_plan.js';
import {nativeItemSignature,ownedItemStep,planOwnedInventoryDelivery,commitPlayerItemTransaction} from './owned_item_transaction_core.js';
import {acknowledgedDrop,commitStationTransfer} from './grill_transfer.js';
import './dragon_powder_runtime.js';
import './a288_parity_runtime.js';
import {getItemProperty,setItemProperty,getItemPropertyIds,getItemLore,getItemRawLore,setItemLore} from './itemData.js';
import {hasSolidTop} from './blockSupport.js';
import {stationContainer,peekStationContainer,retireEmptyStationContainer,quarantineStation,inspectStationStorage,storageKey as stationStorageKey} from './family_station_storage.js';
import {rolledIngredientEffects} from './a285_ingredient_effects.js';
import {resolveSecretSmokedId} from './secret_compat_core.js';
import {emitSecretIngredientConsumed} from './secret_compat_runtime.js';
import {
 skewerIngredientDecision,customSkewerCookedId,isCompatRawSkewer
} from './skewer_compat_core.js';
import './skewer_compat_runtime.js';
import {EquipmentSlot,GameMode,EnchantmentType} from '@minecraft/server';
import {captureEatingIdentity,eatingStillCurrent,eatingEventMatches,commitEating} from './a285_eating_transaction.js';
import {completedUseStillCurrent} from './a2810_use_transaction.js';
import {interactionFeedback,interactionFailure,javaInteractionFeedback,javaInteractionChat} from './a283_interaction_feedback.js';
import {showJavaEatingHud} from './java_eating_hud_runtime.js';
import {refreshPlacedBottleAfterPickup} from './a2770_placed_visual_runtime.js';
import './guide/main.js';
import {world,system,ItemStack,BlockPermutation} from '@minecraft/server';
import {RAW_TO_COOKED,FOOD_DATA,PROFILE_BY_ITEM,COOKED_EFFECTS,RAW_NAUSEA,OIL_TOOLS,GRILL_ID,SEASONING_ID,EMPTY_SEASONING_ID,MYSTERIOUS_ID,DARK_ID} from './eating_data_lookup.js';
import {initialState,normalizeState,tickState,light,brush,flip,season,canInsert,canExtract,breakDisposition,outputKind} from './core_logic.js';
import {grillStateKey as stateKey,readGrillState as readState,occupiedGrillSlots as occupied} from './a2740_grill_state_adapter.js';
import {mergeIntoContainer,compactSkewerContainer,compactMatchingHotFood,isFoodStack} from './a23_hot_runtime.js';
import './a23_oil_world.js';
import './oil_pot_ambient_runtime.js';
import {UNFINISHED_ID,SECRET_ID,SKEWER_INGREDIENTS_KEY,SECRET_COOKED_KEY,SECRET_COOKED_INGREDIENTS_KEY,SECRET_CREATOR_KEY,FLUID_CAPACITY,appendOutcome,secretFood,isDisassemblableRaw,canAppendConfigured,isConfiguredIngredient} from './a24_skewering_core.js';
import {PLATE_ID,plateHighestNutritionIndex} from './a25_plate_recipe_core.js';
import {a25PlateRows,a25PlateItem,a25RestoreStack} from './a25_plate_recipe_runtime.js';
import './a26_oil_machine_runtime.js';
import './a2727_cookery_host_recipes_runtime.js';
import {COOKERY_FILLED_ID as COOKERY_FILLED,planCookeryOilPotConsumption} from './a2734_cookery_oil_pot_adapter.js';
import {ensureOilHandPublished} from './oil_api_client.js';
import {playerInventory as mainContainer,getMainHand as heldMain,setMainHand as setMain,getOffHand as heldOff,setOffHand as setOff,getHand as heldByHand,findHandEntry as handFor,setHand,isCreative as creative} from './a2735_player_io.js';
import {
 SEASONING_CAPACITY,SEASONING_MAX_BOTTLES,SEASONING_MAX_USES,SEASONING_VARIANT_MAX,
 PENDING_SEASONING_ID as PENDING_SEASONING,SEASONING_PLACE_BLOCK_ID as SEASONING_BLOCK,
 SEASONING_USES_KEY as SEASON_USES_KEY,
 SEASONING_VARIANT_KEY as SEASON_VARIANT_KEY,isSeasoningIngredient,seasoningEffectCounts,
 hasSeasoningBase,isPendingSeasoningId,seasoningFillVisualId,isSeasoningBlockId as isSeasoningBlock
} from './a2743_seasoning_contract_core.js';
import {
 readPlacedSeasoningStack as readBottleStack,writePlacedSeasoningStack as writeBottleStack
} from './a2743_seasoning_block_adapter.js';
import {
 readFoodSeasonings as readSeasonings,setFoodSeasonings as setSeasonings,
 setHotFood as setHot,hotUntil,isHotFood as isHot,refreshHotLore
} from './a2750_food_state_adapter.js';
import {WOK_FOOD_IDS} from './a2750_wok_food_core.js';
import {STOCKPOT_FOOD_IDS} from './a2752_stockpot_food_core.js';
import './a2736_typed_oil_pot_block_runtime.js';
import './a2737_offhand_oil_fill_runtime.js';
import './a2739_crosshair_hud_runtime.js';
import './a2739_oil_pot_hud_provider.js';
import './a2740_grill_hud_provider.js';
import './a2741_oil_press_hud_provider.js';
import './a2742_big_vat_hud_provider.js';
import './a2743_seasoning_hud_provider.js';
import './a2744_skewer_plate_hud_provider.js';
import './a2746_advanced_rack_runtime.js';
import './a2745_skewer_recipe_hud_provider.js';
import './a271_sweet_potato_runtime.js';
import {tryScheduleBeefBoardOverride} from './a279_beef_board_runtime.js';
import './a2710_chicken_acquisition_runtime.js';
import './a2712_remaining_knife_drops_runtime.js';
import './a2714_houttuynia_crop_runtime.js';
import './a2731_farmland_crop_host_runtime.js';
import './a2732_standalone_food_effect_runtime.js';
import './a2747_wedding_candy_runtime.js';
import './a2748_pepper_tree_runtime.js';
import './a2759_pepper_worldgen_fruiting_runtime.js';
import './a2860_pepper_worldgen_seed_runtime.js';
import './a2750_cookery_cuisine_runtime.js';
import {awardLookingThePart,awardGleamingWithOil,awardSeasoningMilestones,awardEatItHot} from './a2756_advancement_event_runtime.js';
import {awardSeasoningFinishedChallenges,awardMentalPreparationFailed,awardMetalToleranceFailed,awardOrdinaryChallenge,ordinaryChallengeOutcome} from './a2758_advancement_challenge_runtime.js';
import './a2722_cold_houttuynia_runtime.js';
import {isExtinguishTool,isInitialBlockPress,nextDurability} from './a275_grill_input_core.js';
import {primitiveStackProps,captureInteractionIntent,interactionIntentStillCurrent} from './a2762_interaction_intent_adapter.js';
import {commitSteps,commitTwoParty,chooseExtractDelivery} from './a277_grill_transaction_core.js';
import {captureWritableHand} from './a2735_player_io.js';
import {captureTwoHandIntent,twoHandIntentStillCurrent} from './a2762_interaction_intent_adapter.js';
import {seasoningBlockKey} from './a2743_seasoning_block_adapter.js';
import {markPlacedVisualDirty} from './a2770_placed_visual_queue.js';
import {tickGrillDisplay} from './grill_visual_runtime.js';
import {isSpecialSeasoningId,specialSeasoningVisualId} from './a2766_special_seasoning_visual_core.js';
import {retargetSpecialSeasoningStack,specialSeasoningVariant} from './a2766_special_seasoning_visual_runtime.js';

const GRILL_LEGS_ID='kaleidoscope_grilling:grill_legs';
// Java MultiBiteSkewerItem: readiness remains 25 ticks; release alone gets one tick of grace.
const MINIMUM_EAT_TICKS=25,RELEASE_CHECKPOINT_GRACE_TICKS=1;
const ACTIVE_EATS=new Map(),CUISINE_EATS=new Map(),PLATE_EATS=new Map(),PENDING_USES=new Map(),SETTLED=new Map(),VIGOR_LAST=new Map(),SNEAK_LAST=new Map(),THREAD_LAST=new Map();
const CUISINE_FOOD_SET=new Set([...WOK_FOOD_IDS,...STOCKPOT_FOOD_IDS]);
const FX_KEY='kaleidoscope_grilling:a21_fx';
const HEAT_BLOCKS=new Set(['minecraft:fire','minecraft:soul_fire','minecraft:lava','minecraft:campfire','minecraft:soul_campfire','minecraft:magma']);
const TUNDRA_BLOCKS=new Set(['minecraft:snow','minecraft:snow_layer','minecraft:snow_block','minecraft:powder_snow','minecraft:ice','minecraft:packed_ice','minecraft:blue_ice','minecraft:frosted_ice']);
const DANGEROUS_FOODS=new Set(['minecraft:rotten_flesh','minecraft:chicken','minecraft:poisonous_potato','minecraft:pufferfish','minecraft:spider_eye']);
const BITE_TIMES=Object.freeze({
 ONE:[1.16667,3.08333],TWO:[0.95833,4.0],THREE:[0.95833,2.33333,3.54167],THREE_ALT:[0.95833,2.16667,3.5],FOUR:[0.95833,2.33333,3.45833,4.08333]
});
const STORAGE_SORT_BLOCKS=new Set(['minecraft:chest','minecraft:trapped_chest','minecraft:barrel']);
const OIL_TYPES=Object.freeze({canola:{heatTicks:1200},secret_chili:{heatTicks:12000},premium_chili:{heatTicks:24000}});
function writeTickState(block,before,next){
 const state=normalizeState(next),beforeState=normalizeState(before);
 const same=beforeState.phase===state.phase&&beforeState.phaseTicks===state.phaseTicks&&beforeState.flips===state.flips&&beforeState.flipCooldown===state.flipCooldown&&beforeState.seasoned===state.seasoned&&beforeState.failed===state.failed&&beforeState.heatTicks===state.heatTicks&&beforeState.lit===state.lit&&beforeState.seasonings.length===state.seasonings.length&&beforeState.seasonings.every((x,i)=>x===state.seasonings[i]);
 if(!same)world.setDynamicProperty(stateKey(block),JSON.stringify(state));
 // Java updateShape changes LEGGED when support below changes. Keep that visual/support sync live even on an otherwise idle grill.
 syncGrillPermutation(block,state);
 return state;
}
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


function now(){try{return world.getAbsoluteTime()}catch{return system.currentTick}}
const message=interactionFeedback;
function inv(block){return stationContainer(block)}
function grillDirection(block){
 try{const d=String(block.permutation.getState('minecraft:cardinal_direction')??'north');return ['north','south','west','east'].includes(d)?d:'north'}catch{return 'north'}
}
function removeGrillLegs(block,below){
 try{below??=block.below();if(below?.typeId===GRILL_LEGS_ID)below.setType('minecraft:air')}catch{}
}
function ensureGrillLegs(block,below){
 try{below??=block.below();
  if(!below)return false;
  if(below.typeId!==GRILL_LEGS_ID&&below.typeId!=='minecraft:air')return false;
  if(below.typeId==='minecraft:air')below.setType(GRILL_LEGS_ID);
  let p=below.permutation,dir=grillDirection(block);
  if(p.getState('kaleidoscope_grilling:direction')!==dir)below.setPermutation(p.withState('kaleidoscope_grilling:direction',dir));
  return true;
 }catch{return false}
}
function syncGrillPermutation(block,state){
 try{
  let below=block.below(),helper=below?.typeId===GRILL_LEGS_ID,supported=!helper&&(hasSolidTop(below)),legged=!supported,lit=!!state.lit;
  if(legged)ensureGrillLegs(block,below);else if(helper)removeGrillLegs(block,below);
  let perm=block.permutation,changed=false;
  if(perm.getState('kaleidoscope_grilling:legged')!==legged){perm=perm.withState('kaleidoscope_grilling:legged',legged);changed=true}
  if(perm.getState('kaleidoscope_grilling:lit')!==lit){perm=perm.withState('kaleidoscope_grilling:lit',lit);changed=true}
  if(changed)block.setPermutation(perm);
 }catch{}
}
function writeState(block,s){const state=normalizeState(s);world.setDynamicProperty(stateKey(block),JSON.stringify(state));syncGrillPermutation(block,state)}
function clearState(block){world.setDynamicProperty(stateKey(block))}
function key(block){const p=block.location;return [block.dimension.id,p.x,p.y,p.z].join('|')}
function decrementHand(player,hand,count=1){
 if(creative(player))return true;const s=heldByHand(player,hand);if(!s||s.amount<count)return false;
 if(s.amount===count)setHand(player,hand,undefined);else{s.amount-=count;setHand(player,hand,s)}return true;
}
function decrementMain(player,count=1){return decrementHand(player,'main',count)}
function planDamagedHand(player,hand,amount=1){
 const stack=heldByHand(player,hand);if(!stack)return {ok:false,reason:'missing'};
 const before=stack.clone();
 if(creative(player))return {ok:true,before,next:before.clone(),mutate:false,broken:false};
 try{
  const durability=stack.getComponent('minecraft:durability');if(!durability)return {ok:false,reason:'not_durable'};
  const plan=nextDurability(durability.damage,durability.maxDurability,amount,!!durability.unbreakable);
  if(plan.broken)return {ok:true,before,next:undefined,mutate:true,broken:true};
  const next=stack.clone(),d=next.getComponent('minecraft:durability');if(!d)return {ok:false,reason:'not_durable'};
  d.damage=plan.damage;return {ok:true,before,next,mutate:true,broken:false};
 }catch{return {ok:false,reason:'durability_error'}}
}
function transactionStatus(result,label){
 if(!result.ok)console.warn('[Grilling '+label+'] '+String(result.error)+'; rollback failures='+result.rollbackErrors);
 return result.ok;
}
function commitGrillAndHand(block,beforeState,nextState,player,hand,beforeStack,nextStack,mutateHand=true){
 // The operation planner owns Creative rules: durability is exempt, while
 // Java brushing and seasoning consume their tool contents in either mode.
 const storage=captureWritableHand(player,hand),mutate=mutateHand;
 return commitStationTransfer(block,[
  {apply:()=>writeState(block,nextState),rollback:()=>writeState(block,beforeState)},
  {apply:()=>{if(mutate)storage.write(nextStack)},rollback:()=>{if(mutate)storage.write(storage.before)}}
 ],'grill/hand').ok;
}
function reducedStack(stack,count=1){
 if(!stack||stack.amount<count)throw new Error('Grilling: insufficient input');
 if(stack.amount===count)return undefined;
 const next=stack.clone();next.amount-=count;return next;
}
function prepareOutputDelivery(player,outputs,startingItems){
 return planOwnedInventoryDelivery(mainContainer(player),outputs,{startingItems,dimension:player.dimension,location:player.location});
}
function give(player,stack){const c=mainContainer(player);if(!c)return;const rem=mergeIntoContainer(c,stack);if(rem)player.dimension.spawnItem(rem,player.location)}
function copyOne(stack){const out=stack.clone();out.amount=1;return out}
function copyCustomData(from,to){
 try{if(from.nameTag)to.nameTag=from.nameTag}catch{}
 let lore=[];try{lore=getItemRawLore(from)}catch{}
 let ids=[];try{ids=getItemPropertyIds(from)}catch{}
 try{if(lore.length)setItemLore(to,lore);else if(ids.length)setItemLore(to,['§r'])}catch{}
 for(const id of ids)try{setItemProperty(to,id,getItemProperty(from,id))}catch{}
 return to;
}
function ingredientSnapshot(stack,full=false){
 let {nutrition,saturation,convertTo,edible}=foodFacts(stack);
 if(canonicalFoodId(stack.typeId)===SECRET_ID){const food=secretFood(readEffectiveSkewerRows(stack),isSecretCooked(stack),readSkewerRows(stack));nutrition=food.nutrition;saturation=food.saturation;edible=true;}
 let tags=[];try{tags=(stack.getTags?.()??[]).map(String).filter(x=>/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(x)).slice(0,64)}catch{}
 let lore=[];try{lore=getItemLore(stack)}catch{}
 let name='';try{name=stack.nameTag??''}catch{}
 const props=primitiveStackProps(stack),native=full?captureSkewerMetadata(stack):undefined;
 const signature=native?metadataSignature(native):JSON.stringify({id:stack.typeId,name,lore,props});
 return native?{id:stack.typeId,nutrition,saturation,convertTo,edible,tags,native}:{id:stack.typeId,nutrition,saturation,convertTo,edible,name,lore,props,tags,signature};
}
function restoreIngredient(row){
 if(row?.native&&row.native.id!==row.id)throw Error('Grilling: ingredient identity mismatch');
 if(row?.native)return restoreSkewerMetadata(row.native,(id,n)=>new ItemStack(id,n),id=>new EnchantmentType(id));
 const out=new ItemStack(row.id,1),props=row.props&&typeof row.props==='object'?row.props:{};
 if(row.name)out.nameTag=row.name;
 const lore=Array.isArray(row.lore)?row.lore:[];setItemLore(out,lore);
 for(const [id,value] of Object.entries(props))setItemProperty(out,id,value);
 if((out.nameTag??'')!==(row.name??'')||JSON.stringify(getItemLore(out))!==JSON.stringify(lore)||metadataSignature(primitiveStackProps(out))!==metadataSignature(props))throw Error('Grilling: legacy ingredient metadata readback differs');
 return out;
}
function behaviorRemainder(behavior){
 const spec=behavior?.remainder??(behavior?.convertTo?{id:behavior.convertTo,count:1}:undefined);
 if(!spec?.id)return undefined;
 let out;try{out=new ItemStack(spec.id,Math.max(1,Math.min(64,Number(spec.count)||1)))}catch{return undefined}
 try{if(spec.name)out.nameTag=spec.name}catch{}
 const props=spec.props&&typeof spec.props==='object'?spec.props:{},keys=Object.keys(props);
 try{if(Array.isArray(spec.lore)&&spec.lore.length)setItemLore(out,spec.lore);else if(keys.length)setItemLore(out,['§r'])}catch{}
 for(const id of keys)try{setItemProperty(out,id,props[id])}catch{}
 return out;
}
function readRowsFromKey(stack,key){
 const raw=getItemProperty(stack,key);if(raw===undefined)return [];
 if(typeof raw!=='string')throw Error('Grilling: invalid ingredient data');
 const rows=JSON.parse(raw);
 if(!Array.isArray(rows)||rows.length>3||rows.some(x=>!x||typeof x.id!=='string'))throw Error('Grilling: invalid ingredient rows');
 return rows;
}
function readSkewerRows(stack){return readRowsFromKey(stack,SKEWER_INGREDIENTS_KEY)}
function validSecretIngredientRows(rows){return Array.isArray(rows)&&rows.length===3&&rows.every(row=>row&&/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(row.id)&&(!row.native||(row.native.version===1&&row.native.id===row.id)))}
function isSecretCooked(stack){try{return canonicalFoodId(stack?.typeId)===SECRET_ID&&getItemProperty(stack,SECRET_COOKED_KEY)===true}catch{return false}}
// Default item/plate semantics follow Cooked. A grill renderer may explicitly
// request cached cooked rows at visual stage >=4 without finishing the item.
function readEffectiveSkewerRows(stack,preferCookedSnapshot=isSecretCooked(stack)){if(preferCookedSnapshot){const cooked=readRowsFromKey(stack,SECRET_COOKED_INGREDIENTS_KEY);if(cooked.length)return cooked}return readSkewerRows(stack)}
function rowLabel(row){return String(row.id??'').replace(/^.*:/,'').replaceAll('_',' ')}
function writeSkewerRows(stack,rows){
 const clean=(rows??[]).filter(x=>x&&typeof x.id==='string').slice(0,3);
 try{
  setItemLore(stack,[{translate:'tooltip.kaleidoscope_grilling.skewer.progress',with:[String(clean.length),'3']},...clean.map((row,index)=>{let name;try{const item=new ItemStack(row.id);name=item.localizationKey?{translate:item.localizationKey}:undefined}catch{}return {rawtext:[{translate:'tooltip.kaleidoscope_grilling.skewer.ingredient',with:[String(index+1)]},{text:' '},row.native?.name||row.name?{text:row.native?.name??row.name}:name??{text:row.id}]}})]);
  setItemProperty(stack,SKEWER_INGREDIENTS_KEY,JSON.stringify(clean));
 }catch{}
 return stack;
}
function setSecretCreator(stack,player){
 try{const creator={name:player.name,id:player.id};setItemProperty(stack,SECRET_CREATOR_KEY,JSON.stringify(creator));const lore=getItemRawLore(stack);lore.push(creatorLore(player.name));setItemLore(stack,lore)}catch{}
 return stack;
}
function cookedIngredientRows(rows){
 return (rows??[]).map(row=>{const id=resolveSecretSmokedId(row);if(!id)return row;try{const result=ingredientSnapshot(new ItemStack(id,1),true);return result.edible?result:row}catch{return row}});
}
function setCookedIngredientRows(stack,rows){
 const cached=readRowsFromKey(stack,SECRET_COOKED_INGREDIENTS_KEY);
 if(getItemProperty(stack,SECRET_COOKED_INGREDIENTS_KEY)!==undefined){if(!validSecretIngredientRows(cached))throw Error('Grilling: invalid cooked ingredient cache');return stack;}
 if(!validSecretIngredientRows(rows))throw Error('Grilling: invalid raw ingredient rows');
 const cooked=cookedIngredientRows(rows);if(!validSecretIngredientRows(cooked))throw Error('Grilling: invalid cooked ingredient snapshot');
 const value=JSON.stringify(cooked);setItemProperty(stack,SECRET_COOKED_INGREDIENTS_KEY,value);
 if(getItemProperty(stack,SECRET_COOKED_INGREDIENTS_KEY)!==value)throw Error('Grilling: cooked ingredient data was not saved');return stack;
}
function dynamicFood(stack){return canonicalFoodId(stack?.typeId)===SECRET_ID?secretFood(readEffectiveSkewerRows(stack),isSecretCooked(stack),readSkewerRows(stack)):FOOD_DATA[stack?.typeId]}
function isEdible(stack){if(stack?.typeId==='kaleidoscope_grilling:sweet_potato_powder')return false;try{return foodFacts(stack).edible}catch{return false}}
function threadOutcome(player){
 const food=heldMain(player),off=heldOff(player);if(!food||!off||player.isSneaking)return null;
 if(off.typeId!=='minecraft:stick'&&off.typeId!==UNFINISHED_ID&&!(canonicalFoodId(off.typeId)===SECRET_ID&&!isSecretCooked(off)))return null;
 const rows=off.typeId==='minecraft:stick'?[]:readSkewerRows(off);
 const identity=ingredientSnapshot(food);
 const configured=canAppendConfigured(rows,identity)||isConfiguredIngredient(identity);
 let explicitAllow=false;
 if(!configured){
  const decision=skewerIngredientDecision(identity);
  if(decision==='deny')return null;
  explicitAllow=decision==='allow';
 }
 return appendOutcome(rows,identity,isEdible(food),explicitAllow);
}
function canDisassembleOff(player){const off=heldOff(player);return !!off&&isDisassemblableRaw(off.typeId,isSecretCooked(off))&&(off.typeId===UNFINISHED_ID||readSkewerRows(off).length>0)}
function threadCurrent(player){
 const main=captureWritableHand(player,'main'),other=captureWritableHand(player,'off');
 const food=main.before,off=other.before,outcome=threadOutcome(player);if(!food||!off||!outcome?.ok)return false;
 const rows=off.typeId==='minecraft:stick'?[]:readSkewerRows(off),nextRows=[...rows,ingredientSnapshot(food,true)],next=new ItemStack(outcome.id,1);
 restoreIngredient(nextRows[nextRows.length-1]); // Verify reconstructibility before either input is debited.
 writeSkewerRows(next,nextRows);
 const variants=JSON.stringify(appendedModelVariants(off.typeId==='minecraft:stick'?undefined:getItemProperty(off,SECRET_MODEL_VARIANTS_KEY),rows.length));
 setItemProperty(next,SECRET_MODEL_VARIANTS_KEY,variants);
 if(getItemProperty(next,SECRET_MODEL_VARIANTS_KEY)!==variants)throw Error('Grilling: skewer model variants were not saved');
 if(outcome.kind==='secret')setSecretCreator(next,player);
 if(getItemProperty(next,SKEWER_INGREDIENTS_KEY)!==JSON.stringify(nextRows))throw new Error('Grilling: skewer data was not saved');
 if(outcome.kind==='secret'&&!getItemProperty(next,SECRET_CREATOR_KEY))throw new Error('Grilling: creator data was not saved');
 const free=creative(player),nextMain=free?food:reducedStack(food),outputs=[];
 // One result replaces one input; retain all other native input stacks.
 const starter=off.typeId==='minecraft:stick'||(off.typeId===UNFINISHED_ID&&rows.length===0);
 const keep=off.amount-(free&&starter?0:1);
 if(keep>0){const remaining=off.clone();remaining.amount=keep;outputs.push(remaining)}
 const container=mainContainer(player);if(!container)throw Error('Grilling: output inventory unavailable');
 const startingItems=Array.from({length:container.size},(_,i)=>container.getItem(i)?.clone()),selected=player.selectedSlotIndex;
 if(nativeItemSignature(startingItems[selected])!==nativeItemSignature(food))throw Error('Grilling: threading hand changed');
 if(!free)startingItems[selected]=nextMain?.clone();
 const delivery=prepareOutputDelivery(player,outputs,startingItems);let offRecovered=true;
 const offWrite=ownedItemStep({read:()=>other.read(),write:stack=>other.write(stack),before:off,after:next,canRestore:delivery.canRestoreInputs});
 const mainWrite=ownedItemStep({read:()=>main.read(),write:stack=>main.write(stack),before:food,after:nextMain,canRestore:()=>offRecovered&&delivery.canRestoreInputs()});
 // The new offhand skewer is itself a credit. Its recovery must be confirmed
 // before refunding the ingredient, even when every inventory drop was undone.
 const offStep={apply(){offRecovered=false;offWrite.apply()},rollback(){offWrite.rollback();offRecovered=true}};
 const steps=[...(free?[]:[mainWrite]),offStep,...delivery.steps];
 if(!transactionStatus(commitPlayerItemTransaction(world,player,steps,{tick:system.currentTick,label:'threading'}),'threading')){interactionFailure(player,'§c穿串未完成；已回復可確認的原料，未確認交易請查看紀錄');return false}
 useSound(player,'action_success',.7,1);
 awardLookingThePart(player,outcome);
 return true;
}
function disassembleOff(player){
 const other=captureWritableHand(player,'off'),off=other.before;if(!off||!canDisassembleOff(player))return false;
 const rows=readSkewerRows(off),outputs=rows.map(restoreIngredient);
 if(outputs.some(item=>!item))throw new Error('Grilling: an ingredient cannot be restored');
 outputs.push(new ItemStack('minecraft:stick',1));
 const delivery=prepareOutputDelivery(player,outputs),next=reducedStack(off);
 const debit=ownedItemStep({read:()=>other.read(),write:stack=>other.write(stack),before:off,after:next,canRestore:delivery.canRestoreInputs});
 if(!transactionStatus(commitPlayerItemTransaction(world,player,[debit,...delivery.steps],{tick:system.currentTick,label:'disassembly'}),'disassembly')){interactionFailure(player,'§c拆串未完成；已回復可確認的原料，未確認交易請查看紀錄');return false}
 useSound(player,'skewer_disassemble',.8);
 return true;
}
function scheduleSkewerAction(player,action){
 const id=player.id,old=THREAD_LAST.get(id);if(old?.tick===system.currentTick)return true;
 const intent=captureTwoHandIntent(player);if(!intent)return false;
 const operation={tick:system.currentTick,action,intent};THREAD_LAST.set(id,operation);
 system.run(()=>{
  if(THREAD_LAST.get(id)!==operation||!twoHandIntentStillCurrent(player,intent))return;
  try{if(action==='disassemble')disassembleOff(player);else threadCurrent(player)}
  catch(error){console.warn('[Grilling skewer action] '+error);try{interactionFailure(player,'§c操作未完成；請確認原料與副手狀態')}catch{}}
 });return true;
}
function skewerAction(player,itemStack){
 if(player.isSneaking)return canDisassembleOff(player)?'disassemble':null;
 const main=heldMain(player);if(!main||!itemStack||itemStack.typeId!==main.typeId)return null;
 return threadOutcome(player)?.ok?'thread':null;
}
function secretRemainders(player,stack){
 for(const row of readEffectiveSkewerRows(stack)){
  const behavior=rolledIngredientEffects(row);
  for(const e of behavior.effects){
   if(e.kind==='persistent_fx'){
    const old=fxGet(player,e.effect);fxSet(player,e.effect,Math.max(e.ticks,(old?.until??now())-now()),Math.max(e.amplifier??0,old?.amp??0));
   }else try{player.addEffect(e.effect,e.ticks,{...(e.options??{}),amplifier:e.amplifier??0,showParticles:true})}catch{}
  }
  if(behavior.clearPoison)try{player.removeEffect('poison')}catch{}
  if(behavior.ordinary)applyOrdinary(player);
  // Chorus fruit: bounded safe destinations with solid ground, like vanilla attempts.
  if(behavior.teleport){
   const from=player.location;
   for(let i=0;i<16;i++)try{
    let to={x:from.x+(Math.random()-.5)*16,y:Math.floor(from.y)+(Math.floor(Math.random()*16)-8),z:from.z+(Math.random()-.5)*16};
    for(let down=0;down<16;down++,to.y--){
     const below=player.dimension.getBlock({x:Math.floor(to.x),y:to.y-1,z:Math.floor(to.z)});
     if(hasSolidTop(below)){if(player.tryTeleport(to,{checkForBlocks:true})){player.dimension.playSound('mob.endermen.portal',to);i=16}break}
    }
   }catch{}
  }
  dangerousPreservation(player,row.id);
  if(behavior.damage>0)try{player.applyDamage(behavior.damage,{cause:'magic'})}catch{}
  const remainder=behaviorRemainder(behavior);if(remainder)give(player,remainder);
  for(const spec of behavior.remainders??[]){const extra=behaviorRemainder({remainder:spec});if(extra)give(player,extra);}
  emitSecretIngredientConsumed(player,row);
 }
}
function addSecretNutrition(player,stack,meta){
 const d=dynamicFood(stack),h=player.getComponent('minecraft:player.hunger'),sat=player.getComponent('minecraft:player.saturation');if(!d||!h||!sat)return;
 const hunger=Math.min(h.effectiveMax,h.currentValue+d.nutrition);h.setCurrentValue(hunger);
 // Hunger updates can leave the earlier saturation view with stale bounds.
 // Use the live native cap; a failed refresh must roll back the plate debit.
 const currentSat=player.getComponent('minecraft:player.saturation');
 if(!currentSat)throw new Error('Grilling: saturation component unavailable after nutrition update');
 const gain=d.nutrition*d.saturation*2*(meta?.hot?grillingConfig().saturationMultiplier:1);currentSat.setCurrentValue(Math.min(hunger,currentSat.effectiveMax,currentSat.currentValue+gain));
}
function addNestedNutrition(player,stack,meta){addSecretNutrition(player,stack,meta)}
function clearContainer(block){const c=inv(block);if(c)for(let i=0;i<3;i++)c.setItem(i,undefined)}
function resetBlock(block,lit=false){const s=initialState();s.lit=lit;writeState(block,s)}
function getUses(stack){try{return Math.max(0,Math.min(SEASONING_MAX_USES,Number(getItemProperty(stack,SEASON_USES_KEY)??0)|0))}catch{return 0}}
function setUses(stack,n){try{setItemProperty(stack,SEASON_USES_KEY,Math.max(0,Math.min(SEASONING_MAX_USES,n|0)))}catch{}return stack}
function cookedStack(raw,state){
 let stack;
 if(canonicalFoodId(raw.typeId)===SECRET_ID){
  stack=copyOne(raw);setCookedIngredientRows(stack,readSkewerRows(raw));setItemProperty(stack,SECRET_COOKED_KEY,true);if(!isSecretCooked(stack))throw Error('Grilling: cooked state was not saved');
 }else{
  const out=customSkewerCookedId(ingredientSnapshot(raw))||RAW_TO_COOKED[raw.typeId];
  if(!out)return new ItemStack(MYSTERIOUS_ID,1);
  stack=new ItemStack(out,1);copyCustomData(raw,stack);
 }
 setHot(stack,state.heatTicks);setSeasonings(stack,state.seasonings??[]);
 try{setItemProperty(stack,'kaleidoscope_grilling:seasoned',state.seasoned)}catch{}
 return refreshHotLore(stack);
}
function failedStack(raw,id){const stack=new ItemStack(id,1);return copyCustomData(raw,stack)}
function outputFor(raw,state,kind){if(kind==='raw')return copyOne(raw);if(kind==='dark')return failedStack(raw,DARK_ID);if(kind==='mysterious')return failedStack(raw,MYSTERIOUS_ID);return cookedStack(raw,state)}
function firstEmptyPlayerSlot(player){
 const c=mainContainer(player);if(!c)return -1;
 for(let i=0;i<c.size;i++)if(!c.getItem(i))return i;
 return -1;
}
function extract(block,player,all=false){
 const state=readState(block);if(!canExtract(state))return 0;const c=inv(block);if(!c)return 0;
 const rows=[];for(let i=0;i<3;i++){const raw=c.getItem(i);if(!raw)continue;rows.push({slot:i,output:outputFor(raw,state,outputKind(state))});if(!all)break;}
 if(!rows.length)return 0;
 const target=mainContainer(player);if(!target)throw new Error('Grilling: output inventory unavailable');
 // Reserve native-compatible stacks and empty slots for the whole batch before
 // debiting the grill. Heat/creator exceptions belong only to manual sorting.
 const planned=Array.from({length:target.size},(_,i)=>target.getItem(i)?.clone()),changed=new Set(),drops=[];
 const view={size:target.size,getItem:i=>planned[i]?.clone(),setItem(i,stack){planned[i]=stack?.clone();changed.add(i)}};
 for(const {output} of rows){
  const delivery=planInventoryInsert(view,output);
  for(const step of delivery.steps)step.apply();
  if(delivery.remainder)drops.push(delivery.remainder);
 }
 const steps=rows.map(row=>slotWrite(c,row.slot,undefined));
 for(const slot of changed)steps.push(slotWrite(target,slot,planned[slot]));
 for(const drop of drops)steps.push(acknowledgedDrop(player.dimension,drop,player.location));
 if(rows.length===occupied(block))steps.push({apply:()=>resetBlock(block,state.lit),rollback:()=>writeState(block,state)});
 const result=commitStationTransfer(block,steps,'extract');
 if(!result.ok){interactionFailure(player,'§c取串失敗；已回復可確認的內容，請查看紀錄');return 0}
 blockSound(block,'pickup_item',.8);
 return rows.length;
}
function removeEscrow(entities){let ok=true;for(const e of entities)try{e?.remove()}catch{ok=false}return ok}
function restoreBrokenGrill(dim,loc,permutation,state,raws){
 try{
  let b=dim.getBlock(loc);if(!b)return;
  b.setPermutation(permutation);b=dim.getBlock(loc)??b;
  const c=inv(b);if(c)for(let i=0;i<3;i++)c.setItem(i,raws[i]);
  writeState(b,state);return true;
 }catch{return false}
}
function customBreak(block,player){
 if(!block?.isValid||block.typeId!==GRILL_ID)return;
 const state=readState(block),kind=breakDisposition(state),c=inv(block),dim=block.dimension,loc={...block.location},permutation=block.permutation;
 if(!c){interactionFailure(player,'§c烤架庫存暫不可用，未拆除');return}
 const raws=[0,1,2].map(i=>c.getItem(i)),drops=[];
 try{
  for(const raw of raws)if(raw)drops.push(outputFor(raw,state,kind));
  if(!creative(player))drops.push(new ItemStack(GRILL_ID,1));
 }catch{interactionFailure(player,'§c拆除失敗：無法建立掉落物');return}
 const steps=drops.map((drop,i)=>acknowledgedDrop(dim,drop,{x:loc.x+.5,y:loc.y+(i===drops.length-1&&!creative(player)?.3:.4),z:loc.z+.5}));
 steps.push({apply(){clearContainer(block);clearState(block);removeGrillLegs(block);block.setType('minecraft:air')},rollback(){if(!restoreBrokenGrill(dim,loc,permutation,state,raws))throw new Error('Grill restore incomplete')}});
 if(!commitStationTransfer(block,steps,'break').ok){interactionFailure(player,'§c拆除失敗；已回復可確認的內容，請查看紀錄');return}
 try{removeGrillAudio(block)}catch{}
 try{retireEmptyStationContainer(dim.getBlock(loc))}catch(error){console.warn('[Grilling storage retirement] '+error)}
}
// Deferred destruction owns only the captured station and its native contents.
// Inspection must not allocate a backing inventory in a before-event callback.
function grillBreakSnapshot(block){
 if(!block?.isValid||block.typeId!==GRILL_ID)throw new Error('Grill target unavailable');
 const {phaseTicks,flipCooldown,...operation}=readState(block),container=peekStationContainer(block);
 // clone is available in restricted execution; full canDestroy/canPlaceOn
 // metadata getters are not. Compare those frozen native clones after defer.
 const contents=container?Array.from({length:container.size},(_,i)=>container.getItem(i)?.clone()??null):undefined;
 return {dimension:block.dimension,location:{...block.location},states:metadataSignature(block.permutation.getAllStates()),
  owner:world.getDynamicProperty(stationStorageKey(block)),operation:metadataSignature(operation),
  contents};
}
function sameGrillForBreak(captured){
 const block=captured.dimension.getBlock(captured.location);
 if(!block?.isValid||block.typeId!==GRILL_ID)return;
 const current=grillBreakSnapshot(block);
 // Normal cooking/cooldown clock advancement does not replace a station. A
 // changed phase, owner, facing or item payload does invalidate this action.
 if(current.states!==captured.states||current.owner!==captured.owner||current.operation!==captured.operation)return;
 const contentsSignature=items=>items===undefined?undefined:metadataSignature(items.map(item=>item?{amount:item.amount,metadata:captureSkewerMetadata(item)}:null));
 if(contentsSignature(current.contents)!==contentsSignature(captured.contents))return;
 return block;
}
function scheduleGrillExplosion(event){
 try{if(event.cancel!==false)return}catch{return}
 const pending=[],keep=[];let protectedGrill=false;
 for(const block of event.getImpactedBlocks()){
  if(block.typeId!==GRILL_ID){keep.push(block);continue}
  protectedGrill=true;
  try{pending.push(grillBreakSnapshot(block))}catch(error){console.warn('[Grilling explosion capture] retained '+error)}
 }
 if(!protectedGrill)return;
 event.setImpactedBlocks(keep);if(!pending.length)return;
 system.run(()=>{
  // A later subscriber can still cancel this event. An unreadable final
  // status is not permission to destroy a station or release its contents.
  try{if(event.cancel!==false)return}catch(error){console.warn('[Grilling explosion status] '+error);return}
  for(const captured of pending)try{const block=sameGrillForBreak(captured);if(block)customBreak(block,undefined)}catch(error){console.warn('[Grilling explosion recovery] '+error)}
 });
}
function scheduleGrillPlayerBreak(event){
 if(event.cancel||event.block.typeId!==GRILL_ID)return;
 event.cancel=true;
 try{
  const captured=grillBreakSnapshot(event.block),player=event.player;
  system.run(()=>{try{const block=sameGrillForBreak(captured);if(block)customBreak(block,player)}catch(error){console.warn('[Grilling break recovery] '+error)}});
 }catch(error){console.warn('[Grilling break capture] retained '+error)}
}
function heatForOil(type){return OIL_TYPES[type]?.heatTicks??OIL_TYPES.canola.heatTicks}
function planCookeryOil(player,hand,needed){
 const stack=heldByHand(player,hand),oil=planCookeryOilPotConsumption(stack,needed);
 if(!oil.ok)return oil;
 const heat=heatForOil(oil.type);
 // Java's player brushOil call consumes one oil point per occupied slot in Creative too.
 return {...oil,heat,mutate:true};
}
function planSeasoningBottle(player,hand,needed){
 const stack=heldByHand(player,hand);if(!isSpecialSeasoningId(stack?.typeId))return {ok:false,reason:'not_seasoning'};
 const uses=getUses(stack),remaining=16-uses;if(remaining<needed)return {ok:false,reason:'insufficient',remaining};
 const ingredients=readSeasonings(stack),before=stack.clone();
 // Both Java block callers use the consuming season overload in Creative too.
 const nextUses=uses+needed;
 if(nextUses>=16)return {ok:true,ingredients,uses:nextUses,before,next:new ItemStack(EMPTY_SEASONING_ID,1),mutate:true};
 const next=retargetSpecialSeasoningStack(stack,nextUses,specialSeasoningVariant(stack));if(!next)return {ok:false,reason:'visual_state'};setUses(next,nextUses);try{setItemLore(next,seasoningLore(16-nextUses,ingredients.length))}catch{}
 return {ok:true,ingredients,uses:nextUses,before,next,mutate:true};
}
// The fourth successful flip freezes secret ingredient conversions in storage.
// Do not set Cooked, heat or seasoning here: extraction owns those transitions.
function commitGrillFlip(block,beforeState,nextState){
 const steps=[];
 try{
  if(beforeState.phase===1&&beforeState.flips===3&&nextState.phase===2&&nextState.flips===4){
   const c=inv(block);if(!c)throw Error('Grill inventory unavailable');
   for(let slot=0;slot<3;slot++){
    const raw=c.getItem(slot);if(canonicalFoodId(raw?.typeId)!==SECRET_ID)continue;
    const next=raw.clone(),ingredients=readSkewerRows(next);
    if(!validSecretIngredientRows(ingredients))throw Error('Grilling: invalid raw ingredient rows at fourth flip');
    setCookedIngredientRows(next,ingredients);
    steps.push(slotWrite(c,slot,next));
   }
  }
  // Prepare every snapshot before the first mutation; state is committed last.
  steps.push({apply:()=>writeState(block,nextState),rollback:()=>writeState(block,beforeState)});
  return commitStationTransfer(block,steps,'flip snapshot').ok;
 }catch(error){console.warn('[Grilling flip snapshot preparation] '+error);return false;}
}
function handleGrill(block,player,hand='main'){
 if(!block?.isValid||block.typeId!==GRILL_ID)return;let state=readState(block);const held=heldByHand(player,hand),id=canonicalFoodId(held?.typeId),n=occupied(block);
 if(id==='minecraft:flint_and_steel'){
  if(!state.lit){
   const tool=planDamagedHand(player,hand,1),nextState=light(state,true);
   if(!tool.ok){interactionFailure(player,'§c點火失敗：打火石狀態無法提交');return}
   if(!commitGrillAndHand(block,state,nextState,player,hand,tool.before,tool.next,tool.mutate)){interactionFailure(player,'§c點火交易失敗，已嘗試回滾');return}
   if(tool.broken)try{player.playSound('random.break',{volume:.8,pitch:1})}catch{}
   try{block.dimension.playSound('fire.ignite',block.location)}catch{}
  }
  return
 }
 if(isExtinguishTool(id)&&state.lit){
  state=light(state,false);writeState(block,state);try{block.dimension.playSound('random.fizz',block.location)}catch{}return
 }
 if(id===COOKERY_FILLED){
  if(!ensureOilHandPublished(player,hand,()=>handleGrill(block,player,hand)))return;
  if(state.phase!==0||n<1){javaInteractionFeedback(player,'no_brushable_skewers');return}
  const oil=planCookeryOil(player,hand,n);if(!oil.ok){javaInteractionFeedback(player,oil.reason==='insufficient'?'not_enough_oil':'no_brushable_skewers');return}
  const result=brush(state,n,oil.heat);
  if(result.ok){
   if(!commitGrillAndHand(block,state,result.state,player,hand,oil.before,oil.next,oil.mutate)){interactionFailure(player,'§c刷油交易失敗，油與烤架已嘗試回滾');return}
   awardGleamingWithOil(player);javaInteractionFeedback(player,'oiled',[n]);
   blockSound(block,'grill_flip',.75);
   // 1.3 s brush clip plus 0.12 s native blend-out: keep Numb off for 29 ticks.
   try{player.playAnimation('animation.kg_imm.player.brush.'+hand,{blendOutTime:.12});suppressNumbVisual(player,system.currentTick,29)}catch{}
  }return;
 }
 if(id&&Object.hasOwn(OIL_TOOLS,id)){const result=brush(state,n,OIL_TOOLS[id]);if(result.ok){writeState(block,result.state);awardGleamingWithOil(player);blockSound(block,'grill_flip',.75);try{player.playAnimation('animation.kg_imm.player.brush.'+hand,{blendOutTime:.12});suppressNumbVisual(player,system.currentTick,29)}catch{}}return}
 if(isSpecialSeasoningId(id)){
  if(state.phase!==2||state.seasoned||n<1){javaInteractionFeedback(player,'no_seasonable_skewers');return}
  const bottle=planSeasoningBottle(player,hand,n);if(!bottle.ok){javaInteractionFeedback(player,bottle.reason==='insufficient'?'not_enough_seasoning':'no_seasonable_skewers');return}
  const result=season(state,n,bottle.ingredients);
  if(result.ok){
   if(!commitGrillAndHand(block,state,result.state,player,hand,bottle.before,bottle.next,bottle.mutate)){interactionFailure(player,'§c撒料交易失敗，調料與烤架已嘗試回滾');return}
   javaInteractionFeedback(player,'grill_ready_to_take',[],true);blockSound(block,'season',.85);
   try{beginSeasoningMotion(player,hand);player.playAnimation('animation.kg_imm.player.season.'+hand,{blendOutTime:0})}catch{}
  }return;
 }
 if(id&&(Object.hasOwn(RAW_TO_COOKED,id)||isCompatRawSkewer(ingredientSnapshot(held))||(id===SECRET_ID&&!isSecretCooked(held)&&readSkewerRows(held).length===3))){
  if(!state.lit){javaInteractionFeedback(player,'grill_need_heat');return}if(!canInsert(state,n)){message(player,'§7烤爐現在不能再放入生串');return}
  const c=inv(block);if(!c)return;const slot=[0,1,2].find(i=>!c.getItem(i));if(slot===undefined)return;
  const storage=captureWritableHand(player,hand),free=creative(player),next=free?storage.before:reducedStack(storage.before),inserted=copyOne(storage.before);
  const result=commitTwoParty(
   ()=>c.setItem(slot,inserted),()=>{if(!free)storage.write(next)},
   ()=>c.setItem(slot,undefined),()=>{if(!free)storage.write(storage.before)}
  );
  if(!result.ok&&result.rollbackErrors)quarantineStation(block,'insert skewer rollback incomplete');
  if(!transactionStatus(result,'insert skewer'))interactionFailure(player,'§c插串失敗，已嘗試回復烤架與原料');
  else blockSound(block,'action_success',.65,1);
  return
 }
 if(id){message(player,'§7這個物品不能用在目前的烤爐階段');return}
 if(state.phase===1){const r=flip(state);if(r.ok){if(!commitGrillFlip(block,state,r.state)){interactionFailure(player,'§c翻面失敗；已嘗試回復烤架與食材快照，請查看紀錄');return}javaInteractionFeedback(player,'grill_wait_flip',[r.state.flips,4]);blockSound(block,'grill_flip',.75);try{player.playAnimation('animation.kg_imm.player.reach.'+hand,{blendOutTime:.1})}catch{}}else message(player,'§7翻面冷卻中');return}
 if(state.phase===0&&n>0){javaInteractionFeedback(player,'grill_need_oil');return}if(state.phase===2&&!state.seasoned){javaInteractionFeedback(player,'grill_need_seasoning');return}
 if(canExtract(state))extract(block,player,player.isSneaking)
}
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
function handleCustomBlockInteraction(block,player,intent){
 if(!block||(block.typeId!==GRILL_ID&&!isSeasoningBlock(block.typeId)))return;
 if(!interactionIntentStillCurrent(player,intent)){message(player,'§7操作已取消：互動後手持物品已改變');return}
 if(block.typeId===GRILL_ID)handleGrill(block,player,intent.hand);
 else handleSeasoningBlock(block,player,intent.hand);
}
function readFx(entity){try{return readEffects(entity)}catch{return {}}}
function writeFx(entity,fx,options){try{return writeEffects(entity,fx,options)}catch{return {}}}
function fxGet(entity,name){const v=readFx(entity)[name];return v&&Number(v.until)>now()?v:null}
function fxSet(entity,name,ticks,amp=0){const fx=readFx(entity);fx[name]={until:now()+Math.max(1,ticks|0),amp:amp|0};writeFx(entity,fx,{refreshProjectileDodge:name==='projectile_dodge'})}
function fxClear(entity,name){const fx=readFx(entity);delete fx[name];writeFx(entity,fx,{refreshProjectileDodge:name==='projectile_dodge'})}
function fxReduce(entity,name,ticks){const fx=readFx(entity),v=fx[name];if(!v)return;v.until-=ticks;if(v.until<=now())delete fx[name];writeFx(entity,fx)}
function fxSnapshot(entity){
 const out={},t=now();
 for(const [name,v] of Object.entries(readFx(entity)))out[name]={duration:Math.max(0,v.until-t)};
 return out;
}
function nativeSnapshot(entity){const out={};try{for(const e of entity.getEffects())out[e.typeId]={duration:e.duration,amplifier:e.amplifier}}catch{}return out}
function doubleNewNative(player,before){try{for(const e of player.getEffects()){const old=before[e.typeId]?.duration??0;if(e.duration<=old)continue;const duration=old+(e.duration-old)*2;player.removeEffect(e.typeId);player.addEffect(e.typeId,Math.max(1,duration),{amplifier:e.amplifier,showParticles:true})}}catch{}}
function doubleNewFx(player,before){
 const current=readFx(player),t=now();
 for(const [name,v] of Object.entries(current)){
  if(name==='invincible')continue;
  // Java compares completion-time remaining duration with the start snapshot,
  // so time spent eating cannot become an additional hot-food reward.
  const old=before[name]?.duration??0,duration=Math.max(0,v.until-t);
  if(duration<=old)continue;
  v.until=t+old+(duration-old)*2;
 }
 writeFx(player,current);
}
function applyFixedEffect(player,id){
 id=canonicalFoodId(id);
 const e=COOKED_EFFECTS[id];if(!e||!e.effect)return;const ticks=Math.max(1,e.seconds*20);
 if(e.effect.startsWith('minecraft:')){try{player.addEffect(e.effect.split(':')[1],ticks,{showParticles:true})}catch{}return}
 if(e.effect==='kaleidoscope_grilling:invincible'){fxSet(player,'invincible',ticks);return}
 if(e.effect.startsWith('kaleidoscope_cookery:'))fxSet(player,e.effect.split(':')[1],ticks);
}
function counts(list){return seasoningEffectCounts(list)}
function applyDragonBlood(player,ticks,amp){
 const old=fxGet(player,'dragon_blood');amp=Math.max(amp,old?.amp??0);
 fxSet(player,'dragon_blood',Math.max(ticks,old?old.until-now():0),amp);
 nativeDragonHealth(player,amp,{heal:true});
}

function applySeasoning(player,list){
 const c=counts(list);let duration=3600;if((c.duration??0)>=4)duration*=4;else if((c.duration??0)>0)duration*=2;
 if((c.speed??0)>0)try{player.addEffect('speed',duration,{amplifier:c.speed>=4?1:0,showParticles:true})}catch{}
 if((c.strength??0)>0)try{player.addEffect('strength',duration,{amplifier:c.strength>=4?1:0,showParticles:true})}catch{}
 if((c.numbness??0)>=4)fxSet(player,'numb',900*((c.duration??0)>=4?4:(c.duration??0)>0?2:1));
 if((c.totem??0)>0){
  const poisoned=!!fxGet(player,'heavy_metal_poisoning');
  if(poisoned)awardMetalToleranceFailed(player,c.totem,true);
  else fxSet(player,'heavy_metal',duration,c.totem>=4?1:0);
 }
 if((c.vitality??0)>0)applyDragonBlood(player,duration,c.vitality>=4?1:0);
}
function dangerousPreservation(player,itemId){if(!DANGEROUS_FOODS.has(itemId)||!fxGet(player,'preservation'))return;for(const id of ['hunger','poison','nausea'])try{player.removeEffect(id)}catch{}}
function applyOrdinary(player){
 const challenged=!!fxGet(player,'invincible');if(challenged)fxClear(player,'invincible');
 const outcome=ordinaryChallengeOutcome(challenged,Math.random());
 if(outcome==='shield'){awardOrdinaryChallenge(player,outcome);ordinaryShieldFeedback(player);return}
 if(outcome==='spear')awardOrdinaryChallenge(player,outcome);
 ordinaryFatalFeedback(player);
 // Java uses damage, not generic kill: Heavy Metal and native totems retain their damage/death route.
 system.run(()=>{try{player.applyDamage(3.4028234663852886e38,{cause:'override'})}catch(error){console.warn('[Grilling ordinary damage] '+error)}});
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
world.afterEvents.itemStartUse.subscribe(e=>{
 try{e.source.setProperty(EAT_PROFILE_PROPERTY,0);e.source.setProperty(EAT_HAND_PROPERTY,0);e.source.setProperty(EAT_PROJECTION_PROPERTY,false);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.source.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)}catch{}
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
  const requested=PROFILE_BY_ITEM[id]??'THREE_RANDOM',hand=captureInteractionIntent(e.source,e.itemStack).hand,profile=resolvedProfile(selectedEatingProfile(requested,e.itemStack.typeId),e.useDuration),meta=stackMeta(e.itemStack),sat=e.source.getComponent('minecraft:player.saturation');
  try{syncSecretHeld(e.source,{beginHand:hand})}catch(error){console.warn('[Grilling held ingredients] '+error)}
 const a={plain:isPlainEatingId(e.itemStack.typeId),id,start:system.currentTick,nativeDuration:Math.max(0,Number(e.useDuration)||0),requested,profile,hand,use:captureEatingIdentity(e.itemStack,hand,e.source.selectedSlotIndex),meta,biteTimes:BITE_TIMES[profile]??BITE_TIMES.THREE,nextBite:0,nativeBefore:meta.hot?nativeSnapshot(e.source):{},fxBefore:meta.hot?fxSnapshot(e.source):{},saturationBefore:meta.hot?sat?.currentValue:undefined};
 stopSoundHandle(ACTIVE_EATS.get(e.source.id)?.audio);ACTIVE_EATS.set(e.source.id,a);
 if(a.plain)return; // JSON owns 25-tick vanilla use; no custom motion, sound or HUD.
 try{e.source.setProperty(EAT_PROFILE_PROPERTY,eatingProfile(profile).code);e.source.setProperty(EAT_HAND_PROPERTY,hand==='off'?2:1);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,eatingNativeTicks(a.nativeDuration))}catch(error){console.warn('[Grilling eating profile] '+error)}
 // Separate Java NONE-context first-person path. Do not replace the RP player
 // definition or reset body/head channels. The JSON branch gates upright use.
 if(eatingNativeTicks(a.nativeDuration)>0&&(supportsJavaEatingProjection(e.itemStack.typeId,profile)||(e.itemStack.typeId==='kaleidoscope_grilling:grilled_caterpillar_skewer'&&profile==='ONE'&&hand!=='off'))&&(!['ONE','THREE'].includes(profile)||!heldByHand(e.source,hand==='off'?'main':'off'))){
  try{
   e.source.setProperty(EAT_PROJECTION_PROPERTY,true);
   e.source.playAnimation(((e.itemStack.typeId==='kaleidoscope_grilling:grilled_bun_slice_skewer'&&profile==='TWO'&&hand==='main'&&!heldByHand(e.source,'off'))?'animation.kg_isolated_two_route_v1.player.bun_two.right':((e.itemStack.typeId==='kaleidoscope_grilling:grilled_ender_pearl_skewer'&&profile==='THREE'&&hand==='main'&&!heldByHand(e.source,'off'))?'animation.kg_isolated_two_route_v1.player.pearl_three.right':((e.itemStack.typeId==='kaleidoscope_grilling:grilled_caterpillar_skewer'&&profile==='ONE'&&hand!=='off')?'animation.kg_probe_caterpillar.player.one.right':('animation.kg_java_eating.player.'+profile.toLowerCase()+'.'+(hand==='off'?'left':'right'))))),{
    // Do not stop on a client-synced property before its update packet arrives.
    // The animation blend gate still masks inactive projection immediately.
    controller:'kg_java_eating_first_person',blendOutTime:0,
    stopExpression:"!q.is_using_item || !q.is_item_name_any('"+(hand==='off'?'slot.weapon.offhand':'slot.weapon.mainhand')+"','"+e.itemStack.typeId+"')"});
  }catch(error){console.warn('[Grilling Java first-person projection] '+error);try{e.source.setProperty(EAT_PROJECTION_PROPERTY,false)}catch{}}
 }
 // Native use_item_progress can remain zero for custom food in third person.
 // Supply only its arm rotation there; retain native movement and the authored
 // attachable curves. No camera-space limb translations or whole-player reset.
 if(id.endsWith("_skewer")){
  const slot=hand==='off'?'slot.weapon.offhand':'slot.weapon.mainhand';
  try{e.source.playAnimation('animation.kg_eating.player.native_'+(hand==='off'?'left':'right'),{blendOutTime:.08,stopExpression:"!q.is_using_item || !q.is_item_name_any('"+slot+"','"+e.itemStack.typeId+"')"})}catch(error){console.warn('[Grilling eating arm pose] '+error)}
 }
 startEatingSound(e.source,a);
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
 a.meta=finishedFoodMeta(a.meta,now());
 // Publish completion ownership before presentation reset, even if the held
 // snapshot still contains the just-consumed single serving this callback.
 if(id===SECRET_ID)try{syncSecretHeld(e.source,{completedUse:a.use})}catch(error){console.warn('[Grilling held completion] '+error)}
 stopEatSound(e.source,a.profile);SETTLED.set(e.source.id,system.currentTick);ACTIVE_EATS.delete(e.source.id);forgetEatingItem(e.source.id);try{e.source.setProperty(EAT_PROFILE_PROPERTY,0);e.source.setProperty(EAT_HAND_PROPERTY,0);e.source.setProperty(EAT_PROJECTION_PROPERTY,false);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.source.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)}catch{}
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
 const settleReleased=()=>{if(ACTIVE_EATS.get(id)!==a)return;ACTIVE_EATS.delete(id);forgetEatingItem(id);try{e.source.setProperty(EAT_PROFILE_PROPERTY,0);e.source.setProperty(EAT_HAND_PROPERTY,0);e.source.setProperty(EAT_PROJECTION_PROPERTY,false);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.source.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)}catch{};if(!a.plain&&e.itemStack&&used+RELEASE_CHECKPOINT_GRACE_TICKS>=MINIMUM_EAT_TICKS&&hungerSettle(e.source,a.id,a))SETTLED.set(id,system.currentTick);if(a.id===SECRET_ID)try{syncSecretHeld(e.source)}catch(error){console.warn('[Grilling held release] '+error)}};
 // A proven nonterminal stop cannot race native completion. Settle in this
 // writable after-event, like Java releaseUsing, before leave clears the session.
 // Terminal/unknown clocks retain deferred completion ownership; before-leave
 // stays read-only and no offline Player reference is used for gameplay writes.
 const immediate=!a.plain&&e.itemStack&&used+RELEASE_CHECKPOINT_GRACE_TICKS>=MINIMUM_EAT_TICKS&&
  Number.isInteger(a.nativeDuration)&&a.nativeDuration>0&&a.nativeDuration<=72000&&Number.isInteger(used)&&used>=0&&used+1<a.nativeDuration&&
  Number.isInteger(e.useDuration)&&e.useDuration>0&&e.useDuration<=a.nativeDuration;
 if(immediate)settleReleased();else system.run(settleReleased);
});
// Native use poses cancel with the use action; no global zero-pose reset may override
// the next held item. Release server bookkeeping as well when a player disconnects.
world.afterEvents.playerLeave.subscribe(e=>{forgetProjectileDodge(e.playerId);forgetHeavyMetalRescue(e.playerId);forgetEatingItem(e.playerId);stopSoundHandle(PENDING_USES.get(e.playerId)?.audio);stopSoundHandle(ACTIVE_EATS.get(e.playerId)?.audio);for(const map of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,PENDING_USES,SETTLED])map.delete(e.playerId)});
world.afterEvents.entityDie.subscribe(e=>{forgetProjectileDodge(e.deadEntity);forgetHeavyMetalRescue(e.deadEntity)});
world.afterEvents.entityRemove.subscribe(e=>{forgetProjectileDodge(e.removedEntityId);forgetHeavyMetalRescue(e.removedEntityId)});
world.beforeEvents.entityHurt.subscribe(e=>{
 if(e.cancel)return;
 const target=e.hurtEntity,cause=e.damageSource?.cause;
 if(e.damageSource?.damagingProjectile){
  const claim=reserveProjectileDodge(target);
  if(claim){try{
   system.run(()=>settleProjectileDodge(target,claim,()=>{const moved=tryProjectileDodgeMovement(target);if(moved.success)projectileDodgeTeleportFeedback(target,moved.origin)}));
   e.cancel=true;return;
  }catch(error){abandonProjectileDodge(claim);console.warn('[Grilling projectile dodge schedule] '+error)}}
 }
 if(fxGet(target,'invincible')&&cause!=='selfDestruct'&&cause!=='override'){e.cancel=true;invincibleDamageFeedback(target);return}
 handleHeavyMetalBeforeHurt(e);
});
world.afterEvents.playerSpawn.subscribe(e=>{forgetProjectileDodge(e.player);try{e.player.setProperty(EAT_PROJECTION_PROPERTY,false);e.player.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.player.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0);e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{};if(!e.initialSpawn){forgetHeavyMetalRescue(e.player.id);try{clearEffects(e.player)}catch{};stopSoundHandle(ACTIVE_EATS.get(e.player.id)?.audio);stopSoundHandle(PENDING_USES.get(e.player.id)?.audio);for(const cache of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,PENDING_USES,SETTLED,VIGOR_LAST,SNEAK_LAST])cache.delete(e.player.id);forgetNumbVisual(e.player.id);try{e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{}}});
world.afterEvents.entityHurt.subscribe(e=>{
 // Cookery HinderEvent follows damage from a living attacker, including its
 // projectile; a melee contact event cannot represent that source contract.
 // Java has no positive-amount gate. Do not invent one for after-hurt events.
 try{
  const source=e.damageSource;
  let attacker=source?.damagingEntity;
  if(!isCookeryLivingEntity(attacker)){
   const projectile=source?.damagingProjectile;
   // Native hurt may report the arrow itself as damagingEntity. Resolve its
   // living owner, while preserving an independently reported actor's priority.
   if(attacker&&projectile&&attacker.id!==projectile.id)return;
   attacker=(projectile??attacker)?.getComponent('minecraft:projectile')?.owner;
  }
  if(!isCookeryLivingEntity(attacker)||!isCookeryLivingEntity(e.hurtEntity)||!fxGet(attacker,'hinder'))return;
  e.hurtEntity.addEffect('slowness',100,{amplifier:1,showParticles:true});
 }catch{} // A removed actor/projectile must not abort other damage subscribers.
});
function canUseSecretSkewer(stack){
 try{return validSecretIngredientRows(readSkewerRows(stack))&&(!isSecretCooked(stack)||validSecretIngredientRows(readEffectiveSkewerRows(stack)))}catch{return false}
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
  // A setting/item change can race the per-tick preparation. Refuse the wrong
  // native duration, then prepare the still-captured hand before the next use.
  e.cancel=true;const player=e.source,intent=captureInteractionIntent(player,e.itemStack);
  system.run(()=>{if(interactionIntentStillCurrent(player,intent))prepareEatingItems(player,ACTIVE_EATS.has(player.id),grillingConfig().enableEatingAnimations)});return;
 }
 if(!grillingConfig().fullHungerEating){const h=e.source.getComponent('minecraft:player.hunger');if(h&&h.currentValue>=h.effectiveMax)e.cancel=true;}
});
world.beforeEvents.playerInteractWithEntity.subscribe(e=>{
 try{const action=skewerAction(e.player,e.itemStack??heldMain(e.player));if(!action)return;e.cancel=true;scheduleSkewerAction(e.player,action)}catch{}
});
// Stable Script API placement capture, including all materialized seasoning IDs.
system.beforeEvents.startup.subscribe(({blockComponentRegistry})=>{
 blockComponentRegistry.registerCustomComponent('kaleidoscope_grilling:grill_tick',{onTick(e){tickGrill(e.block);tickGrillDisplay(e.block)}});
 blockComponentRegistry.registerCustomComponent('kaleidoscope_grilling:grill_legs_tick',{onTick(e){try{const above=e.block.above();if(above&&above.typeId!==GRILL_ID)e.block.setType('minecraft:air')}catch{}}});
 blockComponentRegistry.registerCustomComponent('senluo:grilling_bottle_place',{beforeOnPlayerPlace:scheduleNativeBottlePlacement,onTick(e){try{tickNativeBottleSupport(e.block)}catch(error){console.warn('[Grilling bottle support recovery] '+error)}}});
});
world.beforeEvents.playerInteractWithBlock.subscribe(e=>{
 if(e.cancel)return;
 if(tryScheduleOffhandBottleInteraction(e))return;
 if(tryScheduleBeefBoardOverride(e))return;
 const skewerInput=skewerAction(e.player,e.itemStack??heldMain(e.player));
 if(skewerInput){e.cancel=true;if(isInitialBlockPress(e.isFirstEvent))scheduleSkewerAction(e.player,skewerInput);return}
 const grillTarget=e.block.typeId===GRILL_ID,customTarget=grillTarget||isSeasoningBlock(e.block.typeId);
 const sortTarget=e.player.isSneaking&&!e.itemStack&&STORAGE_SORT_BLOCKS.has(e.block.typeId);
 if(!isInitialBlockPress(e.isFirstEvent)){if(customTarget||sortTarget)e.cancel=true;return}
 if(sortTarget){
  e.cancel=true;const p=e.player,loc={...e.block.location},dim=e.block.dimension;
  system.run(()=>{const b=dim.getBlock(loc),c=b?.getComponent('minecraft:inventory')?.container;if(!c)return;compactSkewerContainer(c,false)});return;
 }
 if(!customTarget)return;
 e.cancel=true;const p=e.player,loc={...e.block.location},dim=e.block.dimension,intent=customTarget?captureInteractionIntent(p,e.itemStack):null,bottleCapture=isSeasoningBlock(e.block.typeId)?bottleActionSnapshot(e.block):undefined;
 system.run(()=>{try{const target=dim.getBlock(loc);if(bottleCapture&&!bottleActionStillCurrent(target,bottleCapture))return;handleCustomBlockInteraction(target,p,intent)}catch(error){console.warn('[Grilling block action] '+error);try{interactionFailure(p,'§c操作未完成；請查看紀錄並核對原料')}catch{}}});
});
world.afterEvents.playerPlaceBlock.subscribe(e=>{if(e.block.typeId===GRILL_ID)resetBlock(e.block,false)});
world.beforeEvents.explosion.subscribe(scheduleNativeBottleExplosion);
world.beforeEvents.explosion.subscribe(scheduleGrillExplosion);
world.beforeEvents.playerBreakBlock.subscribe(e=>{
 if(e.cancel)return;
 if(e.block.typeId===GRILL_ID){scheduleGrillPlayerBreak(e);return}
 scheduleNativeBottleBreak(e);
});
function nearHeat(player){
 const p=player.location,d=player.dimension;for(let x=-2;x<=2;x++)for(let y=-1;y<=1;y++)for(let z=-2;z<=2;z++){try{const b=d.getBlock({x:Math.floor(p.x)+x,y:Math.floor(p.y)+y,z:Math.floor(p.z)+z});if(!b)continue;if(HEAT_BLOCKS.has(b.typeId))return true;if(b.typeId===GRILL_ID&&readState(b).lit)return true;if(['minecraft:furnace','minecraft:smoker','minecraft:blast_furnace'].includes(b.typeId)&&b.permutation.getState('lit')===true)return true}catch{}}return false;
}
function fleeCreepers(player){
 try{for(const e of player.dimension.getEntities({type:'minecraft:creeper',location:player.location,maxDistance:6})){const dx=e.location.x-player.location.x,dz=e.location.z-player.location.z,len=Math.max(.001,Math.hypot(dx,dz));e.applyKnockback({x:dx/len*.12,z:dz/len*.12},.02)}}catch{}
}
function repelPhantoms(player){
 try{for(const e of player.dimension.getEntities({type:'minecraft:phantom',location:player.location,maxDistance:18})){const dx=e.location.x-player.location.x,dy=e.location.y-player.location.y,dz=e.location.z-player.location.z;if(Math.abs(dx)>8||Math.abs(dz)>8||Math.abs(dy)>16)continue;const len=Math.max(.001,Math.hypot(dx,dz));e.applyKnockback({x:dx/len*.16,z:dz/len*.16},.06)}}catch{}
}
function burnGrillContents(block,beforeState,nextState){
 const c=inv(block);if(!c)throw new Error('Grilling inventory unavailable');
 const output=new ItemStack('minecraft:charcoal',1+Math.floor(Math.random()*2));
 const steps=[0,1,2].map(i=>slotWrite(c,i,undefined));
 steps.push(acknowledgedDrop(block.dimension,output,{x:block.x+.5,y:block.y+.4,z:block.z+.5}));
 steps.push({apply:()=>writeState(block,nextState),rollback:()=>writeState(block,beforeState)});
 return commitStationTransfer(block,steps,'burn to charcoal').ok;
}
// Block ticks resume on chunk reload; no global registration cap or unload deletion.
function tickGrill(block){
 let audioState,audioOccupied;
 try{
  const before=readState(block),count=occupied(block),result=tickState(before,count,1);
  if(result.events.some(x=>x.kind==='burn_to_charcoal')){burnGrillContents(block,before,result.state);return;}
  audioState=writeTickState(block,before,result.state);audioOccupied=count;
  if(system.currentTick%4===0)grillAmbientParticles(block,audioState.lit);
 }catch(error){if(system.currentTick%1200===0)console.warn('[Grilling tick] '+error)}
 finally{
  // Tick and audio run synchronously. Reuse this tick's validated inventory;
  // re-read only after a mutating burn transaction or an interrupted update.
  try{if(audioState===undefined){audioState=readState(block);audioOccupied=occupied(block);}updateGrillAudio(block,audioState.lit,audioOccupied)}catch{try{removeGrillAudio(block)}catch{}}
 }
}
function tundraFactor(id){if(id==='minecraft:blue_ice')return 1.1055;if(['minecraft:ice','minecraft:packed_ice','minecraft:frosted_ice'].includes(id))return 1.11;return 1.3}
system.runInterval(()=>{
 for(const p of world.getAllPlayers()){try{
  try{syncSeasoningMotion(p,PENDING_USES.get(p.id))}catch(error){if(system.currentTick%20===0)console.warn('[Grilling seasoning motion] '+error)}
  const active=ACTIVE_EATS.get(p.id);
  try{prepareBottleFillItems(p,!!active||PENDING_USES.has(p.id));prepareEatingItems(p,!!active,grillingConfig().enableEatingAnimations)}catch(error){if(system.currentTick%20===0)console.warn('[Grilling native eating item] '+error)}
  if(active&&eatingStillCurrent(active.use,heldByHand(p,active.hand),p.selectedSlotIndex,now())){
   // Do not assume a remote custom-item countdown matches the owner's clock.
   // Replicate source session time; native food debit/reward stays event-owned.
   p.setProperty(EAT_ELAPSED_TICKS_PROPERTY,eatingElapsedTicks(active.start,system.currentTick,active.nativeDuration));
   if(!active.plain&&!active.audioStarted&&(active.audioAttempts??0)<3&&system.currentTick%5===0)startEatingSound(p,active);!active.plain&&advanceBites(p,active);!active.plain&&grillingConfig().graphicalEatingHud&&showJavaEatingHud(p,active,system.currentTick);
  }else if(active){
   // A replaced/switching serving must not leave a projected arm on another item.
   p.setProperty(EAT_PROFILE_PROPERTY,0);p.setProperty(EAT_HAND_PROPERTY,0);p.setProperty(EAT_PROJECTION_PROPERTY,false);p.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);p.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0);
  } // Presentation never debits food.
  if(system.currentTick%10===0&&fxGet(p,'invincible'))invincibleAmbientFeedback(p);
  writeFx(p,readFx(p));const hunger=p.getComponent('minecraft:player.hunger'),sat=p.getComponent('minecraft:player.saturation');
  if(fxGet(p,'vigor')&&hunger&&sat){const prev=VIGOR_LAST.get(p.id);if(p.isSprinting&&prev){if(hunger.currentValue<prev.hunger)hunger.setCurrentValue(prev.hunger);if(sat.currentValue<prev.sat)sat.setCurrentValue(prev.sat)}VIGOR_LAST.set(p.id,{hunger:hunger.currentValue,sat:sat.currentValue})}else VIGOR_LAST.delete(p.id);
  const sneak=!!p.isSneaking,was=SNEAK_LAST.get(p.id)??false;if(sneak&&!was&&fxGet(p,'flatulence')){p.applyImpulse({x:0,y:.75,z:0});const dimension=p.dimension;interactionParticleBurst(dimension,p.location,'flatulence');try{const origin=flatulenceSoundOrigin(p);if(origin){const pitch=flatulenceSoundPitch();if(pitch!==undefined)dimension.playSound(FLATULENCE_SOUND_ID,origin,{volume:1,pitch})}}catch{}}SNEAK_LAST.set(p.id,sneak);
  if(system.currentTick%5===0){if(fxGet(p,'mustard'))fleeCreepers(p);if(fxGet(p,'sulfur'))repelPhantoms(p)}
  if(fxGet(p,'tundra_strider')){try{const b=p.getBlockStandingOn();if(b&&TUNDRA_BLOCKS.has(b.typeId)){const v=p.getVelocity(),factor=tundraFactor(b.typeId);p.applyImpulse({x:v.x*(factor-1),y:0,z:v.z*(factor-1)});if(b.typeId==='minecraft:powder_snow'&&v.y<.02)p.applyImpulse({x:0,y:Math.min(.16,Math.max(.04,-v.y+.04)),z:0})}}catch{}}
  if(system.currentTick%20===0&&fxGet(p,'warmth')){const hp=p.getComponent('minecraft:health');if(hp&&hp.currentValue<hp.effectiveMax){if(nearHeat(p))hp.setCurrentValue(Math.min(hp.effectiveMax,hp.currentValue+1));else if(p.dimension.id==='minecraft:nether'&&Math.random()<.25)hp.setCurrentValue(Math.min(hp.effectiveMax,hp.currentValue+.5))}}
  const db=fxGet(p,'dragon_blood');nativeDragonHealth(p,db?.amp);
  updateNumbVisual(p,!!fxGet(p,'numb')&&!ACTIVE_EATS.has(p.id)&&!PENDING_USES.has(p.id)&&!(p.getProperty('kaleidoscope_grilling:season_phase')>0),system.currentTick);

 }catch{}}
},1);

world.afterEvents.playerLeave.subscribe(({playerId})=>{
 for(const cache of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,SETTLED,VIGOR_LAST,SNEAK_LAST,THREAD_LAST])cache.delete(playerId);
 forgetNumbVisual(playerId);forgetDragonHealth(playerId);
});

configureSecretVisuals(readEffectiveSkewerRows,restoreIngredient);
configureSecretHeldReader(readEffectiveSkewerRows,readSkewerRows);
configureSecretGrillReader(readEffectiveSkewerRows);
