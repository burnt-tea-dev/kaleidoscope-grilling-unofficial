import {canonicalFoodId} from './eating_profile_ids.js';
import {javaEatingHudFrame} from './java_eating_hud_core.js';
// Format codes carry a graphical frame only; no printable progress/status text.
// No idle/stop/complete packet: JSON UI declares a 100 ms hold and 1 ms fade.
export function showJavaEatingHud(player,session,tick){
 const frame=javaEatingHudFrame({id:canonicalFoodId(session.id),elapsed:tick-session.start,duration:session.profile==='THREE'?100:90,tick});
 if(frame)try{player.onScreenDisplay.setActionBar(frame.packet)}catch{}
}
