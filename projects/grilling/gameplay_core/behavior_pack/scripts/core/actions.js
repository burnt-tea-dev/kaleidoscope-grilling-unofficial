import {system,world} from "@minecraft/server";
import {interactionFeedback} from "./interaction_feedback.js";
import {getHand as heldByHand,isCreative as creative,playerInventory as mainContainer,setHand} from "./player_io.js";
import {nextDurability} from "../grill/grill_input_core.js";
import {planOwnedInventoryDelivery} from "../owned_item_transaction_core.js";
import {mergeIntoContainer} from "../skewer/hot_runtime.js";
function now(){try{return world.getAbsoluteTime()}catch{return system.currentTick}}

const message=interactionFeedback;

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
export {copyOne,give,message,now,planDamagedHand,prepareOutputDelivery,reducedStack,transactionStatus};
