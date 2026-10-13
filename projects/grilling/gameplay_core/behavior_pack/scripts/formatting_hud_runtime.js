import {EntityTypes,system,world} from '@minecraft/server';
import {createFormattingHudTransport} from './formatting_hud_transport_core.js';
// Observe an existing embedded router; never participate in its election.
const peers=new Set(),pending=new Map();let ready=false,queue=false,embedded=false;
const observe=e=>{if(e.id==='ui_queue_module:setup')peers.add(e.message);};
system.afterEvents.scriptEventReceive.subscribe(observe,{namespaces:['ui_queue_module']});
const transport=createFormattingHudTransport({prefix:'§r§0§r§0',maxLength:36,
 schedule:(callback,ticks)=>system.runTimeout(callback,ticks),cancel:handle=>system.clearRun(handle),idleTicks:6,
 queueAvailable:()=>queue,embeddedAvailable:()=>embedded,
 queueSend:(player,packet)=>system.sendScriptEvent('ui_load_script:kg_eating_hud',player.id+'|'+packet),
 legacySend:(player,packet)=>player.runCommand('scriptevent ui_load:kg_eating_hud '+packet)});
export function sendFormattingHud(player,packet){
 if(!ready){pending.set(player.id,{player,packet});return;}
 transport.send(player,packet);
}
export function forgetFormattingHud(id){id=typeof id==='string'?id:id.id;pending.delete(id);transport.forget(id);}
system.runTimeout(()=>{
 system.afterEvents.scriptEventReceive.unsubscribe(observe);
 try{queue=!!EntityTypes.get('uq:ui_queue_checker');}catch{}
 embedded=!queue&&peers.size===1;ready=true;
 for(const {player,packet} of pending.values())try{transport.send(player,packet);}catch{}
 pending.clear();
},5);
world.afterEvents.playerLeave.subscribe(e=>forgetFormattingHud(e.playerId));
