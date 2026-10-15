import {canonicalFoodId} from './eating_profile_ids.js';
import {GRILL_MODEL_INDEX} from './grill_visual_data.js';
export const GRILL_FOOD_ENTITY='kaleidoscope_grilling:grill_food_visual';
export const GRILL_DISPLAY_RANGE_SQ=48*48;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?Math.floor(n):a));
export const grillVisualKey=block=>[block.dimension.id,block.location.x,block.location.y,block.location.z].join('|');
export function nearGrill(block,observers){
 const p=block.location;
 return observers.some(o=>o.dimensionId===block.dimension.id&&(o.x-p.x-.5)**2+(o.y-p.y)**2+(o.z-p.z-.5)**2<=GRILL_DISPLAY_RANGE_SQ);
}
export function grillVisualStage(state){
 const phase=clamp(state?.phase,0,3);
 return phase===0?0:phase===1?Math.min(4,1+clamp(state?.flips,0,4)):phase===2?4:5;
}
export function grillSlotPlan(stack,state,slot){
 if(!stack||slot<0||slot>2)return undefined;
 const index=GRILL_MODEL_INDEX[canonicalFoodId(stack.typeId)];
 if(index===undefined&&canonicalFoodId(stack.typeId)!=='kaleidoscope_grilling:secret_skewer')return undefined;
 return {model:index===undefined?114:index*6+grillVisualStage(state),flips:clamp(state?.flips,0,4),slot};
}
export function grillSlotLocation(block,slot,direction){
 const angles={north:0,east:90,south:180,west:270},angle=angles[direction]??0;
 const dx=(3+slot*5)/16-.5,r=angle*Math.PI/180,p=block.location;
 return {location:{x:p.x+.5+dx*Math.cos(r),y:p.y+5/16,z:p.z+.5+dx*Math.sin(r)},rotation:angle};
}

/** Transient rendering only: no item, inventory, ledger or block writes. */
export function createGrillDisplayController({spawn,apply,remove,valid=e=>e.isValid,maxHelpers=1024,staleTicks=8,onCapacity=()=>{}}){
 const rows=new Map();let count=0;
 function discard(row,slot){
  const old=row.helpers.get(slot);if(!old)return true;
  try{remove(old.entity)}catch{return false}
  row.helpers.delete(slot);count--;return true;
 }
 function clear(key){
  const row=rows.get(key);if(!row)return;
  for(const slot of [...row.helpers.keys()])discard(row,slot);
  if(!row.helpers.size)rows.delete(key);
 }
 return {
  touch(key,tick){const row=rows.get(key);if(row)row.seen=tick;},
  clear,
  update(key,block,plans,tick,direction='north'){
   let row=rows.get(key);if(!row){row={helpers:new Map(),seen:tick};rows.set(key,row)}row.seen=tick;
   for(let slot=0;slot<3;slot++){
    const plan=plans[slot];let old=row.helpers.get(slot);
    if(!plan){discard(row,slot);continue;}
    if(old&&!valid(old.entity)){if(!discard(row,slot))continue;old=undefined;}
    const pose=grillSlotLocation(block,slot,direction),signature=JSON.stringify({...pose,...plan});
    if(old?.signature===signature)continue;
    if(!old){if(count>=(typeof maxHelpers==='function'?maxHelpers():maxHelpers)){onCapacity(key,count);continue;}old={entity:spawn(block,pose.location,pose.rotation),signature:''};row.helpers.set(slot,old);count++;}
    try{apply(old.entity,block,pose,plan,key);old.signature=signature;}
    catch{discard(row,slot);}
   }
   if(!row.helpers.size)rows.delete(key);
  },
  sweep(tick){for(const [key,row] of rows)if(tick-row.seen>staleTicks)clear(key);},
  get size(){return count;}
 };
}
