import {getItemProperty,setItemProperty,getItemPropertyIds,getItemRawLore,setItemLore} from '../itemData.js';
import {SEASONING_LIST_KEY} from '../seasoning/seasoning_contract_core.js';
import {heatLore,isHeatLore,creatorLore} from '../localized_lore_core.js';
import {SECRET_CREATOR_KEY} from './skewering_core.js';
import {world} from '@minecraft/server';
import {readPublicFood,writePublicFood,isFoodPayloadLine,bucketHotUntil} from '../host_api/food_api_core.js';
import {weightedHeat,NORMAL_HEAT_WINDOW} from './hot_merge.js';
import {commitSteps} from '../grill/grill_transaction_core.js';

const HOT='kaleidoscope_grilling:hot_until';
const IGNORE=new Set([
 HOT,SEASONING_LIST_KEY,'kaleidoscope_grilling:model_variants','SkewerModelVariants',SECRET_CREATOR_KEY
]);
function now(){try{return world.getAbsoluteTime()}catch{return 0}}
function norm(v){
 if(v===undefined)return null;
 if(typeof v==='number'||typeof v==='string'||typeof v==='boolean'||v===null)return v;
 if(Array.isArray(v))return v.map(norm);
 if(typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,norm(v[k])]));
 return String(v);
}
function baseLore(stack){return getItemRawLore(stack).filter(x=>!isHeatLore(x)&&!isFoodPayloadLine(x))}
export function withoutAutomaticCreatorLore(stack,lore=getItemRawLore(stack)){
 const kept=[...lore];let creator;
 try{creator=JSON.parse(getItemProperty(stack,SECRET_CREATOR_KEY))}catch{return kept}
 if(typeof creator?.name!=='string'||typeof creator?.id!=='string')return kept;
 const translated=JSON.stringify(norm(creatorLore(creator.name))),literal='§7製作者: '+creator.name;
 const legacyMessage=JSON.stringify({text:literal});let removedTranslated=false,removedLegacy=false;
 // Threading writes one translated line; older recipe-book crafting writes a
 // literal line. Only exact lines for the recorded author are ours to remove.
 // Return a copy so merge comparison never changes the target author's lore.
 for(let i=kept.length-1;i>=0;i--){
  const signature=JSON.stringify(norm(kept[i]));
  if(!removedTranslated&&signature===translated){kept.splice(i,1);removedTranslated=true;}
  else if(!removedLegacy&&(kept[i]===literal||signature===legacyMessage)){kept.splice(i,1);removedLegacy=true;}
 }
 return kept;
}
function mergeLore(stack){return withoutAutomaticCreatorLore(stack,baseLore(stack))}
function props(stack,includeHot=false){
 let ids=[];try{ids=getItemPropertyIds(stack)}catch{}
 return ids.filter(k=>includeHot||!IGNORE.has(k)).sort().map(k=>{let v;try{v=getItemProperty(stack,k)}catch{}return [k,norm(v)]});
}
export function isSkewer(stack){
 if(!stack)return false;
 if(stack.typeId.startsWith('kaleidoscope_grilling:')&&(stack.typeId.includes('skewer')||stack.typeId==='kaleidoscope_grilling:dark_grilling'))return true;
 try{return stack.hasTag?.('kaleidoscope_grilling:raw_skewers')||stack.hasTag?.('kaleidoscope_grilling:grilled_skewers')}catch{return false}
}
export function isFoodStack(stack){
 if(!stack)return false;
 try{if(stack.getComponent?.('minecraft:food'))return true}catch{}
 try{if(stack.hasTag?.('minecraft:is_food'))return true}catch{}
 return isSkewer(stack);
}
function legacySeasoningSignature(stack){
 const raw=getItemProperty(stack,SEASONING_LIST_KEY);
 if(raw===undefined)return [];
 // setFoodSeasonings writes JSON, not a native array. Preserve order and repeats;
 // malformed/foreign bytes must not become the same signature as plain food.
 if(typeof raw==='string')try{
  const list=JSON.parse(raw);
  if(Array.isArray(list)&&list.every(value=>typeof value==='string'))return list;
 }catch{}
 return {legacyUnparsed:norm(raw)};
}
export function mergeSignature(stack){
 const publicFood=readPublicFood(stack);
 // A damaged public record must never merge into another stack. Preserve its raw bytes.
 const seasoning=publicFood.present?(publicFood.valid?publicFood.state.seasoning:{invalid:stack.getRawLore()}):legacySeasoningSignature(stack);
 return JSON.stringify({type:stack?.typeId??'',name:stack?.nameTag??'',lore:mergeLore(stack),seasoning,nativeVariant:publicFood.valid?publicFood.state.nativeVariant:undefined,quality:publicFood.valid?publicFood.state.quality:undefined,props:props(stack,false)});
}
export function sameForHeatMerge(a,b){return !!a&&!!b&&mergeSignature(a)===mergeSignature(b)}
export function hotUntil(stack){const p=readPublicFood(stack);if(p.present)return p.valid?p.state.hotUntil:0;try{return Number(getItemProperty(stack,HOT)??0)}catch{return 0}}
export function isHot(stack,t=now()){return hotUntil(stack)>t}
const bucket=bucketHotUntil; // Java setHot quantizes the absolute deadline.
function setHot(stack,remaining,t=now()){
 const before=stack.getRawLore(),priorHot=getItemProperty(stack,HOT);
 try{
  const portable=readPublicFood(stack);if(portable.present&&!portable.valid)throw Error('public food unreadable');
  const lore=baseLore(stack),until=remaining>0?bucket(t+remaining):0,left=Math.max(0,until-t);
  const limit=(stack.maxAmount>1?19:20)-(portable.valid?1:0);
  if(lore.length>limit)throw Error('heat metadata has no lore space');
  if(left>0&&lore.length<limit)lore.push(heatLore(Math.ceil(left/20)));
  setItemLore(stack,lore);
  setItemProperty(stack,HOT,remaining>0?until:undefined);
  if(portable.valid)writePublicFood(stack,{...portable.state,hotUntil:until});
  if(hotUntil(stack)!==until)throw Error('heat metadata readback');
 }catch(error){
  try{if(stack.maxAmount<=1)stack.setDynamicProperty(HOT,priorHot);stack.setLore(before)}catch{}
  throw error;
 }
 return stack;
}
function moveCount(target,source,moved,t=now()){
 const tc=target.amount,sc=source.amount,th=Math.max(0,hotUntil(target)-t),sh=Math.max(0,hotUntil(source)-t);
 const bothHot=th>0&&sh>0;
 if(bothHot)setHot(target,weightedHeat(th,tc,sh,moved),t);
 target.amount=tc+moved;
 if(moved>=sc)return undefined;
 const remain=source.clone();remain.amount=sc-moved;return remain;
}
export function canManualMerge(a,b,t=now()){
 if(!sameForHeatMerge(a,b))return false;
 return isHot(a,t)===isHot(b,t);
}
export function mergeIntoContainer(container,incoming,t=now(),strict=false){
 if(!incoming)return undefined;
 let before;
 try{
  before=Array.from({length:container.size},(_,i)=>container.getItem(i)?.clone());
  let remaining=incoming.clone();
  for(let i=0;i<container.size;i++){
   const target=container.getItem(i);if(!target||!canManualMerge(target,remaining,t))continue;
   const capacity=Math.max(0,target.maxAmount-target.amount);if(capacity<=0)continue;
   const moved=Math.min(capacity,remaining.amount);remaining=moveCount(target,remaining,moved,t);container.setItem(i,target);
   if(!remaining)return undefined;
  }
  return container.addItem(remaining);
 }catch(error){
  // Native writes may fail after crediting part of the output. Restore every
  // affected slot before returning the original remainder or propagating failure.
  let rollbackErrors=0;
  if(before)for(let i=0;i<before.length;i++)try{container.setItem(i,before[i])}catch{rollbackErrors++}
  if(rollbackErrors)throw new Error('Grilling output delivery unresolved; rollback failed for '+rollbackErrors+' writes: '+error);
  if(strict)throw error;
  return incoming.clone();
 }
}
export function compactMatchingHotFood(container,sample,t=now()){
 if(!container||!sample||!isFoodStack(sample)||!isHot(sample,t))return {changed:false,count:0,stacks:0};
 const signature=mergeSignature(sample),slots=[];let rep=null,totalCount=0,totalHeat=0;
 for(let slot=0;slot<container.size;slot++){
  const stack=container.getItem(slot);
  if(!stack||!isFoodStack(stack)||!isHot(stack,t)||mergeSignature(stack)!==signature)continue;
  slots.push({slot,before:stack.clone()});if(!rep)rep=stack.clone();
  totalCount+=stack.amount;totalHeat+=Math.max(0,hotUntil(stack)-t)*stack.amount;
 }
 if(slots.length<2||!rep||totalCount<2)return {changed:false,count:totalCount,stacks:slots.length};
 const avg=Math.floor(totalHeat/totalCount),out=[];let left=totalCount;
 while(left>0){const stack=rep.clone(),count=Math.min(stack.maxAmount,left);if(count<=0)throw Error('Invalid food stack capacity');stack.amount=count;setHot(stack,avg,t);if(hotUntil(stack)!==bucket(t+avg))throw Error('Merged heat was not saved');out.push(stack);left-=count}
 if(out.length>slots.length)return {changed:false,count:totalCount,stacks:slots.length};
 const committed=commitSteps(slots.map(({slot,before},i)=>({apply(){container.setItem(slot,out[i]);},rollback(){container.setItem(slot,before);}})));
 if(!committed.ok)return {changed:false,count:totalCount,stacks:slots.length,failed:true,rollbackErrors:committed.rollbackErrors};
 return {changed:true,count:totalCount,stacks:out.length};
}
function normalCompatible(rep,stack,t){
 if(!sameForHeatMerge(rep,stack))return false;
 const rh=Math.max(0,hotUntil(rep)-t),sh=Math.max(0,hotUntil(stack)-t);
 if((rh>0)!==(sh>0))return false;
 if(rh<=0)return true;
 return Math.abs(rh-sh)<=NORMAL_HEAT_WINDOW;
}
export function compactSkewerContainer(container,fullSort=false,t=now(),onlyType=undefined){
 const groups=[],originals=[];
 // Plan and construct everything before the first inventory mutation.
 for(let slot=0;slot<container.size;slot++){
  const stack=container.getItem(slot);if(!stack||!isSkewer(stack)||(onlyType&&stack.typeId!==onlyType))continue;
  originals.push({slot,stack:stack.clone()});
  let group=groups.find(g=>fullSort?sameForHeatMerge(g.rep,stack):normalCompatible(g.rep,stack,t));
  if(!group){group={rep:stack.clone(),count:0,totalHeat:0};groups.push(group)}
  group.count+=stack.amount;group.totalHeat+=Math.max(0,hotUntil(stack)-t)*stack.amount;
 }
 if(!groups.length)return {changed:false,groups:0,stacks:0};
 const out=[];
 for(const g of groups){
  const avg=g.count?Math.floor(g.totalHeat/g.count):0;let left=g.count;
  while(left>0){
   const stack=g.rep.clone(),count=Math.min(stack.maxAmount,left);
   if(count<=0)throw new Error('Grilling: invalid stack capacity');
   stack.amount=count;setHot(stack,avg,t);
   const expected=avg>0?bucket(t+avg):0;
   if(hotUntil(stack)!==expected)throw new Error('Grilling: merged heat was not saved');
   out.push(stack);left-=count;
  }
 }
 if(out.length>originals.length)throw new Error('Grilling: compaction cannot fit without replacing unrelated slots');
 const result=commitSteps(originals.map(({slot,stack},i)=>({
  apply(){container.setItem(slot,out[i])},rollback(){container.setItem(slot,stack)}
 })));
 if(!result.ok){
  console.warn('[Grilling hot merge] '+String(result.error)+'; rollback failures='+result.rollbackErrors);
  return {changed:false,groups:groups.length,stacks:originals.length,failed:true,rollbackErrors:result.rollbackErrors};
 }
 return {changed:true,groups:groups.length,stacks:out.length};
}

