import {JAVA_EATING_ICONS} from './java_eating_hud_data.js';
export const EATING_PACKET_PREFIX='§r§0§r§0';
export const EATING_PACKET_END=EATING_PACKET_PREFIX+'§r§f§f§r';
const code=n=>[...Math.trunc(n).toString(16).padStart(2,'0')].map(c=>'§'+c).join('');
export function javaEatingHudFrame({id,elapsed,duration,tick=0}){
 if(!Number.isFinite(elapsed)||elapsed<0||!Number.isFinite(duration)||duration<=0)return undefined;
 const width=Math.min(102,Math.max(0,Math.round(102*elapsed/duration))),ready=elapsed>=25;
 let name=String(id??'').split(':').at(-1);
 if(name==='mysterious_skewer')name+='_frame_'+(Math.floor(tick/4)%5);
 else if(name==='grilled_slime_skewer')name+='_cooked_frame_'+(Math.floor(tick/4)%5);
 else if(name.startsWith('raw_'))name+='_raw';
 else if(name.startsWith('grilled_')||name==='ordinary_skewer')name+='_cooked';
 const icon=JAVA_EATING_ICONS[name]??255;
 return {width,ready,icon,duration,packet:EATING_PACKET_PREFIX+code(width)+code(+ready)+'§r§1'+code(duration)+code(icon)+code(+ready)+'§r'};
}
