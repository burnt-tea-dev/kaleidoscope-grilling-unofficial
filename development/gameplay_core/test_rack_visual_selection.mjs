import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {advancedRackToolVisuals,ADVANCED_RACK_HOOK_X} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/advanced_rack_visual_core.js';
import {RACK_SEASONING_X,RACK_TOOL_X,rackDisplayPose,rackSeasoningOccupancy} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/advanced_rack_layout.js';
import {RACK_TOOL_VISUAL_Y,RACK_TOOL_VISUAL_Z} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/advanced_rack_layout.js';
import {rackToolVisualModel} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/rack_tool_visual_data.js';
import {rackSlotAtHit} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_rack_quick_pick.js';
const source=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/station_contents_visual_runtime.js',import.meta.url),'utf8');
function sync(rows,oldKeys=[]){
 const out=[],discarded=[],parts=new Map(oldKeys.map(k=>[k,{}]));
 const row={dimensionId:'test',parts};
 const block={typeId:'kaleidoscope_grilling:advanced_rack_block',x:0,y:0,z:0};
 const read=[];
 const ctx={rackToolVisualModel,RACK_TOOL_VISUAL_Y,RACK_TOOL_VISUAL_Z,rememberStationVisual(){},syncRackDisplay(){},targets:new Map([['rack',row]]),key:()=> 'rack',peekStationContainer:()=>({getItem(i){read.push(i);return rows[i]}}),advancedRackToolVisuals,rackDisplayPose:(_b,x,y,z)=>({x,y,z}),render:(_r,_b,key,stack,at,mode)=>{if(stack)out.push({key,stack,at,mode})},discard:(_r,k)=>{discarded.push(k);parts.delete(k)},clear(){},work:{remove(){}}};
 const start=source.indexOf('export function syncStationContentsVisual('),end=source.indexOf('\nfunction index()',start);
 assert.ok(start>=0&&end>start);vm.runInNewContext(source.slice(start,end).replace('export ',''),ctx);
 ctx.syncStationContentsVisual(block,[{dimensionId:'test',x:0,y:0,z:0}]);return {out,discarded,read};
}
test('all nine occupied slots render all four tools without extra shelf helpers',()=>{
 const rows=Array.from({length:9},(_,i)=>({typeId:'fixture:'+i})),f=sync(rows);
 assert.deepEqual(f.out.map(x=>x.key),['rack/5','rack/6','rack/7','rack/8']);
 assert.equal(rows[8].typeId,'fixture:8');
});
test('all tool occupancy masks keep fixed slot positions without changing inventory',()=>{
 assert.deepEqual(ADVANCED_RACK_HOOK_X,[-5.25/16,-1.75/16,1.75/16,5.25/16]);
 for(let mask=0;mask<16;mask++){
  const rows=Array(9);for(let i=0;i<4;i++)if(mask&(1<<i))rows[5+i]={typeId:'fixture:'+i};
  const before=rows.slice(),expected=[5,6,7,8].filter(i=>rows[i]),plan=advancedRackToolVisuals(i=>rows[i]),f=sync(rows);
  assert.deepEqual(plan.map(x=>x.slot),expected);assert.deepEqual(plan.map(x=>x.hook),expected.map(i=>i-5));
  assert.deepEqual(f.out.map(x=>x.key),expected.map(i=>'rack/'+i));assert.deepEqual(f.out.map(x=>x.at.x),expected.map(i=>ADVANCED_RACK_HOOK_X[i-5]));
  assert.deepEqual(rows,before);for(let i=0;i<plan.length;i++)assert.equal(plan[i].stack,rows[expected[i]]);
 }
});
test('upper spice-level appearance never spawns an additional equipped item',()=>{
 const rows=Array.from({length:5},(_,i)=>({typeId:'fixture:seasoning_'+i}));
 assert.equal(sync(rows).out.length,0);
 const read=[];advancedRackToolVisuals(i=>{read.push(i);return rows[i]});assert.deepEqual(read,[5,6,7,8]);
});
test('slot eight never moves when earlier tools are added or removed',()=>{
 const rows=Array(9);rows[6]={typeId:'fixture:first'};rows[8]={typeId:'fixture:last'};
 const f=sync(rows);assert.deepEqual(f.out.map(x=>x.key),['rack/6','rack/8']);assert.deepEqual(f.out.map(x=>x.at.x),[ADVANCED_RACK_HOOK_X[1],ADVANCED_RACK_HOOK_X[3]]);
});
test('old upper helpers retire, while the fourth tool remains visible and stored',()=>{
 const rows=Array.from({length:9},(_,i)=>({typeId:'fixture:'+i})),keys=Array.from({length:9},(_,i)=>'rack/'+i),f=sync(rows,keys);
 assert.deepEqual(f.discarded,['rack/0','rack/1','rack/2','rack/3','rack/4']);assert.equal(rows.filter(Boolean).length,9);
});
test('no tools produces no visual rows',()=>assert.deepEqual(advancedRackToolVisuals(()=>undefined),[]));

