// Formatting-only presentation cache. Gameplay never reads this payload.
// The existing progress row carries it, so no user's lore line is displaced.
export const SECRET_GUI_HEADER='§r§k§r§9§r§a§r§b§r';
export const SECRET_GUI_PROGRESS='tooltip.kaleidoscope_grilling.skewer.progress';
// A missing slot is distinct from food 0, the existing unknown-food palette.
export const SECRET_GUI_EMPTY_FOOD=255;
function javaStringHash(value){let hash=0;for(let i=0;i<value.length;i++)hash=(Math.imul(hash,31)+value.charCodeAt(i))|0;return hash;}
// SkeweringHandler.guiVariantBits reads raw IDs even for cooked snapshots.
export function secretGuiVariantBits(ingredients,raw){
 let variants;try{variants=typeof raw==='string'?JSON.parse(raw):raw}catch{}
 let bits=0;
 for(let slot=0;slot<3;slot++){
  const value=Number.isInteger(variants?.[slot])?variants[slot]|0:0;let bit;
  if(value>=4&&value<=9)bit=Math.floor((value-4)/3);
  else{
   let hash=(31*(slot+1)+value)|0,id=ingredients[slot]?.id;
   if(typeof id==='string')hash=(Math.imul(31,hash)+javaStringHash(id))|0;
   hash^=hash>>>16;hash=Math.imul(hash,0x7FEB352D);hash^=hash>>>15;bit=hash&1;
  }
  bits|=bit<<slot;
 }
 return bits;
}
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
 if(foods.some(x=>x>225&&x!==SECRET_GUI_EMPTY_FOOD)||variants>7||![0,4,6].includes(style))return undefined;
 return {foods,variants,style};
}
export function secretGuiProgress(row){
 if(row?.translate===SECRET_GUI_PROGRESS&&Array.isArray(row.with))return {base:row};
 const parts=row?.rawtext;
 if(Array.isArray(parts)&&parts.length===2&&parts[0]?.translate===SECRET_GUI_PROGRESS&&Array.isArray(parts[0].with)&&decodeSecretGuiCache(parts[1]?.text))
  return {base:parts[0],cache:parts[1].text};
 return undefined;
}
