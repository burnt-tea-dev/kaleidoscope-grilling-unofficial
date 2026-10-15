import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {SLIME_ID,readSlimeWorldFrame} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/slime_frame_core.js';
/** Source transforms and fault-injected production display; no native client evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as visual from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_recipe_visual_core.js';
import {RAW_TO_COOKED} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/data.js';
import {GRILL_MODEL_INDEX} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/grill_visual_data.js';
import {eatingItemId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {VisualTargetQueue} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/visual_target_queue.js';
import {queueStationContentsVisual,takeStationContentsVisualDirty} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/station_contents_visual_queue.js';
import {captureSkewerMetadata,metadataSignature} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js';
import {rackToolVisualModel,RACK_TOOL_VISUAL_TYPE} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/rack_tool_visual_data.js';
import {SECRET_MODEL_VARIANTS_KEY} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state_core.js';
const NS='kaleidoscope_grilling:',base=new URL('../../projects/grilling/gameplay_core/',import.meta.url);
const source=fs.readFileSync(new URL('behavior_pack/scripts/station_contents_visual_runtime.js',base),'utf8');
const json=path=>JSON.parse(fs.readFileSync(new URL(path,base),'utf8'));
const close=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-10,`${message}: ${a} != ${b}`);
class Stack{
 constructor(typeId,props={}){Object.assign(this,{typeId,amount:1,maxAmount:1,props:structuredClone(props),lore:[{translate:'foreign:saved_lore'}],nameTag:'saved stack'});}
 clone(){return Object.assign(new Stack(this.typeId),structuredClone({...this}));}
 getDynamicProperty(k){return this.props[k]}getDynamicPropertyIds(){return Object.keys(this.props)}
 getRawLore(){return structuredClone(this.lore)}getCanDestroy(){return []}getCanPlaceOn(){return []}getComponent(){}
}
const readIngredients=(stack,cooked)=>JSON.parse(stack.props[cooked&&stack.props[NS+'secret_cooked_ingredients']?NS+'secret_cooked_ingredients':NS+'skewer_ingredients']??'[]');
function fixture({cap=32,budget=8,spawn='valid'}={}){
 takeStationContentsVisualDirty(Infinity);
 const spawned=[],commands=[],blocks=new Map(),scheduled=[],intervals=[],dp=new Map(),reads=[],retained=[];
 let tick=0,spawnMode=spawn;
 const loc=p=>[p.x,p.y,p.z].join('/');
 const dim={id:'minecraft:overworld',getBlock(at){reads.push({...at});return blocks.get(loc(at))},getEntities({type}){return retained.filter(e=>e.typeId===type)},spawnEntity(typeId,location){
  const e={id:'helper-'+spawned.length,typeId,location:{...location},valid:spawnMode==='unknown'?undefined:true,properties:{},removeMode:'allow',
   get isValid(){return this.valid},teleport(at,options){this.location={...at};this.rotation=options.rotation},setProperty(k,v){this.properties[k]=v},runCommand(command){commands.push(command)},
   remove(){if(this.removeMode==='throw')throw Error('unavailable remove');if(this.removeMode==='allow')this.valid=false;}
  };spawned.push(e);if(spawnMode==='throw')throw Error('unknown spawn');return spawnMode==='no-handle'?undefined:e;
 }};
 const players=[{dimension:dim,location:{x:0,y:64,z:0}}];
 const world={getAllPlayers:()=>players,getDimension:id=>['minecraft:overworld','overworld'].includes(id)?dim:{id,getEntities:()=>[],getBlock:()=>undefined},getDynamicPropertyIds:()=>[...dp.keys()],getAbsoluteTime:()=>tick,
  afterEvents:Object.fromEntries(['playerPlaceBlock','playerInteractWithBlock','playerBreakBlock'].map(name=>[name,{subscribe(){}}])),beforeEvents:{playerInteractWithBlock:{subscribe(){}}}};
 const system={get currentTick(){return tick},run(fn){scheduled.push(fn)},runInterval(fn,ticks){intervals.push({fn,ticks})},runJob(job){for(const _ of job){}}};
 const ctx=vm.createContext({...visual,canonicalFoodId,SLIME_ID,readSlimeWorldFrame,RACK_TOOL_VISUAL_TYPE,rackToolVisualModel,VisualTargetQueue,takeStationContentsVisualDirty,captureSkewerMetadata,metadataSignature,world,system,
  console:{warn(){}},grillingConfig:()=>({contentsHelpers:cap,contentsTargetsPerTick:budget}),STORAGE_PREFIX:'storage/',registerStationProjection(){},
  a25ReadPlateBlock:b=>b.stacks,a25RestoreStack:s=>s.clone(),a25ReadRecipeDisplayStack:b=>b.result?.clone(),readPublicFood:()=>({present:false,valid:false}),stationProjection:()=>({data:0})
 });
 const stripped=source.replace(/^import\b[\s\S]*?;\s*/gm,'').replace(/^export \{.*?\};\s*/gm,'').replace(/\bexport (?=(function|const))/g,'');
 vm.runInContext(stripped+'\nthis.api={render,discard,clear,pump,index,targets,work,orphaned,syncStationContentsVisual,rememberStationVisual,markStationContentsDirty,configureSecretVisuals,contentsVisualHelperCount};',ctx);
 ctx.api.configureSecretVisuals(readIngredients);
 const add=(type='skewer_plate_block',x=0,face='south')=>{const b={typeId:NS+type,x,y:64,z:0,location:{x,y:64,z:0},dimension:dim,permutation:{getState:()=>face},stacks:[]};blocks.set(loc(b),b);return b;};
 const sync=b=>ctx.api.syncStationContentsVisual(b,players.map(p=>({dimensionId:p.dimension.id,...p.location})));
 return {api:ctx.api,add,sync,spawned,commands,blocks,scheduled,intervals,dp,reads,dim,players,retained,get tick(){return tick},set tick(v){tick=v},set spawn(v){spawnMode=v},count:()=>ctx.api.contentsVisualHelperCount()};
}

