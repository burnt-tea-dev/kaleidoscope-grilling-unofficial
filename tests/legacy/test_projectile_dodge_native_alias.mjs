/** Actual observed Native shapes with independent Java motion/column oracles. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyProjectileDodgeGroundCell} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_ground_core.js';
import {resolveProjectileDodgeGround} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_ground_runtime.js';
const classify=(typeId,states)=>classifyProjectileDodgeGroundCell({typeId,states});
test('actual stone snapshot supports the source column and preserves the fractional sampled Y',()=>{
 const reads=[];
 const entity={location:{x:5.25,y:80,z:6.75},dimension:{id:'minecraft:overworld',heightRange:{min:-64,max:320},isChunkLoaded:()=>true,getBlock(point){
  reads.push(point);return {permutation:{type:{id:'minecraft:stone'},getAllStates:()=>({stone_type:'stone'})}};
 }}};
 const result=resolveProjectileDodgeGround(entity,{x:5.25,y:80.75,z:6.75});
 assert.equal(result.supported,true);assert.equal(result.found,true);assert.deepEqual(result.destination,{x:5.25,y:80.75,z:6.75});
 assert.deepEqual(reads,[{x:5,y:79,z:6}]);
});
test('split stone identity retains its exact legacy material rather than accepting another stone family',()=>{
 assert.equal(classify('minecraft:granite',{stone_type:'granite'}).blocksMotion,true);
 assert.equal(classify('minecraft:granite',{stone_type:'diorite'}).supported,false);
 assert.equal(classify('minecraft:stone',{stone_type:'granite'}).supported,false);
});
test('top slab accepts the observed complete relation and rejects a contradictory legacy half',()=>{
 const states={'minecraft:vertical_half':'top',stone_slab_type_4:'stone',top_slot_bit:true};
 assert.equal(classify('minecraft:normal_stone_slab',states).blocksMotion,true);
 assert.equal(classify('minecraft:normal_stone_slab',{...states,top_slot_bit:false}).supported,false);
 assert.equal(classify('minecraft:normal_stone_slab',{...states,stone_slab_type_4:'mossy_cobblestone'}).supported,false);
});
test('door legacy direction follows the complete primary tuple across upper open hinges',()=>{
 const states={direction:1,door_hinge_bit:true,'minecraft:cardinal_direction':'west',open_bit:true,upper_block_bit:true};
 assert.equal(classify('minecraft:acacia_door',states).blocksMotion,true);
 assert.equal(classify('minecraft:acacia_door',{...states,direction:0}).supported,false);
 assert.equal(classify('minecraft:acacia_door',{...states,direction:'1'}).supported,false);
});
test('missing Native alias, injected fields and unknown material do not acquire default support',()=>{
 assert.equal(classify('minecraft:stone',{}).supported,false);
 assert.equal(classify('minecraft:stone',{stone_type:'stone',injected:false}).supported,false);
 assert.equal(classify('minecraft:stone',{stone_type:'addon_stone'}).supported,false);
});
test('split wool color is an identity discriminator without a generic global color whitelist',()=>{
 assert.equal(classify('minecraft:blue_wool',{color:'blue'}).blocksMotion,true);
 assert.equal(classify('minecraft:blue_wool',{color:'white'}).supported,false);
});
