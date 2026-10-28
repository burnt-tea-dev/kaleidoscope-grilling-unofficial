import {world,system,EquipmentSlot} from '@minecraft/server';
import {playerInventory,getOffHand} from '../core/player_io.js';
import {foodMaximKey,applyFoodMaxim} from './food_tooltip_core.js';

// One event-driven queue; no per-tick inventory polling and no new gameplay metadata.
const pending=new Map();
let scheduled=false,lastWarning=-1200;
function warn(error){
 if(system.currentTick-lastWarning<1200)return;
 lastWarning=system.currentTick;
 console.warn('[Grilling A2.7.69] Food tooltip update skipped; original stack retained: '+error);
}
function rewrite(player){
 const c=playerInventory(player);
 if(c)for(let slot=0;slot<c.size;slot++){
  try{
   // Read the live slot, not the inventory event's stale ItemStack.
   const source=c.getItem(slot);if(!foodMaximKey(source?.typeId))continue;
   const next=source.clone();
   if(applyFoodMaxim(next))c.setItem(slot,next);
  }catch(error){warn(error)}
 }
 try{
  const source=getOffHand(player);if(!foodMaximKey(source?.typeId))return;
  const next=source.clone();
  if(applyFoodMaxim(next)){
   const equipment=player.getComponent('minecraft:equippable');
   if(!equipment||!equipment.setEquipment(EquipmentSlot.Offhand,next))warn('offhand unavailable');
  }
 }catch(error){warn(error)}
}
function drain(){
 scheduled=false;let budget=4;
 for(const [id,player] of pending){
  pending.delete(id);rewrite(player);if(--budget===0)break;
 }
 if(pending.size&&!scheduled){scheduled=true;system.run(drain)}
}
function enqueue(player){
 if(!player)return;
 pending.set(player.id,player);
 if(!scheduled){scheduled=true;system.run(drain)}
}
world.afterEvents.playerInventoryItemChange.subscribe(e=>{
 if(foodMaximKey(e.itemStack?.typeId))enqueue(e.player);
});
world.afterEvents.playerSpawn.subscribe(e=>enqueue(e.player));
world.afterEvents.playerLeave.subscribe(e=>pending.delete(e.playerId));
system.run(()=>{for(const player of world.getAllPlayers())enqueue(player)});
