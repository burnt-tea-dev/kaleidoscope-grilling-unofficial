import assert from 'node:assert/strict';
import {itemTranslationKey,skewerRecipeHudView} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2745_skewer_recipe_hud_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Bedrock translation keys use vanilla and namespaced forms',()=>{
 assert.equal(itemTranslationKey('minecraft:golden_apple'),'item.golden_apple.name');
 assert.equal(itemTranslationKey('kaleidoscope_grilling:raw_golden_skewer'),'item.kaleidoscope_grilling:raw_golden_skewer.name');
 assert.equal(itemTranslationKey('kaleidoscope_cookery:raw_lamb_chops'),'item.kaleidoscope_cookery:raw_lamb_chops.name');
});

t('missing recipe produces no HUD',()=>{
 assert.equal(skewerRecipeHudView(null),undefined);
 assert.equal(skewerRecipeHudView({resultId:''}),undefined);
});

t('fixed recipe shows recorded result, ingredients and wall usage',()=>{
 const v=skewerRecipeHudView({
  resultId:'kaleidoscope_grilling:raw_golden_skewer',
  ingredientSlots:[
   ['minecraft:golden_apple'],
   ['minecraft:totem_of_undying'],
   ['minecraft:golden_carrot']
  ]
 });
 assert.equal(v.resultId,'kaleidoscope_grilling:raw_golden_skewer');
 assert.deepEqual(v.ingredients,['minecraft:golden_apple','minecraft:totem_of_undying','minecraft:golden_carrot']);
 assert.equal(v.message.rawtext[1].translate,'jade.kaleidoscope_grilling.skewer_recipe.record');
 assert.equal(v.message.rawtext[3].translate,'item.kaleidoscope_grilling:raw_golden_skewer.name');
 assert.equal(v.message.rawtext.at(-1).translate,'tooltip.kaleidoscope_grilling.recipe_book.wall_usage');
});

t('secret recipe uses the existing custom ingredient slots',()=>{
 const v=skewerRecipeHudView({
  resultId:'kaleidoscope_grilling:secret_skewer',
  ingredientSlots:[['minecraft:apple'],['minecraft:carrot'],['minecraft:potato']]
 });
 assert.deepEqual(v.ingredients,['minecraft:apple','minecraft:carrot','minecraft:potato']);
 assert.equal(v.message.rawtext.some(x=>x.translate==='jade.kaleidoscope_grilling.skewer_recipe.ingredients'),true);
});

t('recipe or ingredient changes refresh signature',()=>{
 const a=skewerRecipeHudView({resultId:'test:a',ingredientSlots:[['minecraft:apple']]});
 const b=skewerRecipeHudView({resultId:'test:b',ingredientSlots:[['minecraft:apple']]});
 const c=skewerRecipeHudView({resultId:'test:b',ingredientSlots:[['minecraft:carrot']]});
 assert.notEqual(a.signature,b.signature);
 assert.notEqual(b.signature,c.signature);
});

console.log('A2.7.45 Skewer Recipe HUD core: '+n+'/'+n);