/** Legacy #84 API delegates to the same #82 planner; commit the complete plan once. */
export function compactHotFoodContainer(container,t=now(),onlyType){
 const originals=Array.from({length:container.size},(_,i)=>container.getItem(i)?.clone());
 const planned=originals.map(x=>x?.clone()),seen=new Set();let groups=0,changed=false;
 const view={size:container.size,getItem:i=>planned[i]?.clone(),setItem:(i,s)=>{planned[i]=s?.clone();}};
 for(const sample of originals){
  if(!sample||(onlyType&&sample.typeId!==onlyType)||!isHot(sample,t))continue;
  const signature=mergeSignature(sample);if(seen.has(signature))continue;seen.add(signature);groups++;
  // The legacy API's explicit onlyType was already checked by its caller.
  const food=sample.getComponent?.('minecraft:food')||isFoodStack(sample);
  if(!food&&!onlyType)continue;
  const result=compactMatchingHotFood(view,sample,t);changed=changed||result.changed;
  if(result.failed)return {...result,groups};
 }
 if(!changed)return {changed:false,groups,stacks:planned.filter(Boolean).length};
 const result=commitSteps(originals.map((before,i)=>({apply(){container.setItem(i,planned[i]);},rollback(){container.setItem(i,before);}})));
 return {changed:result.ok,groups,stacks:(result.ok?planned:originals).filter(Boolean).length,...(!result.ok?{failed:true,rollbackErrors:result.rollbackErrors}:{})};
}
