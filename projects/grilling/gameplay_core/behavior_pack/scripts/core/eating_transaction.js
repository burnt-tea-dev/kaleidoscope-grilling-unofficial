import {getItemProperty,setItemProperty,getItemPropertyIds,getItemLore,setItemLore} from '../itemDataCore.js';
import {primitiveStackProps} from './interaction_intent_core.js';

// Heat countdown lore changes while eating; authoritative heat/ingredient data must not.
export function eatingIdentity(stack){
 if(!stack)return null;
 const raw=primitiveStackProps(stack),props=Object.fromEntries(Object.keys(raw).sort().map(k=>[k,raw[k]]));
 return JSON.stringify({id:stack.typeId,amount:stack.amount,name:stack.nameTag??'',
  lore:getItemLore(stack).filter(x=>!String(x).startsWith('§c🔥')),props});
}
export function captureEatingIdentity(stack,hand,slot){return {identity:eatingIdentity(stack),hand,slot}}
export function eatingEventMatches(use,stack,time){
 if(!use||!stack)return false;const identity=eatingIdentity(stack);if(use.identity===identity)return true;
 if(!Number.isFinite(time))return false;
 try{const before=JSON.parse(use.identity),after=JSON.parse(identity),key='kaleidoscope_grilling:hot_until';if(Number(before.props[key])>0&&Number(before.props[key])<=time&&after.props[key]===undefined){delete before.props[key];return JSON.stringify(before)===JSON.stringify(after)}}catch{}
 return false;
}
export function eatingStillCurrent(use,current,slot,time){return !!use&&!!current&&(use.hand==='off'||use.slot===slot)&&eatingEventMatches(use,current,time);}

// Native completion can expose the original hand view or exactly one fewer
// serving. A matching event alone cannot authorize effects after a slot switch
// or replacement; all remaining saved metadata must still belong to this use.
export function completedEatingStillCurrent(use,eventStack,current,slot,time,nativeConsumed=true){
 try{
  if(!eatingEventMatches(use,eventStack,time)||(use.hand!=='off'&&use.slot!==slot))return false;
  const before=JSON.parse(use.identity);
  if(!Number.isInteger(before.amount)||before.amount<1)return false;
  if(!current)return nativeConsumed&&before.amount===1;
  if(eatingStillCurrent(use,current,slot,time))return true;
  if(!nativeConsumed||before.amount<2||current.amount!==before.amount-1)return false;
  before.amount--;
  return eatingStillCurrent({...use,identity:JSON.stringify(before)},current,slot,time);
 }catch{return false;}
}


// No reward before a verified debit. A failed write cannot grant free nutrition.
// Adapters throw on unavailable storage; rollback is attempted on every failure.
export function commitEating({debit,reward,restoreFood,restoreNutrition}){
 try{debit();reward();return true}catch(error){
  let rollbackError;
  try{restoreNutrition()}catch(e){rollbackError=e}
  try{restoreFood()}catch(e){rollbackError=e}
  if(rollbackError)throw new Error('Eating rollback failed: '+rollbackError);
  return false;
 }
}
