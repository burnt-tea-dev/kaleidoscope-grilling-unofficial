import {getItemProperty} from './core/persist.js';
import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';
import {secretVisualIndex} from './integration_registry_core.js';
import {SECRET_MODEL_VARIANTS_KEY,readModelVariants,encodeSecretVisual,encodePartialVisual} from './secret_visual_state_core.js';
const COOKED=PersistedKey.SECRET_COOKED,CACHED=PersistedKey.SECRET_COOKED_INGREDIENTS;
export function secretVisualState(stack,reader,stage){
 const cooked=getItemProperty(stack,COOKED)===true;
 const visualStage=stage===undefined?(cooked?4:0):stage;
 const ingredients=reader?.(stack,visualStage>=4?true:undefined)??[];
 let cached;try{cached=JSON.parse(getItemProperty(stack,CACHED)??'null')}catch{}
 const hasCookedSnapshot=Array.isArray(cached)&&cached.length===3;
 return secretVisualRows(ingredients,getItemProperty(stack,SECRET_MODEL_VARIANTS_KEY),visualStage,hasCookedSnapshot);
}

// The same current palette/shape projection is also used for saved plate rows;
// they do not need to be reconstructed into or written onto an ItemStack.
export function secretVisualRows(ingredients,variantData,visualStage,hasCookedSnapshot=false){
 const variants=readModelVariants(variantData,ingredients.length);
 return Array.from({length:3},(_,i)=>{
  if(!ingredients[i])return 0;
  const food=secretVisualIndex(ingredients[i].id);
  // Keep an unsupported ingredient's shape for exact neighboring source seams.
  return food?encodeSecretVisual(food,variants[i],visualStage,hasCookedSnapshot):encodeSecretVisual(1,variants[i],visualStage,hasCookedSnapshot)-1;
 });
}

export function partialVisualState(stack,reader){
 const ingredients=(reader?.(stack,false)??[]).slice(0,2),count=ingredients.length;
 const variants=readModelVariants(getItemProperty(stack,SECRET_MODEL_VARIANTS_KEY),count);
 return Array.from({length:3},(_,i)=>i<count?encodePartialVisual(secretVisualIndex(ingredients[i]?.id),variants[i],count):0);
}
