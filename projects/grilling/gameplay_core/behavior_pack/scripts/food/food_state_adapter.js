import {getItemProperty,setItemProperty,getItemPropertyIds,getItemLore,getItemRawLore,setItemLore} from '../core/persist.js';
import {world,system} from '@minecraft/server';
import {SEASONING_LIST_KEY,normalizeSeasoningList} from '../seasoning/seasoning_contract_core.js';
import {readRawFoodLore,isHeatLore,applyFoodMaxim} from '../hud/food_tooltip_core.js';
import '../hud/food_tooltip_runtime.js';
import {heatLore,secretStageLore,isSecretStageLore} from '../localized_lore_core.js';
import {canonicalFoodId} from '../eating_profile_ids.js';
import {metadataSignature} from '../skewer_item_snapshot.js';
import {readPublicFood,writePublicFood,isFoodPayloadLine,FOOD_PAYLOAD_KEY,bucketHotUntil,publicFoodLoreRows} from '../host_api/food_api_core.js';
import {cuisineQualityOfItem,cuisineQualityPayloadMatches,validCuisineQuality} from '../host_api/cuisine_quality_core.js';
import {PERSISTED_KEY as PersistedKey} from '../core/persist_keys.js';
import {needsSecretGuiCache,refreshSecretGuiCache} from '../secret_gui_state.js';

