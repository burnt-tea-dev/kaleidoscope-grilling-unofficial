import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBoardRegistry,executeBoardOperation,recoverBoardOperation,sampleBoardOutputs,normalizeBoardV2Recipe} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/board_api_core.js';
import {BOARD_V2_RECIPES,recipesForReady} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2727_cookery_host_recipes_core.js';
import {appendOutcome,isConfiguredIngredient} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js';
import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const recipes=BOARD_V2_RECIPES.map(normalizeBoardV2Recipe);
const author=JSON.parse(fs.readFileSync(new URL('fixtures/cookery161-skewer-input-contract.json',import.meta.url),'utf8'));
test('current registrations select exact Cookery 1.6.1 producer declarations',()=>{
 const registry=createBoardRegistry();for(const payload of BOARD_V2_RECIPES)assert.equal(registry.register(payload).ok,true);
 assert.deepEqual(Object.entries(author.board_recipes).map(([input,builtin])=>[input,!!registry.select(input,builtin)]),[['minecraft:beef',true],['minecraft:chicken',true]]);
 const chicken=registry.select('minecraft:chicken',author.board_recipes['minecraft:chicken']);
 assert.deepEqual(sampleBoardOutputs(chicken,()=>0),[{id:'kaleidoscope_cookery:raw_cut_small_meats',count:3},{id:'minecraft:bone',count:1},{id:'kaleidoscope_grilling:chicken_skin',count:1}]);
});
test('multi-output baseline rejects a changed or omitted author product',()=>{
 const registry=createBoardRegistry();registry.register(BOARD_V2_RECIPES[1]);
 const baseline=author.board_recipes['minecraft:chicken'];
 for(const outputs of [baseline.outputs.slice(0,1),[baseline.outputs[0],{id:'minecraft:bone',count:2}],[baseline.outputs[0],{id:'minecraft:bone',count:1,chance:.5}],[...baseline.outputs].reverse()])assert.equal(registry.select('minecraft:chicken',{outputs,cuts:4}),undefined);
 for(const builtin of [{outputs:[],cuts:4},{outputs:[{id:'minecraft:bone',count:0}],cuts:4},{...baseline,result:'minecraft:bone',count:1}]){
  const payload=copy(BOARD_V2_RECIPES[1]);payload.recipe.builtin=builtin;assert.equal(normalizeBoardV2Recipe(payload),undefined);
 }
});
test('all ten author ingredient IDs retain their exact recipe identity without native-profile aliases',()=>{
 assert.equal(author.skewer_ingredients.length,10);
 for(const row of author.skewer_ingredients){assert.equal(canonicalFoodId(row.id),row.id);assert.equal(isConfiguredIngredient(row),true,row.id)}
});
function stack(id,amount=1){return {typeId:id,amount,damage:0,name:'custom',lore:['foreign lore'],clone(){return {...this,lore:[...this.lore]}}}}
function fixture(recipe=recipes[0]){
 let state={},receipt,held=stack(recipe.input,2),deliveries=[],calls=0;const faults={};
 function fail(key){if(faults[key]){faults[key]--;throw Error(key)}}
 const io={creative:false,sneaking:false,readState:()=>copy(state),writeState:s=>{fail('state');state=copy(s)},readReceipt:()=>receipt,writeReceipt:r=>{fail('receipt');receipt=copy(r);fail('receiptAfter')},readHeld:()=>held,writeHeld:s=>{fail('hand');held=s?.clone()},newOperationId:()=>String(++calls),snapshot:s=>({id:s.typeId,count:1,name:s.name,lore:copy(s.lore)}),isKnife:s=>s?.typeId==='qa:knife',damagePlan:s=>{const n=s.clone();n.damage++;return {mutate:true,next:n}},deliver(row){fail('deliver');const r=copy(row);deliveries.push(r);return {acknowledged:true,undo(){fail('undo');deliveries.splice(deliveries.indexOf(r),1)}}},sound:()=>fail('effect'),particles:()=>fail('effect'),notice(){},quarantine(s){state=copy(s);state.boardV2.phase='quarantined';receipt={phase:'quarantined'}}};
 return {io,faults,get state(){return copy(state)},get receipt(){return receipt},get held(){return held},get deliveries(){return deliveries},knife(){held=stack('qa:knife')},run(random=()=>0){executeBoardOperation(io,recipe,{random})},prepare(){this.run();this.knife();for(let i=0;i<4;i++)this.run()}};
}
test('capability-gated recipes retain immutable author baselines',()=>{const r=createBoardRegistry();for(let i=0;i<2;i++){assert.equal(r.register(BOARD_V2_RECIPES[i]).ok,true);assert.deepEqual(r.select(recipes[i].input,recipes[i].builtin),recipes[i]);assert.equal(r.select(recipes[i].input,{...recipes[i].builtin,cuts:3}),undefined)}assert.equal(recipesForReady({api:1,capabilities:['chopping_board']}).filter(x=>x.kind==='chopping_board_v2').length,0);assert.equal(recipesForReady({api:1,capabilities:['chopping_board_v2']}).length,2)});
test('conflicting registrants fail closed independently of arrival order',()=>{for(const reversed of [false,true]){const r=createBoardRegistry(),a=copy(BOARD_V2_RECIPES[0]),b=copy(a);b.recipe.count=3;for(const p of reversed?[b,a]:[a,b])r.register(p);assert.equal(r.select(a.recipe.input,a.recipe.builtin),undefined);assert.equal(r.register(a).ok,false)}});
test('malformed recipe rejected',()=>{for(const field of ['input','builtin','mode','bonusOutputs']){const p=copy(BOARD_V2_RECIPES[1]);p.recipe[field]=null;assert.equal(normalizeBoardV2Recipe(p),undefined)}});
for(const [i,r] of recipes.entries())test('four native-style cuts and fifth release: '+r.input,()=>{const f=fixture(r);f.prepare();assert.equal(f.state.cuts,4);assert.equal(f.deliveries.length,0);assert.equal(f.held.damage,4);f.run(()=>.9999);assert.deepEqual(f.deliveries,sampleBoardOutputs(r,()=>.9999));assert.equal(f.held.damage,4);assert.deepEqual(f.state,{});assert.equal(f.receipt.phase,'committed');f.run();assert.equal(f.deliveries.length,i===0?1:3)});
for(const [n,random] of [[1,0],[2,.5],[3,.999]])test('additive chicken skin '+n,()=>{const f=fixture(recipes[1]);f.prepare();f.run(()=>random);assert.deepEqual(f.deliveries,[{id:'kaleidoscope_cookery:raw_cut_small_meats',count:3},{id:'minecraft:bone',count:1},{id:'kaleidoscope_grilling:chicken_skin',count:n}])});
test('actual registered board outputs feed the ordered beef and two-skin skewer recipes',()=>{
 const beef=fixture(recipes[0]);beef.prepare();beef.run();const chunks=beef.deliveries[0],chili=author.skewer_ingredients.find(row=>row.id==='kaleidoscope_cookery:red_chili');
 assert.equal(chunks.count,2);assert.equal(appendOutcome([chunks,chili],chunks).id,'kaleidoscope_grilling:raw_beef_skewer');
 const chicken=fixture(recipes[1]);chicken.prepare();chicken.run(()=>.5);const skin=chicken.deliveries.find(row=>row.id==='kaleidoscope_grilling:chicken_skin');
 assert.equal(skin.count,2);assert.equal(appendOutcome([skin],skin).id,'kaleidoscope_grilling:raw_chicken_skin_skewer');
});
test('legacy single-output saved board operations keep their recorded contract after reload',()=>{
 const legacy=copy(BOARD_V2_RECIPES[1]);legacy.recipe.builtin={result:'kaleidoscope_cookery:raw_cut_small_meats',count:2,cuts:4};
 const saved=normalizeBoardV2Recipe(legacy),f=fixture(saved);assert.equal(saved.apiVersion,'0.1.0');assert.equal(saved.outputs,undefined);
 f.prepare();f.run(()=>.5);assert.deepEqual(f.deliveries,[{id:'kaleidoscope_cookery:raw_cut_small_meats',count:2},{id:'kaleidoscope_grilling:chicken_skin',count:2}]);
 assert.equal(f.receipt.phase,'committed');f.run();assert.equal(f.deliveries.length,2);
});
for(const route of ['cancel','break','explosion'])test(route+' returns original metadata with no skin',()=>{const f=fixture(recipes[1]);f.prepare();if(route==='cancel'){f.io.sneaking=true;f.run()}else recoverBoardOperation(f.io,f.state);assert.deepEqual(f.deliveries,[{id:recipes[1].input,count:1,name:'custom',lore:['foreign lore']}])});
test('placement write failure leaves input untouched',()=>{for(const k of ['state','hand']){const f=fixture();f.faults[k]=1;f.run();assert.equal(f.held.amount,2);assert.deepEqual(f.state,{})}});
test('cut rollback restores hand and progress',()=>{const f=fixture();f.run();f.knife();f.faults.hand=1;f.run();assert.equal(f.held.damage,0);assert.equal(f.state.cuts,0)});
test('effects cannot roll back a committed input or output',()=>{const f=fixture();f.faults.effect=20;f.prepare();f.run();assert.equal(f.deliveries.length,1);assert.equal(f.receipt.phase,'committed')});
for(const failAt of [2,3])test('known delivery failure at product '+failAt+' retries the same random plan',()=>{const f=fixture(recipes[1]);f.prepare();const original=f.io.deliver;let n=0;f.io.deliver=(...a)=>{if(++n===failAt){const e=Error('known failure');e.uncertain=false;throw e}return original(...a)};f.run(()=>.999);assert.equal(f.deliveries.length,0);f.io.deliver=original;f.run(()=>0);assert.deepEqual(f.deliveries,sampleBoardOutputs(recipes[1],()=>.999))});
test('unknown native delivery quarantines, preventing duplication',()=>{const f=fixture();f.prepare();f.faults.deliver=1;f.run();f.run();assert.equal(f.receipt.phase,'quarantined');assert.equal(f.deliveries.length,0)});
test('receipt failure rolls back acknowledged drops',()=>{const f=fixture();f.prepare();f.faults.receipt=1;f.run();assert.equal(f.deliveries.length,0);f.run();assert.equal(f.deliveries.length,1)});
test('receipt write throwing after mutation still commits exactly once',()=>{const f=fixture();f.prepare();f.faults.receiptAfter=1;f.run();f.run();assert.equal(f.deliveries.length,1);assert.equal(f.receipt.phase,'committed')});
test('save/reload committed state cannot refund on destruction',()=>{const f=fixture();f.prepare();const before=f.state;f.run();recoverBoardOperation(f.io,before);assert.equal(f.deliveries.length,1)});
test('save/reload halfway resumes exact cut count',()=>{const f=fixture();f.run();f.knife();f.run();const state=copy(f.state);assert.equal(state.cuts,1);for(let i=0;i<3;i++)f.run();f.run();assert.equal(f.held.damage,4);assert.equal(f.deliveries.length,1)});
test('creative placement never refunds an undebited ingredient',()=>{const f=fixture();f.io.creative=true;f.run();assert.equal(f.held.amount,2);f.io.sneaking=true;f.run();assert.equal(f.deliveries.length,0)});
