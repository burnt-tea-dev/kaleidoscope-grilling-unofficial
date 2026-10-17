/** Execute production payloads and generated Molang. This does not render a client. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {secretVisualIndex} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/integration_registry_core.js';
import {encodeSecretVisual,decodeSecretVisual,secretHeldMarker,SECRET_VISUAL_MAX} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state_core.js';
import {secretVisualState} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state.js';
import {packPlateHeldSecret,plateHeldVisualPlan,PLATE_HELD_WORD_A_MAX,PLATE_HELD_WORD_B_MAX} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_held_visual_core.js';
import {writeHeldVisual,heldVisualPropertyNames,forgetHeldVisual} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/held_visual_transport.js';
import {plateMeshPlan,secretGuiIconPlan} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_recipe_visual_core.js';
import {SECRET_GUI_COLORS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_gui_color_data.js';

const N='kaleidoscope_grilling:',root=new URL('../../projects/grilling/gameplay_core/',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const describe=path=>{const doc=read('resource_pack/'+path);return (doc['minecraft:attachable']??doc['minecraft:client_entity']).description;};
const math={floor:Math.floor,max:Math.max,min:Math.min,clamp:(n,a,b)=>Math.max(a,Math.min(b,n))};
const program=rows=>new Function('c','owner','q','math','v',rows.join('\n').replaceAll('c.owning_entity->q.','owner.'));
const expression=(code,v)=>new Function('v','return '+code)(v);
const properties=read('behavior_pack/entities/player.json')['minecraft:entity'].description.properties;
let number=0;
function bank(main='',off=''){
 const values={},equipped={main,off},player={id:'catalog-'+number++,setProperty(key,value){const range=properties[key].range;assert.ok(Number.isInteger(value)&&value>=range[0]&&value<=range[1],key+' '+value);values[key]=value;}};
 const owner={has_property:key=>Object.hasOwn(values,key),property:key=>values[key]??0,is_item_name_any:(slot,...ids)=>ids.includes(equipped[slot==='slot.weapon.mainhand'?'main':'off'])};
 return {values,player,owner,equipped};
}
const secretPayload=(food,marker=secretHeldMarker(food))=>[...Array(8).fill(0),food,food,food,marker];
const ingredientRows=d=>d.scripts.pre_animation.filter(row=>row.startsWith('v.kg_secret_')&&!row.startsWith('v.kg_secret_terminal_')&&!row.startsWith('v.kg_secret_piece_visible = '));

test('the exact escaped owner discriminants cannot alias bottle, slime, failure, plate or the opposite hand',()=>{
 assert.equal(Object.keys(properties).length,32);
 for(const alias of ['secret_skewer','secret_skewer_java_three_alt','secret_skewer_native_plain','unfinished_skewer']){
  const d=describe('attachables/'+alias+'.attachable.json'),run=program(ingredientRows(d));
  for(const hand of ['main','off'])for(let marker=0;marker<=255;marker++){
   const f=bank(d.identifier,d.identifier),other=hand==='main'?'off':'main';
   heldVisualPropertyNames(other).forEach((key,i)=>f.values[key]=secretPayload(213)[i]);
   heldVisualPropertyNames(hand).forEach((key,i)=>f.values[key]=secretPayload(217,marker)[i]);
   const v={kg_secret_terminal_wait:0};run({item_slot:hand+'_hand'},f.owner,{},math,v);
   const admitted=marker<=213||(marker>=221&&marker<=224);
   assert.equal(Boolean(v.kg_secret_owner_occupied),admitted,alias+' '+hand+' '+marker);
   if(alias==='secret_skewer'||alias==='secret_skewer_java_three_alt')assert.equal(v.kg_secret_piece_index,marker<=213?marker:marker>=221&&marker<=224?marker-7:0);
   const otherVariables={kg_secret_terminal_wait:0};run({item_slot:other+'_hand'},f.owner,{},math,otherVariables);
   assert.equal(Boolean(otherVariables.kg_secret_owner_occupied),true);assert.equal(otherVariables.kg_secret_food_0,213);
   if(admitted)assert.doesNotThrow(()=>writeHeldVisual(f.player,hand,'secret',secretPayload(217,marker)));
   else assert.throws(()=>writeHeldVisual(f.player,hand,'secret',secretPayload(217,marker)),/invalid held visual owner/);
   f.equipped[hand]='minecraft:stick';const switched={kg_secret_terminal_wait:0};run({item_slot:hand+'_hand'},f.owner,{},math,switched);assert.equal(Boolean(switched.kg_secret_owner_occupied),false);
   forgetHeldVisual(f.player.id);
  }
 }
 for(const [kind,marker]of [['bottle',214],...Array.from({length:5},(_,i)=>['slime',215+i]),['failure',220],['plate',255]]){
  const f=bank();const payload=Array(12).fill(0);payload[11]=marker;
  writeHeldVisual(f.player,'main',kind,payload);writeHeldVisual(f.player,'off','secret',secretPayload(217));
  assert.equal(f.values[N+'secret_main_piece'],marker);assert.equal(f.values[N+'secret_off_piece'],224);
 }
});

test('all 0..217 foods, shapes and stage styles fit the existing plate channels and decode in either hand',()=>{
 const d=describe('attachables/skewer_plate.attachable.json'),run=program(d.scripts.pre_animation);
 const rcs=read('resource_pack/render_controllers/plate_held.render_controllers.json').render_controllers;
 assert.equal(PLATE_HELD_WORD_A_MAX,521433);assert.equal(PLATE_HELD_WORD_B_MAX,683220);assert.equal(SECRET_VISUAL_MAX,5337);
 const f=bank(d.identifier,d.identifier);
 for(let food=0;food<=217;food++)for(let shape=1;shape<=3;shape++)for(let style=0;style<=6;style++){
  // Food zero preserves an unknown source shape; no replacement food is invented.
  const cells=[food+256*(shape-1+3*style),217+256*(2+3*6),213];
  const words=packPlateHeldSecret(cells);assert.ok(words[0]<=PLATE_HELD_WORD_A_MAX);assert.ok(words[1]<=PLATE_HELD_WORD_B_MAX);
  for(const hand of ['main','off']){
   writeHeldVisual(f.player,hand,'plate',[...words,...Array(8).fill(0),1,255]);
   const v={};run({item_slot:hand+'_hand'},f.owner,{},math,v);
   assert.equal(Boolean(v.kg_plate_visible_0),true);
   assert.deepEqual([0,1,2].map(i=>v['kg_plate_cell_0_'+i]),cells);
   assert.deepEqual([0,1,2].map(i=>v['kg_plate_food_0_'+i]),[food,217,213]);
   assert.equal(v.kg_plate_style_0_0,style);assert.equal(v.kg_plate_shape_0_0,shape);
   for(let slot=0;slot<3;slot++){
    const row=rcs['controller.render.kg_plate_held.secret_0_'+slot];
    const index=v['kg_plate_food_0_'+slot]+v['kg_plate_style_0_'+slot]*218;
    const alias=row.arrays.textures['Array.palette'][index].slice(8);
    if(v['kg_plate_food_0_'+slot])assert.equal(d.textures[alias],`textures/secret_food_palette/food_${v['kg_plate_food_0_'+slot]}_${v['kg_plate_style_0_'+slot]}`);
   }
  }
 }
 assert.throws(()=>packPlateHeldSecret([5338,0,0]));
});

test('each appended public food reaches real complete/partial/helper, world and recipe palette references',()=>{
 const names=['tea_egg','butter_tea','clay_pot_milk_tea','mystery_tea'];
 const complete=describe('attachables/secret_skewer.attachable.json'),partial=describe('attachables/unfinished_skewer.attachable.json');
 const held=read('resource_pack/render_controllers/secret_held.render_controllers.json').render_controllers;
 const failure=describe('attachables/mysterious_skewer.attachable.json');
 const failureRC=read('resource_pack/render_controllers/failure_skewer_held.render_controllers.json').render_controllers['controller.render.kg_failure_held.helper'];
 const helperGeometry=read('resource_pack/models/entity/secret_helper_sprites.geo.json')['minecraft:geometry'];
 const worldRC=read('resource_pack/render_controllers/grill_food_visual.render_controllers.json').render_controllers;
 const heldRun=program(ingredientRows(complete));assert.equal(SECRET_GUI_COLORS.length,218);
 for(const [i,name]of names.entries()){
  const id='kaleidoscope_cookery:'+name,food=214+i;assert.equal(secretVisualIndex(id),food);
  const piece=held['controller.render.kg_secret_held.piece'];
  const geometry=piece.arrays.geometries['Array.pieces'][food].slice(9),texture=piece.arrays.textures['Array.food'][food].slice(8);
  assert.equal(complete.textures[texture],'textures/items/kc_'+name);assert.ok(helperGeometry.some(g=>g.description.identifier===complete.geometry[geometry]));
  assert.equal(failure.textures[failureRC.arrays.textures['Array.food'][food].slice(8)],'textures/items/kc_'+name);
  assert.equal(failure.geometry[failureRC.arrays.geometries['Array.pieces'][food].slice(9)],complete.geometry[geometry]);
  const failureIndex=program(failure.scripts.pre_animation.filter(row=>row.startsWith('v.kg_failure_helper_index = ')));
  const failureBank=bank(failure.identifier);const payload=Array(12).fill(0);payload[2]=food;payload[11]=220;writeHeldVisual(failureBank.player,'main','failure',payload);
  const fv={};failureIndex({item_slot:'main_hand'},failureBank.owner,{},math,fv);assert.equal(fv.kg_failure_helper_index,food);
  assert.equal(partial.textures[held['controller.render.kg_partial_held.0'].arrays.textures['Array.food'][food].slice(8)],`textures/secret_food_palette/food_${food}_0`);
  for(let shape=1;shape<=3;shape++)for(let style=0;style<=6;style++){
   const encoded=encodeSecretVisual(food,shape+3,style===6?4:style,style===6),f=bank(complete.identifier);
   writeHeldVisual(f.player,'main','secret',[...Array(8).fill(0),encoded,encoded,encoded,secretHeldMarker(food)]);
   const v={kg_secret_terminal_wait:0};heldRun({item_slot:'main_hand'},f.owner,{},math,v);
   assert.equal(v.kg_secret_food_0,food);assert.equal(v.kg_secret_piece_index,food);assert.equal(Boolean(v.kg_secret_owner_occupied),true);
   const pass=held['controller.render.kg_secret_held.0'],alias=pass.arrays.textures['Array.food'][food+style*218].slice(8);
   assert.equal(complete.textures[alias],`textures/secret_food_palette/food_${food}_${style}`);assert.equal(Boolean(expression(pass.part_visibility[1].skewer_model,{...v,kg_bite_stage:0})),true);
   assert.ok(existsSync(new URL('resource_pack/'+complete.textures[alias]+'.png',root)));
   for(const world of ['grill','plate']){
    const d=describe('entity/'+world+'_food_visual.entity.json'),run=program(d.scripts.pre_animation.filter(row=>row.startsWith('v.kg_secret_'))),state={};
    const bp=read('behavior_pack/entities/'+world+'_food_visual.json')['minecraft:entity'].description.properties;
    for(let slot=0;slot<3;slot++)assert.deepEqual(bp[N+'secret_'+slot].range,[0,5337]);
    run({},null,{property:()=>encoded},math,state);assert.equal(state.kg_secret_food_0,food);assert.equal(state.kg_secret_style_0,style);
    const controller=worldRC['controller.render.kg_station.secret.0'],key=controller.arrays.textures['Array.food'][food+style*218].slice(8);
    assert.equal(d.textures[key],complete.textures[alias]);
   }
  }
  for(const cooked of [false,true]){
   const rows=Array.from({length:3},()=>({id})),props={[N+'skewer_ingredients']:JSON.stringify(rows),[N+'secret_cooked_ingredients']:JSON.stringify(rows),[N+'secret_cooked']:cooked,[N+'model_variants']:'[4,5,6]'};
   const stack={typeId:N+'secret_skewer',getDynamicProperty:key=>props[key]},before=JSON.stringify(props),readRows=()=>rows;
   assert.deepEqual(plateMeshPlan(stack,readRows).secret.map(decodeSecretVisual).map(x=>x.food),[food,food,food]);
   assert.deepEqual(secretGuiIconPlan(stack,readRows).colors,Array(3).fill(SECRET_GUI_COLORS[food][cooked?6:0]));
   const plan=plateHeldVisualPlan([{id:stack.typeId,props}]),expected=packPlateHeldSecret(secretVisualState(stack,readRows));
   assert.deepEqual(plan.slice(0,2),expected);assert.equal(plan[10],1);assert.equal(plan[11],255);assert.equal(JSON.stringify(props),before);
  }
 }
});
