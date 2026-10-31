import {captureSkewerMetadata,metadataSignature} from './skewer_item_snapshot.js';
import {isHeatLore} from './localized_lore_core.js';
import {readPublicFood,readPublicFoodLore,isFoodPayloadLine,isCuisineQualityLore,FOOD_PAYLOAD_KEY} from './host_api/food_api_core.js';
import {cuisineQualityPayloadMatches} from './host_api/cuisine_quality_core.js';
import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';
import {nativeEatingCompleted} from './core/player_props.js';

// This fence owns ONLY the existing heat/seasoning completion effects. Native
// JSON owns all cuisine nutrition and its food debit, including quality variants.
// No timer or after-event adds/removes quality nutrition from the player.
// Also safe in beforeEvents: it needs only the exposed native ID/raw lore.
export function canUseCuisineFood(stack){return cuisineQualityPayloadMatches(stack?.typeId,readPublicFood(stack));}
function snapshot(stack){
 if(!stack||!Number.isInteger(stack.amount)||stack.amount<1||!cuisineQualityPayloadMatches(stack.typeId,readPublicFood(stack)))throw Error('Cuisine eating identity unreadable');
 return {native:captureSkewerMetadata(stack),amount:stack.amount};
}
function identity(native,time){
 const data=JSON.parse(JSON.stringify(native)),portable=readPublicFoodLore(data.rawLore??[]),hotKey=PersistedKey.HOT_UNTIL;
 if(portable.present&&!portable.valid)throw Error('Cuisine food metadata unreadable');
 let lore=(data.rawLore??[]).filter(row=>!isHeatLore(row)&&!isCuisineQualityLore(row));
 if(portable.valid){
  const state={...portable.state};if(state.hotUntil>0&&state.hotUntil<=time)state.hotUntil=0;
  // Countdown cleanup can move the owned public line; preserve every other
  // exposed line and all seasoning/quality values while comparing ownership.
  lore=lore.filter(row=>!isFoodPayloadLine(row));
  lore.push({translate:FOOD_PAYLOAD_KEY,with:[JSON.stringify(state)]});
 }
 if(lore.length)data.rawLore=lore;else delete data.rawLore;
 if(data.props&&Number(data.props[hotKey])>0&&Number(data.props[hotKey])<=time){delete data.props[hotKey];if(!Object.keys(data.props).length)delete data.props;}
 return metadataSignature(data);
}
export function captureCuisineUse(stack,main,off,slot,start,nativeDuration,time){
 try{
  if(!Number.isInteger(slot)||slot<0||!Number.isInteger(start)||start<0||!Number.isInteger(nativeDuration)||nativeDuration<=0||!Number.isFinite(time))return undefined;
  const event=snapshot(stack),expected=identity(event.native,time),matches=[];
  for(const [hand,current] of [['main',main],['off',off]])if(current?.typeId===stack.typeId){
   const value=snapshot(current);if(value.amount===event.amount&&identity(value.native,time)===expected)matches.push(hand);
  }
  // The event has no hand field. Identical simultaneous hands cannot prove
  // which captured serving owns the optional completion effects.
  if(matches.length!==1)return undefined;
  return {...event,hand:matches[0],slot,start,nativeDuration};
 }catch{return undefined;}
}
export function cuisineUseEventMatches(use,stack,time){
 try{
  if(!use||!Number.isFinite(time))return false;
  const event=snapshot(stack);
  return event.amount<=use.amount&&identity(use.native,time)===identity(event.native,time);
 }catch{return false;}
}
export function completedCuisineUse(use,eventStack,current,slot,currentTick,remainingTicks,time){
 if(!cuisineUseEventMatches(use,eventStack,time)||(use.hand!=='off'&&use.slot!==slot)||!nativeEatingCompleted(use.start,currentTick,use.nativeDuration,remainingTicks))return false;
 try{
  if(!current)return use.amount===1;
  const actual=snapshot(current);
  // The completion callback may expose the original view or the native
  // decrement. Neither permits another script debit or a nutrition refund.
  return (actual.amount===use.amount||actual.amount===use.amount-1)&&identity(actual.native,time)===identity(use.native,time);
 }catch{return false;}
}
