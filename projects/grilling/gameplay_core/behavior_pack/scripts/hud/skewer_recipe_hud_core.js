function itemTranslationKey(id){
 const value=String(id??'');
 const split=value.indexOf(':');
 if(split<0)return 'item.'+value+'.name';
 const ns=value.slice(0,split),path=value.slice(split+1);
 return ns==='minecraft'?'item.'+path+'.name':'item.'+ns+':'+path+'.name';
}

export function skewerRecipeHudView(snapshot){
 if(!snapshot||typeof snapshot.resultId!=='string'||!snapshot.resultId)return undefined;
 const slots=Array.isArray(snapshot.ingredientSlots)?snapshot.ingredientSlots:[];
 const ingredients=slots.map(slot=>Array.isArray(slot)?String(slot[0]??''):'').filter(Boolean).slice(0,3);
 const rawtext=[
  {text:'§6'},
  {translate:'jade.kaleidoscope_grilling.skewer_recipe.record'},
  {text:' §f'},
  {translate:itemTranslationKey(snapshot.resultId)}
 ];
 if(ingredients.length){
  rawtext.push(
   {text:'§r §8| §7'},
   {translate:'jade.kaleidoscope_grilling.skewer_recipe.ingredients'},
   {text:' §f'}
  );
  ingredients.forEach((id,index)=>{
   if(index)rawtext.push({text:' §8+ §f'});
   rawtext.push({translate:itemTranslationKey(id)});
  });
 }
 rawtext.push(
  {text:'§r §8| §7'},
  {translate:'tooltip.kaleidoscope_grilling.recipe_book.wall_usage'}
 );
 return {
  signature:['skewer_recipe',snapshot.resultId,...ingredients].join(':'),
  resultId:snapshot.resultId,ingredients,
  message:{rawtext}
 };
}

export {itemTranslationKey};
