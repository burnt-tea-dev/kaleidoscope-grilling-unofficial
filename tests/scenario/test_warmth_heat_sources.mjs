import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../helpers/minecraft-fixture.mjs';

// Cookery WarmthEffect: one heal per check within x/z +/-2, y +/-1,
// from a tagged heat source or a block whose Java LIT property is true.
async function warmthFixture(options={},clock={}){
 const f=createFixture(clock);
 await f.load('main.js');f.startup();f.flush();
 f.p=f.player({location:{x:0,y:0,z:0},...options});
 f.hp=f.p.getComponent('minecraft:health');f.hp.currentValue=10;
 const {FX_KEY}=await f.load('effect_lifecycle_core.js');
 f.p.setDynamicProperty(FX_KEY,JSON.stringify({warmth:{until:200,amp:0}}));
 return f;
}

for(const id of ['minecraft:furnace','minecraft:smoker','minecraft:blast_furnace']){
 test('Warmth heals beside burning '+id+' but not its idle form',async()=>{
  const f=await warmthFixture();
  try{
   const block=f.block(id,{x:1,y:0,z:0});
   f.tick(20);assert.equal(f.hp.currentValue,10,'idle furnace is not a heat source');
   block.setType('minecraft:lit_'+id.split(':')[1]);
   f.tick(20);assert.equal(f.hp.currentValue,11,'native burning ID supplies heat');
   block.setType(id);
   f.tick(20);assert.equal(f.hp.currentValue,11,'extinguishing removes the heat source');
  }finally{f.dispose()}
 });
}

for(const id of ['minecraft:campfire','minecraft:soul_campfire']){
 test('Warmth respects the fire state of '+id,async()=>{
  const f=await warmthFixture();
  try{
   const block=f.block(id,{x:1,y:0,z:0},{states:{extinguished:true}});
   f.tick(20);assert.equal(f.hp.currentValue,10,'extinguished campfire supplies no heat');
   block.setPermutation(block.permutation.withState('extinguished',false));
   f.tick(20);assert.equal(f.hp.currentValue,11,'lit campfire supplies heat');
   block.setPermutation(block.permutation.withState('extinguished',true));
   f.tick(20);assert.equal(f.hp.currentValue,11,'extinguishing removes the heat source');
  }finally{f.dispose()}
 });
}

test('Warmth uses native lit states and split redstone block IDs',async()=>{
 const f=await warmthFixture();
 try{
  const block=f.block('minecraft:candle',{x:0,y:1,z:0},{states:{lit:false}});
  f.tick(20);assert.equal(f.hp.currentValue,10);
  for(const id of ['minecraft:candle','minecraft:candle_cake','minecraft:copper_bulb']){
   block.setPermutation(f.BlockPermutation.resolve(id,{lit:true}));
   f.tick(20);assert.equal(f.hp.currentValue,11);f.hp.currentValue=10;
   block.setPermutation(block.permutation.withState('lit',false));
   f.tick(20);assert.equal(f.hp.currentValue,10);
  }
 }finally{f.dispose()}
 const redstone=await warmthFixture();
 try{
  const block=redstone.block('minecraft:redstone_lamp',{x:1,y:0,z:0});
  redstone.tick(20);assert.equal(redstone.hp.currentValue,10);
  for(const [off,on] of [
   ['minecraft:redstone_lamp','minecraft:lit_redstone_lamp'],
   ['minecraft:redstone_ore','minecraft:lit_redstone_ore'],
   ['minecraft:deepslate_redstone_ore','minecraft:lit_deepslate_redstone_ore'],
   ['minecraft:unlit_redstone_torch','minecraft:redstone_torch']
  ]){
   block.setType(on);redstone.tick(20);assert.equal(redstone.hp.currentValue,11);redstone.hp.currentValue=10;
   block.setType(off);redstone.tick(20);assert.equal(redstone.hp.currentValue,10);
  }
 }finally{redstone.dispose()}
});

test('Warmth retains tagged fire/lava sources and the saved grill state',async()=>{
 const f=await warmthFixture();
 try{
  const block=f.block('minecraft:fire',{x:1,y:0,z:0});
  f.tick(20);assert.equal(f.hp.currentValue,11);f.hp.currentValue=10;
  for(const id of ['minecraft:soul_fire','minecraft:lava','minecraft:flowing_lava','minecraft:magma']){
   block.setType(id);f.tick(20);assert.equal(f.hp.currentValue,11);f.hp.currentValue=10;
  }
  block.setType('kaleidoscope_grilling:grill');
  const state=await f.load('grill/grill_state_adapter.js');
  f.tick(20);assert.equal(f.hp.currentValue,10);
  f.world.setDynamicProperty(state.grillStateKey(block),JSON.stringify({lit:true}));
  f.tick(20);assert.equal(f.hp.currentValue,11);
 }finally{f.dispose()}
});

