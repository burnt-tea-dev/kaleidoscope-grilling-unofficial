import {getWorldProperty,setWorldProperty,getWorldPropertyIds} from '../core/persist.js';
import {PERSISTED_KEY as PersistedKey} from '../core/persist_keys.js';
import {onBeforeBlockBreak,onBlockInteraction,onPlayerCraftRecipe} from '../core/events.js';
import {every,onlinePlayers} from '../core/scheduler.js';
import {premiumOilParticles} from '../oil_ambient_core.js';
import {emitParticles} from '../immersion_particles_runtime.js';
import {TimedWorkQueue} from '../timed_work_queue.js';
import {world,system,ItemStack,BlockPermutation} from '@minecraft/server';
import {ensureOilHandPublished} from '../oil_api_client.js';
import {OIL_BUCKET_POINTS} from '../skewer/skewering_core.js';
import {COOKERY_EMPTY_ID as COOKERY_EMPTY,COOKERY_FILLED_ID as COOKERY_FILLED,planCookeryTypedOilAddition} from './cookery_oil_pot_adapter.js';
import {playerInventory as playerContainer,getMainHand as main,getOffHand as off,setHand,isCreative as creative} from '../core/player_io.js';
import {captureWritableHand} from '../core/player_io.js';
import {commitSteps} from '../grill/grill_transaction_core.js';
import {isInitialBlockPress} from '../grill/grill_input_core.js';
import {captureInteractionIntent,interactionIntentStillCurrent} from '../core/interaction_intent_adapter.js';
import {give} from '../core/actions.js';
import {
 LEGACY_OIL_REG,OIL_REG_PREFIX,FLOW_CELL_BUDGET,FLOW_SOURCE_BUDGET,
 oilPosKey as posKey,oilSourcePropertyId,normalizeOilSourceRow
} from '../oil_source_registry_core.js';

export const OIL_TYPES=Object.freeze({
 canola:{block:'kaleidoscope_grilling:canola_oil',bucket:'kaleidoscope_grilling:canola_oil_bucket',interval:6},
 secret_chili:{block:'kaleidoscope_grilling:secret_chili_oil',bucket:'kaleidoscope_grilling:secret_chili_oil_bucket',interval:8},
 premium_chili:{block:'kaleidoscope_grilling:premium_chili_oil',bucket:'kaleidoscope_grilling:premium_chili_oil_bucket',interval:10}
});
// BDS 1.26.60 rejects different result types in shapeless recipes. Return
// Java's lava-bucket remainder only after the native recipe really crafts.
onPlayerCraftRecipe('premium-chili-oil-remainder',event=>{
 const crafted=event.itemStack;
 if(crafted?.typeId!=='kaleidoscope_grilling:premium_chili_oil_bucket')return;
 const player=event.player,amount=Number(crafted.amount);
 if(!player||!Number.isInteger(amount)||amount<1)return;
 let remaining=amount;
 while(remaining>0){const count=Math.min(16,remaining);give(player,new ItemStack('minecraft:bucket',count));remaining-=count;}
});
const VALID_OIL_TYPES=Object.freeze(Object.keys(OIL_TYPES));
const BLOCK_TO_TYPE=Object.freeze(Object.fromEntries(Object.entries(OIL_TYPES).map(([k,v])=>[v.block,k])));
const BUCKET_TO_TYPE=Object.freeze(Object.fromEntries(Object.entries(OIL_TYPES).map(([k,v])=>[v.bucket,k])));
const OFFSETS={Up:[0,1,0],Down:[0,-1,0],East:[1,0,0],West:[-1,0,0],North:[0,0,-1],South:[0,0,1]};
const HORIZ=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
let registryCache,lastPersistWarning=-1200,dueQueue=new TimedWorkQueue();const sourceIndex=new Map(),sourceSlots=new Map(),claimCells=new Map(),claims=new Map();
function restoreRegistryCache(rows){
 registryCache=rows;sourceIndex.clear();sourceSlots.clear();claimCells.clear();claims.clear();dueQueue=new TimedWorkQueue();
 for(const [slot,row] of rows.entries()){sourceSlots.set(row.k,slot);sourceIndex.set(row.k,row);addClaims(row);dueQueue.schedule(row.k,row.nextTick??system.currentTick)}
}
function dropClaims(row){for(const cell of claimCells.get(row.k)??[]){const set=claims.get(cell);set?.delete(row.k);if(!set?.size)claims.delete(cell)}claimCells.delete(row.k)}
function addClaims(row){claimCells.set(row.k,[...(row.cells??[])]);for(const cell of row.cells??[]){if(!claims.has(cell))claims.set(cell,new Set());claims.get(cell).add(row.k)}}

