import {onBlockInteraction} from '../core/events.js';
import {interactionFeedback,interactionFailure} from '../core/interaction_feedback.js';
import {world,system,ItemStack} from '@minecraft/server';
import {
 COLD_ID,HOUTTUYNIA_ID,CRAFTING_TABLE_ID,REQUIRED_OIL_TYPE,
 planColdHouttuynia
} from './cold_houttuynia_core.js';
import {
 COOKERY_FILLED_ID,readCookeryOilPot,buildCookeryOilPot
} from '../oil/cookery_oil_pot_adapter.js';
import {playerInventory as inventory,getOffHand as off,captureWritableHand} from '../core/player_io.js';
import {prepareOutputDelivery,transactionStatus} from '../core/actions.js';
import {commitPlayerItemTransaction,ownedItemStep} from '../core/transaction.js';
import {stackIntentSignature as interactionStackSignature} from '../core/interaction_intent_core.js';
import {captureInteractionIntent,interactionIntentStillCurrent} from '../core/interaction_intent_adapter.js';

const message=interactionFeedback;
function nextMainStack(stack,count){
 if(count<=0)return undefined;
 const next=stack.clone();next.amount=count;return next;
}
function failureText(reason){
 switch(reason){
  case'need_houttuynia':return '§e涼拌折耳根需要主手至少 3 個折耳根';
  case'wrong_oil':return '§c需要高級辣椒油（premium_chili）';
  case'need_oil':return '§c高級辣椒油至少需要 2 點';
  case'need_oil_pot':return '§e副手需要 Cookery 油壺';
  default:return '§7配料不符合涼拌折耳根配方';
 }
}

export function tryCraftColdHouttuynia(player){
 const main=captureWritableHand(player,'main'),other=captureWritableHand(player,'off');
 const m=main.before,o=other.before,oil=readCookeryOilPot(o),type=oil.type,count=oil.count;
 const plan=planColdHouttuynia({
  blockId:CRAFTING_TABLE_ID,sneaking:!!player.isSneaking,
  mainId:m?.typeId,mainCount:m?.amount??0,offId:o?.typeId,oilType:type,oilCount:count
 });
 if(!plan.ok){message(player,failureText(plan.reason));return false}
 let output;try{output=new ItemStack(COLD_ID,1)}catch{return false}
 const afterMain=nextMainStack(m,plan.nextHouttuyniaCount);
 const afterOff=buildCookeryOilPot(type,plan.nextOilCount,o);if(!afterOff)return false;
 const container=inventory(player);if(!container)throw Error('Cold houttuynia inventory unavailable');
 const startingItems=Array.from({length:container.size},(_,slot)=>container.getItem(slot)?.clone());
 startingItems[player.selectedSlotIndex]=afterMain?.clone();
 // Reuse the slot freed by the last three roots. Recover every output before
 // returning inputs; an unconfirmed drop must never trigger a second delivery.
 const delivery=prepareOutputDelivery(player,[output],startingItems);
 const mainWrite=ownedItemStep({read:main.read,write:main.write,before:m,after:afterMain,canRestore:delivery.canRestoreInputs});
 const oilWrite=ownedItemStep({read:other.read,write:other.write,before:o,after:afterOff,canRestore:delivery.canRestoreInputs});
 if(!transactionStatus(commitPlayerItemTransaction(world,player,[mainWrite,oilWrite,...delivery.steps],
  {tick:system.currentTick,label:'cold_houttuynia'}),'cold houttuynia')){
  interactionFailure(player,'§c合成未完成；已回復可確認的原料，未確認交易請查看紀錄');return false;
 }
 try{player.dimension.playSound('random.pop',player.location,{volume:.65,pitch:1.15})}catch{}

 return true;
}

onBlockInteraction('a2722_cold_houttuynia_runtime',ev=>{
 if(ev.cancel||ev.block?.typeId!==CRAFTING_TABLE_ID||!ev.player?.isSneaking)return;
 if(ev.itemStack?.typeId!==HOUTTUYNIA_ID)return;
 const player=ev.player,intent=captureInteractionIntent(player,ev.itemStack);
 if(intent.hand!=='main')return;
 const oil=off(player);if(oil?.typeId!==COOKERY_FILLED_ID)return;
 ev.cancel=true;if(ev.isFirstEvent===false)return;
 const offSignature=interactionStackSignature(oil);
 system.run(()=>{try{
  if(!interactionIntentStillCurrent(player,intent)||interactionStackSignature(off(player))!==offSignature){message(player,'§7操作已取消：折耳根或油壺已變更');return}
  tryCraftColdHouttuynia(player);
 }catch(error){interactionFailure(player,'§c合成未完成，請查看紀錄');console.warn('[Grilling cold houttuynia] '+error)}});
},{"priority":90,"blocks":["minecraft:crafting_table"]});

