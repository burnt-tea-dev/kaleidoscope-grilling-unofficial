import {getItemProperty} from './core/persist.js';
import {canonicalFoodId} from './eating_profile_ids.js';
import {SECRET_ID,UNFINISHED_ID} from './skewer/skewering_core.js';
import {readSkewerRows,readEffectiveSkewerRows} from './skewer/ingredient_state.js';
import {secretVisualState,secretVisualRows} from './secret_visual_state.js';
import {SECRET_MODEL_VARIANTS_KEY,decodeSecretVisual} from './secret_visual_state_core.js';
import {SECRET_GUI_EMPTY_FOOD,secretGuiVariantBits,encodeSecretGuiCache,secretGuiProgress} from './secret_gui_core.js';

function expectedProgress(stack){
 const id=canonicalFoodId(stack?.typeId);if(id!==SECRET_ID&&id!==UNFINISHED_ID)return undefined;
 const raw=readSkewerRows(stack);if(!raw.length)return undefined;
 const variants=getItemProperty(stack,SECRET_MODEL_VARIANTS_KEY);
 // Partial held values pack their count into the style field. GUI masks need
 // raw style 0 instead, and must not paint an absent slot as unknown food.
 const visual=(id===UNFINISHED_ID?secretVisualRows(raw,variants,0):secretVisualState(stack,readEffectiveSkewerRows)).map(decodeSecretVisual);
 const cache=encodeSecretGuiCache({foods:visual.map((x,i)=>i<raw.length?x.food:SECRET_GUI_EMPTY_FOOD),variants:secretGuiVariantBits(raw,variants),style:visual[0].style});
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
