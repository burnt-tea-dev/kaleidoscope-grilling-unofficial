import {PROJECTILE_DODGE_GROUND_ROWS} from './projectile_dodge_ground_catalog.js';
import {PROJECTILE_DODGE_OWNED_GROUND_ROWS} from './projectile_dodge_owned_ground_catalog.js';
const axes=['x','y','z'];
const intMin=-2147483648,intMax=2147483647;
const rows=new Map(),aliasTuples=new Map();
for(const row of PROJECTILE_DODGE_GROUND_ROWS){
 rows.set(row.typeId,row);
 if(row.nativeAliases)aliasTuples.set(row.typeId,row.nativeAliases.tuples);
}
for(const row of PROJECTILE_DODGE_OWNED_GROUND_ROWS)rows.set(row.typeId,row);
// Catalog tuples are deeply frozen. Build their string lookup only if this
// exact block reaches alias validation; keep the original vanilla-only source.
function aliasSet(typeId){
 let value=aliasTuples.get(typeId);
 if(Array.isArray(value)){value=new Set(value.map(tuple=>JSON.stringify(tuple)));aliasTuples.set(typeId,value);}
 return value;
}
const unsupported=reason=>({supported:false,reason});
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const floorInt=value=>Math.floor(value)+0;

// Accepted ordinary world coordinates preserve Java BlockPos.containing floor.
// Values outside its integer domain are unsupported, never saturated/guessed.
export function projectileDodgeGroundSampleValid(sample){
 return !!sample&&axes.every(axis=>typeof sample[axis]==='number'&&Number.isFinite(sample[axis])&&floorInt(sample[axis])>=intMin&&floorInt(sample[axis])<=intMax);
}
export function projectileDodgeGroundPlan(sample,minimum){
 if(!projectileDodgeGroundSampleValid(sample))return unsupported('ground_sample_invalid');
 if(!Number.isInteger(minimum)||minimum<intMin||minimum>intMax)return unsupported('ground_minimum_invalid');
 const cursor=Object.fromEntries(axes.map(axis=>[axis,floorInt(sample[axis])]));
 return {supported:true,reason:'',cursor,workingY:sample.y,minimum,maxReads:Math.max(0,cursor.y-minimum)};
}

// A source motion result is an exact ID/state fact. Air/fluid/material/name/ray
// properties cannot fill an unknown row or an unreviewed native state domain.
export function classifyProjectileDodgeGroundCell({typeId,states}={}){
 if(typeof typeId!=='string'||!typeId)return unsupported('ground_block_type_unavailable');
 const row=rows.get(typeId);if(!row)return unsupported('ground_block_type_unsupported');
 if(!states||typeof states!=='object'||Array.isArray(states))return unsupported('ground_block_states_unavailable');
 try{
  const actual=Reflect.ownKeys(states),primary=Object.keys(row.states),alias=row.nativeAliases,expected=alias?[...primary,...alias.extraKeys]:primary;
  if(actual.length!==expected.length||actual.some(key=>typeof key!=='string'||!expected.includes(key)))return unsupported('ground_block_states_unsupported');
  for(const key of primary)if(!own(states,key)||!row.states[key].includes(states[key]))return unsupported('ground_block_states_unsupported');
  // Legacy aliases are conditional on the COMPLETE declared primary tuple.
  // Independent per-field domains would accept impossible half/direction/color
  // combinations and could grant a different vanilla identity its motion.
  if(alias&&!aliasSet(typeId).has(JSON.stringify([...alias.primaryKeys,...alias.extraKeys].map(key=>states[key]))))return unsupported('ground_block_states_unsupported');
 }catch{return unsupported('ground_block_states_unavailable')}
 return {supported:true,blocksMotion:row.blocksMotion,reason:row.sourceKind?'reviewed_author_source_motion':'reviewed_original_motion'};
}
