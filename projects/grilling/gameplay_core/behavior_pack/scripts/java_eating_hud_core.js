import {JAVA_EATING_ICONS} from './java_eating_hud_data.js';
export const EATING_PACKET_PREFIX='KG_HUD!';
export const EATING_PACKET_END=EATING_PACKET_PREFIX+'END;';
const code=n=>Math.trunc(n).toString(16).padStart(2,'0');
export const validEatingHudPacket=packet=>/^(?:KG_HUD!F:(?:[0-5][0-9a-f]|6[0-6])[01]I:(?:5a|64)[0-9a-f]{2}[01];|KG_HUD!END;)$/.test(packet);
export function javaEatingHudFrame({id,elapsed,duration,tick=0}){
 if(!Number.isFinite(elapsed)||elapsed<0||!Number.isFinite(duration)||duration<=0)return undefined;
 const width=Math.min(102,Math.max(0,Math.round(102*elapsed/duration))),ready=elapsed>=25;
 let name=String(id??'').split(':').at(-1);
 if(name==='mysterious_skewer')name+='_frame_'+(Math.floor(tick/4)%5);
 else if(name==='grilled_slime_skewer')name+='_cooked_frame_'+(Math.floor(tick/4)%5);
 else if(name.startsWith('raw_'))name+='_raw';
 else if(name.startsWith('grilled_')||name==='ordinary_skewer')name+='_cooked';
 const icon=JAVA_EATING_ICONS[name]??255;
 return {width,ready,icon,duration,packet:EATING_PACKET_PREFIX+'F:'+code(width)+(+ready)+'I:'+code(duration)+code(icon)+(+ready)+';'};
}
