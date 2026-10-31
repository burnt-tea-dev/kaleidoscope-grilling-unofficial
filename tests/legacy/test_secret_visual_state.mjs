/** Source-backed visual state checks; no Minecraft/client-rendering claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {SECRET_FOOD_COUNT,SECRET_VISUAL_MAX,SECRET_MODEL_VARIANTS_KEY,modelVariant,readModelVariants,appendedModelVariants,encodeSecretVisual,decodeSecretVisual,secretHeldMarker} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state_core.js';
import {configureItemDataWorld,getItemProperty,setItemProperty} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/core/persist.js';
import {secretVisualState} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state.js';
import {secretVisualIndex} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/integration_registry_core.js';
const N='kaleidoscope_grilling:';
test('all supported foods, shapes and seven stage styles have collision-free legacy-safe properties',()=>{
 assert.equal(SECRET_FOOD_COUNT,225);assert.equal(SECRET_VISUAL_MAX,5345);
 const seen=new Set();for(let food=1;food<=225;food++)for(let shape=1;shape<=3;shape++)for(let style=0;style<7;style++){
  const value=encodeSecretVisual(food,shape+3,style===6?4:style,style===6);assert.ok(value<=SECRET_VISUAL_MAX);assert.equal(seen.has(value),false);seen.add(value);
  assert.deepEqual(decodeSecretVisual(value),{food,shape,style});
 }
 for(let food=1;food<=225;food++)assert.deepEqual(decodeSecretVisual(food),{food,shape:1,style:0});
 assert.equal(encodeSecretVisual(0,4,5),0);assert.equal(encodeSecretVisual(226,4,0),0);assert.equal(decodeSecretVisual(226).food,0);
 for(let food=0;food<=225;food++)assert.equal(secretHeldMarker(food),food<=213?food:food<=217?food+7:food+9);
 for(const invalid of [-1,226,255,0.5,NaN])assert.throws(()=>secretHeldMarker(invalid));
});
test('Java stored4..9 values retain shapes and old unrecorded variants use stable migration defaults',()=>{
 assert.deepEqual([4,5,6,7,8,9].map(modelVariant),[1,2,3,1,2,3]);
 assert.deepEqual(readModelVariants(undefined,2),[4,4]);assert.deepEqual(readModelVariants('[5,8]',2),[5,8]);
 assert.deepEqual(appendedModelVariants('[5,8]',2,()=>.99),[5,8,9]);assert.deepEqual(appendedModelVariants(undefined,2,()=>0),[4,4,4]);
});
class Stack{
 constructor(){this.typeId=N+'secret_skewer';this.maxAmount=64;this.lore=[];this.raw=[{id:'minecraft:apple'},{id:'minecraft:carrot'},{id:'minecraft:beef'}];this.cached=[...this.raw.slice(0,2),{id:'minecraft:cooked_beef'}]}
 getRawLore(){return structuredClone(this.lore)}setLore(lore){this.lore=structuredClone(lore)}clone(){return Object.assign(new Stack(),structuredClone({...this}))}
}
test('variants persist through real content-addressed metadata cloning and visual reads do not mutate items',()=>{
 const saved=new Map();configureItemDataWorld({getDynamicProperty:k=>saved.get(k),setDynamicProperty:(k,v)=>saved.set(k,v)});
 const stack=new Stack();setItemProperty(stack,SECRET_MODEL_VARIANTS_KEY,'[4,5,9]');setItemProperty(stack,N+'secret_cooked_ingredients',JSON.stringify(stack.cached));
 const read=(s,cooked)=>cooked?s.cached:s.raw,copy=stack.clone();assert.equal(getItemProperty(copy,SECRET_MODEL_VARIANTS_KEY),'[4,5,9]');const before=JSON.stringify(copy);
 for(let stage=0;stage<6;stage++){
  const state=secretVisualState(copy,read,stage).map(decodeSecretVisual);assert.deepEqual(state.map(x=>x.shape),[1,2,3]);
  assert.equal(state[2].food,secretVisualIndex(stage>=4?'minecraft:cooked_beef':'minecraft:beef'));assert.equal(state[2].style,stage===4?6:stage);
 }
 assert.equal(JSON.stringify(copy),before);setItemProperty(copy,N+'secret_cooked',true);
 assert.equal(secretVisualState(copy,read).map(decodeSecretVisual)[2].style,6);
});
test('actual partial rows0/1/2 carry count and shape without cooked rows or fake helper food',async()=>{
 const {partialVisualState}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state.js');
 const metadata=new Map();configureItemDataWorld({getDynamicProperty:k=>metadata.get(k),setDynamicProperty:(k,v)=>metadata.set(k,v)});
 const stack=new Stack();stack.typeId=N+'unfinished_skewer';setItemProperty(stack,SECRET_MODEL_VARIANTS_KEY,'[6,5]');setItemProperty(stack,N+'secret_cooked',true);setItemProperty(stack,N+'secret_cooked_ingredients',JSON.stringify(stack.cached));
 const read=(s,cooked)=>{assert.equal(cooked,false);return s.raw};
 for(let count=0;count<=2;count++){
  stack.raw=[{id:'minecraft:apple'},{id:'minecraft:carrot'}].slice(0,count);const packed=partialVisualState(stack,read),decoded=packed.map(decodeSecretVisual);
  assert.deepEqual(decoded.slice(0,count).map(x=>x.style),Array(count).fill(count));
  assert.deepEqual(decoded.slice(0,count).map(x=>x.shape),[3,2].slice(0,count));assert.equal(packed.slice(count).every(x=>x===0),true);
 }
 stack.raw=[{id:'foreign:unsupported'},{id:'minecraft:carrot'}];const decoded=partialVisualState(stack,read).map(decodeSecretVisual);assert.equal(decoded[0].food,0);assert.equal(decoded[0].shape,3);assert.equal(decoded[0].style,2);
});
test('unsupported completed ingredient retains its source shape for supported neighboring seams',()=>{
 const stack=new Stack();const metadata=new Map();configureItemDataWorld({getDynamicProperty:k=>metadata.get(k),setDynamicProperty:(k,v)=>metadata.set(k,v)});
 setItemProperty(stack,SECRET_MODEL_VARIANTS_KEY,'[6,5,4]');stack.raw[0]={id:'foreign:unsupported'};
 const decoded=secretVisualState(stack,s=>s.raw,0).map(decodeSecretVisual);assert.deepEqual(decoded.map(x=>x.shape),[3,2,1]);assert.equal(decoded[0].food,0);
});

/** Execute runtime APIs and parsed resource expressions; not native-render proof. */
import fs from 'node:fs';
import {packPlateHeldSecret,PLATE_HELD_WORD_A_MAX,PLATE_HELD_WORD_B_MAX} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_held_visual_core.js';
import {writeHeldVisual,heldVisualPropertyNames,HELD_VISUAL_WORD_MAX} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/held_visual_transport.js';
const base=new URL('../../projects/grilling/gameplay_core/',import.meta.url);
const json=p=>JSON.parse(fs.readFileSync(new URL(p,base)));
// This subset executes the actual arithmetic/conditional resource statements,
// with native property/item queries supplied at their API boundary.
function expression(statement,v,marker,hand='main_hand'){
 const q={has_property:()=>true,property:()=>marker,is_item_name_any:()=>true};
 const c={item_slot:hand};
 const math={floor:Math.floor,clamp:(x,a,b)=>Math.min(b,Math.max(a,x))};
 return Function('v','c','q','math',statement.replaceAll('c.owning_entity->q.','q.'))(v,c,q,math);
}
test('225 food encodings preserve every legacy packet and all helper owners are disjoint',()=>{
 assert.equal(SECRET_FOOD_COUNT,225);assert.equal(SECRET_VISUAL_MAX,5345);
 for(let food=1;food<=225;food++)for(let shape=1;shape<=3;shape++)for(let style=0;style<=6;style++){
  const packed=encodeSecretVisual(food,shape+3,style===6?4:style,style===6);
  assert.equal(packed,food+256*(shape-1+3*style));
  assert.deepEqual(decodeSecretVisual(packed),{food,shape,style});
 }
 for(let food=0;food<=225;food++)assert.equal(secretHeldMarker(food),food<=213?food:food<=217?food+7:food+9);
 for(const food of [-1,226,NaN,.1])assert.throws(()=>secretHeldMarker(food));
 for(const marker of [214,215,216,217,218,219,220,225,226,254,255]){
  assert.throws(()=>writeHeldVisual({id:`invalid${marker}`,setProperty(){}},'main','secret',[...Array(11).fill(0),marker]));
 }
 for(let food=218;food<=225;food++){
  const values=new Map(),player={id:`new${food}`,setProperty:(k,v)=>values.set(k,v)};
  assert.equal(writeHeldVisual(player,'main','secret',[...Array(8).fill(0),food,food,food,secretHeldMarker(food)]),true);
  assert.equal(values.get(heldVisualPropertyNames('main')[11]),food+9);
  assert.equal(writeHeldVisual(player,'main','failure',[0,0,food,...Array(8).fill(0),220]),true);
 }
});
test('actual helper decode and occupied gates retain old rows, accept new foods, reject oil and reserved owners',()=>{
 for(const name of ['secret_skewer','secret_skewer_java_three_alt','secret_skewer_native_plain','unfinished_skewer']){
  const scripts=json(`resource_pack/attachables/${name}.attachable.json`)['minecraft:attachable'].description.scripts.pre_animation;
  const selected=scripts.filter(s=>typeof s==='string'&&['v.kg_secret_marker =','v.kg_secret_piece_index =','v.kg_secret_owner_occupied ='].some(p=>s.startsWith(p)));
  for(const hand of ['main_hand','off_hand'])for(let marker=0;marker<=255;marker++){
   const v={kg_secret_ingredient_0:1,kg_secret_ingredient_1:1,kg_secret_ingredient_2:1,kg_secret_terminal_wait:0};
   for(const s of selected)expression(s,v,marker,hand);
   const valid=marker<=213||(marker>=221&&marker<=224)||(marker>=227&&marker<=234);
   assert.equal(Boolean(v.kg_secret_owner_occupied),valid,`${name}/${hand}/${marker}`);
   if(name==='secret_skewer'||name==='secret_skewer_java_three_alt')assert.equal(v.kg_secret_piece_index,marker<=213?marker:marker>=221&&marker<=224?marker-7:marker>=227&&marker<=234?marker-9:0);
  }
 }
});
test('maximum reachable plate words fit the unchanged hand bank within the 27-property budget and decode losslessly',()=>{
 const values=[];for(let food=1;food<=225;food++)for(let shape=1;shape<=3;shape++)for(let style=0;style<=6;style++)values.push(food+256*(shape-1+3*style));
 const max=Math.max(...values),maxRemainder=Math.max(...values.map(v=>v%64)),maxHigh=Math.max(...values.map(v=>Math.floor(v/64)));
 assert.equal(PLATE_HELD_WORD_A_MAX,max+8192*maxRemainder);assert.equal(PLATE_HELD_WORD_B_MAX,1+maxHigh+128*max);assert.equal(HELD_VISUAL_WORD_MAX,PLATE_HELD_WORD_B_MAX);
 const props=json('behavior_pack/entities/player.json')['minecraft:entity'].description.properties;assert.ok(Object.keys(props).length<=27);
 for(const middle of values){
  const cells=[max,middle,max],[a,b]=packPlateHeldSecret(cells);
  assert.deepEqual([a%8192,Math.floor(a/8192)+64*((b-1)%128),Math.floor((b-1)/128)],cells);
  assert.ok(a<=PLATE_HELD_WORD_A_MAX&&b<=PLATE_HELD_WORD_B_MAX);
  for(const hand of ['main','off']){
   const keys=heldVisualPropertyNames(hand),words=[a,b,a,b,a,b,a,b,a,b,5,255];
   for(let i=0;i<12;i++)assert.ok(words[i]<=props[keys[i]].range[1]);
  }
 }
});

