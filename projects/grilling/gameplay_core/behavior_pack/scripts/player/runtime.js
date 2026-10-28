import {GRILL_ID} from "../eating_data_lookup.js";
import {isSeasoningBlockId as isSeasoningBlock} from "../seasoning/seasoning_contract_core.js";
import {captureInteractionIntent,interactionIntentStillCurrent} from "../core/interaction_intent_adapter.js";
import {message} from "../core/actions.js";
import {handleGrill,scheduleGrillPlayerBreak,tickGrill} from "../grill/runtime.js";
import {bottleActionSnapshot,bottleActionStillCurrent,handleSeasoningBlock,scheduleNativeBottleBreak,scheduleNativeBottlePlacement,tickNativeBottleSupport,tryScheduleOffhandBottleInteraction} from "../seasoning/runtime.js";
import {system,world} from "@minecraft/server";
import {forgetFoodUse,forgetPlayerFood,tickPlayerFood} from "../food/runtime.js";
import {forgetEffectMovement,forgetPlayerEffects,tickPlayerEffects} from "../effect/runtime.js";
import {forgetPlayerSkewer,scheduleHandAction,scheduleSkewerAction,skewerAction} from "../skewer/runtime.js";
import {hideJavaEatingHud} from "../java_eating_hud_runtime.js";
import {forgetProjectileDodge} from "../projectile_dodge_runtime.js";
import {EAT_ELAPSED_TICKS_PROPERTY,EAT_HAND_PROPERTY,EAT_NATIVE_TICKS_PROPERTY,EAT_PROFILE_PROPERTY,EAT_PROJECTION_PROPERTY} from "../player_presentation_core.js";
import {forgetHeavyMetalRescue} from "../heavy_metal_damage_runtime.js";
import {clearEffects} from "../effect_state_runtime.js";
import {forgetNumbVisual} from "../numb_visual_runtime.js";
import {getMainHand as heldMain} from "../core/player_io.js";
import {tickGrillDisplay} from "../grill_visual_runtime.js";
import {onBlockInteraction} from "../core/events.js";
import {tryScheduleBeefBoardOverride} from "../recipe/beef_board_runtime.js";
import {isInitialBlockPress} from "../grill/grill_input_core.js";
import {compactSkewerContainer} from "../skewer/hot_runtime.js";
import {interactionFailure} from "../core/interaction_feedback.js";
import {every,onlinePlayers} from "../core/scheduler.js";
import {readSlimeWorldFrame} from "../slime_frame_runtime.js";
const STORAGE_SORT_BLOCKS=new Set(['minecraft:chest','minecraft:trapped_chest','minecraft:barrel']);

function handleCustomBlockInteraction(block,player,intent){
 if(!block||(block.typeId!==GRILL_ID&&!isSeasoningBlock(block.typeId)))return;
 if(!interactionIntentStillCurrent(player,intent)){message(player,'§7操作已取消：互動後手持物品已改變');return}
 if(block.typeId===GRILL_ID)handleGrill(block,player,intent.hand);
 else handleSeasoningBlock(block,player,intent.hand);
}

// Native use poses cancel with the use action; no global zero-pose reset may override
// the next held item. Release server bookkeeping as well when a player disconnects.
world.afterEvents.playerLeave.subscribe(({playerId})=>{
 forgetPlayerFood(playerId);forgetPlayerEffects(playerId);forgetPlayerSkewer(playerId);
});

world.afterEvents.playerSpawn.subscribe(e=>{hideJavaEatingHud(e.player);forgetProjectileDodge(e.player);try{e.player.setProperty(EAT_PROJECTION_PROPERTY,false);e.player.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.player.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0);e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{};if(!e.initialSpawn){forgetHeavyMetalRescue(e.player.id);try{clearEffects(e.player)}catch{};forgetFoodUse(e.player.id);forgetEffectMovement(e.player.id);forgetNumbVisual(e.player.id);try{e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{}}});

world.beforeEvents.playerInteractWithEntity.subscribe(e=>{
 try{const action=skewerAction(e.player,e.itemStack??heldMain(e.player));if(!action)return;e.cancel=true;scheduleSkewerAction(e.player,action)}catch{}
});

// Stable Script API placement capture, including all materialized seasoning IDs.
system.beforeEvents.startup.subscribe(({blockComponentRegistry})=>{
 blockComponentRegistry.registerCustomComponent('kaleidoscope_grilling:grill_tick',{onTick(e){tickGrill(e.block);tickGrillDisplay(e.block)}});
 blockComponentRegistry.registerCustomComponent('kaleidoscope_grilling:grill_legs_tick',{onTick(e){try{const above=e.block.above();if(above&&above.typeId!==GRILL_ID)e.block.setType('minecraft:air')}catch{}}});
 blockComponentRegistry.registerCustomComponent('senluo:grilling_bottle_place',{beforeOnPlayerPlace:scheduleNativeBottlePlacement,onTick(e){try{tickNativeBottleSupport(e.block)}catch(error){console.warn('[Grilling bottle support recovery] '+error)}}});
});

onBlockInteraction('main',e=>{
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
 scheduleHandAction(p,()=>{try{const target=dim.getBlock(loc);if(bottleCapture&&!bottleActionStillCurrent(target,bottleCapture))return;handleCustomBlockInteraction(target,p,intent)}catch(error){console.warn('[Grilling block action] '+error);try{interactionFailure(p,'§c操作未完成；請查看紀錄並核對原料')}catch{}}});
},{"priority":100});

world.beforeEvents.playerBreakBlock.subscribe(e=>{
 if(e.cancel)return;
 if(e.block.typeId===GRILL_ID){scheduleGrillPlayerBreak(e);return}
 scheduleNativeBottleBreak(e);
});

every('players',()=>{
 const slimeFrame=readSlimeWorldFrame(world);
 for(const player of onlinePlayers())try{tickPlayerFood(player,slimeFrame);tickPlayerEffects(player);}catch{}
},1);
