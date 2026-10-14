import {createGraphicalActionbarTransport} from './graphical_actionbar_transport_core.js';
import {EATING_PACKET_PREFIX,validEatingHudPacket} from './java_eating_hud_core.js';
const transport=createGraphicalActionbarTransport({prefix:EATING_PACKET_PREFIX,validatePacket:validEatingHudPacket,maxLength:36});
export const sendFormattingHud=(player,packet)=>transport.send(player,packet);
export const forgetFormattingHud=id=>transport.forget(id);