test('all configured foods render their own palette and nonempty source shapes in held and placed contexts',async()=>{
 const path=await import('node:path');const {fileURLToPath}=await import('node:url');const pack=fileURLToPath(base),rp=path.join(pack,'resource_pack');
const {secretVisualRows}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state.js');
const json=p=>JSON.parse(fs.readFileSync(p));const math={floor:Math.floor,clamp:(x,a,b)=>Math.min(b,Math.max(a,x))};
const ids=['beef_chunks','chicken_skin','squid_tentacle','raw_sweet_potato_sheet','minced_houttuynia','potato_slice','carrot_dice','raw_mantou_slice'];
const geo=new Map();for(const file of fs.readdirSync(path.join(rp,'models/entity'))){if(!file.endsWith('.json'))continue;for(const g of json(path.join(rp,'models/entity',file))['minecraft:geometry']??[])geo.set(g.description.identifier,g)}
const cases=[],fixtures=[];
for(const id of ids)for(let style=0;style<7;style++)for(let shape=4;shape<=6;shape++){
 const inputs=Array.from({length:3},()=>({id:'kaleidoscope_grilling:'+id}));const packed=secretVisualRows(inputs,JSON.stringify([shape,shape,shape]),style===6?4:style,style===6);
 for(const context of ['held','plate']){
 const ap=context==='held'?'attachables/secret_skewer.attachable.json':'entity/plate_food_visual.entity.json';const kind=context==='held'?'minecraft:attachable':'minecraft:client_entity';const desc=json(path.join(rp,ap))[kind].description;
 const rcs=json(path.join(rp,'render_controllers/'+(context==='held'?'secret_held':'grill_food_visual')+'.render_controllers.json')).render_controllers;
 const v={};packed.forEach((p,i)=>v['kg_secret_ingredient_'+i]=p);
 for(const line of desc.scripts.pre_animation??[]){if(typeof line==='string'&&/^v\.kg_secret_(food_\d|shape_\d|style_\d|state) =/.test(line))Function('v','math',line)(v,math)}
 const actual=[];
 for(let slot=0;slot<3;slot++){
 const rc=rcs[`controller.render.${context==='held'?'kg_secret_held':'kg_station.secret'}.${slot}`];const arrays=Object.fromEntries(Object.entries({...rc.arrays.geometries,...rc.arrays.textures}).map(([k,v])=>[k.replace('Array.',''),v]));
 const run=e=>Function('v','math','Array',`return ${e}`)(v,math,arrays);
 const gkey=run(rc.geometry).replace('Geometry.',''),tkey=run(rc.textures[0]).replace('Texture.','');const geometry=desc.geometry[gkey],texture=desc.textures[tkey];const cubes=(geo.get(geometry)?.bones??[]).reduce((s,b)=>s+(b.cubes?.length??0),0);
 const expectedIndex=218+ids.indexOf(id);const expectedTexture=`textures/secret_food_palette/food_${expectedIndex}_${style}`;
 actual.push({slot,food:v['kg_secret_food_'+slot],geometry,texture,cubes});cases.push({id:`${id}/${style}/${shape}/${context}/${slot}`,input:{ingredients:inputs,variant:shape,style,packed},expected:{food:expectedIndex,texture:expectedTexture,nonemptyGeometry:true},actual:actual.at(-1),pass:v['kg_secret_food_'+slot]===expectedIndex&&texture===expectedTexture&&cubes>0});
 }
 if(style===0&&shape===4)fixtures.push({id,context,inputs,packed,selected:actual});
 }
}
 for(const row of cases)assert.equal(row.pass,true,JSON.stringify(row));
 assert.equal(cases.length,1008);
});

