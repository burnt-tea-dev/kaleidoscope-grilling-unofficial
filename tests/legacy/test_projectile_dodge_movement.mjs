/** Actual movement helper with bounded native API-operation adapters, not clients. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PROJECTILE_DODGE_ATTEMPTS,PROJECTILE_DODGE_RANGE,projectileDodgeBounds,sampleProjectileDodgeAttempt} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_movement_core.js';
import {tryProjectileDodgeMovement} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_movement_runtime.js';
const root=new URL('../../',import.meta.url),fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/java-projectile-dodge-movement-160.json',import.meta.url),'utf8'));
function actor({dimensionId='minecraft:overworld',range={min:-64,max:320},position={x:1,y:80,z:2},succeedAt=1,mounted=false,remount=false,readBlock=()=>({typeId:'minecraft:air',isLiquid:false,isWaterlogged:false})}={}){
 const calls=[],ejected=[],order=[],reads=[];let riding=mounted,location={...position},reportedDimension=dimensionId;
 const mount={getComponent:id=>id==='minecraft:rideable'?{
  ejectRider:rider=>{ejected.push(rider);order.push('eject');riding=false},
  ejectRiders(){throw Error('Other passengers must not be ejected')}
 }:undefined};
 // Existing liquid fixtures describe body cells. Supply an independent dry
 // stone floor below the original actor so they still exercise the liquid path.
 const subject={typeId:'minecraft:cow',get dimension(){return {id:reportedDimension,heightRange:range,isChunkLoaded:()=>true,getBlock:point=>{
  reads.push({...point});if(point.y<Math.floor(position.y))return {typeId:'minecraft:stone',isLiquid:false,isWaterlogged:false,permutation:{type:{id:'minecraft:stone'},getAllStates:()=>({stone_type:'stone'})}};
  return readBlock(point);
 }}},
  get location(){return location},
  getAABB:()=>({center:{x:location.x,y:location.y+.65,z:location.z},extent:{x:.45,y:.65,z:.45}}),
  getComponent:id=>id==='minecraft:health'?{currentValue:10}:id==='minecraft:riding'&&riding?{entityRidingOn:mount}:undefined,
  tryTeleport:(to,options)=>{order.push('teleport');calls.push({to,options});if(calls.length===succeedAt){location={...to};return true}if(remount)riding=true;return false},
  setDynamicProperty(){throw Error('Movement must not spend effects')},playSound(){throw Error('Movement must not play sounds')}};
 return {subject,mount,calls,ejected,order,reads,setRiding:value=>{riding=value},setPosition:value=>{location=value},setDimension:value=>{reportedDimension=value}};
}
test('both original loader dimension definitions yield the fixed vanilla logical bounds, including Nether127',()=>{
 assert.equal(PROJECTILE_DODGE_ATTEMPTS,fixture.attempts);assert.equal(PROJECTILE_DODGE_RANGE,fixture.sample_range);
 for(const [id,bounds] of Object.entries(fixture.vanilla_bounds))for(const loader of Object.values(fixture.loader_sources)){
  const definition=loader.dimension_types[bounds.source_path].json;assert.equal(bounds.min,definition.min_y);assert.equal(bounds.max,definition.min_y+definition.logical_height-1);
  assert.deepEqual(projectileDodgeBounds(id,{min:bounds.min,max:bounds.max+1}),{min:bounds.min,max:bounds.max});
 }
 assert.equal(fixture.vanilla_bounds['minecraft:nether'].build_height,256);assert.equal(fixture.vanilla_bounds['minecraft:nether'].logical_height,128);
});
test('native heightRange is coverage only; its max is not subtracted or used as source logical height',()=>{
 assert.deepEqual(projectileDodgeBounds('minecraft:nether',{min:0,max:256}),{min:0,max:127});
 assert.deepEqual(projectileDodgeBounds('minecraft:overworld',{min:-64,max:319}),{min:-64,max:319});
 assert.deepEqual(projectileDodgeBounds('minecraft:the_end',{min:0,max:1024}),{min:0,max:255});
 for(const [id,range] of [['addon:custom',{min:-64,max:320}],['overworld',{min:-64,max:320}],['minecraft:overworld',{min:0,max:320}],['minecraft:nether',{min:0,max:126}],['minecraft:overworld',{min:-64,max:NaN}],['minecraft:overworld',undefined]])assert.equal(projectileDodgeBounds(id,range),undefined);
});
test('sample order retains three independent uniform axes and clamps only Y to source bounds',()=>{
 const draws=[0,.999,.25],origin={x:10,y:128,z:20};let calls=0;
 assert.deepEqual(sampleProjectileDodgeAttempt(origin,{min:0,max:127},()=>{calls++;return draws.shift()}),{x:8.5,y:127,z:19.25});assert.equal(calls,3);
 assert.deepEqual(sampleProjectileDodgeAttempt({x:0,y:-64,z:0},{min:-64,max:319},()=>0),{x:-1.5,y:-64,z:-1.5});
 for(const bad of [NaN,-.1,1,Infinity])assert.equal(sampleProjectileDodgeAttempt(origin,{min:0,max:127},()=>bad),undefined);
});
test('actual runtime clamps vanilla endpoints; the source minimum has no below-cell ground support',()=>{
 for(const [dimensionId,min,max,nativeMax] of [['minecraft:overworld',-64,319,320],['minecraft:nether',0,127,128],['minecraft:the_end',0,255,256]])for(const upper of [false,true]){
  const a=actor({dimensionId,range:{min,max:nativeMax},position:{x:0,y:upper?max+1:min-1,z:0}}),result=tryProjectileDodgeMovement(a.subject,{random:()=>upper?.999:0});
  assert.equal(result.success,upper);assert.equal(result.attempts,upper?1:16);
  if(upper){assert.equal(result.destination.y,max);assert.equal(a.calls[0].options.checkForBlocks,true)}
  else{assert.equal(a.calls.length,0);assert.equal(a.reads.length,0)}
 }
});
test('ordinary failed attempts retry at most16 with every sample anchored to the immutable origin',()=>{
 const a=actor({succeedAt:Infinity}),initial={...a.subject.location};let draws=0;
 const teleport=a.subject.tryTeleport;a.subject.tryTeleport=(to,options)=>{const result=teleport(to,options);a.setPosition({x:100,y:100,z:100});return result};
 const result=tryProjectileDodgeMovement(a.subject,{random:()=>{draws++;return .75}});
 assert.equal(result.success,false);assert.equal(result.attempts,16);assert.equal(a.calls.length,16);assert.equal(draws,48);assert.deepEqual(result.origin,initial);
 assert.ok(a.calls.every(x=>x.to.x===initial.x+.75&&x.to.y===initial.y+.75&&x.to.z===initial.z+.75));
});
test('success stops the attempt loop and reports the real native destination',()=>{
 const a=actor({succeedAt:3}),original=a.subject.tryTeleport;
 a.subject.tryTeleport=(to,options)=>{const result=original(to,options);if(result)a.setPosition({x:to.x+.1,y:to.y,z:to.z});return result};
 const result=tryProjectileDodgeMovement(a.subject,{random:()=>.5});assert.equal(result.success,true);assert.equal(result.attempts,3);assert.equal(a.calls.length,3);assert.equal(result.destination.x,1.1);
});
test('only the actual target rider is ejected before teleport, without ejecting other passengers',()=>{
 const a=actor({mounted:true}),result=tryProjectileDodgeMovement(a.subject,{random:()=>.5});assert.equal(result.success,true);assert.equal(a.ejected.length,1);assert.equal(a.ejected[0],a.subject);assert.deepEqual(a.order,['eject','teleport']);
});
test('a rider who remounts between failed attempts is ejected before each next attempt',()=>{
 const a=actor({mounted:true,remount:true,succeedAt:3}),result=tryProjectileDodgeMovement(a.subject,{random:()=>.5});assert.equal(result.success,true);assert.equal(a.ejected.length,3);assert.deepEqual(a.order,['eject','teleport','eject','teleport','eject','teleport']);
});
test('unsupported or unobserved rider removal prevents a guessed mounted teleport',()=>{
 for(const mode of ['missing-api','no-mutation','throws']){
  const a=actor({mounted:true});a.mount.getComponent=()=>mode==='missing-api'?undefined:{ejectRider:()=>{if(mode==='throws')throw Error('Unmount unavailable')}};
  const result=tryProjectileDodgeMovement(a.subject,{random:()=>.5});assert.equal(result.success,false);assert.equal(a.calls.length,0);assert.ok(result.reason.includes(mode==='missing-api'?'unavailable':'dismount'));
 }
});
test('a dismount that committed then threw is acknowledged once through actual rider state',()=>{
 const a=actor({mounted:true});a.mount.getComponent=()=>({ejectRider:target=>{a.ejected.push(target);a.setRiding(false);throw Error('After native dismount')}});
 const result=tryProjectileDodgeMovement(a.subject,{random:()=>.5});assert.equal(result.success,true);assert.equal(a.ejected.length,1);assert.equal(a.calls.length,1);
});
test('unknown dimensions, inaccessible context and unavailable native APIs produce no guessed movement',()=>{
 const unknown=actor({dimensionId:'addon:dimension'});assert.equal(tryProjectileDodgeMovement(unknown.subject).success,false);assert.equal(unknown.calls.length,0);
 const unavailable=actor();Object.defineProperty(unavailable.subject,'dimension',{get(){throw Error('Removed entity')}});assert.equal(tryProjectileDodgeMovement(unavailable.subject).success,false);assert.equal(unavailable.calls.length,0);
 const notLiving=actor();notLiving.subject.getComponent=()=>undefined;assert.equal(tryProjectileDodgeMovement(notLiving.subject).success,false);assert.equal(notLiving.calls.length,0);
 const noTeleport=actor();noTeleport.subject.tryTeleport=undefined;assert.equal(tryProjectileDodgeMovement(noTeleport.subject).success,false);assert.equal(noTeleport.calls.length,0);
});
test('dimension changes and teleport API failures stop further attempts without effect/audio operations',()=>{
 const a=actor();let draws=0;const result=tryProjectileDodgeMovement(a.subject,{random:()=>{if(++draws===3)a.setDimension('minecraft:nether');return .5}});assert.equal(result.success,false);assert.equal(result.reason,'dimension_changed');assert.equal(a.calls.length,0);
 const b=actor();let tries=0;b.subject.tryTeleport=()=>{tries++;throw Error('Unsupported native teleport')};const failed=tryProjectileDodgeMovement(b.subject,{random:()=>.5});assert.equal(failed.success,false);assert.equal(tries,1);assert.equal(failed.reason,'teleport_api_failed');
});
test('observed native success is preserved if destination disappears after movement',()=>{
 let moved=false;const a=actor();Object.defineProperty(a.subject,'location',{get(){if(moved)throw Error('Removed after teleport');return {x:1,y:80,z:2}}});a.subject.tryTeleport=()=>{moved=true;return true};
 const result=tryProjectileDodgeMovement(a.subject,{random:()=>.5});assert.equal(result.success,true);assert.equal(result.attempts,1);assert.equal(result.destination,undefined);assert.equal(result.reason,'destination_unavailable');
});

test('integrated dry candidates reach native teleport while liquid and unsupported candidates consume at most16 attempts',()=>{
 const dry=actor(),accepted=tryProjectileDodgeMovement(dry.subject,{random:()=>.5});
 assert.equal(accepted.success,true);assert.equal(accepted.attempts,1);assert.equal(dry.calls.length,1);assert.ok(dry.reads.length>0);assert.equal(dry.calls[0].options.checkForBlocks,true);
 for(const block of [
  {typeId:'minecraft:water',isLiquid:true,isWaterlogged:false},
  {typeId:'minecraft:bubble_column',isLiquid:false,isWaterlogged:false},
  {typeId:'addon:unknown_script_fluid',isLiquid:false,isWaterlogged:false}
 ]){
  const a=actor({readBlock:()=>block});let draws=0;
  const result=tryProjectileDodgeMovement(a.subject,{random:()=>{draws++;return .5}});
  assert.equal(result.success,false);assert.equal(result.attempts,16);assert.equal(draws,48);assert.equal(a.calls.length,0);assert.equal(a.reads.length,32);
 }
});
test('integrated actual body rejects waterlogged head-height overlap while its feet cells are dry',()=>{
 const a=actor({readBlock:point=>point.y===81?{typeId:'minecraft:oak_slab',isLiquid:false,isWaterlogged:true}:{typeId:'minecraft:air',isLiquid:false,isWaterlogged:false}});
 const result=tryProjectileDodgeMovement(a.subject,{random:()=>.5});
 assert.equal(result.success,false);assert.equal(result.attempts,16);assert.equal(a.calls.length,0);assert.ok(a.reads.some(point=>point.y===81));assert.ok(a.reads.some(point=>point.y===80));
});
test('integrated unreadable native box or block context never permits a guessed teleport',()=>{
 for(const mode of ['missing-box','throwing-box','missing-block','throwing-block']){
  const a=actor({readBlock:()=>{if(mode==='throwing-block')throw Error('Unloaded cell');return mode==='missing-block'?undefined:{typeId:'minecraft:air',isLiquid:false,isWaterlogged:false}}});
  if(mode==='missing-box')a.subject.getAABB=undefined;
  if(mode==='throwing-box')a.subject.getAABB=()=>{throw Error('Bounds unavailable')};
  const result=tryProjectileDodgeMovement(a.subject,{random:()=>.5});
  assert.equal(result.success,false);assert.equal(result.attempts,16);assert.equal(a.calls.length,0);
  assert.equal(a.reads.length,mode.endsWith('box')?16:32);
 }
});
test('a liquid first candidate can be followed by a dry success with no stale failure reason',()=>{
 let draws=0;const a=actor({readBlock:()=>draws===3?{typeId:'minecraft:water',isLiquid:true,isWaterlogged:false}:{typeId:'minecraft:air',isLiquid:false,isWaterlogged:false}});
 const result=tryProjectileDodgeMovement(a.subject,{random:()=>{draws++;return .5}});
 assert.equal(result.success,true);assert.equal(result.attempts,2);assert.equal(draws,6);assert.equal(a.calls.length,1);assert.equal(result.reason,'');assert.deepEqual(result.destination,{x:1,y:80,z:2});
});
test('an acknowledged eject that changes dimension cannot reuse the old origin candidate in the new dimension',()=>{
 const a=actor({mounted:true}),eject=a.mount.getComponent('minecraft:rideable').ejectRider;
 a.mount.getComponent=()=>({ejectRider:target=>{eject(target);a.setDimension('minecraft:nether')}});
 const result=tryProjectileDodgeMovement(a.subject,{random:()=>.5});
 assert.equal(result.success,false);assert.equal(result.attempts,1);assert.equal(result.reason,'dimension_changed');assert.equal(a.ejected.length,1);assert.equal(a.calls.length,0);assert.equal(a.reads.length,0);
});
test('liquid integration reads the actual post-eject body rather than an earlier smaller mounted box',()=>{
 const a=actor({mounted:true,readBlock:point=>point.y===83?{typeId:'minecraft:water',isLiquid:true,isWaterlogged:false}:{typeId:'minecraft:air',isLiquid:false,isWaterlogged:false}}),boxStages=[];
 a.subject.getAABB=()=>{boxStages.push(a.ejected.length);return a.ejected.length?{center:{x:1,y:82,z:2},extent:{x:.3,y:2,z:.3}}:{center:{x:1,y:80.25,z:2},extent:{x:.3,y:.25,z:.3}}};
 const result=tryProjectileDodgeMovement(a.subject,{random:()=>.5});
 assert.equal(result.success,false);assert.equal(result.attempts,16);assert.equal(a.ejected.length,1);assert.equal(a.calls.length,0);assert.ok(a.reads.some(point=>point.y===83));assert.ok(boxStages.length>0);assert.ok(boxStages.every(stage=>stage===1));
});
test('a dry cell operation that remounts the unchanged box cannot inherit its earlier dismount permission',()=>{
 let a;a=actor({readBlock:()=>{a.setRiding(true);return {typeId:'minecraft:air',isLiquid:false,isWaterlogged:false}}});
 const result=tryProjectileDodgeMovement(a.subject,{random:()=>.5});
 assert.equal(result.success,false);assert.equal(result.attempts,1);assert.equal(result.reason,'riding_context_changed');assert.equal(a.calls.length,0);assert.equal(a.ejected.length,0);assert.ok(a.reads.length>0);
});
