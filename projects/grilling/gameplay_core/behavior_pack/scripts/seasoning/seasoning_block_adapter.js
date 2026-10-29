import {getWorldProperty,setWorldProperty} from '../core/persist.js';
import {PERSISTED_KEY as PersistedKey} from '../core/persist_keys.js';
import {markPlacedVisualDirty} from '../presentation/placed_visual_queue.js';
import {world} from '@minecraft/server';
import {
 SEASONING_CAPACITY,SEASONING_MAX_BOTTLES,SEASONING_MAX_USES,SEASONING_VARIANT_MAX,hasSeasoningBase,normalizeBottleData,normalizeBottleStack
} from './seasoning_contract_core.js';

function enc(n){return n<0?'m'+Math.abs(n):'p'+n}

export function seasoningBlockKey(block){
 return PersistedKey.SEASONING_BLOCK_PREFIX+block.dimension.id.replace(/[^a-z0-9]/gi,'_')+'_'+enc(block.x)+'_'+enc(block.y)+'_'+enc(block.z);
}

export function readPlacedSeasoningStack(block,strict=false){
 try{
  const raw=getWorldProperty(world,seasoningBlockKey(block));
  if(raw===undefined)return [];
  const value=JSON.parse(raw);
  if(!Array.isArray(value)){if(strict)throw new Error('Grilling: invalid saved seasoning stack');return []}
  if(value.length&&typeof value[0]==='string'){
   if(strict&&(value.length>SEASONING_CAPACITY||value.some(x=>typeof x!=='string')))throw new Error('Grilling: invalid legacy seasoning data');
   const ingredients=value.filter(x=>typeof x==='string');
   return [normalizeBottleData({kind:hasSeasoningBase(ingredients)?'pending':'empty',ingredients,uses:0,variant:0})];
  }
  if(strict){
   const keys=new Set(['kind','ingredients','uses','variant']);
   if(value.length>SEASONING_MAX_BOTTLES)throw new Error('Grilling: saved bottle capacity exceeded');
   for(const row of value){
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(key=>!keys.has(key)))throw new Error('Grilling: unsupported saved bottle data');
    if(row.kind!==undefined&&!['empty','pending','special'].includes(row.kind))throw new Error('Grilling: unknown saved bottle kind');
    if(row.ingredients!==undefined&&(!Array.isArray(row.ingredients)||row.ingredients.length>SEASONING_CAPACITY||row.ingredients.some(x=>typeof x!=='string')))throw new Error('Grilling: invalid saved ingredients');
    for(const [key,max] of [['uses',SEASONING_MAX_USES],['variant',SEASONING_VARIANT_MAX]])
     if(row[key]!==undefined&&(!Number.isInteger(row[key])||row[key]<0||row[key]>max))throw new Error('Grilling: invalid saved '+key);
   }
  }
  return normalizeBottleStack(value);
 }catch(error){if(strict)throw error;return []}
}

export function writePlacedSeasoningStack(block,rows){
 const stack=normalizeBottleStack(rows).slice(0,SEASONING_MAX_BOTTLES);
 try{setWorldProperty(world,seasoningBlockKey(block),stack.length?JSON.stringify(stack):undefined);markPlacedVisualDirty(block);return true}catch{return false}
}

export function topPlacedSeasoningBottle(block){
 const stack=readPlacedSeasoningStack(block);
 return stack.length?stack[stack.length-1]:undefined;
}
