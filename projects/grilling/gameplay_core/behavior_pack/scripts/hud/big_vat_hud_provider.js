import {BIG_VAT_ID} from '../oil/oil_machine_core.js';
import {a26ReadVat} from '../oil/oil_machine_runtime.js';
import {bigVatHudView} from './big_vat_hud_core.js';
import {registerCrosshairHudProvider} from './crosshair_hud_runtime.js';

registerCrosshairHudProvider({
 id:'kaleidoscope_grilling:big_vat',
 priority:70,
 probe(_player,block){
  if(block?.typeId!==BIG_VAT_ID)return undefined;
  return bigVatHudView(a26ReadVat(block));
 }
});
