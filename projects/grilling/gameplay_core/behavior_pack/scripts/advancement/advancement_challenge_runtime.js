import {awardOneShotAdvancement} from './advancement_runtime.js';
import {
 MENTAL_PREPARATION_FAILED,METALLIC_TASTE,TASTE_OF_DRAGON,METAL_TOLERANCE_FAILED,
 STRONGEST_SHIELD,STRONGEST_SPEAR,WEDDING_CANDY,
 seasoningFinishedAdvancementIds,mentalPreparationFailedEligible,heavyMetalBlockedEligible,
 ordinaryChallengeOutcome
} from './advancement_challenge_core.js';

export {ordinaryChallengeOutcome};

export function awardSeasoningFinishedChallenges(player,ingredients){
 let changed=false;
 for(const id of seasoningFinishedAdvancementIds(ingredients)){
  const spec=id==='metallic_taste'?METALLIC_TASTE:TASTE_OF_DRAGON;
  changed=awardOneShotAdvancement(player,spec)||changed;
 }
 return changed;
}

export function awardMentalPreparationFailed(player,itemId){
 return mentalPreparationFailedEligible(itemId)
  &&awardOneShotAdvancement(player,MENTAL_PREPARATION_FAILED);
}

export function awardMetalToleranceFailed(player,totemCount,poisoned){
 return heavyMetalBlockedEligible(totemCount,poisoned)
  &&awardOneShotAdvancement(player,METAL_TOLERANCE_FAILED);
}

export function awardOrdinaryChallenge(player,outcome){
 if(outcome==='shield')return awardOneShotAdvancement(player,STRONGEST_SHIELD);
 if(outcome==='spear')return awardOneShotAdvancement(player,STRONGEST_SPEAR);
 return false;
}

export function awardWeddingCandy(player){
 return awardOneShotAdvancement(player,WEDDING_CANDY);
}
