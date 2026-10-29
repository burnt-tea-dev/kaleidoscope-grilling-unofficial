import {onBlockInteraction} from './core/events.js';
import {every,onlinePlayers} from './core/scheduler.js';
import {world,system,EquipmentSlot} from '@minecraft/server';
import {TimedWorkQueue} from './timed_work_queue.js';
import {playerInventory,getOffHand} from './core/player_io.js';
import {peekStationContainer} from './core/storage.js';
import {hotUntil,refreshHotLore} from './food/food_state_adapter.js';
const queue=new TimedWorkQueue(),jobs=new Map(),opened=new Map(),scans=new Map();
let lastWarning=-1200;
function warn(error){if(system.currentTick-lastWarning>=1200){lastWarning=system.currentTick;console.warn('[Grilling heat tooltip] '+error)}}
function enqueue(key,read,write,owner){
 let stack;try{stack=read()}catch{return}
 if(!stack||hotUntil(stack)<=0){queue.cancel(key);jobs.delete(key);return;}
 jobs.set(key,{read,write,owner});queue.schedule(key,system.currentTick);
}
function playerSlot(player,slot){
 const key='p|'+player.id+'|'+slot;
 enqueue(key,()=>playerInventory(player)?.getItem(slot),stack=>{const c=playerInventory(player);if(c)c.setItem(slot,stack)},player.id);
}
function playerOffhand(player){
 enqueue('o|'+player.id,()=>getOffHand(player),stack=>{const e=player.getComponent('minecraft:equippable');if(!e?.setEquipment(EquipmentSlot.Offhand,stack))throw Error('Offhand unavailable')},player.id);
}
function scanPlayer(player){const c=playerInventory(player);if(c)for(let i=0;i<c.size;i++)playerSlot(player,i);playerOffhand(player)}
function resolveContainer(row){const b=world.getDimension(row.dimensionId).getBlock(row.location);return b?.getComponent('minecraft:inventory')?.container??(b?.typeId.startsWith('kaleidoscope_grilling:')?peekStationContainer(b):undefined)}
function scanBlock(row){
 const c=resolveContainer(row);if(!c)return;
 for(let slot=0;slot<c.size;slot++){
  const key='b|'+row.dimensionId+'|'+row.location.x+'|'+row.location.y+'|'+row.location.z+'|'+slot;
  enqueue(key,()=>resolveContainer(row)?.getItem(slot),stack=>{const current=resolveContainer(row);if(current)current.setItem(slot,stack)});
 }
}
export function trackHotContainer(block){if(block)requestScan({dimensionId:block.dimension.id,location:{...block.location}})}
function requestScan(row){const key=row.dimensionId+'|'+JSON.stringify(row.location);scans.set(key,row)}
onBlockInteraction('hot_lore_runtime',e=>{
 const row={dimensionId:e.block.dimension.id,location:{...e.block.location}};opened.set(e.player.id,row);
 // Read actual post-commit contents. Never cancel or rewrite the vanilla container opening.
 system.run(()=>requestScan(row));
},{"priority":0,"observe":true});
world.afterEvents.playerInventoryItemChange.subscribe(e=>{
 playerSlot(e.player,e.slot);
 const row=opened.get(e.player.id),p=e.player;
 if(row&&row.dimensionId===p.dimension.id&&Math.hypot(p.location.x-row.location.x,p.location.y-row.location.y,p.location.z-row.location.z)<=8)requestScan(row);
});
world.afterEvents.playerSpawn.subscribe(e=>system.run(()=>scanPlayer(e.player)));
world.afterEvents.playerLeave.subscribe(e=>{opened.delete(e.playerId);for(const [k,j] of jobs)if(j.owner===e.playerId){jobs.delete(k);queue.cancel(k)}});
system.run(()=>{for(const player of onlinePlayers())scanPlayer(player)});
every('hot_lore_runtime:1',()=>{
 // Only hot slots have repeating jobs. Cold inventories are not rescanned each tick.
 for(const key of queue.take(system.currentTick,64)){
  const job=jobs.get(key);if(!job)continue;
  try{
   const source=job.read();if(!source||hotUntil(source)<=0){jobs.delete(key);continue}
   const next=source.clone(),before=JSON.stringify(source.getRawLore());refreshHotLore(next);
   if(JSON.stringify(next.getRawLore())!==before||hotUntil(next)!==hotUntil(source))job.write(next);
   if(hotUntil(next)>0)queue.schedule(key,system.currentTick+20);else jobs.delete(key);
  }catch(error){jobs.delete(key);warn(error)}
 }
 let budget=2;for(const [key,row] of scans){scans.delete(key);try{scanBlock(row)}catch(error){warn(error)}if(--budget===0)break;}
 if(system.currentTick%20===0)for(const player of onlinePlayers())playerOffhand(player);
},1);
export const pendingHeatTooltipJobs=()=>queue.size;
