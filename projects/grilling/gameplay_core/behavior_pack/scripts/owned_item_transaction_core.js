import {captureSkewerMetadata,metadataSignature} from './skewer_item_snapshot.js';
import {commitSteps} from './grill/grill_transaction_core.js';
import {planInventoryInsert} from './rack_transfer_plan.js';

// Call only in an unrestricted phase: includes native restrictions/enchantments.
export function nativeItemSignature(stack){
 return stack?metadataSignature({amount:stack.amount,native:captureSkewerMetadata(stack)}):null;
}

/** Restore only the exact value this step wrote, never a replacement owner's item. */
export function ownedItemStep({read,write,before,after,canRestore=()=>true}){
 const prior=before?.clone(),next=after?.clone(),beforeSignature=nativeItemSignature(prior),afterSignature=nativeItemSignature(next);
 let attempted=false;
 function put(value,expected){
  if(write(value?.clone())===false||nativeItemSignature(read())!==expected)throw Error('Grilling: item write not confirmed');
 }
 return {
  apply(){if(nativeItemSignature(read())!==beforeSignature)throw Error('Grilling: item owner changed');attempted=true;put(next,afterSignature)},
  rollback(){
   if(!attempted)return;
   if(!canRestore())throw Error('Grilling: output recovery unconfirmed; input retained');
   const current=nativeItemSignature(read());
   if(current===beforeSignature)return;
   if(current!==afterSignature)throw Error('Grilling: item rollback owner changed');
   put(prior,beforeSignature);
  }
 };
}

/** Plan against post-debit inventory without changing native storage. Every
 * credited slot/drop must be recovered before a caller may refund its inputs.
 */
export function planOwnedInventoryDelivery(container,outputs,{startingItems,dimension,location}){
 if(!container)throw Error('Grilling: output inventory unavailable');
 const before=startingItems??Array.from({length:container.size},(_,i)=>container.getItem(i)?.clone());
 const final=before.map(s=>s?.clone()),changed=new Set(),pending=new Set(),drops=[];
 const view={size:container.size,getItem:slot=>final[slot]?.clone(),setItem(slot,stack){final[slot]=stack?.clone();changed.add(slot)}};
 for(const output of outputs){
  const planned=planInventoryInsert(view,output);
  for(const step of planned.steps)step.apply();
  if(planned.remainder)drops.push(planned.remainder);
 }
 const steps=[];
 for(const slot of changed){
  const token={},write=ownedItemStep({read:()=>container.getItem(slot),write:stack=>container.setItem(slot,stack),before:before[slot],after:final[slot]});
  steps.push({apply(){pending.add(token);write.apply()},rollback(){write.rollback();pending.delete(token)}});
 }
 for(const remaining of drops){
  const token={},signature=nativeItemSignature(remaining);let escrow;
  steps.push({
   apply(){
    pending.add(token);escrow=dimension.spawnItem(remaining.clone(),location);
    if(escrow?.isValid!==true||nativeItemSignature(escrow.getComponent('minecraft:item')?.itemStack)!==signature)throw Error('Grilling: item drop not confirmed');
   },
   rollback(){
    if(!pending.has(token))return;
    // A missing/changed entity may already have delivered its item elsewhere.
    // Refund only after removing the exact returned stack ourselves.
    if(escrow?.isValid!==true||nativeItemSignature(escrow.getComponent('minecraft:item')?.itemStack)!==signature)throw Error('Grilling: item drop ownership unknown');
    try{escrow.remove()}catch(error){if(escrow.isValid!==false)throw error}
    if(escrow.isValid!==false)throw Error('Grilling: item drop cleanup unconfirmed');
    pending.delete(token);
   }
  });
 }
 return {steps,canRestoreInputs:()=>pending.size===0};
}

const playerTransactions=new WeakMap(),PLAYER_ITEM_RECEIPT='kaleidoscope_grilling:player_item_receipt_';
export function commitPlayerItemTransaction(world,player,steps,{tick=0,label='items'}={}){
 let cache=playerTransactions.get(world);if(!cache){cache={faults:new Set(),sequence:0};playerTransactions.set(world,cache)}
 const key=PLAYER_ITEM_RECEIPT+encodeURIComponent(player.id);
 if(cache.faults.has(key)||world.getDynamicProperty(key)!==undefined)throw Error('Grilling: player item transaction requires recovery');
 const receipt=JSON.stringify({v:1,player:player.id,label,attempt:tick+':'+(++cache.sequence)});
 cache.faults.add(key);
 function release(){
  const current=world.getDynamicProperty(key);
  if(current!==undefined&&current!==receipt)throw Error('Grilling: item receipt owner changed');
  if(current===receipt)world.setDynamicProperty(key,undefined);
  if(world.getDynamicProperty(key)!==undefined)throw Error('Grilling: item receipt cleanup unconfirmed');
  cache.faults.delete(key);
 }
 try{
  world.setDynamicProperty(key,receipt);
  if(world.getDynamicProperty(key)!==receipt)throw Error('Grilling: item receipt not saved');
 }catch(error){try{release()}catch{};throw error}
 const result=commitSteps(steps);
 // A prepared receipt blocks retries after a crash or uncertain rollback. It
 // does not claim cross-container crash atomicity or authorize an auto-refund.
 if(result.ok||result.rollbackErrors===0)try{release()}catch(error){console.warn('[Grilling item receipt] '+error)}
 return result;
}
