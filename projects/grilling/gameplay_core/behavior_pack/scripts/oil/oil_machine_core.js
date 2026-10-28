export const PRESS_MAX_CAKES=4;
export const PRESS_REQUIRED_PROGRESS=16;
export const PRESS_ANVIL_PROGRESS=4;
export const PRESS_STONE_PROGRESS=1;
export const PRESS_COOLDOWN_TICKS=10;
export const PRESS_IMPACT_TICK=6;
export const PRESS_DURATION_TICKS=9;
export const PRESS_COMPLETION_DELAY=10;
export const PRESS_OUTPUT_BUCKETS=4;
export const VAT_CAPACITY_BUCKETS=8;
export const OIL_POT_CAPACITY=64;
export const OIL_BUCKET_POINTS=8;

export const OIL_CAKE_ID='kaleidoscope_grilling:oil_cake';
export const OIL_RESIDUE_ID='kaleidoscope_grilling:oil_residue';
export const OIL_PRESS_ID='kaleidoscope_grilling:oil_press';
export const BIG_VAT_ID='kaleidoscope_grilling:big_vat';

export const PRESS_STONES=Object.freeze(new Set([
 'minecraft:stone','minecraft:cobblestone','minecraft:deepslate','minecraft:cobbled_deepslate','minecraft:blackstone'
]));
export const ANVILS=Object.freeze(new Set(['minecraft:anvil','minecraft:chipped_anvil','minecraft:damaged_anvil']));
export const VAT_TYPES=Object.freeze(new Set(['water','lava','canola','secret_chili','premium_chili']));

export function toolProgress(id,tags=[]){
 const key=String(id??'');
 if(ANVILS.has(key))return PRESS_ANVIL_PROGRESS;
 return PRESS_STONES.has(key)||(Array.isArray(tags)&&tags.includes('kaleidoscope_grilling:press_stones'))?PRESS_STONE_PROGRESS:0;
}
export function pressVisualStage(progress){
 const p=Math.max(0,Math.min(PRESS_REQUIRED_PROGRESS,Number(progress)||0));
 if(p<=0)return 0;if(p<=4)return 1;if(p<=8)return 2;if(p<=12)return 3;return 4;
}
export function normalizePress(s={}){
 return {
  cakes:Math.max(0,Math.min(PRESS_MAX_CAKES,Number(s.cakes)||0))|0,
  progress:Math.max(0,Math.min(PRESS_REQUIRED_PROGRESS,Number(s.progress)||0))|0,
  waiting:!!s.waiting,
  completionDelay:Math.max(0,Math.min(PRESS_COMPLETION_DELAY,Number(s.completionDelay)||0))|0
 };
}
export function pressAddCake(state){
 const s=normalizePress(state);if(s.cakes>=PRESS_MAX_CAKES)return {ok:false,state:s,reason:'full'};
 return {ok:true,state:{...s,cakes:s.cakes+1}};
}
export function canStartPress(state,amount){
 const s=normalizePress(state),a=Math.max(0,Number(amount)||0);
 if(a<=0)return {ok:false,reason:'not_tool',state:s};
 if(s.cakes!==PRESS_MAX_CAKES)return {ok:false,reason:'need_full_batch',state:s};
 if(s.waiting)return {ok:false,reason:'waiting_for_container',state:s};
 if(s.progress>=PRESS_REQUIRED_PROGRESS)return {ok:false,reason:'complete',state:s};
 return {ok:true,state:s};
}
export function impactPress(state,amount){
 const check=canStartPress(state,amount);if(!check.ok)return check;
 const s=check.state,p=Math.min(PRESS_REQUIRED_PROGRESS,s.progress+Math.max(0,Number(amount)||0));
 return {ok:true,state:{...s,progress:p,completionDelay:p>=PRESS_REQUIRED_PROGRESS?PRESS_COMPLETION_DELAY:0},reached:p>=PRESS_REQUIRED_PROGRESS};
}
export function finishPressTransfer(state,status){
 const s=normalizePress(state),key=String(status??'NO_CONTAINER').toUpperCase();
 if(key==='SUCCESS')return {ok:true,state:{cakes:0,progress:0,waiting:false,completionDelay:0},residue:PRESS_MAX_CAKES,oilBuckets:PRESS_OUTPUT_BUCKETS};
 if(!['NO_CONTAINER','FULL','INCOMPATIBLE'].includes(key))return {ok:false,state:s,reason:'bad_status'};
 return {ok:false,state:{...s,progress:PRESS_REQUIRED_PROGRESS-1,waiting:true,completionDelay:0},reason:key.toLowerCase()};
}
export function normalizeVat(v={}){
 const type=VAT_TYPES.has(String(v.type??''))?String(v.type):'';
 const buckets=Math.max(0,Math.min(VAT_CAPACITY_BUCKETS,Number(v.buckets)||0))|0;
 return buckets>0&&type?{type,buckets}:{type:'',buckets:0};
}
export function vatVisualLevel(buckets){
 const b=Math.max(0,Math.min(VAT_CAPACITY_BUCKETS,Number(buckets)||0));
 return b<=0?0:Math.min(4,Math.max(1,Math.ceil(b*4/VAT_CAPACITY_BUCKETS)));
}
export function vatCanInsert(vat,type,buckets=1){
 const v=normalizeVat(vat),t=String(type??''),n=Math.max(0,Number(buckets)||0)|0;
 if(!VAT_TYPES.has(t)||n<=0)return false;
 if(v.buckets>0&&v.type!==t)return false;
 return v.buckets+n<=VAT_CAPACITY_BUCKETS;
}
export function vatInsert(vat,type,buckets=1){
 const v=normalizeVat(vat),n=Math.max(0,Number(buckets)||0)|0,t=String(type??'');
 if(!vatCanInsert(v,t,n))return {ok:false,state:v};
 return {ok:true,state:{type:t,buckets:v.buckets+n}};
}
export function vatExtract(vat,type,buckets=1){
 const v=normalizeVat(vat),n=Math.max(0,Number(buckets)||0)|0,t=String(type??'');
 if(n<=0||v.type!==t||v.buckets<n)return {ok:false,state:v};
 const left=v.buckets-n;return {ok:true,state:left?{type:t,buckets:left}:{type:'',buckets:0}};
}
export function potFillPlan(vat,currentType,currentCount){
 const v=normalizeVat(vat),type=String(currentType??''),count=Math.max(0,Math.min(OIL_POT_CAPACITY,Number(currentCount)||0))|0;
 if(!['canola','secret_chili','premium_chili'].includes(v.type)||v.buckets<=0)return {ok:false,reason:'not_oil',buckets:0,points:0};
 if((type===''&&count>0)||(type!==''&&type!==v.type))return {ok:false,reason:'incompatible',buckets:0,points:0};
 const n=Math.min(v.buckets,Math.floor((OIL_POT_CAPACITY-count)/OIL_BUCKET_POINTS));
 if(n<=0)return {ok:false,reason:'full',buckets:0,points:0};
 return {ok:true,type:v.type,buckets:n,points:n*OIL_BUCKET_POINTS,nextCount:count+n*OIL_BUCKET_POINTS};
}
export function nearbyOffsets(){
 const out=[];for(let x=-4;x<=4;x++)for(let y=-2;y<=2;y++)for(let z=-4;z<=4;z++)out.push({x,y,z});return out;
}
