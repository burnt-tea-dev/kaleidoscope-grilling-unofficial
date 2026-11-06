// Isolated mode boundary; unchanged G242 food/effect code and native methods.
import {world,system,ItemStack,EquipmentSlot,GameMode,EntityHealCause} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
import {fxApply} from './effect/runtime.js';
import {FX_KEY} from './effect_lifecycle_core.js';
import {HEAVY_METAL_CLAIM_KEY} from './heavy_metal_claim_core.js';
import {configureItemDataWorld} from './core/persist.js';
import {feedbackDiagnostics} from './immersion_feedback_diagnostics.js';
configureItemDataWorld(world);
const FOOD='kaleidoscope_grilling:ordinary_skewer',TOTEM='minecraft:totem_of_undying';
const targets=new Map(),wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const read=fn=>{try{return fn()}catch(error){return {error:String(error)}}};
let started=false;
function state(player){
 return {mode:read(()=>player.getGameMode()),health:read(()=>player.getComponent('minecraft:health').currentValue),time:world.getAbsoluteTime(),
  main:read(()=>{const stack=player.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Mainhand);return stack?{id:stack.typeId,amount:stack.amount}:null;}),
  off:read(()=>player.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Offhand)?.typeId??null),
  effects:read(()=>JSON.parse(player.getDynamicProperty(FX_KEY)??'{}')),
  claim:read(()=>player.getDynamicProperty(HEAVY_METAL_CLAIM_KEY)??null)};
}
// Production modules register first. These only observe; no native callback or
// Player method is replaced, and no survival result is rerun as a mode claim.
for(const name of ['itemStartUse','itemCompleteUse','itemStopUse'])world.afterEvents[name].subscribe(event=>{
 const row=targets.get(event.source.id);if(row)row.food.push({event:name,tick:system.currentTick,id:event.itemStack?.typeId,useDuration:event.useDuration,feedback:feedbackDiagnostics()});
});
world.beforeEvents.entityHurt.subscribe(event=>{
 const row=targets.get(event.hurtEntity.id);if(row)row.before.push({phase:row.phase,tick:system.currentTick,cause:event.damageSource?.cause,damage:event.damage,cancel:event.cancel,state:state(event.hurtEntity)});
});
world.afterEvents.entityHeal.subscribe(event=>{
 const row=targets.get(event.healedEntity.id);if(row)row.heals.push({tick:system.currentTick,cause:event.healSource?.cause,healing:event.healing,totem:event.healSource?.cause===EntityHealCause.TotemOfUndying,state:state(event.healedEntity)});
});
world.afterEvents.entityDie.subscribe(event=>{const row=targets.get(event.deadEntity.id);if(row){row.died=true;row.death={tick:system.currentTick,cause:event.damageSource?.cause};}});
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='grilling_qa:ordinary_creative'||started)return;
 started=true;run().catch(error=>console.error('GRILLING_QA_FATAL '+error+' '+error?.stack));
});
async function run(){
 const dimension=world.getDimension('overworld'),checks=[],samples=[];
 const check=(name,passed)=>{checks.push({name,passed:!!passed});console.warn('GRILLING_QA_CHECK '+JSON.stringify(checks.at(-1)));};
 check('isolated QA has no external Players',world.getAllPlayers().length===0);
 if(world.getAllPlayers().length)throw Error('external Players');
 dimension.runCommand('gamerule naturalregeneration false');dimension.runCommand('gamerule keepinventory true');
 dimension.runCommand('fill -2 79 -2 2 79 2 stone');dimension.runCommand('fill -2 80 -2 2 84 2 air');
 for(const heavy of [false,true]){
  let player;const label=heavy?'Creative Heavy Metal':'Creative no Heavy Metal';
  const row={heavy,phase:'setup',food:[],before:[],heals:[],died:false};
  try{
   player=spawnSimulatedPlayer({dimension,x:.5,y:80,z:.5},heavy?'CreativeOrdinaryHeavy':'CreativeOrdinaryControl',GameMode.Creative);
   targets.set(player.id,row);await wait(3);player.selectedSlotIndex=0;
   player.getComponent('minecraft:health').setCurrentValue(10);
   check(label+' actual native mode is Creative',player.getGameMode()===GameMode.Creative);
   if(!heavy){
    row.phase='normal-control';row.normalControl={before:state(player),applied:player.applyDamage(1,{cause:'entityAttack'})};
    await wait(2);row.normalControl.after=state(player);
    check('Creative ordinary native attack retains its immunity',!row.died&&row.normalControl.after.health===row.normalControl.before.health);
   }
   player.getComponent('minecraft:inventory').container.setItem(0,new ItemStack(FOOD));
   player.getComponent('minecraft:equippable').setEquipment(EquipmentSlot.Offhand,new ItemStack(TOTEM));
   fxApply(player,'warmth',1200);if(heavy)fxApply(player,'heavy_metal',1200);
   await wait(3);row.phase='food';row.input=state(player);row.feedbackBefore=feedbackDiagnostics();row.useAccepted=player.useItemInSlot(0);
   for(let i=0;i<140;i++){await wait(1);if(row.food.some(e=>e.event==='itemCompleteUse'))break;}
   await wait(4);row.result=state(player);row.feedbackAfter=feedbackDiagnostics();
   const start=row.food.find(e=>e.event==='itemStartUse'),finish=row.food.find(e=>e.event==='itemCompleteUse'),hits=row.before.filter(e=>e.phase==='food'),hit=hits[0];
   check(label+' real native food completes while retaining the Creative serving',row.useAccepted&&!!start&&!!finish&&start.id===row.input.main?.id&&finish.id===start.id&&finish.tick-start.tick>=25&&row.result.main?.amount===1);
   // Two accepted/failed sound requests witness the unchanged Ordinary fatal
   // feedback path. They do not establish audible output or intercept damage.
   const beforeSounds=row.feedbackBefore.soundAccepted+row.feedbackBefore.soundFailed,completionSounds=(finish?.feedback.soundAccepted??0)+(finish?.feedback.soundFailed??0);
   check(label+' real Ordinary completion reaches its fatal feedback',completionSounds-beforeSounds>=2);
   check(label+' native max-float hit reaches the registered handler',hits.length===1&&hit.cause==='selfDestruct'&&hit.damage===3.4028234663852886e38);
   check(label+' totem stays untouched without a native totem heal',row.result.off===TOTEM&&!row.heals.some(e=>e.totem&&e.healing>0));
   if(heavy){
    check('Creative Heavy Metal pays before cancellation and rescues to 1 HP',!row.died&&row.result.health===1&&hit?.cancel===true&&row.result.claim!==null&&!row.result.effects.heavy_metal&&!!row.result.effects.heavy_metal_poisoning&&hit.state.effects.heavy_metal_poisoning?.until-hit.state.time===12000);
   }else check('Creative Ordinary bypasses immunity and kills without a claim',row.died&&row.result.health===0&&hit?.cancel===false&&row.result.claim===null);
  }finally{
   if(player){try{player.stopUsingItem()}catch{}try{player.disconnect()}catch(error){row.disconnectError=String(error)}targets.delete(player.id);}
   await wait(2);samples.push(row);console.warn('GRILLING_QA_CASE '+JSON.stringify(row));
  }
 }
 check('all native Players disconnected',world.getAllPlayers().length===0);
 console.warn('GRILLING_QA_RESULT '+JSON.stringify({passed:checks.every(x=>x.passed),phase:'ordinary-creative',checks,samples,playersAfter:world.getAllPlayers().length,
  scope:'Only actual Creative food completion through unchanged G242 food/effect handlers. One normal native attack is the mode-immunity control. No direct food callback, native-method replacement, mode exception, new Player overlay, damage replay, resurrection or remaining-shield estimate. Existing Survival results are reused, not repeated. Spectator food is excluded by both Java callers. No claim about every invulnerability source, armor/resistance, full family, persistence, client or LIVE.'}));
}
