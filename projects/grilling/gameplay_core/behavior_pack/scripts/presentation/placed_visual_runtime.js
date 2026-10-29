import {onAfterBlockBreak} from '../core/events.js';
import {every,onlinePlayers} from '../core/scheduler.js';
import {grillingConfig} from '../server_config_runtime.js';
import {world,system} from '@minecraft/server';
import {visitUniqueTracked} from '../core/visual_budget_core.js';
import {readPlacedSeasoningStack} from '../seasoning/seasoning_block_adapter.js';
import {readPlacedOilPotState} from '../oil/cookery_oil_pot_block_adapter.js';
import {HOST_BLOCK_ID} from '../oil/typed_oil_pot_block_core.js';
import {PREFIX,SEASON_ENTITY,OIL_ENTITY,isSeasoningBlock,bottlePlan,oilPlan,positions,decodeKey,rotationForStates} from './placed_visual_core.js';
import {dirtyPlacedVisuals,visualLocationKey,markPlacedVisualDirty} from './placed_visual_queue.js';
import {INGREDIENT_COLORS} from './placed_visual_data.js';

// Render-only, transient entities. No block replacement and no authoritative data on helpers.
const tracked=new Map(),owned=new Set();
const MAX_HELPERS=1024,RANGE_SQ=48*48,BUDGET=12;
let cursor,lastWarning=-1200,indexing=false;
function warn(error){if(system.currentTick-lastWarning>=1200){lastWarning=system.currentTick;console.warn('[Grilling placed visuals] '+error)}}
function remember(value){
 const key=visualLocationKey(value.dimensionId,value.location);
 if(!tracked.has(key))tracked.set(key,{...value,helpers:new Map()});
 return tracked.get(key);
}
function dispose(row,slot){
 const entry=row.helpers.get(slot);if(!entry)return;
 try{if(entry.entity.isValid)entry.entity.remove()}catch(error){warn(error);return false}
 owned.delete(entry.id);row.helpers.delete(slot);return true;
}
function clear(row){for(const slot of [...row.helpers.keys()])dispose(row,slot)}
function render(row,dimension,slot,type,location,rotation,plan){
 if(!plan){dispose(row,slot);return}
 let entry=row.helpers.get(slot);
 if(entry&&(!entry.entity.isValid||entry.type!==type)){if(!dispose(row,slot))return;entry=undefined}
 if(!entry){
  if(owned.size>=grillingConfig().placedHelpers){warn('render budget exceeded; storage unaffected; configure placedHelpers after workload validation');return;}
  const entity=dimension.spawnEntity(type,location);
  entry={entity,id:entity.id,type,signature:''};row.helpers.set(slot,entry);owned.add(entity.id);
 }
 const signature=JSON.stringify({location,rotation,plan});if(signature===entry.signature)return;
 try{
  const entity=entry.entity;
  entity.setProperty(PREFIX+'ready',false);
  entity.teleport(location,{dimension,rotation:{x:0,y:-rotation}});
  if(type===OIL_ENTITY)entity.setProperty(PREFIX+'oil',plan.oil);
  else{
   entity.setProperty(PREFIX+'mode',plan.mode);
   entity.setProperty(PREFIX+'fill',plan.fill);
   entity.setProperty(PREFIX+'variant',plan.variant);
   for(let i=0;i<8;i++)entity.setProperty(PREFIX+'layer_'+i,plan.layers[i]);
  }
  entity.setProperty(PREFIX+'ready',true);entry.signature=signature;
 }catch(error){dispose(row,slot);warn(error)}
}
function sync(row,players,afterPickup=false){
 const l=row.location;
 if(!afterPickup&&!players.some(p=>p.dimensionId===row.dimensionId&&(p.x-l.x)**2+(p.y-l.y)**2+(p.z-l.z)**2<=RANGE_SQ)){clear(row);return}
 let dimension,block;
 try{dimension=world.getDimension(row.dimensionId);block=dimension.getBlock(l)}catch{clear(row);return}
 if(!block){clear(row);return}
 if(isSeasoningBlock(block.typeId)){
  const stack=readPlacedSeasoningStack(block).slice(0,4),offsets=positions(stack.length);
  for(let i=0;i<4;i++){
   const plan=bottlePlan(stack[i],INGREDIENT_COLORS),o=offsets[i]||[0,0];
   render(row,dimension,i,SEASON_ENTITY,{x:l.x+.5+o[0]/16,y:l.y,z:l.z+.5+o[1]/16},0,plan);
  }
 }else if(block.typeId===HOST_BLOCK_ID){
  for(const slot of [...row.helpers.keys()])if(slot!==0)dispose(row,slot);
  render(row,dimension,0,OIL_ENTITY,{x:l.x+.5,y:l.y,z:l.z+.5},rotationForStates(block.permutation.getAllStates()),oilPlan(readPlacedOilPotState(block)));
 }else{
  clear(row);if(!row.helpers.size)tracked.delete(visualLocationKey(row.dimensionId,l));
 }
}
// Called only after the native bottle/hand transaction commits. Reconcile this
// renderer's existing target now; the normal queue retains retry/rebuild work.
// Visual failures must never roll back an already committed inventory transfer.
export function refreshPlacedBottleAfterPickup(block){
 try{
  markPlacedVisualDirty(block);
  const row=tracked.get(visualLocationKey(block.dimension.id,block.location));
  if(row)sync(row,[],true);
 }catch(error){warn(error)}
}
function pump(){
 const players=[];
 for(const player of onlinePlayers())try{players.push({dimensionId:player.dimension.id,...player.location})}catch(error){warn(error)}
 // Reserve half the work for old targets so busy interactions cannot starve cleanup.
 const seen=new Set();let used=0;
 for(const [key,value] of dirtyPlacedVisuals){
  dirtyPlacedVisuals.delete(key);const row=remember(value);seen.add(row);
  try{sync(row,players)}catch(error){warn(error)}
  if(++used>=BUDGET/2)break;
 }
 const result=visitUniqueTracked(tracked,cursor,seen,BUDGET-used,row=>{
  try{sync(row,players)}catch(error){warn(error)}
 });
 cursor=result.cursor;
}
function indexSavedTargets(){
 if(indexing)return;indexing=true;
 system.runJob((function*(){
  try{
   const dimensions=new Set(['minecraft:overworld','minecraft:nether','minecraft:the_end']);
   for(const p of onlinePlayers())dimensions.add(p.dimension.id);
   const ids=[...dimensions];
   for(const key of world.getDynamicPropertyIds()){
    const value=decodeKey(key,ids);if(value)remember(value);
    yield;
   }
  }catch(error){warn(error)}finally{indexing=false}
 })());
}
world.afterEvents.playerPlaceBlock.subscribe(e=>{if(isSeasoningBlock(e.block.typeId)||e.block.typeId===HOST_BLOCK_ID)markPlacedVisualDirty(e.block)});
world.afterEvents.playerInteractWithBlock.subscribe(e=>{if(isSeasoningBlock(e.block.typeId)||e.block.typeId===HOST_BLOCK_ID)markPlacedVisualDirty(e.block)});
onAfterBlockBreak('presentation/placed_visual_runtime.js:0',e=>markPlacedVisualDirty(e.block));
system.run(()=>{
 // Script reload can leave live transient entities, though chunk/world saves cannot.
 for(const name of ['overworld','nether','the_end'])try{
  const d=world.getDimension(name);
  for(const type of [SEASON_ENTITY,OIL_ENTITY])for(const entity of d.getEntities({type}))entity.remove();
 }catch(error){warn(error)}
 indexSavedTargets();
 every('a2770_placed_visual_runtime:1',pump,5);
 // Discover imports/command-created saved containers without scanning world blocks.
 every('a2770_placed_visual_runtime:2',indexSavedTargets,400);
});
