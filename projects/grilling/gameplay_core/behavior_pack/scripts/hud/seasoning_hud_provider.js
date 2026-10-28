import {isSeasoningBlockId} from '../seasoning/seasoning_contract_core.js';
import {topPlacedSeasoningBottle} from '../seasoning/seasoning_block_adapter.js';
import {seasoningHudView} from './seasoning_hud_core.js';
import {registerCrosshairHudProvider} from './crosshair_hud_runtime.js';

registerCrosshairHudProvider({
 id:'kaleidoscope_grilling:seasoning_bottle',
 priority:60,
 probe(_player,block){
  if(!isSeasoningBlockId(block?.typeId))return undefined;
  const top=topPlacedSeasoningBottle(block);
  return seasoningHudView(top??{kind:'empty',ingredients:[],uses:0,variant:0});
 }
});
