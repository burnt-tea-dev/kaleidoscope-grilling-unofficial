import {system,world} from '@minecraft/server';
import {readCookeryOilPot} from './a2734_cookery_oil_pot_adapter.js';
import {grillingConfig} from './server_config_runtime.js';
import {getMainHand,getOffHand} from './a2735_player_io.js';
import {stackIntentSignature} from './a2762_interaction_intent_core.js';
import {isOilBrushVisualItem,oilPotIdlePacket,oilBrushPacket,oilBrushType,OIL_BRUSH_TICKS,OIL_BRUSH_MARKER} from './oil_brush_visual_core.js';
import {writeHeldVisual,invalidateHeldVisual,heldVisualPropertyNames} from './held_visual_transport.js';
import {registerHeldVisualProvider,reportHeldVisualError} from './held_visual_dispatch_runtime.js';
const motions=new Map();
function held(player,hand){return hand==='off'?getOffHand(player):getMainHand(player)}
// Called only AFTER successful oil consumption, so a depleted pot is captured
// as empty. Inventory remains exclusively owned by the successful transaction.
export function beginOilBrushVisual(player,hand,type){
 if(!grillingConfig().enableOilBrushVisuals)return false;
 if(hand!=='main'&&hand!=='off')return false;
 const stack=held(player,hand);if(!isOilBrushVisualItem(stack?.typeId))return false;
 motions.set(player.id,{hand,identity:stackIntentSignature(stack),slot:player.selectedSlotIndex,start:system.currentTick,type:oilBrushType(type),dimension:player.dimension?.id});
 const published=syncOilBrushVisual(player);
 if(!published){motions.delete(player.id);syncOilBrushVisual(player)}
 return published;
}
export function cancelOilBrushVisual(player){motions.delete(player.id);syncOilBrushVisual(player)}
export function syncOilBrushVisual(player,{idle=true}={}){
 const motion=motions.get(player.id),elapsed=motion?system.currentTick-motion.start:-1;
 if(!motion&&!idle)return false;
 const active=grillingConfig().enableOilBrushVisuals&&motion&&elapsed>=0&&elapsed<OIL_BRUSH_TICKS&&player.dimension?.id===motion.dimension&&
  (motion.hand==='off'||motion.slot===player.selectedSlotIndex)&&stackIntentSignature(held(player,motion.hand))===motion.identity;
 if(!active)motions.delete(player.id);
 let published=!!active;
 for(const hand of ['main','off']){
  if(!isOilBrushVisualItem(held(player,hand)?.typeId))continue; // Never erase another provider's new item.
  try{
   if(active&&motion.hand===hand)writeHeldVisual(player,hand,'oilbrush',oilBrushPacket(motion.type,elapsed));
   else{const state=readCookeryOilPot(held(player,hand)),type=state.empty?0:state.type?2+oilBrushType(state.type):1;writeHeldVisual(player,hand,'oilpot',oilPotIdlePacket(type))}
  }
  catch(error){published=false;try{invalidateHeldVisual(player,hand)}catch{};reportHeldVisualError('oil brush '+hand,player,error)}
 }
 return published;
}
export function oilBrushStopExpression(hand){
 const marker=heldVisualPropertyNames(hand)[11];
 return "q.property('"+marker+"') != "+OIL_BRUSH_MARKER+" || !q.is_item_name_any('slot.weapon."+(hand==='off'?'offhand':'mainhand')+"','kaleidoscope_cookery:oil_pot','kaleidoscope_cookery:oil_pot_filled')";
}
registerHeldVisualProvider('oil brush',syncOilBrushVisual,{leave:id=>motions.delete(id),spawn:id=>motions.delete(id)});
// Respawn clears both the motion and any pre-death ready marker on the next
// shared presentation dispatch. The one-tick main loop handles cancellation.

world.afterEvents.entityDie.subscribe(e=>{if(e.deadEntity?.typeId==='minecraft:player'){motions.delete(e.deadEntity.id);try{syncOilBrushVisual(e.deadEntity)}catch{}}});
