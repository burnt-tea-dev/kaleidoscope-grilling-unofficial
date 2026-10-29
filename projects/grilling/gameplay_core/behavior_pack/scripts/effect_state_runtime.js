import {world,system} from '@minecraft/server';
import {nativeDragonHealth} from './dragon_native_health.js';
import {FX_KEY,activeEffects,effectPayload,milkEffects} from './effect_lifecycle_core.js';
import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';
const snapshots=new WeakMap(),identities=new Map(),dodgeStates=new Map();let identityTick=-1;
const copyEffects=fx=>activeEffects(fx,effectTime());
function identity(entity){if(identityTick!==system.currentTick){identities.clear();identityTick=system.currentTick}try{if(typeof entity.id==='string')return entity.id}catch{}return undefined;}
function snapshot(entity){const id=identity(entity);return id===undefined?snapshots.get(entity):identities.get(id);}
function save(entity,value){const id=identity(entity);if(id===undefined)snapshots.set(entity,value);else identities.set(id,value);}
function discard(entity){const id=identity(entity);if(id===undefined)snapshots.delete(entity);else identities.delete(id);}
export function effectTime(){try{return world.getAbsoluteTime()}catch{return system.currentTick}}
export function readEffects(entity){
 const cached=snapshot(entity);if(cached?.tick===system.currentTick){if(cached.rawReadable!==false)observeDodge(entity,cached.raw);return copyEffects(cached.effects);}
 let raw,value,rawReadable=false;try{raw=entity.getDynamicProperty(FX_KEY);rawReadable=true;value=typeof raw==='string'?JSON.parse(raw):{}}catch{value={}}
 const effects=activeEffects(value,effectTime());if(rawReadable)observeDodge(entity,raw);save(entity,{tick:system.currentTick,raw,effects,rawReadable});return copyEffects(effects);
}
export function writeEffects(entity,value,{refreshProjectileDodge=false,expectedRaw}={}){
 const effects=activeEffects(value,effectTime()),raw=effectPayload(effects,effectTime());
 let old=snapshot(entity);if(old?.tick!==system.currentTick){readEffects(entity);old=snapshot(entity)}
 // Explicit refresh/clear owns the actual stored field, including a same-byte
 // successful refresh. An unacknowledged mutator is not a new effect generation.
 if(old?.rawReadable===false){discard(entity);throw Error('Effect state read is unacknowledged');}
 // Transaction callers with a freshly read source must compare against that
 // actual field even when the ordinary same-tick cache equals the desired state.
 let beforeRaw=old?.raw;
 if(refreshProjectileDodge||expectedRaw!==undefined){
  try{beforeRaw=entity.getDynamicProperty(FX_KEY)}catch(error){if(expectedRaw!==undefined)discard(entity);throw error}
 }
 if(expectedRaw!==undefined&&beforeRaw!==expectedRaw){observeDodge(entity,beforeRaw);discard(entity);throw Error('Effect state preimage changed');}
 const before=dodgeDescriptor(beforeRaw),state=observeDodge(entity,beforeRaw);
 let actual=beforeRaw;
 if(raw!==beforeRaw){
  let writeError;try{entity.setDynamicProperty(FX_KEY,raw)}catch(error){writeError=error;discard(entity)}
  try{actual=entity.getDynamicProperty(FX_KEY)}catch(error){discard(entity);throw writeError??error}
  if(actual!==raw){observeDodge(entity,actual);discard(entity);throw writeError??Error('Effect state write was not acknowledged');}
 }
 // A setter that applied then threw is already acknowledged; do not refund,
 // duplicate, or mark unchanged failed storage as a semantic replacement.
 if(refreshProjectileDodge)renewDodge(entity);
 if(!refreshProjectileDodge&&before&&before.until<=effectTime()&&!effects.projectile_dodge&&state)preserveDodge(entity,actual,state.generation,before);
 else observeDodge(entity,actual);
 save(entity,{tick:system.currentTick,raw:actual,effects,rawReadable:true});return copyEffects(effects);
}
export function clearEffects(entity,{milk=false}={}){
 if(readEffects(entity).dragon_blood)nativeDragonHealth(entity,undefined);
 writeEffects(entity,milk?milkEffects(readEffects(entity),effectTime()):{},{refreshProjectileDodge:true});
  entity.setDynamicProperty(PersistedKey.DRAGON_POOL,undefined);
 discard(entity);
}

