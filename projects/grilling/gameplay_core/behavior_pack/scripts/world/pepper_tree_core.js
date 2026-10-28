export const PEPPER_WORLDGEN_SEED_ID='kaleidoscope_grilling:pepper_worldgen_seed';
export const WORLDGEN_SEED_COMPONENT_ID='kaleidoscope_grilling:pepper_worldgen_seed_logic';
export const PEPPER_LOG_ID='kaleidoscope_grilling:pepper_log';
export const PEPPER_LEAVES_ID='kaleidoscope_grilling:pepper_leaves';
export const PEPPER_SAPLING_ID='kaleidoscope_grilling:pepper_sapling';
export const SICHUAN_PEPPER_ID='kaleidoscope_grilling:sichuan_pepper';
export const LEAVES_COMPONENT_ID='kaleidoscope_grilling:pepper_leaves_logic';
export const SAPLING_COMPONENT_ID='kaleidoscope_grilling:pepper_sapling_logic';
export const LOG_COMPONENT_ID='kaleidoscope_grilling:pepper_log_logic';
export const HAS_PEPPER_STATE='kaleidoscope_grilling:has_pepper';
export const PERSISTENT_STATE='kaleidoscope_grilling:persistent';
export const SAPLING_STAGE_STATE='kaleidoscope_grilling:stage';
export const LEAF_DECAY_DISTANCE=6;
export const STING_INTERVAL_TICKS=20;

function clamp01(v){
 const n=Number(v);
 return Math.max(0,Math.min(0.999999999999,Number.isFinite(n)?n:0));
}

export function shouldFruitPepperLeaf(random01){return clamp01(random01)<1/20}
export function treeLeafStartsFruiting(random01){return clamp01(random01)<1/4}
export function harvestedPepperCount(random01){return 1+Math.floor(clamp01(random01)*2)}
export function saplingBonemealSucceeds(random01){return clamp01(random01)<0.45}
export function saplingRandomTickSucceeds(light,random01){
 return Number(light)>=9&&Math.floor(clamp01(random01)*7)===0;
}
export function nextSaplingAction(stage){
 return Number(stage)===0?'advance':'grow';
}
export function pepperTreeHeight(random01){return 2+Math.floor(clamp01(random01)*2)}

export function pepperLogAxis(blockFace){
 const face=String(blockFace??'up');
 if(face==='east'||face==='west')return 'x';
 if(face==='north'||face==='south')return 'z';
 return 'y';
}

export function pepperLeafBreakPlan({shears=false,silkTouch=false,fortune=0,hasPepper=false,saplingRandom=1,stickRandom=1}={}){
 if(shears||silkTouch)return {leaves:1,saplings:0,sticks:0,pepper:hasPepper?1:0};
 const f=Math.max(0,Math.min(3,Math.floor(Number(fortune)||0)));
 const saplingChance=[0.1,0.125,0.16667,0.2][f];
 const stickChance=[0.02,0.02222,0.025,0.03333][f];
 return {
  leaves:0,
  saplings:clamp01(saplingRandom)<saplingChance?1:0,
  sticks:clamp01(stickRandom)<stickChance?1:0,
  pepper:hasPepper?1:0
 };
}

export function pepperTreePlan(height,randomValues=[]){
 const h=Math.max(2,Math.min(3,Math.floor(Number(height)||2)));
 let ri=0;
 const next=()=>clamp01(randomValues[ri++]??0.999999);
 const logs=[];for(let y=0;y<=h;y++)logs.push({x:0,y,z:0});
 const leaves=[];
 const add=(x,y,z,forced=true,chance=1)=>{
  if(!forced&&next()>=chance)return;
  leaves.push({x,y,z,hasPepper:treeLeafStartsFruiting(next())});
 };
 for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){
  if(x===0&&z===0)continue;
  add(x,h,z,true);
 }
 for(const [x,z] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]])add(x,h+1,z,true);
 for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){
  if(x===0&&z===0)continue;
  add(x,h-1,z,false,0.6);
 }
 const bottom=h-2;
 // Java rolls once per sign, then places the two perpendicular cardinals.
 if(bottom>0)for(const d of [-1,1])if(next()<0.5){
  add(d,bottom,0,true);add(0,bottom,d,true);
 }
 return {height:h,logs,leaves};
}
