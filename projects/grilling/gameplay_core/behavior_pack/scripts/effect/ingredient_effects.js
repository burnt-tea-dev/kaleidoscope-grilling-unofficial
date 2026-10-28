import {ingredientFoodFacts} from '../food_snapshot_core.js';
import {VANILLA_FOOD_BEHAVIOR} from '../food/vanilla_food_data.js';
import {effectsForStandaloneFood} from '../food/standalone_food_effect_core.js';
import {COOKED_EFFECTS,RAW_NAUSEA} from '../eating_data_lookup.js';
import {applySecretBehaviorExtension} from '../secret_compat_core.js';
import {canonicalFoodId} from '../eating_profile_ids.js';

// Explicit compatibility data, never a forged itemCompleteUse event. Only edible
// ingredients inherit finish-use effects, matching Java SecretSkewerItem.
export function ingredientBehavior(row){
 row=ingredientFoodFacts(row);
 if(!row||!(row.edible??(Number(row.nutrition)>0)))return {effects:[],convertTo:''};
 const id=canonicalFoodId(row.id);
 const vanilla=VANILLA_FOOD_BEHAVIOR[id],effects=(vanilla?.effects??[]).map(e=>({...e,kind:'native'}));
 effects.push(...effectsForStandaloneFood(id));
 const fixed=COOKED_EFFECTS[id];
 if(fixed?.effect)effects.push({kind:fixed.effect.startsWith('minecraft:')?'native':'persistent_fx',
  effect:fixed.effect.split(':')[1],ticks:fixed.seconds*20,amplifier:0});
 if(RAW_NAUSEA[id]||id==='kaleidoscope_grilling:mysterious_skewer')
  effects.push({kind:'native',effect:'nausea',ticks:id.endsWith('mysterious_skewer')?100:60});
 if(id==='kaleidoscope_grilling:dark_grilling')effects.push({kind:'native',effect:'blindness',ticks:200});
 if(id==='kaleidoscope_grilling:sichuan_pepper')effects.push({kind:'persistent_fx',effect:'numb',ticks:200});
 const convertTo=row.convertTo||vanilla?.convertTo||'';
 return applySecretBehaviorExtension({
  effects,convertTo,remainder:convertTo?{id:convertTo,count:1}:null,
  clearPoison:id==='minecraft:honey_bottle',teleport:id==='minecraft:chorus_fruit',
  ordinary:id==='kaleidoscope_grilling:ordinary_skewer'
 },row);
}

export function rolledIngredientEffects(row,random=Math.random){
 const behavior=ingredientBehavior(row);
 return {...behavior,effects:behavior.effects.filter(e=>(e.chance??1)>=1||random()<(e.chance??1))};
}
