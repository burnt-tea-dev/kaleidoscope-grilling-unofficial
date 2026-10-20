/** Actual new read-only precheck with source/API-operation adapters, not clients. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PROJECTILE_DODGE_LIQUID_MAX_CELLS,projectileDodgeLiquidCellPlan,classifyProjectileDodgeLiquidCell} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_liquid_core.js';
import {projectileDodgeLiquidPrecheck} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_liquid_runtime.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/java-projectile-dodge-liquid-160.json',import.meta.url),'utf8'));
const air=()=>({typeId:'minecraft:air',isLiquid:false,isWaterlogged:false});
function actor({position={x:10,y:20,z:30},box={center:{x:10,y:21,z:30},extent:{x:.3,y:1,z:.3}},read=air}={}){
 const cells=[],writes=[];let current={...position},dimensionId='minecraft:overworld';
 const dimension={get id(){return dimensionId},getBlock(point){cells.push({...point});return read(point)}};
 const entity={get location(){return current},get dimension(){return dimension},getAABB:()=>box,
  tryTeleport(){writes.push('teleport');throw Error('A precheck must not move')},
  setDynamicProperty(){writes.push('effect');throw Error('A precheck must not spend')},
  playSound(){writes.push('sound');throw Error('A precheck must not emit feedback')}};
 return {entity,cells,writes,setPosition:p=>{current=p},setDimension:id=>{dimensionId=id}};
}

test('translated actual collision bounds preserve center offset and use all three candidate deltas',()=>{
 const plan=projectileDodgeLiquidCellPlan({x:10,y:20,z:30},{center:{x:10.5,y:21,z:29.5},extent:{x:.5,y:1,z:.5}},{x:-2,y:-1,z:4});
 assert.equal(plan.supported,true);assert.deepEqual(plan.min,{x:-2,y:-1,z:3});assert.deepEqual(plan.max,{x:-1,y:1,z:4});assert.equal(plan.cellCount,2);
});
test('exclusive upper cells and floor of negative fractional coordinates reproduce whole-cell enumeration',()=>{
 const a=actor({position:{x:0,y:0,z:0},box:{center:{x:0,y:.5,z:0},extent:{x:.5,y:.5,z:.5}}});
 const result=projectileDodgeLiquidPrecheck(a.entity,{x:-.5,y:-.25,z:-.5});
 assert.equal(result.allow,true);assert.equal(result.checkedCells,2);
 assert.deepEqual(a.cells,[{x:-1,y:-1,z:-1},{x:-1,y:0,z:-1}]);
 assert.equal(a.cells.some(point=>point.x===0||point.y===1||point.z===0),false);
});
test('a head-height liquid cell rejects a destination even when every feet cell is dry',()=>{
 const a=actor({read:point=>point.y===21?{typeId:'minecraft:water',isLiquid:true,isWaterlogged:false}:air()});
 const result=projectileDodgeLiquidPrecheck(a.entity,{x:10,y:20,z:30});
 assert.equal(result.allow,false);assert.equal(result.supported,true);assert.equal(result.reason,'liquid_cell');assert.equal(result.cell.y,21);assert.equal(a.writes.length,0);
});
test('a waterlogged non-liquid cell anywhere in the real box rejects without a fluid surface guess',()=>{
 const a=actor({read:point=>point.x===10&&point.y===20&&point.z===30?{typeId:'minecraft:oak_slab',isLiquid:false,isWaterlogged:true}:air()});
 const result=projectileDodgeLiquidPrecheck(a.entity,{x:10,y:20,z:30});
 assert.equal(result.allow,false);assert.equal(result.cell.presence,'native_waterlogged');assert.equal(result.cell.x,10);
});
test('source-reviewed native water and plant carriers reject even if both native presence flags are false',()=>{
 const carriers=['minecraft:water','minecraft:flowing_water','minecraft:lava','minecraft:flowing_lava','minecraft:bubble_column','minecraft:kelp','minecraft:seagrass'];
 for(const typeId of carriers){
  assert.equal(fixture.source_fluid_carriers[typeId].source_verified,true);
  const a=actor({read:()=>({typeId,isLiquid:false,isWaterlogged:false})});
  const result=projectileDodgeLiquidPrecheck(a.entity,{x:10,y:20,z:30});
  assert.equal(result.allow,false);assert.equal(result.supported,true);assert.equal(result.cell.presence,'source_fluid_carrier');
 }
});
test('known dry vanilla cells with liquid-looking names or containers are not guessed to be fluids',()=>{
 for(const typeId of ['minecraft:wet_sponge','minecraft:cauldron','minecraft:powder_snow']){
  const a=actor({read:()=>({typeId,isLiquid:false,isWaterlogged:false})});
  const result=projectileDodgeLiquidPrecheck(a.entity,{x:10,y:20,z:30});
  assert.equal(result.allow,true);assert.equal(result.checkedCells,result.plannedCells);
 }
});
test('unknown custom/script fluid cells and unregistered minecraft names cannot be inferred dry',()=>{
 for(const typeId of ['addon:dry_looking_oil','kaleidoscope_grilling:canola_oil','minecraft:unregistered_future_fluid']){
  const a=actor({read:()=>({typeId,isLiquid:false,isWaterlogged:false})});
  const result=projectileDodgeLiquidPrecheck(a.entity,{x:10,y:20,z:30});
  assert.equal(result.allow,false);assert.equal(result.supported,false);assert.equal(result.reason,'block_type_unsupported');assert.equal(a.cells.length,1);
 }
});
test('observed native liquid on an unknown block still rejects instead of treating unknown as dry',()=>{
 assert.deepEqual(classifyProjectileDodgeLiquidCell({typeId:'addon:unknown',isLiquid:true,isWaterlogged:false}),{supported:true,liquid:true,reason:'native_liquid'});
});
test('missing or exceptional block/property reads cannot report a destination dry',()=>{
 const broken=[()=>undefined,()=>{throw Error('Unloaded')},()=>({typeId:'minecraft:air',isLiquid:false}),()=>({typeId:'minecraft:air',get isLiquid(){throw Error('Unavailable')},isWaterlogged:false})];
 for(const read of broken){
  const a=actor({read}),result=projectileDodgeLiquidPrecheck(a.entity,{x:10,y:20,z:30});
  assert.equal(result.allow,false);assert.equal(result.supported,false);assert.ok(result.reason.includes('unavailable'));
 }
});
test('invalid, degenerate, overflowed or unsafe collision bounds are unsupported before any cell read',()=>{
 const boxes=[
  {center:{x:NaN,y:1,z:1},extent:{x:1,y:1,z:1}},
  {center:{x:1,y:1,z:1},extent:{x:0,y:1,z:1}},
  {center:{x:1,y:1,z:1},extent:{x:1,y:-1,z:1}},
  {center:{x:Number.MAX_VALUE,y:1,z:1},extent:{x:Number.MAX_VALUE,y:1,z:1}},
  {center:{x:Number.MAX_SAFE_INTEGER+1,y:1,z:1},extent:{x:1,y:1,z:1}}
 ];
 for(const box of boxes){const a=actor({box}),result=projectileDodgeLiquidPrecheck(a.entity,{x:10,y:20,z:30});assert.equal(result.allow,false);assert.equal(result.supported,false);assert.equal(a.cells.length,0)}
 for(const candidate of [{x:NaN,y:0,z:0},{x:0,y:Infinity,z:0}]){const a=actor();assert.equal(projectileDodgeLiquidPrecheck(a.entity,candidate).allow,false);assert.equal(a.cells.length,0)}
});
test('work budget rejects the entire oversized box and never scans a dry prefix',()=>{
 assert.equal(PROJECTILE_DODGE_LIQUID_MAX_CELLS,fixture.work_budget.maximum_cells);
 const a=actor({position:{x:0,y:0,z:0},box:{center:{x:0,y:0,z:0},extent:{x:9,y:9,z:9}}});
 const result=projectileDodgeLiquidPrecheck(a.entity,{x:0,y:0,z:0});
 assert.equal(result.allow,false);assert.equal(result.reason,'collision_bounds_work_budget_exceeded');assert.equal(result.checkedCells,0);assert.equal(a.cells.length,0);
 const b=actor();assert.equal(projectileDodgeLiquidPrecheck(b.entity,{x:10,y:20,z:30},{maxCells:1}).reason,'collision_bounds_work_budget_exceeded');assert.equal(b.cells.length,0);
 for(const maxCells of [0,-1,1.5,NaN,Infinity,4097])assert.equal(projectileDodgeLiquidPrecheck(b.entity,{x:10,y:20,z:30},{maxCells}).reason,'work_budget_invalid');
});
test('dry permission requires unchanged actor location/dimension after the read-only scan',()=>{
 for(const change of ['position','dimension']){
  let a;a=actor({read:()=>{if(change==='position')a.setPosition({x:11,y:20,z:30});else a.setDimension('minecraft:nether');return air()}});
  const result=projectileDodgeLiquidPrecheck(a.entity,{x:10,y:20,z:30});assert.equal(result.allow,false);assert.equal(result.supported,false);assert.equal(result.reason,'liquid_context_changed');assert.equal(a.writes.length,0);
 }
});
test('a changed collision box at unchanged feet cannot inherit permission from the smaller dry scan',()=>{
 const small={center:{x:10,y:21,z:30},extent:{x:.3,y:1,z:.3}};let currentBox=small;
 const a=actor({box:small,read:point=>{currentBox.center.y=22;currentBox.extent.y=2;return point.y===22?{typeId:'minecraft:water',isLiquid:true,isWaterlogged:false}:air()}});
 a.entity.getAABB=()=>currentBox;
 const result=projectileDodgeLiquidPrecheck(a.entity,{x:10,y:20,z:30});
 assert.equal(result.allow,false);assert.equal(result.supported,false);assert.equal(result.reason,'liquid_context_changed');
 assert.equal(a.cells.some(point=>point.y===22),false);assert.deepEqual(a.entity.location,{x:10,y:20,z:30});assert.equal(a.writes.length,0);
});
test('missing native actor bounds or dimension readers cannot permit guessed movement',()=>{
 const a=actor();a.entity.getAABB=undefined;assert.equal(projectileDodgeLiquidPrecheck(a.entity,{x:10,y:20,z:30}).allow,false);assert.equal(a.cells.length,0);
 const b=actor();b.entity.getAABB=()=>{throw Error('Removed')};assert.equal(projectileDodgeLiquidPrecheck(b.entity,{x:10,y:20,z:30}).allow,false);assert.equal(b.cells.length,0);
 const c=actor();Object.defineProperty(c.entity,'dimension',{get(){return {id:'minecraft:overworld'}}});assert.equal(projectileDodgeLiquidPrecheck(c.entity,{x:10,y:20,z:30}).allow,false);assert.equal(c.cells.length,0);
});
