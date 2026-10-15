import {utf8Bytes} from './integration_stack_core.js';
/** Java 1.1.1 effects: milk preserves only uncurable heavy-metal poisoning; death clears all. */
export const FX_KEY='kaleidoscope_grilling:a21_fx';
// Supported ingredient registration clamps amplifiers to 0..255. A Java hidden
// chain strictly descends in amplifier, so 256 nodes covers every supported
// chain without allowing malformed/cyclic saved data to grow or loop forever.
export const MAX_EFFECT_CHAIN=256;
export function activeEffect(value,t){
 let head,tail,previousAmp=Infinity;const seen=new Set();
 for(let depth=0;value&&depth<MAX_EFFECT_CHAIN;depth++,value=value.hidden){
  if(typeof value!=='object'||Array.isArray(value)||seen.has(value))break;
  seen.add(value);
  const until=Number(value.until),rawAmp=Number(value.amp),amp=Math.max(0,Math.floor(Number.isFinite(rawAmp)?rawAmp:0));
  // A malformed hidden tail is ignored; its valid owning head is preserved.
  // Legacy heads keep their old finite {until,amp} representation unchanged.
  if(!Number.isFinite(until)||amp>=previousAmp)break;
  previousAmp=amp;
  const row={until,amp};if(tail)tail.hidden=row;else head=row;tail=row;
 }
 // Java decrements hidden layers concurrently, but promotes only the
 // immediate layer. An already-expired immediate layer ends the effect;
 // skipping it would incorrectly resurrect a deeper, longer weak layer.
 while(head&&head.until<=t){
  const next=head.hidden;if(!next||next.until<=head.until)return undefined;
  head=next;
 }
 return head;
}
export function activeEffects(value,t){
 const out={};if(!value||typeof value!=='object'||Array.isArray(value))return out;
 for(const [name,v] of Object.entries(value)){const row=activeEffect(v,t);if(row)out[name]=row;}
 return out;
}
/** MobEffectInstance.update: application merges strength/duration together.
 * Absolute deadlines make hidden instances count down concurrently, including
 * saves/reloads; activeEffect promotes only when the active deadline expires.
 * This is for rewards only. Explicit reset/debit callers keep fxSet semantics.
 */
export function mergeEffectApplication(previous,ticks,amplifier,time){
 if(!Number.isFinite(time)||!Number.isFinite(ticks)||ticks<=0||!Number.isInteger(amplifier)||amplifier<0||amplifier>255)throw Error('Invalid effect application');
 const incoming={until:time+Math.max(1,Math.trunc(ticks)),amp:amplifier},current=activeEffect(previous,time);
 if(!current)return incoming;
 function merge(old,next){
  if(next.amp>old.amp){
   // Java retains the previous hidden chain even when the new stronger
   // duration overtakes the current head; expiry is resolved in layer order.
   return {...next,...(next.until<old.until?{hidden:old}:old.hidden?{hidden:old.hidden}:{})};
  }
  if(next.until>old.until){
   if(next.amp===old.amp)old.until=next.until;
   else old.hidden=old.hidden?merge(old.hidden,next):{...next};
  }
  return old;
 }
 return merge(current,incoming);
}
export function milkEffects(value,t){
 const fx=activeEffects(value,t);
 return fx.heavy_metal_poisoning?{heavy_metal_poisoning:fx.heavy_metal_poisoning}:{};
}
// Bedrock string dynamic properties are limited to 32767 UTF-8 bytes. Reject
// before a setter is called; never truncate a valid chain or erase prior state.
export const MAX_EFFECT_PAYLOAD_BYTES=32767;
export function effectPayload(value,t){
 const fx=activeEffects(value,t);if(!Object.keys(fx).length)return undefined;
 const raw=JSON.stringify(fx);
 if(utf8Bytes(raw)>MAX_EFFECT_PAYLOAD_BYTES)throw Error('Effect state exceeds 32767 UTF-8 bytes');
 return raw;
}
