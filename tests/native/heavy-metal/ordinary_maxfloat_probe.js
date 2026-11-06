// Isolated candidate observation. Real food completion and registered handlers.
import {world,system,ItemStack,EquipmentSlot,GameMode,EntityHealCause} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
import {fxApply} from './effect/runtime.js';
import {FX_KEY} from './effect_lifecycle_core.js';
import {HEAVY_METAL_CLAIM_KEY} from './heavy_metal_claim_core.js';
import {configureItemDataWorld} from './core/persist.js';
configureItemDataWorld(world);
const FOOD='kaleidoscope_grilling:ordinary_skewer';
const TOTEM='minecraft:totem_of_undying',MAX_FLOAT=3.4028234663852886e38;
const targets=new Map(),wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const read=fn=>{try{return fn()}catch(error){return {error:String(error)}}};
let started=false;
function state(player){
 return {health:read(()=>player.getComponent('minecraft:health').currentValue),
  time:world.getAbsoluteTime(),
  main:read(()=>player.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Mainhand)?.typeId??null),
  off:read(()=>player.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Offhand)?.typeId??null),
  effects:read(()=>JSON.parse(player.getDynamicProperty(FX_KEY)??'{}')),
  claim:read(()=>player.getDynamicProperty(HEAVY_METAL_CLAIM_KEY)??null)};
}
// Module imports register the production food/effect subscriptions before these
// observers. No event, native Player method or production callback is replaced.
for(const name of ['itemStartUse','itemCompleteUse','itemStopUse'])world.afterEvents[name].subscribe(event=>{
 const row=targets.get(event.source.id);if(row)row.food.push({event:name,tick:system.currentTick,id:event.itemStack?.typeId,useDuration:event.useDuration});
});
world.beforeEvents.entityHurt.subscribe(event=>{
 const row=targets.get(event.hurtEntity.id);if(row)row.before.push({tick:system.currentTick,cause:event.damageSource?.cause,damage:event.damage,cancel:event.cancel,state:state(event.hurtEntity)});
});
world.afterEvents.entityHeal.subscribe(event=>{
 const row=targets.get(event.healedEntity.id);if(row)row.heals.push({tick:system.currentTick,cause:event.healSource?.cause,healing:event.healing,totem:event.healSource?.cause===EntityHealCause.TotemOfUndying,state:state(event.healedEntity)});
});
world.afterEvents.entityDie.subscribe(event=>{const row=targets.get(event.deadEntity.id);if(row){row.died=true;row.death={tick:system.currentTick,cause:event.damageSource?.cause};}});
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='grilling_qa:ordinary_maxfloat'||started)return;
 started=true;run().catch(error=>console.error('GRILLING_QA_FATAL '+error+' '+error?.stack));
});
async function run(){
 const dimension=world.getDimension('overworld'),checks=[],samples=[];
 const check=(name,passed)=>{checks.push({name,passed:!!passed});console.warn('GRILLING_QA_CHECK '+JSON.stringify(checks.at(-1)));};
 check('isolated QA has no external Players',world.getAllPlayers().length===0);
 if(world.getAllPlayers().length)throw Error('external Players');
 dimension.runCommand('gamerule naturalregeneration false');
 dimension.runCommand('gamerule keepinventory true');
 dimension.runCommand('fill -2 79 -2 2 79 2 stone');
 dimension.runCommand('fill -2 80 -2 2 84 2 air');
 for(const heavy of [false,true]){
  let player;const label=heavy?'Heavy Metal':'no Heavy Metal';
  const row={heavy,entry:'native food use and itemCompleteUse',food:[],before:[],heals:[],died:false};
  try{
   player=spawnSimulatedPlayer({dimension,x:.5,y:80,z:.5},heavy?'OrdinaryHeavy':'OrdinaryControl',GameMode.Survival);
   targets.set(player.id,row);await wait(3);player.selectedSlotIndex=0;
   player.getComponent('minecraft:inventory').container.setItem(0,new ItemStack(FOOD));
   player.getComponent('minecraft:equippable').setEquipment(EquipmentSlot.Offhand,new ItemStack(TOTEM));
   player.getComponent('minecraft:health').setCurrentValue(10);
   fxApply(player,'warmth',1200);if(heavy)fxApply(player,'heavy_metal',1200);
   // Let the unchanged production preparation select its existing animation
   // variant before use. The QA pack must include all three owned definitions.
   await wait(3);
   row.input=state(player);row.useAccepted=player.useItemInSlot(0);
   for(let i=0;i<140;i++){await wait(1);if(row.before.length||row.died)break;}
   await wait(4);row.result=state(player);
   const hit=row.before[0],start=row.food.find(e=>e.event==='itemStartUse'),finish=row.food.find(e=>e.event==='itemCompleteUse');
   check(label+' real native food completes and consumes its serving',row.useAccepted&&start?.id===row.input.main&&finish?.id===row.input.main&&finish.tick-start.tick>=25&&row.result.main===null);
   check(label+' actual Ordinary delivers exactly one selfDestruct max-float hit',row.before.length===1&&hit.cause==='selfDestruct'&&hit.damage===MAX_FLOAT&&hit.tick>=finish?.tick);
   check(label+' held totem remains and no native totem heal is emitted',row.result.off===TOTEM&&!row.heals.some(e=>e.totem&&e.healing>0));
   if(heavy){
    check('Heavy Metal real registered handler cancels and reserves its claim',hit?.cancel===true&&hit.state.claim!==null);
    check('Heavy Metal pays once before cancellation and rescues to 1 HP',!row.died&&row.result.health===1&&!row.result.effects.heavy_metal&&!!row.result.effects.heavy_metal_poisoning&&row.result.claim===hit?.state.claim&&hit.state.effects.heavy_metal_poisoning?.until-hit.state.time===12000);
    check('Heavy Metal leaves unrelated Warmth active',!!row.result.effects.warmth);
   }else{
    check('no Heavy Metal dies without cancellation or a claim',row.died&&row.result.health===0&&hit?.cancel===false&&row.result.claim===null);
   }
  }finally{
   if(player){try{player.stopUsingItem()}catch{}try{player.disconnect()}catch(error){row.disconnectError=String(error)}targets.delete(player.id);}
   await wait(2);samples.push(row);console.warn('GRILLING_QA_CASE '+JSON.stringify(row));
  }
 }
 check('all native Players disconnected',world.getAllPlayers().length===0);
 console.warn('GRILLING_QA_RESULT '+JSON.stringify({passed:checks.every(x=>x.passed),phase:'ordinary-maxfloat',checks,samples,playersAfter:world.getAllPlayers().length,
  scope:'Actual native default Ordinary food use with its existing production preparation/animation variants and registered food/effect handlers, including the candidate applyOrdinary selfDestruct max-float call. No callback invocation, replacement methods, remaining-shield estimate, damage replay, resurrection or new Player overlay. Does not establish armor/resistance bypass, all Java parity, complete main startup, persistence, client or LIVE behavior.'}));
}