export const HOT_UNTIL_KEY=PersistedKey.HOT_UNTIL;
function now(){try{return Number(world.getAbsoluteTime())||system.currentTick}catch{return system.currentTick}}
export function readFoodQuality(stack){
 const portable=readPublicFood(stack);
 return cuisineQualityPayloadMatches(stack?.typeId,portable)&&portable.valid?portable.state.quality:undefined;
}
export function setFoodQuality(stack,quality){
 if(!stack||!validCuisineQuality(quality)||cuisineQualityOfItem(stack.typeId)!==quality)throw Error('cuisine quality/native item mismatch');
 const portable=readPublicFood(stack);if(portable.present&&!portable.valid)throw Error('public food unreadable');
 const state=portable.valid?portable.state:{v:1,hotUntil:hotUntil(stack),seasoning:readFoodSeasonings(stack)};
 if(state.quality!==undefined&&state.quality!==quality)throw Error('cuisine quality already owned');
 writePublicFood(stack,{...state,quality});return stack;
}
export function readFoodSeasonings(stack){
 const portable=readPublicFood(stack);if(portable.present)return portable.valid?normalizeSeasoningList(portable.state.seasoning):[];
 try{
  const raw=getItemProperty(stack,SEASONING_LIST_KEY);
  return typeof raw==='string'?normalizeSeasoningList(JSON.parse(raw)):[];
 }catch{return []}
}
export function setFoodSeasonings(stack,list){
 if(!stack)return stack;
 try{
  const values=normalizeSeasoningList(list);
  const portable=readPublicFood(stack);if(portable.present){if(!portable.valid)throw Error('public food unreadable');writePublicFood(stack,{...portable.state,seasoning:values});}
  setItemProperty(stack,SEASONING_LIST_KEY,values.length?JSON.stringify(values):undefined);
 }catch{}
 return stack;
}
export function hotUntil(stack){const p=readPublicFood(stack);if(p.present)return p.valid?p.state.hotUntil:0;try{return Number(getItemProperty(stack,HOT_UNTIL_KEY)??0)}catch{return 0}}
export function isHotFood(stack){return hotUntil(stack)>now()}
function foodProperties(stack){return getItemPropertyIds(stack).sort().map(key=>[key,getItemProperty(stack,key)])}
function withSecretStage(stack,lore,hot,reserved=0){
 if(canonicalFoodId(stack?.typeId)!=='kaleidoscope_grilling:secret_skewer')return lore;
 const base=lore.filter(line=>!isSecretStageLore(line));
 if(!hot&&base.length<(stack.maxAmount>1?19:20)-reserved){
  // writePublicFood appends its carrier. Keep the badge before it in both cold
  // refresh and heat-expiry paths, avoiding a second cosmetic item rewrite.
  const publicIndex=base.findIndex(isFoodPayloadLine);
  base.splice(publicIndex<0?base.length:publicIndex,0,secretStageLore(getItemProperty(stack,PersistedKey.SECRET_COOKED)===true));
 }
 return base;
}
export function needsColdSecretTooltip(stack){
 if(canonicalFoodId(stack?.typeId)!=='kaleidoscope_grilling:secret_skewer'||hotUntil(stack)>0)return false;
 const lore=getItemRawLore(stack);
 return metadataSignature(lore)!==metadataSignature(withSecretStage(stack,lore,false))||needsSecretGuiCache(stack);
}
function clearExpiredHeat(stack,base){
 const portable=readPublicFood(stack);if(portable.present&&!portable.valid)return stack;
 // Stackable records are immutable: restoring their exact raw carrier restores
 // all private data. Native stacks additionally need their old heat property.
 const before=stack.getRawLore(),beforeLore=metadataSignature(before),properties=foodProperties(stack);
 const beforeData=metadataSignature(properties),priorHot=properties.find(([key])=>key===HOT_UNTIL_KEY)?.[1];
 const expectedData=metadataSignature(properties.filter(([key])=>key!==HOT_UNTIL_KEY));
 // The public carrier is reinserted below, in addition to the private carrier.
 const clean=withSecretStage(stack,base.filter(line=>!isFoodPayloadLine(line)),false,portable.valid?1:0),cold=portable.valid?{...portable.state,hotUntil:0}:undefined;
 const expectedLore=metadataSignature(cold?publicFoodLoreRows(clean,cold):clean);
 try{
  setItemProperty(stack,HOT_UNTIL_KEY,undefined);
  setItemLore(stack,clean);
  if(cold)writePublicFood(stack,cold);
  if(metadataSignature(getItemRawLore(stack))!==expectedLore||metadataSignature(foodProperties(stack))!==expectedData||hotUntil(stack)!==0)throw Error('expired heat metadata readback');
 }catch(error){
  // Independent restoration attempts and readback handle synchronous write
  // faults, including a setter that applies its write before throwing. This is
  // not an atomic write or a crash-recovery protocol.
  if(stack.maxAmount<=1)try{stack.setDynamicProperty(HOT_UNTIL_KEY,priorHot)}catch{}
  try{stack.setLore(before)}catch{}
  let restored=false;
  try{restored=metadataSignature(stack.getRawLore())===beforeLore&&metadataSignature(foodProperties(stack))===beforeData}catch{}
  if(!restored)throw Error('Grilling expired heat rollback unverified: '+String(error));
 }
 return stack;
}
function refreshHeatLore(stack){
 if(!stack)return stack;
 const until=hotUntil(stack);
 if(until<=0){
  if(canonicalFoodId(stack.typeId)==='kaleidoscope_grilling:secret_skewer')try{
   const lore=getItemRawLore(stack),next=withSecretStage(stack,lore,false);
   if(metadataSignature(lore)!==metadataSignature(next))setItemLore(stack,next);
  }catch{}
  return stack;
 }
 let base;
 try{base=getItemRawLore(stack).filter(line=>!isHeatLore(line))}catch{return stack}
 const left=Math.max(0,until-now());
 // Do not swallow an unverified expiry rollback: callers must not persist a
 // damaged working copy after its public seasoning/variant record was removed.
 if(left<=0)return clearExpiredHeat(stack,base);
 try{
  base=withSecretStage(stack,base,true);
  const sec=Math.max(1,Math.ceil(left/20));
  // A full custom lore is not permission to discard a user's line.
  if(base.length>=(stack.maxAmount>1?19:20))return stack;
  base.push(heatLore(sec));setItemLore(stack,base);
 }catch{}
 return stack;
}
export function refreshHotLore(stack){
 return refreshSecretGuiCache(refreshHeatLore(stack));
}
export function setHotFood(stack,ticks){
 if(!stack||!Number.isFinite(ticks)||ticks<=0)return stack;
 let before,priorHot;
 try{
  const portable=readPublicFood(stack);if(portable.present&&!portable.valid)return stack;
  before=stack.getRawLore();priorHot=getItemProperty(stack,HOT_UNTIL_KEY);
  const time=now(),until=bucketHotUntil(time+Math.max(1,Math.floor(ticks)));
  const left=Math.max(0,until-time),sec=Math.ceil(left/20);
  const lore=withSecretStage(stack,getItemRawLore(stack).filter(line=>!isHeatLore(line)),true);
  // Stackable metadata needs a carrier. A cosmetic badge must not consume its line.
  const limit=stack.maxAmount>1?19:20;
  if(lore.length>limit)return stack;
  if(left>0&&lore.length<limit)lore.push(heatLore(sec));
  setItemLore(stack,lore);
  setItemProperty(stack,HOT_UNTIL_KEY,until);
  if(portable.valid)writePublicFood(stack,{...portable.state,hotUntil:until});
 }catch{
  // Restore the original carrier or native property after any partial write.
  if(before)try{if(stack.maxAmount<=1)stack.setDynamicProperty(HOT_UNTIL_KEY,priorHot);stack.setLore(before)}catch{}
 }
 return stack;
}
export function applyFoodMetadata(stack,{seasoning=[],hotTicks=0,quality}={}){
 if(!stack)return stack;
 if(quality!==undefined)setFoodQuality(stack,quality);
 // Customize before writing dynamic properties; all cuisine outputs retain their
 // original hot duration. A tooltip failure must not suppress gameplay metadata.
 setHotFood(stack,hotTicks);setFoodSeasonings(stack,seasoning);
 try{applyFoodMaxim(stack)}catch{}
 return stack;
}
