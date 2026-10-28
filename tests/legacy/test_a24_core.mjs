import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  UNFINISHED_ID,SECRET_ID,FAT_CAPACITY,FLUID_CAPACITY,OIL_BUCKET_POINTS,
  recipeTable,completedRecipe,canAppendConfigured,expectedSize,appendOutcome,secretFood,oilPotCapacity,clampOilCount,canFillTypedOil,
  isDisassemblableRaw
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer/skewering_core.js';

// The expected slots come from the pinned Java data, independently of the
// Bedrock table. Native storage/client rendering are covered separately.
const javaData=new URL('../../data/java/',import.meta.url);
const recipes=JSON.parse(fs.readFileSync(new URL('recipes.json',javaData),'utf8')).resources;
const tags=JSON.parse(fs.readFileSync(new URL('tags.json',javaData),'utf8')).resources;
const javaRecipes=recipes['common/src/main/resources/data/kaleidoscope_grilling/grilling/skewers.json'].data.skewers.filter(r=>r.ingredients.length);
function javaSelectorRows(selector){
 if(!selector.startsWith('#'))return [{id:selector,tags:[]}];
 const tag=selector.slice(1),[ns,path]=tag.split(':');
 return tags[`common/src/main/resources/data/${ns}/tags/items/${path}.json`].data.values.map(id=>({id,tags:[tag]}));
}
function combinations(slots){return slots.reduce((rows,slot)=>rows.flatMap(row=>slot.map(value=>[...row,value])),[[]]);}
function javaMatches(recipe,rows){return rows.length<=recipe.ingredients.length&&rows.every((row,i)=>recipe.ingredients[i].some(selector=>selector.startsWith('#')?row.tags.includes(selector.slice(1)):row.id===selector));}

