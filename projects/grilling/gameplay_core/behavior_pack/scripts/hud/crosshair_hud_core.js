import {normalizeOilType,oilCapacity} from '../oil/oil_contract_core.js';

export const CROSSHAIR_HUD_POLL_TICKS=4;
export const CROSSHAIR_HUD_MAX_DISTANCE=6;

export function shouldPublishHud(previousSignature,nextSignature){
 return !!nextSignature&&String(previousSignature??'')!==String(nextSignature);
}

export function normalizeHudResult(providerId,result){
 if(!providerId||!result||typeof result!=='object'||!result.signature||!result.message)return undefined;
 return {
  signature:String(providerId)+'|'+String(result.signature),
  message:result.message
 };
}

export function oilPotHudView(state={}){
 const type=normalizeOilType(state.type);
 const capacity=Math.max(1,Math.floor(Number(state.capacity)||oilCapacity(type)));
 const count=Math.max(0,Math.min(capacity,Math.floor(Number(state.count)||0)));
 const remaining=Math.max(0,capacity-count);
 const kind=type||(count>0?'fat':'empty');
 return {
  signature:['oil_pot',kind,count,capacity].join(':'),
  kind,count,capacity,remaining,
  message:{
   rawtext:[
    {text:'§6'},
    {translate:'hud.kaleidoscope_grilling.oil_pot.title'},
    {text:'§r §8| §f'},
    {translate:'tooltip.kaleidoscope_grilling.oil_pot.'+kind,with:[String(count)]},
    {text:' §8| §7'},
    {translate:'hud.kaleidoscope_grilling.oil_pot.capacity',with:[String(count),String(capacity),String(remaining)]}
   ]
  }
 };
}
