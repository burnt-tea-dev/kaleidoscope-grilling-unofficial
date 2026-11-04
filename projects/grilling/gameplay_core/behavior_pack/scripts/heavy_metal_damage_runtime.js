import {world,system,EntityHealCause} from '@minecraft/server';
import {FX_KEY,activeEffects,effectPayload} from './effect_lifecycle_core.js';
import {writeEffects} from './effect_state_runtime.js';
import {definitelyLethalProvisionalHealth,sameHeavyMetalEffect,planHeavyMetalTransition} from './heavy_metal_damage_core.js';
import {HEAVY_METAL_CLAIM_KEY,parseHeavyMetalClaim,heavyMetalClaimPayload} from './heavy_metal_claim_core.js';

// The map only owns queued work. The entity's persistent claim closes the same
// until/amplifier across logout or script reload, even if settlement never ran.
// Do not expire that receipt or infer a new effect from a clock rollback.
const rescues=new Map();
function snapshot(entity){
 const time=world.getAbsoluteTime();
 if(!Number.isFinite(time))throw Error('Heavy Metal absolute clock is unavailable');
 const raw=entity.getDynamicProperty(FX_KEY);
 if(raw!==undefined&&typeof raw!=='string')throw Error('Heavy Metal effect state is unreadable');
 const value=raw===undefined?{}:JSON.parse(raw);
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Heavy Metal effect state is invalid');
 return {time,raw,effects:activeEffects(value,time),rawMetal:activeEffects({heavy_metal:value.heavy_metal},-Infinity).heavy_metal};
}
function claimSnapshot(entity){
 const raw=entity.getDynamicProperty(HEAVY_METAL_CLAIM_KEY);
 return {raw,claim:parseHeavyMetalClaim(raw)};
}
function replaceClaim(entity,expectedRaw,wanted){
 if(entity.getDynamicProperty(HEAVY_METAL_CLAIM_KEY)!==expectedRaw)
  throw Error('Heavy Metal claim preimage changed');
 let writeError;
 try{entity.setDynamicProperty(HEAVY_METAL_CLAIM_KEY,wanted)}catch(error){writeError=error}
 // A setter can apply before throwing. Only the actual readback establishes
 // this barrier; an unavailable or different value never authorizes cancel.
 if(entity.getDynamicProperty(HEAVY_METAL_CLAIM_KEY)!==wanted)
  throw writeError??Error('Heavy Metal claim write was not acknowledged');
}
function restoreUncanceledClaim(entity,token){
 const actual=entity.getDynamicProperty(HEAVY_METAL_CLAIM_KEY);
 if(actual===token.claimBefore)return;
 // No cleanup may overwrite another receipt, including a later incarnation.
 if(actual!==token.claimRaw)throw Error('Heavy Metal claim changed before rollback');
 replaceClaim(entity,token.claimRaw,token.claimBefore);
}
function restoreUncanceledEffects(entity,token){
 const actual=entity.getDynamicProperty(FX_KEY);
 if(actual!==token.effectsBeforeRaw&&actual!==token.effectsRaw)
  throw Error('Heavy Metal effects changed before rollback');
 writeEffects(entity,token.effectsBefore,{expectedRaw:actual});
}
function release(id,token){if(rescues.get(id)===token)rescues.delete(id)}
export function forgetHeavyMetalRescue(entityOrId){
 // Leave/death/remove/respawn invalidate callbacks without touching saved data.
 // A playerLeave ID or an invalid entity handle needs no property write here.
 try{rescues.delete(typeof entityOrId==='string'?entityOrId:entityOrId.id)}catch{}
}
function settle(entity,id,token){
 if(rescues.get(id)!==token||token.phase!=='pending')return;
 try{
  if(entity.isValid===false){release(id,token);return}
  if(claimSnapshot(entity).raw!==token.claimRaw)throw Error('Heavy Metal claim ownership changed');
  const health=entity.getComponent('minecraft:health'),value=health?.currentValue;
  if(!Number.isFinite(value))throw Error('Heavy Metal health is unreadable');
  if(value<=0){release(id,token);return} // Never resurrect a later death.

  // Effects were already paid before cancellation. Only native health and
  // cosmetics need deferred execution; expiry cleanup cannot revoke payment.
  token.phase='paid';
  if(rescues.get(id)!==token||entity.isValid===false)return;
  let healthError;try{health.setCurrentValue(1)}catch(error){healthError=error}
  if(entity.getComponent('minecraft:health')?.currentValue!==1)
   throw healthError??Error('Heavy Metal rescue health was not acknowledged');
  // Java broadcasts entity event 35 only after committing the rescue. Stable
  // Bedrock has no event-35 sender/native totem-screen API; retain its world
  // sound and add the supported native totem emitter as an explicit adaptation.
  // Either cosmetic may fail independently without retrying a paid rescue.
  try{entity.dimension.playSound('kg_java21.heavy_metal',entity.location)}catch{}
  try{entity.dimension.spawnParticle('minecraft:totem_particle',entity.getHeadLocation())}catch{}
 }catch(error){
  // A canceled hit is already protection. Do not grant another one on an
  // unchanged/unreadable effect, retry unknown writes, or replay native damage.
  // Keep the pre-cancel persistent receipt even when this callback is forgotten.
  console.warn('[Grilling heavy metal] '+error);
 }finally{release(id,token)}
}

