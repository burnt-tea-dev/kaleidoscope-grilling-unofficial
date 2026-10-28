// Derived display rules. Java: SeasoningBottleRenderer, ClientSetup, OilPotVisualState.
import {bottleHeldVisualPlan} from '../bottle_held_visual_core.js';
import {PENDING_SEASONING_ID} from '../seasoning/seasoning_contract_core.js';
export const PREFIX='kaleidoscope_grilling:';
export const SEASON_ENTITY=PREFIX+'placed_seasoning_visual';
export const OIL_ENTITY=PREFIX+'placed_oil_visual';
export const FALLBACK_COLORS=[0xB86B45,0xE0A56A];
export const OFFSETS=[[[0,0]],[[4,3],[-3,-1]],[[4,4],[-3,3],[3,-3.75]],[[4,5],[-3,4],[3.5,-3.25],[-4.25,-3.25]]];
const integer=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Math.floor(Number(value)):min));
export function isSeasoningBlock(id){return /^kaleidoscope_grilling:seasoning_bottle(?:_[1-4])?$/.test(id||'')}
export function bottlePlan(row,palette={}){
 if(!row)return undefined;
 const special=row.kind==='special',ingredients=Array.isArray(row.ingredients)?row.ingredients.slice(0,8):[];
 const fill=special?Math.ceil((16-integer(row.uses,0,16))/2):ingredients.length;
 if(fill===0)return undefined;
 return {mode:special?2:1,fill,variant:special?integer(row.variant,0,7):0,
  colors:ingredients.map(id=>Object.hasOwn(palette,id)?palette[id]:FALLBACK_COLORS),
  layers:bottleHeldVisualPlan(special?undefined:PENDING_SEASONING_ID,ingredients)};
}
export function oilPlan(state){
 const oil=['canola','secret_chili','premium_chili'].indexOf(state?.type)+1;
 return oil>0&&Number(state?.count)>0?{oil}:undefined;
}
export function positions(count){return OFFSETS[integer(count,1,4)-1]}
export function decodeKey(key,dimensionIds){
 const prefixes=[PREFIX+'sb_',PREFIX+'a2736_oilpot_type_'];
 const prefix=prefixes.find(x=>key.startsWith(x));if(!prefix)return undefined;
 for(const dimensionId of dimensionIds){
  const d=dimensionId.replace(/[^a-z0-9]/gi,'_')+'_';
  const body=key.slice(prefix.length);if(!body.startsWith(d))continue;
  const parts=body.slice(d.length).split('_');if(parts.length!==3||!parts.every(x=>/^[mp]\d+$/.test(x)))return undefined;
  const values=parts.map(x=>(x[0]==='m'?-1:1)*Number(x.slice(1)));
  if(!values.every(Number.isSafeInteger))return undefined;
  return {dimensionId,location:{x:values[0],y:values[1],z:values[2]}};
 }
}
export function rotationForStates(states={}){
 for(const key of ['minecraft:cardinal_direction','kaleidoscope_cookery:facing','facing_direction','minecraft:facing_direction']){
  const v=states[key];
  if(typeof v==='string'&&Object.hasOwn({north:0,east:90,south:180,west:270},v))return {north:0,east:90,south:180,west:270}[v];
  if(typeof v==='number'&&Object.hasOwn({2:0,5:90,3:180,4:270},v))return {2:0,5:90,3:180,4:270}[v];
 }
 return 0;
}
