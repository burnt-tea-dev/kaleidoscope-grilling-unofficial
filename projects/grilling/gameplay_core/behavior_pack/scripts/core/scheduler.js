import {system,world} from '@minecraft/server';

const tasks=new Map();
let playersTick=-1,players=[];

/** Share only a synchronous tick's native player query, never a cross-tick snapshot. */
export function onlinePlayers(){
 if(playersTick!==system.currentTick){players=world.getAllPlayers();playersTick=system.currentTick;}
 return players;
}

export function every(id,callback,period=1){
 if(tasks.has(id))throw Error('Duplicate scheduled task: '+id);
 tasks.set(id,{callback,period,next:system.currentTick+period});
 return ()=>tasks.delete(id);
}

system.runInterval(()=>{
 const now=system.currentTick;
 for(const [id,task] of tasks){
  if(now<task.next)continue;
  task.next=now+task.period;
  // Native independent intervals also keep running when another callback fails.
  try{task.callback();}catch(error){console.warn('[Grilling scheduler '+id+'] '+error);}
 }
},1);
