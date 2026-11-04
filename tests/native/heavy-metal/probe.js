// Isolated capability probe. Import beside unchanged production modules only.
import {world,system} from '@minecraft/server';
import {FX_KEY} from './effect_lifecycle_core.js';
import {HEAVY_METAL_CLAIM_KEY} from './heavy_metal_claim_core.js';
import {handleHeavyMetalBeforeHurt} from './heavy_metal_damage_runtime.js';
const PREFIX='[GRILLING_HEAVY_METAL] ',KEY='grilling_probe:heavy_metal';
const emit=(kind,row={})=>console.log(PREFIX+JSON.stringify({kind,...row}));
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const check=(value,message)=>{if(!value)throw Error(message)};
let target;
world.beforeEvents.entityHurt.subscribe(event=>{
 if(event.hurtEntity.id!==target?.id)return;
 const provisional=target.getComponent('minecraft:health').currentValue;
 const handled=handleHeavyMetalBeforeHurt(event);
 const effects=JSON.parse(target.getDynamicProperty(FX_KEY)??'{}');
 const claim=target.getDynamicProperty(HEAVY_METAL_CLAIM_KEY);
 emit('before_hurt',{provisional,damage:event.damage,handled,cancel:event.cancel,effects,claim:typeof claim==='string'});
});
world.afterEvents.entityHurt.subscribe(event=>{
 if(event.hurtEntity.id===target?.id)emit('after_hurt',{hp:target.getComponent('minecraft:health').currentValue,damage:event.damage});
});
system.runTimeout(async()=>{
 try{
  check(world.getAllPlayers().length===0,'unexpected player');
  const dimension=world.getDimension('overworld');
  try{dimension.runCommand('tickingarea add 0 64 0 15 64 15 grilling_heavy_probe true')}catch{}
  for(let i=0;i<40;i++){
   try{if(dimension.getBlock({x:8,y:64,z:8}))break}catch{}
   await wait(5);
  }
  const saved=world.getDynamicProperty(KEY);
  if(saved){
   const expected=JSON.parse(saved);target=world.getEntity(expected.id);
   check(target?.isValid,'saved probe entity unavailable');
   const effects=JSON.parse(target.getDynamicProperty(FX_KEY)??'{}');
   const hp=target.getComponent('minecraft:health').currentValue;
   check(!effects.heavy_metal&&effects.heavy_metal_poisoning?.until===expected.poisonUntil,'rescue payment did not survive restart');
   check(effects.warmth?.until===expected.warmthUntil&&hp===1,'saved unrelated effect or health changed');
   check(typeof target.getDynamicProperty(HEAVY_METAL_CLAIM_KEY)==='string','saved claim missing');
   emit('complete',{stage:2,ok:true,hp,effects,players:world.getAllPlayers().length});return;
  }
  dimension.runCommand('gamerule doMobSpawning false');
  dimension.runCommand('fill 0 63 0 15 63 15 minecraft:stone');
  target=dimension.spawnEntity('minecraft:pig',{x:8.5,y:64,z:8.5});
  target.nameTag='Grilling Heavy Metal probe';
  const time=world.getAbsoluteTime(),poisonUntil=time+12000,warmthUntil=time+1000;
  target.setDynamicProperty(FX_KEY,JSON.stringify({heavy_metal:{until:time+1,amp:0},warmth:{until:warmthUntil,amp:0}}));
  const applied=target.applyDamage(100,{cause:'entityAttack'});
  emit('apply_damage_return',{applied,hp:target.getComponent('minecraft:health').currentValue});
  const immediate=JSON.parse(target.getDynamicProperty(FX_KEY)??'{}');
  check(!immediate.heavy_metal&&immediate.heavy_metal_poisoning?.until===poisonUntil,'before-hurt effect write was not acknowledged');
  await wait(3);
  const hp=target.getComponent('minecraft:health').currentValue;
  check(hp===1,'queued native health did not settle at 1');
  check(immediate.warmth?.until===warmthUntil,'unrelated effect lost');
  world.setDynamicProperty(KEY,JSON.stringify({id:target.id,poisonUntil,warmthUntil}));
  emit('complete',{stage:1,ok:true,hp,effects:immediate,players:world.getAllPlayers().length});
 }catch(error){emit('failure',{error:String(error),stack:error?.stack})}
},30);
