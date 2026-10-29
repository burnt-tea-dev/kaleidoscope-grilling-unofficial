import {getWorldProperty,setWorldProperty} from '../core/persist.js';
import {onBeforeBlockBreak,onExplosion,onScriptEvent} from '../core/events.js';
import {onBlockInteraction} from '../core/events.js';
import {grillingConfig} from '../server_config_runtime.js';
import {beginSeasoningMotion} from '../seasoning_motion_runtime.js';
import {replaceSeasoningUsesLore} from '../bottle_lore_core.js';
import {getItemProperty,setItemProperty,getItemPropertyIds,getItemLore,getItemRawLore,setItemLore} from '../core/persist.js';
import {interactionFeedback,interactionFailure,javaInteractionFeedback} from '../core/interaction_feedback.js';
import {world,system,ItemStack} from '@minecraft/server';
import {EMPTY_SEASONING_ID} from '../eating_data_lookup.js';
import {commitTwoParty} from '../grill/grill_transaction_core.js';
import {captureInteractionIntent,interactionIntentStillCurrent} from '../core/interaction_intent_adapter.js';
import {playerInventory,getMainHand,setMainHand,getHand,isCreative} from '../core/player_io.js';
import {readCookeryOilPot} from '../oil/cookery_oil_pot_adapter.js';
import {readPublicFood} from '../host_api/food_api_core.js';
import {SEASONING_MAX_USES,SEASONING_USES_KEY} from '../seasoning/seasoning_contract_core.js';
import {isSpecialSeasoningId} from '../seasoning/special_seasoning_visual_core.js';
import {retargetSpecialSeasoningStack,specialSeasoningVariant} from '../seasoning/special_seasoning_visual_runtime.js';
import {
 readFoodSeasonings,setFoodSeasonings,setHotFood,applyFoodMetadata
} from './food_state_adapter.js';
import {
 COOKERY_POT_ID,COOKERY_STOCKPOT_ID,COOKERY_FILLED_OIL_POT_ID,
 cuisineStateKey,cuisineStateKeyAt,normalizeCuisineState,stationKind,
 oilTypeFromHeld,planSeasoningUse,inventoryGains,metadataPlan,
 stateBeforeSeasoning,planPotOilTransition
} from './cookery_cuisine_core.js';
import {
 COOKERY_OUTPUT_READY_EVENT,normalizeCookeryOutputRequest,authoritativeTargetMatches
} from '../cookery_output_contract_core.js';