let n=0;
const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('ships all 20 Java configured skewer recipes',()=>assert.equal(recipeTable().length,20));
t('all pinned Java selectors and alternatives resolve the same ordered result',()=>{
 assert.deepEqual(recipeTable().map(r=>r.id),javaRecipes.map(r=>r.id));
 for(const recipe of javaRecipes){
  const slots=recipe.ingredients.map(slot=>slot.flatMap(javaSelectorRows));
  for(const rows of combinations(slots)){
   assert.equal(completedRecipe(rows)?.id,recipe.id,JSON.stringify(rows));
   assert.equal(completedRecipe(rows)?.cooked??null,recipe.cooked_result??null);
   assert.equal(canAppendConfigured(rows.slice(0,-1),rows.at(-1)),true);
   assert.equal(appendOutcome(rows.slice(0,-1),rows.at(-1),true).id,recipe.id);
   const reversed=[rows.at(-1),...rows.slice(0,-1)];
   const expected=javaRecipes.find(r=>r.ingredients.length===reversed.length&&javaMatches(r,reversed));
   assert.equal(completedRecipe(reversed)?.id,expected?.id,'ordered '+JSON.stringify(reversed));
  }
 }
});
t('expected ingredient count follows the longest Java prefix, including one- and two-slot recipes',()=>{
 for(const recipe of javaRecipes){
  const rows=recipe.ingredients.map(slot=>javaSelectorRows(slot[0])[0]);
  for(let count=0;count<=rows.length;count++){
   const prefix=rows.slice(0,count),sizes=javaRecipes.filter(r=>javaMatches(r,prefix)).map(r=>r.ingredients.length);
   assert.equal(expectedSize(prefix),sizes.length?Math.max(...sizes):3,recipe.id+' at '+count);
  }
 }
 assert.equal(expectedSize([{id:'minecraft:apple',tags:[]}]),3);
});
t('fixed beef recipe resolves exactly',()=>{
  const r=completedRecipe(['kaleidoscope_grilling:beef_chunks','kaleidoscope_cookery:red_chili','kaleidoscope_grilling:beef_chunks']);
  assert.equal(r?.id,'kaleidoscope_grilling:raw_beef_skewer');
});
t('fish alternatives resolve the one-slot fish skewer',()=>{
  for(const id of ['minecraft:cod','minecraft:salmon','minecraft:tropical_fish','minecraft:pufferfish'])
    assert.equal(appendOutcome([],id,true).id,'kaleidoscope_grilling:raw_fish_skewer');
});
t('ordinary skewer is an exact three-item configured result',()=>{
  const x=appendOutcome([{id:'minecraft:poisonous_potato'},{id:'minecraft:spider_eye'}],'minecraft:pufferfish',true);
  assert.deepEqual({ok:x.ok,kind:x.kind,id:x.id},{ok:true,kind:'fixed',id:'kaleidoscope_grilling:ordinary_skewer'});
});
t('unmatched edible ingredients become unfinished then secret',()=>{
  const a=appendOutcome([],'minecraft:apple',true);
  const b=appendOutcome([{id:'minecraft:apple'}],'minecraft:carrot',true);
  const c=appendOutcome([{id:'minecraft:apple'},{id:'minecraft:carrot'}],'minecraft:bread',true);
  assert.equal(a.id,UNFINISHED_ID);assert.equal(b.id,UNFINISHED_ID);assert.equal(c.id,SECRET_ID);
});
t('non-food non-configured item is rejected',()=>assert.equal(appendOutcome([],'minecraft:cobblestone',false).ok,false));
t('fourth ingredient is rejected',()=>assert.equal(appendOutcome([{id:'minecraft:apple'},{id:'minecraft:carrot'},{id:'minecraft:bread'}],'minecraft:melon_slice',true).ok,false));
t('fixed raw, unfinished and raw secret are disassemblable',()=>{
  assert.equal(isDisassemblableRaw(UNFINISHED_ID),true);
  assert.equal(isDisassemblableRaw('kaleidoscope_grilling:raw_beef_skewer'),true);
  assert.equal(isDisassemblableRaw(SECRET_ID,false),true);
  assert.equal(isDisassemblableRaw(SECRET_ID,true),false);
});
t('secret cooked food uses Java 0.6 coefficient',()=>{
  assert.deepEqual(secretFood([
    {id:'minecraft:apple',nutrition:4,saturation:.3},
    {id:'minecraft:bread',nutrition:5,saturation:.6},
    {id:'minecraft:carrot',nutrition:3,saturation:.6}
  ],true),{nutrition:7,saturation:.5,duplicate:false});
});
t('secret duplicate penalty is Java 0.6 x 0.8',()=>{
  const x=secretFood([
    {id:'minecraft:apple',signature:'apple',nutrition:4,saturation:.3},
    {id:'minecraft:apple',signature:'apple',nutrition:4,saturation:.3},
    {id:'minecraft:bread',signature:'bread',nutrition:5,saturation:.6}
  ],true);
  assert.equal(x.nutrition,6);assert.equal(x.duplicate,true);
});
t('raw secret halves cooked nutrition and saturation',()=>{
  const cooked=secretFood([{id:'a',nutrition:5,saturation:.4},{id:'b',nutrition:5,saturation:.6},{id:'c',nutrition:5,saturation:.8}],true);
  const raw=secretFood([{id:'a',nutrition:5,saturation:.4},{id:'b',nutrition:5,saturation:.6},{id:'c',nutrition:5,saturation:.8}],false);
  assert.equal(cooked.nutrition,9);assert.equal(raw.nutrition,4);assert.equal(raw.saturation,cooked.saturation*.5);
});
t('typed Grilling oils are 64 points while Cookery fat remains 256',()=>{
  assert.equal(FAT_CAPACITY,256);assert.equal(FLUID_CAPACITY,64);assert.equal(OIL_BUCKET_POINTS,8);
  assert.equal(oilPotCapacity(''),256);assert.equal(oilPotCapacity('canola'),64);
  assert.equal(clampOilCount('secret_chili',256),64);
});
t('typed bucket transactions are eight points and stop at 64',()=>{
  assert.equal(canFillTypedOil('',0,'canola',8),true);
  assert.equal(canFillTypedOil('canola',56,'canola',8),true);
  assert.equal(canFillTypedOil('canola',57,'canola',8),false);
  assert.equal(canFillTypedOil('canola',64,'canola',8),false);
});
t('typed oil cannot mix with fat or another fluid oil',()=>{
  assert.equal(canFillTypedOil('',1,'canola',8),false);
  assert.equal(canFillTypedOil('canola',8,'secret_chili',8),false);
});

console.log(JSON.stringify({passed:n,failed:0,scope:'A2.4 Java 1.1.1 threading, Secret Skewer nutrition, and OilPot capacity parity'}));
