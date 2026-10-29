import {readEffects,writeEffects} from "../effect_state_runtime.js";
import {now} from "../core/actions.js";
import {FX_KEY,mergeEffectApplication} from "../effect_lifecycle_core.js";
import {canonicalFoodId} from "../eating_profile_ids.js";
import {COOKED_EFFECTS,GRILL_ID} from "../eating_data_lookup.js";
import {seasoningEffectCounts} from "../seasoning/seasoning_contract_core.js";
import {forgetDragonHealth,nativeDragonHealth} from "../dragon_native_health.js";
import {awardMetalToleranceFailed,awardOrdinaryChallenge,ordinaryChallengeOutcome} from "../advancement/advancement_challenge_runtime.js";
import {DANGEROUS_FOODS,hasFoodUse} from "../food/runtime.js";
import {invincibleAmbientFeedback,invincibleDamageFeedback,ordinaryFatalFeedback,ordinaryShieldFeedback} from "../immersion_effect_feedback.js";
import {system,world} from "@minecraft/server";
import {abandonProjectileDodge,forgetProjectileDodge,reserveProjectileDodge,settleProjectileDodge} from "../projectile_dodge_runtime.js";
import {forgetHeavyMetalRescue,handleHeavyMetalBeforeHurt} from "../heavy_metal_damage_runtime.js";
import {tryProjectileDodgeMovement} from "../projectile_dodge_movement_runtime.js";
import {FLATULENCE_SOUND_ID,projectileDodgeTeleportFeedback} from "../projectile_dodge_audio_runtime.js";
import {isCookeryLivingEntity} from "../cookery_living_class.js";
import {readGrillState as readState} from "../grill/grill_state_adapter.js";
import {interactionParticleBurst} from "../immersion_particles_runtime.js";
import {flatulenceSoundOrigin,flatulenceSoundPitch} from "../flatulence_sound_runtime.js";
import {forgetNumbVisual,updateNumbVisual} from "../numb_visual_runtime.js";
const VIGOR_LAST=new Map();
const SNEAK_LAST=new Map();

const HEAT_BLOCKS=new Set(['minecraft:fire','minecraft:soul_fire','minecraft:lava','minecraft:campfire','minecraft:soul_campfire','minecraft:magma']);

const TUNDRA_BLOCKS=new Set(['minecraft:snow','minecraft:snow_layer','minecraft:snow_block','minecraft:powder_snow','minecraft:ice','minecraft:packed_ice','minecraft:blue_ice','minecraft:frosted_ice']);

function readFx(entity){try{return readEffects(entity)}catch{return {}}}

function writeFx(entity,fx,options){try{return writeEffects(entity,fx,options)}catch{return {}}}

function fxGet(entity,name){const v=readFx(entity)[name];return v&&Number(v.until)>now()?v:null}

function fxSet(entity,name,ticks,amp=0){const fx=readFx(entity);fx[name]={until:now()+Math.max(1,ticks|0),amp:amp|0};writeFx(entity,fx,{refreshProjectileDodge:name==='projectile_dodge'})}

function fxApply(entity,name,ticks,amp=0){
 try{const fx=readEffects(entity);fx[name]=mergeEffectApplication(fx[name],ticks,amp,now());return writeEffects(entity,fx,{refreshProjectileDodge:name==='projectile_dodge'})[name]}
 catch(error){console.warn('[Grilling effect application] '+name+': '+error);return undefined}
}

function fxClear(entity,name){const fx=readFx(entity);delete fx[name];writeFx(entity,fx,{refreshProjectileDodge:name==='projectile_dodge'})}

function fxReduce(entity,name,ticks){const fx=readFx(entity),v=fx[name];if(!v)return;v.until-=ticks;if(v.until<=now())delete fx[name];writeFx(entity,fx)}

function fxSnapshot(entity){
 const out={},t=now();
 for(const [name,v] of Object.entries(readFx(entity)))out[name]={duration:Math.max(0,v.until-t)};
 return out;
}

function nativeSnapshot(entity){const out={};try{for(const e of entity.getEffects())out[e.typeId]={duration:e.duration,amplifier:e.amplifier}}catch{}return out}

function doubleNewNative(player,before){try{for(const e of player.getEffects()){const old=before[e.typeId]?.duration??0;if(e.duration<=old)continue;const duration=old+(e.duration-old)*2;player.removeEffect(e.typeId);player.addEffect(e.typeId,Math.max(1,duration),{amplifier:e.amplifier,showParticles:true})}}catch{}}

function doubleNewFx(player,before){
 const current=readFx(player),t=now();
 for(const [name,v] of Object.entries(current)){
  if(name==='invincible')continue;
  // Java compares completion-time remaining duration with the start snapshot,
  // so time spent eating cannot become an additional hot-food reward.
  const old=before[name]?.duration??0,duration=Math.max(0,v.until-t);
  if(duration<=old)continue;
  v.until=t+old+(duration-old)*2;
  // Java HotFoodHandler removes/re-adds the extended active instance.
  delete v.hidden;
 }
 writeFx(player,current);
}

