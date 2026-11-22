// Isolated, observational probe only. Does not import or call the production rescue handler.
import {world,system,GameMode,EquipmentSlot,ItemStack} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';

const PREFIX='[GRILLING_ABSORPTION_LEDGER] ';
const targets=new Map();
const pending=new Map();
const observedLedger=new Map();
const rows=[];
const emit=(kind,row={})=>{const value={kind,...row};rows.push(value);console.log(PREFIX+JSON.stringify(value));};
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const check=(value,message)=>{if(!value)throw Error(message)};
const idOf=entity=>entity?.id;
const isAbsorption=effect=>effect?.typeId==='absorption'||effect?.typeId==='minecraft:absorption';
function snapshot(entity){
 const health=entity.getComponent('minecraft:health');
 const effect=entity.getEffect('absorption');
 return {valid:entity.isValid,hp:health?.currentValue,absorption:effect?{typeId:effect.typeId,amplifier:effect.amplifier,duration:effect.duration}:null};
}

// Deliberately mutate one target before the observer callback. This shows that
// another after-hurt subscriber can contaminate a health-delta estimate.
world.afterEvents.entityHurt.subscribe(event=>{
 const target=targets.get(idOf(event.hurtEntity));
 if(target?.name!=='external_health_change'||target.interferenceApplied)return;
 target.interferenceApplied=true;
 const health=event.hurtEntity.getComponent('minecraft:health');
 const before=health?.currentValue;
 if(Number.isFinite(before)&&before<10)health.setCurrentValue(before+1);
 emit('external_health_change',{name:target.name,before,after:health?.currentValue,damage:event.damage});
});

world.afterEvents.effectAdd.subscribe(event=>{
 if(!isAbsorption(event.effect))return;
 const entity=event.entity,target=targets.get(idOf(entity));
 const amplifier=event.effect.amplifier;
 const maximum=Number.isInteger(amplifier)&&amplifier>=0?4*(amplifier+1):null;
 observedLedger.set(entity.id,{amplifier,remaining:maximum,known:maximum!==null,source:'effectAdd',duration:event.effect.duration});
 emit('effect_add',{name:target?.name??entity.nameTag??entity.typeId,amplifier,duration:event.effect.duration,initialMaximum:maximum,entityId:entity.id});
});

world.beforeEvents.entityHurt.subscribe(event=>{
 const target=targets.get(idOf(event.hurtEntity));
 if(!target)return;
 const state=snapshot(event.hurtEntity);
 const ledger=observedLedger.get(event.hurtEntity.id);
 const predictedHp=ledger?.known&&Number.isFinite(state.hp)?state.hp+ledger.remaining:null;
 pending.set(event.hurtEntity.id,{beforeHp:state.hp,damage:event.damage,phase:target.phase});
 emit('before_hurt',{name:target.name,phase:target.phase,damage:event.damage,before:state,ledger:ledger??null,predictedPostAbsorptionHp:predictedHp,predictedLethal:predictedHp===null?null:predictedHp<=0});
});

world.afterEvents.entityHurt.subscribe(event=>{
 const target=targets.get(idOf(event.hurtEntity));
 if(!target)return;
 const before=pending.get(event.hurtEntity.id);
 const after=snapshot(event.hurtEntity);
 const delta=before&&Number.isFinite(before.beforeHp)&&Number.isFinite(after.hp)?after.hp-before.beforeHp:null;
 const ledger=observedLedger.get(event.hurtEntity.id);
 let candidateRemaining=null,updateAllowed=false;
 if(ledger?.known&&delta!==null&&after.hp>0&&delta>=0){
  candidateRemaining=Math.max(0,ledger.remaining-delta);
  updateAllowed=true;
  // This is only an in-memory hypothesis inside this diagnostic, never saved
  // or connected to production gameplay.
  ledger.remaining=candidateRemaining;
 }
 emit('after_hurt',{name:target.name,phase:target.phase,damage:event.damage,beforeHp:before?.beforeHp??null,afterHp:after.hp,observedHealthDelta:delta,observedAbsorptionCandidate:delta,candidateRemaining,updateAllowed,overkillAmbiguous:after.hp<=0,effectAfter:after.absorption});
 pending.delete(event.hurtEntity.id);
});

world.afterEvents.entityDie.subscribe(event=>{
 const target=targets.get(idOf(event.deadEntity));
 if(target)emit('death',{name:target.name,phase:target.phase});
 observedLedger.delete(event.deadEntity.id);
});

