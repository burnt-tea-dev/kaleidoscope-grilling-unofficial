// Java OilBrushAnimation (9a1acdab): 20 ticks, canola/secret/premium type order.
// Reuse a hand's presentation bus; never allocate a 33rd player property.
export const OIL_BRUSH_MARKER=225;
export const OIL_POT_IDLE_MARKER=226;
export const OIL_BRUSH_TICKS=20;
export const OIL_POT_IDS=Object.freeze(['kaleidoscope_cookery:oil_pot','kaleidoscope_cookery:oil_pot_filled']);
export function isOilBrushVisualItem(id){return OIL_POT_IDS.includes(id)}
export function oilBrushType(type){return type==='secret_chili'?1:type==='premium_chili'?2:0}
export function oilBrushPacket(type,elapsed){
 if(!Number.isInteger(type)||type<0||type>2||!Number.isInteger(elapsed)||elapsed<0||elapsed>=OIL_BRUSH_TICKS)throw Error('Invalid oil brush frame');
 return [1+type*OIL_BRUSH_TICKS+elapsed,...Array(10).fill(0),OIL_BRUSH_MARKER];
}

export function oilPotIdlePacket(type){
 if(!Number.isInteger(type)||type<0||type>4)throw Error('Invalid oil pot idle type');
 return [type,...Array(10).fill(0),OIL_POT_IDLE_MARKER];
}
