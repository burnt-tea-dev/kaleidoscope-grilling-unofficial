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
import {playerInventory as inventory,getMainHand as main,getOffHand as off,setMainHand as setMain,setOffHand as setOff} from '../core/player_io.js';
import {stackIntentSignature as interactionStackSignature} from '../core/interaction_intent_core.js';
import {captureInteractionIntent,interactionIntentStillCurrent} from '../core/interaction_intent_adapter.js';

const message=interactionFeedback;
function give(player,stack){
 const c=inventory(player);
 if(!c){try{player.dimension.spawnItem(stack,player.location)}catch{};return}
 try{const rem=c.addItem(stack);if(rem)player.dimension.spawnItem(rem,player.location)}
 catch{try{player.dimension.spawnItem(stack,player.location)}catch{}}
}
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
 const m=main(player),o=off(player),oil=readCookeryOilPot(o),type=oil.type,count=oil.count;
 const plan=planColdHouttuynia({
  blockId:CRAFTING_TABLE_ID,sneaking:!!player.isSneaking,
  mainId:m?.typeId,mainCount:m?.amount??0,offId:o?.typeId,oilType:type,oilCount:count
 });
 if(!plan.ok){message(player,failureText(plan.reason));return false}
 let output;try{output=new ItemStack(COLD_ID,1)}catch{return false}
 const beforeMain=m.clone(),beforeOff=o.clone();
 const afterMain=nextMainStack(m,plan.nextHouttuyniaCount);
 const afterOff=buildCookeryOilPot(type,plan.nextOilCount,o);if(!afterOff)return false;
 try{
  setMain(player,afterMain);setOff(player,afterOff);
 }catch{
  try{setMain(player,beforeMain);setOff(player,beforeOff)}catch{}
  interactionFailure(player,'§c合成交易失敗，已嘗試回滾');return false;
 }
 give(player,output);
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
 }catch{}});
},{"priority":90,"blocks":["minecraft:crafting_table"]});

