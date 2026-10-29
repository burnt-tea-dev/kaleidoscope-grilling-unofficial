import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';
export const EAT_NATIVE_TICKS_PROPERTY=PersistedKey.EAT_NATIVE_TICKS;
export const EAT_ELAPSED_TICKS_PROPERTY=PersistedKey.EAT_ELAPSED_TICKS;
export function eatingNativeTicks(value){const n=Number(value);return Number.isInteger(n)&&n>0&&n<=72000?n:0;}
export function eatingElapsedTicks(start,currentTick,duration){
 const maximum=eatingNativeTicks(duration),elapsed=Number(currentTick)-Number(start);
 return maximum&&Number.isInteger(elapsed)?Math.max(0,Math.min(maximum,elapsed)):0;
}
export function nativeEatingCompleted(start,currentTick,duration,remainingTicks){
 const maximum=eatingNativeTicks(duration),elapsed=currentTick-start;
 // Native use includes the start tick: measured 90-tick completion events
 // arrive at start+89 with zero remaining. This is separate from release grace.
 return maximum>0&&Number.isInteger(start)&&start>=0&&Number.isInteger(currentTick)&&
  Number.isInteger(remainingTicks)&&remainingTicks===0&&elapsed>=0&&elapsed+1>=maximum;
}
export const EAT_PROJECTION_PROPERTY=PersistedKey.EAT_PROJECTION;
export const EAT_PROFILE_PROPERTY=PersistedKey.EAT_PROFILE;
export const EAT_HAND_PROPERTY=PersistedKey.EAT_HAND;
export const PROFILE_CODES=Object.freeze({ONE:1,TWO:2,THREE:3,THREE_ALT:4,FOUR:5});
export function eatingProfile(requested,random01=Math.random(),nativeDuration=0){
 // Java chooses the random branch before getUseDuration. A Bedrock start
 // event already owns the JSON duration; never assign its 100-tick session
 // to THREE_ALT's 90-tick curve (or vice versa). Keep the item and metadata.
 // Fixed-duration items therefore cannot reproduce Java's random duration.
 const ticks=eatingNativeTicks(nativeDuration);
 const profile=requested==='THREE_RANDOM'?
  (ticks===100?'THREE':ticks===90?'THREE_ALT':random01<.5?'THREE':'THREE_ALT'):requested;
 if(!Object.hasOwn(PROFILE_CODES,profile))throw Error('Unknown eating profile');
 return {profile,code:PROFILE_CODES[profile],duration:profile==='THREE'?100:90};
}
