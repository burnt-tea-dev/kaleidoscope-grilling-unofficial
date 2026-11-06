// QA entry beside the unchanged production main. All food/effect callers stay native.
import './main.js';
import {world,system,ItemStack,EquipmentSlot,GameMode,EntityHealCause} from '@minecraft/server';
import {prepareProducedFood} from './integration_stack_core.js';
import {readPublicFood} from './host_api/food_api_core.js';
import {grillingConfig} from './server_config_runtime.js';
import {captureSkewerMetadata,metadataSignature} from './skewer_item_snapshot.js';
import {canonicalFoodId} from './eating_profile_ids.js';
import {FX_KEY} from './effect_lifecycle_core.js';
import {HEAVY_METAL_CLAIM_KEY} from './heavy_metal_claim_core.js';
import {feedbackDiagnostics} from './immersion_feedback_diagnostics.js';
import {nativeEatingCompleted} from './core/player_props.js';

const FOOD='kaleidoscope_grilling:ordinary_skewer',TOTEM='minecraft:totem_of_undying';
const NAMES=['qaNetPlain','qaNetHeavy'],events=[],checks=[],cases=[],eventCapabilities={};
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const read=fn=>{try{return fn()}catch(error){return {error:String(error)}}};
let owner,phase='idle',sequence=0,ready,active,finished=false;
const mark=()=>({order:++sequence,tick:system.currentTick});
const emit=(name,data)=>console.warn(name+' '+JSON.stringify(data));
const check=(name,passed,detail)=>checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail})});
const soundCount=d=>d.soundAccepted+d.soundFailed;
function stackState(stack){
 if(!stack)return null;
 return {id:stack.typeId,amount:stack.amount,metadata:captureSkewerMetadata(stack),publicFood:readPublicFood(stack)};
}
function state(){
 return {tick:system.currentTick,id:owner.id,name:read(()=>owner.name),mode:read(()=>owner.getGameMode()),
  health:read(()=>owner.getComponent('minecraft:health').currentValue),
  hunger:read(()=>owner.getComponent('minecraft:player.hunger').currentValue),
  saturation:read(()=>owner.getComponent('minecraft:player.saturation').currentValue),
  main:read(()=>stackState(owner.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Mainhand))),
  off:read(()=>stackState(owner.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Offhand))),
  effects:read(()=>JSON.parse(owner.getDynamicProperty(FX_KEY)??'{}')),
  nativeEffects:read(()=>owner.getEffects().map(effect=>({id:effect.typeId,amplifier:effect.amplifier,duration:effect.duration}))),
  claim:read(()=>owner.getDynamicProperty(HEAVY_METAL_CLAIM_KEY)??null),
  nightVision:read(()=>!!owner.getEffect('minecraft:night_vision')),feedback:feedbackDiagnostics()};
}
function canonicalMetadata(value){return metadataSignature({...value,id:canonicalFoodId(value.id)});}
function eventRow(event,name){
 return {...mark(),phase,event:name,player:event.source?.name,id:event.itemStack?.typeId,
  useDuration:event.useDuration,item:read(()=>stackState(event.itemStack)),state:state()};
}
for(const name of ['itemUse','itemStartUse','itemCompleteUse','itemStopUse','itemReleaseUse']){
 const signal=world.afterEvents[name];eventCapabilities[name]=typeof signal?.subscribe==='function';
 signal?.subscribe(event=>{
  if(!owner||event.source.id!==owner.id)return;
  const row=eventRow(event,name);events.push(row);
  if(active&&!active.complete&&name==='itemCompleteUse'&&canonicalFoodId(row.id)===active.item){
   active.complete=row;release('native_complete');
  }
 });
}
world.beforeEvents.itemUse.subscribe(event=>{
 if(owner&&event.source.id===owner.id)events.push({...eventRow(event,'beforeItemUse'),cancelAtObserver:event.cancel});
});
world.beforeEvents.entityHurt.subscribe(event=>{
 if(owner&&event.hurtEntity.id===owner.id)events.push({...mark(),phase,event:'beforeHurt',
  cause:event.damageSource?.cause,damage:event.damage,cancelAtObserver:event.cancel,state:state()});
});
world.afterEvents.entityHurt.subscribe(event=>{
 if(owner&&event.hurtEntity.id===owner.id)events.push({...mark(),phase,event:'afterHurt',
  cause:event.damageSource?.cause,damage:event.damage,state:state()});
});
world.afterEvents.entityHeal.subscribe(event=>{
 if(owner&&event.healedEntity.id===owner.id)events.push({...mark(),phase,event:'heal',
  cause:event.healSource?.cause,healing:event.healing,totem:event.healSource?.cause===EntityHealCause.TotemOfUndying,state:state()});
});
world.afterEvents.entityDie.subscribe(event=>{
 if(owner&&event.deadEntity.id===owner.id)events.push({...mark(),phase,event:'death',cause:event.damageSource?.cause,state:state()});
});
for(const name of ['playerJoin','playerLeave'])world.afterEvents[name].subscribe(event=>{
 if(NAMES.includes(event.playerName))events.push({...mark(),phase,event:name,player:event.playerName,id:event.playerId});
});
world.afterEvents.playerSpawn.subscribe(event=>{
 if(NAMES.includes(event.player.name))events.push({...mark(),phase,event:'playerSpawn',player:event.player.name,id:event.player.id,initialSpawn:event.initialSpawn});
});
function release(reason){
 if(!active||active.releaseRequested)return;
 active.releaseRequested=true;
 emit('GRILLING_QA_FOOD_RELEASE',{...mark(),case:active.name,reason});
}
async function finish(error){
 if(finished)return;finished=true;phase='closing';
 if(error)check('fixture preparation/observation completed',false,String(error));
 emit('GRILLING_QA_NETWORK_CASES_DONE',{phase:'ordinary-network-food',checks,cases,events,error:error?String(error):undefined});
 for(let i=0;i<300&&world.getAllPlayers().length;i++)await wait(2);
 const playersAfter=world.getAllPlayers().length;check('normal driver shutdown leaves no Players',playersAfter===0);
 emit('GRILLING_QA_RESULT',{passed:checks.every(row=>row.passed),phase:'ordinary-network-food',checks,cases,events,eventCapabilities,playersAfter,
  scope:'One Creative normal network Player, no Heavy. Native use through unchanged main, no direct food/effect callback, kill, mode/immunity change, score edit, input-state spoof or replay. Conditional native milk only diagnoses absent Ordinary completion. Feedback counters witness requests, not audible output. Driver sent is not acceptance. No renderer, LIVE or saved-world claim.'});
}
async function prepare(){
 if(!['itemStartUse','itemCompleteUse','itemStopUse'].every(name=>eventCapabilities[name]))throw Error('Native food event capability missing');
 phase='preparing';const players=world.getAllPlayers();owner=players.find(p=>p.name===NAMES[0]);
 if(players.length!==2||!owner||!players.some(p=>p.name===NAMES[1])||players.some(p=>!NAMES.includes(p.name)))throw Error('Both fixed network Players required');
 if(players.some(p=>p.getGameMode()!==GameMode.Creative))throw Error('Native Creative required; fixture never changes mode');
 const fx=JSON.parse(owner.getDynamicProperty(FX_KEY)??'{}');
 if(Object.keys(fx).length||owner.getEffects().length||owner.getDynamicProperty(HEAVY_METAL_CLAIM_KEY)!==undefined)throw Error('Fresh effect-free QA Player required');
 const dimension=world.getDimension('overworld');
 dimension.runCommand('gamerule naturalregeneration false');dimension.runCommand('gamerule keepinventory true');dimension.runCommand('gamerule doMobSpawning false');
 owner.selectedSlotIndex=0;owner.getComponent('minecraft:health').setCurrentValue(10);
 owner.getComponent('minecraft:player.hunger').setCurrentValue(10);
 owner.getComponent('minecraft:player.saturation').setCurrentValue(0);
 const food=prepareProducedFood(new ItemStack(FOOD,1),{kind:'cuisine',hotTicks:0,seasoning:[]},Number(world.getAbsoluteTime()),grillingConfig());
 owner.getComponent('minecraft:inventory').container.setItem(0,food);
 owner.getComponent('minecraft:equippable').setEquipment(EquipmentSlot.Offhand,new ItemStack(TOTEM,1));
 const produced=state();await wait(40);ready=state();
 if(canonicalFoodId(ready.main?.id)!==FOOD||ready.main?.amount!==1||!ready.main?.publicFood.valid||
  canonicalMetadata(produced.main.metadata)!==canonicalMetadata(ready.main.metadata))throw Error('Factory metadata changed during native no-input preparation');
 check('factory food and metadata survive the no-input preparation',true,{produced,ready});
 phase='prepared';emit('GRILLING_QA_FOOD_READY',{...mark(),player:NAMES[0],ready,
  nativeTicks:{base:100,alternate:90,plain:25},ordinaryWatchdogTicks:160,
  driver:'Wait for v11 initial_loading_end and real selected item_evidence, then arm; never infer acceptance from sent.'});
}
async function prepareMilk(){
 phase='preparing_control';
 owner.getComponent('minecraft:inventory').container.setItem(0,new ItemStack('minecraft:milk_bucket',1));
 owner.addEffect('minecraft:night_vision',12000,{showParticles:false});
 const before=state();await wait(20);ready=state();
 if(ready.main?.id!=='minecraft:milk_bucket'||!ready.nightVision)throw Error('Native milk control preparation failed');
 phase='control_prepared';emit('GRILLING_QA_FOOD_CONTROL_READY',{...mark(),player:NAMES[0],before,ready,watchdogTicks:100});
}
async function observe(name){
 if(state().mode!==GameMode.Creative)throw Error('Mode changed outside fixture');
 const milk=name==='milk',input=state();phase=milk?'milk':'ordinary';
 if(milk?input.main?.id!=='minecraft:milk_bucket':canonicalFoodId(input.main?.id)!==FOOD)throw Error('Prepared item no longer held');
 if(!milk&&(Object.keys(input.effects).length||input.nativeEffects.length||input.claim!==null||input.health!==10||input.main.amount!==1||!input.main.publicFood.valid||canonicalMetadata(input.main.metadata)!==canonicalMetadata(ready.main.metadata)))throw Error('Ordinary baseline input changed');
 active={name,item:milk?'minecraft:milk_bucket':FOOD,input,begin:system.currentTick};
 emit('GRILLING_QA_FOOD_INPUT_READY',{...mark(),case:name,input});
 const deadline=system.currentTick+(milk?100:160);
 while(!active.complete&&system.currentTick<deadline)await wait(1);
 release(active.complete?'native_complete':'native_completion_timeout');
 await wait(8);const result=state(),row={...active,result};
 row.events=events.filter(e=>e.tick>=row.begin&&e.player!==NAMES[1]);
 const starts=row.events.filter(e=>e.event==='itemStartUse'&&canonicalFoodId(e.id)===row.item);
 const completes=row.events.filter(e=>e.event==='itemCompleteUse'&&canonicalFoodId(e.id)===row.item);
 row.nativeStarted=starts.length>0;row.nativeCompleted=completes.length===1;
 if(milk){
  check('conditional milk has native completion and clears native night vision',row.nativeCompleted&&input.nightVision&&!result.nightVision);
 }else{
  const start=starts[0],complete=row.complete;
  row.nativeDurationMet=!!start&&!!complete&&nativeEatingCompleted(start.tick,complete.tick,start.useDuration,complete.useDuration);
  row.fatalFeedbackDelta=complete&&start?soundCount(complete.state.feedback)-soundCount(start.state.feedback):null;
  row.formalCallerWitness=row.nativeCompleted&&row.nativeDurationMet&&row.fatalFeedbackDelta>=2;
  check('one real Ordinary native completion reaches the formal caller witness',row.formalCallerWitness,{nativeCompleted:row.nativeCompleted,nativeDurationMet:row.nativeDurationMet,fatalFeedbackDelta:row.fatalFeedbackDelta});
  check('Creative serving and factory metadata are retained',result.main?.amount===1&&canonicalFoodId(result.main?.id)===FOOD&&canonicalMetadata(result.main.metadata)===canonicalMetadata(input.main.metadata));
  check('no Heavy payment/claim was introduced',!result.effects.heavy_metal&&!result.effects.heavy_metal_poisoning&&result.claim===null);
  check('totem remains without a native totem heal',result.off?.id===TOTEM&&!row.events.some(e=>e.event==='heal'&&e.totem&&e.healing>0));
  check('Java no-Heavy expectation: the completed Ordinary causes native damage and death',row.formalCallerWitness&&row.events.some(e=>e.event==='beforeHurt'&&e.cause==='selfDestruct'&&e.damage===3.4028234663852886e38)&&row.events.some(e=>e.event==='death')&&result.health===0);
 }
 cases.push(row);active=undefined;
 if(!milk&&!row.nativeCompleted)await prepareMilk();else await finish();
}
system.afterEvents.scriptEventReceive.subscribe(event=>{
 const next=event.id==='grilling_qa:prepare_ordinary_network_food'&&phase==='idle'?prepare:
  event.id==='grilling_qa:arm_ordinary_network_food'&&phase==='prepared'?()=>observe('ordinary'):
  event.id==='grilling_qa:arm_ordinary_network_milk'&&phase==='control_prepared'?()=>observe('milk'):undefined;
 if(next){phase='queued';system.run(()=>next().catch(error=>finish(error)));}
});
