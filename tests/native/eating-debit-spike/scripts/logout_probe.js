import {GameMode,ItemStack,system,world} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';

const TAG='[Grilling logout-events probe]',ITEM='grilling_eating_probe:meal';
const actors=new Map(),players=[],events=[],rows=[];
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const emit=row=>console.warn(TAG+' '+JSON.stringify(row));
function observe(actor,event,player,remaining){
 const row={case:actor.name,event,elapsed:system.currentTick-actor.start,remaining};
 if(player)try{row.amount=player.getComponent('minecraft:inventory').container.getItem(0)?.amount??0;}catch(error){row.readError=String(error);}
 events.push(row);emit({kind:'event',...row});
}
for(const name of ['itemStartUse','itemStopUse','itemCompleteUse'])world.afterEvents[name].subscribe(e=>{
 const actor=actors.get(e.source.id);if(actor)observe(actor,name,e.source,e.useDuration);
});
world.beforeEvents.playerLeave.subscribe(({player})=>{
 const actor=actors.get(player.id);if(!actor)return;
 observe(actor,'beforeLeave',player);
 const row={case:actor.name,event:'beforeLeaveWrite',elapsed:system.currentTick-actor.start};
 // A same-stack write tests the documented restricted context, without consuming
 // a serving or granting nutrition. This is only a disposable diagnostic world.
 try{const c=player.getComponent('minecraft:inventory').container;c.setItem(0,c.getItem(0));row.allowed=true;}catch(error){row.allowed=false;row.error=String(error);}
 events.push(row);emit({kind:'event',...row});
 system.run(()=>{observe(actor,'deferredLeave',player);});
});
world.afterEvents.playerLeave.subscribe(({playerId})=>{const actor=actors.get(playerId);if(actor)observe(actor,'afterLeave');});

async function batch(cases,ticks){
 const dimension=world.getDimension('overworld');
 for(let index=0;index<cases.length;index++){
  const actor=cases[index],x=2+index*3;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
   dimension.getBlock({x:x+dx,y:79,z:66+dz}).setType('minecraft:stone');
   for(let y=80;y<=82;y++)dimension.getBlock({x:x+dx,y,z:66+dz}).setType('minecraft:air');
  }
  const player=spawnSimulatedPlayer({dimension,x:x+.5,y:80,z:66.5},actor.name,GameMode.Survival);
  players.push(player);actor.player=player;actor.start=system.currentTick;actors.set(player.id,actor);
  player.getComponent('minecraft:inventory').container.setItem(0,new ItemStack(ITEM,1));player.selectedSlotIndex=0;
  actor.accepted=player.useItemInSlot(0);emit({kind:'start',case:actor.name,accepted:actor.accepted});
 }
 for(let tick=0;tick<ticks;tick++){
  await wait(1);
  for(const actor of cases)if(!actor.acted&&actor.at!==undefined&&system.currentTick-actor.start>=actor.at){
   actor.acted=true;
   if(actor.action==='disconnect')actor.player.disconnect();else actor.player.stopUsingItem();
  }
 }
 for(const actor of cases){
  const observed=events.filter(e=>e.case===actor.name),leave=observed.findIndex(e=>e.event==='beforeLeave');
  rows.push({name:actor.name,action:actor.action??'complete',at:actor.at,accepted:actor.accepted,
   events:observed,stopBeforeLeave:leave>=0&&observed.slice(0,leave).some(e=>e.event==='itemStopUse')});
  if(actor.action!=='disconnect'){actor.player.disconnect();actors.delete(actor.player.id);}
 }
}
system.run(async()=>{
 try{
  const dimension=world.getDimension('overworld');let loaded=false;
  for(let i=0;i<40;i++){try{loaded=!!dimension.getBlock({x:1,y:79,z:65});}catch{}if(loaded)break;await wait(5);}
  if(!loaded)throw Error('Isolated probe chunk unavailable');
  await batch([{name:'complete_control'},{name:'stop_control_25',action:'stop',at:25},
   {name:'disconnect_25',action:'disconnect',at:25},{name:'disconnect_90',action:'disconnect',at:90}],135);
  await batch([{name:'disconnect_23',action:'disconnect',at:23},{name:'disconnect_26',action:'disconnect',at:26}],50);
  const completeControl=rows[0].events.some(e=>e.event==='itemCompleteUse'&&e.amount===0);
  const stopControl=rows[1].events.some(e=>e.event==='itemStopUse'&&Number.isInteger(e.remaining)&&e.remaining>0&&e.amount===1);
  const leaveControl=rows.slice(2).every(r=>r.events.some(e=>e.event==='beforeLeave')&&r.events.some(e=>e.event==='afterLeave'));
  emit({kind:'result',ok:rows.every(r=>r.accepted)&&completeControl&&stopControl&&leaveControl,
   completeControl,stopControl,leaveControl,rows,scope:'Simulated-player disconnect events only; no Grilling settlement or client parity claim',client:false});
 }catch(error){emit({kind:'result',ok:false,reason:String(error),client:false});}
 finally{for(const player of players)try{if(player.isValid)player.disconnect();}catch{}actors.clear();}
});
