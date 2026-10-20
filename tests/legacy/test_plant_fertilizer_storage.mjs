/** Production journal helpers with storage values only; no players or interactions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {commitSteps} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a277_grill_transaction_core.js';
import {createOwnedPlantWrite,plantFertilizerSteps} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plant_fertilizer_transaction_core.js';

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
