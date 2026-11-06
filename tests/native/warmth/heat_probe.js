import {world,system,BlockPermutation,GameMode,ItemStack} from '@minecraft/server';
import * as gt from '@minecraft/server-gametest';
import {configureItemDataWorld} from './core/persist.js';
import {fxApply,tickPlayerEffects} from './effect/runtime.js';
configureItemDataWorld(world);
const wait=t=>new Promise(resolve=>system.runTimeout(resolve,t));
system.afterEvents.scriptEventReceive.subscribe(e=>{if(e.id==='captain_qa:run')run().catch(error=>console.error('CAPTAIN_QA_FATAL '+error+' '+error?.stack));});
async function run(){
 const d=world.getDimension('overworld'),checks=[],samples=[];let player;
 const check=(name,ok)=>{checks.push({name,passed:!!ok});console.warn('CAPTAIN_QA_CHECK '+JSON.stringify(checks.at(-1)));if(!ok)throw Error(name);};
 d.runCommand('gamerule naturalregeneration false');d.runCommand('fill -4 79 -4 5 79 4 stone');d.runCommand('fill -4 80 -4 5 84 4 air');
 try{
  player=gt.spawnSimulatedPlayer({dimension:d,x:.5,y:80,z:.5},'WarmthG234',GameMode.Survival);player.teleport({x:.5,y:80,z:.5});
  const hp=player.getComponent('minecraft:health'),block=d.getBlock({x:1,y:80,z:0});
  check('production effect application accepts native Player warmth',!!fxApply(player,'warmth',1200));
  const sample=async(label,expected)=>{
   while(system.currentTick%20!==0)await wait(1);
   hp.setCurrentValue(10);const before=hp.currentValue;tickPlayerEffects(player);const after=hp.currentValue;
   samples.push({label,tick:system.currentTick,type:block.typeId,states:block.permutation.getAllStates(),before,after});
   console.warn('CAPTAIN_QA_NATIVE_HEAT '+JSON.stringify(samples.at(-1)));check(label,after===expected);await wait(1);
  };
  for(const id of ['minecraft:campfire','minecraft:soul_campfire']){
   block.setPermutation(BlockPermutation.resolve(id,{extinguished:true}));await sample(id+' extinguished does not heal',10);
   block.setPermutation(block.permutation.withState('extinguished',false));await sample(id+' burning heals one HP',11);block.setType('minecraft:air');
  }
  for(const [id,input] of [['minecraft:furnace','minecraft:raw_iron'],['minecraft:smoker','minecraft:beef'],['minecraft:blast_furnace','minecraft:raw_iron']]){
   block.setType(id);await sample(id+' idle does not heal',10);
   const inventory=block.getComponent('minecraft:inventory').container;inventory.setItem(0,new ItemStack(input,1));inventory.setItem(1,new ItemStack('minecraft:coal',1));
   const limit=system.currentTick+60;while(block.typeId===id&&system.currentTick<limit)await wait(1);
   check(id+' actual input and fuel ignite its native block',block.typeId==='minecraft:lit_'+id.split(':')[1]);
   await sample(id+' genuinely burning heals one HP',11);block.setType('minecraft:air');
  }
 }finally{try{player?.disconnect();}catch{}}
 await wait(3);check('native simulated Player disconnected',world.getAllPlayers().length===0);
 console.warn('CAPTAIN_QA_RESULT '+JSON.stringify({passed:true,phase:'warmth',checks,samples,playersAfter:0,scope:'G234 exported production effect application/tick with native SimulatedPlayer health, campfire states, and vanilla furnaces ignited by actual inventory input/fuel. Does not claim full main startup, client rendering, unchanged effects or new saved-state behavior; LIVE unchanged.'}));
}
