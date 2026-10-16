import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../../projects/grilling/gameplay_core/behavior_pack/scripts/grill_visual_core.js';
import {GRILL_MODEL_INDEX} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/grill_visual_data.js';
import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
const runtime=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/grill_visual_runtime.js',import.meta.url),'utf8').replace(/^import\b[^;]*;\s*/gm,'').replace(/\bexport /g,'');
const NS='kaleidoscope_grilling:';
function fixture(direction,food){
 const entities=[],events=[],startup=[];let state={phase:0,flips:0};
 const system={currentTick:0,run:fn=>startup.push(fn),runInterval:()=>{}};
 const dimension={id:'minecraft:overworld',getEntities:()=>entities.filter(e=>e.isValid),spawnEntity(type,location,options){
  const e={typeId:type,isValid:true,location,rotation:options?.initialRotation??0,properties:{[NS+'ready']:false},pending:{},
   setProperty(k,v){this.pending[k]=v;events.push(['property',k,v]);},
   teleport(p,o){this.location=p;this.rotation=o.rotation.y;events.push(['teleport',o.rotation.y]);},remove(){this.isValid=false;}};
  entities.push(e);events.push(['spawn',e.rotation,options]);return e;
 }};
 const block={typeId:NS+'grill',dimension,location:{x:1,y:70,z:3},permutation:{getState:()=>direction}};
 const viewers=[{dimensionId:dimension.id,x:1,y:70,z:3}];
 const context=vm.createContext({...core,canonicalFoodId,grillingConfig:()=>({fixedGrillHelpers:100}),secretVisualState:()=>[1,2,3],peekStationContainer:()=>({getItem:()=>({typeId:food})}),readGrillState:()=>state,system,world:{getAllPlayers:()=>[],getDimension:()=>dimension},console});
 vm.runInContext(runtime,context);
 return {entities,events,system,sync:()=>context.syncGrillDisplay(block,viewers),leave:()=>context.syncGrillDisplay(block,[]),
  publish(){system.currentTick++;for(const e of entities){Object.assign(e.properties,e.pending);e.pending={};}},
  flip(){state={phase:1,flips:1};},reload(){startup[0]();}};
}
const yaw={north:-0,east:-90,south:-180,west:-270};
function assertSpawns(f,expected){
 for(const [kind,rotation,options] of f.events)if(kind==='spawn'){
  assert.ok(options&&Object.hasOwn(options,'initialRotation'),'initial orientation must be supplied in spawnEntity, not repaired by teleport');
  assert.equal(rotation,expected);
 }
}
test('actual runtime supplies final yaw at birth for every raw/custom model and grill slot, before next-tick property publication',()=>{
 for(const direction of Object.keys(yaw))for(const food of [...Object.keys(GRILL_MODEL_INDEX),NS+'secret_skewer']){
  const f=fixture(direction,food);f.sync();assert.equal(f.entities.length,3);assertSpawns(f,yaw[direction]);
  for(const e of f.entities)assert.equal(e.properties[NS+'ready'],false);
  f.publish();for(const e of f.entities){assert.equal(e.properties[NS+'ready'],true);assert.equal(e.rotation,yaw[direction]);}
  const writes=f.events.length;for(let tick=2;tick<=15;tick++){f.system.currentTick=tick;f.sync();}
  assert.equal(f.events.length,writes,'stable slots must not rely on a later corrective update');
 }
});
test('reconnect, invalid helper replacement, reload cleanup and flip interaction retain the same authoritative yaw',()=>{
 for(const direction of Object.keys(yaw)){
  const f=fixture(direction,NS+'secret_skewer');f.sync();f.publish();
  f.flip();f.sync();assert.equal(f.entities.length,3);f.publish();
  for(const e of f.entities){assert.equal(e.properties[NS+'flips'],1);assert.equal(e.rotation,yaw[direction]);}
  f.entities[0].isValid=false;f.sync();assert.equal(f.entities.length,4);
  f.leave();f.sync();assert.equal(f.entities.length,7);
  f.reload();f.sync();assert.equal(f.entities.length,10);
  f.publish();assertSpawns(f,yaw[direction]);
  assert.equal(f.entities.filter(e=>e.isValid).length,3);
 }
});