test('all 15 Java plate slots and their independent cardinal rotations survive the count-dependent layout',()=>{
 const expected=[[],[[8,4,6.3,0]],[[5.6,4.15,5.95,0],[10.4,4.2,5.9,0]],[[5.6,3.95,6.35,0],[10.4,4,6.3,0],[8,7.375,7.65,-22.5]],[[8,3.95,6.35,0],[12.55,4,6.3,0],[3.45,4,6.3,0],[8,7.325,7.7,-45]],[[8,3.95,6.35,0],[12.55,4,6.3,0],[3.45,4,6.3,0],[10.4,7.325,7.4,-22.5],[5.7,7.375,7.35,-22.5]]];
 assert.deepEqual(visual.PLATE_LAYOUTS,expected);
 for(const [face,baseAngle] of Object.entries({south:0,west:90,north:180,east:270}))for(let count=1;count<=5;count++)for(let i=0;i<count;i++){
  const b={x:17,y:64,z:-9,permutation:{getState:()=>face}},slot=expected[count][i],p=visual.plateSlotPose(b,count,i),dx=slot[0]/16-.5,dz=slot[2]/16-.5;
  const [x,z]=face==='south'?[dx,dz]:face==='west'?[-dz,dx]:face==='north'?[-dx,-dz]:[dz,-dx];
  close(p.location.x,17.5+x,'source X');close(p.location.y,64+slot[1]/16,'source Y');close(p.location.z,-8.5+z,'source Z');assert.equal(p.angle,baseAngle-slot[3]);
 }
 assert.equal(visual.plateSlotPose({permutation:{getState:()=> 'south'}},0,0),undefined);
});
test('plate and recipe model selection canonicalizes raw/cooked aliases and keeps ordinary/foreign fallback explicit',()=>{
 for(const [raw,index] of Object.entries(GRILL_MODEL_INDEX))for(const [id,stage,icon] of [[raw,0,index*2],[RAW_TO_COOKED[raw],4,index*2+1]])for(const alias of [id,eatingItemId(id,true),eatingItemId(id,false,false)]){
  assert.equal(visual.plateMeshPlan(new Stack(alias),readIngredients).model,id===SLIME_ID?115:index*6+stage);assert.equal(visual.recipeIconModel(new Stack(alias)),icon);
 }
 for(const id of [NS+'ordinary_skewer','foreign:food'])assert.equal(visual.plateMeshPlan(new Stack(id),readIngredients),undefined);
 assert.equal(visual.recipeIconModel(new Stack(NS+'ordinary_skewer')),38);assert.equal(visual.recipeIconModel(new Stack('foreign:food')),undefined);
});
test('secret meshes preserve shape variants and cooked cache without rewriting any item metadata',()=>{
 const raw=[{id:'minecraft:beef'},{id:'minecraft:potato'},{id:'minecraft:carrot'}],cooked=[{id:'minecraft:cooked_beef'},{id:'minecraft:baked_potato'},{id:'minecraft:carrot'}];
 const s=new Stack(eatingItemId(NS+'secret_skewer',true),{[NS+'skewer_ingredients']:JSON.stringify(raw),[NS+'secret_cooked_ingredients']:JSON.stringify(cooked),[NS+'secret_cooked']:true,[SECRET_MODEL_VARIANTS_KEY]:'[4,5,6]','foreign:payload':'unchanged'}),before=s.clone();
 const plan=visual.plateMeshPlan(s,readIngredients);assert.equal(plan.model,114);assert.ok(plan.secret.every(v=>Number.isInteger(v)&&v>0&&v<=5333));assert.deepEqual(s,before);
 s.props[SECRET_MODEL_VARIANTS_KEY]='[6,5,4]';assert.notDeepEqual(visual.plateMeshPlan(s,readIngredients).secret,plan.secret);
 s.props[NS+'secret_cooked']=false;assert.notDeepEqual(visual.plateMeshPlan(s,readIngredients).secret,plan.secret);
});
test('fixed and secret plate copies use one helper per skewer and reflow surviving slots without losing native data',()=>{
 const f=fixture(),b=f.add();b.stacks=[new Stack(NS+'raw_beef_skewer'),new Stack(NS+'secret_skewer',{[NS+'skewer_ingredients']:JSON.stringify([{id:'minecraft:beef'},{id:'minecraft:potato'},{id:'minecraft:carrot'}])}),new Stack(NS+'ordinary_skewer')];
 const before=b.stacks.map(s=>s.clone());f.sync(b);assert.equal(f.count(),3);assert.deepEqual(f.spawned.map(e=>e.typeId),[visual.PLATE_FOOD_VISUAL_TYPE,visual.PLATE_FOOD_VISUAL_TYPE,NS+'equipment_visual']);
 assert.deepEqual(b.stacks,before);assert.equal(f.spawned[1].properties[NS+'model'],114);assert.equal(f.commands.length,2);
 const at={...f.spawned[0].location};b.stacks.pop();f.sync(b);assert.equal(f.count(),2);assert.notDeepEqual(f.spawned[0].location,at);assert.equal(f.spawned[2].valid,false);assert.equal(f.spawned.length,3);
});
test('wall recipe renders the supplied result snapshot, including secret state and ordinary GUI icon',()=>{
 const f=fixture(),b=f.add('skewer_recipe');
 for(const id of [NS+'raw_beef_skewer',NS+'ordinary_skewer',NS+'secret_skewer']){
  b.result=new Stack(id,{[NS+'skewer_ingredients']:JSON.stringify([{id:'minecraft:beef'},{id:'minecraft:potato'},{id:'minecraft:carrot'}])});const before=b.result.clone();f.sync(b);
  const e=[...f.api.targets.values()][0].parts.get('recipe/result').entity;
  assert.equal(e.typeId,id.endsWith('secret_skewer')?visual.CUSTOM_RECIPE_ICON_VISUAL_TYPE:visual.RECIPE_ICON_VISUAL_TYPE);assert.deepEqual(b.result,before);assert.equal(f.count(),1);
  if(id.endsWith('secret_skewer')){
   assert.equal(e.properties[NS+'gui_count'],3);
   const colors=[0,1,2].map(i=>e.properties[NS+'gui_color_'+i]);assert.equal(new Set(colors).size,3);
   b.result.props[NS+'model_variants']='[7,4,9]';b.result.props[NS+'secret_cooked']=true;
   b.result.props[NS+'secret_cooked_ingredients']=JSON.stringify([{id:'minecraft:cooked_beef'},{id:'minecraft:baked_potato'},{id:'minecraft:carrot'}]);
   const updated=b.result.clone();f.sync(b);assert.equal(f.count(),1);assert.deepEqual(b.result,updated);
   assert.equal(e.properties[NS+'gui_bits'],5);assert.notDeepEqual([0,1,2].map(i=>e.properties[NS+'gui_color_'+i]),colors);
  }
 }
 b.typeId='minecraft:air';f.sync(b);assert.equal(f.count(),0);assert.equal(f.api.targets.size,0);
});
test('premium vat projection updates within the existing quota and drops on empty/non-premium state without owning its fluid',()=>{
 const f=fixture({cap:1}),b=f.add('big_vat'),state={[NS+'vat_level']:1,[NS+'vat_fluid']:'premium_chili'};
 b.permutation={getState:key=>state[key]};f.dp.set(NS+'a26_vat_minecraft_overworld_p0_p64_p0','{"type":"premium_chili","buckets":1}');
 const before=new Map(f.dp);f.api.index();f.api.pump();const e=f.spawned[0];
 assert.equal(e.typeId,visual.VAT_PREMIUM_VISUAL_TYPE);assert.equal(e.properties[NS+'level'],1);assert.equal(f.count(),1);assert.equal(f.commands.length,0);
 f.tick=48;state[NS+'vat_level']=4;f.sync(b);assert.equal(e.properties[NS+'frame'],3);assert.equal(e.properties[NS+'level'],4);assert.equal(f.spawned.length,1);
 state[NS+'vat_fluid']='lava';f.sync(b);assert.equal(f.count(),0);assert.equal(e.valid,false);assert.deepEqual(f.dp,before);
 state[NS+'vat_fluid']='premium_chili';state[NS+'vat_level']=0;f.sync(b);assert.equal(f.count(),0);
});
test('slime wall animation selects all five source frames on its four-tick clock within the shared display budget',()=>{
 const f=fixture(),b=f.add('skewer_recipe');b.result=new Stack(NS+'grilled_slime_skewer');
 for(let time=0;time<24;time++){f.tick=time;f.sync(b);assert.equal(f.spawned[0].properties[NS+'frame'],Math.floor(time/4)%5);}
 assert.equal(f.spawned.length,1);assert.equal(f.count(),1);
 for(const invalid of [-1,undefined,NaN])assert.equal(visual.recipeAnimationFrame(invalid),0);
});
test('failed removal keeps both tracking and quota and blocks replacement until invalidity is confirmed',()=>{
 const f=fixture({cap:1}),b=f.add();b.stacks=[new Stack('foreign:food')];f.sync(b);const old=f.spawned[0];old.removeMode='deny';b.stacks=[new Stack(NS+'raw_beef_skewer')];f.sync(b);
 assert.equal(f.count(),1);assert.equal(f.spawned.length,1);assert.equal([...f.api.targets.values()][0].parts.get('plate/0').entity,old);
 f.players.length=0;f.sync(b);assert.equal(f.count(),1);assert.equal(f.api.work.cleanup.size,1);
 old.removeMode='allow';f.api.pump();assert.equal(f.count(),0);assert.equal(old.valid,false);
});
for(const spawn of ['unknown','no-handle','throw'])test('unconfirmed '+spawn+' spawn reserves its part and cap instead of endlessly spawning',()=>{
 const f=fixture({cap:1,spawn}),b=f.add();b.stacks=[new Stack(NS+'raw_beef_skewer')];assert.throws(()=>f.sync(b),/spawn/);
 for(let n=0;n<4;n++)f.sync(b);assert.equal(f.spawned.length,1);assert.equal(f.count(),1);
 b.stacks.push(new Stack(NS+'raw_fish_skewer'));f.sync(b);assert.equal(f.spawned.length,1);assert.equal(f.count(),1);
 if(spawn==='unknown'){f.spawned[0].valid=true;f.sync(b);assert.equal(f.spawned[0].properties[NS+'ready'],true);f.spawned[0].valid=false;b.stacks=[];f.sync(b);assert.equal(f.count(),0);}
});
test('nearby indexing is chunk-read bounded, preserves saved payloads, and restores displays after unload',()=>{
 const f=fixture({budget:2}),b=f.add('skewer_recipe'),far=f.add('skewer_recipe',1000);b.result=new Stack(NS+'raw_fish_skewer');far.result=new Stack(NS+'ordinary_skewer');
 f.dp.set(NS+'a25_recipe_minecraft_overworld_p0_p64_p0','saved');f.dp.set(NS+'a25_recipe_minecraft_overworld_p1000_p64_p0','far');f.dp.set(NS+'a25_recipe_minecraft_overworld_p0_p64_p0_delivery','receipt');
 const before=new Map(f.dp);f.api.index();assert.equal(f.api.targets.size,2);f.api.pump();assert.equal(f.count(),1);assert.ok(f.reads.every(at=>at.x===0));assert.deepEqual(f.dp,before);
 f.blocks.delete('0/64/0');f.api.pump();assert.equal(f.count(),0);assert.deepEqual(f.dp,before);f.blocks.set('0/64/0',b);f.api.pump();assert.equal(f.count(),1);assert.deepEqual(f.dp,before);
});
test('post-commit coordinate queue deduplicates, respects drain budget, and owns no ItemStack',()=>{
 const f=fixture({budget:1}),first=f.add('skewer_recipe'),second=f.add('skewer_recipe',2);first.result=new Stack(NS+'raw_beef_skewer');second.result=new Stack(NS+'raw_fish_skewer');
 queueStationContentsVisual(first);queueStationContentsVisual(first);queueStationContentsVisual(second);first.result.nameTag='latest committed result';
 f.api.pump();assert.equal(f.api.targets.size,1);f.api.pump();assert.equal(f.api.targets.size,2);assert.deepEqual(takeStationContentsVisualDirty(1),[]);
 const bad={dimension:f.dim,location:{x:.5,y:64,z:0}};queueStationContentsVisual(bad);assert.deepEqual(takeStationContentsVisualDirty(1),[]);
});
test('startup cleanup retries transient leftovers fairly and reserves their cap until removal is confirmed',()=>{
 let mayRemove=false;
 const f=fixture({cap:1}),e1={id:'old-a',typeId:visual.PLATE_FOOD_VISUAL_TYPE,isValid:true,remove(){}},e2={id:'old-b',typeId:visual.RECIPE_ICON_VISUAL_TYPE,isValid:true,remove(){if(mayRemove)this.isValid=false}};
 f.dim.getEntities=({type})=>type===e1.typeId?[e1]:type===e2.typeId?[e2]:[];
 f.scheduled.shift()();assert.equal(f.api.orphaned.size,2);assert.equal(f.count(),2);
 mayRemove=true;f.api.pump();f.api.pump();assert.equal(f.api.orphaned.size,1);assert.equal(f.count(),1);assert.equal(e2.isValid,false);
 const b=f.add();b.stacks=[new Stack(NS+'raw_beef_skewer')];f.sync(b);assert.equal(f.spawned.length,0);
});
test('unrelated vanilla interactions never fill the station target queue, while a destroyed known target still cleans up',()=>{
 const f=fixture(),stone=f.add();stone.typeId='minecraft:stone';f.api.markStationContentsDirty(stone);assert.equal(f.api.targets.size,0);
 stone.typeId=NS+'skewer_plate_block';stone.stacks=[new Stack(NS+'raw_beef_skewer')];f.api.markStationContentsDirty(stone);f.api.pump();assert.equal(f.count(),1);
 stone.typeId='minecraft:air';f.api.markStationContentsDirty(stone);f.api.pump();assert.equal(f.count(),0);assert.equal(f.api.targets.size,0);
});
test('display resources reuse audited meshes/palette and constrain helpers to transient render-only properties',()=>{
 const grill=json('resource_pack/entity/grill_food_visual.entity.json')['minecraft:client_entity'].description,plate=json('resource_pack/entity/plate_food_visual.entity.json')['minecraft:client_entity'].description;
 for(const [key,value] of Object.entries(grill.geometry))assert.equal(plate.geometry[key],value);
 for(const [key,value] of Object.entries(grill.textures))assert.equal(plate.textures[key],value);
 assert.equal(Object.keys(plate.geometry).length,Object.keys(grill.geometry).length+117);
 assert.equal(Object.keys(plate.textures).length,Object.keys(grill.textures).length+117);
 assert.deepEqual(plate.render_controllers.slice(1),grill.render_controllers.slice(1));
 assert.deepEqual(plate.render_controllers[0],{'controller.render.kg_station.plate':"q.property('kaleidoscope_grilling:ready')"});
 const original=json('resource_pack/render_controllers/grill_food_visual.render_controllers.json').render_controllers['controller.render.kg_station.grill'];
 const extended=json('resource_pack/render_controllers/plate_food_visual.render_controllers.json').render_controllers['controller.render.kg_station.plate'];
 for(const [kind,name] of [['geometries','Array.models'],['textures','Array.stages']]){
  assert.deepEqual(extended.arrays[kind][name].slice(0,115),original.arrays[kind][name]);assert.equal(extended.arrays[kind][name].length,232);
 }
 assert.ok(plate.scripts.pre_animation.every(s=>!s.includes('flip')));
 for(const name of ['plate_food_visual','recipe_icon_visual','custom_recipe_icon_visual','vat_premium_visual']){const b=json('behavior_pack/entities/'+name+'.json')['minecraft:entity'];assert.deepEqual(b.components['minecraft:transient'],{});assert.equal(b.components['minecraft:inventory'],undefined);assert.deepEqual(b.components['minecraft:physics'],{has_gravity:false,has_collision:false});assert.equal(b.description.properties[NS+'ready'].default,false);}
 const icon=json('resource_pack/entity/recipe_icon_visual.entity.json')['minecraft:client_entity'].description;
 for(const [id,index] of Object.entries(visual.RECIPE_ICON_MODELS)){const path=icon.textures['s'+index];assert.equal(path,'textures/items/'+id.slice(NS.length));const bytes=fs.readFileSync(new URL('resource_pack/'+path+'.png',base));assert.equal(bytes.readUInt32BE(16),16);assert.equal(bytes.readUInt32BE(20),16);}
 const cube=json('resource_pack/models/entity/recipe_icon_visual.geo.json')['minecraft:geometry'][0].bones[0].cubes[0];assert.deepEqual(cube.origin,[-3.84,-3.84,0]);assert.deepEqual(cube.size,[7.68,7.68,0]);assert.deepEqual(Object.keys(cube.uv),['north','south']);
 const paper=json('resource_pack/models/blocks/skewer_recipe.geo.json')['minecraft:geometry'][0].bones[0].cubes[0];assert.deepEqual(paper.origin,[-5,1.5,7.75]);assert.deepEqual(paper.size,[10,13,.25]);
});
test('plate mesh transform and flattened wall fallback equal the Java FIXED transform in model coordinates',()=>{
 const bone=json('resource_pack/animations/plate_food_visual.animation.json').animations['animation.kg_station.plate_food'].bones.root;
 const rotate=(p,axis,deg)=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),[x,y,z]=p;return axis==='x'?[x,y*c-z*s,y*s+z*c]:[x*c-y*s,x*s+y*c,z];};
 const add=(p,v)=>p.map((n,i)=>n+v[i]),scale=(p,v)=>p.map((n,i)=>n*(Array.isArray(v)?v[i]:v));
 const evalValue=(value,props)=>typeof value==='number'?value:Function('q','return ('+value+');')({property:k=>props[k]});
 for(const secret of [false,true])for(const wall of [false,true])for(const p of [[0,0,0],[8,8,8],[16,16,16],[3.4,5.95,12.1]]){
  const props={[NS+'model']:secret?114:0,[NS+'display_mode']:wall?1:0},g=[8-p[0],p[1]-(secret?0:1),p[2]-8];
  let bed=scale(g,bone.scale.map(v=>evalValue(v,props)));bed=rotate(bed,'x',evalValue(bone.rotation[0],props));bed=rotate(bed,'z',evalValue(bone.rotation[2],props));bed=add(bed,bone.position.map(v=>evalValue(v,props)));
  let java=scale(add(p,[-8,-8,-8]),1.5);java=rotate(rotate(java,'z',-180),'x',-90);java=add(java,[0,2.25,9.75]);
  java=wall?scale(rotate(scale(java,[1,1,.1/2.75]),'z',-55),.5):rotate(rotate(scale(java,.8),'x',90),'z',180);java[0]*=-1;
  for(let i=0;i<3;i++)close(bed[i],java[i],`${secret}/${wall}/axis${i}`);
 }
});