// Named-effect generations stay in memory. No persistence/schema field is added.
// Only owned explicit refresh/clear and observable changes are known; arbitrary
// third-party direct writes that remove/reinsert the same bytes are not observable.
function dodgeClock(){try{const time=world.getAbsoluteTime();return Number.isFinite(time)?time:undefined}catch{return undefined}}
export function projectileDodgeTime(){
 const time=dodgeClock();if(time===undefined)throw Error('Projectile dodge absolute clock is unavailable');return time;
}
function dodgeDescriptor(raw){
 let value;try{value=typeof raw==='string'?JSON.parse(raw).projectile_dodge:undefined}catch{return undefined}
 return value&&Number.isFinite(Number(value.until))?{until:Number(value.until),amp:Math.max(0,Math.floor(Number(value.amp)||0))}:undefined;
}
const dodgeKey=effect=>effect?effect.until+'|'+effect.amp:'';
function observeDodge(entity,raw){
 const id=identity(entity);if(id===undefined)return undefined;
 const effect=dodgeDescriptor(raw),rawKey=dodgeKey(effect),old=dodgeStates.get(id),time=dodgeClock();
 if(!old&&!effect)return undefined;
 if(!old||old.rawKey!==rawKey){const state={generation:{},rawKey,effect,observedTime:Number.isFinite(time)?time:undefined};dodgeStates.set(id,state);return state;}
 if(Number.isFinite(time))old.observedTime=Number.isFinite(old.observedTime)?Math.max(old.observedTime,time):time;
 return old;
}
function renewDodge(entity){
 const id=identity(entity);if(id===undefined)return;
 const old=dodgeStates.get(id);if(old){const time=dodgeClock();dodgeStates.set(id,{...old,generation:{},observedTime:Number.isFinite(time)?time:old.observedTime});}
}
function preserveDodge(entity,raw,generation,effect){
 const id=identity(entity),old=dodgeStates.get(id);
 if(!old||old.generation!==generation)return undefined;
 const time=dodgeClock(),state={generation,rawKey:dodgeKey(dodgeDescriptor(raw)),effect,observedTime:Number.isFinite(time)?Math.max(old.observedTime??time,time):old.observedTime};dodgeStates.set(id,state);return state;
}
export function forgetProjectileDodgeState(entityOrId){
 let id;try{id=typeof entityOrId==='string'?entityOrId:entityOrId.id}catch{return}
 dodgeStates.delete(id);
}
export function readProjectileDodgeState(entity){
 // The before-hurt cache can precede an external same-tick removal. Read the
 // actual named raw field here, while leaving normal effect reads cached.
 const time=projectileDodgeTime(),raw=entity.getDynamicProperty(FX_KEY),state=observeDodge(entity,raw);
 if(state)state.observedTime=Number.isFinite(state.observedTime)?Math.max(state.observedTime,time):time;
 const effects=activeEffects(typeof raw==='string'?JSON.parse(raw):{},time);
 save(entity,{tick:system.currentTick,raw,effects});
 const actual=dodgeDescriptor(raw);
 return state?{generation:state.generation,effect:state.effect&&{...state.effect},observedTime:state.observedTime,active:!!actual&&actual.until>state.observedTime}:undefined;
}
export function debitProjectileDodge(entity,expected,ticks){
 let state;
 try{
  const raw=entity.getDynamicProperty(FX_KEY);state=observeDodge(entity,raw);
  if(!state||state.generation!==expected.generation||dodgeKey(state.effect)!==dodgeKey(expected.effect))return {ok:false,state};
  const time=projectileDodgeTime();if(!Number.isFinite(time)||!Number.isFinite(state.observedTime))return {ok:false,state,error:Error('Projectile dodge clock is unreadable')};
  const effects=activeEffects(typeof raw==='string'?JSON.parse(raw):{},time),paymentTime=Math.max(time,state.observedTime);
  const next={until:state.effect.until-ticks,amp:state.effect.amp};
  if(next.until>paymentTime)effects.projectile_dodge=next;else delete effects.projectile_dodge;
  const wanted=effectPayload(effects,time);let writeError;
  if(wanted!==raw)try{entity.setDynamicProperty(FX_KEY,wanted)}catch(error){writeError=error;discard(entity)}
  // A throwing setter may have applied. Acknowledgement decides settlement,
  // so a post-write exception cannot debit twice or discard a protected charge.
  const actual=entity.getDynamicProperty(FX_KEY),actualEffects=activeEffects(typeof actual==='string'?JSON.parse(actual):{},time);
  if(effectPayload(actualEffects,time)!==wanted){return {ok:false,state:observeDodge(entity,actual),error:writeError??Error('Projectile dodge debit readback differs')};}
  const committed=preserveDodge(entity,actual,expected.generation,next);
  if(!committed)return {ok:false,state:observeDodge(entity,actual),error:Error('Projectile dodge generation changed during debit')};
  save(entity,{tick:system.currentTick,raw:actual,effects:actualEffects,rawReadable:true});return {ok:true,state:committed};
 }catch(error){discard(entity);return {ok:false,state,error};}
}
