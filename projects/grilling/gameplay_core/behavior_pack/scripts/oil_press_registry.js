import {getWorldProperty,getWorldPropertyIds,setWorldProperty} from './core/persist.js';
/** Persistent per-press registry; no lossy 256-row array or unloaded-chunk purge.
 * One bounded coordinate record per DP avoids the single-string size limit.
 */
import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';
export function createOilPressRegistry(world,legacyKey){
 if(legacyKey!==PersistedKey.A26_PRESS_REGISTRY)throw new TypeError('Unexpected oil press registry key');
 const prefix=PersistedKey.A26_PRESS_REGISTRY_ENTRY_PREFIX,cache=new Map();let loaded=false;
 function normalize(row){
  if(!row||typeof row.d!=='string'||!row.d||!['x','y','z'].every(k=>Number.isSafeInteger(row[k])))throw Error('Invalid oil press registry record');
  return {k:row.d+'|'+row.x+'|'+row.y+'|'+row.z,d:row.d,x:row.x,y:row.y,z:row.z};
 }
 const property=row=>prefix+encodeURIComponent(row.k);
 function load(){
  if(loaded)return;
  const found=new Map(),raw=getWorldProperty(world,legacyKey);
  const old=raw===undefined?[]:JSON.parse(String(raw));if(!Array.isArray(old))throw Error('Invalid legacy oil press registry');
  for(const value of old){const row=normalize(value);found.set(row.k,row);}
  for(const id of getWorldPropertyIds(world))if(id.startsWith(prefix)){
   const row=normalize(JSON.parse(String(getWorldProperty(world,id))));
   if(property(row)!==id)throw Error('Oil press registry identity mismatch');
   found.set(row.k,row);
  }
  // Migration is restartable: retain the old array until all entries persist.
  for(const value of old){const row=normalize(value);setWorldProperty(world,property(row),JSON.stringify(row));}
  if(raw!==undefined)setWorldProperty(world,legacyKey,undefined);
  cache.clear();for(const [k,row] of found)cache.set(k,row);loaded=true;
 }
 return {
  rows(){load();return [...cache.values()];},
  add(value){load();const row=normalize(value);if(cache.has(row.k))return;
   setWorldProperty(world,property(row),JSON.stringify(row));cache.set(row.k,row);
  },
  remove(value){load();const row=normalize(value);if(!cache.has(row.k))return;
   setWorldProperty(world,property(row),undefined);cache.delete(row.k);}
 };
}

/** Per-block native ticking. No inventory writes and no new persistent keys.
 * The owner supplies the existing one-tick state transition. Its persistent
 * pending-work registry remains the recovery source after load/queue failure.
 */
export const OIL_PRESS_TICK_NAME='kg_press_work';
export function createOilPressScheduler({now,step,report=()=>{}}){
 if(typeof now!=='function'||typeof step!=='function')throw new TypeError('now and step are required');
 let observedTick;
 const seen=new Set();
 const locationKey=block=>[block.dimension.id,block.x,block.y,block.z].join('|');
 function error(value){try{report(value)}catch{}}
 function ensure(block){
  try{
   if(!block.hasScheduledNamedTick(OIL_PRESS_TICK_NAME))block.scheduleNamedTick(OIL_PRESS_TICK_NAME,1);
   return true;
  }catch(value){error(value);return false}
 }
 function onNamedTick(event){
  try{
   if(!event.isName(OIL_PRESS_TICK_NAME))return false;
   const tick=now();
   if(tick!==observedTick){seen.clear();observedTick=tick}
   const id=locationKey(event.block);
   // Recovery and duplicated event delivery must not advance the same device
   // twice within one game tick. This cache only retains the current tick.
   if(seen.has(id))return false;
   seen.add(id);
   // Native delivery consumes the queued tick; only pending work needs rearming.
   if(step(event.block))ensure(event.block);
   return true;
  }catch(value){
   // Do not discard the persistent pending-work registry on a transient error.
   // The owner's existing recovery interval will schedule another attempt.
   error(value);return false;
  }
 }
 return {ensure,onNamedTick};
}
