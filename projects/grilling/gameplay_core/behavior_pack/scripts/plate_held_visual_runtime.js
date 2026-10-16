import {world} from '@minecraft/server';
import {canonicalFoodId} from './eating_profile_ids.js';
import {SLIME_ID,readSlimeWorldFrame} from './slime_frame_core.js';
import {PLATE_SPECIAL_HELD_START} from './plate_special_visual_data.js';
import {getMainHand,getOffHand} from './a2735_player_io.js';
import {getItemProperty} from './itemData.js';
import {PLATE_ID,PLATE_SKEWERS_KEY} from './a25_plate_recipe_core.js';
import {decodePlateStorage} from './plate_transaction_core.js';
import {plateHeldVisualPlan} from './plate_held_visual_core.js';
import {writeHeldVisual,invalidateHeldVisual} from './held_visual_transport.js';
import {registerHeldVisualProvider,reportHeldVisualError} from './held_visual_dispatch_runtime.js';

// Derived frame payloads only; saved contents remain authoritative.
const animatedPlates=new Map();
function clearAnimatedPlate(playerId,hand){
 const hands=animatedPlates.get(playerId);hands?.delete(hand);if(!hands?.size)animatedPlates.delete(playerId);
}

// Read the saved envelope directly. Reconstructing temporary ItemStacks here
// would unnecessarily touch content-addressed item metadata on every refresh.
export function syncPlateHeld(player){
 for(const [hand,read] of [['main',getMainHand],['off',getOffHand]]){
  try{
   const stack=read(player);if(stack?.typeId!==PLATE_ID){clearAnimatedPlate(player.id,hand);continue;}
   const source=getItemProperty(stack,PLATE_SKEWERS_KEY),rows=decodePlateStorage(source),frame=readSlimeWorldFrame(world);
   const words=plateHeldVisualPlan(rows,frame),slots=rows.flatMap((row,index)=>canonicalFoodId(row.id)===SLIME_ID?[index]:[]);
   writeHeldVisual(player,hand,'plate',words);
   if(slots.length){let hands=animatedPlates.get(player.id);if(!hands){hands=new Map();animatedPlates.set(player.id,hands);}hands.set(hand,{source,words,slots,frame});}
   else clearAnimatedPlate(player.id,hand);
  }catch(error){
   clearAnimatedPlate(player.id,hand);
   try{invalidateHeldVisual(player,hand)}catch{}
   reportHeldVisualError('plate '+hand,player,error);
  }
 }
}
// Called from the existing two-hand slime loop with its single world sample.
// No per-tick inventory scan, saved-row decoding, or unchanged-frame redraw.
export function syncPlateSlimeHeld(player,hand,stack,frame){
 const cached=animatedPlates.get(player.id)?.get(hand);if(!cached||cached.frame===frame)return;
 try{
  if(stack?.typeId!==PLATE_ID||getItemProperty(stack,PLATE_SKEWERS_KEY)!==cached.source){clearAnimatedPlate(player.id,hand);return;}
  if(!Number.isInteger(frame)||frame<0||frame>4)throw Error('Grilling: invalid plate slime frame');
  const words=[...cached.words];for(const row of cached.slots)words[row*2]=PLATE_SPECIAL_HELD_START+frame;
  writeHeldVisual(player,hand,'plate',words);cached.words=words;cached.frame=frame;
 }catch(error){
  clearAnimatedPlate(player.id,hand);try{invalidateHeldVisual(player,hand)}catch{}
  reportHeldVisualError('plate slime '+hand,player,error);
 }
}
registerHeldVisualProvider('plate contents',syncPlateHeld,{leave:id=>animatedPlates.delete(id),spawn:id=>animatedPlates.delete(id)});
