/** Pure Java recipe/state regressions. No Bedrock, player or inventory adapter. */
import assert from 'node:assert/strict';
import * as core from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/pot_api_core.js';
import * as foods from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food/wok_food_core.js';
const exact=foods.wokRecipes(),flex=foods.flexWokRecipes(),pork=exact.find(recipe=>recipe.result===foods.HOUTTUYNIA_PORK_ID);
const data=items=>({oil:true,oilTicks:1200,items:[...items],started:false,grillingOutputEpoch:7,grillingPot:core.newJavaPot(7)});
const step=(state,ticks)=>{for(let i=0;i<ticks;i++)state=core.advanceJavaPot(state).data;return state;};

// The same exact input also matches flex. A complete exact recipe must win.
const selected=core.selectJavaPotRecipe(pork.ingredients,exact,flex,exact);
assert.equal(selected.kind,'exact');assert.equal(selected.recipe.count,1);
assert.equal(core.matchesJavaPot([...pork.ingredients,'minecraft:stick'],pork),false);
const ratio=['kaleidoscope_grilling:houttuynia',...Array(8).fill('minecraft:porkchop')];
const freer=core.selectJavaPotRecipe(ratio,exact,flex,exact);
assert.equal(freer.kind,'flex');assert.equal(freer.recipe.count,1);
assert.equal(freer.recipe.javaId,'kaleidoscope_grilling:flex_pot/houttuynia_stir_fried_pork');
const alternatives={ingredients:[['qa:a','qa:b'],['qa:c']]};
assert.equal(core.matchesJavaPot(['qa:a','qa:a','qa:c'],alternatives,{flex:true}),true);
assert.equal(core.matchesJavaPot(['qa:a','qa:b','qa:c'],alternatives,{flex:true}),false);
assert.equal(core.matchesJavaPot(['qa:a','qa:b'],{ingredients:[['qa:a','qa:b'],['qa:a']]}),true);
const foreign={id:'external:exact',ingredients:ratio,result:'external:dish',count:2,time:400,carrier:'minecraft:bowl'};
assert.equal(core.selectJavaPotRecipe(ratio,exact,flex,[foreign,...exact]).kind,'legacy');

// Preparation expires with ingredients present; its clock does not become a
// freshly reset cooking clock every time the ingredient list is saved.
let preparing=step(data(pork.ingredients),1199);
assert.equal(preparing.grillingPot.phase,'preparing');assert.equal(preparing.grillingPot.ticksRemaining,1);
assert.equal(core.advanceJavaPot(preparing).action,'start');
assert.equal(core.advanceJavaPot(step(data([]),1199)).action,'reset');
const edit=core.reviseJavaPot(preparing);edit.items.pop();
assert.equal(edit.grillingPot.ticksRemaining,1);

// The first shovel both starts cooking and removes one of three required stirs.
let cooking=core.stirJavaPot(core.startJavaPot(data(pork.ingredients),selected));
assert.equal(cooking.grillingPot.ticksRemaining,200);assert.equal(cooking.grillingPot.stirsRemaining,2);
cooking=core.stirJavaPot(core.stirJavaPot(cooking));
assert.equal(cooking.grillingPot.stirsRemaining,0);assert.equal(cooking.grillingPot.quality,undefined);
const nearly=step(cooking,199);assert.equal(nearly.grillingPot.phase,'cooking');assert.equal(nearly.result,undefined);
let finished=core.advanceJavaPot(nearly).data;assert.equal(finished.result.id,pork.result);assert.equal(finished.grillingPot.ticksRemaining,800);
assert.equal(step(finished,799).grillingPot.phase,'finished');
const burnt=core.advanceJavaPot(step(finished,799)).data;
assert.equal(burnt.grillingPot.phase,'burnt');assert.equal(burnt.result.id,core.JAVA_POT_DARK);assert.equal(burnt.grillingPot.ticksRemaining,400);
assert.equal(core.advanceJavaPot(step(burnt,399)).action,'burnout');

const short=step(core.stirJavaPot(core.startJavaPot(data(ratio),freer,0)),200);
assert.equal(short.result.id,core.JAVA_POT_SUSPICIOUS);assert.equal(short.grillingPot.quality,undefined);assert.equal(short.grillingPot.phase,'finished');
let quality=core.startJavaPot(data(ratio),freer,3);
quality=core.stirJavaPot(core.stirJavaPot(core.stirJavaPot(quality)));
quality=JSON.parse(JSON.stringify(step(quality,200)));assert.equal(core.readJavaPot(quality).quality,3);
assert.equal(quality.result.count,1);assert.equal(core.paddedPotInputs(ratio).length,9);
assert.throws(()=>core.startJavaPot(data(ratio),freer,undefined),/quality unavailable/);
assert.throws(()=>core.readJavaPot({...quality,grillingOutputEpoch:8}),/saved state invalid/);
assert.throws(()=>core.readJavaPot({...quality,grillingPot:{...quality.grillingPot,version:2}}),/saved state invalid/);
console.log('Java pot pure exact/flex, phase edges, saved quality and invalid ownership contracts PASS');
