import {advancementPropertyKey} from './advancement_core.js';
import {WEDDING_CANDY_XP} from '../food/wedding_candy_core.js';

function spec(id,parent,frame,xp,{hidden=false}={}){
 return Object.freeze({
  id,parent,
  propertyKey:advancementPropertyKey(id),
  titleKey:'advancement.kaleidoscope_grilling.'+id+'.title',
  descriptionKey:'advancement.kaleidoscope_grilling.'+id+'.description',
  frame,xp,announce:true,showToast:true,hidden
 });
}

export const MENTAL_PREPARATION_FAILED=spec('mental_preparation_failed','looking_the_part','challenge',50);
export const METALLIC_TASTE=spec('metallic_taste','world_in_a_bottle','goal',25);
export const TASTE_OF_DRAGON=spec('taste_of_dragon','world_in_a_bottle','goal',25);
export const METAL_TOLERANCE_FAILED=spec('metal_tolerance_failed','metallic_taste','challenge',50);
export const STRONGEST_SHIELD=spec('strongest_shield','fireworks_feast','challenge',50);
export const STRONGEST_SPEAR=spec('strongest_spear','fireworks_feast','challenge',50);
export const WEDDING_CANDY=spec('wedding_candy','human_fireworks','challenge',WEDDING_CANDY_XP,{hidden:true});

export const CHALLENGE_ADVANCEMENTS=Object.freeze({
 mental_preparation_failed:MENTAL_PREPARATION_FAILED,
 metallic_taste:METALLIC_TASTE,
 taste_of_dragon:TASTE_OF_DRAGON,
 metal_tolerance_failed:METAL_TOLERANCE_FAILED,
 strongest_shield:STRONGEST_SHIELD,
 strongest_spear:STRONGEST_SPEAR,
 wedding_candy:WEDDING_CANDY
});

export function seasoningFinishedAdvancementIds(ingredients=[]){
 const list=Array.isArray(ingredients)?ingredients.map(String):[];
 const out=[];
 if(list.includes('kaleidoscope_grilling:totem_powder'))out.push('metallic_taste');
 if(list.includes('kaleidoscope_grilling:dragon_egg_powder'))out.push('taste_of_dragon');
 return out;
}

export function mentalPreparationFailedEligible(itemId){
 return String(itemId??'')==='kaleidoscope_grilling:raw_caterpillar_skewer';
}

export function heavyMetalBlockedEligible(totemCount,poisoned){
 return Number(totemCount)>0&&!!poisoned;
}

export function ordinaryChallengeOutcome(challenged,random01){
 if(!challenged)return 'none';
 const n=Number(random01);
 return (Number.isFinite(n)?n:1)<0.5?'shield':'spear';
}

export function advancementFrameTranslationKeys(frame){
 const f=frame==='challenge'?'challenge':frame==='goal'?'goal':'task';
 return Object.freeze({
  announce:'message.kaleidoscope_grilling.advancement.'+f+'_announce',
  self:'message.kaleidoscope_grilling.advancement.'+f+'_self'
 });
}
