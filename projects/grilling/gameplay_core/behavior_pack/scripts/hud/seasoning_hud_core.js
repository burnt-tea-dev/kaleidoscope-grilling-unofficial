import {
 BASE_SEASONINGS,SEASONING_CAPACITY,SEASONING_MAX_USES,
 normalizeBottleData,remainingSeasoningUses,seasoningEffectRows
} from '../seasoning/seasoning_contract_core.js';

const BASE_KEYS=Object.freeze({
 'kaleidoscope_grilling:green_chili_powder':'hud.kaleidoscope_grilling.seasoning.base.green_chili',
 'kaleidoscope_grilling:sichuan_pepper':'hud.kaleidoscope_grilling.seasoning.base.sichuan_pepper',
 'kaleidoscope_grilling:onion_powder':'hud.kaleidoscope_grilling.seasoning.base.onion'
});

function countIngredients(values){
 const counts=new Map();
 for(const id of values)counts.set(id,(counts.get(id)??0)+1);
 return counts;
}

function effectMessage(row){
 if(row.kind==='numbness'&&!row.active)
  return {translate:'hud.kaleidoscope_grilling.seasoning.numbness_pending',with:[String(row.count)]};
 return {translate:'hud.kaleidoscope_grilling.seasoning.'+row.kind,with:[String(row.count)]};
}

export function seasoningHudView(row={}){
 const data=normalizeBottleData(row),ingredients=data.ingredients;
 const counts=countIngredients(ingredients),remaining=Math.max(0,SEASONING_CAPACITY-ingredients.length);
 const effects=seasoningEffectRows(ingredients);
 const rawtext=[
  {text:'§6'},
  {translate:'hud.kaleidoscope_grilling.seasoning.title'},
  {text:'§r §8| §7'}
 ];
 if(data.kind==='special'){
  rawtext.push({translate:'jade.kaleidoscope_grilling.seasoning.uses',with:[String(remainingSeasoningUses(data))]});
 }else{
  rawtext.push({translate:'hud.kaleidoscope_grilling.seasoning.capacity',with:[String(ingredients.length),String(SEASONING_CAPACITY),String(remaining)]});
 }
 for(const id of BASE_SEASONINGS){
  rawtext.push(
   {text:' §8| §f'},
   {translate:BASE_KEYS[id],with:[String(counts.get(id)??0)]}
  );
 }
 rawtext.push({text:' §8| §e'},{translate:'hud.kaleidoscope_grilling.seasoning.effects'});
 if(!effects.length)rawtext.push({text:' §7'},{translate:'hud.kaleidoscope_grilling.seasoning.no_effect'});
 for(const effect of effects)rawtext.push({text:' §7'},effectMessage(effect));

 return {
  signature:[
   'seasoning',data.kind,ingredients.join(','),data.uses,data.variant,
   SEASONING_MAX_USES
  ].join(':'),
  kind:data.kind,
  ingredients:[...ingredients],
  uses:data.uses,
  remainingUses:remainingSeasoningUses(data),
  variant:data.variant,
  effects,
  message:{rawtext}
 };
}