test('new raw ingredient helpers resolve through actual secret and failure controller arrays to nonempty models and existing textures',()=>{
 const rp=new URL('../../projects/grilling/gameplay_core/resource_pack/',import.meta.url),geometries=new Map();
 function collect(path){for(const row of fs.readdirSync(path,{withFileTypes:true})){
  const child=new URL(row.name+(row.isDirectory()?'/':''),path);
  if(row.isDirectory())collect(child);
  else if(row.name.endsWith('.json'))for(const model of JSON.parse(fs.readFileSync(child))['minecraft:geometry']??[])geometries.set(model.description.identifier,model);
 }}
 collect(new URL('models/',rp));
 const plain=json('resource_pack/attachables/secret_skewer_native_plain.attachable.json')['minecraft:attachable'].description;
 assert.equal(plain.render_controllers.includes('controller.render.kg_secret_held.piece'),false,'native plain intentionally has no opposite-hand helper');
 for(const [file,controller,names] of [
  ['secret_held','controller.render.kg_secret_held.piece',['secret_skewer','secret_skewer_java_three_alt']],
  ['failure_skewer_held','controller.render.kg_failure_held.helper',['mysterious_skewer','mysterious_skewer_java_three_alt','mysterious_skewer_native_plain','dark_grilling','dark_grilling_java_three_alt','dark_grilling_native_plain']]
 ]){
  const rc=json(`resource_pack/render_controllers/${file}.render_controllers.json`).render_controllers[controller];
  for(const name of names){
   const desc=json(`resource_pack/attachables/${name}.attachable.json`)['minecraft:attachable'].description;
   for(const hand of ['main_hand','off_hand'])for(let food=218;food<=225;food++){
    const v={},arrays={};
    const scriptPrefixes=file==='secret_held'?['v.kg_secret_marker =','v.kg_secret_piece_index =']:['v.kg_failure_helper_index ='];
    for(const statement of desc.scripts.pre_animation.filter(s=>typeof s==='string'&&scriptPrefixes.some(p=>s.startsWith(p))))expression(statement,v,file==='secret_held'?secretHeldMarker(food):food,hand);
    assert.equal(v[file==='secret_held'?'kg_secret_piece_index':'kg_failure_helper_index'],food,`${name}/${hand}/${food}: actual decoded helper`);
    if(!desc.render_controllers.includes(controller)){assert.ok(name.endsWith('_native_plain'),'only plain variants intentionally suppress the helper controller');continue;}
    for(const entries of Object.values(rc.arrays))for(const [key,items] of Object.entries(entries))arrays[key.split('.')[1]]=items.map(ref=>{
     const [kind,alias]=ref.split('.');return (kind==='Geometry'?desc.geometry:desc.textures)[alias];
    });
    const evaluate=expr=>Function('Array','v','return '+expr)(arrays,v);
    const geometry=evaluate(rc.geometry),texture=evaluate(rc.textures[0]);
    assert.ok(geometry,`${name}/${food}: controller geometry must resolve`);
    assert.ok(texture,`${name}/${food}: controller texture must resolve`);
    assert.ok(geometries.get(geometry)?.bones?.some(b=>b.cubes?.length),`${name}/${food}: helper must have visible geometry`);
    assert.ok(fs.existsSync(new URL(texture+'.png',rp)),`${name}/${food}: helper texture must exist`);
   }
  }
 }
});

