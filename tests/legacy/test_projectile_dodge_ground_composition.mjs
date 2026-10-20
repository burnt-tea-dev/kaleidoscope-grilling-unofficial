/** Source operation adapters; expectations use independent source literals. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {tryProjectileDodgeMovement} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_movement_runtime.js';
const stone={typeId:'minecraft:stone',states:{stone_type:'stone'}};
const air={typeId:'minecraft:air',states:{}};
const snow={typeId:'minecraft:snow_layer',states:{covered_bit:false,height:0}};
function actor({origin={x:5.25,y:80,z:6.75},floor=p=>p.y===79?snow:p.y===78?stone:air,wet=false,teleportResults=[true],mounted=false,ejectThrows=false,ejectCommits=false}={}){
 const reads=[],calls=[],boxes=[],ejections=[];let location={...origin},riding=mounted;
 const mount={getComponent:()=>({ejectRider(target){ejections.push(target);if(!ejectThrows||ejectCommits)riding=false;if(ejectThrows)throw Error('Eject fault')},ejectRiders(){throw Error('Other rider must remain')}})};
 const dimension={id:'minecraft:overworld',heightRange:{min:-64,max:320},isChunkLoaded:()=>true,getBlock(point){
  reads.push({...point});const value=floor(point);
  return {typeId:value.typeId,isLiquid:wet&&point.x===4&&point.y===79&&point.z===6,isWaterlogged:false,permutation:{type:{id:value.typeId},getAllStates:()=>({...value.states})}};
 }};
 const entity={dimension,get location(){return {...location}},getComponent:id=>id==='minecraft:health'?{currentValue:10}:id==='minecraft:riding'&&riding?{entityRidingOn:mount}:undefined,
  getAABB(){boxes.push({...location});return {center:{x:location.x,y:location.y+.5,z:location.z},extent:{x:.45,y:.5,z:.45}}},
  tryTeleport(to,options){calls.push({to:{...to},options:{...options}});const success=teleportResults[calls.length-1]??false;if(success)location={...to};return success},
  setDynamicProperty(){throw Error('Movement may not debit effects')},playSound(){throw Error('Movement may not publish sound')}};
 return {entity,reads,calls,boxes,ejections};
}
function draws(values){let count=0;return {random(){assert.ok(count<values.length,'Unexpected additional RNG draw');return values[count++]},get count(){return count}}}
test('ground descends one cell while retaining the original sampled fractional height',()=>{
 const a=actor(),rng=draws([.5,.75,.5]);const result=tryProjectileDodgeMovement(a.entity,{random:rng.random});
 assert.equal(result.success,true);assert.equal(result.attempts,1);assert.equal(rng.count,3);
 assert.deepEqual(a.reads.slice(0,2),[{x:5,y:79,z:6},{x:5,y:78,z:6}]);
 assert.deepEqual(a.calls,[{to:{x:5.25,y:79.75,z:6.75},options:{checkForBlocks:true,keepVelocity:true}}]);
});
test('unknown ground stops its column before deeper known stone and never reaches body or teleport',()=>{
 const a=actor({floor:p=>p.y===79?{typeId:'minecraft:pale_oak_planks',states:{}}:stone}),rng=draws(Array(48).fill(.75));
 const result=tryProjectileDodgeMovement(a.entity,{random:rng.random});
 assert.equal(result.success,false);assert.equal(result.attempts,16);assert.equal(rng.count,48);assert.equal(a.calls.length,0);assert.equal(a.boxes.length,0);
 assert.equal(a.reads.length,16);assert.ok(a.reads.every(p=>p.y===79));
});
test('water intersecting only the adjusted destination body rejects the sampled-air attempt',()=>{
 const a=actor({wet:true}),rng=draws(Array.from({length:16},()=>[.5,.75,.5]).flat());
 const result=tryProjectileDodgeMovement(a.entity,{random:rng.random});
 assert.equal(result.success,false);assert.equal(result.attempts,16);assert.equal(a.calls.length,0);
 assert.deepEqual(a.reads.slice(0,3),[{x:5,y:79,z:6},{x:5,y:78,z:6},{x:4,y:79,z:6}]);
});
test('a failed teleport retries from the fixed original RNG origin and stops on the second native success',()=>{
 const a=actor({floor:p=>p.x===5&&p.y===79?snow:stone,teleportResults:[false,true]}),rng=draws([.5,.75,.5,.75,.5,.25]);
 const result=tryProjectileDodgeMovement(a.entity,{random:rng.random});
 assert.equal(result.success,true);assert.equal(result.attempts,2);assert.equal(rng.count,6);
 assert.deepEqual(a.calls.map(c=>c.to),[{x:5.25,y:79.75,z:6.75},{x:6,y:80,z:6}]);
 assert.ok(a.calls.every(c=>c.options.keepVelocity===true));
});
test('source minimum has no support read and exhausts exactly16 samples without body or teleport',()=>{
 const a=actor({origin:{x:-10.25,y:-64,z:-12.75}}),rng=draws(Array(48).fill(.5));
 const result=tryProjectileDodgeMovement(a.entity,{random:rng.random});
 assert.equal(result.success,false);assert.equal(result.attempts,16);assert.equal(rng.count,48);assert.equal(a.reads.length,0);assert.equal(a.boxes.length,0);assert.equal(a.calls.length,0);
});
test('targeted dismount precedes any ground read and acknowledges a committed removal despite a later throw',()=>{
 const failed=actor({mounted:true,ejectThrows:true}),first=draws([.5,.75,.5]);
 const no=tryProjectileDodgeMovement(failed.entity,{random:first.random});assert.equal(no.reason,'dismount_api_failed');assert.equal(no.attempts,1);
 assert.deepEqual(failed.ejections,[failed.entity]);assert.equal(failed.reads.length,0);assert.equal(failed.boxes.length,0);assert.equal(failed.calls.length,0);
 const committed=actor({mounted:true,ejectThrows:true,ejectCommits:true}),second=draws([.5,.75,.5]);
 const yes=tryProjectileDodgeMovement(committed.entity,{random:second.random});assert.equal(yes.success,true);assert.deepEqual(committed.ejections,[committed.entity]);
 assert.deepEqual(committed.calls[0].to,{x:5.25,y:79.75,z:6.75});
});
