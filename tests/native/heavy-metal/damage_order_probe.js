// Isolated diagnostic only: native absorption and totem order, no arbitration.
import {world,system,ItemStack,EquipmentSlot,GameMode} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
import {FX_KEY} from './effect_lifecycle_core.js';
import {handleHeavyMetalBeforeHurt} from './heavy_metal_damage_runtime.js';
const PREFIX='[GRILLING_DAMAGE_ORDER] ',targets=new Map();
const emit=(kind,row={})=>console.log(PREFIX+JSON.stringify({kind,...row}));
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const check=(value,message)=>{if(!value)throw Error(message)};
const read=callback=>{try{return callback()}catch(error){return {error:String(error)}}};
function state(entity){
 return {valid:entity.isValid,hp:read(()=>entity.getComponent('minecraft:health').currentValue),
  absorption:read(()=>{const effect=entity.getEffect('absorption');return effect?{amplifier:effect.amplifier,duration:effect.duration}:null}),
  effects:read(()=>JSON.parse(entity.getDynamicProperty(FX_KEY)??'{}')),
  offhand:read(()=>entity.getComponent('minecraft:equippable')?.getEquipment(EquipmentSlot.Offhand)?.typeId??null)};
}
world.beforeEvents.entityHurt.subscribe(event=>{
 const record=targets.get(event.hurtEntity.id);if(!record)return;
 const before=state(event.hurtEntity),handled=handleHeavyMetalBeforeHurt(event);
 emit('before_hurt',{name:record.name,phase:record.phase,damage:event.damage,before,handled,cancel:event.cancel,after:state(event.hurtEntity)});
});
world.afterEvents.entityHurt.subscribe(event=>{
 const record=targets.get(event.hurtEntity.id);if(record)emit('after_hurt',{name:record.name,phase:record.phase,damage:event.damage,state:state(event.hurtEntity)});
});
world.afterEvents.entityDie.subscribe(event=>{
 const record=targets.get(event.deadEntity.id);if(record){record.died=true;emit('death',{name:record.name,phase:record.phase})}
});
system.runTimeout(async()=>{
 const players=[];
 try{
  check(world.getAllPlayers().length===0,'unexpected player');
  const dimension=world.getDimension('overworld');
  try{dimension.runCommand('tickingarea add 0 64 0 31 64 31 grilling_order_probe true')}catch{}
  for(let i=0;i<40;i++){
   try{if(dimension.getBlock({x:8,y:64,z:8}))break}catch{}
   await wait(5);
  }
  dimension.runCommand('gamerule doMobSpawning false');
  dimension.runCommand('gamerule naturalRegeneration false');
  dimension.runCommand('fill 0 63 0 31 63 31 minecraft:stone');
  const add=(entity,name,heavy=true)=>{
   entity.nameTag=name;targets.set(entity.id,{name,phase:'setup',died:false});
   if(heavy)entity.setDynamicProperty(FX_KEY,JSON.stringify({heavy_metal:{until:world.getAbsoluteTime()+3600,amp:0}}));
   return entity;
  };
  const fresh=add(dimension.spawnEntity('minecraft:pig',{x:5.5,y:64,z:5.5}),'fresh_absorption');
  const spent=add(dimension.spawnEntity('minecraft:pig',{x:10.5,y:64,z:5.5}),'spent_absorption');
  const control=add(spawnSimulatedPlayer({dimension,x:5.5,y:64,z:10.5},'TotemControl',GameMode.Survival),'totem_control',false);
  const metal=add(spawnSimulatedPlayer({dimension,x:10.5,y:64,z:10.5},'TotemHeavy',GameMode.Survival),'totem_heavy');
  players.push(control,metal);await wait(40);
  for(const pig of [fresh,spent])pig.addEffect('absorption',400,{amplifier:0,showParticles:false});
  targets.get(spent.id).phase='spend_shield';spent.applyDamage(3,{cause:'entityAttack'});await wait(22);
  check(fresh.getComponent('minecraft:health').currentValue===10&&spent.getComponent('minecraft:health').currentValue===10,'shield preparation changed health');
  emit('absorption_api',{components:read(()=>fresh.getComponents().map(component=>component.typeId).sort()),
   namedComponent:read(()=>{const c=fresh.getComponent('minecraft:absorption');return c?{typeId:c.typeId,currentValue:c.currentValue}:null}),
   fresh:state(fresh),spent:state(spent)});
  for(const pig of [fresh,spent]){targets.get(pig.id).phase='lethal_comparison';pig.applyDamage(13,{cause:'entityAttack'})}
  await wait(3);
  emit('absorption_results',{fresh:state(fresh),spent:state(spent),freshDied:targets.get(fresh.id).died,spentDied:targets.get(spent.id).died});
  for(const player of [control,metal]){
   player.getComponent('minecraft:health').setCurrentValue(10);
   player.getComponent('minecraft:equippable').setEquipment(EquipmentSlot.Offhand,new ItemStack('minecraft:totem_of_undying'));
   targets.get(player.id).phase='lethal_comparison';
  }
  for(const player of [control,metal])player.applyDamage(100,{cause:'entityAttack'});
  await wait(3);emit('totem_results',{control:state(control),heavy:state(metal)});
  check(!targets.get(fresh.id).died&&fresh.getComponent('minecraft:health').currentValue===1,'fresh shield control failed');
  check(control.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Offhand)===undefined,'native totem control was not consumed');
  emit('complete',{ok:true,scope:'controls and order observed; no parity claim'});
 }catch(error){emit('failure',{error:String(error),stack:error?.stack})}
 finally{
  for(const player of players)try{player.disconnect()}catch{}
  await wait(2);emit('disconnected',{players:world.getAllPlayers().length});
 }
},30);
