import {readEffects,writeEffects} from '../effect_state_runtime.js';
import {world,system} from '@minecraft/server';
import {effectsForStandaloneFood} from './standalone_food_effect_core.js';
import {mergeEffectApplication} from '../effect_lifecycle_core.js';

function now(){
 try{return Number(world.getAbsoluteTime())||system.currentTick}catch{return system.currentTick}
}
const readFx=readEffects,writeFx=writeEffects;
function applyPersistent(entity,effect){
 const t=now(),fx=readFx(entity);
 fx[effect.effect]=mergeEffectApplication(fx[effect.effect],effect.ticks,effect.amplifier??0,t);
 writeFx(entity,fx);
}
function applyNative(entity,effect){
 try{entity.addEffect(effect.effect,Math.max(1,Number(effect.ticks)||1),{...(effect.options??{})})}catch{}
}

export function applyStandaloneFoodEffects(entity,itemId){
 const effects=effectsForStandaloneFood(itemId);
 if(!effects.length)return false;
 for(const effect of effects){
  if(effect.kind==='persistent_fx')applyPersistent(entity,effect);
  else if(effect.kind==='native')applyNative(entity,effect);
 }
 return true;
}

world.afterEvents.itemCompleteUse.subscribe(event=>{
 try{applyStandaloneFoodEffects(event.source,event.itemStack?.typeId)}catch{}
});
