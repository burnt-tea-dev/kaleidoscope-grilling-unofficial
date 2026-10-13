/** Newly affected source-mapping behavior; API adapters are not Native clients. */
import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {classifyProjectileDodgeGroundCell} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_ground_core.js';
import {resolveProjectileDodgeGround} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_ground_runtime.js';
const {PROJECTILE_DODGE_GROUND_FACTS,PROJECTILE_DODGE_GROUND_SOURCE_ROWS}=JSON.parse(readFileSync(new URL('./fixtures/projectile-dodge-ground-diagnostics.json',import.meta.url),'utf8'));
const cell=(typeId,states=typeId==='minecraft:stone'?{stone_type:'stone'}:{})=>({typeId,states});
function column(read){
 const seen=[],writes=[];const entity={location:{x:5.25,y:80,z:6.75},dimension:{id:'minecraft:overworld',heightRange:{min:-64,max:320},isChunkLoaded:()=>true,getBlock(point){
  seen.push({...point});const c=read(point);return {permutation:{type:{id:c.typeId},getAllStates:()=>c.states},getDynamicProperty(){throw Error('Opaque contents must not be guessed')}};
 }},tryTeleport(){writes.push('teleport');throw Error('Source reader moved actor')},setDynamicProperty(){writes.push('effect');throw Error('Source reader wrote effect')}};
 return {entity,seen,writes,run:()=>resolveProjectileDodgeGround(entity,{x:5.25,y:80.75,z:6.75})};
}
test('snow alias priority keeps the full snow block as immediate support rather than descending to a lower floor',()=>{
 const a=column(p=>cell(p.y===79?'minecraft:snow':'minecraft:stone'));
 const r=a.run();assert.equal(r.found,true);assert.equal(r.destination.y,80.75);assert.deepEqual(a.seen.map(p=>p.y),[79]);assert.deepEqual(a.writes,[]);
});
test('snow layers retain the distinct false source predicate and descend to the next floor',()=>{
 const a=column(p=>p.y===79?cell('minecraft:snow_layer',{covered_bit:false,height:0}):cell('minecraft:stone'));
 const r=a.run();assert.equal(r.found,true);assert.equal(r.destination.y,79.75);assert.deepEqual(a.seen.map(p=>p.y),[79,78]);
});
test('independently identified common stone and farm floors preserve the fractional sampled height',()=>{
 for(const [id,states] of [['minecraft:andesite',{stone_type:'andesite'}],['minecraft:granite',{stone_type:'granite'}],['minecraft:diorite',{stone_type:'diorite'}],['minecraft:farmland',{moisturized_amount:7}]]){
  const a=column(()=>cell(id,states));const r=a.run();assert.equal(r.found,true,id);assert.equal(r.destination.y,80.75,id);assert.equal(r.supportCell.typeId,id);assert.deepEqual(a.writes,[]);
 }
});
test('explicit normal-stone stair/slab identities use reviewed source motion across their Native states',()=>{
 const examples=[cell('minecraft:normal_stone_stairs',{'minecraft:corner':'inner_left',upside_down_bit:true,weirdo_direction:3}),cell('minecraft:normal_stone_slab',{'minecraft:vertical_half':'top',stone_slab_type_4:'stone',top_slot_bit:true}),cell('minecraft:normal_stone_double_slab',{'minecraft:vertical_half':'bottom',stone_slab_type_4:'stone',top_slot_bit:false})];
 for(const c of examples){const a=column(()=>c);const r=a.run();assert.equal(r.found,true,c.typeId);assert.equal(r.destination.y,80.75,c.typeId)}
 const wrong=classifyProjectileDodgeGroundCell(cell('minecraft:normal_stone_stairs',{'minecraft:corner':'straight',upside_down_bit:true,weirdo_direction:3}));assert.equal(wrong.supported,false);
});
test('bed permission carries all-color original proof without accessing an opaque Native color',()=>{
 const a=column(()=>cell('minecraft:bed',{direction:3,head_piece_bit:true,occupied_bit:false}));const r=a.run();assert.equal(r.found,true);assert.equal(r.destination.y,80.75);
 const source=PROJECTILE_DODGE_GROUND_SOURCE_ROWS.find(r=>r.typeId==='minecraft:bed').sourceSets;
 for(const version of ['1.20.1','1.21.1']){assert.ok(source[version].ids.includes('minecraft:black_bed'));assert.ok(source[version].ids.includes('minecraft:white_bed'));assert.ok(source[version].ids.includes('minecraft:red_bed'))}
 const guessedColor=classifyProjectileDodgeGroundCell(cell('minecraft:bed',{direction:3,head_piece_bit:true,occupied_bit:false,color:'red'}));assert.equal(guessedColor.supported,false);
});
test('known compound contents use whole original unions while preserving Native state keys',()=>{
 const cauldron=column(()=>cell('minecraft:cauldron',{cauldron_liquid:'lava',fill_level:6}));assert.equal(cauldron.run().found,true);
 const pot=column(p=>p.y===79?cell('minecraft:flower_pot',{update_bit:true}):cell('minecraft:stone'));assert.equal(pot.run().destination.y,79.75);
 const sources=PROJECTILE_DODGE_GROUND_SOURCE_ROWS.find(r=>r.typeId==='minecraft:cauldron').sourceSets;
 assert.ok(sources['1.20.1'].ids.includes('minecraft:lava_cauldron'));assert.ok(sources['1.21.1'].ids.includes('minecraft:powder_snow_cauldron'));
});
test('original21-only evidence cannot silently grant the default two-branch consumer permission',()=>{
 const fact=PROJECTILE_DODGE_GROUND_FACTS.find(r=>r.typeId==='minecraft:tuff_slab');assert.equal(fact.motion,true);assert.equal(fact.sources['1.20.1'].available,false);assert.equal(fact.sources['1.21.1'].available,true);
 const a=column(p=>p.y===79?cell('minecraft:tuff_slab',{'minecraft:vertical_half':'bottom'}):cell('minecraft:stone'));
 const r=a.run();assert.equal(r.supported,false);assert.equal(r.found,false);assert.deepEqual(a.seen.map(p=>p.y),[79]);
});
test('an unresolved identity cannot acquire permission merely from matching a Java registered name',()=>{
 const fact=PROJECTILE_DODGE_GROUND_FACTS.find(r=>r.typeId==='minecraft:petrified_oak_slab');assert.equal(fact.motion,true);assert.equal(fact.sources['1.20.1'].available,true);
 const a=column(p=>p.y===79?cell('minecraft:petrified_oak_slab',{'minecraft:vertical_half':'bottom'}):cell('minecraft:stone'));
 assert.equal(a.run().supported,false);assert.deepEqual(a.seen.map(p=>p.y),[79]);
});
test('new Native and authored custom floors stop before a deeper familiar floor',()=>{
 for(const id of ['minecraft:poplar_planks','kaleidoscope_grilling:grill']){const a=column(p=>cell(p.y===79?id:'minecraft:stone'));const r=a.run();assert.equal(r.supported,false);assert.equal(r.destination,undefined);assert.deepEqual(a.seen.map(p=>p.y),[79]);assert.deepEqual(a.writes,[])}
});
