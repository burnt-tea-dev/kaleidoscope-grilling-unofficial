// Formatting-only presentation cache. Gameplay never reads this payload.
// The existing progress row carries it, so no user's lore line is displaced.
export const SECRET_GUI_HEADER='§r§k§r§9§r§a§r§b§r';
export const SECRET_GUI_PROGRESS='tooltip.kaleidoscope_grilling.skewer.progress';
export function secretGuiDigitMarker(field,digit){return '§r§k§'+field.toString(16)+'§'+digit.toString(16)+'§r'}
export function encodeSecretGuiCache({foods,variants,style}){
 const hex=foods.map(x=>x.toString(16).padStart(2,'0')).join('')+variants.toString(16)+style.toString(16);
 return SECRET_GUI_HEADER+Array.from(hex,(digit,field)=>secretGuiDigitMarker(field,parseInt(digit,16))).join('');
}
export function decodeSecretGuiCache(text){
 if(typeof text!=='string'||!text.startsWith(SECRET_GUI_HEADER))return undefined;
 let rest=text.slice(SECRET_GUI_HEADER.length),hex='';
 for(let field=0;field<8;field++){
  const match=/^§r§k§([0-7])§([0-9a-f])§r/.exec(rest);
  if(!match||parseInt(match[1],16)!==field)return undefined;
  hex+=match[2];rest=rest.slice(match[0].length);
 }
 if(rest)return undefined;
 const foods=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)),variants=parseInt(hex[6],16),style=parseInt(hex[7],16);
 if(foods.some(x=>x>225)||variants>7||![0,4,6].includes(style))return undefined;
 return {foods,variants,style};
}
export function secretGuiProgress(row){
 if(row?.translate===SECRET_GUI_PROGRESS&&Array.isArray(row.with))return {base:row};
 const parts=row?.rawtext;
 if(Array.isArray(parts)&&parts.length===2&&parts[0]?.translate===SECRET_GUI_PROGRESS&&Array.isArray(parts[0].with)&&decodeSecretGuiCache(parts[1]?.text))
  return {base:parts[0],cache:parts[1].text};
 return undefined;
}