test('plate failure stacks use real source models and cooked slime follows the shared world clock without changing saved stacks',()=>{
 const f=fixture(),b=f.add();
 b.stacks=[new Stack(NS+'mysterious_skewer',{[NS+'failed_skewer_source']:NS+'raw_beef_skewer'}),new Stack(NS+'dark_grilling',{[SECRET_MODEL_VARIANTS_KEY]:'[4,5,6]'}),new Stack(SLIME_ID),new Stack(NS+'raw_slime_skewer')];
 const before=b.stacks.map(s=>s.clone());
 for(let tick=0;tick<24;tick++){
  f.tick=tick;f.sync(b);assert.equal(f.count(),4);assert.ok(f.spawned.every(e=>e.typeId===visual.PLATE_FOOD_VISUAL_TYPE));
  for(let i=0;i<2;i++)assert.equal(f.spawned[i].properties[NS+'model'],visual.plateMeshPlan(b.stacks[i],readIngredients).model);
  assert.equal(f.spawned[2].properties[NS+'model'],115+Math.floor(tick/4)%5);
  assert.equal(f.spawned[3].properties[NS+'model'],GRILL_MODEL_INDEX[NS+'raw_slime_skewer']*6);
  assert.deepEqual(b.stacks,before);
 }
 assert.equal(f.commands.length,0);assert.equal(f.spawned.length,4);
 b.stacks[0].props[NS+'failed_skewer_source']=NS+'raw_fish_skewer';f.sync(b);
 assert.equal(f.spawned[0].properties[NS+'model'],visual.plateMeshPlan(b.stacks[0],readIngredients).model);
 assert.equal(f.spawned.length,4);
});
