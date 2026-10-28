import {getItemProperty,setItemProperty,getItemPropertyIds,getItemLore,setItemLore} from '../itemData.js';
import {ItemStack} from '@minecraft/server';
import {readPublicOil,createPublicOilPot} from '../host_api/oil_api_core.js';
import {
 COOKERY_EMPTY_ID,COOKERY_FILLED_ID,HOST_COUNT_KEY,GRILLING_TYPE_KEY,
 normalizeOilType,oilCapacity,normalizeOilCount,planOilConsumption,planTypedOilAddition
} from './cookery_oil_pot_core.js';

export {COOKERY_EMPTY_ID,COOKERY_FILLED_ID,HOST_COUNT_KEY,GRILLING_TYPE_KEY};
function dynamic(stack,key){
 try{return {ok:true,value:getItemProperty(stack,key)}}catch{return {ok:false,value:undefined}}
}
export function readCookeryOilPot(stack,{legacyPlacementFallback=false}={}){
 const filled=stack?.typeId===COOKERY_FILLED_ID,empty=stack?.typeId===COOKERY_EMPTY_ID;
 if(!filled)return {filled:false,empty,type:'',count:0,capacity:0,valid:true};
 const portable=readPublicOil(stack);
 if(portable.source==='public_api')return {filled:true,empty:false,type:portable.state.type,count:portable.state.count,capacity:oilCapacity(portable.state.type),valid:true,revision:portable.state.revision,source:'public_api'};
 if(portable.reason!=='host_snapshot_required')return {filled:true,empty:false,type:'',count:0,capacity:0,valid:false,reason:portable.reason};
 const typeProbe=dynamic(stack,GRILLING_TYPE_KEY),countProbe=dynamic(stack,HOST_COUNT_KEY);
 const type=normalizeOilType(typeProbe.value);
 const count=normalizeOilCount({filled:true,type,raw:countProbe.value,
  hasRaw:countProbe.ok&&countProbe.value!==undefined,legacyPlacementFallback});
 const valid=typeProbe.ok&&countProbe.ok&&countProbe.value!==undefined&&(!typeProbe.value||typeProbe.value===type);
 return {filled:true,empty:false,type,count,capacity:oilCapacity(type),valid,source:valid?'legacy_grilling':'await_host',reason:valid?undefined:'host_snapshot_required'};
}
export function readCookeryOilPotForPlacement(stack){return readCookeryOilPot(stack,{legacyPlacementFallback:true})}
function oilLore(line){
 return typeof line==='string'?line.startsWith('§7Oil: '):
  !!line&&typeof line.text==='string'&&line.text.startsWith('§7Oil: ');
}
export function buildCookeryOilPot(type,count,template=undefined){
 const normalizedType=normalizeOilType(type),cap=oilCapacity(normalizedType);
 const normalizedCount=Math.max(0,Math.min(cap,Math.floor(Number(count)||0)));
 try{
  const out=createPublicOilPot(ItemStack,normalizedType,normalizedCount,template);
  // Legacy Grilling properties are retired only in this pack's scope.
  setItemProperty(out,HOST_COUNT_KEY,undefined);
  setItemProperty(out,GRILLING_TYPE_KEY,undefined);
  if(normalizedCount===0)return out;
  const result=readCookeryOilPot(out);
  if(!result.valid||result.type!==normalizedType||result.count!==normalizedCount)return undefined;
  return out;
 }catch{return undefined}
}
export function planCookeryOilPotConsumption(stack,needed,requiredType=''){
 const state=readCookeryOilPot(stack);
 if(!state.valid)return {ok:false,reason:state.reason??'stack_error'};
 const plan=planOilConsumption(state,needed,requiredType);if(!plan.ok)return plan;
 let before;
 try{before=stack.clone()}catch{return {ok:false,reason:'stack_error',type:plan.type,count:plan.count}}
 const next=buildCookeryOilPot(plan.type,plan.remaining,stack);
 if(!next)return {ok:false,reason:'stack_error',type:plan.type,count:plan.count};
 return {...plan,before,next};
}
export function planCookeryTypedOilAddition(stack,incomingType,points){
 const state=readCookeryOilPot(stack);
 if(!state.valid)return {ok:false,reason:state.reason??'stack_error'};
 const plan=planTypedOilAddition(state,incomingType,points);if(!plan.ok)return plan;
 const next=buildCookeryOilPot(plan.type,plan.nextCount,stack);
 if(!next)return {ok:false,reason:'stack_error',type:plan.type,count:plan.count};
 return {...plan,next};
}
