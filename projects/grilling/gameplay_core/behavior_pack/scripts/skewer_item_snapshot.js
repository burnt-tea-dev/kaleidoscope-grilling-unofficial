import {canonicalFoodId} from './eating_profile_ids.js';
import {canonicalLoreForComparison} from './bottle_lore_core.js';
// Versioned, fail-closed projection of metadata exposed by the stable ItemStack API.
// This is not a serializer for inaccessible Java NBT or other packs' private data.
import {getItemProperty,getItemPropertyIds,setItemProperty,getItemRawLore,setItemLore} from './itemDataCore.js';

function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
 return value;
}
export function metadataSignature(value){
 // ItemStack may return equivalent RawMessages in different legal wrappers.
 // Reuse the bottle codec's bounded rules ONLY for the snapshot's lore field;
 // opaque properties, mixed messages and every other datum remain exact.
 const comparable=value&&typeof value==='object'&&!Array.isArray(value)&&Array.isArray(value.rawLore)
  ?{...value,rawLore:canonicalLoreForComparison(value.rawLore)}:value;
 return JSON.stringify(stable(comparable));
}
function clone(value){return JSON.parse(JSON.stringify(value));}
function property(value){
 if(typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))return value;
 if(value&&typeof value==='object'&&['x','y','z'].every(k=>Number.isFinite(value[k])))return {x:value.x,y:value.y,z:value.z};
 throw Error('Grilling: unsupported ingredient property');
}
export function captureSkewerMetadata(stack){
 if(!stack?.typeId)throw Error('Grilling: missing ingredient');
 const props={};for(const key of getItemPropertyIds(stack))props[key]=property(getItemProperty(stack,key));
 const durability=stack.getComponent('minecraft:durability');
 const enchantable=stack.getComponent('minecraft:enchantable');
 const data={version:1,id:stack.typeId};
 const rawLore=clone(getItemRawLore(stack)),canDestroy=[...stack.getCanDestroy()],canPlaceOn=[...stack.getCanPlaceOn()];
 const enchantments=(enchantable?.getEnchantments()??[]).map(e=>({id:e.type.id,level:e.level})).sort((a,b)=>a.id.localeCompare(b.id));
 if(stack.nameTag)data.name=stack.nameTag;
 if(rawLore.length)data.rawLore=rawLore;
 if(Object.keys(props).length)data.props=props;
 if(stack.keepOnDeath)data.keepOnDeath=true;
 if(stack.lockMode&&stack.lockMode!=='none')data.lockMode=stack.lockMode;
 if(canDestroy.length)data.canDestroy=canDestroy;
 if(canPlaceOn.length)data.canPlaceOn=canPlaceOn;
 if(enchantments.length)data.enchantments=enchantments;
 if(durability?.damage)data.damage=durability.damage;
 return data;
}
export function restoreSkewerMetadata(data,createStack,enchantmentType){
 if(data?.version!==1||typeof data.id!=='string')throw Error('Grilling: unsupported ingredient snapshot');
 const stack=createStack(data.id,1);
 stack.nameTag=data.name||undefined;setItemLore(stack,clone(data.rawLore??[]));
 stack.keepOnDeath=data.keepOnDeath??false;stack.lockMode=data.lockMode??'none';
 stack.setCanDestroy(data.canDestroy??[]);stack.setCanPlaceOn(data.canPlaceOn??[]);
 if(data.damage!==undefined){
  const component=stack.getComponent('minecraft:durability');
  if(!component)throw Error('Grilling: ingredient durability unavailable');
  component.damage=data.damage;
 }
 if(data.enchantments?.length){
  const component=stack.getComponent('minecraft:enchantable');
  if(!component)throw Error('Grilling: ingredient enchantments unavailable');
  component.removeAllEnchantments();
  component.addEnchantments(data.enchantments.map(e=>({type:enchantmentType(e.id),level:e.level})));
 }
 for(const [key,value] of Object.entries(data.props??{}))setItemProperty(stack,key,property(value));
 if(metadataSignature(captureSkewerMetadata(stack))!==metadataSignature(data))throw Error('Grilling: ingredient metadata readback differs');
 return stack;
}

// Legacy rows have no native envelope; normalize defaults so upgrade alone does
// not remove Java's repeated-ingredient penalty from otherwise identical food.
export function ingredientContentSignature(row){
 if(!row?.native&&!('name' in (row??{}))&&!('lore' in (row??{}))&&!('props' in (row??{})))return String(canonicalFoodId(row?.signature??row?.id??''));
 const n=row.native??{};
 return metadataSignature({id:canonicalFoodId(row.id),name:n.name??row.name??'',
  rawLore:(n.rawLore??row.lore??[]).map(x=>typeof x==='string'?{text:x}:x),props:n.props??row.props??{},
  damage:n.damage??0,enchantments:n.enchantments??[],keepOnDeath:n.keepOnDeath??false,
  lockMode:n.lockMode??'none',canDestroy:n.canDestroy??[],canPlaceOn:n.canPlaceOn??[]});
}
