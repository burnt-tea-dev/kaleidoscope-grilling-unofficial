import {canonicalSeasoningBottleId} from '../seasoning/seasoning_contract_core.js';
import {isSpecialSeasoningId} from '../seasoning/special_seasoning_visual_core.js';
export const ADVANCED_RACK_ITEM_ID='kaleidoscope_grilling:advanced_rack';
export const ADVANCED_RACK_BLOCK_ID='kaleidoscope_grilling:advanced_rack_block';
export const RACK_PAYLOAD_KEY='kaleidoscope_grilling:rack_payload';
export const RACK_COMPARTMENTS=9;
export const RACK_SEASONING_SLOTS=5;
export const RACK_TOOL_SLOTS=4;
export const RACK_RANGE=8;

export const SEASONING_ITEM_IDS=Object.freeze(new Set([
 'kaleidoscope_cookery:oil_pot',
 'kaleidoscope_cookery:oil_pot_filled',
 'kaleidoscope_grilling:empty_seasoning_bottle',
 'kaleidoscope_grilling:pending_seasoning',
 'kaleidoscope_grilling:special_seasoning'
]));

export const TOOL_ITEM_IDS=Object.freeze(new Set([
 'kaleidoscope_cookery:iron_kitchen_knife',
 'kaleidoscope_cookery:gold_kitchen_knife',
 'kaleidoscope_cookery:diamond_kitchen_knife',
 'kaleidoscope_cookery:netherite_kitchen_knife',
 'kaleidoscope_cookery:kitchen_shovel',
 'minecraft:flint_and_steel'
]));

const FACE_OFFSET=Object.freeze({
 Up:[0,1,0],Down:[0,-1,0],East:[1,0,0],West:[-1,0,0],North:[0,0,-1],South:[0,0,1]
});

export function rackSlotKind(slot){
 const n=Math.floor(Number(slot));
 if(n>=0&&n<RACK_SEASONING_SLOTS)return 'seasoning';
 if(n>=RACK_SEASONING_SLOTS&&n<RACK_COMPARTMENTS)return 'tool';
 return '';
}

function rackItemKinds(typeId,tags=[]){
 const id=canonicalSeasoningBottleId(String(typeId??'')),set=new Set(Array.isArray(tags)?tags:[]);
 return {
  seasoning:SEASONING_ITEM_IDS.has(id)||isSpecialSeasoningId(id)||set.has('kaleidoscope_grilling:advanced_rack_seasonings'),
  tool:TOOL_ITEM_IDS.has(id)||set.has('kaleidoscope_grilling:advanced_rack_tools')||set.has('kaleidoscope_cookery:kitchen_knife')||set.has('kaleidoscope_cookery:kitchen_shovel')
 };
}
export function rackItemKind(typeId,tags=[]){
 const kinds=rackItemKinds(typeId,tags);return kinds.seasoning?'seasoning':kinds.tool?'tool':'';
}

export function rackCanonicalFilter(typeId,tags=[],slot=undefined){
 const id=canonicalSeasoningBottleId(String(typeId??'')),expected=slot===undefined?undefined:rackSlotKind(slot);
 const kind=expected?(rackItemKinds(id,tags)[expected]?expected:''):rackItemKind(id,tags);
 if(!kind)return undefined;
 if(id==='kaleidoscope_cookery:oil_pot'||id==='kaleidoscope_cookery:oil_pot_filled')
  return {kind,category:'oil_pot',typeId:'kaleidoscope_cookery:oil_pot'};
 if(id==='kaleidoscope_grilling:empty_seasoning_bottle'||id==='kaleidoscope_grilling:pending_seasoning'||isSpecialSeasoningId(id))
  return {kind,category:'seasoning_bottle',typeId:'kaleidoscope_grilling:empty_seasoning_bottle'};
 return {kind,category:'exact',typeId:id};
}

export function rackFilterMatches(filter,typeId,tags=[]){
 if(!filter)return true;
 const candidate=rackCanonicalFilter(typeId,tags,filter.kind==='tool'?5:0);
 if(!candidate||candidate.kind!==filter.kind)return false;
 if(filter.category==='oil_pot')return candidate.category==='oil_pot';
 if(filter.category==='seasoning_bottle')return candidate.category==='seasoning_bottle';
 return filter.category==='exact'&&candidate.category==='exact'&&candidate.typeId===filter.typeId;
}

export function rackCanPlace(slot,typeId,tags=[],filter=undefined){
 const expected=rackSlotKind(slot);
 return !!expected&&rackItemKinds(typeId,tags)[expected]&&(!filter||filter.kind===expected)&&rackFilterMatches(filter,typeId,tags);
}

export function normalizeRackFilters(values){
 const out=Array(RACK_COMPARTMENTS).fill(null);
 if(!Array.isArray(values))return out;
 for(let i=0;i<RACK_COMPARTMENTS;i++){
  const v=values[i];
  if(v&&typeof v==='object'&&['seasoning','tool'].includes(v.kind)&&typeof v.typeId==='string')
   out[i]={kind:v.kind,category:String(v.category??'exact'),typeId:v.typeId};
 }
 return out;
}

export function rackDisplayLevel(occupied){
 let n=0;
 for(let i=0;i<RACK_SEASONING_SLOTS;i++)if(occupied?.[i])n++;
 return Math.min(4,n);
}

export function rackPlacementCandidates(location,face){
 const base={x:location.x,y:location.y,z:location.z};
 const o=FACE_OFFSET[String(face)]??[0,1,0];
 return [base,{x:base.x+o[0],y:base.y+o[1],z:base.z+o[2]}];
}

export function bindingInRange(binding,dimensionId,location,range=RACK_RANGE){
 if(!binding||binding.dimension!==dimensionId)return false;
 const dx=(binding.x+.5)-location.x,dy=(binding.y+.5)-location.y,dz=(binding.z+.5)-location.z;
 return dx*dx+dy*dy+dz*dz<=range*range;
}
