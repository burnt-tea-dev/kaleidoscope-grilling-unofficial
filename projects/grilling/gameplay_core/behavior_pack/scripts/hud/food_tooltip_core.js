import {getItemProperty,setItemProperty,getItemPropertyIds,getItemLore,setItemLore} from '../core/persist.js';
import {canonicalCuisineFoodId} from '../host_api/cuisine_quality_core.js';
export {isHeatLore} from '../localized_lore_core.js';
// Java FoodTooltip.appendMaxim: DARK_GRAY + ITALIC; existing RP translation keys.
export const MAXIM_ITEMS=Object.freeze([
 'sugared_tomato','pepper_honey','houttuynia_stir_fried_pork',
 'green_pepper_squid_tentacles','braised_chicken_wings','potato_beef_stew',
 'red_sweet_potato_porridge','sour_spicy_noodles'
]);
const PREFIX='kaleidoscope_grilling:';
const KEYS=new Map(MAXIM_ITEMS.map(id=>[PREFIX+id,'tooltip.kaleidoscope_grilling.'+id+'.maxim']));
const OWN_KEYS=new Set(KEYS.values());
export function foodMaximKey(id){return KEYS.get(canonicalCuisineFoodId(id))}
export function readRawFoodLore(stack){
 // Do not flatten RawMessage translations through getLore(). A failed read is not empty lore.
 return stack.getRawLore();
}
function ownMaxim(line){
 const parts=line?.rawtext;
 return Array.isArray(parts)&&parts.length===3&&parts[0]?.text==='§r§8§o'&&
  OWN_KEYS.has(parts[1]?.translate)&&parts[2]?.text==='§r';
}
export function planMaximLore(id,lore){
 const key=foodMaximKey(id);
 if(!key||!Array.isArray(lore))return undefined;
 const rest=lore.filter(line=>!ownMaxim(line));
 // Never discard a user's line to make room for presentation metadata.
 if(rest.length>=20)return undefined;
 const first={rawtext:[{text:'§r§8§o'},{translate:key},{text:'§r'}]};
 if(lore.length===rest.length+1&&ownMaxim(lore[0])&&lore[0].rawtext[1].translate===key)return undefined;
 return [first,...rest];
}
export function applyFoodMaxim(stack){
 if(!foodMaximKey(stack?.typeId))return false;
 const next=planMaximLore(stack.typeId,readRawFoodLore(stack));
 if(!next)return false;
 setItemLore(stack,next);
 return true;
}
