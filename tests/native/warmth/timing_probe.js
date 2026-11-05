// Isolated QA only; production modules are copied unchanged beside this file.
import {world,system,GameMode} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
import {fxApply,tickPlayerEffects} from './effect/runtime.js';
import {FX_KEY} from './effect_lifecycle_core.js';
import {configureItemDataWorld} from './core/persist.js';
configureItemDataWorld(world);
const KEY='grilling_qa:warmth_phase_restart',wait=n=>new Promise(resolve=>system.runTimeout(resolve,n));
let running=false,actor,startTick,startAbsolute,rows=[];
const timer=system.runInterval(()=>{
 if(!running||!actor)return;
 try{
  actor.teleport({x:.5,y:80,z:.5});
  tickPlayerEffects(actor);
  rows.push({tick:system.currentTick,absolute:world.getAbsoluteTime(),elapsed:system.currentTick-startTick,health:actor.getComponent('minecraft:health').currentValue});
 }catch(error){running=false;console.error('CAPTAIN_QA_FATAL '+error+' '+error?.stack);}
},1);
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id==='captain_qa:run')run().catch(error=>console.error('CAPTAIN_QA_FATAL '+error+' '+error?.stack));
});
async function run(){
 const d=world.getDimension('overworld'),checks=[],samples=[];let player,phase;
 const check=(name,ok)=>{checks.push({name,passed:!!ok});console.warn('CAPTAIN_QA_CHECK '+JSON.stringify(checks.at(-1)));if(!ok)throw Error(name);};
 const boundedWait=async predicate=>{const deadline=system.currentTick+1000;while(!predicate()&&system.currentTick<deadline)await wait(1);check('native observation completed within its tick budget',predicate());};
 check('no external players in isolated QA',world.getAllPlayers().length===0);
 d.runCommand('gamerule naturalregeneration false');
 d.runCommand('fill -4 79 -4 5 79 4 stone');d.runCommand('fill -4 80 -4 5 84 4 air');
 d.getBlock({x:1,y:80,z:0}).setType('minecraft:magma');
 try{
  const savedRaw=world.getDynamicProperty(KEY);
  if(savedRaw===undefined){
   phase='timing-first';
   player=spawnSimulatedPlayer({dimension:d,x:.5,y:80,z:.5},'WarmthPhaseG236',GameMode.Survival);actor=player;
   while(system.currentTick%20!==7)await wait(1);
   const hp=player.getComponent('minecraft:health');hp.setCurrentValue(4);
   const effect=fxApply(player,'warmth',40);check('production writer accepts forty-tick native Player effect',!!effect);
   startTick=system.currentTick;startAbsolute=world.getAbsoluteTime();rows=[];running=true;
   await boundedWait(()=>rows.some(row=>row.elapsed>=40));running=false;
   for(const [elapsed,expected,label] of [[1,5,'first duration-forty tick'],[13,5,'process-wide twenty is not another pulse'],[20,5,'duration twenty-one does not pulse'],[21,6,'second duration-twenty tick'],[40,6,'expiry adds no zero-tick pulse']]){
    const row=rows.find(row=>row.elapsed===elapsed);samples.push({label,...row});check(label,!!row&&row.health===expected);
   }
   const pig=d.spawnEntity('minecraft:pig',{x:.5,y:80,z:.5});pig.nameTag='Warmth deadline save probe';pig.getComponent('minecraft:health').setCurrentValue(4);
   const appliedAbsolute=world.getAbsoluteTime(),stored=fxApply(pig,'warmth',1213),raw=pig.getDynamicProperty(FX_KEY);
   check('native persisted actor owns the production effect deadline',!!stored&&typeof raw==='string'&&JSON.parse(raw).warmth.until===appliedAbsolute+1213);
   world.setDynamicProperty(KEY,JSON.stringify({id:pig.id,raw,appliedAbsolute,targetAbsolute:appliedAbsolute+614}));
   samples.push({label:'native save input',id:pig.id,raw,appliedAbsolute,targetAbsolute:appliedAbsolute+614,health:pig.getComponent('minecraft:health').currentValue});
  }else{
   phase='timing-restart';const saved=JSON.parse(savedRaw);actor=world.getEntity(saved.id);
   check('same native actor survives normal server restart',!!actor);
   check('native effect bytes preserve the same deadline after restart',actor.getDynamicProperty(FX_KEY)===saved.raw);
   check('native actor health survives normal server restart',actor.getComponent('minecraft:health').currentValue===4);
   check('persisted world clock has not skipped the fixed Java checkpoint',world.getAbsoluteTime()<saved.targetAbsolute-2);
   await boundedWait(()=>world.getAbsoluteTime()>=saved.targetAbsolute-2);
   actor.getComponent('minecraft:health').setCurrentValue(4);startTick=system.currentTick;startAbsolute=world.getAbsoluteTime();rows=[];running=true;
   await boundedWait(()=>rows.some(row=>row.absolute>=saved.targetAbsolute));running=false;
   const before=rows.find(row=>row.absolute===saved.targetAbsolute-1),pulse=rows.find(row=>row.absolute===saved.targetAbsolute);
   // 1213 ticks: Java's fixed pulse sequence is 14,34,...,614 after application.
   samples.push({label:'pre-decrement duration 601',...before},{label:'pre-decrement duration 600',...pulse});
   check('restored duration 601 does not pulse',!!before&&before.health===4);
   check('restored duration 600 pulses independently of the new process clock',!!pulse&&pulse.health===5);
   check('healing leaves the persisted deadline unchanged',actor.getDynamicProperty(FX_KEY)===saved.raw);
   actor.remove();
  }
 }finally{
  running=false;system.clearRun(timer);try{player?.disconnect()}catch{}
 }
 await wait(3);check('native simulated Player disconnected',world.getAllPlayers().length===0);
 console.warn('CAPTAIN_QA_RESULT '+JSON.stringify({passed:true,phase,checks,samples,startTick,startAbsolute,playersAfter:0,scope:'G236 unchanged exported effect functions. Stage one uses a native SimulatedPlayer every tick; stage two checks an actual saved native pig effect deadline and world clock after normal restart. Not full main startup, automatic non-player effects, client input, or LIVE.'}));
}
