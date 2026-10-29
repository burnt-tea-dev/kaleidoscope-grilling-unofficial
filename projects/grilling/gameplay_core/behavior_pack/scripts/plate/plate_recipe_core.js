import {PERSISTED_KEY as PersistedKey} from '../core/persist_keys.js';
import {canonicalFoodId} from '../eating_profile_ids.js';
import {FIXED_INGREDIENT_TAGS} from '../java_ingredient_tags.js';
import {SECRET_ID,recipeTable,secretFood,SKEWER_INGREDIENTS_KEY,SECRET_COOKED_KEY,SECRET_COOKED_INGREDIENTS_KEY} from '../skewer/skewering_core.js';

export const PLATE_ID='kaleidoscope_grilling:skewer_plate';
export const PLATE_BLOCK_ID='kaleidoscope_grilling:skewer_plate_block';
export const BOOK_ID='kaleidoscope_grilling:skewer_recipe_book';
export const RECIPE_BLOCK_ID='kaleidoscope_grilling:skewer_recipe';
export const PLATE_SKEWERS_KEY=PersistedKey.PLATE_SKEWERS;
export const BOOK_RECORD_KEY=PersistedKey.RECIPE_RECORD;
export const PLATE_CAPACITY=5;

const RECIPES=Object.freeze(recipeTable());
const RECORDABLE=new Set(RECIPES.map(x=>x.id));

// Re-evaluate the cached display/ranking fields without reconstructing native
// stacks, so this remains safe during beforeEvents and legacy plate reads.
export function refreshPlateFood(row){
 if(canonicalFoodId(row?.id)!==SECRET_ID)return row;
 if(row.native&&(row.native.version!==1||row.native.id!==row.id))return row;
 const props=row.native?.props??row.props??{};
 try{
  const raw=JSON.parse(props[SKEWER_INGREDIENTS_KEY]);
  if(!Array.isArray(raw)||raw.length!==3||raw.some(x=>!x||typeof x.id!=='string'||!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(x.id)))return row;
  const cooked=props[SECRET_COOKED_KEY]===true;
  let effective=raw;
  if(cooked&&props[SECRET_COOKED_INGREDIENTS_KEY]!==undefined){
   if(typeof props[SECRET_COOKED_INGREDIENTS_KEY]!=='string')return row;
   const saved=JSON.parse(props[SECRET_COOKED_INGREDIENTS_KEY]);
   if(!Array.isArray(saved)||(saved.length!==0&&saved.length!==3)||saved.some(x=>!x||typeof x.id!=='string'||!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(x.id)))return row;
   if(saved.length)effective=saved;
  }
  const food=secretFood(effective,cooked,raw);
  return {...row,nutrition:food.nutrition,saturation:food.saturation};
 }catch{return row}
}
function cleanRow(row){
 if(!row||typeof row.id!=='string'||!row.id)return null;
 row=refreshPlateFood(row);
 return {...row,id:String(row.id),nutrition:Math.max(0,Number(row.nutrition)||0),saturation:Math.max(0,Number(row.saturation)||0)};
}

export function normalizePlateRows(rows){
 return (Array.isArray(rows)?rows:[]).map(cleanRow).filter(Boolean).slice(0,PLATE_CAPACITY);
}

export function plateAdd(rows,row){
 const current=normalizePlateRows(rows),next=cleanRow(row);
 if(!next)return {ok:false,reason:'invalid',rows:current};
 if(current.length>=PLATE_CAPACITY)return {ok:false,reason:'full',rows:current};
 return {ok:true,rows:[...current,next]};
}

export function plateRemoveLast(rows){
 const current=normalizePlateRows(rows);
 if(!current.length)return {ok:false,removed:null,rows:current};
 return {ok:true,removed:current[current.length-1],rows:current.slice(0,-1)};
}

export function plateHighestNutritionIndex(rows){
 const current=normalizePlateRows(rows);
 let selected=-1,nutrition=-Infinity;
 for(let i=0;i<current.length;i++){
  const value=Math.max(0,Number(current[i].nutrition)||0);
  if(value>nutrition){nutrition=value;selected=i}
 }
 return selected;
}

export function plateEatHighest(rows){
 const current=normalizePlateRows(rows),index=plateHighestNutritionIndex(current);
 if(index<0)return {ok:false,eaten:null,rows:current,index:-1};
 const next=[...current],eaten=next.splice(index,1)[0];
 return {ok:true,eaten,rows:next,index};
}

export function isRecordableRecipe(id,ingredientCount=0){
 return RECORDABLE.has(String(canonicalFoodId(id)??''))||(canonicalFoodId(id)===SECRET_ID&&Number(ingredientCount)===3);
}

export function recipeForResult(id){
 const recipe=RECIPES.find(x=>x.id===id);
 return recipe?{id:recipe.id,cooked:recipe.cooked,slots:recipe.slots.map(slot=>[...slot])}:null;
}

export function makeBookRecord(resultId,customIngredients=[]){
 const id=String(resultId??'');
 const custom=(Array.isArray(customIngredients)?customIngredients:[]).map(String).filter(Boolean).slice(0,3);
 if(!isRecordableRecipe(id,custom.length))return null;
 return {resultId:canonicalFoodId(id),customIngredients:canonicalFoodId(id)===SECRET_ID?custom:[]};
}

export function bookIngredientSlots(record){
 if(!record||typeof record.resultId!=='string')return null;
 if(record.resultId===SECRET_ID){
  const custom=(record.customIngredients??[]).map(String).filter(Boolean).slice(0,3);
  return custom.length===3&&custom.every(id=>/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(id))?custom.map(id=>[id]):null;
 }
 const recipe=recipeForResult(record.resultId);
 return recipe?recipe.slots.map(slot=>[...new Set(slot.flatMap(id=>[id,...(FIXED_INGREDIENT_TAGS[id]??[]).map(tag=>'#'+tag)]))]):null;
}

export function selectorMatches(stack,selector){
 if(typeof selector!=='string')return false;
 const id=typeof stack==='string'?stack:stack?.id;
 if(selector.startsWith('#'))return Array.isArray(stack?.tags)&&stack.tags.includes(selector.slice(1));
 return typeof id==='string'&&id===selector;
}

export function planInventoryConsumption(inventory,slots,skipIndexes=[]){
 const rows=Array.isArray(inventory)?inventory:[],wanted=Array.isArray(slots)?slots:null;
 if(!wanted)return {ok:false,reason:'no_recipe',plan:[]};
 const skip=new Set(skipIndexes.map(Number)),reserved=new Map(),plan=[];
 for(let ingredient=0;ingredient<wanted.length;ingredient++){
  const acceptable=Array.isArray(wanted[ingredient])?wanted[ingredient]:[];
  let found=-1;
  for(let i=0;i<rows.length;i++){
   if(skip.has(i))continue;
   const stack=rows[i];if(!stack||typeof stack.id!=='string')continue;
   const count=Math.max(0,Number(stack.count)||0),used=reserved.get(i)??0;
   if(count<=used)continue;
   if(acceptable.some(selector=>selectorMatches(stack,selector))){found=i;break}
  }
  if(found<0)return {ok:false,reason:'missing',missing:acceptable,ingredient,plan:[]};
  reserved.set(found,(reserved.get(found)??0)+1);
 }
 for(const [slot,count] of reserved)plan.push({slot,count});
 plan.sort((a,b)=>a.slot-b.slot);
 return {ok:true,plan};
}