const message=interactionFeedback;
let authoritativeCuisineHost=false;
onScriptEvent('food/cookery_cuisine_runtime.js:0',event=>{
 if(event.id!=='kaleidoscope_cookery:api_ready')return;
 try{const info=JSON.parse(event.message);if(info.api===1&&Array.isArray(info.capabilities))authoritativeCuisineHost=info.capabilities.includes('grilling_pot_exact_flex_v1');}catch{}
});
function isFirst(event){return event.isFirstEvent!==false}
function readCuisineState(block){
 try{
  const raw=getWorldProperty(world,cuisineStateKey(block));
  return normalizeCuisineState(typeof raw==='string'?JSON.parse(raw):{});
 }catch{return normalizeCuisineState({})}
}
function writeCuisineState(block,state){
 try{
  const normalized=normalizeCuisineState(state);
  const empty=!normalized.seasoning.length&&!normalized.oilType&&!normalized.lastOutputTick;
  setWorldProperty(world,cuisineStateKey(block),empty?undefined:JSON.stringify(normalized));
  system.sendScriptEvent('kaleidoscope_cookery:cuisine_metadata',JSON.stringify({api:1,station:{dimensionId:block.dimension.id,x:block.x,y:block.y,z:block.z},state:normalized}));return true;
 }catch{return false}
}
function clearCuisineAt(dimensionId,location){
 try{setWorldProperty(world,cuisineStateKeyAt(dimensionId,location.x,location.y,location.z),undefined);system.sendScriptEvent('kaleidoscope_cookery:cuisine_metadata',JSON.stringify({api:1,station:{dimensionId,...location},state:{seasoning:[],oilType:''}}));return true}catch{return false}
}
function cuisineRemovalSnapshot(block){
 const dimension=block.dimension,location={...block.location},stateKey=cuisineStateKey(block);
 return {dimension,location,typeId:block.typeId,stateKey,raw:getWorldProperty(world,stateKey)};
}
function clearRemovedCuisine(event,rows){
 // Another before-event subscriber may cancel after our capture. An expired
 // event is not evidence that destruction completed.
 try{if(event.cancel!==false)return}catch(error){console.warn('[Grilling cuisine removal status] retained '+error);return}
 for(const row of rows)try{
  const live=row.dimension.getBlock(row.location);
  // An unloaded location, the original station or a replacement station does
  // not authorize deletion. Keep the exact captured metadata if it changed.
  if(!live||live.typeId===row.typeId||stationKind(live.typeId)||getWorldProperty(world,row.stateKey)!==row.raw)continue;
  let failure;try{setWorldProperty(world,row.stateKey,undefined)}catch(error){failure=error}
  if(getWorldProperty(world,row.stateKey)!==undefined)throw failure??Error('cuisine removal readback');
  system.sendScriptEvent('kaleidoscope_cookery:cuisine_metadata',JSON.stringify({api:1,station:{dimensionId:row.dimension.id,...row.location},state:{seasoning:[],oilType:''}}));
 }catch(error){console.warn('[Grilling cuisine removal] retained '+error)}
}
function hostHasOil(block){
 try{return block?.permutation?.getState('kaleidoscope_cookery:has_oil')===true}catch{return false}
}
function primitiveProps(stack){
 const out={};let ids=[];try{ids=getItemPropertyIds(stack)??[]}catch{}
 for(const id of ids)try{
  const value=getItemProperty(stack,id);
  if(['string','number','boolean'].includes(typeof value))out[id]=value;
  else if(value&&typeof value==='object'&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&Number.isFinite(value.z))
   out[id]={x:value.x,y:value.y,z:value.z};
 }catch{}
 return out;
}
function descriptor(stack){
 if(!stack)return null;let lore=[],name='',damage=null;
 try{lore=getItemLore(stack)}catch{}try{name=stack.nameTag??''}catch{}
 try{damage=Number(stack.getComponent('minecraft:durability')?.damage??0)}catch{}
 return {id:stack.typeId,amount:Number(stack.amount)||1,name,lore,props:primitiveProps(stack),damage};
}
function snapshotInventory(player){
 const c=playerInventory(player);if(!c)return [];
 const rows=[];for(let i=0;i<c.size;i++)rows.push(descriptor(c.getItem(i)));return rows;
}
function foodLike(stack){if(!stack)return false;try{return !!stack.getComponent('minecraft:food')}catch{return false}}
function giveCustom(player,stack){
 const c=playerInventory(player);
 if(!c){try{player.dimension.spawnItem(stack,player.location)}catch{};return}
 try{const rem=c.addItem(stack);if(rem)player.dimension.spawnItem(rem,player.location)}
 catch{try{player.dimension.spawnItem(stack,player.location)}catch{}}
}
function rewriteGain(player,gain,plan){
 const c=playerInventory(player);if(!c)return false;
 const current=c.getItem(gain.slot);
 if(readPublicFood(current).present)return false;
 if(!current||current.typeId!==gain.id||current.amount<gain.count||!foodLike(current))return false;
 const custom=current.clone();custom.amount=gain.count;applyFoodMetadata(custom,plan);
 const remain=current.amount-gain.count;
 if(remain>0){current.amount=remain;c.setItem(gain.slot,current);giveCustom(player,custom)}
 else c.setItem(gain.slot,custom);
 return true;
}
function typedHeldOil(stack){
 if(!stack)return '';
 if(stack.typeId===COOKERY_FILLED_OIL_POT_ID){
  const state=readCookeryOilPot(stack);return oilTypeFromHeld(stack.typeId,state?.type??'');
 }
 return oilTypeFromHeld(stack.typeId,'');
}
function readUses(stack){
 try{return Math.max(0,Math.min(SEASONING_MAX_USES,Number(getItemProperty(stack,SEASONING_USES_KEY)??0)|0))}catch{return 0}
}
function setUses(stack,n){
 try{setItemProperty(stack,SEASONING_USES_KEY,Math.max(0,Math.min(SEASONING_MAX_USES,n|0)))}catch{}return stack;
}
function applySeasoning(player,block){
 if(!grillingConfig().enableCookeryFoodHeatAndSeasoning){javaInteractionFeedback(player,'cookery_integration_disabled');return true;}
 const held=getMainHand(player);if(!isSpecialSeasoningId(held?.typeId))return false;
 const ingredients=readFoodSeasonings(held),uses=readUses(held);
 const plan=planSeasoningUse({ingredients,uses,creative:isCreative(player)});
 if(!plan.ok){message(player,'§7調料瓶內沒有可用調料');return true}
 // Prepare the replacement before either participant is changed.
 const inventory=playerInventory(player),slot=player.selectedSlotIndex;
 if(plan.mutate&&!inventory){interactionFailure(player,'§c無法讀取背包，操作已取消');return true}
 let next;
 if(plan.mutate){
  next=plan.replaceEmpty?new ItemStack(EMPTY_SEASONING_ID,1):retargetSpecialSeasoningStack(held,plan.nextUses,specialSeasoningVariant(held));
  if(!next){interactionFailure(player,'§c調料外觀狀態同步失敗，操作已取消');return true}
  if(!plan.replaceEmpty)try{
   setItemLore(next,replaceSeasoningUsesLore(getItemRawLore(next),SEASONING_MAX_USES-plan.nextUses));
  }catch{interactionFailure(player,'§c調料資料準備失敗，操作已取消');return true}
 }
 const key=cuisineStateKey(block),beforeRaw=getWorldProperty(world,key);
 const state=stateBeforeSeasoning(stationKind(block.typeId),readCuisineState(block),hostHasOil(block));
 const result=commitTwoParty(
  ()=>{if(plan.mutate)inventory.setItem(slot,next)},
  ()=>{if(!writeCuisineState(block,{...state,seasoning:plan.ingredients}))throw new Error('cuisine_state_write')},
  ()=>{if(plan.mutate)inventory.setItem(slot,held)},
  ()=>setWorldProperty(world,key,beforeRaw)
 );
 if(!result.ok){
  if(result.rollbackErrors)console.warn('[Grilling] seasoning rollback failed: '+result.rollbackErrors);
  interactionFailure(player,result.rollbackErrors?'§c操作失敗且回滾不完整，請查看 Content Log':'§c操作未完成，調料與鍋具狀態已回復');return true;
 }
 try{beginSeasoningMotion(player,'main');player.playAnimation('animation.kg_imm.player.season.main',{blendOutTime:0})}catch{}
 try{player.playSound('kg_imm.season',{volume:.85,pitch:1})}catch{}
 return true;
}
function finishHostInteraction(player,dimension,location,kind,beforeInventory,beforeHasOil,candidateOil,stateBefore){
 if(!grillingConfig().enableCookeryFoodHeatAndSeasoning)return;
 const block=dimension.getBlock(location),afterInventory=authoritativeCuisineHost?[]:snapshotInventory(player),gains=inventoryGains(beforeInventory,afterInventory);
 const afterHasOil=kind==='pot'&&block?.typeId===COOKERY_POT_ID?hostHasOil(block):false;
 if(kind==='pot'){
  const transition=planPotOilTransition(stateBefore,beforeHasOil,afterHasOil,candidateOil);
  if(transition.changed&&block?.typeId===COOKERY_POT_ID)writeCuisineState(block,transition.state);
 }
 // Modern host output receipts identify actual dishes; raw ingredient removal
 // must not be guessed to be a cooked output from an inventory increase.
 if(authoritativeCuisineHost)return;
 const effective={...stateBefore,oilType:kind==='pot'?(stateBefore.oilType||(beforeHasOil?'default':'')):stateBefore.oilType};
 const plan=metadataPlan(kind,effective);
 let decorated=0;for(const gain of gains)if(rewriteGain(player,gain,plan))decorated++;
 if(decorated>0){
  if(kind==='pot')clearCuisineAt(dimension.id,location);
  else if(block?.typeId===COOKERY_STOCKPOT_ID)writeCuisineState(block,{...stateBefore,lastOutputTick:system.currentTick});
 }
}
function outputTarget(request){
 const target=request.target;
 if(target.kind==='player_slot'){
  const player=world.getAllPlayers().find(p=>p.id===target.playerId);if(!player)return null;
  const container=playerInventory(player);if(!container||target.slot>=container.size)return null;
  return {container,slot:target.slot};
 }
 try{
  const dimension=world.getDimension(target.dimensionId),block=dimension.getBlock({x:target.x,y:target.y,z:target.z});
  const container=block?.getComponent('minecraft:inventory')?.container;
  if(!container||target.slot>=container.size)return null;
  return {container,slot:target.slot};
 }catch{return null}
}
export function applyAuthoritativeCookeryOutput(request){
 try{
  const normalized=normalizeCookeryOutputRequest(request);if(!normalized)return false;
  const dimension=world.getDimension(normalized.station.dimensionId);
  const location={x:normalized.station.x,y:normalized.station.y,z:normalized.station.z};
  const station=dimension.getBlock(location),kind=stationKind(station?.typeId);if(!kind)return false;
  if(normalized.version===2){
   const item=normalized.target.kind==='item_entity'?world.getEntity(normalized.target.entityId)?.getComponent('minecraft:item')?.itemStack:(()=>{const t=outputTarget(normalized);return t?.container.getItem(t.slot)})();
   const portable=readPublicFood(item);return authoritativeTargetMatches(item,normalized.target)&&portable.valid&&JSON.stringify(portable.state)===JSON.stringify(normalized.metadata);
  }
  if(!grillingConfig().enableCookeryFoodHeatAndSeasoning)return true;
  const target=outputTarget(normalized);if(!target)return false;
  const current=target.container.getItem(target.slot);
  if(!authoritativeTargetMatches(current,normalized.target)||!foodLike(current))return false;
  const state=readCuisineState(station),plan=metadataPlan(kind,state),decorated=current.clone();
  applyFoodMetadata(decorated,plan);target.container.setItem(target.slot,decorated);
  if(kind==='pot')clearCuisineAt(dimension.id,location);
  else writeCuisineState(station,{...state,lastOutputTick:system.currentTick});
  return true;
 }catch{return false}
}
onScriptEvent('food/cookery_cuisine_runtime.js:1',event=>{
 if(event.id!==COOKERY_OUTPUT_READY_EVENT)return;
 try{
  const request=normalizeCookeryOutputRequest(JSON.parse(String(event.message??'{}')));
  if(!request)throw new Error('invalid authoritative output payload');
  system.run(()=>{if(!applyAuthoritativeCookeryOutput(request))console.warn('[Grilling Cookery output] authoritative target was not decorated')});
 }catch(error){console.warn('[Grilling Cookery output] '+error)}
});
onBlockInteraction('a2750_cookery_cuisine_runtime',event=>{
 try{
  const kind=stationKind(event.block?.typeId);if(!kind)return;
  const player=event.player,intent=captureInteractionIntent(player,event.itemStack),hand=intent.hand,used=getHand(player,hand);
  if(hand==='main'&&isSpecialSeasoningId(used?.typeId)){
   event.cancel=true;if(!isFirst(event))return;const dimension=event.block.dimension,location={...event.block.location};
   system.run(()=>{if(!interactionIntentStillCurrent(player,intent)){message(player,'§7操作已取消：手持物品已改變');return}const block=dimension.getBlock(location);if(block&&stationKind(block.typeId)===kind)applySeasoning(player,block)});return;
  }
  if(!isFirst(event)||!grillingConfig().enableCookeryFoodHeatAndSeasoning)return;
  const dimension=event.block.dimension,location={...event.block.location};
  const stateBefore=readCuisineState(event.block),beforeInventory=authoritativeCuisineHost?[]:snapshotInventory(player);
  const beforeHasOil=kind==='pot'?hostHasOil(event.block):false,candidateOil=kind==='pot'?typedHeldOil(used):'';
  system.run(()=>finishHostInteraction(player,dimension,location,kind,beforeInventory,beforeHasOil,candidateOil,stateBefore));
 }catch{}
},{"priority":80});
onBeforeBlockBreak('food/cookery_cuisine_runtime.js:0',event=>{
 try{
  if(event.cancel!==false||!stationKind(event.block?.typeId))return;
  const row=cuisineRemovalSnapshot(event.block);system.run(()=>clearRemovedCuisine(event,[row]));
 }catch{}
});
onExplosion('food/cookery_cuisine_runtime.js:0',event=>{
 try{
  if(event.cancel!==false)return;
  const rows=[];
  for(const block of event.getImpactedBlocks())if(stationKind(block?.typeId))rows.push(cuisineRemovalSnapshot(block));
  if(rows.length)system.run(()=>clearRemovedCuisine(event,rows));
 }catch{}
});
export function readCuisineExtensionState(block){return readCuisineState(block)}
