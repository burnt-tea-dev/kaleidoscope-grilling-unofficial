import {advancementPropertyKey} from './advancement_core.js';

function spec(id,parent,frame,xp){
 return Object.freeze({
  id,parent,
  propertyKey:advancementPropertyKey(id),
  titleKey:'advancement.kaleidoscope_grilling.'+id+'.title',
  descriptionKey:'advancement.kaleidoscope_grilling.'+id+'.description',
  frame,xp,announce:true,showToast:true,hidden:false
 });
}

export const LOOKING_THE_PART=spec('looking_the_part','human_fireworks','task',10);
export const GLEAMING_WITH_OIL=spec('gleaming_with_oil','looking_the_part','task',10);
export const THREE_FLAVORS_BASE=spec('three_flavors_base','gleaming_with_oil','task',10);
export const WORLD_IN_A_BOTTLE=spec('world_in_a_bottle','three_flavors_base','goal',25);
export const EAT_IT_HOT=spec('eat_it_hot','gleaming_with_oil','goal',25);
export const NEAT_AND_ORDERLY=spec('neat_and_orderly','better_write_it_down','goal',25);

export const EVENT_ADVANCEMENTS=Object.freeze({
 looking_the_part:LOOKING_THE_PART,
 gleaming_with_oil:GLEAMING_WITH_OIL,
 three_flavors_base:THREE_FLAVORS_BASE,
 world_in_a_bottle:WORLD_IN_A_BOTTLE,
 eat_it_hot:EAT_IT_HOT,
 neat_and_orderly:NEAT_AND_ORDERLY
});

export const REQUIRED_SEASONINGS=Object.freeze([
 'kaleidoscope_grilling:green_chili_powder',
 'kaleidoscope_grilling:sichuan_pepper',
 'kaleidoscope_grilling:onion_powder'
]);

export function threadingCompletedForAdvancement(outcome){
 const kind=String(outcome?.kind??'');
 return kind==='fixed'||kind==='secret';
}

export function seasoningAdvancementIds(ingredients=[]){
 const list=Array.isArray(ingredients)?ingredients.map(String):[];
 const out=[];
 if(REQUIRED_SEASONINGS.every(id=>list.includes(id)))out.push('three_flavors_base');
 if(list.length>=8)out.push('world_in_a_bottle');
 return out;
}

export function hotFoodAdvancementEligible(itemId,hot=false){
 if(!hot)return false;
 const id=String(itemId??'');
 return id==='kaleidoscope_grilling:secret_skewer'
  ||id.startsWith('kaleidoscope_grilling:grilled_');
}
