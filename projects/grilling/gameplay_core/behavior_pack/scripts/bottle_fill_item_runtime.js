import {system,world} from '@minecraft/server';
import {copyEatingVariant} from './eating_item_runtime.js';
import {captureSkewerMetadata,metadataSignature} from './skewer_item_snapshot.js';
import {getItemProperty} from './itemData.js';
import {playerInventory,getOffHand,setOffHand} from './a2735_player_io.js';
import {SEASONING_LIST_KEY,isEmptySeasoningId,isPendingSeasoningId,normalizeSeasoningList,seasoningFillVisualId} from './a2743_seasoning_contract_core.js';

export function bottleFillIngredients(stack){
 const raw=getItemProperty(stack,SEASONING_LIST_KEY);
 if(raw===undefined)return [];
 if(typeof raw!=='string')throw Error('Bottle fill ingredients are unreadable');
 const values=JSON.parse(raw);
 if(!Array.isArray(values))throw Error('Bottle fill ingredients are not a list');
 return normalizeSeasoningList(values);
}
export function retargetBottleFillStack(stack){
 if(!stack||(!isEmptySeasoningId(stack.typeId)&&!isPendingSeasoningId(stack.typeId)))return stack?.clone();
 const id=seasoningFillVisualId(stack.typeId,bottleFillIngredients(stack));
 // Native cloning remains authoritative when no retype is needed. Retyping can
 // copy only metadata exposed by stable ItemStack APIs, with exact readback.
 return id===stack.typeId?stack.clone():copyEatingVariant(stack,id);
}
function signature(stack){return stack?JSON.stringify([stack.amount,metadataSignature(captureSkewerMetadata(stack))]):''}
export function refreshBottleFillSlot(read,write){
 const before=read();if(!before||(!isEmptySeasoningId(before.typeId)&&!isPendingSeasoningId(before.typeId)))return false;
 const target=seasoningFillVisualId(before.typeId,bottleFillIngredients(before));
 if(target===before.typeId)return false;
 const next=retargetBottleFillStack(before);
 if(signature(read())!==signature(before))throw Error('Bottle fill slot changed before write');
 try{
  write(next);if(signature(read())!==signature(next))throw Error('Bottle fill slot readback differs');
 }catch(error){write(before);if(signature(read())!==signature(before))throw Error('Bottle fill slot rollback failed');throw error}
 return true;
}
const scanned=new Map();
world.afterEvents.playerLeave.subscribe(e=>scanned.delete(e.playerId));
world.afterEvents.playerSpawn.subscribe(e=>scanned.delete(e.player.id));
export function prepareBottleFillItems(player,using=false){
 // Never replace a stack captured by a pending native-use session.
 if(using)return;
 const inventory=playerInventory(player);
 const all=system.currentTick-(scanned.get(player.id)??-20)>=20;
 // A failed bottle must not turn the bounded inventory sweep into a full scan
 // every tick or prevent independent slots/offhand from being prepared.
 if(all)scanned.set(player.id,system.currentTick);
 let failure;
 const refresh=(read,write)=>{try{refreshBottleFillSlot(read,write)}catch(error){failure??=error}};
 if(inventory){
  const slots=all?Array.from({length:inventory.size},(_,i)=>i):[player.selectedSlotIndex];
  for(const slot of slots)refresh(()=>inventory.getItem(slot),item=>inventory.setItem(slot,item));
 }
 refresh(()=>getOffHand(player),item=>setOffHand(player,item));
 if(failure)throw failure;
}
