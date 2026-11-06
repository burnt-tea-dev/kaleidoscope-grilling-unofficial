import {execFileSync as runPython} from 'node:child_process';
import {fileURLToPath as pathOf} from 'node:url';
/** Source-backed visual state checks; no Minecraft/client-rendering claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {SECRET_FOOD_COUNT,SECRET_VISUAL_MAX,SECRET_MODEL_VARIANTS_KEY,modelVariant,readModelVariants,appendedModelVariants,encodeSecretVisual,decodeSecretVisual,secretHeldMarker} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state_core.js';
import {configureItemDataWorld,getItemProperty,setItemProperty} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/core/persist.js';
import {secretVisualState} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state.js';
import {secretVisualIndex} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/integration_registry_core.js';
import * as formal from '../../projects/grilling/gameplay_core/behavior_pack/scripts/held_visual_transport.js';
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

// Formal transport exercises the real writer and generated readers. The
// historical C-1 cases below retain their separate, narrower evidence scope.
function formalActor(id='formal'){
 return {id,props:{},calls:[],getProperty(key){return this.props[key]},setProperty(key,value){this.props[key]=value},
  playAnimation(animation,options){this.calls.push({animation,...options})}};
}
function formalApply(call,frame,variables={}){
 Function('q','v',call.stopExpression.replace('?{','?(()=>{').replace('};return','})():0;return'))({property:key=>{assert.equal(key,formal.FRAME_PROPERTY);return frame}},variables);
 return variables;
}
test('formal staged owners send one complete two-hand snapshot and never write retired bank properties',()=>{
 const player=formalActor('owners');
 const cases=[['empty',Array(12).fill(0)],['bottle',[1,...Array(10).fill(0),214]],
  ['secret',[...Array(8).fill(0),1,2,3,1]],['failure',[1,2,3,...Array(8).fill(0),220]],
  ['slime',[...Array(11).fill(0),215]],['oilpot',[4,...Array(10).fill(0),226]],
  ['oilbrush',[60,...Array(10).fill(0),225]],['plate',[...Array(10).fill(684244),5,255]]];
 for(const [index,[kind,words]] of cases.entries()){
  writeHeldVisual(player,'main',kind,words);writeHeldVisual(player,'off',kind,words);
  assert.equal(player.calls.length,index);flushHeldVisual(player,index);
  assert.deepEqual(Object.keys(player.props),[formal.FRAME_PROPERTY]);
  const variables=formalApply(player.calls.at(-1),player.props[formal.FRAME_PROPERTY]);
  for(const hand of ['main','off'])for(let i=0;i<12;i++)assert.equal(variables[formal.variableName(hand,i).slice(2)],words[i]);
 }
});
test('formal publisher retains pending data after native failure, rejects stale requests and refreshes re-created clients',()=>{
 let tick=0;const publisher=formal.createSnapshotPublisher(()=>tick),player=formalActor(),words=Array(12).fill(0);
 player.props[formal.FRAME_PROPERTY]=67;const send=player.playAnimation;
 player.playAnimation=()=>{throw Error('native failure')};
 assert.throws(()=>publisher.publish(player,words,words));assert.equal(player.props[formal.FRAME_PROPERTY],68);
 player.playAnimation=send;publisher.publish(player,words,words);assert.equal(player.props[formal.FRAME_PROPERTY],68);
 const first=player.calls[0];tick=99;assert.equal(publisher.publish(player,words,words),false);
 publisher.replay(player,[{id:'late'}]);tick=100;assert.equal(publisher.publish(player,words,words),true);
 assert.equal(player.props[formal.FRAME_PROPERTY],68);assert.deepEqual(formalApply(player.calls.at(-1),68),formalApply(first,68));
 words[0]=1;publisher.publish(player,words,words);const variables=formalApply(player.calls.at(-1),69),before=structuredClone(variables);
 formalApply(first,69,variables);assert.deepEqual(variables,before);
 publisher.forget(player.id);publisher.publish(player,words,words);assert.equal(player.props[formal.FRAME_PROPERTY],70);
});
test('formal plate readers show both full five-by-three plates and hide absent or stale client data',async()=>{
 const {plateRows}=await import('../native/held-snapshot/scripts/cases.js');
 const {plateHeldVisualPlan}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_held_visual_core.js');
 const main=plateHeldVisualPlan(plateRows(0)),off=plateHeldVisualPlan(plateRows(1)),player=formalActor('both-plates');
 writeHeldVisual(player,'main','plate',main);writeHeldVisual(player,'off','plate',off);flushHeldVisual(player,0);
 const snapshot=formalApply(player.calls[0],1);
 const lines=json('resource_pack/attachables/skewer_plate.attachable.json')['minecraft:attachable'].description.scripts.pre_animation.slice(0,5);
 for(const [hand,expected] of [['main_hand',main],['off_hand',off]])for(const frame of [0,1,2]){
  const local={},owner={v:snapshot,q:{has_property:()=>frame!==0,property:()=>frame,is_item_name_any:()=>true}};
  for(const line of lines)Function('v','c','owner','math',line.replaceAll('c.owning_entity->q.','owner.q.').replaceAll('c.owning_entity->v.','owner.v.'))(local,{item_slot:hand},owner,{floor:Math.floor});
  assert.equal(local.kg_plate_count,frame===1?5:0);
  if(frame===1)for(let i=0;i<12;i++)assert.equal(snapshot[formal.variableName(hand==='off_hand'?'off':'main',i).slice(2)],expected[i]);
 }
});
test('owned extension retains native player routes and TACZ composition keeps 28 fields plus both controller families',()=>{
 const script=`import sys,json,copy
sys.path.insert(0,'tools')
from held_snapshot_properties import configure_player,BASE
from compose_held_player import compose,FP
host={'minecraft:client_entity':{'description':{'identifier':'minecraft:player','animations':{'root':'controller.animation.player.root'},'scripts':{'scale':'0.9375','variables':{'variable.native':'public'},'initialize':['variable.native = 7;'],'pre_animation':['variable.hand_bob = variable.hand_bob + 1;','variable.item_use_normalized = q.main_hand_item_max_duration > 0 ? q.main_hand_item_use_duration / q.main_hand_item_max_duration : 0;','variable.attack_body_rot_y = 5;'],'animate':['root','immersive_eating']},'render_controllers':[{FP:'variable.is_first_person && !q.is_spectator'}]}}}
original=copy.deepcopy(host);configured=configure_player(host)
assert host==original and configure_player(configured)==configured
d=configured['minecraft:client_entity']['description'];native=original['minecraft:client_entity']['description']['scripts']['pre_animation'];assert d['scripts']['pre_animation'][:len(native)]==native
assert all(line.startswith('v.kg_held_oil_brush_') for line in d['scripts']['pre_animation'][len(native):])
assert d['scripts']['initialize'][0]=='variable.native = 7;' and d['scripts']['animate'][:2]==['root','immersive_eating']
bp=json.loads((BASE/'behavior_pack/entities/player.json').read_text())
gunbp={'minecraft:entity':{'description':{'identifier':'minecraft:player','properties':{'gun:p'+str(i):{'type':'int','range':[0,9],'default':0} for i in range(24)}},'events':{'gun:reload':{'sequence':[]}}}}
gunrp={'minecraft:client_entity':{'description':{'identifier':'minecraft:player','animations':{'root':'controller.animation.player.root','gun':'animation.gun'},'scripts':{'scale':'0.9375','initialize':[],'pre_animation':['v.hand_bob = v.hand_bob + 1;','v.item_use_normalized = q.main_hand_item_use_duration / q.main_hand_item_max_duration;','v.holding_all_guns = 1;','v.attack_body_rot_y = 10;'],'animate':['root',{'gun':'v.holding_all_guns'}]},'render_controllers':[{FP:'v.is_first_person && !v.holding_all_guns'},{'controller.render.gun.fp':'v.is_first_person && v.holding_all_guns'},{'controller.render.gun.tp':'v.holding_all_guns'}]}}}
b,r=compose(bp,host,gunbp,gunrp);d=r['minecraft:client_entity']['description'];lines=d['scripts']['pre_animation'];assert len(b['minecraft:entity']['description']['properties'])==28
assert 'gun:reload' in b['minecraft:entity']['events'];assert sum('hand_bob =' in s for s in lines)==1
assert any('max_duration > 0' in s for s in lines);assert 'holding_all_guns ?' in lines[-1]
assert d['render_controllers'][0][FP].endswith('!variable.holding_all_guns');assert len(d['render_controllers'])==3
for i in range(5):gunbp['minecraft:entity']['description']['properties']['extra:p'+str(i)]={'type':'int','range':[0,1],'default':0}
try:compose(bp,host,gunbp,gunrp);raise AssertionError('Over-limit schema accepted')
except ValueError:pass
print('source composition, route and boundary behavior passed')`;
 assert.match(runPython('python3',['-c',script],{cwd:pathOf(new URL('../../',import.meta.url)),timeout:15000}).toString(),/passed/);
});
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
import {writeHeldVisual,flushHeldVisual,heldVisualPropertyNames,HELD_VISUAL_WORD_MAX} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/held_visual_transport.js';
const base=new URL('../../projects/grilling/gameplay_core/',import.meta.url);
const json=p=>JSON.parse(fs.readFileSync(new URL(p,base)));
// This subset executes the actual arithmetic/conditional resource statements,
// with native property/item queries supplied at their API boundary.
function expression(statement,v,marker,hand='main_hand'){
 const q={has_property:()=>true,property:()=>marker,is_item_name_any:()=>true};
 const owner={q:{...q,property:()=>1},v:{kg_held_frame:1}};
 for(const h of ['main','off'])for(let i=0;i<12;i++)owner.v[formal.variableName(h,i).slice(2)]=marker;
 const c={item_slot:hand};
 const math={floor:Math.floor,clamp:(x,a,b)=>Math.min(b,Math.max(a,x))};
 return Function('v','c','q','owner','math',statement.replaceAll('c.owning_entity->q.','owner.q.').replaceAll('c.owning_entity->v.','owner.v.'))(v,c,q,owner,math);
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
  const values=new Map(),calls=[],player={id:`new${food}`,setProperty:(k,v)=>values.set(k,v),playAnimation:(_a,o)=>calls.push(o)};
  assert.equal(writeHeldVisual(player,'main','secret',[...Array(8).fill(0),food,food,food,secretHeldMarker(food)]),true);
  flushHeldVisual(player,0);
  assert.equal(values.size,1);assert.equal(values.get(formal.FRAME_PROPERTY),1);
  const variables={};Function('q','v',calls[0].stopExpression.replace('?{','?(()=>{').replace('};return','})():0;return'))({property:()=>1},variables);
  assert.equal(variables[formal.variableName('main',11).slice(2)],food+9);
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
test('maximum reachable plate words fit the four-property snapshot and decode losslessly',()=>{
 const values=[];for(let food=1;food<=225;food++)for(let shape=1;shape<=3;shape++)for(let style=0;style<=6;style++)values.push(food+256*(shape-1+3*style));
 const max=Math.max(...values),maxRemainder=Math.max(...values.map(v=>v%64)),maxHigh=Math.max(...values.map(v=>Math.floor(v/64)));
 assert.equal(PLATE_HELD_WORD_A_MAX,max+8192*maxRemainder);assert.equal(PLATE_HELD_WORD_B_MAX,1+maxHigh+128*max);assert.equal(HELD_VISUAL_WORD_MAX,PLATE_HELD_WORD_B_MAX);
 const props=json('behavior_pack/entities/player.json')['minecraft:entity'].description.properties;assert.equal(Object.keys(props).length,4);
 for(const middle of values){
  const cells=[max,middle,max],[a,b]=packPlateHeldSecret(cells);
  assert.deepEqual([a%8192,Math.floor(a/8192)+64*((b-1)%128),Math.floor((b-1)/128)],cells);
  assert.ok(a<=PLATE_HELD_WORD_A_MAX&&b<=PLATE_HELD_WORD_B_MAX);
  for(const hand of ['main','off']){
   const keys=heldVisualPropertyNames(hand),words=[a,b,a,b,a,b,a,b,a,b,5,255];
   for(let i=0;i<12;i++){assert.equal(props[keys[i]],undefined);assert.ok(words[i]<=formal.WORD_MAX);assert.equal(Math.fround(words[i]),words[i]);}
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
function evaluateSnapshot(expression,frame,variables){
 // Execute the real generated assignments/commit against a query boundary.
 // This models language arithmetic; no client variable scope is simulated.
 return Function('q','v',expression.replace('?{','?(()=>{').replace('};return','})():0;return'))({property:key=>{assert.equal(key,FRAME_PROPERTY);return frame;}},variables);
}
function apply(expression,frame,variables={}){
 evaluateSnapshot(expression,frame,variables);
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
test('a complete snapshot waits for its frame and then ends its temporary animation',()=>{
 const expression=snapshotExpression(7,Array(12).fill(1),Array(12).fill(2)),v={};
 assert.equal(Number(evaluateSnapshot(expression,6,v)),0);assert.deepEqual(v,{});
 assert.equal(Number(evaluateSnapshot(expression,7,v)),1);
 assert.equal(v.kg_snapshot_frame,7);assert.equal(v.kg_snapshot_m0,1);assert.equal(v.kg_snapshot_o11,2);
});
test('unchanged snapshots refresh after 100 ticks without advancing the committed frame',()=>{
 let tick=0;const publisher=createSnapshotPublisher(()=>tick),player=actor();
 const a=plateHeldVisualPlan(plateRows(0)),b=plateHeldVisualPlan(plateRows(1));
 publisher.publish(player,a,b);const first=player.calls[0];
 tick=99;assert.equal(publisher.publish(player,a,b),false);
 tick=100;assert.equal(publisher.publish(player,a,b),true);
 assert.equal(player.props[FRAME_PROPERTY],1);assert.equal(player.calls[1].stopExpression,first.stopExpression);
 assert.deepEqual(apply(player.calls[1].stopExpression,1),apply(first.stopExpression,1));
 tick=199;assert.equal(publisher.publish(player,a,b),false);
 tick=200;assert.equal(publisher.publish(player,a,b),true);assert.equal(player.calls.length,3);
});
test('targeted replay cannot postpone refresh for other viewers and a failed refresh retries',()=>{
 let tick=0;const publisher=createSnapshotPublisher(()=>tick),player=actor(),words=Array(12).fill(0);
 publisher.publish(player,words,words);tick=99;publisher.replay(player,[{id:'late'}]);
 tick=100;const native=player.playAnimation;player.playAnimation=()=>{throw Error('refresh failed')};
 assert.throws(()=>publisher.publish(player,words,words));
 player.playAnimation=native;assert.equal(publisher.publish(player,words,words),true);
 assert.equal(player.props[FRAME_PROPERTY],1);assert.equal(player.calls.length,3);
 assert.equal(publisher.publish(player,words,words),false);
});
test('test-only pose calibration preserves complete hand words and status cannot mutate the cache',()=>{
 const publisher=createSnapshotPublisher(),player=actor(),a=plateHeldVisualPlan(plateRows(0)),b=plateHeldVisualPlan(plateRows(1));
 publisher.publish(player,a,b,4);
 const view=publisher.inspect(player.id),variables=apply(player.calls[0].stopExpression,1);
 assert.deepEqual(view.main,a);assert.deepEqual(view.off,b);assert.equal(view.fpOffset,4);
 assert.equal(variables.kg_snapshot_fp_offset,4);assert.equal(variables.kg_snapshot_m10,5);assert.equal(variables.kg_snapshot_o10,5);
 view.main[0]=-1;assert.deepEqual(publisher.inspect(player.id).main,a);
 for(const invalid of [-4,1,NaN,Infinity,'4;v.foreign=1'])assert.throws(()=>publisher.publish(player,a,b,invalid));
 assert.equal(player.calls.length,1);assert.equal(player.props[FRAME_PROPERTY],1);
 publisher.publish(player,a,b,0);assert.equal(apply(player.calls[1].stopExpression,2).kg_snapshot_fp_offset,0);
});

const {execFileSync}=await import('node:child_process');
const {fileURLToPath}=await import('node:url');
test('probe player exposes the complete committed snapshot to attachables and retains vanilla routing',()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const source='import sys,json;sys.path.insert(0,"tools");from held_snapshot_probe import configure_player;'+
  'p={"minecraft:client_entity":{"description":{"identifier":"minecraft:player","animations":{"root":"controller.animation.player.root"},"render_controllers":["controller.render.player.first_person"],"scripts":{"variables":{"variable.foreign_public":"public"},"initialize":["variable.foreign = 7;"],"pre_animation":["variable.foreign = 8;"],"animate":["root"]}}}};'+
  'print(json.dumps(configure_player(p)))';
 const output=JSON.parse(execFileSync('python3',['-c',source],{cwd:root,timeout:10000}));
 const description=output['minecraft:client_entity'].description,scripts=description.scripts;
 const committed=apply(snapshotExpression(1,Array(12).fill(0),Array(12).fill(0)),1);
 for(const name of Object.keys(committed)){
  assert.equal(scripts.variables['variable.'+name],'public',name+' must be visible from its attachable');
  assert.ok(scripts.initialize.includes('variable.'+name+' = 0;'),name+' starts neutral after client recreation');
 }
 const player=actor();createSnapshotPublisher().publish(player,Array(12).fill(0),Array(12).fill(0));
 assert.equal(description.animations[player.calls[0].animation],player.calls[0].animation);
 assert.equal(description.animations[player.calls[0].controller],player.calls[0].controller);
 assert.equal(scripts.variables['variable.foreign_public'],'public');assert.equal(scripts.variables['variable.foreign'],undefined);
 assert.ok(scripts.initialize.includes('variable.foreign = 7;'));
 assert.deepEqual(scripts.pre_animation,['variable.foreign = 8;']);assert.deepEqual(scripts.animate,['root']);
 assert.equal(description.animations.root,'controller.animation.player.root');
 assert.deepEqual(description.render_controllers,['controller.render.player.first_person']);
 const spearInitialization=scripts.initialize.filter(line=>line.startsWith('variable.melee_spear_equipped ='));
 assert.equal(spearInitialization.length,1);
 for(const initial of [undefined,0,1]){
  const native=initial===undefined?{}:{melee_spear_equipped:initial};
  for(const line of spearInitialization)Function('variable',line)(native);
  assert.equal(native.melee_spear_equipped,initial??0,'missing vanilla state is neutral; an existing native state survives initialization');
 }
 const rotationInitialization=scripts.initialize.filter(line=>line.startsWith('variable.first_person_item_rotation_factor ='));
 assert.equal(rotationInitialization.length,1);
 for(const initial of [undefined,0,0.5,1]){
  const native=initial===undefined?{}:{first_person_item_rotation_factor:initial};
  for(const line of rotationInitialization)Function('variable',line)(native);
  assert.equal(native.first_person_item_rotation_factor,initial??0);
 }
});
test('snapshot carrier has no bone channels or pose reset for the client to apply',()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const source='import sys,json;sys.path.insert(0,"tools");from held_snapshot_probe import CARRIER;print(json.dumps(CARRIER))';
 const output=JSON.parse(execFileSync('python3',['-c',source],{cwd:root,timeout:10000}));
 const player=actor();createSnapshotPublisher().publish(player,Array(12).fill(0),Array(12).fill(0));
 const carrier=output.animations[player.calls[0].animation];
 assert.equal(carrier.bones,undefined,'an empty bones object is rejected by the native client');
 assert.notEqual(carrier.override_previous_animation,true);
 assert.equal(carrier.loop,true);assert.ok(carrier.animation_length>0);
});
test('generated plate consumer reads owning-player data for each hand and hides stale or absent snapshots',()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const converted=execFileSync('python3',['-c','import sys;sys.path.insert(0,"tools");from held_snapshot_probe import readers,SOURCE;print(readers((SOURCE/"resource_pack/attachables/skewer_plate.attachable.json").read_text()))'],{cwd:root,timeout:10000});
 assert.equal(/c\.owning_entity->v\.kg_snapshot_\w+\s*\?\?/.test(converted.toString()),false,
  'the native client rejects redirected expressions as null-coalescing left operands');
 const lines=JSON.parse(converted)['minecraft:attachable'].description.scripts.pre_animation.slice(0,5);
 const main=plateHeldVisualPlan(plateRows(0)),off=plateHeldVisualPlan(plateRows(1)),snapshot={};
 Function('q','v',formal.snapshotExpression(7,main,off).replace('?{','?(()=>{').replace('};return','})():0;return'))({property:()=>7},snapshot);
 for(const hand of ['main_hand','off_hand'])for(const has of [false,true])for(const frame of [6,7]){
  const local={kg_snapshot_frame:999,kg_snapshot_m10:0,kg_snapshot_o10:0};
  const owner={v:snapshot,q:{has_property:key=>has&&key===formal.FRAME_PROPERTY,property:key=>{assert.equal(key,formal.FRAME_PROPERTY);return frame;},is_item_name_any:()=>true}};
  for(const line of lines)Function('v','c','owner','math',line.replaceAll('c.owning_entity->q.','owner.q.').replaceAll('c.owning_entity->v.','owner.v.'))(local,{item_slot:hand},owner,math);
  assert.equal(local.kg_plate_count,has&&frame===7?5:0);
 }
});

}

test('held preview BB5 matrix and read-only contract are not Java/native acceptance',()=>{
 const script=String.raw`"""Independent BB5 import/Animate matrix regression; no engine acceptance claim."""
import hashlib
import importlib.util
import math
from pathlib import Path
import subprocess
import sys
import unittest
import tempfile
import json

ROOT = Path.cwd()
spec = importlib.util.spec_from_file_location('preview', ROOT/'tools/plate_camera_pose.py')
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


def mm(a, b):
    return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def matrix(diag=(1, 1, 1), translation=(0, 0, 0)):
    return [[diag[0],0,0,translation[0]], [0,diag[1],0,translation[1]], [0,0,diag[2],translation[2]], [0,0,0,1]]


def rotation(v):
    x,y,z = map(math.radians, v)
    sx,cx,sy,cy,sz,cz=math.sin(x),math.cos(x),math.sin(y),math.cos(y),math.sin(z),math.cos(z)
    rx=[[1,0,0,0],[0,cx,-sx,0],[0,sx,cx,0],[0,0,0,1]]
    ry=[[cy,0,sy,0],[0,1,0,0],[-sy,0,cy,0],[0,0,0,1]]
    rz=[[cz,-sz,0,0],[sz,cz,0,0],[0,0,1,0],[0,0,0,1]]
    return mm(mm(rz,ry),rx)


def apply(m, p):
    return [sum(m[i][j]*list(p+[1])[j] for j in range(4)) for i in range(3)]


def explicit_bb_animate(point, pivot, position, angles, scale):
    # Independently replay official importer, then BB Animate, then preview.
    # Source identity: docs/REBUILD-PLAN.md (actual BB5.2.2 hash).
    bp=[-pivot[0],pivot[1],pivot[2]]
    bpos=[-position[0],position[1],position[2]]
    brot=[-angles[0],-angles[1],angles[2]]
    model=mm(mm(matrix(translation=[-bp[0],24-bp[1],bp[2]]),matrix(diag=(-1,-1,1))),matrix(translation=[-x for x in bp]))
    animated=mm(mm(mm(matrix(translation=[bp[i]+bpos[i] for i in range(3)]),rotation(brot)),matrix(diag=scale)),matrix(translation=[-x for x in bp]))
    return apply(mm(mm(model,animated),matrix(diag=(-1,1,1))),point)


class CoordinateTests(unittest.TestCase):
    def test_asymmetric_vertex_catches_double_x_reflection(self):
        self.assertEqual(preview.raw_bound_point([3,28,-2]),[3,-4,-2])
        self.assertEqual(preview.bound_binding_offset([1,15.5,3]),[1,8.5,3])

    def test_explicit_bb_import_and_animate_equals_raw_direct(self):
        for pivot in ([0,24,0],[1,15.5,3],[-4,11,2]):
            for angles in ([0,0,0],[91,65,-43],[1,176,-2.5],[19,-37,71]):
                for point in ([7,39,-1],[-5,17,0],[3,28,-2]):
                    pos=[5.3,-2.2,.4];scale=[.4,.7,1.2]
                    expected=explicit_bb_animate(list(point),pivot,pos,angles,scale)
                    local=preview.raw_bound_point(point,pivot)
                    actual=preview.transform(preview.rotation(angles),[local[i]*scale[i] for i in range(3)])
                    offset=preview.bound_binding_offset(pivot)
                    actual=[actual[i]+[pos[0],-pos[1],pos[2]][i]+offset[i] for i in range(3)]
                    for a,b in zip(actual,expected):self.assertAlmostEqual(a,b,places=10)

    def test_raw_bound_api_matches_explicit_bb_and_holder(self):
        pose={'position':[-13.5,-5.8,5.1],'rotation':[1,176,-2.5],'scale':[1,1,1]}
        for hand in ('left','right'):
            raw=[-5,39,-1];pivot=[1,15.5,3]
            p=explicit_bb_animate(raw,pivot,pose['position'],pose['rotation'],pose['scale'])
            arm,origin,item=preview.holder(hand)
            p=preview.transform(arm,[p[i]+item[i] for i in range(3)])
            p=[p[i]+origin[i] for i in range(3)]
            world=[-preview.SCALE*p[0],preview.SCALE*(preview.Y_SHIFT-p[1])-preview.EYE,preview.SCALE*p[2]]
            expected=[-world[0]/world[2],world[1]/world[2],world[2]]
            for a,b in zip(preview.project_raw_bound_point(raw,pivot,pose,hand),expected):self.assertAlmostEqual(a,b,places=10)

    def test_catalog_path_uses_corrected_asymmetric_coordinates(self):
        previous=preview.RP
        try:
            with tempfile.TemporaryDirectory() as folder:
                preview.RP=Path(folder)
                models=preview.RP/'models/entity';models.mkdir(parents=True)
                bones=[{'name':'grip','pivot':[0,24,0]}, {'name':'plate_pose','parent':'grip','pivot':[0,24,0]}, {'name':'slot_0','parent':'plate_pose','pivot':[0,24,0],'cubes':[{'origin':[2,25,3],'size':[1,1,1]}]}]
                (models/'plate_held_test.geo.json').write_text(json.dumps({'minecraft:geometry':[{'bones':bones}]}))
                points=preview.local_points({'animations':{'animation.kg_plate_held.layout':{'bones':{}}}})
                self.assertEqual([(min(p[i] for p in points),max(p[i] for p in points)) for i in range(3)],[(2,3),(-2,-1),(3,4)])
        finally:preview.RP=previous

    def test_zero_pose_pivot_cancels_before_holder(self):
        pose={'position':[0,0,0],'rotation':[0,0,0],'scale':[1,1,1]}
        expected=preview.project_raw_bound_point([5,30,2],[0,24,0],pose,'left')
        for pivot in ([1,15.5,3],[-4,11,2],[9,31,-6]):
            actual=preview.project_raw_bound_point([5,30,2],pivot,pose,'left')
            for a,b in zip(actual,expected):self.assertAlmostEqual(a,b,places=10)

    def test_retired_writers_fail_explicitly(self):
        for call in (lambda:preview.generate(),lambda:preview.generate(True),lambda:preview.fitted({})):
            with self.assertRaisesRegex(RuntimeError,'retired'):call()

    def test_cli_diagnostic_and_retired_check_never_write_asset(self):
        before=hashlib.sha256(preview.POSE.read_bytes()).hexdigest()
        for args,code in [([],0),(['--diagnose'],0),(['--check'],2)]:
            r=subprocess.run([sys.executable,str(ROOT/'tools/plate_camera_pose.py'),*args],capture_output=True,text=True,cwd=ROOT)
            self.assertEqual(r.returncode,code,r.stderr)
            self.assertIn('READ_ONLY_DIAGNOSTIC' if code==0 else 'contract is retired',r.stdout+r.stderr)
        self.assertEqual(hashlib.sha256(preview.POSE.read_bytes()).hexdigest(),before)
        report=preview.diagnose()
        self.assertFalse(report['native_acceptance']);self.assertFalse(report['java_equivalence'])


suite=unittest.defaultTestLoader.loadTestsFromTestCase(CoordinateTests)
result=unittest.TextTestRunner(verbosity=2).run(suite)
assert result.wasSuccessful()
print('seven independent coordinate/no-write regressions passed; no native acceptance')
`;
 assert.match(runPython('python3',['-c',script],{cwd:pathOf(new URL('../../',import.meta.url)),timeout:120000}).toString(),/seven independent coordinate\/no-write regressions passed/);
});

test('TACZ keeps cubic keyframes constant and releases the occupied arm through animation weight',()=>{
 const source={animation_length:1,loop:true,sound_effects:{'0.5':{effect:'reload'}},bones:{leftArm:{rotation:{'0.0':{pre:[1,2,3],post:[4,5,6],lerp_mode:'catmullrom'},'1.0':[7,8,9]},position:[10,11,12],scale:[.8,1,1.2]},rightArm:{rotation:[20,30,40]}}};
 const code=`import sys,json
sys.path.insert(0,'tools')
from compose_held_player import reserve_offhand,compose_arm_routes,repair_model
v=json.loads(sys.argv[1]);body,arm=reserve_offhand(v);assert v==json.loads(sys.argv[1])
player={'minecraft:client_entity':{'description':{'animations':{'reload':'animation.gun.reload'},'scripts':{'animate':[{'reload':'v.reload'},'other']}}}}
controllers={'gun':{'animation_controllers':{'controller.animation.gun':{'states':{'reload':{'animations':[{'reload':'v.gun'}],'transitions':[{'hold':'q.any_animation_finished'}]}}}}}}
compose_arm_routes(player,controllers,{'animation.gun.reload':'animation.gun.reload.kg_left_arm'})
try:repair_model(b'{}garbage');raise AssertionError('Unreviewed model accepted')
except ValueError:pass
print(json.dumps([body,arm,player,controllers]))`;
 const [body,arm,player,controllers]=JSON.parse(runPython('python3',['-c',code,JSON.stringify(source)],{cwd:pathOf(new URL('../../',import.meta.url)),timeout:10000}));
 assert.deepEqual(body.bones,{rightArm:source.bones.rightArm});
 assert.deepEqual(arm.bones,{leftArm:source.bones.leftArm});
 assert.deepEqual(body.sound_effects,source.sound_effects);assert.equal(arm.sound_effects,undefined);
 assert.equal(body.animation_length,1);assert.equal(arm.animation_length,1);assert.equal(arm.loop,true);
 const run=reserved=>Function('q','return '+arm.blend_weight)({is_item_equipped:slot=>{assert.equal(slot,'off_hand');return reserved}});
 assert.equal(run(false),1);assert.equal(run(true),0);
 const description=player['minecraft:client_entity'].description;
 assert.equal(description.animations.reload_kg_left_arm,'animation.gun.reload.kg_left_arm');
 assert.deepEqual(description.scripts.animate,[{reload:'v.reload'},{reload_kg_left_arm:'v.reload'},'other']);
 const state=controllers.gun.animation_controllers['controller.animation.gun'].states.reload;
 assert.deepEqual(state.animations,[{reload:'v.gun'},{reload_kg_left_arm:'v.gun'}]);
 assert.deepEqual(state.transitions,[{hold:'q.any_animation_finished'}]);
});
// Exercise installed observers only when an isolated reviewed pack is supplied.
import {pathToFileURL as observerPathToURL} from 'node:url';
import {readFile as observerReadFile} from 'node:fs/promises';
import {defaultFixture as observerFixture} from '../helpers/register-minecraft-loader.mjs';
const observerPack=process.env.HELD_STATUS_QA_PACK;
const observerProfile=observerPack?JSON.parse(await observerReadFile(`${observerPack}/manifest.json`,'utf8')).header.version[2]:null;
if(observerProfile===194||observerProfile===206){
 if(observerProfile===206)test('formal QA observer reads both actual cache rows, frame and ItemStack values',async()=>{
 const pack=process.env.HELD_STATUS_QA_PACK;
 assert.ok(pack,'HELD_STATUS_QA_PACK must point at an instrumented isolated BP UUID directory');
 const runtime=await import(observerPathToURL(`${pack}/scripts/held_visual_transport.js`).href);
 assert.throws(()=>observerFixture.world.afterEvents.scriptEventReceive, /belongs to system.afterEvents/);
 const player=observerFixture.player({id:'qa-human',name:'QA Human'});
 const makeItem=(name,key,value)=>{const stack=new observerFixture.ItemStack('kaleidoscope_grilling:skewer_plate',1);stack.nameTag=name;stack.setLore(['human visible lore']);stack.setDynamicProperty(key,value);return stack;};
 player.main=makeItem('main plate','qa:foreign','main-mark');
 player.off=makeItem('off plate','kaleidoscope_grilling:sample','off-mark');
 const main=[11,12,13,14,15,16,17,18,19,20,1,255];
 const off=[21,22,23,24,25,26,27,28,29,30,2,255];
 runtime.writeHeldVisual(player,'main','plate',main);runtime.writeHeldVisual(player,'off','plate',off);
 runtime.flushHeldVisual(player,314);
 observerFixture.emit('system.afterEvents.scriptEventReceive',{id:'kg_held_qa:status',message:'QA Human'});
 const line=observerFixture.logs.find(row=>row.text.includes('[kg_held_qa]'))?.text;
 assert.ok(line,'observer should log to server console');
 const value=JSON.parse(line.slice(line.indexOf('{')));
 assert.equal(value.frame,1);assert.deepEqual(value.main.transport.words,main);assert.deepEqual(value.off.transport.words,off);
 assert.deepEqual(value.main.item.lore,['human visible lore']);assert.deepEqual(value.off.item.lore,['human visible lore']);
 assert.equal(value.main.item.dynamicProperties['qa:foreign'],'main-mark');
 assert.equal(value.off.item.dynamicProperties['kaleidoscope_grilling:sample'],'off-mark');
 assert.equal(value.main.item.rawLoreSupported,true);assert.equal(value.rendererAcknowledged,false);

 });
}
if(observerProfile===194||observerProfile===206){
 if(observerProfile===194)test('formal QA observer reads all legacy32 native values without inventing a cache',async()=>{
 const pack=process.env.HELD_STATUS_QA_PACK;
 assert.ok(pack,'HELD_STATUS_QA_PACK must point at an instrumented isolated G194 BP copy');
 assert.throws(()=>observerFixture.world.afterEvents.scriptEventReceive,/belongs to system.afterEvents/);
 const schema=JSON.parse(await observerReadFile(`${pack}/entities/player.json`,'utf8'))['minecraft:entity'].description.properties;
 assert.equal(Object.keys(schema).length,32);
 await import(observerPathToURL(`${pack}/scripts/main.js`).href);
 const player=observerFixture.player({id:'qa-g194-human',name:'QA G194 Human'});
 const expected={};let number=17;
 for(const [key,definition] of Object.entries(schema)){
  const value=definition.type==='bool'?true:number++;
  player.setProperty(key,value);expected[key]=value;
 }
 const item=new observerFixture.ItemStack('kaleidoscope_grilling:skewer_plate',1);item.nameTag='A plate';item.setLore(['visible A lore']);item.setDynamicProperty('qa:foreign','readable');player.main=item;
 observerFixture.emit('system.afterEvents.scriptEventReceive',{id:'kg_held_qa:status',message:'QA G194 Human'});
 const line=observerFixture.logs.find(row=>row.text.includes('[kg_held_qa]'))?.text;
 assert.ok(line,'observer should log to server console');
 const value=JSON.parse(line.slice(line.indexOf('{')));
 assert.equal(value.profile,'g194-native32');assert.deepEqual(value.nativeProperties,expected);
 assert.equal(value.frame,null);assert.equal(value.frameSource,null);
 assert.deepEqual(value.transport,{source:'legacy native player properties; no held snapshot cache',words:null});
 assert.deepEqual(value.main.item.lore,['visible A lore']);
 assert.equal(value.main.item.dynamicProperties['qa:foreign'],'readable');
 assert.equal(value.propertySource,'one player.getProperty(key) call for each of the 32 keys declared in the matched G194 entities/player.json');

 });
}

test('oil-brush pre-animation and weights skip actor queries in UI previews',()=>{
 const code=`import sys,json
sys.path.insert(0,'tools')
from held_snapshot_properties import configure_player
player={'minecraft:client_entity':{'description':{'identifier':'minecraft:player','scripts':{}}}}
print(json.dumps(configure_player(player)))`;
 const description=JSON.parse(runPython('python3',['-c',code],{cwd:pathOf(new URL('../../',import.meta.url)),timeout:10000}))['minecraft:client_entity'].description;
 const scripts=description.scripts;
 const variables={};for(const statement of scripts.initialize)Function('v','variable',statement)(variables,variables);
 const actor={is_in_ui:0,has_property:()=>true,property:()=>7,is_item_name_any:slot=>slot==='slot.weapon.mainhand'};
 Object.assign(variables,{kg_held_frame:7,kg_held_m11:225,kg_held_o11:225});
 const updates=scripts.pre_animation.filter(line=>line.startsWith('v.kg_held_oil_brush_'));
 assert.equal(updates.length,2);
 for(const statement of updates)Function('v','q',statement)(variables,actor);
 const weights=Object.fromEntries(scripts.animate.flatMap(row=>Object.entries(row)));
 const noActor=new Proxy({}, {get(){throw Error('actor unavailable in preview')}});
 assert.equal(Boolean(Function('v','q','return '+weights.kg_held_oil_brush_main)(variables,noActor)),true);
 assert.equal(Boolean(Function('v','q','return '+weights.kg_held_oil_brush_off)(variables,noActor)),false);
 // A preview can run the update phase after an actor-backed world frame.
 // Only the native UI flag is available; every actor lookup must be skipped.
 const preview=new Proxy({}, {get(_target,key){if(key==='is_in_ui')return 1;throw Error('actor unavailable in preview update')}});
 for(const statement of updates)Function('v','q',statement)(variables,preview);
 assert.equal(Boolean(variables.kg_held_oil_brush_main_active),false);
 assert.equal(Boolean(variables.kg_held_oil_brush_off_active),false);
 for(const statement of updates)Function('v','q',statement)(variables,actor);
 assert.equal(Boolean(variables.kg_held_oil_brush_main_active),true);
 const fresh={};for(const statement of scripts.initialize)Function('v','variable',statement)(fresh,fresh);
 for(const expression of Object.values(weights))assert.equal(Boolean(Function('v','q','return '+expression)(fresh,noActor)),false);
 variables.kg_held_frame=6;
 for(const statement of updates)Function('v','q',statement)(variables,actor);
 assert.equal(Boolean(variables.kg_held_oil_brush_main_active),false);
});