system.runTimeout(async()=>{
 const entities=[],players=[];
 try{
  check(world.getAllPlayers().length===0,'unexpected real player in disposable probe world');
  const dimension=world.getDimension('overworld');
  try{dimension.runCommand('tickingarea add 0 64 0 31 64 31 grilling_absorption_ledger_probe')}catch{}
  for(let i=0;i<40;i++){
   try{if(dimension.getBlock({x:8,y:64,z:8}))break}catch{}
   await wait(5);
  }
  check(!!dimension.getBlock({x:8,y:64,z:8}),'probe area did not load');
  dimension.runCommand('gamerule doMobSpawning false');
  dimension.runCommand('gamerule naturalRegeneration false');
  dimension.runCommand('fill 0 63 0 31 63 31 minecraft:stone');
  const addPig=(name,x)=>{
   const entity=dimension.spawnEntity('minecraft:pig',{x:x+0.5,y:64,z:8.5});
   entity.nameTag=name;entities.push(entity);targets.set(entity.id,{name,phase:'setup',interferenceApplied:false});return entity;
  };
  const fresh=addPig('fresh_absorption',4);
  const spent=addPig('spent_absorption',8);
  const reapplied=addPig('effect_reapply',12);
  const resistant=addPig('armor_resistance',16);
  const interference=addPig('external_health_change',20);
  const player=spawnSimulatedPlayer({dimension,x:24.5,y:64,z:8.5},'AbsorptionLedgerPlayer',GameMode.Survival);
  players.push(player);targets.set(player.id,{name:'armor_control',phase:'setup',interferenceApplied:false});
  player.getComponent('minecraft:equippable')?.setEquipment(EquipmentSlot.Chest,new ItemStack('minecraft:iron_chestplate'));
  await wait(30);
  for(const entity of [fresh,spent,reapplied,resistant,interference,player]){
   targets.get(entity.id).phase='initial_effect';
   entity.addEffect('absorption',400,{amplifier:0,showParticles:false});
  }
  await wait(2);
  targets.get(fresh.id).phase='fresh_lethal_control';
  fresh.applyDamage(13,{cause:'entityAttack'});
  await wait(3);
  targets.get(spent.id).phase='spend_then_lethal';
  spent.applyDamage(3,{cause:'entityAttack'});
  await wait(2);
  spent.applyDamage(13,{cause:'entityAttack'});
  await wait(3);
  targets.get(reapplied.id).phase='spend_then_reapply';
  reapplied.applyDamage(3,{cause:'entityAttack'});
  await wait(2);
  reapplied.addEffect('absorption',400,{amplifier:0,showParticles:false});
  await wait(2);
  reapplied.applyDamage(13,{cause:'entityAttack'});
  await wait(3);
  targets.get(resistant.id).phase='resistance_control';
  resistant.addEffect('resistance',400,{amplifier:0,showParticles:false});
  await wait(2);
  resistant.applyDamage(3,{cause:'entityAttack'});
  await wait(2);
  targets.get(interference.id).phase='external_health_change';
  interference.getComponent('minecraft:health').setCurrentValue(9);
  interference.applyDamage(3,{cause:'entityAttack'});
  await wait(2);
  targets.get(player.id).phase='simulated_player_control';
  player.addEffect('absorption',400,{amplifier:0,showParticles:false});
  await wait(2);
  player.applyDamage(3,{cause:'entityAttack'});
  await wait(3);
  emit('summary',{ok:true,scenarios:['effect_add','fresh_lethal_control','spend_then_lethal','effect_reapply','resistance_control','external_health_change','armor_control'],observedEffectAdds:rows.filter(row=>row.kind==='effect_add').length,observations:rows.length,players:world.getAllPlayers().length,productionHandlerImported:false,eventCancellation:false,runtimeChanged:false});
 }catch(error){
  emit('failure',{error:String(error),stack:error?.stack,players:world.getAllPlayers().length});
 }finally{
  for(const player of players)try{player.disconnect()}catch{}
  for(const entity of entities)try{if(entity.isValid)entity.remove()}catch{}
  await wait(2);
  try{world.getDimension('overworld').runCommand('tickingarea remove grilling_absorption_ledger_probe')}catch{}
  emit('cleanup',{players:world.getAllPlayers().length,entitiesRemaining:entities.filter(entity=>entity.isValid).length});
 }
},30);
