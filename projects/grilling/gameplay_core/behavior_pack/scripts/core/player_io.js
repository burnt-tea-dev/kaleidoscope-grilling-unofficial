import {EquipmentSlot,GameMode} from '@minecraft/server';

export function playerInventory(player){
 try{return player?.getComponent('minecraft:inventory')?.container}catch{return undefined}
}

export function getMainHand(player){
 try{return playerInventory(player)?.getItem(player.selectedSlotIndex)}catch{return undefined}
}

export function setMainHand(player,stack){
 const container=playerInventory(player);
 if(!container)throw new Error('Grilling: player inventory unavailable');
 return container.setItem(player.selectedSlotIndex,stack);
}

export function getOffHand(player){
 try{return player?.getComponent('minecraft:equippable')?.getEquipment(EquipmentSlot.Offhand)}catch{return undefined}
}

export function setOffHand(player,stack){
 const equipment=player?.getComponent('minecraft:equippable');
 if(!equipment)throw new Error('Grilling: player equipment unavailable');
 if(equipment.setEquipment(EquipmentSlot.Offhand,stack)!==true)throw new Error('Grilling: offhand write rejected');
 return true;
}

export function getHand(player,hand){
 return hand==='off'?getOffHand(player):getMainHand(player);
}

export function setHand(player,hand,stack){
 return hand==='off'?setOffHand(player,stack):setMainHand(player,stack);
}

export function findHand(player,itemId){
 const main=getMainHand(player);
 if(main?.typeId===itemId)return 'main';
 const off=getOffHand(player);
 if(off?.typeId===itemId)return 'off';
 return null;
}

export function findHandEntry(player,itemId){
 const name=findHand(player,itemId);
 return name?{name,stack:getHand(player,name)}:null;
}

export function isCreative(player){
 try{return player?.getGameMode?.()===GameMode.Creative}catch{return false}
}

// Pin the actual storage slot before a transaction, including its rollback.
// Getters above remain tolerant for display probes; transactional access is strict.
export function captureWritableHand(player,hand){
 if(hand==='off'){
  const equipment=player.getComponent('minecraft:equippable');
  if(!equipment)throw new Error('Grilling: player equipment unavailable');
  const before=equipment.getEquipment(EquipmentSlot.Offhand)?.clone();
  return {before,read(){return equipment.getEquipment(EquipmentSlot.Offhand)},write(stack){
   if(equipment.setEquipment(EquipmentSlot.Offhand,stack)!==true)throw new Error('Grilling: offhand write rejected');
  }};
 }
 if(hand!=='main')throw new Error('Grilling: unknown hand');
 const container=player.getComponent('minecraft:inventory')?.container,slot=player.selectedSlotIndex;
 if(!container||!Number.isInteger(slot)||slot<0||slot>=container.size)throw new Error('Grilling: main-hand slot unavailable');
 return {before:container.getItem(slot)?.clone(),read(){return container.getItem(slot)},write(stack){container.setItem(slot,stack)}};
}
