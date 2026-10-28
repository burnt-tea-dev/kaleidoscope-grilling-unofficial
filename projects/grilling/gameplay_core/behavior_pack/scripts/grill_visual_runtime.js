import {grillingConfig} from './server_config_runtime.js';
import {canonicalFoodId} from './eating_profile_ids.js';
import {secretVisualState} from './secret_visual_state.js';
import {grillVisualStage} from './grill_visual_core.js';
import {world,system} from '@minecraft/server';
import {peekStationContainer} from './family_station_storage.js';
import {readGrillState} from './a2740_grill_state_adapter.js';
import {GRILL_FOOD_ENTITY,grillVisualKey,nearGrill,grillSlotPlan,createGrillDisplayController} from './grill_visual_core.js';
const NS='kaleidoscope_grilling:';
let observers=[],lastSample=-1,lastWarning=-1200,secretReader;
export function configureSecretGrillReader(read){secretReader=read;}
function audience(){
 if(system.currentTick!==lastSample){lastSample=system.currentTick;observers=[];for(const p of world.getAllPlayers())try{observers.push({dimensionId:p.dimension.id,...p.location})}catch{}}
 return observers;
}
const displays=createGrillDisplayController({
 maxHelpers:()=>grillingConfig().fixedGrillHelpers,
 onCapacity(){if(system.currentTick-lastWarning>=1200){lastWarning=system.currentTick;console.warn('[Grilling grill display] render budget exceeded; storage unaffected; configure fixedGrillHelpers after workload validation')}},
 // Birth and subsequent teleport must share yaw; clients may interpolate a late correction.
 spawn:(block,location,rotation)=>block.dimension.spawnEntity(GRILL_FOOD_ENTITY,location,{initialRotation:rotation-180}),
 remove:entity=>{if(entity.isValid){entity.setProperty(NS+'ready',false);entity.remove();}},
 apply(entity,block,pose,plan,key){
  entity.setProperty(NS+'ready',false);
  entity.teleport(pose.location,{dimension:block.dimension,rotation:{x:0,y:pose.rotation-180}});
  entity.setProperty(NS+'model',plan.model);entity.setProperty(NS+'flips',plan.flips);
  for(let i=0;i<3;i++)entity.setProperty(NS+'secret_'+i,plan.secret?.[i]??0);
  // Java's individual 0.28–0.38 block hop; repeatable per slot/flip on reload.
  let seed=plan.slot*17+plan.flips*31;for(const c of key)seed=(seed*33+c.charCodeAt(0))>>>0;
  entity.setProperty(NS+'hop',280+seed%101);entity.setProperty(NS+'ready',true);
 }
});
/** Called by the existing native grill tick, including restored/command blocks. */
export function tickGrillDisplay(block){
 // Updates already refresh seen every five ticks, below the eight-tick expiry.
 // Avoid native location/identity reads on the four intervening ticks.
 if(system.currentTick%5!==0)return;
 syncGrillDisplay(block,audience());
}
export function syncGrillDisplay(block,viewers){
 const key=grillVisualKey(block);
 if(block.typeId!=='kaleidoscope_grilling:grill'||!nearGrill(block,viewers)){displays.clear(key);return;}
 try{
  const c=peekStationContainer(block),state=readGrillState(block);
  const plans=Array.from({length:3},(_,i)=>{const stack=c?.getItem(i),plan=grillSlotPlan(stack,state,i);if(plan&&canonicalFoodId(stack?.typeId)==='kaleidoscope_grilling:secret_skewer')plan.secret=secretVisualState(stack,secretReader,grillVisualStage(state));return plan;});
  const direction=block.permutation.getState('minecraft:cardinal_direction');
  displays.update(key,block,plans,system.currentTick,direction);
 }catch(error){
  displays.clear(key);
  if(system.currentTick-lastWarning>=1200){lastWarning=system.currentTick;console.warn('[Grilling grill display] '+error);}
 }
}
export const grillDisplayHelperCount=()=>displays.size;
system.run(()=>{
 // Remove only this transient render type; never touch native backing inventories.
 for(const id of ['overworld','nether','the_end'])try{for(const e of world.getDimension(id).getEntities({type:GRILL_FOOD_ENTITY}))e.remove();}catch{}
 system.runInterval(()=>displays.sweep(system.currentTick),5);
});
