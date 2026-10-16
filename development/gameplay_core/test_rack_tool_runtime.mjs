/** Production render body and resource contract, not a native client simulation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {SLIME_ID,readSlimeWorldFrame} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/slime_frame_core.js';
import {RACK_TOOL_VISUAL_TYPE,RACK_TOOL_MODEL_INDEX,rackToolVisualModel} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/rack_tool_visual_data.js';
import {TOOL_ITEM_IDS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2746_advanced_rack_core.js';
import {PLATE_FOOD_VISUAL_TYPE,RECIPE_ICON_VISUAL_TYPE,plateMeshPlan,recipeIconModel} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_recipe_visual_core.js';
const source=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/station_contents_visual_runtime.js',import.meta.url),'utf8');
const TYPE='kaleidoscope_grilling:equipment_visual';
const start=source.indexOf('function render(row,'),end=source.indexOf('\nexport function syncStationContentsVisual(',start);
function fixture(){
 const row={parts:new Map()},spawned=[],removed=[],native=[];
 const dimension={spawnEntity(typeId,location){
  const entity={typeId,isValid:true,location,properties:{},teleport(location,options){this.location=location;this.options=options},setProperty(key,value){this.properties[key]=value},remove(){this.isValid=false;removed.push(this)}};
  spawned.push(entity);return entity;
 }};
 const block={dimension};
 const ctx=vm.createContext({canonicalFoodId,SLIME_ID,readSlimeWorldFrame,world:{getAbsoluteTime:()=>0},TYPE,RACK_TOOL_VISUAL_TYPE,rackToolVisualModel,PLATE_FOOD_VISUAL_TYPE,RECIPE_ICON_VISUAL_TYPE,plateMeshPlan,recipeIconModel,reader:undefined,helpers:0,lastCapacityWarning:-1200,system:{currentTick:0},console,grillingConfig:()=>({contentsHelpers:32}),
  metadataSignature:JSON.stringify,captureSkewerMetadata:s=>structuredClone(s),renderItemType:(entity,stack)=>native.push({entity,stack}),
  discard(r,k){const old=r.parts.get(k);if(old){old.entity.remove();r.parts.delete(k);ctx.helpers--;}return true;}});
 vm.runInContext(source.slice(start,end),ctx);
 return {row,block,spawned,removed,native,render:(stack,mode=0,k='rack/5',angle=0)=>ctx.render(row,block,k,stack,{location:{x:1,y:2,z:3},angle},mode)};
}
test('exact six canonical accepted IDs select audited sprites; arbitrary tags never choose guessed art',()=>{
 assert.deepEqual(Object.keys(RACK_TOOL_MODEL_INDEX),[...TOOL_ITEM_IDS]);
 for(const [id,index] of Object.entries(RACK_TOOL_MODEL_INDEX))assert.equal(rackToolVisualModel(id),index);
 for(const id of [undefined,'custom:knife','kaleidoscope_cookery:kitchen_shovel_has_oil','__proto__','toString'])assert.equal(rackToolVisualModel(id),undefined);
});
test('all known rack tools use ready-gated deterministic helpers without equipping or editing the ItemStack',()=>{
 for(const [id,index] of Object.entries(RACK_TOOL_MODEL_INDEX)){
  const f=fixture(),stack={typeId:id,amount:1,nameTag:'Saved knife',damage:21,enchantments:[{id:'unbreaking',level:2}]},before=structuredClone(stack);
  f.render(stack);assert.equal(f.spawned.length,1);const entity=f.spawned[0];
  assert.equal(entity.typeId,RACK_TOOL_VISUAL_TYPE);assert.deepEqual(entity.properties,{'kaleidoscope_grilling:model':index,'kaleidoscope_grilling:ready':true});
  assert.equal(f.native.length,0);assert.deepEqual(stack,before);f.render(stack);assert.equal(f.spawned.length,1);
 }
});
test('generic tagged extension rack items preserve the native pose-zero path',()=>{
 const f=fixture(),stack={typeId:'custom:knife'};f.render(stack);
 assert.equal(f.spawned[0].typeId,TYPE);assert.equal(f.native.length,1);assert.equal(f.native[0].stack,stack);
 assert.deepEqual(f.spawned[0].properties,{'kaleidoscope_grilling:pose':0});
});
test('known IDs on plate/composed modes never take the rack helper branch',()=>{
 class Stack{constructor(typeId){this.typeId=typeId;this.maxAmount=1;}getDynamicProperty(){return undefined;}}
 for(const mode of [1,2])for(const id of Object.keys(RACK_TOOL_MODEL_INDEX)){
  const f=fixture();f.render(new Stack(id),mode,'plate/0');assert.equal(f.spawned[0].typeId,TYPE);
  assert.equal(f.native.length,1);assert.equal(f.spawned[0].properties['kaleidoscope_grilling:pose'],mode);
 }
});
test('switching between native and known tools replaces only that helper; missing item retires it',()=>{
 const f=fixture();f.render({typeId:'custom:knife'});f.render({typeId:'kaleidoscope_cookery:iron_kitchen_knife'});
 assert.equal(f.spawned.length,2);assert.equal(f.removed.length,1);assert.equal(f.spawned[1].typeId,RACK_TOOL_VISUAL_TYPE);
 f.render({typeId:'minecraft:flint_and_steel'});assert.equal(f.spawned.length,2);assert.equal(f.spawned[1].properties['kaleidoscope_grilling:model'],5);
 f.render({typeId:'custom:knife'});assert.equal(f.spawned.length,3);assert.equal(f.removed.length,2);
 f.render(undefined);assert.equal(f.removed.length,3);assert.equal(f.row.parts.size,0);
});
test('new helpers preserve all four facing rotations and independent slot identities',()=>{
 for(const angle of [0,90,180,270]){
  const f=fixture();for(let slot=5;slot<9;slot++)f.render({typeId:'kaleidoscope_cookery:iron_kitchen_knife'},0,'rack/'+slot,angle);
  assert.equal(f.row.parts.size,4);for(const e of f.spawned){assert.equal(e.options.rotation.x,0);assert.equal(e.options.rotation.y,-angle);}
  f.render(undefined,0,'rack/6');assert.deepEqual([...f.row.parts.keys()],['rack/5','rack/7','rack/8']);
 }
});
test('startup clears exactly the six reviewed transient render types and keeps one visual loop',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../../tools/fixtures/g125-main-reviewed-delta.json',import.meta.url),'utf8'));
 assert.deepEqual(receipt.release,[2,8,125]);
 const reviewed=execFileSync('git',['show',receipt.reviewed_commit+':projects/grilling/gameplay_core/behavior_pack/scripts/station_contents_visual_runtime.js'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});
 const expected='for(const type of [TYPE,RACK_TOOL_VISUAL_TYPE,PLATE_FOOD_VISUAL_TYPE,RECIPE_ICON_VISUAL_TYPE,CUSTOM_RECIPE_ICON_VISUAL_TYPE,VAT_PREMIUM_VISUAL_TYPE])';
 for(const [name,text] of [['reviewed G125 source',reviewed],['current source',source]])
  assert.deepEqual(text.match(/for\(const type of \[[^\]]+\]\)/g),[expected],name);
 assert.equal((source.match(/system\.runInterval\(pump,1\)/g)??[]).length,1);
});
