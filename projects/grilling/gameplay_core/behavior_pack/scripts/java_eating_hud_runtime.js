import {canonicalFoodId} from './eating_profile_ids.js';
import {javaEatingHudFrame,EATING_PACKET_END} from './java_eating_hud_core.js';
import {sendFormattingHud,forgetFormattingHud} from './formatting_hud_runtime.js';
const visible=new Set();
// No food settlement or shared-channel clear belongs to this display adapter.
export function showJavaEatingHud(player,session,tick){
 const frame=javaEatingHudFrame({id:canonicalFoodId(session.id),elapsed:tick-session.start,duration:session.profile==='THREE'?100:90,tick});
 if(frame)try{sendFormattingHud(player,frame.packet);visible.add(player.id);}catch{}
}
export function hideJavaEatingHud(player){
 if(visible.delete(player.id))try{sendFormattingHud(player,EATING_PACKET_END);}catch{}
}
export function forgetJavaEatingHud(id){visible.delete(id);forgetFormattingHud(id);}
