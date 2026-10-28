import {GRILL_ID} from '../eating_data_lookup.js';
import {readGrillState,occupiedGrillSlots} from '../grill/grill_state_adapter.js';
import {grillHudView} from './grill_hud_core.js';
import {registerCrosshairHudProvider} from './crosshair_hud_runtime.js';

registerCrosshairHudProvider({
 id:'kaleidoscope_grilling:grill',
 priority:90,
 probe(_player,block){
  if(block?.typeId!==GRILL_ID)return undefined;
  return grillHudView(readGrillState(block),occupiedGrillSlots(block));
 }
});
