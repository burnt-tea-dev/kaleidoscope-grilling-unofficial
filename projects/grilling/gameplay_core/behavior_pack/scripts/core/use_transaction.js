import {eatingIdentity,eatingStillCurrent} from './eating_transaction.js';

// A completion event describes the used item, not the player's current hand.
// Native food can already have consumed a single plate when this event arrives.
export function completedUseStillCurrent(use,eventStack,current,slot,nativeConsumed=false){
 if(!use||use.identity!==eatingIdentity(eventStack))return false;
 if(use.hand!=='off'&&use.slot!==slot)return false;
 if(current)return eatingStillCurrent(use,current,slot);
 return nativeConsumed&&eventStack?.amount===1;
}
