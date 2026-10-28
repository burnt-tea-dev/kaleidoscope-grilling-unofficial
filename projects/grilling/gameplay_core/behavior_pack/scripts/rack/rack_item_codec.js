import {getItemProperty,setItemProperty,getItemPropertyIds,getItemLore,setItemLore} from '../itemData.js';
import {ItemStack,ItemComponentTypes,EnchantmentType} from '@minecraft/server';
import {RACK_COMPARTMENTS,RACK_PAYLOAD_KEY,normalizeRackFilters} from './advanced_rack_core.js';

function encodeDynamic(value){
 if(value===undefined)return undefined;
 if(typeof value==='boolean'||typeof value==='number'||typeof value==='string')return {kind:typeof value,value};
 if(value&&typeof value==='object'&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&Number.isFinite(value.z))
  return {kind:'vector',value:{x:value.x,y:value.y,z:value.z}};
 return undefined;
}
function decodeDynamic(row){return row?.kind==='vector'?row.value:row?.value}

export function encodeRackStack(stack){
 if(!stack)return null;
 const dynamic={};
 try{
  for(const id of getItemPropertyIds(stack)){
   const encoded=encodeDynamic(getItemProperty(stack,id));
   if(encoded)dynamic[id]=encoded;
  }
 }catch{}
 let damage;
 try{damage=stack.getComponent(ItemComponentTypes.Durability)?.damage}catch{}
 let enchantments=[];
 try{
  enchantments=(stack.getComponent(ItemComponentTypes.Enchantable)?.getEnchantments()??[])
   .map(x=>({id:x.type.id,level:x.level}));
 }catch{}
 let rawLore=[];
 try{rawLore=stack.getRawLore()}catch{try{rawLore=getItemLore(stack)}catch{}}
 let canDestroy=[],canPlaceOn=[];
 try{canDestroy=stack.getCanDestroy()}catch{}
 try{canPlaceOn=stack.getCanPlaceOn()}catch{}
 return {
  typeId:stack.typeId,amount:stack.amount,nameTag:stack.nameTag,
  rawLore,dynamic,damage,enchantments,canDestroy,canPlaceOn
 };
}

export function decodeRackStack(row){
 if(!row?.typeId)return undefined;
 let stack;
 try{stack=new ItemStack(row.typeId,Math.max(1,Math.floor(Number(row.amount)||1)))}catch{return undefined}
 try{if(typeof row.nameTag==='string'&&row.nameTag)stack.nameTag=row.nameTag}catch{}
 try{if(Array.isArray(row.rawLore)&&row.rawLore.length)setItemLore(stack,row.rawLore)}catch{}
 try{
  for(const [id,encoded] of Object.entries(row.dynamic??{}))setItemProperty(stack,id,decodeDynamic(encoded));
 }catch{}
 try{
  const durability=stack.getComponent(ItemComponentTypes.Durability);
  if(durability&&Number.isFinite(row.damage))durability.damage=Math.max(0,Math.min(durability.maxDurability,Math.floor(row.damage)));
 }catch{}
 try{
  const ench=stack.getComponent(ItemComponentTypes.Enchantable);
  if(ench&&Array.isArray(row.enchantments)&&row.enchantments.length){
   ench.removeAllEnchantments();
   ench.addEnchantments(row.enchantments.map(x=>({type:new EnchantmentType(x.id),level:x.level})));
  }
 }catch{}
 try{if(Array.isArray(row.canDestroy)&&row.canDestroy.length)stack.setCanDestroy(row.canDestroy)}catch{}
 try{if(Array.isArray(row.canPlaceOn)&&row.canPlaceOn.length)stack.setCanPlaceOn(row.canPlaceOn)}catch{}
 return stack;
}

export function encodeRackPayload(items=[],filters=[]){
 const rows=Array(RACK_COMPARTMENTS).fill(null);
 for(let i=0;i<RACK_COMPARTMENTS;i++)rows[i]=encodeRackStack(items[i]);
 return JSON.stringify({version:1,items:rows,filters:normalizeRackFilters(filters)});
}

export function decodeRackPayload(raw){
 if(typeof raw!=='string'||!raw)return {items:Array(RACK_COMPARTMENTS).fill(null),filters:normalizeRackFilters([])};
 try{
  const data=JSON.parse(raw),items=Array(RACK_COMPARTMENTS).fill(null);
  for(let i=0;i<RACK_COMPARTMENTS;i++)items[i]=decodeRackStack(data?.items?.[i]);
  return {items,filters:normalizeRackFilters(data?.filters)};
 }catch{return {items:Array(RACK_COMPARTMENTS).fill(null),filters:normalizeRackFilters([])}}
}

export function readRackPayloadItem(stack){
 try{return decodeRackPayload(getItemProperty(stack,RACK_PAYLOAD_KEY))}catch{return decodeRackPayload(undefined)}
}

export function writeRackPayloadItem(stack,items,filters){
 if(!stack)return stack;
 try{setItemProperty(stack,RACK_PAYLOAD_KEY,encodeRackPayload(items,filters))}catch{}
 try{
  const lore=[{translate:'tooltip.kaleidoscope_grilling.advanced_rack.saved_contents'}];
  for(let i=0;i<RACK_COMPARTMENTS&&lore.length<10;i++){
   const item=items?.[i];if(!item)continue;
   lore.push({rawtext:[{text:'§8- '+(i+1)+': §7'},{translate:item.localizationKey},{text:' ×'+item.amount}]});
  }
  setItemLore(stack,lore);
 }catch{}
 return stack;
}