test('all nine fixed cells invert the display transform for all four facings',()=>{
 for(const direction of ['north','east','south','west']){
  const block={x:17,y:64,z:-9,permutation:{getState:()=>direction}};
  for(let slot=0;slot<9;slot++){
   const x=slot<5?RACK_SEASONING_X[slot]:RACK_TOOL_X[slot-5],y=slot<5?12/16:6/16;
   const at=rackDisplayPose(block,x,y,.35).location;
   assert.equal(rackSlotAtHit(direction,{x:at.x-block.x,y:at.y-block.y,z:at.z-block.z}),slot,`${direction} slot${slot}`);
  }
 }
 // Independent cardinal fixtures, including the old E/W inversion bug.
 assert.equal(rackSlotAtHit('east',{x:.15,y:.8,z:.15}),0);
 assert.equal(rackSlotAtHit('west',{x:.85,y:.8,z:.85}),0);
 for(const hit of [undefined,{x:NaN,y:.8,z:.8},{x:0,y:.8,z:.8},{x:.5,y:.9,z:.8},{x:.5,y:.2,z:.8}])assert.equal(rackSlotAtHit('north',hit),-1);
 assert.equal(rackSlotAtHit('invalid',{x:.5,y:.8,z:.5}),-1);
});

test('all32 shelf occupancy masks identify exact saved slots without compaction',()=>{
 for(let mask=0;mask<32;mask++){
  const rows=Array.from({length:9},(_,i)=>i>=5||(mask&(1<<i))?{typeId:'fixture:'+i}:undefined),before=rows.slice(),read=[];
  assert.equal(rackSeasoningOccupancy(i=>{read.push(i);return rows[i];}),mask);
  assert.deepEqual(read,[0,1,2,3,4]);
  const f=sync(rows);assert.deepEqual(f.out.map(x=>x.key),['rack/5','rack/6','rack/7','rack/8']);
  assert.deepEqual(f.out.map(x=>x.at.x),ADVANCED_RACK_HOOK_X);assert.deepEqual(rows,before);
 }
});

test('known sprite centers match clicked tool row while extensions retain native anchor',()=>{
 const rows=Array(9);rows[5]={typeId:'kaleidoscope_cookery:iron_kitchen_knife'};rows[8]={typeId:'custom:knife'};const f=sync(rows);
 assert.equal(f.out[0].at.y,7/16);assert.equal(f.out[1].at.y,.35);assert.equal(f.out[0].at.z,3/16);assert.equal(f.out[1].at.z,3/16);
});

// Exercise the actual runtime depth, not a hypothetical pose supplied by the test.
// The oracle comes from the block selection box and block transformation JSON.
test('displayed tool centers lie on actual selection face and oblique aim selects their saved slot',async()=>{
 const {rackAimHit}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/rack_aim_hit.js');
 const definition=JSON.parse(fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/blocks/advanced_rack_block.json',import.meta.url),'utf8'))['minecraft:block'];
 const faceZ=definition.components['minecraft:selection_box'].origin[2]/16;
 const tools=['iron_kitchen_knife','gold_kitchen_knife','diamond_kitchen_knife','netherite_kitchen_knife','kitchen_shovel'].map(id=>'kaleidoscope_cookery:'+id).concat('minecraft:flint_and_steel');
 for(const typeId of tools)for(let slot=5;slot<9;slot++){
  const rows=Array(9);rows[slot]={typeId};const visual=sync(rows).out[0];
  assert.equal(visual.at.z,faceZ,'runtime helper must use the clickable front face, not empty space ahead of rack');
  for(const facing of ['north','east','south','west']){
   const block={x:0,y:0,z:0,permutation:{getState:()=>facing}};
   const anchor=rackDisplayPose(block,visual.at.x,visual.at.y,visual.at.z).location;
   const outward={north:[0,0,-1],east:[1,0,0],south:[0,0,1],west:[-1,0,0]}[facing];
   const tangent={north:[1,0,0],east:[0,0,1],south:[-1,0,0],west:[0,0,-1]}[facing];
   for(const side of [-2,-1,0,1,2])for(const rise of [-.5,0,.5]){
    const origin=Object.fromEntries(['x','y','z'].map((axis,i)=>[axis,anchor[axis]+outward[i]*2+tangent[i]*side+(i===1?rise:0)]));
    const direction=Object.fromEntries(['x','y','z'].map(axis=>[axis,anchor[axis]-origin[axis]]));
    const hit=rackAimHit(origin,direction,facing);
    assert.equal(rackSlotAtHit(facing,hit),slot,`${typeId}/${facing}/${slot}/${side}/${rise}`);
   }
  }
 }
});
