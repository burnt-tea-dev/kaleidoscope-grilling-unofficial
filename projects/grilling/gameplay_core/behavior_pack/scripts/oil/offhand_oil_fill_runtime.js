import {ensureOilHandPublished} from '../oil_api_client.js';
import {interactionFeedback,interactionFailure} from '../core/interaction_feedback.js';
import {world,system,ItemStack} from '@minecraft/server';
import {OIL_TYPES} from './oil_world.js';
import {readCookeryOilPot,planCookeryTypedOilAddition} from './cookery_oil_pot_adapter.js';
import {
 getMainHand,getOffHand,setMainHand,setOffHand,isCreative as creative
} from '../core/player_io.js';
import {oilTypeForBucketId,planOffhandOilFill,ITEM_FILL_POINTS} from './offhand_oil_fill_core.js';
import {stackIntentSignature as interactionStackSignature} from '../core/interaction_intent_core.js';
import {captureInteractionIntent,interactionIntentStillCurrent} from '../core/interaction_intent_adapter.js';

const message=interactionFeedback;

function verifyPot(stack,type,count){
 const state=readCookeryOilPot(stack);
 return state.filled&&state.type===type&&state.count===count;
}

function fillOffhandPot(player,expectedBucketId){
 if(!ensureOilHandPublished(player,'off',()=>fillOffhandPot(player,expectedBucketId)))return true;
 const main=getMainHand(player),off=getOffHand(player);
 if(main?.typeId!==expectedBucketId)return false;
 const type=oilTypeForBucketId(main.typeId,OIL_TYPES);if(!type)return false;

 const preview=planOffhandOilFill(readCookeryOilPot(off),type);
 if(!preview.handled)return false;
 if(!preview.ok){message(player,'§c油壺內已有不同內容或容量不足');return true}

 const plan=planCookeryTypedOilAddition(off,type,ITEM_FILL_POINTS);
 if(!plan.ok){message(player,'§c油壺內已有不同內容或容量不足');return true}

 let beforeMain,beforeOff;
 try{beforeMain=main.clone();beforeOff=off.clone()}catch{interactionFailure(player,'§c油壺更新失敗');return true}

 const keepBucket=creative(player);
 try{
  setOffHand(player,plan.next);
  if(!keepBucket)setMainHand(player,new ItemStack('minecraft:bucket',1));
 }catch{
  try{setMainHand(player,beforeMain);setOffHand(player,beforeOff)}catch{}
  interactionFailure(player,'§c油壺更新失敗，已嘗試回滾');return true;
 }

 const afterOff=getOffHand(player),afterMain=getMainHand(player);
 const potOk=verifyPot(afterOff,plan.type,plan.nextCount);
 const bucketOk=keepBucket?afterMain?.typeId===expectedBucketId:afterMain?.typeId==='minecraft:bucket';
 if(!potOk||!bucketOk){
  try{setMainHand(player,beforeMain);setOffHand(player,beforeOff)}catch{}
  interactionFailure(player,'§c油壺更新驗證失敗，已嘗試回滾');return true;
 }

 try{player.playSound(type==='premium_chili'?'bucket.empty_lava':'bucket.empty_water',{volume:.9,pitch:.8+.5*plan.nextCount/plan.capacity})}catch{}

 return true;
}

world.beforeEvents.itemUse.subscribe(ev=>{
 if(ev.cancel)return;
 const player=ev.source,eventItem=ev.itemStack,intent=captureInteractionIntent(player,eventItem);
 if(intent.hand!=='main')return;
 const main=getMainHand(player),off=getOffHand(player);if(!eventItem||main?.typeId!==eventItem.typeId)return;
 const type=oilTypeForBucketId(main.typeId,OIL_TYPES);if(!type)return;
 const preview=planOffhandOilFill(readCookeryOilPot(off),type);if(!preview.handled)return;
 ev.cancel=true;const bucketId=main.typeId,offSignature=interactionStackSignature(off);
 system.run(()=>{try{
  if(!interactionIntentStillCurrent(player,intent)||interactionStackSignature(getOffHand(player))!==offSignature){message(player,'§7操作已取消：油桶或油壺已變更');return}
  fillOffhandPot(player,bucketId);
 }catch{}});
});
