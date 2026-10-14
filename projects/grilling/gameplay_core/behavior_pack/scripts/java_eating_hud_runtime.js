import {canonicalFoodId} from './eating_profile_ids.js';
import {javaEatingHudFrame,EATING_PACKET_END} from './java_eating_hud_core.js';
import {sendFormattingHud,forgetFormattingHud} from './formatting_hud_runtime.js';
const visible=new Set();
// No food settlement or shared-channel clear belongs to this display adapter.
export function showJavaEatingHud(player,session,tick){
 const duration=session.profile==='THREE'?100:90,remaining=session.nativeDuration;
 // itemStartUse reports remaining ticks, while the Java bar spans the full use.
 // Keep invalid/missing native values on the captured session clock.
 const elapsed=tick-session.start+(Number.isInteger(remaining)&&remaining>0&&remaining<=duration?duration-remaining:0);
 const frame=javaEatingHudFrame({id:canonicalFoodId(session.id),elapsed,duration,tick});
 if(frame)try{sendFormattingHud(player,frame.packet);visible.add(player.id);}catch{}
}
export function hideJavaEatingHud(player){
 if(visible.delete(player.id))try{sendFormattingHud(player,EATING_PACKET_END);}catch{}
}
export function forgetJavaEatingHud(id){visible.delete(id);forgetFormattingHud(id);}
