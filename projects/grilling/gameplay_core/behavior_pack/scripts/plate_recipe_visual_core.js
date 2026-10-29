import {plateSpecialModel} from './plate_special_visual_core.js';
import {PLATE_SPECIAL_WORLD_START} from './plate_special_visual_data.js';
import {FAILED_SOURCE_KEY} from './failure_skewer_visual_core.js';
import {RAW_TO_COOKED} from './data.js';
import {canonicalFoodId} from './eating_profile_ids.js';
import {GRILL_MODEL_INDEX} from './grill_visual_data.js';
import {secretVisualState} from './secret_visual_state.js';
import {decodeSecretVisual,SECRET_MODEL_VARIANTS_KEY} from './secret_visual_state_core.js';
import {SECRET_GUI_COLORS} from './secret_gui_color_data.js';
import {getItemProperty} from './core/persist.js';

export const PLATE_FOOD_VISUAL_TYPE='kaleidoscope_grilling:plate_food_visual';
export const RECIPE_ICON_VISUAL_TYPE='kaleidoscope_grilling:recipe_icon_visual';
export const CUSTOM_RECIPE_ICON_VISUAL_TYPE='kaleidoscope_grilling:custom_recipe_icon_visual';
export const VAT_PREMIUM_VISUAL_TYPE='kaleidoscope_grilling:vat_premium_visual';
const SECRET='kaleidoscope_grilling:secret_skewer';
const COOKED_TO_RAW=Object.freeze(Object.fromEntries(Object.entries(RAW_TO_COOKED).map(([raw,cooked])=>[cooked,raw])));
// Existing Java GUI-16 textures, ordered by the audited grill model index.
export const RECIPE_ICON_MODELS=Object.freeze(Object.fromEntries([
 ...Object.entries(GRILL_MODEL_INDEX).flatMap(([raw,index])=>[[raw,index*2],[RAW_TO_COOKED[raw],index*2+1]]),
 ['kaleidoscope_grilling:ordinary_skewer',38]
]));
export function recipeIconModel(stack){
 const id=canonicalFoodId(stack?.typeId);return Object.hasOwn(RECIPE_ICON_MODELS,id)?RECIPE_ICON_MODELS[id]:undefined;
}
export function recipeAnimationFrame(tick){return Number.isFinite(tick)&&tick>=0?Math.floor(tick/4)%5:0;}
export function vatAnimationFrame(tick){return Number.isFinite(tick)&&tick>=0?Math.floor(tick/16)%32:0;}
export function vatPremiumPlan(block){
 const level=block?.permutation.getState('kaleidoscope_grilling:vat_level');
 return block?.typeId==='kaleidoscope_grilling:big_vat'&&block.permutation.getState('kaleidoscope_grilling:vat_fluid')==='premium_chili'&&Number.isInteger(level)&&level>=1&&level<=4?{level}:undefined;
}
function javaStringHash(value){let hash=0;for(let i=0;i<value.length;i++)hash=(Math.imul(hash,31)+value.charCodeAt(i))|0;return hash;}
// SkeweringHandler.guiVariantBits preserves saved 4..9 values, with its Java
// int hash fallback for legacy/missing values. This projection never repairs
// or rewrites a stack's metadata, and uses raw IDs even for cooked snapshots.
export function secretGuiVariantBits(ingredients,raw){
 let variants;try{variants=typeof raw==='string'?JSON.parse(raw):raw}catch{}
 let bits=0;
 for(let slot=0;slot<3;slot++){
  const value=Number.isInteger(variants?.[slot])?variants[slot]|0:0;let bit;
  if(value>=4&&value<=9)bit=Math.floor((value-4)/3);
  else{
   let hash=(31*(slot+1)+value)|0,id=ingredients[slot]?.id;
   if(typeof id==='string')hash=(Math.imul(31,hash)+javaStringHash(id))|0;
   hash^=hash>>>16;hash=Math.imul(hash,0x7FEB352D);hash^=hash>>>15;bit=hash&1;
  }
  bits|=bit<<slot;
 }
 return bits;
}
export function secretGuiIconPlan(stack,readIngredients){
 if(canonicalFoodId(stack?.typeId)!==SECRET)return undefined;
 const raw=(readIngredients?.(stack,false)??[]).slice(0,3);
 const colors=secretVisualState(stack,readIngredients).map(value=>{
  const {food,style}=decodeSecretVisual(value);return SECRET_GUI_COLORS[food][style];
 });
 return {count:raw.length,bits:secretGuiVariantBits(raw,getItemProperty(stack,SECRET_MODEL_VARIANTS_KEY)),colors};
}
export function plateMeshPlan(stack,readIngredients,frame=0){
 const id=canonicalFoodId(stack?.typeId);
 const special=plateSpecialModel(id,getItemProperty(stack,FAILED_SOURCE_KEY),getItemProperty(stack,SECRET_MODEL_VARIANTS_KEY),frame);
 if(special!==undefined)return {model:PLATE_SPECIAL_WORLD_START+special,secret:[0,0,0]};
 if(id===SECRET)return {model:114,secret:secretVisualState(stack,readIngredients)};
 const raw=COOKED_TO_RAW[id]??id,index=GRILL_MODEL_INDEX[raw];
 return index===undefined?undefined:{model:index*6+(raw===id?0:4),secret:[0,0,0]};
}

// Java 1.1.1 SkewerPlateRenderer.LAYOUTS, in authored model units (x,y,z,yaw).
// FIXED rotation is cancelled by the plate renderer; .8 * 1.5 leaves scale 1.2.
export const PLATE_LAYOUTS=Object.freeze([
 [],
 [[8,4,6.3,0]],
 [[5.6,4.15,5.95,0],[10.4,4.2,5.9,0]],
 [[5.6,3.95,6.35,0],[10.4,4,6.3,0],[8,7.375,7.65,-22.5]],
 [[8,3.95,6.35,0],[12.55,4,6.3,0],[3.45,4,6.3,0],[8,7.325,7.7,-45]],
 [[8,3.95,6.35,0],[12.55,4,6.3,0],[3.45,4,6.3,0],[10.4,7.325,7.4,-22.5],[5.7,7.375,7.35,-22.5]]
].map(rows=>Object.freeze(rows.map(row=>Object.freeze(row)))));
const SOURCE_FACING={south:0,west:90,north:180,east:270};
function sourcePose(block,x,y,z,yaw=0){
 const angle=SOURCE_FACING[block.permutation.getState('minecraft:cardinal_direction')];
 if(angle===undefined)return undefined;
 const r=angle*Math.PI/180,dx=x-.5,dz=z-.5;
 return {location:{x:block.x+.5+dx*Math.cos(r)-dz*Math.sin(r),y:block.y+y,z:block.z+.5+dx*Math.sin(r)+dz*Math.cos(r)},angle:angle-yaw};
}
export function plateSlotPose(block,count,index){
 const rows=PLATE_LAYOUTS[Math.max(0,Math.min(5,Number.isFinite(count)?Math.floor(count):0))],slot=rows[index];
 return slot?sourcePose(block,slot[0]/16,slot[1]/16,slot[2]/16,slot[3]):undefined;
}
export function recipeIconPose(block){return sourcePose(block,.5,.625,.3/16);}
// The Java fallback applies the page translation after a .5 scale.
export function recipeMeshPose(block){return sourcePose(block,.5,.625,.15/16);}
