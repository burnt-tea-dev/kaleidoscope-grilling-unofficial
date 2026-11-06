// Isolated capability question, not an Ordinary implementation or food test.
import {world,system,ItemStack,EquipmentSlot,GameMode,EntityHealCause} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
import {fxApply} from './effect/runtime.js';
import {FX_KEY} from './effect_lifecycle_core.js';
import {HEAVY_METAL_CLAIM_KEY} from './heavy_metal_claim_core.js';
import {configureItemDataWorld} from './core/persist.js';
configureItemDataWorld(world);
const TOTEM='minecraft:totem_of_undying',TAG='grilling_qa_kill_command';
const targets=new Map(),wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const read=fn=>{try{return fn()}catch(error){return {error:String(error)}}};
let started=false,sequence=0;
const mark=()=>({order:++sequence,tick:system.currentTick});
function state(player){
 return {mode:read(()=>player.getGameMode()),health:read(()=>player.getComponent('minecraft:health').currentValue),time:world.getAbsoluteTime(),
  off:read(()=>player.getComponent('minecraft:equippable').getEquipment(EquipmentSlot.Offhand)?.typeId??null),
  effects:read(()=>JSON.parse(player.getDynamicProperty(FX_KEY)??'{}')),
  claim:read(()=>player.getDynamicProperty(HEAVY_METAL_CLAIM_KEY)??null)};
}
function damage(event,before){
 return {...mark(),cause:event.damageSource?.cause??null,damage:Number.isFinite(event.damage)?event.damage:String(event.damage),
  ...(before?{cancel:event.cancel}:{}),state:state(event.hurtEntity)};
}
// Importing the unchanged effect runtime registers its production subscriptions
// first. These observers never set cancel, manufacture callbacks or pay effects.
world.beforeEvents.entityHurt.subscribe(event=>{const row=targets.get(event.hurtEntity.id);if(row)row.before.push(damage(event,true));});
world.afterEvents.entityHurt.subscribe(event=>{const row=targets.get(event.hurtEntity.id);if(row)row.after.push(damage(event,false));});
world.afterEvents.entityHeal.subscribe(event=>{
 const row=targets.get(event.healedEntity.id);if(row)row.heals.push({...mark(),cause:event.healSource?.cause??null,healing:event.healing,totem:event.healSource?.cause===EntityHealCause.TotemOfUndying,state:state(event.healedEntity)});
});
world.afterEvents.entityDie.subscribe(event=>{
 const row=targets.get(event.deadEntity.id);if(row)row.deaths.push({...mark(),cause:event.damageSource?.cause??null,state:state(event.deadEntity)});
});
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='grilling_qa:ordinary_kill_command'||started)return;
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
  let player;const name=heavy?'GKillHeavy':'GKillControl',label=heavy?'Creative Heavy Metal':'Creative no Heavy Metal';
  const row={name,heavy,before:[],after:[],heals:[],deaths:[]};
  try{
   player=spawnSimulatedPlayer({dimension,x:.5,y:80,z:.5},name,GameMode.Creative);
   targets.set(player.id,row);await wait(3);player.addTag(TAG);
   player.getComponent('minecraft:health').setCurrentValue(10);
   player.getComponent('minecraft:equippable').setEquipment(EquipmentSlot.Offhand,new ItemStack(TOTEM));
   fxApply(player,'warmth',1200);if(heavy)fxApply(player,'heavy_metal',1200);
   row.input=state(player);row.playersBefore=world.getAllPlayers().map(p=>({name:p.name,mode:p.getGameMode()}));
   const inputOK=row.input.mode===GameMode.Creative&&row.input.health===10&&row.input.off===TOTEM&&row.input.claim===null&&!!row.input.effects.warmth&&!!row.input.effects.heavy_metal===heavy;
   check(label+' actual native mode and effect inputs are ready',inputOK);
   if(!inputOK)throw Error('Native input control failed');
   // Fixed QA names/tags select only the one actual participant. testfor and
   // kill both require Game Directors and cheats in the same script context.
   row.selector='@a[name="'+name+'",tag="'+TAG+'"]';
   const targetResult=dimension.runCommand('testfor '+row.selector);
   row.targetControl={command:'testfor '+row.selector,result:{successCount:targetResult.successCount}};
   const exact=row.playersBefore.length===1&&row.playersBefore[0].name===name&&row.targetControl.result.successCount===1;
   check(label+' exact target and native command permission control succeeds',exact);
   if(!exact)throw Error('Exact target control failed');
   row.command={text:'kill '+row.selector,start:mark()};
   try{const result=dimension.runCommand(row.command.text);row.command.result={successCount:result.successCount};}catch(error){row.command.error={name:error.name,message:String(error)};}
   row.command.returned=mark();row.immediate=state(player);await wait(4);row.result=state(player);
   const hit=row.before[0],reached=row.command.result?.successCount>0||row.before.length>0||row.after.length>0||row.deaths.length>0;
   check(label+' kill command reaches the controlled native Player',reached);
   check(label+' command provides a positive native before-hurt event',row.before.length===1&&Number(hit.damage)>0);
   check(label+' totem is untouched without a native totem heal',row.result.off===TOTEM&&!row.heals.some(e=>e.totem&&e.healing>0));
   if(heavy){
    check('Creative command allows the original Heavy payment before cancellation',hit?.cancel===true&&hit.state.claim!==null&&!hit.state.effects.heavy_metal&&hit.state.effects.heavy_metal_poisoning?.until-hit.state.time===12000);
    check('Creative command preserves the original rescue to 1 HP',row.deaths.length===0&&row.result.health===1&&row.result.claim===hit?.state.claim&&!!row.result.effects.heavy_metal_poisoning&&!row.result.effects.heavy_metal&&!!row.result.effects.warmth);
   }else check('Creative kill control dies without cancellation or a Heavy claim',row.deaths.length===1&&row.result.health===0&&hit?.cancel===false&&row.result.claim===null);
  }finally{
   if(player){try{player.disconnect()}catch(error){row.disconnectError=String(error)}targets.delete(player.id);}
   await wait(2);samples.push(row);console.warn('GRILLING_QA_CASE '+JSON.stringify(row));
  }
 }
 check('all native Players disconnected',world.getAllPlayers().length===0);
 console.warn('GRILLING_QA_RESULT '+JSON.stringify({passed:checks.every(x=>x.passed),phase:'ordinary-kill-command',checks,samples,playersAfter:world.getAllPlayers().length,
  scope:'Only the native kill command against two actual Creative Players, with exact-target/testfor permission controls and the unchanged G242 registered damage/after-heal handlers. A capability observation, not food completion or an adopted Ordinary repair. No Entity.kill, cause scan, synthetic callback, effect prepayment, health clearing, mode switch, immunity change, Player overlay, replay or resurrection. Callback order is observed, not a guarantee about every internal native step. Existing Survival/Creative food, fatal, shield, save and P140 results are not repeated.'}));
}