// Restricted arithmetic evaluator: this verifies lifecycle dependencies, not a Molang VM.
test('cold secret attachable initialization does not read pre-animation marker state',()=>{
 for(const name of ['secret_skewer','secret_skewer_java_three_alt']){
  const scripts=json(`resource_pack/attachables/${name}.attachable.json`)['minecraft:attachable'].description.scripts;
  for(const hand of ['main_hand','off_hand'])for(const staleMarker of [undefined,230]){
   const state={kg_secret_marker:staleMarker};
   const v=new Proxy(state,{get(target,key){
    if(key==='kg_secret_marker')throw new Error('initialize read pre-animation-only marker');
    return target[key];
   }});
   for(const statement of scripts.initialize)expression(statement,v,0,hand);
   assert.equal(v.kg_secret_piece_index,0,`${name}/${hand}: no helper before first frame`);
   assert.equal(v.kg_secret_owner_occupied,0);
   assert.equal(v.kg_secret_piece_visible,0);
   // Use a distinct pre-animation store: initialize need not expose the same store.
   const frame={kg_secret_ingredient_0:1,kg_secret_ingredient_1:1,kg_secret_ingredient_2:1};
   for(const statement of scripts.pre_animation.filter(s=>['v.kg_secret_marker =','v.kg_secret_piece_index =','v.kg_secret_owner_occupied ='].some(p=>s.startsWith(p))))expression(statement,frame,230,hand);
   assert.equal(frame.kg_secret_piece_index,221);
   assert.equal(Boolean(frame.kg_secret_owner_occupied),true);
  }
 }
});

