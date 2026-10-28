/** Read-only mirror of explicit Cookery Oil API receipts, never private host state. */
import {world,system} from '@minecraft/server';
import {normalizePublicOil} from '../host_api/oil_api_core.js';
import {typedOilBlockKey} from './typed_oil_pot_block_core.js';
const snapshots=new Map(),queries=new Map();
const key=b=>b.dimension.id+':'+b.x+','+b.y+','+b.z;
export function placedOilPotLocation(b){return {x:b.x,y:b.y,z:b.z};}
export function readPlacedOilPotState(b){
 if(b?.typeId!=='kaleidoscope_cookery:oil_pot'){if(b)snapshots.delete(key(b));return undefined;}
 const id=key(b),last=queries.get(id)??-100;
 if(system.currentTick-last>=10){queries.set(id,system.currentTick);const legacy=world.getDynamicProperty(typedOilBlockKey(b.dimension.id,b.x,b.y,b.z));system.sendScriptEvent('senluo:oil_block_query',JSON.stringify({api:1,station:{dimensionId:b.dimension.id,x:b.x,y:b.y,z:b.z},legacyType:typeof legacy==='string'?legacy:undefined}));}
 const cached=snapshots.get(id),row=cached&&system.currentTick-cached.tick<=40?cached.state:undefined;return row?{type:row.type,count:row.count,capacity:row.type?64:256,revision:row.revision,source:'host_api'}:undefined;
}
system.afterEvents.scriptEventReceive.subscribe(e=>{if(e.id!=='senluo:oil_block_snapshot')return;try{
 const r=JSON.parse(e.message),s=r.station;if(r.api!==1||!s||![s.x,s.y,s.z].every(Number.isInteger)||typeof s.dimensionId!=='string')return;
 const id=s.dimensionId+':'+s.x+','+s.y+','+s.z,state=r.state===undefined?undefined:normalizePublicOil(r.state);if(r.state!==undefined&&!state)return;
 if(state){const previous=snapshots.get(id);if(previous&&state.revision<previous.state.revision)return;snapshots.set(id,{state,station:{dimensionId:s.dimensionId,x:s.x,y:s.y,z:s.z},tick:system.currentTick});}else snapshots.delete(id);
 const legacyKey=typedOilBlockKey(s.dimensionId,s.x,s.y,s.z),legacy=world.getDynamicProperty(legacyKey);
 if(state&&(state.type===legacy||state.count===0))world.setDynamicProperty(legacyKey,undefined);
}catch(error){console.warn('[Grilling Oil API] invalid block receipt '+error)}});
// Cosmetics may discover only recent public receipts. This exposes no mutable
// state and omits unloaded/stale candidates instead of scanning world blocks.
export function* currentPlacedOilPotCandidates(){
 for(const cached of snapshots.values()){
  // Retain the existing revision barrier even after its visual freshness ends.
  if(system.currentTick-cached.tick>40)continue;
  yield {...cached.station};
 }
}
export function capturePlacedOilPotSnapshot(b){return readPlacedOilPotState(b);}
export function placedOilPotSnapshotMatches(b,s){const actual=readPlacedOilPotState(b);return !!actual&&JSON.stringify(actual)===JSON.stringify(s);}
// Mutations are owned by Cookery; a mirror is never a write permission.
export function restorePlacedOilPotSnapshot(){return false;}
export function writePlacedOilPotState(){return false;}
export function clearPlacedOilPotState(){return false;}