/** The engine's confirmed totem heal, not a changed hand slot, owns this cure.
 * Keep poisoning and unrelated effects intact; only this module's Heavy Metal
 * behavior is adapted here. Other custom-effect cure rules are out of scope.
 */
export function handleHeavyMetalAfterHeal(event){
 if(event.healSource?.cause!==EntityHealCause.TotemOfUndying||!(event.healing>0))return false;
 try{
  const entity=event.healedEntity;
  if(entity.isValid===false||!(entity.getComponent('minecraft:health')?.currentValue>0))return false;
  // A real native totem may follow an earlier canceled hit in the same tick.
  // Its own health outcome must not be overwritten by that queued settlement.
  forgetHeavyMetalRescue(entity);
  const state=snapshot(entity);
  if(!state.effects.heavy_metal)return false;
  const next={...state.effects};delete next.heavy_metal;
  writeEffects(entity,next,{expectedRaw:state.raw});
  return true;
 }catch(error){console.warn('[Grilling native totem cure] '+error);return false}
}

/** Called only by the existing before-hurt subscriber, after dodge and
 * invincibility. Native totem admission is unchanged here: a held item alone
 * does not prove a later native heal will be accepted.
 */
export function handleHeavyMetalBeforeHurt(event){
 let entity,id,token;
 try{
  if(event.cancel||!(event.damage>0))return false;
  entity=event.hurtEntity;id=entity.id;
  if(typeof id!=='string'||entity.isValid===false)return false;
  const state=snapshot(entity),old=rescues.get(id);
  if(old){
   if(old.phase==='quarantined'&&!sameHeavyMetalEffect(state.rawMetal,old))release(id,old);
   else return false;
  }
  const metal=state.effects.heavy_metal;
  if(!sameHeavyMetalEffect(metal,metal)||state.effects.heavy_metal_poisoning)return false;
  const prior=claimSnapshot(entity);
  if(sameHeavyMetalEffect(prior.claim,metal))return false;
  const health=entity.getComponent('minecraft:health');
  if(!health||!definitelyLethalProvisionalHealth(health.currentValue,entity.getEffect?.('absorption')))return false;
  const next=planHeavyMetalTransition(state.effects,metal,state.time);
  token={...metal,time:state.time,phase:'reserving',claimBefore:prior.raw,claimRaw:heavyMetalClaimPayload(metal,state.time),
   effectsBeforeRaw:state.raw,effectsBefore:state.effects,effectsRaw:effectPayload(next,state.time)};
  rescues.set(id,token);
  // Stable server 2.9.0 explicitly permits dynamic-property setters in
  // restricted_execution. Native health and sound stay in the deferred callback.
  replaceClaim(entity,token.claimBefore,token.claimRaw);
  // Java pays inside onDeath, while Heavy Metal is active. Waiting one tick
  // lets normal expiry cleanup erase the last-tick rescue before it can pay.
  writeEffects(entity,next,{expectedRaw:state.raw});
  token.phase='pending';
  system.run(()=>settle(entity,id,token));
  let cancelError;try{event.cancel=true}catch(error){cancelError=error}
  if(event.cancel!==true)throw cancelError??Error('Heavy Metal cancellation was not acknowledged');
  return true;
 }catch(error){
  let cancelled;try{cancelled=event.cancel}catch{}
  if(token){
   if(cancelled===false){
    // A scheduler may queue and then throw. Revoke its exact token before
    // restoring only our receipt, and only after confirmed non-cancellation.
    release(id,token);
    try{restoreUncanceledEffects(entity,token);restoreUncanceledClaim(entity,token)}catch(rollback){console.warn('[Grilling heavy metal claim retained] '+rollback)}
   }else token.phase='quarantined'; // Unknown cancellation cannot refund protection.
  }
  console.warn('[Grilling heavy metal admission] '+error);return cancelled===true;
 }
}
