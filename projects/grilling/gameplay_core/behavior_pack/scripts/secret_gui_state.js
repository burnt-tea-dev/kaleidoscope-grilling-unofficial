import {getItemProperty} from './core/persist.js';
import {canonicalFoodId} from './eating_profile_ids.js';
import {SECRET_ID} from './skewer/skewering_core.js';
import {readEffectiveSkewerRows} from './skewer/ingredient_state.js';
import {secretVisualState} from './secret_visual_state.js';
import {SECRET_MODEL_VARIANTS_KEY,readModelVariants,decodeSecretVisual} from './secret_visual_state_core.js';
import {encodeSecretGuiCache,secretGuiProgress} from './secret_gui_core.js';

function expectedProgress(stack){
 if(canonicalFoodId(stack?.typeId)!==SECRET_ID)return undefined;
 const rows=readEffectiveSkewerRows(stack);if(rows.length!==3)return undefined;
 const visual=secretVisualState(stack,readEffectiveSkewerRows).map(decodeSecretVisual);
 const variants=readModelVariants(getItemProperty(stack,SECRET_MODEL_VARIANTS_KEY));
 const cache=encodeSecretGuiCache({foods:visual.map(x=>x.food),variants:variants.reduce((bits,value,i)=>bits|((value>=7?1:0)<<i),0),style:visual[0].style});
 const lore=stack.getRawLore(),index=lore.findIndex(row=>secretGuiProgress(row));
 if(index<0)return undefined; // A custom tooltip is not permission to replace its text.
 const current=secretGuiProgress(lore[index]);
 return {lore,index,base:current.base,cache,current:current.cache};
}
export function needsSecretGuiCache(stack){const next=expectedProgress(stack);return !!next&&next.cache!==next.current}
export function refreshSecretGuiCache(stack){
 const next=expectedProgress(stack);if(!next||next.cache===next.current)return stack;
 next.lore[next.index]={rawtext:[next.base,{text:next.cache}]};
 stack.setLore(next.lore);return stack;
}
