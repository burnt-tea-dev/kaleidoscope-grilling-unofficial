import {syncPlateSlimeHeld} from './plate_held_visual_runtime.js';
import {getMainHand,getOffHand} from './a2735_player_io.js';
import {SLIME_ID,slimeFramePacket} from './slime_frame_core.js';
import {writeHeldVisual,invalidateHeldVisual} from './held_visual_transport.js';
import {reportHeldVisualError} from './held_visual_dispatch_runtime.js';
export {readSlimeWorldFrame} from './slime_frame_core.js';

// Called by the existing one-tick player loop, not the five-tick dispatcher.
// Both hands and all players receive the same single world-time sample.
export function syncSlimeHeld(player,frame){
 for(const [hand,read] of [['main',getMainHand],['off',getOffHand]]){
  const stack=read(player);
  if(stack?.typeId!==SLIME_ID){syncPlateSlimeHeld(player,hand,stack,frame);continue;}
  try{writeHeldVisual(player,hand,'slime',slimeFramePacket(frame))}
  catch(error){
   try{invalidateHeldVisual(player,hand)}catch{}
   reportHeldVisualError('slime '+hand,player,error);
  }
 }
}
