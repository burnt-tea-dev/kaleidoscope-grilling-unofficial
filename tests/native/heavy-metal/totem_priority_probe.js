// Diagnostic entry only. Imports the real registered damage and cure handlers.
import {world,system,ItemStack,EquipmentSlot,GameMode,EntityHealCause} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
import {fxApply} from './effect/runtime.js';
import {FX_KEY} from './effect_lifecycle_core.js';
import {HEAVY_METAL_CLAIM_KEY} from './heavy_metal_claim_core.js';
import {configureItemDataWorld} from './core/persist.js';
configureItemDataWorld(world);
const targets=new Map(),wait=n=>new Promise(resolve=>system.runTimeout(resolve,n));
let started=false,sequence=0;
const read=fn=>{try{return fn()}catch(error){return {error:String(error)}}};
function state(player){
 return {health:read(()=>player.getComponent('minecraft:health').currentValue),
  main:read(()=>player.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Mainhand)?.typeId??null),
  off:read(()=>player.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Offhand)?.typeId??null),
  effects:read(()=>JSON.parse(player.getDynamicProperty(FX_KEY)??'{}')),
  claim:read(()=>player.getDynamicProperty(HEAVY_METAL_CLAIM_KEY)??null),
  backpack:read(()=>player.getComponent('minecraft:inventory').container.getItem(5)?.typeId??null)};
}
world.beforeEvents.entityHurt.subscribe(event=>{
 const row=targets.get(event.hurtEntity.id);if(!row)return;
 row.before.push({tick:system.currentTick,cause:event.damageSource?.cause,damage:event.damage,cancel:event.cancel,state:state(event.hurtEntity)});
});
world.afterEvents.entityHeal.subscribe(event=>{
 const row=targets.get(event.healedEntity.id);if(!row)return;
 row.heals.push({tick:system.currentTick,cause:event.healSource?.cause,healing:event.healing,
  totem:event.healSource?.cause===EntityHealCause.TotemOfUndying,state:state(event.healedEntity)});
});
world.afterEvents.entityDie.subscribe(event=>{const row=targets.get(event.deadEntity.id);if(row)row.died=true;});
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='grilling_qa:totem_priority'||started)return;
 started=true;run().catch(error=>console.error('GRILLING_QA_FATAL '+error+' '+error?.stack));
});
async function run(){
 const dimension=world.getDimension('overworld'),checks=[],samples=[];
 const check=(name,passed)=>{checks.push({name,passed:!!passed});console.warn('GRILLING_QA_CHECK '+JSON.stringify(checks.at(-1)));};
 check('isolated QA has no external players',world.getAllPlayers().length===0);
 if(world.getAllPlayers().length)throw Error('external players');
 dimension.runCommand('gamerule naturalregeneration false');
 dimension.runCommand('gamerule keepinventory true');
 dimension.runCommand('fill -2 79 -2 2 79 2 stone');
 dimension.runCommand('fill -2 80 -2 2 84 2 air');
 async function hit(cause,{heavy,hand='off',backpack=false}={}){
  let player;
  const row={cause,heavy:!!heavy,hand:backpack?'backpack':hand,before:[],heals:[],died:false};
  try{
   player=spawnSimulatedPlayer({dimension,x:.5,y:80,z:.5},'TotemPriority'+(++sequence),GameMode.Survival);
   targets.set(player.id,row);player.selectedSlotIndex=0;
   await wait(3);
   const equipment=player.getComponent('minecraft:equippable');
   for(const slot of [EquipmentSlot.Mainhand,EquipmentSlot.Offhand])equipment.setEquipment(slot,undefined);
   if(backpack)player.getComponent('minecraft:inventory').container.setItem(5,new ItemStack('minecraft:totem_of_undying'));
   else if(hand)equipment.setEquipment(hand==='main'?EquipmentSlot.Mainhand:EquipmentSlot.Offhand,new ItemStack('minecraft:totem_of_undying'));
   player.getComponent('minecraft:health').setCurrentValue(10);
   fxApply(player,'warmth',1200);
   if(heavy)fxApply(player,'heavy_metal',1200);
   row.input=state(player);
   row.applied=player.applyDamage(100,{cause});
   row.immediate=state(player);await wait(3);row.result=state(player);
  }finally{
   if(player){try{player.disconnect()}catch(error){row.disconnectError=String(error)}targets.delete(player.id);}
   await wait(2);
  }
  samples.push(row);console.warn('GRILLING_QA_CASE '+JSON.stringify(row));return row;
 }
 for(const [cause,hand] of [['entityAttack','off'],['entityAttack','main'],['magic','off'],['fall','off'],['none','off']]){
  const control=await hit(cause,{heavy:false,hand}),candidate=await hit(cause,{heavy:true,hand});
  const label=cause+' '+hand;
  check(label+' native control consumes the held totem and survives',!control.died&&control.result[hand]===null&&control.result.health>0);
  check(label+' control emits a positive native TotemOfUndying heal',control.heals.some(e=>e.totem&&e.healing>0));
  check(label+' real handler yields without cancelling or claiming',candidate.before.length===1&&candidate.before[0].cancel===false&&candidate.before[0].state.claim===null);
  check(label+' native totem wins without Heavy Metal poisoning',!candidate.died&&candidate.result[hand]===null&&candidate.result.health>0&&!candidate.result.effects.heavy_metal_poisoning&&candidate.result.claim===null);
  check(label+' actual after-heal cures Heavy Metal and Warmth',candidate.heals.some(e=>e.totem&&e.healing>0)&&!candidate.result.effects.heavy_metal&&!candidate.result.effects.warmth);
 }
 for(const cause of ['void','override','selfDestruct']){
  const control=await hit(cause,{heavy:false}),candidate=await hit(cause,{heavy:true});
  // Java rejects out_of_world/generic_kill before looking in either hand.
  // Also record the Bedrock control instead of assuming its forced-death rule.
  check(cause+' keeps the existing Heavy Metal cancellation attempt',candidate.before.length===1&&candidate.before[0].cancel===true);
  check(cause+' does not consume the held totem',candidate.result.off==='minecraft:totem_of_undying');
  check(cause+' keeps the existing effect payment',!!candidate.result.effects.heavy_metal_poisoning&&!candidate.result.effects.heavy_metal);
  candidate.nativeControlTotemUsed=control.result.off===null&&control.heals.some(e=>e.totem&&e.healing>0);
 }
 for(const backpack of [false,true]){
  const candidate=await hit('entityAttack',{heavy:true,hand:null,backpack});
  check((backpack?'backpack totem':'no totem')+' preserves ordinary Heavy Metal rescue',!candidate.died&&candidate.result.health===1&&!!candidate.result.effects.heavy_metal_poisoning&&candidate.result.claim!==null);
  if(backpack)check('backpack totem is untouched',candidate.result.backpack==='minecraft:totem_of_undying');
 }
 check('all native Players disconnected',world.getAllPlayers().length===0);
 console.warn('GRILLING_QA_RESULT '+JSON.stringify({passed:checks.every(x=>x.passed),phase:'totem-priority',checks,samples,playersAfter:world.getAllPlayers().length,
  scope:'Unchanged registered effect-runtime damage and after-heal handlers with native Players and native applyDamage. Forced-source checks preserve the existing cancellation/effect attempt, not a new guarantee against uncancellable forced death. No remaining-absorption, complete main startup, client or LIVE claim.'}));
}