function applyFixedEffect(player,id){
 id=canonicalFoodId(id);
 const e=COOKED_EFFECTS[id];if(!e||!e.effect)return;const ticks=Math.max(1,e.seconds*20);
 if(e.effect.startsWith('minecraft:')){try{player.addEffect(e.effect.split(':')[1],ticks,{showParticles:true})}catch{}return}
 if(e.effect==='kaleidoscope_grilling:invincible'){fxApply(player,'invincible',ticks);return}
 if(e.effect.startsWith('kaleidoscope_cookery:'))fxApply(player,e.effect.split(':')[1],ticks);
}

function counts(list){return seasoningEffectCounts(list)}

function applyDragonBlood(player,ticks,amp){
 const applied=fxApply(player,'dragon_blood',ticks,amp);
 if(applied)nativeDragonHealth(player,applied.amp,{heal:true});
}


function applySeasoning(player,list){
 const c=counts(list);let duration=3600;if((c.duration??0)>=4)duration*=4;else if((c.duration??0)>0)duration*=2;
 if((c.speed??0)>0)try{player.addEffect('speed',duration,{amplifier:c.speed>=4?1:0,showParticles:true})}catch{}
 if((c.strength??0)>0)try{player.addEffect('strength',duration,{amplifier:c.strength>=4?1:0,showParticles:true})}catch{}
 if((c.numbness??0)>=4)fxApply(player,'numb',900*((c.duration??0)>=4?4:(c.duration??0)>0?2:1));
 if((c.totem??0)>0){
  const poisoned=!!fxGet(player,'heavy_metal_poisoning');
  if(poisoned)awardMetalToleranceFailed(player,c.totem,true);
  else fxApply(player,'heavy_metal',duration,c.totem>=4?1:0);
 }
 if((c.vitality??0)>0)applyDragonBlood(player,duration,c.vitality>=4?1:0);
}

function dangerousPreservation(player,itemId){if(!DANGEROUS_FOODS.has(itemId)||!fxGet(player,'preservation'))return;for(const id of ['hunger','poison','nausea'])try{player.removeEffect(id)}catch{}}

function applyOrdinary(player){
 const challenged=!!fxGet(player,'invincible');if(challenged)fxClear(player,'invincible');
 const outcome=ordinaryChallengeOutcome(challenged,Math.random());
 if(outcome==='shield'){awardOrdinaryChallenge(player,outcome);ordinaryShieldFeedback(player);return}
 if(outcome==='spear')awardOrdinaryChallenge(player,outcome);
 ordinaryFatalFeedback(player);
 // Java uses damage, not generic kill: Heavy Metal and native totems retain their damage/death route.
 system.run(()=>{try{player.applyDamage(3.4028234663852886e38,{cause:'override'})}catch(error){console.warn('[Grilling ordinary damage] '+error)}});
}

world.afterEvents.entityDie.subscribe(e=>{forgetProjectileDodge(e.deadEntity);forgetHeavyMetalRescue(e.deadEntity)});

world.afterEvents.entityRemove.subscribe(e=>{forgetProjectileDodge(e.removedEntityId);forgetHeavyMetalRescue(e.removedEntityId)});

world.beforeEvents.entityHurt.subscribe(e=>{
 if(e.cancel)return;
 const target=e.hurtEntity,cause=e.damageSource?.cause;
 if(e.damageSource?.damagingProjectile){
  const claim=reserveProjectileDodge(target);
  if(claim){try{
   system.run(()=>settleProjectileDodge(target,claim,()=>{const moved=tryProjectileDodgeMovement(target);if(moved.success)projectileDodgeTeleportFeedback(target,moved.origin)}));
   e.cancel=true;return;
  }catch(error){abandonProjectileDodge(claim);console.warn('[Grilling projectile dodge schedule] '+error)}}
 }
 if(fxGet(target,'invincible')&&cause!=='selfDestruct'&&cause!=='override'){e.cancel=true;invincibleDamageFeedback(target);return}
 handleHeavyMetalBeforeHurt(e);
});

world.afterEvents.entityHurt.subscribe(e=>{
 // Cookery HinderEvent follows damage from a living attacker, including its
 // projectile; a melee contact event cannot represent that source contract.
 // Java has no positive-amount gate. Do not invent one for after-hurt events.
 try{
  const source=e.damageSource;
  let attacker=source?.damagingEntity;
  if(!isCookeryLivingEntity(attacker)){
   const projectile=source?.damagingProjectile;
   // Native hurt may report the arrow itself as damagingEntity. Resolve its
   // living owner, while preserving an independently reported actor's priority.
   if(attacker&&projectile&&attacker.id!==projectile.id)return;
   attacker=(projectile??attacker)?.getComponent('minecraft:projectile')?.owner;
  }
  if(!isCookeryLivingEntity(attacker)||!isCookeryLivingEntity(e.hurtEntity)||!fxGet(attacker,'hinder'))return;
  e.hurtEntity.addEffect('slowness',100,{amplifier:1,showParticles:true});
 }catch{} // A removed actor/projectile must not abort other damage subscribers.
});

