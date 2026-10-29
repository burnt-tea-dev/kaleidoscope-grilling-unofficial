import {scriptEvents} from './host_api/event_router.js';
/** Copyable client for an author's own script module; the host still owns production and delivery. */
import {system} from '@minecraft/server';
import {utf8Bytes} from './integration_stack_core.js';
const REQUEST='kaleidoscope_grilling:integration_request',RESPONSE='kaleidoscope_grilling:integration_response';
let instances=0;
export function createIntegrationClient(clientId,{timeoutTicks=100}={}){
 if(typeof clientId!=='string'||!/^[a-z0-9_.-]{1,16}:[a-z0-9_./-]{1,24}$/.test(clientId)||!Number.isInteger(timeoutTicks)||timeoutTicks<1||timeoutTicks>1200)throw Error('integration client options');
 let counter=0,closed=false;const instance=++instances,pending=new Map(),queues=new Map();
 const receive=event=>{if(event.id!==RESPONSE||event.sourceType!=='Server')return;let value;try{value=JSON.parse(event.message)}catch{return;}
  const row=pending.get(value.requestId);if(!row||value.api!==1||typeof value.ok!=='boolean')return;pending.delete(value.requestId);system.clearRun(row.timer);if(value.ok)row.resolve(value.result);else row.reject(Error(value.error??'integration rejected'));
 };
 const unsubscribe=scriptEvents(system)('integration-client:'+clientId+':'+instance,receive);
 function request(op,fields={}){
  if(closed)return Promise.reject(Error('integration client closed'));if(pending.size>=32)return Promise.reject(Error('integration requests full'));
  const requestId=clientId+'/'+instance.toString(36)+'/'+system.currentTick.toString(36)+'/'+(++counter).toString(36),payload=JSON.stringify({...fields,api:1,requestId,op});
  if(utf8Bytes(payload)>8192)return Promise.reject(Error('integration request too large'));
  return new Promise((resolve,reject)=>{const timer=system.runTimeout(()=>{pending.delete(requestId);reject(Error('integration response timeout; inspect producer before retrying'))},timeoutTicks);pending.set(requestId,{resolve,reject,timer});try{system.sendScriptEvent(REQUEST,payload)}catch(error){system.clearRun(timer);pending.delete(requestId);reject(error)}});
 }
 function serialized(producerId,task){const old=queues.get(producerId)??Promise.resolve(),next=old.catch(()=>{}).then(task);queues.set(producerId,next);next.finally(()=>{if(queues.get(producerId)===next)queues.delete(producerId)}).catch(()=>{});return next;}
 return {request,serialized,close(){closed=true;unsubscribe();for(const row of pending.values()){system.clearRun(row.timer);row.reject(Error('integration client closed'))}pending.clear();}};
}
