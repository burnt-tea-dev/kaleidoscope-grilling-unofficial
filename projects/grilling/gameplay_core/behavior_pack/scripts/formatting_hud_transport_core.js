/** Only bounded formatting packets enter the optional title router. No Actionbar writes. */
export function createFormattingHudTransport({prefix,maxLength,queueAvailable,embeddedAvailable,queueSend,legacySend}){
 return {
  mode(){return queueAvailable()?'ui_queue':embeddedAvailable()?'embedded_queue':'standalone';},
  send(player,packet){
   if(typeof packet!=='string'||!packet.startsWith(prefix)||packet.length>maxLength||!/^(?:§[0-9a-fr])+$/.test(packet))throw new Error('Invalid graphical HUD packet');
   const mode=this.mode();
   if(mode==='ui_queue')queueSend(player,packet);
   else if(mode==='embedded_queue')legacySend(player,packet);
   else player.onScreenDisplay.setTitle(packet,{fadeInDuration:0,fadeOutDuration:0,stayDuration:0});
   return mode;
  }
 };
}
