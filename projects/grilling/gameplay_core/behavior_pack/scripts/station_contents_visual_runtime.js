import {getWorldPropertyIds} from './core/persist.js';
import {onBlockInteraction} from './core/events.js';
import {every,onlinePlayers} from './core/scheduler.js';
import {canonicalFoodId} from './eating_profile_ids.js';
import {SLIME_ID,readSlimeWorldFrame} from './slime_frame_core.js';
import {advancedRackToolVisuals} from './advanced_rack_visual_core.js';
import {RACK_TOOL_VISUAL_TYPE,rackToolVisualModel} from './rack_tool_visual_data.js';
import {rackDisplayPose,RACK_TOOL_VISUAL_Y,RACK_TOOL_VISUAL_Z} from './advanced_rack_layout.js';
import {syncRackDisplay} from './rack/rack_state_adapter.js';
import {PLATE_FOOD_VISUAL_TYPE,RECIPE_ICON_VISUAL_TYPE,CUSTOM_RECIPE_ICON_VISUAL_TYPE,VAT_PREMIUM_VISUAL_TYPE,plateMeshPlan,recipeIconModel,secretGuiIconPlan,recipeAnimationFrame,vatPremiumPlan,vatAnimationFrame,plateSlotPose,recipeIconPose,recipeMeshPose} from './plate_recipe_visual_core.js';
import {takeStationContentsVisualDirty} from './station_contents_visual_queue.js';
import {stationProjection,registerStationProjection} from './station_projection_core.js';
import {readPublicFood} from './host_api/food_api_core.js';
import {captureSkewerMetadata,metadataSignature} from './skewer_item_snapshot.js';
export {registerStationProjection};
import {VisualTargetQueue} from './visual_target_queue.js';
import {grillingConfig} from './server_config_runtime.js';
import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';
/** Transient native equipped-item renderers. Helpers never own or deliver station contents. */
import {world,system} from '@minecraft/server';
import {STORAGE_PREFIX,peekStationContainer} from './core/storage.js';
import {a25ReadPlateBlock,a25RestoreStack,a25ReadRecipeDisplayStack} from './plate/plate_recipe_runtime.js';
const TYPE='kaleidoscope_grilling:equipment_visual',work=new VisualTargetQueue(),targets=work.targets,orphaned=new Map();
let reader,helpers=0,lastWarning=-1200,indexing=false,lastCapacityWarning=-1200,lastAudience=-10;
export function configureSecretVisuals(read){reader=read;}
const key=b=>b.dimension.id+'|'+b.x+'|'+b.y+'|'+b.z;
export function rememberStationVisual(b){if(!b)return;const k=key(b);if(!targets.has(k))work.add(k,{dimensionId:b.dimension.id,location:{...b.location},parts:new Map()});}
function warn(e){if(system.currentTick-lastWarning>1200){lastWarning=system.currentTick;console.warn('[Grilling contents display] '+e)}}
function discard(row,k){
 const old=row.parts.get(k);if(!old)return true;
 // A spawn with no confirmed handle retains its quota. Do not create another
 // helper at this part until the old one is known gone (or transient restart).
 if(!old.entity)return false;
 try{
  if(old.entity.isValid!==false){
   if(old.entity.isValid!==true||old.entity.typeId!==old.type)return false;
   old.entity.remove();if(old.entity.isValid!==false)return false;
  }
  row.parts.delete(k);helpers--;return true;
 }catch(e){warn(e);return false;}
}
function clear(row){for(const k of [...row.parts.keys()])discard(row,k);}
export function renderItemType(entity,stack){
 // Stable 2.9 exposes native equipment only on players. A renderer can set and
 // verify an item type with native commands; its copy is never a stored item.
 if(!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(stack?.typeId??''))throw Error('render item identifier');
 const portable=readPublicFood(stack);if(portable.present&&!portable.valid)throw Error('Unreadable public projection metadata');
 const plan=stationProjection(stack,portable.valid?portable.state:undefined);
 entity.runCommand('replaceitem entity @s slot.weapon.mainhand 0 '+stack.typeId+' 1 '+plan.data);
 entity.runCommand('testfor @s[hasitem={item='+stack.typeId+',location=slot.weapon.mainhand,data='+plan.data+'}]');
 return {typeId:stack.typeId,data:plan.data,commandVerified:true};
}
function pose(block,dx,y,dz){const angle={north:0,east:90,south:180,west:270}[block.permutation.getState('minecraft:cardinal_direction')]??0,r=angle*Math.PI/180;return {location:{x:block.x+.5+dx*Math.cos(r)-dz*Math.sin(r),y:block.y+y,z:block.z+.5+dx*Math.sin(r)+dz*Math.cos(r)},angle};}
function render(row,b,k,stack,at,mode){
 let old=row.parts.get(k);const vat=mode===4?vatPremiumPlan(b):undefined;
 if((mode===4?!vat:!stack)||!at){discard(row,k);return;}
 const rackModel=mode===0?rackToolVisualModel(stack.typeId):undefined,iconModel=mode===3?recipeIconModel(stack):undefined;
 const customIcon=mode===3?secretGuiIconPlan(stack,reader):undefined;
 const slime=canonicalFoodId(stack?.typeId)===SLIME_ID;
 let frame=slime?readSlimeWorldFrame(world):0;
 if(vat){let tick;try{tick=world.getAbsoluteTime()}catch{tick=system.currentTick}frame=vatAnimationFrame(tick);}
 const mesh=(mode===1||(mode===3&&iconModel===undefined&&!customIcon))?plateMeshPlan(stack,reader,frame):undefined;
 const type=vat?VAT_PREMIUM_VISUAL_TYPE:customIcon?CUSTOM_RECIPE_ICON_VISUAL_TYPE:rackModel!==undefined?RACK_TOOL_VISUAL_TYPE:iconModel!==undefined?RECIPE_ICON_VISUAL_TYPE:mesh?PLATE_FOOD_VISUAL_TYPE:TYPE;
 if(old&&(old.entity?.isValid!==true||old.entity.typeId!==type)){if(!discard(row,k))return;old=undefined;}
 const signature=JSON.stringify({item:stack?metadataSignature(captureSkewerMetadata(stack)):undefined,at,mode,type,rackModel,iconModel,customIcon,vat,mesh,frame});if(old?.signature===signature)return;
 if(!old){
  if(helpers>=grillingConfig().contentsHelpers){if(system.currentTick-lastCapacityWarning>=1200){lastCapacityWarning=system.currentTick;console.warn("[Grilling contents capacity] render budget="+grillingConfig().contentsHelpers+"; storage unaffected; configure contentsHelpers after workload validation")}return;}
  // Reserve before spawning: an exception/unknown return may already have made
  // a client helper. Keeping the entry prevents repeat spawning and cap bypass.
  old={type,entity:undefined};row.parts.set(k,old);helpers++;
  try{old.entity=b.dimension.spawnEntity(type,at.location);if(old.entity?.isValid!==true||old.entity.typeId!==type)throw Error('Unconfirmed contents helper spawn')}
  catch(e){discard(row,k);throw e;}
 }
 try{
  old.entity.teleport(at.location,{dimension:b.dimension,rotation:{x:0,y:-at.angle}});
  if(type===TYPE){old.entity.setProperty('kaleidoscope_grilling:pose',mode===3?0:mode);renderItemType(old.entity,stack);}
  else{
   old.entity.setProperty('kaleidoscope_grilling:ready',false);
   if(vat){old.entity.setProperty('kaleidoscope_grilling:level',vat.level);old.entity.setProperty('kaleidoscope_grilling:frame',frame);}
   else if(customIcon){
    old.entity.setProperty('kaleidoscope_grilling:gui_count',customIcon.count);
    old.entity.setProperty('kaleidoscope_grilling:gui_bits',customIcon.bits);
    for(let i=0;i<3;i++)old.entity.setProperty(PersistedKey.GUI_COLOR_PREFIX+i,customIcon.colors[i]);
   }else old.entity.setProperty('kaleidoscope_grilling:model',rackModel??iconModel??mesh.model);
   if(iconModel!==undefined)old.entity.setProperty('kaleidoscope_grilling:frame',frame);
   if(mesh){old.entity.setProperty('kaleidoscope_grilling:display_mode',mode===3?1:0);for(let i=0;i<3;i++)old.entity.setProperty(PersistedKey.SECRET_PREFIX+i,mesh.secret[i]);}
   old.entity.setProperty('kaleidoscope_grilling:ready',true);
  }
  old.signature=signature;
 }catch(e){discard(row,k);throw e;}
}
export function syncStationContentsVisual(block,observers){
 rememberStationVisual(block);const row=targets.get(key(block));
 if(!observers.some(p=>p.dimensionId===row.dimensionId&&Math.hypot(p.x-block.x,p.y-block.y,p.z-block.z)<=48)){clear(row);if(row.parts.size)work.cleanup.add(key(block));return;}
 const seen=new Set();
 if(block.typeId==='kaleidoscope_grilling:advanced_rack_block'){
  const c=peekStationContainer(block);
  // Rebuild only derived display state for old saved racks when discovered.
  // Native contents, filters and ownership remain authoritative and unchanged.
  if(c)syncRackDisplay(block,Array.from({length:9},(_,i)=>c.getItem(i)));
  // Five occupied shelf jars are block bones; all four tools have fixed hooks.
  // Known tools use source-derived FIXED sprites; tagged extensions keep native equipment.
  // Four fixed X cells remain; known sprite bounds are centered in the clicked lower row.
  // Native tagged-item fallback keeps its previous Y anchor; client calibration is separate.
  for(const {slot,stack,x} of advancedRackToolVisuals(i=>c?.getItem(i))){
   const k='rack/'+slot;seen.add(k);const y=rackToolVisualModel(stack.typeId)===undefined?.35:RACK_TOOL_VISUAL_Y;
   render(row,block,k,stack,rackDisplayPose(block,x,y,RACK_TOOL_VISUAL_Z),0);
  }
 }else if(block.typeId==='kaleidoscope_grilling:skewer_plate_block'){
  const rows=a25ReadPlateBlock(block);
  for(let i=0;i<rows.length;i++){
   const stack=a25RestoreStack(rows[i]),k='plate/'+i;seen.add(k);
   render(row,block,k,stack,plateSlotPose(block,rows.length,i),1);
  }
 }else if(block.typeId==='kaleidoscope_grilling:skewer_recipe'){
  const stack=a25ReadRecipeDisplayStack(block),k='recipe/result';seen.add(k);
  // Java GUI-16 secret masks are composed by disjoint tinted layers. This uses
  // the saved recipe result and does not change native inventory icon routing.
  render(row,block,k,stack,recipeIconModel(stack)!==undefined||secretGuiIconPlan(stack,reader)?recipeIconPose(block):recipeMeshPose(block),3);
 }else if(block.typeId==='kaleidoscope_grilling:big_vat'){
  const k='vat/premium';seen.add(k);
  render(row,block,k,undefined,{location:{x:block.x+.5,y:block.y,z:block.z+.5},angle:0},4);
 }else if(block.typeId==='kaleidoscope_grilling:grill'){
  // Personalized grill meshes belong to grill_visual_runtime; clear old icon parts.
 }else{clear(row);if(!row.parts.size)work.remove(key(block));return;}
 for(const k of [...row.parts.keys()])if(!seen.has(k))discard(row,k);
}
function index(){if(indexing)return;indexing=true;system.runJob((function*(){try{for(const name of getWorldPropertyIds(world)){
 let dimensionId,x,y,z;
 if(name.startsWith(STORAGE_PREFIX)){const p=name.slice(STORAGE_PREFIX.length).split('/');if(p.length===4)[dimensionId,x,y,z]=p;}
 else{const p=/^kaleidoscope_grilling:(?:a25_(?:plate|recipe)|a26_vat)_(minecraft_(?:overworld|nether|the_end))_([pm]\d+)_([pm]\d+)_([pm]\d+)$/.exec(name);if(p){dimensionId=p[1].replace('minecraft_', 'minecraft:');[x,y,z]=p.slice(2).map(n=>Number(n.slice(1))*(n[0]==='m'?-1:1));}}
 if(dimensionId&&[x,y,z].every(n=>Number.isSafeInteger(Number(n)))){const location={x:Number(x),y:Number(y),z:Number(z)},k=dimensionId+'|'+x+'|'+y+'|'+z;if(!targets.has(k))work.add(k,{dimensionId,location,parts:new Map()});}yield;
 }}catch(e){warn(e)}finally{indexing=false}})());}
