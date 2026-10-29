import {onExplosion} from '../core/events.js';
import {breakDisposition,brush,canExtract,canInsert,flip,initialState,light,normalizeState,outputKind,season,tickState} from "../core_logic.js";
import {EnchantmentType,ItemStack,system,world} from "@minecraft/server";
import {grillStateKey as stateKey,occupiedGrillSlots as occupied,readGrillState as readState} from "./grill_state_adapter.js";
import {peekStationContainer,quarantineStation,retireEmptyStationContainer,stationContainer,storageKey as stationStorageKey} from "../family_station_storage.js";
import {hasSolidTop} from "../blockSupport.js";
import {SEASONING_MAX_USES,SEASONING_USES_KEY as SEASON_USES_KEY} from "../seasoning/seasoning_contract_core.js";
import {getItemProperty,setItemLore,setItemProperty} from "../itemData.js";
import {canonicalFoodId} from "../eating_profile_ids.js";
import {SECRET_COOKED_KEY,SECRET_ID} from "../skewer/skewering_core.js";
import {copyOne,message,planDamagedHand,reducedStack,transactionStatus} from "../core/actions.js";
import {copyCustomData,ingredientSnapshot,isSecretCooked,readSkewerRows,setCookedIngredientRows,validSecretIngredientRows} from "../skewer/runtime.js";
import {customSkewerCookedId,isCompatRawSkewer} from "../skewer_compat_core.js";
import {DARK_ID,EMPTY_SEASONING_ID,GRILL_ID,MYSTERIOUS_ID,OIL_TOOLS,RAW_TO_COOKED} from "../eating_data_lookup.js";
import {readFoodSeasonings as readSeasonings,refreshHotLore,setFoodSeasonings as setSeasonings,setHotFood as setHot} from "../food/food_state_adapter.js";
import {createFailedSkewer} from "../failure_skewer_visual_core.js";
import {captureWritableHand,getHand as heldByHand,isCreative as creative,playerInventory as mainContainer} from "../core/player_io.js";
import {planInventoryInsert,slotWrite} from "../rack_transfer_plan.js";
import {acknowledgedDrop,commitStationTransfer} from "../grill_transfer.js";
import {interactionFailure,javaInteractionFeedback} from "../core/interaction_feedback.js";
import {blockSound,grillFireSound,removeGrillAudio,updateGrillAudio} from "../immersion_audio_runtime.js";
import {captureSkewerMetadata,metadataSignature} from "../skewer_item_snapshot.js";
import {COOKERY_FILLED_ID as COOKERY_FILLED,planCookeryOilPotConsumption} from "../oil/cookery_oil_pot_adapter.js";
import {isSpecialSeasoningId} from "../seasoning/special_seasoning_visual_core.js";
import {retargetSpecialSeasoningStack,specialSeasoningVariant} from "../seasoning/special_seasoning_visual_runtime.js";
import {seasoningLore} from "../localized_lore_core.js";
import {isExtinguishTool} from "./grill_input_core.js";
import {ensureOilHandPublished} from "../oil_api_client.js";
import {awardGleamingWithOil} from "../advancement/advancement_event_runtime.js";
import {grillingConfig} from "../server_config_runtime.js";
import {beginOilBrushVisual,cancelOilBrushVisual,oilBrushStopExpression} from "../oil_brush_visual_runtime.js";
import {suppressNumbVisual} from "../numb_visual_runtime.js";
import {beginSeasoningMotion} from "../seasoning_motion_runtime.js";
import {commitTwoParty} from "./grill_transaction_core.js";
import {grillAmbientParticles} from "../immersion_particles_runtime.js";
const GRILL_LEGS_ID='kaleidoscope_grilling:grill_legs';

const OIL_TYPES=Object.freeze({canola:{heatTicks:1200},secret_chili:{heatTicks:12000},premium_chili:{heatTicks:24000}});

function writeTickState(block,before,next){
 const state=normalizeState(next),beforeState=normalizeState(before);
 const same=beforeState.phase===state.phase&&beforeState.phaseTicks===state.phaseTicks&&beforeState.flips===state.flips&&beforeState.flipCooldown===state.flipCooldown&&beforeState.seasoned===state.seasoned&&beforeState.failed===state.failed&&beforeState.heatTicks===state.heatTicks&&beforeState.lit===state.lit&&beforeState.seasonings.length===state.seasonings.length&&beforeState.seasonings.every((x,i)=>x===state.seasonings[i]);
 if(!same)world.setDynamicProperty(stateKey(block),JSON.stringify(state));
 // Java updateShape changes LEGGED when support below changes. Keep that visual/support sync live even on an otherwise idle grill.
 syncGrillPermutation(block,state);
 return state;
}

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
  if(!out)return failedStack(raw,MYSTERIOUS_ID);
  stack=new ItemStack(out,1);copyCustomData(raw,stack);
 }
 setHot(stack,state.heatTicks);setSeasonings(stack,state.seasonings??[]);
 try{setItemProperty(stack,'kaleidoscope_grilling:seasoned',state.seasoned)}catch{}
 return refreshHotLore(stack);
}

function failedStack(raw,id){return createFailedSkewer(raw,id,(type,amount)=>new ItemStack(type,amount),type=>new EnchantmentType(type))}

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
   grillFireSound(block,true);
  }
  return
 }
 if(isExtinguishTool(id)&&state.lit){
  state=light(state,false);writeState(block,state);grillFireSound(block,false);return
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
   // Render-only oil-specific brush; capture the post-transaction pot and stop
   // both the substitute and arm on switch/cancel or Java's 20-tick endpoint.
   try{
    if(grillingConfig().enableOilBrushVisuals){
     if(beginOilBrushVisual(player,hand,oil.type)){player.playAnimation('animation.kg_oil_brush.player.'+hand,{controller:'kg_oil_brush',blendOutTime:0,stopExpression:oilBrushStopExpression(hand)});suppressNumbVisual(player,system.currentTick,20)}
    }else{player.playAnimation('animation.kg_imm.player.brush.'+hand,{blendOutTime:.12});suppressNumbVisual(player,system.currentTick,29)}
   }catch{try{cancelOilBrushVisual(player)}catch{}}
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

world.afterEvents.playerPlaceBlock.subscribe(e=>{if(e.block.typeId===GRILL_ID)resetBlock(e.block,false)});

onExplosion('grill/runtime.js:0',scheduleGrillExplosion);

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


function commitGrillAndHand(block,beforeState,nextState,player,hand,beforeStack,nextStack,mutateHand=true){
 // The operation planner owns Creative rules: durability is exempt, while
 // Java brushing and seasoning consume their tool contents in either mode.
 const storage=captureWritableHand(player,hand),mutate=mutateHand;
 return commitStationTransfer(block,[
  {apply:()=>writeState(block,nextState),rollback:()=>writeState(block,beforeState)},
  {apply:()=>{if(mutate)storage.write(nextStack)},rollback:()=>{if(mutate)storage.write(storage.before)}}
 ],'grill/hand').ok;
}
export {getUses,handleGrill,scheduleGrillPlayerBreak,setUses,tickGrill};
