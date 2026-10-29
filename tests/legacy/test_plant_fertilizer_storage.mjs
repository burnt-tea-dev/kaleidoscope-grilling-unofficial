/** Production journal helpers with storage values, plus fixture-driven oil-residue plant rules (no client or BDS claim). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {commitSteps} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/grill/grill_transaction_core.js';
import {createOwnedPlantWrite,plantFertilizerSteps} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plant_fertilizer_transaction_core.js';
import {createFixture} from '../helpers/minecraft-fixture.mjs';

const original={id:'kaleidoscope_grilling:oil_residue',amount:3,opaque:{owner:'original',data:[7,11]}};
const paid={...original,amount:2};
const beforePlant={id:'crop',age:0},afterPlant={id:'crop',age:4};
function cell(value){
 const store={value:structuredClone(value),writes:[],fault(){}};
 store.read=()=>structuredClone(store.value);
 store.write=next=>{
  store.fault('before',next);
  store.value=structuredClone(next);store.writes.push(structuredClone(next));
  store.fault('after',next);
 };
 return store;
}
function owned(store,before,after,extra={}){
 return createOwnedPlantWrite({read:store.read,write:store.write,same:isDeepStrictEqual,before,after,...extra});
}
const rejected={apply(){throw Error('later write rejected')},rollback(){}};

test('fertilizer write before/after throw never grows a plant and restores only its exact preimage',()=>{
 for(const when of ['before','after']){
  const cost=cell(original),plant=cell(beforePlant);let once=true;
  cost.fault=phase=>{if(once&&phase===when){once=false;throw Error('native cost write error')}};
  const result=commitSteps(plantFertilizerSteps(owned(cost,original,paid),[owned(plant,beforePlant,afterPlant)]));
  assert.equal(result.ok,false);assert.equal(result.rollbackErrors,0);
  assert.deepEqual(cost.value,original);assert.deepEqual(plant.value,beforePlant);assert.equal(plant.writes.length,0);
 }
});

test('confirmed full rollback refunds exact metadata even when a restore setter throws after writing',()=>{
 const cost=cell(original),plant=cell(beforePlant);
 plant.fault=(phase,value)=>{if(phase==='after'&&isDeepStrictEqual(value,beforePlant))throw Error('restore completed before throw')};
 const result=commitSteps(plantFertilizerSteps(owned(cost,original,paid),[owned(plant,beforePlant,afterPlant),rejected]));
 assert.equal(result.ok,false);assert.equal(result.rollbackErrors,0);
 assert.deepEqual(plant.value,beforePlant);assert.deepEqual(cost.value,original);
 assert.deepEqual(cost.writes,[paid,original]);
});

test('failed plant or drop rollback retains the paid fertilizer instead of refunding an unknown result',()=>{
 for(const kind of ['plant_write','drop_rejected','drop_unknown']){
  const cost=cell(original),plant=cell(beforePlant);let present=false;
  const mutation=kind==='plant_write'?owned(plant,beforePlant,afterPlant):{
   apply(){present=true},
   rollback(){if(kind==='drop_rejected')return false;throw Error('spawn/ownership outcome unknown')}
  };
  if(kind==='plant_write')plant.write=next=>{
   if(isDeepStrictEqual(next,beforePlant))return;
   plant.value=structuredClone(next);
  };
  // Bind the plant writer after installing the silent native restore failure.
  const step=kind==='plant_write'?owned(plant,beforePlant,afterPlant):mutation;
  const result=commitSteps(plantFertilizerSteps(owned(cost,original,paid),[step,rejected]));
  assert.equal(result.ok,false);assert.equal(result.rollbackErrors,2);
  assert.deepEqual(cost.value,paid);assert.deepEqual(cost.writes,[paid]);
  if(kind==='plant_write')assert.deepEqual(plant.value,afterPlant);else assert.equal(present,true);
 }
});

test('a changed owning slot is preserved and cannot be overwritten by fertilizer compensation',()=>{
 const cost=cell(original),plant=cell(beforePlant),replacement={id:'minecraft:diamond',amount:1,opaque:{owner:'another-write'}};
 const changed={apply(){cost.value=structuredClone(replacement);throw Error('changed storage')},rollback(){}};
 const result=commitSteps(plantFertilizerSteps(owned(cost,original,paid),[owned(plant,beforePlant,afterPlant),changed]));
 assert.equal(result.ok,false);assert.equal(result.rollbackErrors,1);
 assert.deepEqual(plant.value,beforePlant);assert.deepEqual(cost.value,replacement);assert.deepEqual(cost.writes,[paid]);
});

test('an unacknowledged fertilizer restore remains paid and is reported for quarantine',()=>{
 const cost=cell(original),plant=cell(beforePlant);
 cost.write=next=>{if(isDeepStrictEqual(next,original))return;cost.value=structuredClone(next)};
 const result=commitSteps(plantFertilizerSteps(owned(cost,original,paid),[owned(plant,beforePlant,afterPlant),rejected]));
 assert.equal(result.ok,false);assert.equal(result.rollbackErrors,1);
 assert.deepEqual(cost.value,paid);assert.deepEqual(plant.value,beforePlant);
});

test('unknown native plant state is neither overwritten by rollback nor used to refund fertilizer',()=>{
 const cost=cell(original),plant=cell(beforePlant),replacement={id:'another:block',age:9};
 plant.fault=(phase,value)=>{if(phase==='after'&&isDeepStrictEqual(value,afterPlant)){plant.value=structuredClone(replacement);throw Error('native state changed')}};
 const result=commitSteps(plantFertilizerSteps(owned(cost,original,paid),[owned(plant,beforePlant,afterPlant)]));
 assert.equal(result.ok,false);assert.equal(result.rollbackErrors,2);
 assert.deepEqual(plant.value,replacement);assert.deepEqual(cost.value,paid);
 assert.deepEqual(plant.writes,[afterPlant]);
});

test('a matching debit that predates this attempt is not claimed and refunded',()=>{
 const cost=cell(paid),plant=cell(beforePlant);
 const result=commitSteps(plantFertilizerSteps(owned(cost,original,paid),[owned(plant,beforePlant,afterPlant)]));
 assert.equal(result.ok,false);assert.equal(result.rollbackErrors,1);
 assert.deepEqual(cost.value,paid);assert.equal(cost.writes.length,0);
 assert.deepEqual(plant.value,beforePlant);assert.equal(plant.writes.length,0);
});

// --- Java BonemealableBlock rules for beetroot, bamboo and kelp through the
// canonical module and the fixture's native boundary (permutation, liquid
// layer, equipment slot). Each oil-residue use runs the handler twice.
const OIL='kaleidoscope_grilling:oil_residue';
const BAMBOO_STATES=(leaf,thick='thin')=>({age_bit:false,bamboo_leaf_size:leaf,bamboo_stalk_thickness:thick});
async function fertilizerWorld(){const f=createFixture();const api=await f.load('plant_fertilizer.js');return {f,api};}
function withRandom(values,fn){
 const native=Math.random;let i=0;Math.random=()=>values[Math.min(i++,values.length-1)];
 try{return fn()}finally{Math.random=native}
}
function use(f,api,block,{amount=3,random=[0.9]}={}){
 const player=f.player({main:f.item(OIL,amount)});
 const ok=withRandom(random,()=>api.usePlantFertilizer(block,player));
 return {ok,left:player.main?.amount??0,player};
}
const at=(f,y,x=0)=>f.dimension.getBlock({x,y,z:0});

test('beetroot advances Java ages through Bedrock growth values, keeps intermediate values on a zero roll and refuses maturity',async()=>{
 const {f,api}=await fertilizerWorld();
 const crop=f.block('minecraft:beetroot',{x:0,y:0,z:0},{states:{growth:1}});
 // CropBlock roll 5 → 5/3 = 1 per pass: age 0 → 2 (growth 1 → 4).
 let r=use(f,api,crop,{random:[0.9]});
 assert.equal(r.ok,true);assert.equal(r.left,2);assert.equal(crop.permutation.getState('growth'),4);
 // Roll 2 → 2/3 = 0 on both passes: Java still consumes the item.
 r=use(f,api,crop,{random:[0]});
 assert.equal(r.ok,true);assert.equal(r.left,2);assert.equal(crop.permutation.getState('growth'),4);
 // Roll 4 → 1: age 2 → 3 (growth 7); the second pass sees maturity and is invalid.
 r=use(f,api,crop,{random:[0.6]});
 assert.equal(r.ok,true);assert.equal(r.left,2);assert.equal(crop.permutation.getState('growth'),7);
 r=use(f,api,crop);
 assert.equal(r.ok,false);assert.equal(r.left,3);
 const odd=f.block('minecraft:beetroot',{x:1,y:0,z:0},{states:{growth:5}});
 r=use(f,api,odd,{random:[0.6,0]});
 assert.equal(r.ok,true);assert.equal(odd.permutation.getState('growth'),7);
});

test('bamboo shoot grows exactly one thin small-leaved stalk and keeps the shoot',async()=>{
 const {f,api}=await fertilizerWorld();
 const shoot=f.block('minecraft:bamboo_sapling',{x:0,y:0,z:0},{states:{age_bit:false}});
 const r=use(f,api,shoot);
 assert.equal(r.ok,true);assert.equal(r.left,2);
 assert.equal(shoot.typeId,'minecraft:bamboo_sapling');
 assert.deepEqual([at(f,1).typeId,at(f,1).permutation.getAllStates()],['minecraft:bamboo',BAMBOO_STATES('small_leaves')]);
 assert.equal(at(f,2).typeId,'minecraft:air');
 assert.equal(use(f,api,shoot).ok,false);
});

test('bamboo grows from the column top, hands leaves down and thickens exactly like growBamboo',async()=>{
 const {f,api}=await fertilizerWorld();
 const base=f.block('minecraft:bamboo',{x:0,y:0,z:0},{states:BAMBOO_STATES('no_leaves')});
 f.block('minecraft:bamboo',{x:0,y:1,z:0},{states:BAMBOO_STATES('small_leaves')});
 f.block('minecraft:bamboo',{x:0,y:2,z:0},{states:BAMBOO_STATES('large_leaves')});
 // random 0 → 1 + floor(0 * 2) = one block per pass; a body block use grows the top.
 const r=use(f,api,base,{random:[0]});
 assert.equal(r.ok,true);assert.equal(r.left,2);
 assert.deepEqual([0,1,2,3,4].map(y=>at(f,y).permutation.getState('bamboo_leaf_size')),
  ['no_leaves','no_leaves','small_leaves','large_leaves','large_leaves']);
 assert.deepEqual([3,4].map(y=>at(f,y).permutation.getState('bamboo_stalk_thickness')),['thick','thick']);
 assert.equal(at(f,5).typeId,'minecraft:air');
 // random .99 → two blocks per pass from a single thin stalk: 1 + 2 + 2 = 5 high.
 const lone=f.block('minecraft:bamboo',{x:2,y:0,z:0},{states:BAMBOO_STATES('no_leaves')});
 const grown=use(f,api,lone,{random:[0.99]});
 assert.equal(grown.ok,true);
 assert.deepEqual([0,1,2,3,4,5].map(y=>at(f,y,2).typeId),[...Array(5).fill('minecraft:bamboo'),'minecraft:air']);
 assert.deepEqual([1,2,3,4].map(y=>at(f,y,2).permutation.getState('bamboo_leaf_size')),['no_leaves','small_leaves','large_leaves','large_leaves']);
});

test('bamboo refuses a 16-high column while a blocked top still consumes without growth',async()=>{
 const {f,api}=await fertilizerWorld();
 for(let y=0;y<16;y++)f.block('minecraft:bamboo',{x:0,y,z:0},{states:BAMBOO_STATES('no_leaves')});
 let r=use(f,api,at(f,5),{random:[0]});
 assert.equal(r.ok,false);assert.equal(r.left,3);
 const lone=f.block('minecraft:bamboo',{x:3,y:0,z:0},{states:BAMBOO_STATES('no_leaves')});
 f.block('minecraft:stone',{x:3,y:1,z:0});
 r=use(f,api,lone,{random:[0]});
 assert.equal(r.ok,true);assert.equal(r.left,2);
 assert.equal(at(f,1,3).typeId,'minecraft:stone');assert.equal(at(f,0,3).typeId,'minecraft:bamboo');
});

function kelpColumn(f,ages,waterAbove=2,x=0){
 const blocks=ages.map((age,y)=>f.block('minecraft:kelp',{x,y,z:0},{states:{kelp_age:age},waterlogged:true}));
 for(let y=ages.length;y<ages.length+waterAbove;y++)f.block('minecraft:water',{x,y,z:0},{states:{liquid_depth:0}});
 f.block('minecraft:stone',{x,y:ages.length+waterAbove,z:0});
 return blocks;
}
const kelpRow=(f,y,x=0)=>[at(f,y,x).typeId,at(f,y,x).permutation.getState('kelp_age'),at(f,y,x).isWaterlogged];

test('kelp grows one head per pass into water, keeps the liquid layer and leaves former heads at their stored age',async()=>{
 const {f,api}=await fertilizerWorld();
 const [base]=kelpColumn(f,[3,5]);
 const r=use(f,api,base);
 assert.equal(r.ok,true);assert.equal(r.left,2);
 assert.deepEqual([0,1,2,3].map(y=>kelpRow(f,y)),[['minecraft:kelp',3,true],['minecraft:kelp',5,true],['minecraft:kelp',6,true],['minecraft:kelp',7,true]]);
 assert.equal(f.writes.some(w=>w.method==='setPermutation'&&w.target===at(f,1)),false,'the former head is never rewritten');
 assert.equal(at(f,4).typeId,'minecraft:stone');
 // Stone above the new head: no water to grow into, nothing consumed.
 const blocked=use(f,api,base);
 assert.equal(blocked.ok,false);assert.equal(blocked.left,3);
 const [capped]=kelpColumn(f,[25],1,5);
 assert.equal(use(f,api,capped).ok,true);
 assert.deepEqual([kelpRow(f,0,5),kelpRow(f,1,5)],[['minecraft:kelp',25,true],['minecraft:kelp',25,true]]);
});

test('a rejected later kelp write restores the replaced water and its liquid layer exactly and refunds the cost',async()=>{
 const {f,api}=await fertilizerWorld();
 const [base]=kelpColumn(f,[3,5]);
 f.faults.failNext(at(f,3),'setPermutation');
 const r=use(f,api,base);
 assert.equal(r.ok,false);assert.equal(r.left,3);
 assert.deepEqual([1,2,3].map(y=>[at(f,y).typeId,at(f,y).permutation.getAllStates(),at(f,y).isWaterlogged]),
  [['minecraft:kelp',{kelp_age:5},true],['minecraft:water',{liquid_depth:0},false],['minecraft:water',{liquid_depth:0},false]]);
 assert.equal(api.plantMutationAllowed(base),true);
 assert.deepEqual(f.writes.filter(w=>w.method==='setWaterlogged').map(w=>w.args[0]),[true,false]);
});

test('an unacknowledged kelp liquid layer keeps the paid cost and quarantines the plant instead of guessing',async()=>{
 const {f,api}=await fertilizerWorld();
 const [base]=kelpColumn(f,[3,5]);
 f.faults.failNext(at(f,2),'setWaterlogged');
 const r=use(f,api,base);
 assert.equal(r.ok,false);assert.equal(r.left,2);
 // The native liquid layer never acknowledged, so nothing is guessed back to water.
 assert.deepEqual(kelpRow(f,2),['minecraft:kelp',6,false]);
 assert.deepEqual(kelpRow(f,1),['minecraft:kelp',5,true]);
 assert.equal(api.plantMutationAllowed(base),false);
});
