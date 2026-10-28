import {normalizeOilType} from '../oil/oil_contract_core.js';
import {
 SEASONING_MAX_USES,normalizeSeasoningList
} from '../seasoning/seasoning_contract_core.js';

export const COOKERY_POT_ID='kaleidoscope_cookery:pot';
export const COOKERY_STOCKPOT_ID='kaleidoscope_cookery:stockpot';
export const COOKERY_NATIVE_OIL_ID='kaleidoscope_cookery:oil';
export const COOKERY_FILLED_OIL_POT_ID='kaleidoscope_cookery:oil_pot_filled';
export const COOKERY_OILED_SHOVEL_ID='kaleidoscope_cookery:kitchen_shovel_has_oil';

export const POT_HOT_TICKS=Object.freeze({
 default:1200,canola:1200,secret_chili:12000,premium_chili:24000
});
export const STOCKPOT_HOT_TICKS=1200;

export function cuisineStateKeyAt(dimensionId,x,y,z){
 return 'kaleidoscope_grilling:cuisine_'+String(dimensionId??'').replace(/[^a-z0-9]/gi,'_')+'_'
  +Math.floor(Number(x)||0)+'_'+Math.floor(Number(y)||0)+'_'+Math.floor(Number(z)||0);
}
export function cuisineStateKey(block){return cuisineStateKeyAt(block.dimension.id,block.x,block.y,block.z)}
export function normalizeCuisineState(row={}){
 const typed=normalizeOilType(row?.oilType);
 return {
  seasoning:normalizeSeasoningList(row?.seasoning),
  oilType:typed||(String(row?.oilType??'')==='default'?'default':''),
  lastOutputTick:Math.max(0,Math.floor(Number(row?.lastOutputTick)||0))
 };
}
export function potHotTicks(type){
 const typed=normalizeOilType(type),t=typed||(String(type??'')==='default'?'default':'');
 return t?POT_HOT_TICKS[t]??POT_HOT_TICKS.default:0;
}
export function stationKind(id){
 if(id===COOKERY_POT_ID)return 'pot';
 if(id===COOKERY_STOCKPOT_ID)return 'stockpot';
 return '';
}
export function stateBeforeSeasoning(kind,state={},hasHostOil=false){
 const current=normalizeCuisineState(state);
 if(kind==='pot'&&!hasHostOil&&current.oilType)return normalizeCuisineState({});
 return current;
}
export function planPotOilTransition(state={},beforeHasOil=false,afterHasOil=false,candidateType=''){
 const current=normalizeCuisineState(state);
 if(beforeHasOil||!afterHasOil)return {changed:false,state:current};
 const candidate=normalizeOilType(candidateType)||(String(candidateType??'')==='default'?'default':'default');
 return {changed:true,state:normalizeCuisineState({
  ...current,seasoning:current.oilType?[]:current.seasoning,oilType:candidate
 })};
}
export function oilTypeFromHeld(itemId,typedOilType=''){
 const typed=normalizeOilType(typedOilType);
 if(itemId===COOKERY_FILLED_OIL_POT_ID)return typed||'default';
 if(itemId===COOKERY_NATIVE_OIL_ID||itemId===COOKERY_OILED_SHOVEL_ID)return 'default';
 return '';
}
export function planSeasoningUse({ingredients=[],uses=0,creative=false}={}){
 const values=normalizeSeasoningList(ingredients);
 if(!values.length)return {ok:false,reason:'empty',ingredients:values};
 const before=Math.max(0,Math.min(SEASONING_MAX_USES,Math.floor(Number(uses)||0)));
 if(creative)return {ok:true,ingredients:values,before,nextUses:before,replaceEmpty:false,mutate:false};
 const next=before+1;
 return {ok:true,ingredients:values,before,nextUses:Math.min(SEASONING_MAX_USES,next),replaceEmpty:next>=SEASONING_MAX_USES,mutate:true};
}
function sig(row){
 if(!row)return '';
 return JSON.stringify({
  id:String(row.id??''),amount:Math.max(0,Math.floor(Number(row.amount)||0)),
  name:String(row.name??''),lore:Array.isArray(row.lore)?row.lore:[],
  props:row.props&&typeof row.props==='object'?row.props:{},
  damage:Number.isFinite(Number(row.damage))?Number(row.damage):null
 });
}
export function inventoryGains(before=[],after=[]){
 const out=[],n=Math.max(before.length,after.length);
 for(let slot=0;slot<n;slot++){
  const b=before[slot],a=after[slot];if(!a?.id)continue;
  let gained=0;
  if(!b?.id||b.id!==a.id)gained=Math.max(0,Number(a.amount)||0);
  else{
   const bCopy={...b,amount:0},aCopy={...a,amount:0};
   if(sig(bCopy)===sig(aCopy)||(Number(a.amount)||0)>(Number(b.amount)||0))
    gained=Math.max(0,(Number(a.amount)||0)-(Number(b.amount)||0));
  }
  if(gained>0)out.push({slot,id:a.id,count:gained});
 }
 return out;
}
export function metadataPlan(kind,state={}){
 const normalized=normalizeCuisineState(state);
 if(kind==='pot')return {seasoning:[...normalized.seasoning],hotTicks:potHotTicks(normalized.oilType||'default')};
 if(kind==='stockpot')return {seasoning:[...normalized.seasoning],hotTicks:STOCKPOT_HOT_TICKS};
 return {seasoning:[],hotTicks:0};
}
