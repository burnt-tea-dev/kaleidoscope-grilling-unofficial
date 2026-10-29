export const LEGACY_OIL_REG='kaleidoscope_grilling:a23_oil_sources';
import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';
export const OIL_REG_PREFIX=PersistedKey.A23_OIL_SOURCE_PREFIX;
export const FLOW_CELL_BUDGET=512;
export const FLOW_SOURCE_BUDGET=8;

function enc(n){const v=Math.trunc(Number(n)||0);return v<0?'m'+Math.abs(v):'p'+v}
function hash32(value){
 let h=0x811c9dc5;
 for(const ch of String(value??'')){h^=ch.charCodeAt(0);h=Math.imul(h,0x01000193)}
 return (h>>>0).toString(36);
}
function dimToken(value){
 const raw=String(value??''),safe=raw.replace(/[^a-z0-9_]/gi,'_').slice(0,40);
 return (safe||'dimension')+'_'+hash32(raw);
}
export function oilPosKey(d,x,y,z){return String(d)+'|'+Math.trunc(x)+'|'+Math.trunc(y)+'|'+Math.trunc(z)}
export function oilSourcePropertyId(row){
 return OIL_REG_PREFIX+dimToken(row?.d)+'_'+enc(row?.x)+'_'+enc(row?.y)+'_'+enc(row?.z);
}
export function normalizeOilSourceRow(raw,validTypes=[]){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const d=String(raw.d??''),x=Number(raw.x),y=Number(raw.y),z=Number(raw.z),type=String(raw.type??'');
 if(!d||!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(z)||!validTypes.includes(type))return null;
 const k=oilPosKey(d,x,y,z),cells=(Array.isArray(raw.cells)?raw.cells:[])
  .filter(v=>typeof v==='string'&&v.length>0).slice(0,FLOW_CELL_BUDGET);
 return {k,d,x,y,z,type,cells,nextTick:Math.max(0,Math.trunc(Number(raw.nextTick)||0))};
}
