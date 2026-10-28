import {HOST_BLOCK_ID} from '../oil/typed_oil_pot_block_core.js';
import {readPlacedOilPotState} from '../oil/cookery_oil_pot_block_adapter.js';
import {oilPotHudView} from './crosshair_hud_core.js';
import {registerCrosshairHudProvider} from './crosshair_hud_runtime.js';

registerCrosshairHudProvider({
 id:'kaleidoscope_grilling:oil_pot',
 priority:100,
 probe(_player,block){
  if(block?.typeId!==HOST_BLOCK_ID)return undefined;
  const state=readPlacedOilPotState(block);
  return state?oilPotHudView(state):undefined;
 }
});
