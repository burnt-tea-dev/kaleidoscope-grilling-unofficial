export const ADVANCEMENT_PREFIX='kaleidoscope_grilling:adv_';

export const MOUNTAIN_FRAGRANCE=Object.freeze({
 id:'mountain_fragrance',
 parent:'human_fireworks',
 propertyKey:ADVANCEMENT_PREFIX+'mountain_fragrance',
 titleKey:'advancement.kaleidoscope_grilling.mountain_fragrance.title',
 descriptionKey:'advancement.kaleidoscope_grilling.mountain_fragrance.description',
 frame:'goal',
 xp:25,
 announce:true,
 showToast:true,
 hidden:false
});

export function advancementPropertyKey(id){
 return ADVANCEMENT_PREFIX+String(id??'').replace(/[^a-z0-9_]/gi,'_').toLowerCase();
}

export function advancementAwardPlan(spec,alreadyAwarded=false){
 if(!spec||alreadyAwarded)return Object.freeze({grant:false,xp:0,announce:false});
 return Object.freeze({
  grant:true,
  propertyKey:String(spec.propertyKey??advancementPropertyKey(spec.id)),
  xp:Math.max(0,Math.floor(Number(spec.xp)||0)),
  announce:spec.announce!==false,
  titleKey:String(spec.titleKey??''),
  descriptionKey:String(spec.descriptionKey??''),
  frame:String(spec.frame??'task')
 });
}
