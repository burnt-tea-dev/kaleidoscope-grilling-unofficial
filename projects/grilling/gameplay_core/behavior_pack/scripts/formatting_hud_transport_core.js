/** Bounded formatting packets and an owned stop; never clear a shared channel. */
export function createFormattingHudTransport({prefix,maxLength,queueAvailable,embeddedAvailable,queueSend,legacySend,schedule,cancel,idleTicks,endPacket=prefix+'§r§f§f§r',validatePacket=packet=>/^(?:§[0-9a-fr])+$/.test(packet)}){
 const armed=new Map();
 const mode=()=>queueAvailable()?'ui_queue':embeddedAvailable()?'embedded_queue':'standalone';
 function dispatch(player,packet){
  const route=mode();
  if(route==='ui_queue')queueSend(player,packet);
  else if(route==='embedded_queue')legacySend(player,packet);
  else player.onScreenDisplay.setTitle(packet,{fadeInDuration:0,fadeOutDuration:0,stayDuration:0});
  return route;
 }
 function forget(id){
  const row=armed.get(id);if(!row)return;
  armed.delete(id);cancel(row.handle);
 }
 return {mode,forget,
  send(player,packet){
   if(typeof packet!=='string'||!packet.startsWith(prefix)||packet.length>maxLength||!validatePacket(packet))throw new Error('Invalid graphical HUD packet');
   const route=dispatch(player,packet);
   forget(player.id);
   if(packet!==endPacket&&schedule){
    const row={};armed.set(player.id,row);
    row.handle=schedule(()=>{
     if(armed.get(player.id)!==row)return;
     armed.delete(player.id);
     try{dispatch(player,endPacket);}catch{} // A departing player needs no display write.
    },idleTicks);
   }
   return route;
  }
 };
}