// T3.5-c isolated transport scenarios share this visual domain suite.
{
const {plateHeldVisualPlan,PLATE_HELD_WORD_A_MAX,PLATE_HELD_WORD_B_MAX}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_held_visual_core.js');
const {plateRows}=await import('../native/held-snapshot/scripts/cases.js');
const {createSnapshotPublisher,snapshotExpression,FRAME_PROPERTY,WORD_MAX,variableName}=await import('../native/held-snapshot/scripts/snapshot.js');
const math={floor:Math.floor};
function apply(expression,frame,variables={}){
 // Execute the real generated assignments/commit against a query boundary.
 // This models language arithmetic; no client variable scope is simulated.
 Function('q','v',expression.replace('?{','?(()=>{').replace('};return 0;','})():0;return 0;'))({property:key=>{assert.equal(key,FRAME_PROPERTY);return frame;}},variables);
 return variables;
}
const actor=()=>({id:'source',props:{},calls:[],setProperty(name,value){this.props[name]=value;},playAnimation(animation,options){this.calls.push({animation,...options});}});
test('a single complete snapshot preserves both five-row plates, cooked snapshots and shapes',()=>{
 const mainRows=plateRows(0),offRows=plateRows(1),before=JSON.stringify([mainRows,offRows]);
 const main=plateHeldVisualPlan(mainRows),off=plateHeldVisualPlan(offRows),expression=snapshotExpression(1,main,off);
 assert.equal(main[10],5);assert.equal(off[10],5);assert.notDeepEqual(main,off);
 const variables=apply(expression,1);
 for(const [hand,words] of [['main',main],['off',off]])for(const [i,value] of words.entries())assert.equal(variables[variableName(hand,i).slice(2)],value);
 assert.equal(variables.kg_snapshot_frame,1);assert.equal(JSON.stringify([mainRows,offRows]),before);
 for(let index=0;index<5;index++)assert.equal(mainRows[index].native.props['snapshot_probe:foreign'],'preserve');
});
test('stale frame never overwrites current data; new full payload replaces every word',()=>{
 const a=plateHeldVisualPlan(plateRows(0)),b=plateHeldVisualPlan(plateRows(1));
 const old=snapshotExpression(1,a,b),next=snapshotExpression(2,b,a),v=apply(next,2);
 const before=structuredClone(v);apply(old,2,v);assert.deepEqual(v,before);
 apply(snapshotExpression(3,Array(12).fill(0),Array(12).fill(0)),3,v);
 assert.equal(v.kg_snapshot_frame,3);
 for(const hand of ['main','off'])for(let i=0;i<12;i++)assert.equal(v[variableName(hand,i).slice(2)],0);
});
test('bounded integer interpolation rejects invalid/injected/oversize words before any native call',()=>{
 const valid=Array(12).fill(0);
 for(const invalid of [-1,WORD_MAX+1,.5,NaN,Infinity,'0;v.foreign=1'])assert.throws(()=>snapshotExpression(1,[invalid,...valid.slice(1)],valid));
 assert.throws(()=>snapshotExpression(0,valid,valid));assert.throws(()=>snapshotExpression(1,valid.slice(1),valid));
 const maximum=Array.from({length:5},()=>[PLATE_HELD_WORD_A_MAX,PLATE_HELD_WORD_B_MAX]).flat().concat([5,255]);
 const actual=apply(snapshotExpression(1000000,maximum,maximum),1000000);
 assert.equal(actual.kg_snapshot_m9,PLATE_HELD_WORD_B_MAX);assert.equal(actual.kg_snapshot_o10,5);
 for(const value of Object.values(actual))assert.equal(Math.fround(value),value);
});
test('unchanged display is quiet, same-ID metadata changes send a new complete snapshot, replay targets a viewer',()=>{
 const publisher=createSnapshotPublisher(),player=actor(),a=plateHeldVisualPlan(plateRows(0)),b=plateHeldVisualPlan(plateRows(1));
 assert.equal(publisher.publish(player,a,b),true);const first=player.calls[0];
 assert.equal(publisher.publish(player,a,b),false);assert.equal(player.calls.length,1);
 assert.equal(publisher.publish(player,b,a),true);assert.equal(player.props[FRAME_PROPERTY],2);
 assert.notEqual(player.calls[1].stopExpression,first.stopExpression);
 const viewer={id:'observer'};publisher.replay(player,[viewer]);
 assert.deepEqual(player.calls.at(-1).players,[viewer]);assert.equal(player.props[FRAME_PROPERTY],2);
 publisher.forget(player.id);assert.equal(publisher.replay(player,[viewer]),false);
});
test('failed native submit retains its pending generation and retries before marking data sent',()=>{
 const publisher=createSnapshotPublisher(),player=actor(),a=plateHeldVisualPlan(plateRows(0)),b=plateHeldVisualPlan(plateRows(1));
 const native=player.playAnimation;player.playAnimation=()=>{throw Error('native failure');};
 assert.throws(()=>publisher.publish(player,a,b));assert.equal(player.props[FRAME_PROPERTY],1);
 player.playAnimation=native;assert.equal(publisher.publish(player,a,b),true);assert.equal(player.props[FRAME_PROPERTY],1);
 assert.equal(publisher.publish(player,a,b),false);assert.equal(player.calls.length,1);
});

const {execFileSync}=await import('node:child_process');
const {fileURLToPath}=await import('node:url');
test('generated plate consumer reads owning-player data for each hand and hides stale or absent snapshots',()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const converted=execFileSync('python3',['-c','import sys;sys.path.insert(0,"tools");from held_snapshot_probe import readers,SOURCE;print(readers((SOURCE/"resource_pack/attachables/skewer_plate.attachable.json").read_text()))'],{cwd:root,timeout:10000});
 const lines=JSON.parse(converted)['minecraft:attachable'].description.scripts.pre_animation.slice(0,5);
 const main=plateHeldVisualPlan(plateRows(0)),off=plateHeldVisualPlan(plateRows(1)),snapshot=apply(snapshotExpression(7,main,off),7);
 for(const hand of ['main_hand','off_hand'])for(const has of [false,true])for(const frame of [6,7]){
  const local={kg_snapshot_frame:999,kg_snapshot_m10:0,kg_snapshot_o10:0};
  const owner={v:snapshot,q:{has_property:key=>has&&key===FRAME_PROPERTY,property:key=>{assert.equal(key,FRAME_PROPERTY);return frame;},is_item_name_any:()=>true}};
  for(const line of lines)Function('v','c','owner','math',line.replaceAll('c.owning_entity->q.','owner.q.').replaceAll('c.owning_entity->v.','owner.v.'))(local,{item_slot:hand},owner,math);
  assert.equal(local.kg_plate_count,has&&frame===7?5:0);
 }
});

}
