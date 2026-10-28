export const WEDDING_CANDY_ID='kaleidoscope_grilling:wedding_candy';
export const WEDDING_CANDY_EFFECT='invincible';
export const WEDDING_CANDY_EFFECT_TICKS=15*20;
export const WEDDING_CANDY_XP=50;
export const WEDDING_CANDY_STATE_KEY='kaleidoscope_grilling:wedding_candy_state';
export const WEDDING_CANDY_FOOD=Object.freeze({nutrition:20,saturation:0.5,canAlwaysEat:true});
export const WEDDING_CANDY_EVENT=Object.freeze({
 timezone:'Asia/Shanghai',offsetMinutes:8*60,year:2026,month:9,firstDay:1,lastDay:12
});

function int(value,fallback=0){const n=Number(value);return Number.isFinite(n)?Math.trunc(n):fallback}
function cleanState(state={}){
 return {
  trackingDate:typeof state?.trackingDate==='string'?state.trackingDate:'',
  playSeconds:Math.max(0,int(state?.playSeconds)),
  claimedDate:typeof state?.claimedDate==='string'?state.claimedDate:''
 };
}

export function shanghaiCalendar(epochMs=Date.now()){
 const shifted=new Date(Number(epochMs)+WEDDING_CANDY_EVENT.offsetMinutes*60_000);
 return {year:shifted.getUTCFullYear(),month:shifted.getUTCMonth()+1,day:shifted.getUTCDate()};
}

export function weddingCandyDateKey(calendar){
 const y=int(calendar?.year),m=int(calendar?.month),d=int(calendar?.day);
 return [String(y).padStart(4,'0'),String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
}

export function isWeddingCandyEventDate(calendar){
 const y=int(calendar?.year),m=int(calendar?.month),d=int(calendar?.day);
 return y===WEDDING_CANDY_EVENT.year&&m===WEDDING_CANDY_EVENT.month&&d>=WEDDING_CANDY_EVENT.firstDay&&d<=WEDDING_CANDY_EVENT.lastDay;
}

export function weddingCandyRequiredSeconds(day){return Math.max(0,int(day))*60}
export function weddingCandyRewardAmount(day){return Math.max(0,int(day))}

export function nextWeddingCandyProgress(state,calendar){
 const base=cleanState(state);
 if(!isWeddingCandyEventDate(calendar))return {...base,active:false,requiredSeconds:0,grant:0};
 const today=weddingCandyDateKey(calendar),day=int(calendar.day),requiredSeconds=weddingCandyRequiredSeconds(day);
 if(base.claimedDate===today)return {...base,active:true,requiredSeconds,grant:0};
 const playSeconds=(base.trackingDate===today?base.playSeconds:0)+1;
 const grant=playSeconds>=requiredSeconds?weddingCandyRewardAmount(day):0;
 return {
  trackingDate:today,
  playSeconds,
  claimedDate:grant>0?today:base.claimedDate,
  active:true,requiredSeconds,grant
 };
}
