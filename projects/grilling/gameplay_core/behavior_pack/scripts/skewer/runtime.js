import {getItemLore,getItemProperty,getItemPropertyIds,getItemRawLore,setItemLore,setItemProperty} from "../itemData.js";
import {foodFacts} from "../food_snapshot_core.js";
import {canonicalFoodId} from "../eating_profile_ids.js";
import {SECRET_COOKED_INGREDIENTS_KEY,SECRET_COOKED_KEY,SECRET_CREATOR_KEY,SECRET_ID,SKEWER_INGREDIENTS_KEY,UNFINISHED_ID,appendOutcome,canAppendConfigured,expectedSize,isConfiguredIngredient,isDisassemblableRaw,secretFood} from "./skewering_core.js";
import {captureTwoHandIntent,primitiveStackProps,twoHandIntentStillCurrent} from "../core/interaction_intent_adapter.js";
import {captureSkewerMetadata,metadataSignature,restoreSkewerMetadata} from "../skewer_item_snapshot.js";
import {EnchantmentType,ItemStack,system,world} from "@minecraft/server";
import {creatorLore} from "../localized_lore_core.js";
import {resolveSecretSmokedId} from "../secret_compat_core.js";
import {secretEatingRows} from "../secret_eating_core.js";
import {FOOD_DATA} from "../eating_data_lookup.js";
import {captureWritableHand,getMainHand as heldMain,getOffHand as heldOff,isCreative as creative,playerInventory as mainContainer} from "../core/player_io.js";
import {canUseSecretSkewer} from "../food/runtime.js";
import {skewerIngredientDecision} from "../skewer_compat_core.js";
import {SECRET_MODEL_VARIANTS_KEY,appendedModelVariants} from "../secret_visual_state_core.js";
import {give,prepareOutputDelivery,reducedStack,transactionStatus} from "../core/actions.js";
import {commitPlayerItemTransaction,nativeItemSignature,ownedItemStep} from "../owned_item_transaction_core.js";
import {interactionFailure} from "../core/interaction_feedback.js";
import {useSound} from "../immersion_audio_runtime.js";
import {awardLookingThePart} from "../advancement/advancement_event_runtime.js";
import {rolledIngredientEffects} from "../effect/ingredient_effects.js";
import {applyOrdinary,dangerousPreservation,fxApply} from "../effect/runtime.js";
import {hasSolidTop} from "../blockSupport.js";
import {emitSecretIngredientConsumed} from "../secret_compat_runtime.js";
import {grillingConfig} from "../server_config_runtime.js";
import {configureSecretVisuals} from "../station_contents_visual_runtime.js";
import {configureSecretHeldReader} from "../secret_held_runtime.js";
import {configureSecretGrillReader} from "../grill_visual_runtime.js";
const THREAD_LAST=new Map();
const PENDING_HAND_ACTIONS=new Map();

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
  setItemLore(stack,[{translate:'tooltip.kaleidoscope_grilling.skewer.progress',with:[String(clean.length),String(expectedSize(clean))]},...clean.map((row,index)=>{let name;try{const item=new ItemStack(row.id);name=item.localizationKey?{translate:item.localizationKey}:undefined}catch{}return {rawtext:[{translate:'tooltip.kaleidoscope_grilling.skewer.ingredient',with:[String(index+1)]},{text:' '},row.native?.name||row.name?{text:row.native?.name??row.name}:name??{text:row.id}]}})]);
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

function secretEatingData(stack){
 try{
  const original=readSkewerRows(stack),cooked=isSecretCooked(stack),raw=secretEatingRows(original,id=>new ItemStack(id,1));
  if(!raw)return undefined;
  const rows=cooked?secretEatingRows(readEffectiveSkewerRows(stack),id=>new ItemStack(id,1)):raw;
  if(!rows)return undefined;
  const food=secretFood(rows,cooked,original);
  return Number.isFinite(food.nutrition)&&Number.isFinite(food.saturation)?{rows,food}:undefined;
 }catch{return undefined;}
}

function dynamicFood(stack){return canonicalFoodId(stack?.typeId)===SECRET_ID?secretEatingData(stack)?.food:FOOD_DATA[stack?.typeId]}

function isEdible(stack){if(stack?.typeId==='kaleidoscope_grilling:sweet_potato_powder')return false;try{return foodFacts(stack).edible}catch{return false}}

function threadOutcome(player){
 const food=heldMain(player),off=heldOff(player);if(!food||!off||player.isSneaking)return null;
 // Block/entity threading can bypass the item-use admission callback.
 if(canonicalFoodId(food.typeId)===SECRET_ID&&!canUseSecretSkewer(food))return null;
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
 // Every saved ingredient must still be reconstructible. Checking only the new
 // food can debit it into an old/corrupt skewer that can never be disassembled.
 for(const row of nextRows)restoreIngredient(row);
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

function scheduleHandAction(player,callback){
 // Idle presentation must not replace a hand captured by this deferred action.
 const id=player.id,pending=PENDING_HAND_ACTIONS.get(id)??new Set(),token={};
 pending.add(token);PENDING_HAND_ACTIONS.set(id,pending);
 const release=()=>{pending.delete(token);if(!pending.size&&PENDING_HAND_ACTIONS.get(id)===pending)PENDING_HAND_ACTIONS.delete(id)};
 try{system.run(()=>{try{callback()}finally{release()}})}catch(error){release();throw error}
}

function scheduleSkewerAction(player,action){
 const id=player.id,old=THREAD_LAST.get(id);if(old?.tick===system.currentTick)return true;
 const intent=captureTwoHandIntent(player);if(!intent)return false;
 const operation={tick:system.currentTick,action,intent};THREAD_LAST.set(id,operation);
 scheduleHandAction(player,()=>{
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
 for(const row of secretEatingData(stack)?.rows??[]){
  const behavior=rolledIngredientEffects(row);
  for(const e of behavior.effects){
   if(e.kind==='persistent_fx'){
    fxApply(player,e.effect,e.ticks,e.amplifier??0);
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


configureSecretVisuals(readEffectiveSkewerRows,restoreIngredient);

configureSecretHeldReader(readEffectiveSkewerRows,readSkewerRows);

configureSecretGrillReader(readEffectiveSkewerRows);


function hasPendingHandAction(id){return PENDING_HAND_ACTIONS.has(id);}
function forgetPlayerSkewer(id){THREAD_LAST.delete(id);PENDING_HAND_ACTIONS.delete(id);}
export {addNestedNutrition,addSecretNutrition,copyCustomData,dynamicFood,forgetPlayerSkewer,hasPendingHandAction,ingredientSnapshot,isSecretCooked,readSkewerRows,scheduleHandAction,scheduleSkewerAction,secretEatingData,secretRemainders,setCookedIngredientRows,skewerAction,validSecretIngredientRows};
