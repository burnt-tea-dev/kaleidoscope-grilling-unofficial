// Passive capability observer. No Heavy Metal handler or damage cancellation.
import {world,system,ItemStack,EquipmentSlot,GameMode,EntityHealCause} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
const KEY='grilling_qa:sensor_event',targets=new Map(),players=new Set();
const wait=n=>new Promise(resolve=>system.runTimeout(resolve,n));
let started=false,sequence=0,actorSequence=0;
const read=fn=>{try{return fn()}catch(error){return {error:String(error)}}};
function state(player){
 const effect=read(()=>player.getEffect('absorption'));
 return {health:read(()=>player.getComponent('minecraft:health').currentValue),
  marker:read(()=>player.getProperty(KEY)),
  absorption:effect?.error?effect:effect?{amplifier:effect.amplifier,duration:effect.duration}:null,
  offhand:read(()=>player.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Offhand)?.typeId??null)};
}
function record(player,kind,data={}){
 const row=targets.get(player.id);if(!row)return;
 row.events.push({index:++sequence,tick:system.currentTick,phase:row.phase,kind,...data,state:state(player)});
}
world.beforeEvents.entityHurt.subscribe(event=>record(event.hurtEntity,'before_hurt',{damage:event.damage,cause:event.damageSource?.cause,cancel:event.cancel}));
world.afterEvents.entityHurt.subscribe(event=>record(event.hurtEntity,'after_hurt',{damage:event.damage,cause:event.damageSource?.cause}));
world.afterEvents.dataDrivenEntityTrigger.subscribe(event=>{
 if(event.eventId.startsWith('grilling_qa:'))record(event.entity,'data_event',{eventId:event.eventId});
});
world.afterEvents.entityHeal.subscribe(event=>record(event.healedEntity,'heal',{healing:event.healing,totem:event.healSource?.cause===EntityHealCause.TotemOfUndying}));
world.afterEvents.entityDie.subscribe(event=>{
 const row=targets.get(event.deadEntity.id);if(row)row.died=true;
 record(event.deadEntity,'death',{cause:event.damageSource?.cause});
});
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='grilling_qa:fatal_sensor'||started)return;
 started=true;run().catch(error=>console.error('GRILLING_QA_FATAL '+error+' '+error?.stack));
});
function fatalEvidence(row){
 const events=row.events.filter(event=>event.phase==='test');
 const ack=events.find(event=>event.kind==='data_event'&&event.eventId==='grilling_qa:ack_fatal');
 const before=events.find(event=>event.kind==='before_hurt');
 return {eventAck:!!ack,markerObserved:row.immediate?.marker===2||row.after?.marker===2||events.some(event=>event.state.marker===2),
  ackIndex:ack?.index??null,beforeHurtIndex:before?.index??null,
  ackBeforeScriptBeforeHurt:!!ack&&!!before&&ack.index<before.index,
  markerAtScriptBeforeHurt:before?.state.marker??null};
}
async function run(){
 const dimension=world.getDimension('overworld'),checks=[],samples=[];
 const check=(name,passed)=>{checks.push({name,passed:!!passed});console.warn('GRILLING_QA_CHECK '+JSON.stringify(checks.at(-1)))};
 check('isolated QA has no external Players',world.getAllPlayers().length===0);
 if(world.getAllPlayers().length)throw Error('external Players');
 dimension.runCommand('gamerule naturalregeneration false');
 dimension.runCommand('gamerule keepinventory true');
 dimension.runCommand('fill -2 79 -2 2 79 2 stone');
 dimension.runCommand('fill -2 80 -2 2 84 2 air');
 async function actor(name,mode){
  const player=spawnSimulatedPlayer({dimension,x:(actorSequence%2)*2-.5,y:80,z:.5},'FatalSensor'+(++actorSequence),GameMode.Survival);
  players.add(player);
  const row={name,mode,phase:'setup',events:[],died:false};targets.set(player.id,row);
  await wait(2);
  player.getComponent('minecraft:health').setCurrentValue(10);
  player.triggerEvent('grilling_qa:observe_'+mode);await wait(2);
  check(name+' starts at 10 native HP with a reset marker',state(player).health===10&&state(player).marker===0);
  return {player,row};
 }
 async function retire(actor){
  actor.player.disconnect();players.delete(actor.player);targets.delete(actor.player.id);await wait(2);
 }
 function hit(actor,damage){
  const {player,row}=actor;row.phase='test';row.before=state(player);
  row.accepted=player.applyDamage(damage,{cause:'entityAttack'});row.immediate=state(player);
 }
 async function single(name,mode,{damage=13,armor=false,totem=false}={}){
  const a=await actor(name,mode),equipment=a.player.getComponent('minecraft:equippable');
  if(armor){
   const pieces=[[EquipmentSlot.Head,'diamond_helmet'],[EquipmentSlot.Chest,'diamond_chestplate'],[EquipmentSlot.Legs,'diamond_leggings'],[EquipmentSlot.Feet,'diamond_boots']];
   check(name+' equips all four native armor pieces',pieces.map(([slot,id])=>equipment.setEquipment(slot,new ItemStack('minecraft:'+id))).every(Boolean));
  }
  if(totem)check(name+' equips the native offhand totem',equipment.setEquipment(EquipmentSlot.Offhand,new ItemStack('minecraft:totem_of_undying')));
  hit(a,damage);await wait(2);a.row.after=state(a.player);a.row.fatal=fatalEvidence(a.row);
  samples.push(a.row);await retire(a);return a.row;
 }
 async function pair(mode){
  const fresh=await actor(mode+'_fresh_shield',mode),spent=await actor(mode+'_spent_shield',mode);
  for(const a of [fresh,spent])a.player.addEffect('absorption',400,{amplifier:0,showParticles:false});
  spent.row.phase='spend';spent.player.applyDamage(3,{cause:'entityAttack'});await wait(22);
  for(const a of [fresh,spent])a.player.triggerEvent('grilling_qa:reset_sensor');
  await wait(2);
  const a=state(fresh.player),b=state(spent.player);
  check(mode+' shield pair has matching 10HP, amplifier, duration and reset marker',a.health===10&&b.health===10&&
   a.absorption?.amplifier===0&&b.absorption?.amplifier===0&&a.absorption.duration===b.absorption.duration&&a.marker===0&&b.marker===0);
  for(const item of [fresh,spent])hit(item,13);
  await wait(2);
  for(const item of [fresh,spent]){
   item.row.after=state(item.player);item.row.fatal=fatalEvidence(item.row);samples.push(item.row);
  }
  const result={fresh:fresh.row,spent:spent.row};
  await retire(fresh);await retire(spent);return result;
 }
 let manual,any,baseline,observed,bare,armorControl,armorSensor,totemControl,totemSensor;
 try{
  const a=await actor('manual_event_positive_control','none');
  a.player.triggerEvent('grilling_qa:ack_fatal');await wait(2);manual=state(a.player);
  check('manual JSON event changes the real Player property',manual.marker===2);
  samples.push({...a.row,after:manual});await retire(a);
  any=await single('unconditional_sensor_control','any',{damage:1});
  check('passive unconditional sensor retains native one-point damage',any.accepted&&!any.died&&any.after.health===9);
  baseline=await pair('none');observed=await pair('fatal');
  check('native baseline full shield survives and spent shield dies',!baseline.fresh.died&&baseline.fresh.after.health===1&&baseline.spent.died);
  check('passive fatal filter keeps the same native shield outcomes',!observed.fresh.died&&observed.fresh.after.health===1&&observed.spent.died);
  bare=await single('bare_fatal_positive_control','fatal');
  check('bare 10HP control dies to native 13 damage',bare.accepted&&bare.died);
  armorControl=await single('armor_baseline','none',{armor:true});
  armorSensor=await single('armor_fatal_sensor','fatal',{armor:true});
  check('native armor baseline survives 13 raw damage',armorControl.accepted&&!armorControl.died&&armorControl.after.health>0);
  check('passive sensor keeps the same armored result',armorSensor.accepted&&!armorSensor.died&&armorSensor.after.health===armorControl.after.health);
  totemControl=await single('totem_baseline','none',{damage:100,totem:true});
  totemSensor=await single('totem_fatal_sensor','fatal',{damage:100,totem:true});
  for(const row of [totemControl,totemSensor])check(row.name+' preserves native totem consumption and actual healing',
   !row.died&&row.after.health>0&&row.after.offhand===null&&row.events.some(event=>event.kind==='heal'&&event.totem&&event.healing>0));
 }finally{
  for(const player of players){try{player.disconnect()}catch(error){console.warn('QA disconnect: '+error)}}
  targets.clear();
  players.clear();await wait(2);
 }
 check('all native Players disconnected',world.getAllPlayers().length===0);
 const acknowledged=row=>row.fatal.eventAck||row.fatal.markerObserved;
 const beforeHurt=row=>row.fatal.ackBeforeScriptBeforeHurt||row.fatal.markerAtScriptBeforeHurt===2;
 const capabilities={
  playerUnconditionalDamageEvent:any.immediate.marker===1||any.after.marker===1||any.events.some(event=>event.eventId==='grilling_qa:ack_any'),
  bareFatalEvent:acknowledged(bare),
  distinguishesFreshAndSpentShields:!acknowledged(observed.fresh)&&acknowledged(observed.spent),
  fatalSignalAvailableBeforeScriptHurt:beforeHurt(observed.spent),
  armoredSurvivalIncorrectlyMarkedFatal:acknowledged(armorSensor),
  protectedTotemHitMarkedFatal:acknowledged(totemSensor)
 };
 console.warn('GRILLING_QA_RESULT '+JSON.stringify({passed:checks.every(row=>row.passed),phase:'fatal-sensor',checks,samples,capabilities,
  playersAfter:world.getAllPlayers().length,javaParity:false,adoptedRuntime:false,
  scope:'Passive has_damage:fatal capability and event timing on actual Players using a QA overlay over pinned Mojang player data. Controls validate native shield/armor/totem outcomes; capability observations are separate. No Heavy Metal handler, remaining-shield ledger, resurrection, client, full-family or LIVE claim.'}));
}
