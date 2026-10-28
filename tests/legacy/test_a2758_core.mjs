import assert from 'node:assert/strict';
import {
 CHALLENGE_ADVANCEMENTS,seasoningFinishedAdvancementIds,mentalPreparationFailedEligible,
 heavyMetalBlockedEligible,ordinaryChallengeOutcome,advancementFrameTranslationKeys
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/advancement/advancement_challenge_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('seven remaining direct-event advancements are declared',()=>{
 assert.deepEqual(Object.keys(CHALLENGE_ADVANCEMENTS).sort(),[
  'mental_preparation_failed','metal_tolerance_failed','metallic_taste',
  'strongest_shield','strongest_spear','taste_of_dragon','wedding_candy'
 ]);
 assert.equal(CHALLENGE_ADVANCEMENTS.wedding_candy.hidden,true);
 assert.equal(CHALLENGE_ADVANCEMENTS.wedding_candy.xp,50);
});

t('finished seasoning awards totem and dragon milestones independently',()=>{
 assert.deepEqual(seasoningFinishedAdvancementIds([]),[]);
 assert.deepEqual(seasoningFinishedAdvancementIds(['kaleidoscope_grilling:totem_powder']),['metallic_taste']);
 assert.deepEqual(seasoningFinishedAdvancementIds(['kaleidoscope_grilling:dragon_egg_powder']),['taste_of_dragon']);
 assert.deepEqual(seasoningFinishedAdvancementIds([
  'kaleidoscope_grilling:totem_powder','kaleidoscope_grilling:dragon_egg_powder'
 ]),['metallic_taste','taste_of_dragon']);
});

t('mental preparation failed only matches raw caterpillar skewer',()=>{
 assert.equal(mentalPreparationFailedEligible('kaleidoscope_grilling:raw_caterpillar_skewer'),true);
 assert.equal(mentalPreparationFailedEligible('kaleidoscope_grilling:grilled_caterpillar_skewer'),false);
});

t('metal tolerance failed requires totem and active poisoning',()=>{
 assert.equal(heavyMetalBlockedEligible(1,true),true);
 assert.equal(heavyMetalBlockedEligible(4,true),true);
 assert.equal(heavyMetalBlockedEligible(1,false),false);
 assert.equal(heavyMetalBlockedEligible(0,true),false);
});

t('ordinary challenged branch preserves Java fifty-fifty award split',()=>{
 assert.equal(ordinaryChallengeOutcome(false,0),'none');
 assert.equal(ordinaryChallengeOutcome(true,0),'shield');
 assert.equal(ordinaryChallengeOutcome(true,.499999),'shield');
 assert.equal(ordinaryChallengeOutcome(true,.5),'spear');
 assert.equal(ordinaryChallengeOutcome(true,.999),'spear');
});

t('shared advancement UI keys follow frame type',()=>{
 assert.deepEqual(advancementFrameTranslationKeys('task'),{
  announce:'message.kaleidoscope_grilling.advancement.task_announce',
  self:'message.kaleidoscope_grilling.advancement.task_self'
 });
 assert.equal(advancementFrameTranslationKeys('goal').self,'message.kaleidoscope_grilling.advancement.goal_self');
 assert.equal(advancementFrameTranslationKeys('challenge').self,'message.kaleidoscope_grilling.advancement.challenge_self');
});

console.log('A2.7.58 challenge advancement core: '+n+'/'+n);
