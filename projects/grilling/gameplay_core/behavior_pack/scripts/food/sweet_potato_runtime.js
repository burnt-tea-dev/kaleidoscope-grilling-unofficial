import {world,system,ItemStack,EquipmentSlot} from '@minecraft/server';
import {POWDER_ID,KNEAD_TICKS,kneadResult} from './sweet_potato_core.js';
import {captureInteractionIntent} from '../core/interaction_intent_adapter.js';

const ACTIVE_KNEADS=new Map();

function inventory(player){return player.getComponent('minecraft:inventory')?.container}
function offhand(player){return player.getComponent('minecraft:equippable')?.getEquipment(EquipmentSlot.Offhand)}
function identifyHand(player,eventStack){
 const slot=player.selectedSlotIndex,intent=captureInteractionIntent(player,eventStack);
 if(intent.hand==='off')return {hand:'off',slot:-1};
 return {hand:'main',slot};
}
function setHand(player,state,stack){
 if(state.hand==='off')return player.getComponent('minecraft:equippable')?.setEquipment(EquipmentSlot.Offhand,stack);
 return inventory(player)?.setItem(state.slot,stack);
}
function handItem(player,state){
 if(state.hand==='off')return offhand(player);
 return inventory(player)?.getItem(state.slot);
}
function give(player,stack){
 const c=inventory(player);if(!c)return;
 const rem=c.addItem(stack);
 if(rem)try{player.dimension.spawnItem(rem,player.location)}catch{}
}
function installResult(player,state,plan){
 const out=new ItemStack(plan.id,plan.amount),current=handItem(player,state);
 if(!current||current.typeId===POWDER_ID){setHand(player,state,out);return}
 give(player,out);
}
function clear(playerId){ACTIVE_KNEADS.delete(playerId)}

world.afterEvents.itemStartUse.subscribe(e=>{
 if(e.itemStack?.typeId!==POWDER_ID)return;
 const hand=identifyHand(e.source,e.itemStack);
 ACTIVE_KNEADS.set(e.source.id,{
  ...hand,
  amount:Math.max(1,Math.min(64,Number(e.itemStack.amount)||1)),
  start:system.currentTick
 });
});

world.afterEvents.itemStopUse.subscribe(e=>{
 if(e.itemStack?.typeId!==POWDER_ID&&!ACTIVE_KNEADS.has(e.source.id))return;
 if((Number(e.useDuration)||0)>0)clear(e.source.id);
});

world.afterEvents.itemCompleteUse.subscribe(e=>{
 if(e.itemStack?.typeId!==POWDER_ID)return;
 const active=ACTIVE_KNEADS.get(e.source.id)??{...identifyHand(e.source,e.itemStack),amount:Number(e.itemStack.amount)||1,start:system.currentTick-KNEAD_TICKS};
 clear(e.source.id);
 const held=Math.max(KNEAD_TICKS,system.currentTick-active.start);
 const plan=kneadResult(POWDER_ID,active.amount,held);
 if(!plan)return;
 system.run(()=>{
  try{
   installResult(e.source,active,plan);
   try{e.source.runCommand('stopsound @s random.eat')}catch{}
   try{e.source.playSound('armor.equip_leather',{volume:0.8,pitch:1.1})}catch{}
  }catch{}
 });
});
