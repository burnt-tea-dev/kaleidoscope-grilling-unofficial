/** Independent current-author literals; adapters are not Native/player proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyProjectileDodgeGroundCell as classify} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_ground_core.js';
import {resolveProjectileDodgeGround} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_ground_runtime.js';
const cell=(name,states={})=>({typeId:'kaleidoscope_grilling:'+name,states});
function column(top){
 const reads=[];const entity={location:{x:5.25,y:80,z:6.75},dimension:{id:'minecraft:overworld',heightRange:{min:-64,max:320},isChunkLoaded:()=>true,getBlock(point){
  reads.push(point);const value=point.y===79?top:{typeId:'minecraft:stone',states:{stone_type:'stone'}};
  return {permutation:{type:{id:value.typeId},getAllStates:()=>value.states}};
 }}};
 return {run:()=>resolveProjectileDodgeGround(entity,{x:5.25,y:80.75,z:6.75}),reads};
}
test('bottle count1 descends while counts2..4 provide original source support',()=>{
 for(let n=1;n<=4;n++){
  const c=cell('seasoning_bottle_'+n),a=column(c),r=a.run();assert.equal(classify(c).blocksMotion,n>=2);
  assert.equal(r.found,true);assert.equal(r.destination.y,n===1?79.75:80.75);assert.equal(a.reads.length,n===1?2:1);
 }
});
test('plate copied forceSolidOn wins despite source noCollision/thin rendering',()=>{
 const c=cell('skewer_plate_block',{'kaleidoscope_grilling:plate_count':5,'minecraft:cardinal_direction':'west'});
 assert.equal(classify(c).blocksMotion,true);assert.equal(column(c).run().destination.y,80.75);
});
test('every grill leg/lit orientation keeps the shallow original motion false',()=>{
 for(const legged of [false,true])for(const lit of [false,true])for(const direction of ['north','east','south','west']){
  const c=cell('grill',{'kaleidoscope_grilling:legged':legged,'kaleidoscope_grilling:lit':lit,'minecraft:cardinal_direction':direction});
  assert.equal(classify(c).blocksMotion,false);assert.equal(column(c).run().destination.y,79.75);
 }
});
test('author pepper leaves do not inherit ordinary oak-leaf motion',()=>{
 for(const fruit of [false,true])for(const persistent of [false,true]){
  const c=cell('pepper_leaves',{'kaleidoscope_grilling:has_pepper':fruit,'kaleidoscope_grilling:persistent':persistent});
  assert.equal(classify(c).blocksMotion,false);assert.equal(column(c).run().destination.y,79.75);
 }
});
test('full-cube vat/press/log source bodies retain support at valid endpoint states',()=>{
 const cells=[cell('big_vat',{'kaleidoscope_grilling:vat_level':4,'kaleidoscope_grilling:vat_fluid':'premium_chili'}),cell('oil_press',{'kaleidoscope_grilling:cake_count':4,'kaleidoscope_grilling:press_stage':4,'minecraft:cardinal_direction':'east'}),cell('pepper_log',{'minecraft:block_face':'up'})];
 for(const c of cells){assert.equal(classify(c).blocksMotion,true);assert.equal(column(c).run().destination.y,80.75)}
});
test('owned crops and oils remain non-supporting across original valid levels',()=>{
 const cells=[cell('canola_crop',{'kaleidoscope_grilling:age':7}),cell('onion_crop',{'kaleidoscope_grilling:age':7}),cell('sweet_potato_crop',{'kaleidoscope_grilling:age':7}),cell('houttuynia_crop',{'kaleidoscope_grilling:age':7,'kaleidoscope_grilling:red_variant':true}),cell('pepper_sapling',{'kaleidoscope_grilling:stage':1}),...['canola_oil','secret_chili_oil','premium_chili_oil'].map(name=>cell(name,{'kaleidoscope_grilling:level':7}))];
 for(const c of cells){assert.equal(classify(c).blocksMotion,false);assert.equal(column(c).run().destination.y,79.75)}
});
test('owned permission requires complete exact primitive keys and domains',()=>{
 const good=cell('grill',{'kaleidoscope_grilling:legged':false,'kaleidoscope_grilling:lit':false,'minecraft:cardinal_direction':'north'});
 assert.equal(classify(good).supported,true);
 for(const bad of [{...good,states:{}},{...good,states:{...good.states,'kaleidoscope_grilling:lit':0}},{...good,states:{...good.states,injected:true}},{...good,states:{...good.states,'minecraft:cardinal_direction':'up'}}])assert.equal(classify(bad).supported,false);
});
test('unresolved legacy/visual identities and foreign namespace stay unsupported',()=>{
 for(const name of ['seasoning_bottle','grill_legs','pepper_leaves_fruiting_bridge','pepper_worldgen_seed'])assert.equal(classify(cell(name)).supported,false);
 assert.equal(classify({typeId:'addon:grill',states:{}}).supported,false);
});