test('Warmth keeps the 5x3x5 boundary and heals only once for several sources',async()=>{
 const f=await warmthFixture({location:{x:-.2,y:4.8,z:-.2}});
 try{
  f.block('minecraft:lit_furnace',{x:2,y:4,z:-1});
  f.block('minecraft:fire',{x:-1,y:6,z:-1});
  f.tick(20);assert.equal(f.hp.currentValue,10,'x+3 and y+2 are outside the Java scan');
  f.block('minecraft:lit_furnace',{x:1,y:5,z:1});
  f.block('minecraft:fire',{x:-3,y:3,z:-3});
  f.tick(20);assert.equal(f.hp.currentValue,11,'both inclusive corners still give only one heal');
  f.hp.currentValue=19.75;f.tick(20);assert.equal(f.hp.currentValue,20,'healing stops at the native maximum');
 }finally{f.dispose()}
});

test('an extinguished Nether campfire uses slow fallback; real heat takes precedence',async()=>{
 const f=await warmthFixture({dimension:undefined});
 const random=Math.random;
 try{
  f.p.dimension=f.getDimension('nether');
  const block=f.block('minecraft:campfire',{x:1,y:0,z:0},{dimension:f.p.dimension,states:{extinguished:true}});
  Math.random=()=>0;
  f.tick(20);assert.equal(f.hp.currentValue,10.5);
  block.setType('minecraft:lit_furnace');
  f.tick(20);assert.equal(f.hp.currentValue,11.5,'heat heals once and skips Nether fallback');
 }finally{Math.random=random;f.dispose()}
});

// Mojang MobEffectInstance.tick (1.20.1 bfa / 1.21.1 brz) calls the effect's
// duration predicate and apply handler before tickDownDuration, including the
// first tick. These are fixed event expectations, not a copied tick simulator.
test('Warmth checks the pre-decrement duration from its first tick',async()=>{
 const f=await warmthFixture({},{currentTick:6});
 try{
  const state=await f.load('effect_state_runtime.js'),effects=await f.load('effect/runtime.js');
  state.writeEffects(f.p,{});effects.fxApply(f.p,'warmth',40);
  f.block('minecraft:lit_furnace',{x:1,y:0,z:0});
  assert.equal(state.readEffects(f.p).warmth.until,47);
  f.tick();assert.equal(f.system.currentTick,8);
  assert.equal(f.hp.currentValue,11,'the first effect tick checks duration forty before decrement');
  f.tick(12);assert.equal(f.system.currentTick,20);
  assert.equal(f.hp.currentValue,11,'process tick twenty does not add another heal');
  f.tick(7);assert.equal(f.hp.currentValue,11,'duration twenty-one does not heal');
  f.tick();assert.equal(f.hp.currentValue,12,'the next effect check sees duration twenty');
  f.tick(19);assert.equal(f.hp.currentValue,12,'expiry does not create a final heal at zero');
 }finally{f.dispose()}
});

test('a stored Warmth deadline keeps its check phase when the process clock restarts',async()=>{
 const first=await warmthFixture({},{currentTick:6,absoluteTime:10012});let raw;
 try{
  const state=await first.load('effect_state_runtime.js'),effects=await first.load('effect/runtime.js');
  const {FX_KEY}=await first.load('effect_lifecycle_core.js');
  state.writeEffects(first.p,{});effects.fxApply(first.p,'warmth',40);first.tick(16);
  assert.equal(first.world.getAbsoluteTime(),10035);
  raw=first.p.getDynamicProperty(FX_KEY);
  assert.equal(JSON.parse(raw).warmth.until,10059);
 }finally{first.dispose()}
 const next=await warmthFixture({},{currentTick:0,absoluteTime:10035});
 try{
  const {FX_KEY}=await next.load('effect_lifecycle_core.js');
  next.p.setDynamicProperty(FX_KEY,raw);
  next.block('minecraft:lit_furnace',{x:1,y:0,z:0});
  next.tick(2);assert.equal(next.hp.currentValue,10);
  next.tick();assert.equal(next.world.getAbsoluteTime(),10039);
  assert.equal(next.hp.currentValue,10,'pre-decrement duration twenty-one does not heal');
  next.tick();assert.equal(next.world.getAbsoluteTime(),10040);
  assert.equal(next.hp.currentValue,11,'stored effect reaches pre-decrement duration twenty at process tick five');
  assert.equal(next.p.getDynamicProperty(FX_KEY),raw,'checking does not rewrite the stored deadline');
 }finally{next.dispose()}
});

test('refreshing Warmth moves its check to the renewed deadline',async()=>{
 const f=await warmthFixture({},{currentTick:6});
 try{
  const state=await f.load('effect_state_runtime.js'),effects=await f.load('effect/runtime.js');
  state.writeEffects(f.p,{});effects.fxApply(f.p,'warmth',40);
  f.block('minecraft:lit_furnace',{x:1,y:0,z:0});
  f.tick(13);assert.equal(f.hp.currentValue,11);effects.fxApply(f.p,'warmth',60);
  assert.equal(state.readEffects(f.p).warmth.until,80);
  f.tick();assert.equal(f.hp.currentValue,12,'the renewed effect checks duration sixty before decrement');
  f.tick(7);assert.equal(f.hp.currentValue,12,'the previous deadline no longer owns the check');
  f.tick(13);assert.equal(f.hp.currentValue,13,'the renewed effect checks duration forty before decrement');
 }finally{f.dispose()}
});
