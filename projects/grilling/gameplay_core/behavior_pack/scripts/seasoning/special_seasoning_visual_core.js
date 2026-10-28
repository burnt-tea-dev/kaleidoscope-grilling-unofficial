export const SPECIAL_SEASONING_CANONICAL_ID='kaleidoscope_grilling:special_seasoning';
export const SPECIAL_SEASONING_VISUAL_PREFIX='kaleidoscope_grilling:special_seasoning_r';
export const SPECIAL_SEASONING_MAX_USES=16;
export const SPECIAL_SEASONING_VARIANT_MAX=7;

const VISUAL_RE=/^kaleidoscope_grilling:special_seasoning_r([1-8])_v([0-7])$/;

function clampInt(value,min,max){
 const n=Number(value);
 return Math.max(min,Math.min(max,Number.isFinite(n)?Math.trunc(n):min));
}

export function specialSeasoningRemainingBucket(uses){
 const u=clampInt(uses,0,SPECIAL_SEASONING_MAX_USES);
 return Math.min(8,Math.max(0,Math.floor((SPECIAL_SEASONING_MAX_USES-u+1)/2)));
}

export function specialSeasoningVisualId(uses,variant){
 const remaining=specialSeasoningRemainingBucket(uses);
 const v=clampInt(variant,0,SPECIAL_SEASONING_VARIANT_MAX);
 if(remaining<=0)return SPECIAL_SEASONING_CANONICAL_ID;
 return `${SPECIAL_SEASONING_VISUAL_PREFIX}${remaining}_v${v}`;
}

export function parseSpecialSeasoningVisualId(id){
 const value=String(id??'');
 if(value===SPECIAL_SEASONING_CANONICAL_ID)return {special:true,canonical:true,remaining:0,variant:0};
 const m=VISUAL_RE.exec(value);
 return m?{special:true,canonical:false,remaining:Number(m[1]),variant:Number(m[2])}:{special:false,canonical:false,remaining:0,variant:0};
}

export function isSpecialSeasoningId(id){
 return parseSpecialSeasoningVisualId(id).special;
}

export function isSpecialSeasoningVisualId(id){
 const row=parseSpecialSeasoningVisualId(id);
 return row.special&&!row.canonical;
}
