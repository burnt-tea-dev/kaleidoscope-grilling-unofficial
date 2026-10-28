import {isPendingSeasoningId} from './seasoning/seasoning_contract_core.js';
// Motion-only port of PR125; contents remain owned by bottle_held_visual_runtime.
import {system,world} from '@minecraft/server';
import {getMainHand,getOffHand} from './core/player_io.js';
import {eatingIdentity} from './core/eating_transaction.js';
import {isSpecialSeasoningId} from './seasoning/special_seasoning_visual_core.js';
const NS='kaleidoscope_grilling:',motions=new Map(),pendingHands=new Map();
function held(player,hand){return hand==='off'?getOffHand(player):getMainHand(player)}
export function beginSeasoningMotion(player,hand){
 const stack=held(player,hand);if(!stack)return;
 motions.set(player.id,{hand,identity:eatingIdentity(stack),slot:player.selectedSlotIndex,start:system.currentTick});
 player.setProperty(NS+'season_hand',hand==='off'?2:1);player.setProperty(NS+'season_phase',1);
 if(hand==='main'&&isSpecialSeasoningId(stack.typeId)){
  // Finite and main-hand-only; pending, observer and other actions are untouched.
  try{player.playAnimation('animation.kg_seasoning.player.sprinkle_anchor.right',{controller:'kg_seasoning_sprinkle_anchor',blendOutTime:0,stopExpression:"!q.is_item_name_any('slot.weapon.mainhand','"+stack.typeId+"') || q.property('"+NS+"season_hand') == 2"})}catch(error){console.warn('[Grilling sprinkle anchor] '+error)}
 }
}
export function syncSeasoningMotion(player,pending){
 // Use the captured native hand; two pending bottles must never shake together.
 const stack=pending&&held(player,pending.hand);
 const using=isPendingSeasoningId(stack?.typeId)&&eatingIdentity(stack)===pending.use.identity&&
  (pending.hand==='off'||pending.use.slot===player.selectedSlotIndex);
 const hand=using?(pending.hand==='off'?2:1):0;
 if(pendingHands.get(player.id)!==hand){player.setProperty(NS+'pending_hand',hand);pendingHands.set(player.id,hand)}
 const motion=motions.get(player.id);if(!motion)return;
 const elapsed=system.currentTick-motion.start;
 const current=elapsed>=0&&elapsed<10&&eatingIdentity(held(player,motion.hand))===motion.identity&&
  (motion.hand==='off'||motion.slot===player.selectedSlotIndex);
 player.setProperty(NS+'season_phase',current?elapsed+1:0);
 if(!current){motions.delete(player.id);player.setProperty(NS+'season_hand',0)}
}
function forget(id){motions.delete(id);pendingHands.delete(id)}
world.afterEvents.playerLeave.subscribe(e=>forget(e.playerId));
world.afterEvents.playerSpawn.subscribe(e=>{
 forget(e.player.id);
 for(const key of ['season_hand','season_phase','pending_hand'])e.player.setProperty(NS+key,0);
});
