import {scriptEvents} from './event_router.js';
/** Author-owned food behavior data for deliberate Secret Skewer consumption. */
import {system,ItemStack} from '@minecraft/server';
let FOOD_EFFECTS={},EXTRA_RETURNS={};
export function registerAuthorFoodEffects(value){FOOD_EFFECTS=value;}
export function registerAuthorFoodReturns(value){EXTRA_RETURNS=value;}
export const INGREDIENT_CAPABILITIES=Object.freeze(['secret_ingredient_behaviors_v1']);
export function publishAuthorIngredientBehaviors(){
 const ids=new Set([...Object.keys(FOOD_EFFECTS),...Object.keys(EXTRA_RETURNS),'kaleidoscope_cookery:red_chili','kaleidoscope_cookery:green_chili']);let published=0;
 for(const input of ids){try{
  const food=new ItemStack(input).getComponent('minecraft:food');if(!food)continue;
  let convertTo='';try{convertTo=food.usingConvertsTo??'';}catch{}
  const behavior={mode:'replace',effects:(FOOD_EFFECTS[input]??[]).map(e=>({kind:'native',effect:e.id,ticks:e.duration,amplifier:e.amplifier??0,chance:e.chance??1})),convertTo,remainders:(EXTRA_RETURNS[input]??[]).map(id=>({id,count:1})),damage:input==='kaleidoscope_cookery:red_chili'?2:input==='kaleidoscope_cookery:green_chili'?1:0};
  system.sendScriptEvent('kaleidoscope_grilling:register_secret_food_behavior',JSON.stringify({input,behavior}));published++;
 }catch(e){console.warn('[Cookery ingredient API] unavailable item '+input+' '+e)}
 }
 return published;
}
system.runTimeout(publishAuthorIngredientBehaviors,20);
scriptEvents(system)('ingredient_api_host',e=>{if(e.id==='kaleidoscope_grilling:request_secret_compat'&&e.sourceType==='Server')publishAuthorIngredientBehaviors();});