function nearHeat(player){
 const p=player.location,d=player.dimension;for(let x=-2;x<=2;x++)for(let y=-1;y<=1;y++)for(let z=-2;z<=2;z++){try{const b=d.getBlock({x:Math.floor(p.x)+x,y:Math.floor(p.y)+y,z:Math.floor(p.z)+z});if(!b)continue;if(HEAT_BLOCKS.has(b.typeId))return true;if(b.typeId===GRILL_ID&&readState(b).lit)return true;if(['minecraft:furnace','minecraft:smoker','minecraft:blast_furnace'].includes(b.typeId)&&b.permutation.getState('lit')===true)return true}catch{}}return false;
}

function fleeCreepers(player){
 try{for(const e of player.dimension.getEntities({type:'minecraft:creeper',location:player.location,maxDistance:6})){const dx=e.location.x-player.location.x,dz=e.location.z-player.location.z,len=Math.max(.001,Math.hypot(dx,dz));e.applyKnockback({x:dx/len*.12,z:dz/len*.12},.02)}}catch{}
}

function repelPhantoms(player){
 try{for(const e of player.dimension.getEntities({type:'minecraft:phantom',location:player.location,maxDistance:18})){const dx=e.location.x-player.location.x,dy=e.location.y-player.location.y,dz=e.location.z-player.location.z;if(Math.abs(dx)>8||Math.abs(dz)>8||Math.abs(dy)>16)continue;const len=Math.max(.001,Math.hypot(dx,dz));e.applyKnockback({x:dx/len*.16,z:dz/len*.16},.06)}}catch{}
}

function tundraFactor(id){if(id==='minecraft:blue_ice')return 1.1055;if(['minecraft:ice','minecraft:packed_ice','minecraft:frosted_ice'].includes(id))return 1.11;return 1.3}


function tickPlayerEffects(p){
const fx=readFx(p);
  if(system.currentTick%10===0&&fx.invincible)invincibleAmbientFeedback(p);
  writeFx(p,fx);
  const hunger=fx.vigor?p.getComponent('minecraft:player.hunger'):undefined,sat=fx.vigor?p.getComponent('minecraft:player.saturation'):undefined;
  if(fx.vigor&&hunger&&sat){const prev=VIGOR_LAST.get(p.id);if(p.isSprinting&&prev){if(hunger.currentValue<prev.hunger)hunger.setCurrentValue(prev.hunger);if(sat.currentValue<prev.sat)sat.setCurrentValue(prev.sat)}VIGOR_LAST.set(p.id,{hunger:hunger.currentValue,sat:sat.currentValue})}else VIGOR_LAST.delete(p.id);
  const sneak=!!p.isSneaking,was=SNEAK_LAST.get(p.id)??false;if(sneak&&!was&&fx.flatulence){p.applyImpulse({x:0,y:.75,z:0});const dimension=p.dimension;interactionParticleBurst(dimension,p.location,'flatulence');try{const origin=flatulenceSoundOrigin(p);if(origin){const pitch=flatulenceSoundPitch();if(pitch!==undefined)dimension.playSound(FLATULENCE_SOUND_ID,origin,{volume:1,pitch})}}catch{}}SNEAK_LAST.set(p.id,sneak);
  if(system.currentTick%5===0){if(fx.mustard)fleeCreepers(p);if(fx.sulfur)repelPhantoms(p)}
  if(fx.tundra_strider){try{const b=p.getBlockStandingOn();if(b&&TUNDRA_BLOCKS.has(b.typeId)){const v=p.getVelocity(),factor=tundraFactor(b.typeId);p.applyImpulse({x:v.x*(factor-1),y:0,z:v.z*(factor-1)});if(b.typeId==='minecraft:powder_snow'&&v.y<.02)p.applyImpulse({x:0,y:Math.min(.16,Math.max(.04,-v.y+.04)),z:0})}}catch{}}
  if(system.currentTick%20===0&&fx.warmth){const hp=p.getComponent('minecraft:health');if(hp&&hp.currentValue<hp.effectiveMax){if(nearHeat(p))hp.setCurrentValue(Math.min(hp.effectiveMax,hp.currentValue+1));else if(p.dimension.id==='minecraft:nether'&&Math.random()<.25)hp.setCurrentValue(Math.min(hp.effectiveMax,hp.currentValue+.5))}}
  const db=fx.dragon_blood;nativeDragonHealth(p,db?.amp);
  updateNumbVisual(p,!!fx.numb&&!hasFoodUse(p.id)&&!(p.getProperty('kaleidoscope_grilling:season_phase')>0),system.currentTick);
}
function forgetEffectMovement(id){VIGOR_LAST.delete(id);SNEAK_LAST.delete(id);}
function forgetPlayerEffects(id){
 forgetEffectMovement(id);forgetProjectileDodge(id);forgetHeavyMetalRescue(id);
 forgetDragonHealth(id);forgetNumbVisual(id);
}
export {applyFixedEffect,applyOrdinary,applySeasoning,dangerousPreservation,doubleNewFx,doubleNewNative,forgetEffectMovement,forgetPlayerEffects,fxApply,fxSnapshot,nativeSnapshot,tickPlayerEffects};
