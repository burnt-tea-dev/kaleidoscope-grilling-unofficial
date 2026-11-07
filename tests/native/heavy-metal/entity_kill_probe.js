// Diagnostic entry only. Full production main registers its owners first, once.
import './main.js';
import {world,system,ItemStack,EquipmentSlot,GameMode,EntityHealCause} from '@minecraft/server';
import {fxApply} from './effect/runtime.js';
import {FX_KEY} from './effect_lifecycle_core.js';
import {HEAVY_METAL_CLAIM_KEY,parseHeavyMetalClaim} from './heavy_metal_claim_core.js';
import {captureSkewerMetadata} from './skewer_item_snapshot.js';
import {plainKillGate} from './entity_kill_gate.js';

const NAMES=['qaNetPlain','qaNetHeavy'],TOTEM='minecraft:totem_of_undying';
const cases=[],events=[],checks=[],capabilities={},byId=new Map(),byName=new Map();
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const read=fn=>{try{return fn()}catch(error){return {error:String(error)}}};
const emit=(marker,data)=>console.warn(marker+' '+JSON.stringify(data));
const check=(name,passed,detail)=>checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail})});
let sequence=0,phase='idle',started=false,finished=false,heavyGate=null;
const mark=()=>({order:++sequence,tick:system.currentTick});
function item(stack,full){
 if(!stack)return null;
 return {id:stack.typeId,amount:stack.amount,...(full?{metadata:read(()=>captureSkewerMetadata(stack))}:{})};
}
function state(player,full=true){
 return {tick:system.currentTick,time:read(()=>world.getAbsoluteTime()),id:read(()=>player.id),
  valid:read(()=>player.isValid),name:read(()=>player.name),mode:read(()=>player.getGameMode()),
  health:read(()=>player.getComponent('minecraft:health').currentValue),
  selectedSlot:read(()=>player.selectedSlotIndex),
  main:read(()=>item(player.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Mainhand),full)),
  off:read(()=>item(player.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Offhand),full)),
  effects:read(()=>JSON.parse(player.getDynamicProperty(FX_KEY)??'{}')),
  nativeEffects:read(()=>player.getEffects().map(effect=>({id:effect.typeId,amplifier:effect.amplifier,duration:effect.duration}))),
  claim:read(()=>player.getDynamicProperty(HEAVY_METAL_CLAIM_KEY)??null)};
}
function record(entity,event,fields={},full=true){
 const id=read(()=>entity.id),row=byId.get(id);
 if(!row?.call)return;
 const entry={...mark(),phase,case:row.name,event,id,...fields,state:state(entity,full)};
 events.push(entry);row.events.push(entry);
}
const subscriptions=[
 ['beforeHurt',world.beforeEvents.entityHurt,event=>record(event.hurtEntity,'beforeHurt',
  {cause:event.damageSource?.cause,damage:event.damage,cancelAtObserver:event.cancel},false)],
 ['afterHurt',world.afterEvents.entityHurt,event=>record(event.hurtEntity,'afterHurt',
  {cause:event.damageSource?.cause,damage:event.damage})],
 ['heal',world.afterEvents.entityHeal,event=>record(event.healedEntity,'heal',
  {cause:event.healSource?.cause,healing:event.healing,totem:event.healSource?.cause===EntityHealCause.TotemOfUndying})],
 ['death',world.afterEvents.entityDie,event=>record(event.deadEntity,'death',{cause:event.damageSource?.cause})]
];
for(const [name,signal,callback] of subscriptions){
 capabilities[name]=typeof signal?.subscribe==='function';signal?.subscribe(callback);
}
for(const name of ['playerJoin','playerLeave'])world.afterEvents[name].subscribe(event=>{
 if(NAMES.includes(event.playerName))events.push({...mark(),phase,event:name,player:event.playerName,id:event.playerId});
});
world.afterEvents.playerSpawn.subscribe(event=>{
 if(!NAMES.includes(event.player.name))return;
 const entry={...mark(),phase,event:'playerSpawn',player:event.player.name,id:event.player.id,initialSpawn:event.initialSpawn};
 events.push(entry);
 const row=byName.get(event.player.name);
 if(row?.call){row.events.push(entry);if(!event.initialSpawn)row.respawns.push(entry)}
});
function assertFresh(player){
 const value=state(player);
 if(value.valid!==true||!Number.isFinite(value.health)||value.health<=0)throw Error('Alive native Player required: '+player.name);
 if(value.mode!==GameMode.Creative)throw Error('Original Creative required; no mode changes');
 if(typeof player.kill!=='function')throw Error('Native Entity.kill is unavailable');
 if(!value.effects||value.effects.error||Object.keys(value.effects).length||
  !Array.isArray(value.nativeEffects)||value.nativeEffects.length||value.claim!==null)
  throw Error('Fresh effect-free, claim-free Player required: '+player.name);
}
async function prepare(player,heavy){
 assertFresh(player);
 player.selectedSlotIndex=0;
 player.getComponent('minecraft:inventory').container.setItem(0,undefined);
 player.getComponent('minecraft:health').setCurrentValue(10);
 player.getComponent('minecraft:equippable').setEquipment(EquipmentSlot.Offhand,new ItemStack(TOTEM,1));
 if(heavy)fxApply(player,'heavy_metal',1200,0);
 await wait(2);
 const value=state(player),fx=value.effects;
 if(value.valid!==true||value.mode!==GameMode.Creative||value.health!==10||value.main!==null||
  value.off?.id!==TOTEM||value.off.amount!==1||value.claim!==null||
  !Array.isArray(value.nativeEffects)||value.nativeEffects.length||!fx||fx.error||
  (heavy?Object.keys(fx).length!==1||!(fx.heavy_metal?.until>value.time):Object.keys(fx).length!==0))
  throw Error('Initial conditions changed during no-input preparation: '+player.name);
 return value;
}
async function observe(player,before,name){
 const row={name,playerName:before.name,actorId:player.id,before,events:[],respawns:[]};
 cases.push(row);byId.set(player.id,row);byName.set(player.name,row);phase=name;
 const enter={...mark(),case:name,actorId:player.id,stage:'enter',method:'Entity.kill',arguments:[]};
 row.call={enter};emit('GRILLING_QA_ENTITY_KILL_CALL',enter);
 let terminal;
 // Exactly one unmodified member call. No command, wrapper, retry or fallback.
 try{
  const result=player.kill();
  terminal={...mark(),case:name,actorId:row.actorId,stage:'return',returnType:typeof result,
   returnValue:result===undefined?null:result};
 }catch(error){
  terminal={...mark(),case:name,actorId:row.actorId,stage:'exception',
   exception:{name:error?.name,message:error?.message,text:String(error)}};
 }
 row.call.terminal=terminal;emit('GRILLING_QA_ENTITY_KILL_CALL',terminal);
 row.immediate=state(player);await wait(8);
 row.settle={...mark()};row.originalActorAfter=state(player);
 const connected=world.getAllPlayers().find(candidate=>candidate.name===row.playerName);
 row.after=connected?state(connected):row.originalActorAfter;
 row.connected=!!connected;
 return row;
}
function heavyOutcome(row){
 const cancelled=row.events.filter(event=>event.event==='beforeHurt'&&event.damage>0&&event.cancelAtObserver===true);
 const paid=cancelled.find(event=>{
  const claim=read(()=>parseHeavyMetalClaim(event.state.claim)),metal=row.before.effects.heavy_metal;
  return event.state.effects?.heavy_metal===undefined&&
   event.state.effects?.heavy_metal_poisoning?.until===event.state.time+12000&&
   event.state.effects.heavy_metal_poisoning.amp===0&&claim?.until===metal.until&&
   claim.amp===metal.amp&&claim.time===event.state.time&&row.after.claim===event.state.claim;
 });
 const noDeathOrRespawn=!row.events.some(event=>event.event==='death')&&row.respawns.length===0;
 const totemUntouched=row.after.off?.id===TOTEM&&row.after.off.amount===1&&
  !row.events.some(event=>event.event==='heal'&&event.totem);
 return {beforeHurtCancelled:cancelled.length>0,costAndClaimAtCancellation:!!paid,noDeathOrRespawn,
  healthOneSameActor:row.after.valid===true&&row.after.id===row.actorId&&row.after.health===1,
  totemUntouched,heavyRemoved:row.after.effects?.heavy_metal===undefined,
  poisoningRetained:row.after.effects?.heavy_metal_poisoning?.until>row.after.time};
}
async function finish(error){
 if(finished)return;finished=true;phase='closing';
 if(error)check('fixture completed its selected observation',false,String(error));
 emit('GRILLING_QA_NETWORK_CASES_DONE',{phase:'entity-kill-capability',completed:!error,checks,cases,heavyGate,
  heavyStatus:cases.some(row=>row.name==='heavy')?'OBSERVED':'NOT_RUN',error:error?String(error):undefined});
 for(let i=0;i<300&&world.getAllPlayers().length;i++)await wait(2);
 const playersAfter=world.getAllPlayers().length;
 check('normal driver shutdown leaves no Players',playersAfter===0);
 const heavy=cases.find(row=>row.name==='heavy');
 if(heavy)check('no later Heavy death or normal respawn before disconnect',
  !heavy.events.some(event=>event.event==='death')&&heavy.respawns.length===0);
 emit('GRILLING_QA_RESULT',{completed:!error,passed:checks.every(row=>row.passed),phase:'entity-kill-capability',
  capabilities,checks,cases,events,heavyGate,heavyStatus:heavy?'OBSERVED':'NOT_RUN',playersAfter,
  fixtureRequestedActions:[],
  scope:'Selected Entity.kill / BDS 1.26.60.6 / server 2.12.0-beta / original G247 Creative network Players only. API return is separate from native death, totem use and Heavy rescue. No food_finish, command kill, alternative cause, manual cancellation, respawn request, retry, driver use input, runtime change or global impossibility claim.'});
}
async function run(){
 if(Object.values(capabilities).some(value=>!value))throw Error('Required native event API missing');
 const players=world.getAllPlayers(),plain=players.find(player=>player.name===NAMES[0]),heavy=players.find(player=>player.name===NAMES[1]);
 if(players.length!==2||!plain||!heavy||plain.id===heavy.id)throw Error('Exactly two fixed native network Players required');
 capabilities.kill=players.map(player=>({name:player.name,id:player.id,type:typeof player.kill,mode:player.getGameMode()}));
 for(const player of players)assertFresh(player);
 if(world.gameRules.naturalRegeneration!==false||world.gameRules.keepInventory!==true||world.gameRules.doMobSpawning!==false)
  throw Error('Existing isolated QA gamerules required');
 phase='preparing-plain';const before=await prepare(plain,false);
 const row=await observe(plain,before,'plain');heavyGate=plainKillGate(row);
 check('alive Plain has native death, positive beforeHurt and untouched totem',heavyGate.eligible,heavyGate);
 emit('GRILLING_QA_ENTITY_KILL_GATE',{...mark(),...heavyGate});
 if(!heavyGate.eligible){await finish();return}
 phase='preparing-heavy';const heavyBefore=await prepare(heavy,true);
 const heavyRow=await observe(heavy,heavyBefore,'heavy');heavyRow.outcome=heavyOutcome(heavyRow);
 for(const [name,passed] of Object.entries(heavyRow.outcome))check('Heavy '+name,passed);
 await finish();
}
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='grilling_qa:entity_kill_capability'||started)return;
 started=true;system.run(()=>{run().catch(error=>finish(error))});
});
emit('GRILLING_QA_ENTITY_KILL_READY',{entry:'entity_kill_probe.js',event:'grilling_qa:entity_kill_capability',
 names:NAMES,settleTicks:8,fixtureRequestedActions:[],capabilities});