function loadReg(){
 if(registryCache)return registryCache;
 const byKey=new Map(),legacy=[];
 try{
  for(const id of getWorldPropertyIds(world)??[]){
   if(!id.startsWith(OIL_REG_PREFIX))continue;
   const raw=getWorldProperty(world,id);if(typeof raw!=='string')continue;
   try{const row=normalizeOilSourceRow(JSON.parse(raw),VALID_OIL_TYPES);if(row)byKey.set(row.k,row)}catch{}
  }
  const old=getWorldProperty(world,LEGACY_OIL_REG);
  if(typeof old==='string')for(const value of JSON.parse(old)){
   const row=normalizeOilSourceRow(value,VALID_OIL_TYPES);if(row&&!byKey.has(row.k)){byKey.set(row.k,row);legacy.push(row)}
  }
 }catch{}
 registryCache=[...byKey.values()];
 for(const [slot,row] of registryCache.entries()){sourceSlots.set(row.k,slot);row.nextTick=0;sourceIndex.set(row.k,row);addClaims(row);dueQueue.schedule(row.k,system.currentTick)}
 // Migrate A2.3's aggregate property only after all rows have been recovered.
 if(legacy.length)try{
  for(const row of legacy)setWorldProperty(world,oilSourcePropertyId(row),JSON.stringify(row));
  setWorldProperty(world,LEGACY_OIL_REG,undefined);
 }catch{}
 return registryCache;
}
function readReg(){return loadReg()}
function persistRow(row){
 const normalized=normalizeOilSourceRow(row,VALID_OIL_TYPES);if(!normalized)return false;
 // nextTick belongs to this server session, not the saved-world clock.
 const key=oilSourcePropertyId(normalized),raw=JSON.stringify({...normalized,nextTick:0});
 try{if(getWorldProperty(world,key)!==raw)setWorldProperty(world,key,raw);if(getWorldProperty(world,key)!==raw)return false;}catch{return false}
 const rows=loadReg(),old=sourceIndex.get(normalized.k),i=sourceSlots.get(normalized.k)??-1;
 if(old)dropClaims(old);
 if(i>=0)rows[i]=normalized;else{sourceSlots.set(normalized.k,rows.length);rows.push(normalized);}
 sourceIndex.set(normalized.k,normalized);addClaims(normalized);dueQueue.schedule(normalized.k,normalized.nextTick);
 Object.assign(row,normalized);return true;
}
function removeRow(row){
 ambientDeadlines.delete(row.k);
 setWorldProperty(world,oilSourcePropertyId(row),undefined);
 if(getWorldProperty(world,oilSourcePropertyId(row))!==undefined)throw Error('oil registry removal');
 const rows=loadReg(),old=sourceIndex.get(row.k),i=sourceSlots.get(row.k)??-1;if(i>=0){const last=rows.pop();if(i<rows.length){rows[i]=last;sourceSlots.set(last.k,i)}}sourceSlots.delete(row.k);
 if(old)dropClaims(old);sourceIndex.delete(row.k);dueQueue.cancel(row.k);
}
function isOil(id){return Object.hasOwn(BLOCK_TO_TYPE,id)}
function level(block){try{return Number(block.permutation.getState('kaleidoscope_grilling:level')??0)}catch{return 0}}
function setOil(block,type,lvl){
 const def=OIL_TYPES[type];if(!def)return false;
 const wanted=Math.max(0,Math.min(7,lvl|0));
 try{if(block.typeId===def.block&&block.permutation.getState('kaleidoscope_grilling:level')===wanted)return true;
  block.setPermutation(BlockPermutation.resolve(def.block,{'kaleidoscope_grilling:level':wanted}));return true}catch{return false}
}
function canFlowInto(block,type,source=false){
 if(!block)return false;if(block.typeId==='minecraft:air')return true;
 if(block.typeId===OIL_TYPES[type].block)return !source||level(block)>0;
 return false;
}
function addItem(p,stack){const c=playerContainer(p);if(!c)return;const rem=c.addItem(stack);if(rem)p.dimension.spawnItem(rem,p.location)}
function sourceRow(dim,loc,type){return {k:posKey(dim.id,loc.x,loc.y,loc.z),d:dim.id,x:loc.x,y:loc.y,z:loc.z,type,cells:[],nextTick:system.currentTick}}
function registerSource(dim,loc,type){
 const rows=readReg(),k=posKey(dim.id,loc.x,loc.y,loc.z),found=sourceIndex.get(k);
 if(found)return persistRow({...found,type,nextTick:Math.min(found.nextTick||0,system.currentTick)});
 return persistRow(sourceRow(dim,loc,type));
}
function sourceKeys(rows){return sourceIndex;}
function claimedByOther(rows,row,cell){const set=claims.get(cell);return !!set&&(set.size>1||!set.has(row.k));}
function clearCells(row,rows){
 let dim;try{dim=world.getDimension(row.d)}catch{return}
 const sources=sourceKeys(rows);
 for(const cell of row.cells??[]){
  if(sources.has(cell)||claimedByOther(rows,row,cell))continue;
  const [,xs,ys,zs]=cell.split('|');const b=dim.getBlock({x:Number(xs),y:Number(ys),z:Number(zs)});
  if(b&&b.typeId===OIL_TYPES[row.type]?.block){b.setType('minecraft:air');if(b.typeId===OIL_TYPES[row.type]?.block)throw Error('oil flow cleanup unacknowledged');}
 }
}
function compute(row,rows){
 const def=OIL_TYPES[row.type];if(!def)return false;
 let dim;try{dim=world.getDimension(row.d)}catch{return false}
 // Cache only during this synchronous source calculation, so later world changes
 // and neighbouring source workers are always observed on the next call.
 const blocks=new Map();
 function blockAt(x,y,z){const key=posKey(row.d,x,y,z);if(!blocks.has(key))blocks.set(key,dim.getBlock({x,y,z}));return blocks.get(key)}
 let minY=-64;try{minY=Number(dim.heightRange?.min??minY)}catch{}
 const source=blockAt(row.x,row.y,row.z);
 if(!source)return true;if(source.typeId!==def.block||level(source)!==0){clearCells(row,rows);return false}
 const queue=[{x:row.x,y:row.y,z:row.z,l:0}],seen=new Map(),desired=new Map();let head=0;
 while(head<queue.length&&desired.size<FLOW_CELL_BUDGET){
  const n=queue[head++],k=posKey(row.d,n.x,n.y,n.z);
  const old=seen.get(k);if(old!==undefined&&old<=n.l)continue;seen.set(k,n.l);
  const b=blockAt(n.x,n.y,n.z);if(!b||(!canFlowInto(b,row.type)&&k!==row.k))continue;
  desired.set(k,{...n});
  const below=n.y>minY?blockAt(n.x,n.y-1,n.z):undefined;
  if(n.y>minY&&canFlowInto(below,row.type)){
   queue.push({x:n.x,y:n.y-1,z:n.z,l:n.l});continue;
  }
  if(n.l>=7)continue;
  for(const [dx,dy,dz] of HORIZ)queue.push({x:n.x+dx,y:n.y,z:n.z+dz,l:n.l+1});
 }
 const desiredKeys=new Set(desired.keys()),sourceSet=sourceKeys(rows);
 for(const [k,n] of desired){
  if(k===row.k)continue;const b=blockAt(n.x,n.y,n.z);if(b&&(b.typeId==='minecraft:air'||b.typeId===def.block))setOil(b,row.type,n.l);
 }
 for(const cell of row.cells??[]){
  if(desiredKeys.has(cell)||sourceSet.has(cell)||claimedByOther(rows,row,cell))continue;
  const [,xs,ys,zs]=cell.split('|');const b=blockAt(Number(xs),Number(ys),Number(zs));
  if(b&&b.typeId===def.block&&level(b)>0)try{b.setType('minecraft:air')}catch{}
 }
 row.cells=[...desiredKeys].filter(k=>k!==row.k);return true;
}
function faceTarget(e){const o=OFFSETS[e.blockFace]??[0,1,0],p=e.block.location;return {x:p.x+o[0],y:p.y+o[1],z:p.z+o[2]}}
function oilTransfer(steps,block){
 const result=commitSteps(steps);
 if(!result.ok){console.warn('[Grilling oil transfer] '+String(result.error)+'; rollback='+result.rollbackErrors);if(result.rollbackErrors)try{setWorldProperty(world,PersistedKey.OIL_TRANSFER_FAULT_PREFIX+posKey(block.dimension.id,block.x,block.y,block.z),String(result.error))}catch{}}
 return result.ok;
}
function transferAvailable(block){try{return getWorldProperty(world,PersistedKey.OIL_TRANSFER_FAULT_PREFIX+posKey(block.dimension.id,block.x,block.y,block.z))===undefined}catch{return false}}
function placeFromBucket(player,dim,loc,type,hand){
 const b=dim.getBlock(loc);if(!b||!(b.typeId==='minecraft:air'||(b.typeId===OIL_TYPES[type]?.block&&level(b)>0))||!transferAvailable(b))return false;
 const slot=captureWritableHand(player,hand);if(slot.before?.typeId!==OIL_TYPES[type]?.bucket)return false;
 const before=b.permutation,steps=[];
 if(!creative(player))steps.push({apply(){slot.write(new ItemStack('minecraft:bucket',1))},rollback(){slot.write(slot.before)}});
 steps.push({apply(){if(!setOil(b,type,0))throw Error('oil placement rejected')},rollback(){b.setPermutation(before)}});
 const row=sourceRow(dim,loc,type),registryId=oilSourcePropertyId(row),registryBefore=getWorldProperty(world,registryId),cached=readReg().map(r=>({...r,cells:[...(r.cells??[])]}));
 steps.push({apply(){if(!registerSource(dim,loc,type))throw Error('oil source registry rejected')},rollback(){setWorldProperty(world,registryId,registryBefore);if(getWorldProperty(world,registryId)!==registryBefore)throw Error('oil registry rollback');restoreRegistryCache(cached);}});
 if(!oilTransfer(steps,b))return false;try{dim.playSound(type==='premium_chili'?'bucket.empty_lava':'bucket.empty_water',loc)}catch{};return true;
}
function takeSource(player,block,type,hand,toCookery=false){
 if(block?.typeId!==OIL_TYPES[type]?.block||level(block)!==0||!transferAvailable(block))return false;
 if(toCookery&&!ensureOilHandPublished(player,hand,()=>takeSource(player,block,type,hand,true)))return false;
 const slot=captureWritableHand(player,hand),held=slot.before;
 let next;
 if(toCookery){const plan=planCookeryTypedOilAddition(held,type,OIL_BUCKET_POINTS);if(!plan.ok)return false;next=plan.next;}
 else{if(held?.typeId!=='minecraft:bucket'||held.amount<1)return false;next=new ItemStack(OIL_TYPES[type].bucket,1);}
 const before=block.permutation,steps=[];
 if(!toCookery&&(held.amount>1||creative(player))){
  if(!creative(player)){const remaining=held.clone();remaining.amount--;steps.push({apply(){slot.write(remaining)},rollback(){slot.write(held)}});}
  const bag=playerContainer(player);let target=-1,drop;
  if(bag)for(let i=0;i<bag.size;i++)if(!bag.getItem(i)){target=i;break;}
  steps.push({apply(){if(target>=0){bag.setItem(target,next);if(bag.getItem(target)?.typeId!==next.typeId)throw Error('filled bucket delivery');}else{drop=block.dimension.spawnItem(next,player.location);if(!drop||drop.getComponent('minecraft:item')?.itemStack?.typeId!==next.typeId)throw Error('bucket drop delivery');}},rollback(){if(target>=0)bag.setItem(target,undefined);else if(drop)drop.remove();else throw Error('bucket delivery outcome unknown');}});
 }else steps.push({apply(){slot.write(next)},rollback(){slot.write(held)}});
 steps.push({apply(){block.setType('minecraft:air')},rollback(){block.setPermutation(before)}});
 if(!oilTransfer(steps,block))return false;
 try{block.dimension.playSound(type==='premium_chili'?'bucket.fill_lava':'bucket.fill_water',block.location)}catch{}

 const rows=readReg(),k=posKey(block.dimension.id,block.x,block.y,block.z),row=rows.find(r=>r.k===k);
 // Keep the durable row until the flow worker acknowledges cleanup of every cell.
 if(row){const next={...row,nextTick:system.currentTick};persistRow(next)}return true;
}
onBlockInteraction('a23_oil_world',e=>{
 if(e.cancel)return;
 // Java container integrations own these targets; do not also place a world-fluid source beside them.
 if(e.block.typeId==='kaleidoscope_grilling:big_vat'||e.block.typeId==='kaleidoscope_cookery:oil_pot')return;
 const item=e.itemStack,typeFromBlock=BLOCK_TO_TYPE[e.block.typeId],bucketType=item?BUCKET_TO_TYPE[item.typeId]:undefined;
 if(typeFromBlock&&(item?.typeId==='minecraft:bucket'||item?.typeId===COOKERY_EMPTY||item?.typeId===COOKERY_FILLED)){
  e.cancel=true;if(!isInitialBlockPress(e.isFirstEvent))return;
  const p=e.player,loc={...e.block.location},dim=e.block.dimension,intent=captureInteractionIntent(p,item),hand=intent.hand,toCookery=item.typeId!=='minecraft:bucket';
  system.run(()=>{if(!interactionIntentStillCurrent(p,intent))return;const b=dim.getBlock(loc);if(b)takeSource(p,b,typeFromBlock,hand,toCookery)});return;
 }
 if(bucketType){
  e.cancel=true;if(!isInitialBlockPress(e.isFirstEvent))return;
  const p=e.player,loc=faceTarget(e),dim=e.block.dimension,intent=captureInteractionIntent(p,item),hand=intent.hand;
  system.run(()=>{if(interactionIntentStillCurrent(p,intent))placeFromBucket(p,dim,loc,bucketType,hand)});return;
 }
},{"priority":40});
onBeforeBlockBreak('oil/oil_world.js:0',e=>{
 if(!isOil(e.block.typeId))return;e.cancel=true;const dim=e.block.dimension,loc={...e.block.location};
 system.run(()=>{const b=dim.getBlock(loc);if(b&&isOil(b.typeId))try{b.setType('minecraft:air')}catch{}});
});
// At most eight source checks and sixteen emitted particles per server tick.
// One sampled loaded cell per source per second; no whole-fluid visual scan.
const ambientDeadlines=new Map();
function oilAmbient(row,now,players){
 if(row.type!=='premium_chili'||now<(ambientDeadlines.get(row.k)??0))return;
 ambientDeadlines.set(row.k,now+20);
 if(!players.some(p=>p.dimension.id===row.d&&Math.hypot(p.location.x-row.x,p.location.y-row.y,p.location.z-row.z)<=40))return;
 const cells=row.cells??[],index=Math.floor(Math.random()*(cells.length+1));
 const [,x,y,z]=(index<cells.length?cells[index]:row.k).split('|');
 const dim=world.getDimension(row.d),loc={x:Number(x),y:Number(y),z:Number(z)},block=dim.getBlock(loc);
 if(block?.typeId!==OIL_TYPES.premium_chili.block)return;
 const above=dim.getBlock({x:loc.x,y:loc.y+1,z:loc.z});if(above?.typeId!=='minecraft:air')return;
 emitParticles(dim,loc,premiumOilParticles());
}
function persistNextCycle(row){if(persistRow(row))return;dropClaims(row);addClaims(row);dueQueue.schedule(row.k,row.nextTick);if(system.currentTick-lastPersistWarning>=1200){lastPersistWarning=system.currentTick;console.warn('[Grilling oil registry] state write unacknowledged; retaining retry schedule')}}
every('a23_oil_world:1',()=>{
 const rows=readReg(),now=system.currentTick;
 const due=dueQueue.take(now,FLOW_SOURCE_BUDGET);
 const players=due.length?onlinePlayers():[];
 for(const key of due){
  const row=sourceIndex.get(key);if(!row)continue;
  const def=OIL_TYPES[row.type];if(!def){removeRow(row);continue}
  try{if(!compute(row,rows)){removeRow(row);continue}}catch{row.nextTick=now+def.interval;persistNextCycle(row);continue}
  try{oilAmbient(row,now,players)}catch{}
  row.nextTick=now+def.interval;persistNextCycle(row);
 }
},1);