export function markStationContentsDirty(block){
 if(!block)return;const k=key(block);
 if(!targets.has(k)&&!['kaleidoscope_grilling:grill','kaleidoscope_grilling:advanced_rack_block','kaleidoscope_grilling:skewer_plate_block','kaleidoscope_grilling:skewer_recipe','kaleidoscope_grilling:big_vat'].includes(block.typeId))return;
 rememberStationVisual(block);work.mark(k);
}
function pump(){
 const budget=grillingConfig().contentsTargetsPerTick;
 for(const row of takeStationContentsVisualDirty(budget)){const k=[row.dimensionId,row.location.x,row.location.y,row.location.z].join('|');if(!targets.has(k))work.add(k,{...row,parts:new Map()});else work.mark(k);}
 // Startup leftovers have their own quota until confirmed removed. Retry one
 // per tick without querying chunks or consuming the station's stored items.
 for(const [id,row] of orphaned){const removed=discard(row,id);orphaned.delete(id);if(!removed)orphaned.set(id,row);break;}
 const viewers=onlinePlayers().map(p=>({dimensionId:p.dimension.id,...p.location}));if(system.currentTick-lastAudience>=10){lastAudience=system.currentTick;work.observe(viewers)};
 for(const k of work.take(budget)){
  const row=targets.get(k);if(!row)continue;
  try{if(!work.visible.has(k)){clear(row);if(row.parts.size)work.cleanup.add(k);continue;}const b=world.getDimension(row.dimensionId).getBlock(row.location);if(b)syncStationContentsVisual(b,viewers);else clear(row);}catch(e){clear(row);warn(e)}
 }
}
for(const name of ['playerPlaceBlock','playerInteractWithBlock','playerBreakBlock'])world.afterEvents[name].subscribe(e=>markStationContentsDirty(e.block));
// Grill/rack use their established deferred refresh. Plate/recipe transactions
// publish explicit post-commit coordinates through the queue above.
onBlockInteraction('station_contents_visual_runtime',e=>{if(['kaleidoscope_grilling:grill','kaleidoscope_grilling:advanced_rack_block'].includes(e.block.typeId)){const d=e.block.dimension,l={...e.block.location};system.run(()=>{try{markStationContentsDirty(d.getBlock(l))}catch{}})}},{"priority":20,"observe":true,"blocks":["kaleidoscope_grilling:grill","kaleidoscope_grilling:advanced_rack_block"]});
system.run(()=>{for(const dim of ['overworld','nether','the_end'])try{for(const type of [TYPE,RACK_TOOL_VISUAL_TYPE,PLATE_FOOD_VISUAL_TYPE,RECIPE_ICON_VISUAL_TYPE,CUSTOM_RECIPE_ICON_VISUAL_TYPE,VAT_PREMIUM_VISUAL_TYPE])for(const e of world.getDimension(dim).getEntities({type})){
 const id=e.id,row={parts:new Map([[id,{entity:e,type}]])};helpers++;if(!discard(row,id))orphaned.set(id,row);
}}catch(e){warn(e)};index();every('station_contents_visual_runtime:1',pump,1);every('station_contents_visual_runtime:2',index,400);});
export const contentsVisualHelperCount=()=>helpers;
