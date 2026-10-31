import {PERSISTED_KEY as PersistedKey} from './persist_keys.js';
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

// This schema owns both the JS codec and generated Molang consumers.
export const CONTROLS_PROPERTY=PersistedKey.CONTROLS;
export const CONTROL_FIELDS=Object.freeze({
 eat_profile:{shift:0,bits:3,max:5},
 eat_hand:{shift:3,bits:2,max:2},
 eat_projection:{shift:5,bits:1,max:1,boolean:true},
 season_hand:{shift:6,bits:2,max:2},
 season_phase:{shift:8,bits:4,max:10},
 pending_hand:{shift:12,bits:2,max:2}
});
export const CONTROLS_MAX=Object.values(CONTROL_FIELDS).reduce((sum,f)=>sum+f.max*2**f.shift,0);
export function controlMolang(name,owner='q'){
 const f=CONTROL_FIELDS[name];
 if(!f)throw Error('Grilling: unknown player control '+name);
 return '(math.mod(math.floor(('+owner+".has_property('"+CONTROLS_PROPERTY+"') ? "+owner+".property('"+CONTROLS_PROPERTY+"') : 0) / "+2**f.shift+'), '+2**f.bits+'))';
}
const neutral=()=>Object.fromEntries(Object.entries(CONTROL_FIELDS).map(([key,f])=>[key,f.boolean?false:0]));
export function encodeControls(state){
 let word=0;
 for(const [name,f] of Object.entries(CONTROL_FIELDS)){
  const value=Object.hasOwn(state,name)?state[name]:(f.boolean?false:0);
  if(f.boolean?typeof value!=='boolean':!Number.isInteger(value)||value<0||value>f.max)throw Error('Grilling: invalid player control '+name);
  word+=Number(value)*2**f.shift;
 }
 return word;
}
export function decodeControls(word){
 if(!Number.isInteger(word)||word<0||word>CONTROLS_MAX)throw Error('Grilling: invalid controls word');
 return Object.fromEntries(Object.entries(CONTROL_FIELDS).map(([name,f])=>{
  const value=Math.floor(word/2**f.shift)%2**f.bits;
  if(value>f.max)throw Error('Grilling: invalid player control '+name);
  return [name,f.boolean?!!value:value];
 }));
}
const states=new Map();
const CLOCKS=Object.freeze({eat_native_ticks:PersistedKey.EAT_NATIVE_TICKS,eat_elapsed_ticks:PersistedKey.EAT_ELAPSED_TICKS});
function entry(player){
 let state=states.get(player.id);
 if(!state){state={controls:neutral(),clocks:{eat_native_ticks:0,eat_elapsed_ticks:0},sent:new Map()};states.set(player.id,state);}
 return state;
}
export function readPlayerControl(player,name){return entry(player).controls[name];}
export function updatePlayerPresentation(player,patch){
 const state=entry(player),controls={...state.controls},clocks={...state.clocks};
 for(const [name,value] of Object.entries(patch)){
  if(Object.hasOwn(CONTROL_FIELDS,name))controls[name]=value;
  else if(Object.hasOwn(CLOCKS,name)){
   if(!Number.isInteger(value)||value<0||value>72000)throw Error('Grilling: invalid eating clock');
   clocks[name]=value;
  }else throw Error('Grilling: unknown player presentation field '+name);
 }
 const word=encodeControls(controls);
 // Native properties apply next tick. Merge into script state, never read the
 // last native word to modify bits. Failed writes retain the desired state.
 state.controls=controls;state.clocks=clocks;
 flushPlayerPresentation(player);
}
export function flushPlayerPresentation(player){
 const state=states.get(player.id);if(!state)return;
 const word=encodeControls(state.controls),clocks=state.clocks;
 for(const [key,value] of [[CONTROLS_PROPERTY,word],...Object.entries(CLOCKS).map(([name,key])=>[key,clocks[name]])]){
  if(state.sent.get(key)===value)continue;
  state.sent.delete(key);
  player.setProperty(key,value);
  state.sent.set(key,value);
 }
}
export function clearEatingPresentation(player){updatePlayerPresentation(player,{eat_profile:0,eat_hand:0,eat_projection:false,eat_native_ticks:0,eat_elapsed_ticks:0});}
export function resetPlayerPresentation(player){
 states.delete(player.id);
 updatePlayerPresentation(player,{});
}
export function forgetPlayerPresentation(playerId){states.delete(playerId);}
