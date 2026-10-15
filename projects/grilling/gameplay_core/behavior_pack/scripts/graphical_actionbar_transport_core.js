/** Original graphical HUD event route. Effect icons keep their separate title router. */
export function createGraphicalActionbarTransport({prefix,maxLength,validatePacket}){
 return {
  send(player,packet){
   if(typeof packet!=='string'||!packet.startsWith(prefix)||packet.length>maxLength||!validatePacket(packet))throw new Error('Invalid graphical HUD packet');
   // The native actionbar factory supplies $actionbar_text at creation. Bounded
   // graphical instances expire independently; never clear the shared channel.
   player.onScreenDisplay.setActionBar(packet);
   return 'actionbar_factory';
  },
  forget(){}
 };
}
