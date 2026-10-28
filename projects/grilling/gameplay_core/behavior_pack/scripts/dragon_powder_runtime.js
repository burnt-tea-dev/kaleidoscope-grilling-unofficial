import {onBlockInteraction} from './core/events.js';
import {world,system,ItemStack} from '@minecraft/server';
import {isKitchenKnifeStack} from './world/chicken_acquisition_core.js';
import {captureInteractionIntent,interactionIntentStillCurrent} from './core/interaction_intent_adapter.js';
import {captureWritableHand,playerInventory,isCreative} from './core/player_io.js';
import {commitSteps} from './grill/grill_transaction_core.js';
import {dragonPowderCount,knifeDamagePlan} from './dragon_powder_core.js';
const POWDER='kaleidoscope_grilling:dragon_egg_powder';
function enchantment(stack,id){return Number(stack.getComponent('minecraft:enchantable')?.getEnchantment(id)?.level??0)}
export function shaveDragonPowder(player,hand,random=Math.random){
 const held=captureWritableHand(player,hand),knife=held.before;
 if(!isKitchenKnifeStack(knife))return false;
 const durability=knife.getComponent('minecraft:durability');
 const damage=knifeDamagePlan(durability?.damage,durability?.maxDurability,enchantment(knife,'unbreaking'),random(),isCreative(player));
 const count=dragonPowderCount(enchantment(knife,'looting'),random());
 const output=new ItemStack(POWDER,count),container=playerInventory(player);
 if(!container)throw Error('Dragon powder inventory unavailable');
 const next=damage.broken?undefined:knife.clone();
 if(damage.mutate&&!damage.broken)next.getComponent('minecraft:durability').damage=damage.damage;
 let slot=-1,before,after;
 for(let i=0;i<container.size;i++){
  if(hand==='main'&&i===player.selectedSlotIndex)continue;
  const item=container.getItem(i);
  if(!item||(item.isStackableWith(output)&&item.amount+count<=item.maxAmount)){
   slot=i;before=item?.clone();after=item?.clone()??output;
   if(item)after.amount+=count;break;
  }
 }
 let drop;
 const result=commitSteps([
  {apply(){if(damage.mutate)held.write(next)},rollback(){if(damage.mutate)held.write(knife)}},
  {apply(){if(slot>=0)container.setItem(slot,after);else{drop=player.dimension.spawnItem(output,player.location);if(!drop)throw Error('Powder drop unavailable')}},
   rollback(){if(slot>=0)container.setItem(slot,before);else if(drop)drop.remove()}}
 ]);
 if(!result.ok)throw Error('Dragon powder transaction failed; rollback failures='+result.rollbackErrors);
 if(damage.broken)try{player.playSound('random.break')}catch{}
 return true;
}
onBlockInteraction('dragon_powder_runtime',event=>{
 if(event.cancel||event.isFirstEvent===false||event.block?.typeId!=='minecraft:dragon_egg'||!isKitchenKnifeStack(event.itemStack))return;
 const player=event.player,intent=captureInteractionIntent(player,event.itemStack),dimension=player.dimension.id;
 // Java does not cancel RightClickBlock: preserve vanilla dragon-egg teleport behavior.
 system.run(()=>{try{
  if(player.dimension.id!==dimension||!interactionIntentStillCurrent(player,intent))return;
  shaveDragonPowder(player,intent.hand);
 }catch(error){console.warn('[Grilling dragon powder] '+error)}});
},{"priority":30,"observe":true,"blocks":["minecraft:dragon_egg"]});
