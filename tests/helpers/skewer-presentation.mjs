/** Test-only evaluation of the deliberately small expression subset emitted by
 * fixed skewer attachables. This is not a Molang engine or client simulator.
 * JSON expressions are data; no production JavaScript is rewritten/evaluated.
 */
import {Script,createContext} from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
const RP=new URL('../../projects/grilling/gameplay_core/resource_pack/',import.meta.url);
const cache=new Map();
const renderControllers=Object.assign({},...readdirSync(new URL('render_controllers/',RP)).filter(name=>name.endsWith('.json')).map(name=>JSON.parse(readFileSync(new URL('render_controllers/'+name,RP),'utf8')).render_controllers));
export function presentation(id,{profile=5,hand='main',slot=hand,tick=0,alpha=0,duration=90,using=true,same=true,first=true,projection=true,slimeFrame=0,oppositeOccupied=false,state={},delta=1/60,ownerUsing=using,ownerHand=hand==='main'?1:2}={}) {
 let spec=cache.get(id);
 if(!spec){
  const doc=JSON.parse(readFileSync(new URL(`attachables/${id.split(':')[1]}.attachable.json`,RP),'utf8'))['minecraft:attachable'].description;
  // Only the explicit owning-entity dereference differs from JavaScript syntax.
  spec={doc,pre:new Script(doc.scripts.pre_animation.map(x=>x.replaceAll('c.owning_entity->q.','owner.')).join('\n')),
   animate:doc.scripts.animate.map(row=>{const [name,expr]=Object.entries(row)[0];return[name,new Script(expr)];}),
   visibility:doc.render_controllers.map(name=>[name,(renderControllers[name].part_visibility??[]).map(row=>{const [bone,expr]=Object.entries(row)[0];return[bone,new Script(String(expr))];})])};cache.set(id,spec);
 }
 const properties={eat_profile:profile,eat_hand:ownerHand,eat_projection:projection?1:0,eat_native_ticks:duration,eat_elapsed_ticks:tick,secret_main_piece:215+slimeFrame,secret_off_piece:215+slimeFrame};
 const matches=(query,...ids)=>same&&query==='slot.weapon.'+(slot==='main'?'mainhand':'offhand')&&ids.includes(id);
 const logs=[];
 const owner={is_using_item:ownerUsing?1:0,is_item_name_any:matches,has_property:name=>Object.hasOwn(properties,name.split(':')[1]),property:name=>properties[name.split(':')[1]]};
 const context=createContext({v:state,owner,c:{is_first_person:first?1:0,item_slot:slot+'_hand'},
  math:{floor:Math.floor,clamp:(n,a,b)=>Math.max(a,Math.min(n,b))},q:{delta_time:delta,log:value=>{logs.push(Number(value));return 0;},is_item_equipped:which=>which===hand+'_hand'||oppositeOccupied,is_using_item:using?1:0,main_hand_item_use_duration:duration-tick-1,frame_alpha:alpha,
   is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,
   is_item_name_any:(query,...ids)=>same&&query==='slot.weapon.'+(slot==='main'?'mainhand':'offhand')&&ids.includes(id)}});
 spec.pre.runInContext(context,{timeout:100});
 return {variables:context.v,logs,clips:spec.animate.filter(([,s])=>s.runInContext(context,{timeout:100})).map(([name])=>spec.doc.animations[name]),
  visibility:Object.fromEntries(spec.visibility.map(([name,rows])=>[name,Object.fromEntries(rows.map(([bone,s])=>[bone,!!s.runInContext(context,{timeout:100})]))]))};
}
export function sourcePlayerBlend(id,profile,hand,oppositeOccupied,using=true) {
 const doc=JSON.parse(readFileSync(new URL('animations/java_eating_player.animation.json',RP),'utf8')).animations;
 const side=hand==='main'?'right':'left',code={ONE:1,TWO:2,THREE:3,THREE_ALT:4,FOUR:5}[profile];
 const clip=doc['animation.kg_java_eating.player.'+profile.toLowerCase()+'.'+side];
 const context=createContext({variable:{is_first_person:1},q:{is_using_item:using?1:0,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,
  is_item_equipped:slot=>slot===hand+'_hand'||oppositeOccupied,
  is_item_name_any:(slot,...ids)=>slot==='slot.weapon.'+(hand==='main'?'mainhand':'offhand')&&ids.includes(id),
  property:key=>({eat_projection:1,eat_profile:code,eat_hand:hand==='main'?1:2}[key.split(':')[1]])}});
 return {weight:new Script(clip.blend_weight).runInContext(context,{timeout:100}),bones:clip.bones};
}

// Actual RC texture selection under supplied values; still not a renderer or
// Molang runtime. Deliberately omit attachable context `c`: native165 rejected
// c.is_first_person here. This permits an unexecuted pre_animation control and
// causes the previous165 RC to fail instead of granting it nonexistent context.
export function presentationTextures(id,{state={}}={}) {
 const doc=JSON.parse(readFileSync(new URL(`attachables/${id.split(':')[1]}.attachable.json`,RP),'utf8'))['minecraft:attachable'].description;
 return Object.fromEntries(doc.render_controllers.map(name=>{
  const rc=renderControllers[name],arrays={};
  for(const [key,values] of Object.entries(rc.arrays?.textures??{}))arrays[key.split('.')[1]]=values.map(value=>doc.textures[value.split('.')[1]]);
  const context=createContext({v:state,Array:arrays,Texture:doc.textures});
  return [name,rc.textures.map(value=>new Script(value).runInContext(context,{timeout:100}))];
 }));
}
