import {world} from '@minecraft/server';
import {stationContainer} from '../family_station_storage.js';
import {RACK_OCCUPANCY_STATE,RACK_OCCUPANCY_HIGH_STATE,rackSeasoningOccupancy} from '../advanced_rack_layout.js';
import {
 ADVANCED_RACK_BLOCK_ID,RACK_COMPARTMENTS,normalizeRackFilters,rackDisplayLevel
} from './advanced_rack_core.js';

function enc(n){return n<0?'m'+Math.abs(n):'p'+n}
const transactionFaults=new Set();
const faultKey=block=>rackFiltersKey(block)+'_transaction_fault';
export function quarantineRackTransaction(block,reason){
 const key=faultKey(block);transactionFaults.add(key);
 world.setDynamicProperty(key,String(reason).slice(0,240));
 if(!world.getDynamicProperty(key))throw new Error('Rack transaction fault could not persist');
}
export function rackFiltersKey(block){
 return 'kaleidoscope_grilling:rack_filters_'+block.dimension.id.replace(/[^a-z0-9]/gi,'_')+'_'+enc(block.x)+'_'+enc(block.y)+'_'+enc(block.z);
}
export function rackContainer(block){
 if(!block||block.typeId!==ADVANCED_RACK_BLOCK_ID)return undefined;
 if(transactionFaults.has(faultKey(block))||world.getDynamicProperty(faultKey(block)))throw new Error('Rack transaction quarantined; manual recovery required');
 return stationContainer(block);
}
export function readRackFilters(block){
 try{
  const raw=world.getDynamicProperty(rackFiltersKey(block));
  return normalizeRackFilters(typeof raw==='string'?JSON.parse(raw):[]);
 }catch{return normalizeRackFilters([])}
}
export function writeRackFilters(block,filters){
 try{const raw=JSON.stringify(normalizeRackFilters(filters));world.setDynamicProperty(rackFiltersKey(block),raw);return world.getDynamicProperty(rackFiltersKey(block))===raw}catch{return false}
}
export function captureRackFilters(block){
 const key=rackFiltersKey(block),raw=world.getDynamicProperty(key);
 if(raw!==undefined&&typeof raw!=='string')throw new Error('Unreadable rack filters');
 const value=raw===undefined?[]:JSON.parse(raw);
 if(!Array.isArray(value)||value.length>RACK_COMPARTMENTS||value.some((row,i)=>row!==null&&row!==undefined&&
  (!row||typeof row!=='object'||row.kind!==(i<5?'seasoning':'tool')||typeof row.typeId!=='string'||!row.typeId.includes(':')||!['exact','oil_pot','seasoning_bottle'].includes(row.category))))throw new Error('Invalid rack filters');
 return {filters:normalizeRackFilters(value),step(next){return {
  apply:()=>writeRackFilters(block,next),
  rollback:()=>{world.setDynamicProperty(key,raw);return world.getDynamicProperty(key)===raw;}
 }}};
}
export function clearRackFilters(block){
 try{world.setDynamicProperty(rackFiltersKey(block),undefined);return true}catch{return false}
}
export function readRackItems(block){
 const c=rackContainer(block),out=Array(RACK_COMPARTMENTS).fill(undefined);
 if(!c)throw new Error('Rack inventory unavailable; not an empty rack');
 for(let i=0;i<RACK_COMPARTMENTS;i++)out[i]=c.getItem(i)?.clone();
 return out;
}
export function writeRackItems(block,items){
 const c=rackContainer(block);if(!c)return false;
 const old=Array.from({length:RACK_COMPARTMENTS},(_,i)=>c.getItem(i)?.clone());
 const next=Array.from({length:RACK_COMPARTMENTS},(_,i)=>items?.[i]?.clone());
 try{for(let i=0;i<RACK_COMPARTMENTS;i++)c.setItem(i,next[i]);}
 catch(error){
  let restored=true;for(let i=0;i<RACK_COMPARTMENTS;i++)try{c.setItem(i,old[i])}catch{restored=false}
  if(!restored)throw new Error('Rack inventory rollback failed; manual recovery required');
  return false;
 }
 syncRackDisplay(block);return true;
}
export function clearRackItems(block){return writeRackItems(block,[]);}
export function syncRackDisplay(block,knownItems){
 if(!block||block.typeId!==ADVANCED_RACK_BLOCK_ID)return 0;
 const items=knownItems??readRackItems(block),level=rackDisplayLevel(items.map(Boolean)),mask=rackSeasoningOccupancy(i=>items[i]);
 const low=mask&15,high=mask>>4;
 try{
  const p=block.permutation;
  if(p.getState('kaleidoscope_grilling:spice_level')!==level||p.getState(RACK_OCCUPANCY_STATE)!==low||p.getState(RACK_OCCUPANCY_HIGH_STATE)!==high)
   block.setPermutation(p.withState('kaleidoscope_grilling:spice_level',level).withState(RACK_OCCUPANCY_STATE,low).withState(RACK_OCCUPANCY_HIGH_STATE,high));
 }catch{}
 return level;
}
