import {world,ItemStack,EquipmentSlot} from '@minecraft/server';
import {CHICKEN_ID,CHICKEN_WING_ID,KITCHEN_KNIVES,isKitchenKnifeStack,chickenWingDropCount
} from './chicken_acquisition_core.js';

// Cookery station completion requires a host-owned acknowledgement.
// No chicken-skin supplementation is attempted from private station properties.

function mainHand(player){
 try{
  const slot=player.getComponent('minecraft:equippable')?.getEquipmentSlot(EquipmentSlot.Mainhand);
  return slot?.hasItem()?slot.getItem():undefined;
 }catch{return undefined}
}
function lootingLevel(stack){
 try{
  const c=stack?.getComponent('minecraft:enchantable');
  return Math.max(0,Number(c?.getEnchantment('looting')?.level??c?.getEnchantment('minecraft:looting')?.level??0)||0);
 }catch{return 0}
}
world.afterEvents.entityDie.subscribe(event=>{
 try{
  const dead=event.deadEntity;if(dead?.typeId!==CHICKEN_ID)return;
  const killer=event.damageSource?.damagingEntity;if(killer?.typeId!=='minecraft:player')return;
  const weapon=mainHand(killer);if(!isKitchenKnifeStack(weapon))return;
  const count=chickenWingDropCount(Math.random(),Math.random(),lootingLevel(weapon));
  const p=dead.location;
  dead.dimension.spawnItem(new ItemStack(CHICKEN_WING_ID,count),{x:p.x,y:p.y,z:p.z});
 }catch{}
});

export const a2710KnifeIds=KITCHEN_KNIVES;
