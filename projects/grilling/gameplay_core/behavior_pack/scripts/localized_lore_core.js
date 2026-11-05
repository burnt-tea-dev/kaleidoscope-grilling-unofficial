export const HEAT_NAME_KEY='tooltip.kaleidoscope_grilling.smoky_warmth';
export function heatLore(seconds){
 const sec=Math.max(1,Math.ceil(seconds)),m=Math.floor(sec/60),s=String(sec%60).padStart(2,'0');
 return {rawtext:[{text:'§c🔥 '},{translate:HEAT_NAME_KEY},{text:' '+m+':'+s}]};
}
export function isHeatLore(line){
 if(typeof line==='string')return line.startsWith('§c🔥');
 if(typeof line?.text==='string')return line.text.startsWith('§c🔥');
 const parts=line?.rawtext;
 return Array.isArray(parts)&&parts[0]?.text==='§c🔥 '&&parts[1]?.translate===HEAT_NAME_KEY;
}

export function seasoningLore(uses,ingredients,{pending=false,missingBase=false}={}){
 const lines=[];
 if(uses!==undefined)lines.push({translate:'tooltip.kaleidoscope_grilling.seasoning.uses',with:[String(uses),'16']});
 if(ingredients!==undefined)lines.push({translate:'tooltip.kaleidoscope_grilling.seasoning.ingredients',with:[String(ingredients),'8']});
 if(pending||missingBase)lines.push({translate:'tooltip.kaleidoscope_grilling.seasoning.'+(pending?'ready':'missing_base')});
 return lines;
}
export function creatorLore(name){return {translate:'tooltip.kaleidoscope_grilling.creator',with:[String(name)]};}

export function secretStageLore(cooked){
 return {rawtext:[{text:cooked?'§r§6':'§r§8'},{translate:'tooltip.kaleidoscope_grilling.secret_skewer.'+(cooked?'cooked':'raw')},{text:'§r'}]};
}
export function isSecretStageLore(line){
 // Only our exact RawMessage is owned. Similar foreign rows, including ones
 // with translation arguments or extra text, must not be discarded.
 const parts=line?.rawtext;
 return line&&Object.keys(line).length===1&&Array.isArray(parts)&&parts.length===3
  &&parts.every(part=>part&&Object.keys(part).length===1)
  &&parts[2].text==='§r'
  &&((parts[0].text==='§r§8'&&parts[1].translate==='tooltip.kaleidoscope_grilling.secret_skewer.raw')
   ||(parts[0].text==='§r§6'&&parts[1].translate==='tooltip.kaleidoscope_grilling.secret_skewer.cooked'));
}
