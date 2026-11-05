import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../helpers/minecraft-fixture.mjs';

// Cookery WarmthEffect: one heal per check within x/z +/-2, y +/-1,
// from a tagged heat source or a block whose Java LIT property is true.
async function warmthFixture(options={}){
 const f=createFixture();
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
   f.tick(19);assert.equal(f.hp.currentValue,10,'idle furnace is not a heat source');
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
   f.tick(19);assert.equal(f.hp.currentValue,10,'extinguished campfire supplies no heat');
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
  f.tick(19);assert.equal(f.hp.currentValue,10);
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
  redstone.tick(19);assert.equal(redstone.hp.currentValue,10);
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
  f.tick(19);assert.equal(f.hp.currentValue,11);f.hp.currentValue=10;
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
  f.tick(19);assert.equal(f.hp.currentValue,10,'x+3 and y+2 are outside the Java scan');
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
  f.tick(19);assert.equal(f.hp.currentValue,10.5);
  block.setType('minecraft:lit_furnace');
  f.tick(20);assert.equal(f.hp.currentValue,11.5,'heat heals once and skips Nether fallback');
 }finally{Math.random=random;f.dispose()}
});
