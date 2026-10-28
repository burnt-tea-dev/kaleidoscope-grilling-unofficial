import {every} from './core/scheduler.js';
import {system} from '@minecraft/server';
import {createFeedbackCooldown,goldenSkewerParticles,invincibleAmbientParticle} from './immersion_particles_core.js';
import {emitParticles,interactionParticleBurst} from './immersion_particles_runtime.js';
import {recordSoundDelivery} from './immersion_feedback_diagnostics.js';
const shieldCooldown=createFeedbackCooldown(6);
every('immersion_effect_feedback:1',()=>shieldCooldown.sweep(system.currentTick),10);
function feedbackSound(dimension,location,id,volume,pitch){try{dimension.playSound(id,location,{volume,pitch});recordSoundDelivery()}catch(error){recordSoundDelivery(error)}}
function context(entity){try{return {dimension:entity.dimension,location:entity.location}}catch{return undefined}}
export function invincibleDamageFeedback(entity){
 // Called from the read-only damage event: reserve the cosmetic cooldown now,
 // then emit only from a mutable tick. Damage cancellation remains with main.
 if(!shieldCooldown.claim(entity.id,system.currentTick))return;
 system.run(()=>{
  const state=context(entity);if(!state)return;const {dimension,location}=state;
  feedbackSound(dimension,location,'kg_java21.shield',.7,1.25);
  let height;try{height=entity.getAABB().extent.y*2}catch{return}
  const center={...location,y:location.y+height*.55};
  interactionParticleBurst(dimension,center,'invincibleSpark');
  interactionParticleBurst(dimension,center,'invincibleRod');
 });
}
export function invincibleAmbientFeedback(entity){const state=context(entity);if(state)emitParticles(state.dimension,state.location,invincibleAmbientParticle())}
export function goldenSkewerFeedback(entity){
 const state=context(entity);if(!state)return;const {dimension,location}=state;
 feedbackSound(dimension,location,'kg_java21.golden',.8,1.15);
 emitParticles(dimension,location,goldenSkewerParticles());
}
export function ordinaryShieldFeedback(entity){
 const state=context(entity);if(!state)return;const {dimension,location}=state;
 feedbackSound(dimension,location,'kg_java21.shield',1,.8);
 feedbackSound(dimension,location,'kg_java21.chime',.8,1.35);
 interactionParticleBurst(dimension,location,'ordinaryShield');
}

export function ordinaryFatalFeedback(entity){
 const state=context(entity);if(!state)return;const {dimension,location}=state;
 feedbackSound(dimension,location,'kg_java21.ordinary_break',1,.65);
 feedbackSound(dimension,location,'kg_java21.ordinary_impact',.7,.55);
 interactionParticleBurst(dimension,location,'ordinaryDamage');
 interactionParticleBurst(dimension,location,'ordinarySmoke');
}
