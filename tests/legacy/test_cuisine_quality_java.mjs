// Observations from unchanged pinned author Java code, not a JS formula oracle.
// Pure data only: no player, world, host interaction or client.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {evaluateCuisineQuality,cuisineRecipeRatios,cuisineRecipeSeed,javaResourceLocationHash,cuisineQualityFoodSpec}
 from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/cuisine_quality_core.js';

const vectors=JSON.parse(fs.readFileSync(new URL('./fixtures/java-cuisine-quality-160.json',import.meta.url),'utf8'));
let observed=0;
for(const group of vectors.cases){
 assert.equal(javaResourceLocationHash(group.recipeId),group.javaResourceHash);
 assert.equal(String(cuisineRecipeSeed(group.worldSeed,group.recipeId)),group.javaRecipeSeed);
 assert.deepEqual(cuisineRecipeRatios(group.worldSeed,group.recipeId,group.ingredients.length),group.ratios);
 for(const row of group.observations){
  const counts=row.slice(0,-1),quality=row.at(-1),inputs=counts.flatMap((n,i)=>Array(n).fill(group.ingredients[i][0]));
  while(inputs.length<9)inputs.push('');
  assert.equal(evaluateCuisineQuality({worldSeed:group.worldSeed,recipeId:group.recipeId,ingredients:group.ingredients,inputs}),quality,
   JSON.stringify({worldSeed:group.worldSeed,recipeId:group.recipeId,counts}));
  observed++;
 }
}
assert.equal(observed,vectors.quality_observations);
for(const row of vectors.neoforge_nutrition){
 const actual=cuisineQualityFoodSpec(row.baseId,row.quality);
 assert.equal(actual.nutrition,row.nutrition);assert.equal(actual.saturationGain,row.saturationGain);
}
// An unreadable or rounded seed cannot become another world's quality result.
const sample=vectors.cases[0],inputs=sample.ingredients.map(slot=>slot[0]);while(inputs.length<9)inputs.push('');
for(const worldSeed of [undefined,0,'9223372036854775808','-9223372036854775809','1.5']){
 assert.equal(evaluateCuisineQuality({worldSeed,recipeId:sample.recipeId,ingredients:sample.ingredients,inputs}),undefined);
}
assert.equal(cuisineQualityFoodSpec(vectors.neoforge_nutrition[0].baseId),undefined,'Exact food must not acquire implicit STANDARD quality');
console.log(`Java cuisine quality PASS: ${observed} author observations and ${vectors.neoforge_nutrition.length} NeoForge food values; native/client separate`);
