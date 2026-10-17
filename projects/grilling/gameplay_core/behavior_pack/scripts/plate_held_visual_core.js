import {plateSpecialModel} from './plate_special_visual_core.js';
import {PLATE_SPECIAL_HELD_START} from './plate_special_visual_data.js';
import {FAILED_SOURCE_KEY} from './failure_skewer_visual_core.js';
import {RAW_TO_COOKED} from './data.js';
import {canonicalFoodId} from './eating_profile_ids.js';
import {GRILL_MODEL_INDEX} from './grill_visual_data.js';
import {secretVisualRows} from './secret_visual_state.js';
import {SECRET_VISUAL_MAX,SECRET_MODEL_VARIANTS_KEY} from './secret_visual_state_core.js';
import {SKEWER_INGREDIENTS_KEY,SECRET_COOKED_KEY,SECRET_COOKED_INGREDIENTS_KEY} from './a24_skewering_core.js';
import {HELD_VISUAL_PLATE} from './held_visual_transport.js';

const SECRET='kaleidoscope_grilling:secret_skewer';
const COOKED_TO_RAW=Object.freeze(Object.fromEntries(Object.entries(RAW_TO_COOKED).map(([raw,cooked])=>[cooked,raw])));
export const PLATE_HELD_WORD_A_MAX=521433;
export const PLATE_HELD_WORD_B_MAX=683220;
export const PLATE_HELD_ORDINARY=39;

// A secret row is split across two bounded integers. All Molang divisions are
// powers of two; count has its own property and is never extracted from a word.
// A uses 13 bits for v0 and 6 low bits of v1. B uses 7 high bits of v1 plus v2.
// B=0 identifies a fixed model; B>=1 identifies secret cells, including food0.
export function packPlateHeldSecret(cells){
 if(!Array.isArray(cells)||cells.length!==3||cells.some(v=>!Number.isInteger(v)||v<0||v>SECRET_VISUAL_MAX))
  throw Error('Grilling: invalid plate ingredient visual');
 return [cells[0]+8192*(cells[1]%64),1+Math.floor(cells[1]/64)+128*cells[2]];
}
function ingredientRows(props,key){
 const raw=props[key];if(raw===undefined)return [];
 if(typeof raw!=='string')throw Error('Grilling: unreadable plate ingredient property');
 const rows=JSON.parse(raw);
 if(!Array.isArray(rows)||rows.length>3||rows.some(row=>!row||typeof row.id!=='string'||
  !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(row.id)||(row.native&&(row.native.version!==1||row.native.id!==row.id))))
  throw Error('Grilling: invalid plate ingredient snapshot');
 return rows;
}
export function plateHeldRowPlan(row,frame=0){
 if(!row||typeof row.id!=='string'||(row.native&&(row.native.version!==1||row.native.id!==row.id)))
  throw Error('Grilling: invalid plate row identity');
 const id=canonicalFoodId(row.id);
 const props=row.native?(row.native.props??{}):(row.props??{});
 if(!props||typeof props!=='object'||Array.isArray(props))throw Error('Grilling: invalid saved plate properties');
 const special=plateSpecialModel(id,props[FAILED_SOURCE_KEY],props[SECRET_MODEL_VARIANTS_KEY],frame);
 if(special!==undefined)return [PLATE_SPECIAL_HELD_START+special,0];
 if(id===SECRET){
  // Match restoreStack: a native envelope owns the row even when it contains
  // no properties. Legacy row.props is used only without a native envelope.
  const cooked=props[SECRET_COOKED_KEY]===true,raw=ingredientRows(props,SKEWER_INGREDIENTS_KEY);
  const cached=ingredientRows(props,SECRET_COOKED_INGREDIENTS_KEY),effective=cooked&&cached.length?cached:raw;
  if(effective.length!==3)throw Error('Grilling: incomplete saved secret plate row');
  return packPlateHeldSecret(secretVisualRows(effective,props[SECRET_MODEL_VARIANTS_KEY],cooked?4:0,cached.length===3));
 }
 if(id==='kaleidoscope_grilling:ordinary_skewer')return [PLATE_HELD_ORDINARY,0];
 const raw=COOKED_TO_RAW[id]??id,index=GRILL_MODEL_INDEX[raw];
 // Unsupported external models keep their original slot and stored
 // data. Do not replace their identity with a convenient fixed skewer mesh.
 return index===undefined?[0,0]:[1+index*2+(raw===id?0:1),0];
}
export function plateHeldVisualPlan(rows,frame=0){
 if(!Array.isArray(rows)||rows.length>5)throw Error('Grilling: invalid held plate count');
 const words=Array.from({length:5},(_,i)=>i<rows.length?plateHeldRowPlan(rows[i],frame):[0,0]).flat();
 return [...words,rows.length,HELD_VISUAL_PLATE];
}
