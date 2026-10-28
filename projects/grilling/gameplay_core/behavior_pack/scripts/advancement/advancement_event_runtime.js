import {awardOneShotAdvancement} from './advancement_runtime.js';
import {
 LOOKING_THE_PART,GLEAMING_WITH_OIL,THREE_FLAVORS_BASE,WORLD_IN_A_BOTTLE,EAT_IT_HOT,NEAT_AND_ORDERLY,
 threadingCompletedForAdvancement,seasoningAdvancementIds,hotFoodAdvancementEligible
} from './advancement_event_core.js';

export function awardLookingThePart(player,outcome){
 return threadingCompletedForAdvancement(outcome)&&awardOneShotAdvancement(player,LOOKING_THE_PART);
}
export function awardGleamingWithOil(player){
 return awardOneShotAdvancement(player,GLEAMING_WITH_OIL);
}
export function awardSeasoningMilestones(player,ingredients){
 let changed=false;
 for(const id of seasoningAdvancementIds(ingredients)){
  const spec=id==='three_flavors_base'?THREE_FLAVORS_BASE:WORLD_IN_A_BOTTLE;
  changed=awardOneShotAdvancement(player,spec)||changed;
 }
 return changed;
}
export function awardEatItHot(player,itemId,hot){
 return hotFoodAdvancementEligible(itemId,hot)&&awardOneShotAdvancement(player,EAT_IT_HOT);
}
export function awardNeatAndOrderly(player){
 return awardOneShotAdvancement(player,NEAT_AND_ORDERLY);
}
