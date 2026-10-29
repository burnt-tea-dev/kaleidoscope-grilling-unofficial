import {getWorldProperty,setWorldProperty} from '../core/persist.js';
/** Copied only into the hash-verified Cookery 1.6 host. No new event loop. */
import {world,ItemStack,GameMode} from '@minecraft/server';
import {wokRecipes,flexWokRecipes} from '../food/wok_food_core.js';
import {evaluateCuisineQuality} from './cuisine_quality_core.js';
import {PERSISTED_KEY as PersistedKey} from '../core/persist_keys.js';
import {commitSharedStationOil} from './oil_api_host.js';
import {nextCuisineBatch,consumeCuisineCarrier,giveCuisineOutput,deliverCuisineOutput,recoverCuisineOutput,prepareCuisineBurn,assertCuisineBatchUncredited} from './cuisine_api_host.js';
import {newJavaPot,readJavaPot,reviseJavaPot,paddedPotInputs,potIngredientSlots,selectJavaPotRecipe,startJavaPot,stirJavaPot,advanceJavaPot} from './pot_api_core.js';

export const JAVA_POT_CAPABILITIES=Object.freeze(['grilling_pot_exact_flex_v1']);
const EXACT=wokRecipes(),FLEX=flexWokRecipes(),OWN_INGREDIENTS=new Set(EXACT.flatMap(recipe=>recipe.ingredients));
const journalKey=b=>PersistedKey.JAVA_POT_OPERATION_PREFIX+b.dimension.id+':'+b.x+','+b.y+','+b.z;
const rawOf=data=>Object.keys(data).length?JSON.stringify(data):undefined;
const copy=value=>JSON.parse(JSON.stringify(value));
const item=slot=>slot?.hasItem()?slot.getItem():undefined;
const failures=new Set();
function retain(b,error){
 const k=journalKey(b),reason=String(error);if(!failures.has(k+':'+reason)){failures.add(k+':'+reason);console.warn('[Cookery Java pot] retained '+k+' '+reason);}
}
function readStation(b,host){
 const raw=host.raw(b);if(raw===undefined)return {raw,data:{}};
 if(typeof raw!=='string')throw Error('station source unreadable');
 const data=JSON.parse(raw);
 if(!data||typeof data!=='object'||Array.isArray(data)||!Object.keys(data).length)throw Error('station source invalid');
 return {raw,data};
}
function readJournal(b){
 const raw=getWorldProperty(world,journalKey(b));if(raw===undefined)return undefined;
 if(typeof raw!=='string')throw Error('pot operation journal unreadable');
 const r=JSON.parse(raw);
 if(!r||r.version!==1||typeof r.kind!=='string'||!['prepared','debited','committed','rolled_back','quarantined'].includes(r.phase)
  ||!(r.before===null||typeof r.before==='string')||!(r.after===null||typeof r.after==='string'))throw Error('pot operation journal invalid');
 return r;
}
function requireSettled(b){
 const r=readJournal(b);if(r&&!['committed','rolled_back'].includes(r.phase))throw Error('pot operation requires recovery');
}
function writeJournal(b,r){
 const raw=JSON.stringify(r);if(raw.length>30000)throw Error('pot operation journal too large');
 let failure;try{setWorldProperty(world,journalKey(b),raw)}catch(error){failure=error}
 if(getWorldProperty(world,journalKey(b))!==raw)throw failure??Error('pot operation journal readback');
}
function terminal(b,r,phase){r.phase=phase;try{writeJournal(b,r)}catch(error){retain(b,error);}}
function begin(b,snapshot,next,kind,extra={}){
 requireSettled(b);const r={version:1,kind,phase:'prepared',before:snapshot.raw??null,after:rawOf(next)??null,...extra};writeJournal(b,r);return r;
}
function saveExact(b,host,before,next,onWrite){
 if(host.raw(b)!==before)throw Error('pot saved owner changed');
 const expected=rawOf(next);let failure;try{onWrite?.();host.save(b,next)}catch(error){failure=error}
 if(host.raw(b)!==expected)throw failure??Error('pot state save readback');
}
function show(b,host,data){try{host.sync(b,data);host.display(b,data)}catch(error){retain(b,'visual '+error)}}
function savePhase(b,host,snapshot,next,kind){
 const r=begin(b,snapshot,next,kind);
 try{saveExact(b,host,snapshot.raw,next)}catch(error){
  try{terminal(b,r,host.raw(b)===snapshot.raw?'rolled_back':'quarantined')}catch{terminal(b,r,'quarantined')}
  throw error;
 }
 terminal(b,r,'committed');show(b,host,next);return next;
}
function nativeFields(stack){
 if(!stack)return null;
 const d=stack.getComponent('minecraft:durability'),e=stack.getComponent('minecraft:enchantable');
 const props={};if(stack.maxAmount===1)for(const k of [...stack.getDynamicPropertyIds()].sort())props[k]=stack.getDynamicProperty(k);
 return {id:stack.typeId,amount:stack.amount,name:stack.nameTag??'',lore:stack.getRawLore(),keepOnDeath:stack.keepOnDeath,lockMode:stack.lockMode,
  canDestroy:stack.getCanDestroy(),canPlaceOn:stack.getCanPlaceOn(),props,
  ...(d?{damage:d.damage,maxDurability:d.maxDurability}:{}),
  enchantments:(e?.getEnchantments()??[]).map(x=>({id:x.type.id,level:x.level})).sort((a,b)=>a.id.localeCompare(b.id))};
}
function sameItem(actual,expected,{ownership=false}={}){
 if(JSON.stringify(nativeFields(actual))!==JSON.stringify(nativeFields(expected)))return false;
 if(!expected)return true;
 // Nonstackable clones preserve hidden data on normal writes. Their equality
 // cannot authorize compensation, because native stackability is always false.
 if(expected.isStackableWith(expected.clone()))return actual.isStackableWith(expected);
 return !ownership;
}
function writeHand(slot,next){
 let failure;try{slot.setItem(next)}catch(error){failure=error}
 if(!sameItem(item(slot),next))throw failure??Error('pot hand readback');
}
function removeOne(stack){if(stack.amount===1)return undefined;const next=stack.clone();next.amount--;return next;}
/** Reject unsupported item metadata before consuming it or serializing plain IDs. */
function plainIngredient(stack){
 if(!stack||stack.maxAmount<2)return false;
 const one=stack.clone();one.amount=1;return one.isStackableWith(new ItemStack(stack.typeId,1));
}
function handAndState(b,p,host,snapshot,next,after,kind,{mutate=true,expected}={}){
 const slot=host.slot(p),before=expected?.clone();if(!slot||!expected)throw Error('pot hand unavailable');
 const r=begin(b,snapshot,next,kind,{owner:p.id,handBefore:nativeFields(before),handAfter:nativeFields(after)});
 let handAttempted=false,stationAttempted=false;
 try{
  if(host.raw(b)!==snapshot.raw||!sameItem(item(slot),before))throw Error('pot operation owner changed');
  if(mutate){handAttempted=true;writeHand(slot,after);}
  r.phase='debited';writeJournal(b,r);saveExact(b,host,snapshot.raw,next,()=>{stationAttempted=true});
 }catch(error){
  let stateRestored=false,unknown=false;
  // A station that may still own the inserted item/oil MUST retain its debit.
  // Only acknowledged restoration of the saved preimage authorizes a refund.
  try{
   const raw=host.raw(b);
   if(raw===snapshot.raw)stateRestored=true;
   else if(stationAttempted&&raw===rawOf(next)){saveExact(b,host,raw,snapshot.data);stateRestored=host.raw(b)===snapshot.raw;}
  }catch{}
  if(!stateRestored)unknown=true;
  if(stateRestored&&handAttempted)try{
   const actual=item(slot);if(!sameItem(actual,before,{ownership:true})){
    if(!sameItem(actual,after,{ownership:true}))throw Error('pot hand rollback ownership');
    writeHand(slot,before);if(!sameItem(item(slot),before,{ownership:true}))throw Error('pot hand rollback readback');
   }
  }catch{unknown=true}
  terminal(b,r,unknown?'quarantined':'rolled_back');throw error;
 }
 terminal(b,r,'committed');show(b,host,next);return next;
}
function freshData(epoch,type='default'){
 return {oil:true,oilTicks:1200,grillingOilType:type,items:[],started:false,grillingOutputEpoch:epoch,grillingPot:newJavaPot(epoch)};
}
function simpleOilShovel(stack){
 // The two author IDs encode one tool's oil flag. This adapter preserves exposed
 // metadata/durability; arbitrary inaccessible NBT is not a claimed capability.
 const row=nativeFields(stack),next=new ItemStack('kaleidoscope_cookery:kitchen_shovel',stack.amount);
 next.nameTag=stack.nameTag;next.setLore(row.lore);next.keepOnDeath=row.keepOnDeath;next.lockMode=row.lockMode;
 next.setCanDestroy(row.canDestroy);next.setCanPlaceOn(row.canPlaceOn);
 for(const [k,v] of Object.entries(row.props))next.setDynamicProperty(k,v);
 if(row.damage!==undefined){const d=next.getComponent('minecraft:durability');if(!d||d.maxDurability!==row.maxDurability)throw Error('oil shovel durability changed');d.damage=row.damage;}
 const old=stack.getComponent('minecraft:enchantable'),e=next.getComponent('minecraft:enchantable');
 if(row.enchantments.length){if(!e)throw Error('oil shovel enchantments unavailable');for(const enchantment of old.getEnchantments())e.addEnchantment(enchantment);}
 if(JSON.stringify(nativeFields(next))!==JSON.stringify({...row,id:next.typeId}))throw Error('oil shovel metadata readback');return next;
}
function placeFreshOil(b,p,host,snapshot,held){
 const id=held?.typeId??'';
 if(!host.hot(b)){host.notice(p,'wokHeat');return true;}
 if(id!=='kaleidoscope_cookery:oil'&&id!=='kaleidoscope_cookery:oil_pot_filled'&&id!=='kaleidoscope_cookery:kitchen_shovel_has_oil'){
  if(host.isOilContainer(id))return false;host.notice(p,'oil');return true;
 }
 const epoch=nextCuisineBatch(b),next=freshData(epoch),free=p.getGameMode()===GameMode.Creative;
 if(id==='kaleidoscope_cookery:oil_pot_filled'){
  const slot=host.slot(p),before=held.clone(),r=begin(b,snapshot,next,'oil_pot',{owner:p.id,handBefore:nativeFields(before)});
  try{
   if(host.raw(b)!==snapshot.raw||!sameItem(item(slot),before))throw Error('oil pot source changed');
   const data=copy(snapshot.data);
   const result=commitSharedStationOil(b,slot,data,{
    // Prepare only the owned payload. The shared transaction performs its own
    // owner precheck immediately before the direct station writer boundary.
    prepareState(value){
     value.oilTicks=1200;value.items=[];value.started=false;value.grillingOutputEpoch=epoch;value.grillingPot=newJavaPot(epoch);
     r.after=rawOf(value)??null;writeJournal(b,r);
    },
    save:host.save,raw:host.raw,sync:host.sync
   },{creative:free,ownerId:p.id});
   if(!result.ok)throw Error(result.reason??'oil pot debit unavailable');
   terminal(b,r,'committed');show(b,host,data);return true;
  }catch(error){
   try{terminal(b,r,host.raw(b)===snapshot.raw&&sameItem(item(slot),before,{ownership:true})?'rolled_back':'quarantined')}catch{terminal(b,r,'quarantined')}
   throw error;
  }
 }
 const after=free?held.clone():id==='kaleidoscope_cookery:oil'?removeOne(held):simpleOilShovel(held);
 handAndState(b,p,host,snapshot,next,after,'oil',{mutate:!free,expected:held});host.sound(p,'oil');return true;
}
function acceptedRecipes(host){
 const hostRecipes=host.recipes();
 const exact=EXACT.filter(own=>hostRecipes.some(row=>row.id===own.id&&row.result===own.result&&row.count===own.count
  // Original 1.6 normalizeWok always writes stirs:1. The saved Java phase owns
  // the separately sourced three-stir lifecycle; submitted stirs is discarded.
  &&row.carrier===own.carrier&&row.time===own.time&&row.stirs===1&&JSON.stringify(potIngredientSlots(row))===JSON.stringify(potIngredientSlots(own))));
 return {hostRecipes,exact,flex:FLEX.filter(row=>exact.some(accepted=>accepted.result===row.result))};
}
function selectionFor(data,host){
 const accepted=acceptedRecipes(host);if(accepted.exact.length!==EXACT.length)throw Error('Java pot recipe registration unavailable');
 const selected=selectJavaPotRecipe(data.items,accepted.exact,accepted.flex,accepted.hostRecipes);
 if(selected?.kind==='legacy')return {kind:'legacy',recipe:host.legacyRecipe(data.items)??selected.recipe};
 if(selected)return selected;
 const legacy=host.legacyRecipe(data.items);return legacy?{kind:'legacy',recipe:legacy}:undefined;
}
function startOrHandoff(data,host,{shovel=false}={}){
 const selection=selectionFor(data,host);
 if(selection?.kind==='legacy'){
  const next=copy(data),prior=next.grillingPot;
  next.grillingLegacyPot={version:1,epoch:prior.epoch,preparationRemaining:prior.ticksRemaining,recipeId:selection.recipe.id??'',reason:'unreviewed_author_recipe'};
  delete next.grillingPot;next.recipe=copy(selection.recipe);next.started=true;next.progress=0;next.stirs=shovel?1:0;next.flipGrace=0;return next;
 }
 let quality;
 if(selection?.kind==='flex'){
  quality=evaluateCuisineQuality({worldSeed:world.seed,recipeId:selection.recipe.javaId,ingredients:selection.recipe.ingredients,inputs:paddedPotInputs(data.items)});
  if(quality===undefined)throw Error('Java flex quality source unavailable');
 }
 const next=startJavaPot(data,selection,quality);return shovel?stirJavaPot(next):next;
}
function damagePlan(stack,free){
 if(free||Math.random()>=.25)return {mutate:false,next:stack.clone()};
 const next=stack.clone(),d=next.getComponent('minecraft:durability');if(!d)throw Error('shovel durability unavailable');
 const unbreaking=next.getComponent('minecraft:enchantable')?.getEnchantment('unbreaking')?.level??0;
 const chance=d.getDamageChance(unbreaking)/100;if(!Number.isFinite(chance)||chance<0||chance>1)throw Error('shovel damage chance unavailable');
 if(Math.random()>=chance)return {mutate:false,next};
 if(d.damage>=d.maxDurability-1)return {mutate:true,next:undefined,broken:true};d.damage++;return {mutate:true,next};
}
function giveRawInput(b,p,data,id,operationId){
 return deliverCuisineOutput(b,data,id,1,'pot_input',{operationId,nativeStack:new ItemStack(id,1),
  ...(p?{container:p.getComponent('minecraft:inventory')?.container,playerId:p.id,dropLocation:p.location}:{})});
}
function heatDamage(b,p,host){if(host.hot(b))try{p.applyDamage(1,{cause:'fire'})}catch(error){retain(b,'pot heat damage '+error)}}
function removeIngredient(b,p,host,snapshot){
 const data=snapshot.data,next=reviseJavaPot(data),id=next.items.pop(),operationId='input:'+data.grillingPot.epoch+':'+data.grillingPot.revision+':'+next.items.length;
 const r=begin(b,snapshot,next,'remove_ingredient',{operationId,owner:p.id});
 try{
  if(host.raw(b)!==snapshot.raw)throw Error('pot ingredient removal owner changed');
  giveRawInput(b,p,data,id,operationId);saveExact(b,host,snapshot.raw,next);terminal(b,r,'committed');show(b,host,next);
 }catch(error){terminal(b,r,'quarantined');throw error;}
 heatDamage(b,p,host);return true;
}
function takeResult(b,p,host,snapshot){
 const d=snapshot.data;consumeCuisineCarrier(b,p,d,'pot',d.result.carrier);giveCuisineOutput(b,p,d,d.result.id,1,'pot');
 // A failed clear can retry via the same G120 receipt without a new carrier or dish.
 saveExact(b,host,snapshot.raw,{});show(b,host,{});host.collect(p,d.result.id);return true;
}
function shovel(b,p,host,snapshot,held){
 const d=snapshot.data,state=readJavaPot(d);
 const next=state.phase==='preparing'&&d.items.length?startOrHandoff(d,host,{shovel:true}):stirJavaPot(d);
 const plan=damagePlan(held,p.getGameMode()===GameMode.Creative);
 handAndState(b,p,host,snapshot,next,plan.next,'shovel',{mutate:plan.mutate,expected:held});host.toss(b,p,plan.broken);return true;
}
export function handleJavaPotInteract(b,p,host){
 try{
  const snapshot=readStation(b,host),d=snapshot.data,held=host.held(p),id=held?.typeId??'';requireSettled(b);
  if(d.grillingPot===undefined){if(Object.keys(d).length||acceptedRecipes(host).exact.length!==EXACT.length)return false;return placeFreshOil(b,p,host,snapshot,held);}
  const state=readJavaPot(d);
  if(state.phase==='charcoal')return finishCharcoal(b,host,snapshot);
  if(state.phase==='finished'||state.phase==='burnt'){
   if(id===d.result.carrier)return takeResult(b,p,host,snapshot);
   if(!host.isShovel(id)){heatDamage(b,p,host);host.notice(p,'take',{item:d.result.carrier});return true;}
   if(!host.hot(b)){host.notice(p,'wokHeat');return true;}return shovel(b,p,host,snapshot,held);
  }
  if(state.phase==='preparing'&&(!id||host.isIngredientContainer(id))&&d.items.length)return removeIngredient(b,p,host,snapshot);
  if(state.phase==='preparing'&&acceptedRecipes(host).exact.length!==EXACT.length)return true;
  if(!host.hot(b)){host.notice(p,'wokHeat');return true;}
  if(host.isShovel(id))return shovel(b,p,host,snapshot,held);
  // Grilling's special-seasoning before-event bypass is independent of this lock.
  if(state.phase!=='preparing'||!id)return true;
  if(!host.isIngredient(id)||host.isBlocked(held)){host.notice(p,'wokInvalid');return true;}
  if(d.items.length===9){host.notice(p,'wokFull');return true;}
  if(!OWN_INGREDIENTS.has(id)){
   const next=copy(d),prior=next.grillingPot;delete next.grillingPot;
   next.grillingLegacyPot={version:1,epoch:prior.epoch,preparationRemaining:prior.ticksRemaining,reason:'unreviewed_author_ingredient'};
   if(next.items.length){next.recipe=host.legacyRecipe(next.items);next.started=true;next.progress=0;next.stirs=0;next.flipGrace=0;}
   savePhase(b,host,snapshot,next,'author_ingredient_handoff');return false;
  }
  if(!plainIngredient(held))throw Error('ingredient custom state is not portable');
  const next=reviseJavaPot(d);next.items.push(id);const free=p.getGameMode()===GameMode.Creative;
  handAndState(b,p,host,snapshot,next,free?held.clone():removeOne(held),'add_ingredient',{mutate:!free,expected:held});host.sound(p,'ingredient');return true;
 }catch(error){retain(b,error);return true;}
}
function finishCharcoal(b,host,snapshot){
 // Recovery may acknowledge and add a missing burn origin to this exact data.
 // Clear that acknowledged postimage; never adopt an unrelated newer save.
 recoverCuisineOutput(b,snapshot.data,{save:(block,next)=>saveExact(block,host,snapshot.raw,next),raw:host.raw});
 saveExact(b,host,rawOf(snapshot.data),{});show(b,host,{});return true;
}
export function handleJavaPotTick(b,host){
 try{
  let snapshot=readStation(b,host);requireSettled(b);if(snapshot.data.grillingPot===undefined)return false;
  const state=readJavaPot(snapshot.data);show(b,host,snapshot.data);
  if(state.phase==='charcoal')return finishCharcoal(b,host,snapshot);
  if(!host.hot(b))return true;
  if(state.phase==='preparing'&&acceptedRecipes(host).exact.length!==EXACT.length)return true;
  const step=advanceJavaPot(snapshot.data);
  if(!step.action){saveExact(b,host,snapshot.raw,step.data);return true;}
  if(step.action==='reset'){savePhase(b,host,snapshot,{},'empty_oil_expired');return true;}
  if(step.action==='start'){savePhase(b,host,snapshot,startOrHandoff(step.data,host),'preparation_expired');return true;}
  if(step.action==='burnt'){
   prepareCuisineBurn(b,snapshot.data,{save:(block,next)=>saveExact(block,host,snapshot.raw,next),raw:host.raw});
   const expected=rawOf(snapshot.data);if(host.raw(b)!==expected)throw Error('pot burn origin owner changed');
   step.data.grillingBurnOrigin=copy(snapshot.data.grillingBurnOrigin);snapshot={raw:expected,data:snapshot.data};
  }
  if(step.action==='burnout'){
   assertCuisineBatchUncredited(b,snapshot.data);
   const next=step.data;next.grillingPot.phase='charcoal';next.grillingPot.ticksRemaining=0;next.charcoalCount=1+Math.floor(Math.random()*3);
   next.burnt=true;next.result=undefined;next.oil=false;
   savePhase(b,host,snapshot,next,'charcoal_selected');return finishCharcoal(b,host,readStation(b,host));
  }
  savePhase(b,host,snapshot,step.data,step.action);host.phaseSound(b,step.action);return true;
 }catch(error){retain(b,error);return true;}
}
export function recoverJavaPot(id,b,data,host){
 if(id!=='kaleidoscope_cookery:pot')return false;requireSettled(b);if(data?.grillingPot===undefined)return false;
 // Throwing stops the author's subsequent save({}); lost blocks keep owned state.
 const p=readJavaPot(data),snapshot=readStation(b,host);if(snapshot.raw!==rawOf(data))throw Error('pot destruction source changed');
 if(p.phase==='charcoal')return finishCharcoal(b,host,snapshot);
 if(p.phase==='finished'||p.phase==='burnt'){
  recoverCuisineOutput(b,data,{save:(block,next)=>saveExact(block,host,snapshot.raw,next),raw:host.raw});saveExact(b,host,rawOf(data),{});show(b,host,{});return true;
 }
 const r=begin(b,snapshot,{},'break_inputs',{epoch:p.epoch,revision:p.revision});
 try{
  for(let i=0;i<data.items.length;i++)giveRawInput(b,undefined,data,data.items[i],'input:'+p.epoch+':'+p.revision+':'+i);
  saveExact(b,host,snapshot.raw,{});terminal(b,r,'committed');show(b,host,{});return true;
 }catch(error){terminal(b,r,'quarantined');retain(b,error);throw error;}
}
