// Diagnostic copy only. No subscriptions, player writes, scheduling or row cache.
import {system} from '@minecraft/server';

export function recordOrdinaryDamageTrace(stage,player,value,enterRecorded){
 try{
  let actorId,actorReadError;
  try{actorId=player.id}catch(error){actorReadError=String(error)}
  const row={stage,tick:system.currentTick,actorId,actorReadError,
   amount:3.4028234663852886e38,cause:'selfDestruct'};
  if(stage==='return')Object.assign(row,{enterRecorded,returnType:typeof value,returnValue:value===undefined?null:value});
  if(stage==='exception')Object.assign(row,{enterRecorded,exception:{name:value?.name,message:value?.message,text:String(value)}});
  console.warn('GRILLING_QA_ORDINARY_DAMAGE_CALL '+JSON.stringify(row));
  return true;
 }catch{
  // Instrumentation failure must not suppress the call or enter its catch.
  return false;
 }
}

export function announceOrdinaryDamageTrace(){
 console.warn('GRILLING_QA_ORDINARY_DAMAGE_TRACE_READY '+JSON.stringify({
  tick:system.currentTick,hook:'applyOrdinary/system.run original member call',
  fields:['enter','return','exception'],nativeMethodsReplaced:false,
  foodObserver:'ordinary_network_food_probe.js',sourceStatus:'diagnostic instrumentation, not an adopted repair'
 }));
}
