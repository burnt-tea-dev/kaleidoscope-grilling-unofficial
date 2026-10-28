import {world,ItemStack,EquipmentSlot} from '@minecraft/server';
import {KITCHEN_KNIVES,isKitchenKnifeStack} from '../world/chicken_acquisition_core.js';
import {
 COW_ID,SQUID_ID,RAW_COW_OFFAL_ID,SQUID_TENTACLE_ID,
 cowOffalDropCount,squidTentacleDropCount,squidTentacleShouldDrop
} from './remaining_knife_drops_core.js';

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
function spawn(dead,id,count){
 if(count<=0)return;
 const p=dead.location;
 dead.dimension.spawnItem(new ItemStack(id,count),{x:p.x,y:p.y,z:p.z});
}

world.afterEvents.entityDie.subscribe(event=>{
 try{
  const dead=event.deadEntity;
  if(dead?.typeId!==COW_ID&&dead?.typeId!==SQUID_ID)return;
  const killer=event.damageSource?.damagingEntity;if(killer?.typeId!=='minecraft:player')return;
  const weapon=mainHand(killer);if(!isKitchenKnifeStack(weapon))return;
  const looting=lootingLevel(weapon);
  const baseRandom=Math.random();
  const bonusRandom=looting>0?Math.random():0;
  if(dead.typeId===COW_ID){
   spawn(dead,RAW_COW_OFFAL_ID,cowOffalDropCount(baseRandom,bonusRandom,looting));
   return;
  }
  const count=squidTentacleDropCount(baseRandom,bonusRandom,looting);
  if(!squidTentacleShouldDrop(Math.random()))return;
  spawn(dead,SQUID_TENTACLE_ID,count);
 }catch{}
});

export const a2712KnifeIds=KITCHEN_KNIVES;
