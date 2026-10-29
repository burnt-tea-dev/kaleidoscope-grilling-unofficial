import {scriptEvents} from './event_router.js';
/** Author-owned output transactions; native food state travels with the actual output. */
import {world,system,ItemStack,EquipmentSlot,GameMode} from '@minecraft/server';
import {writePublicFood,readPublicFood,readPublicFoodLore,normalizePublicFood,bucketHotUntil} from './food_api_core.js';
import {canonicalCuisineFoodId,cuisineQualityItemId,cuisineQualityOfItem,cuisineQualityPayloadMatches} from './cuisine_quality_core.js';
export const CUISINE_CAPABILITIES=Object.freeze(['cuisine_output_receipt_v2','secret_ingredient_consume_v1','cuisine_configuration_v1']);
const CONFIG_KEY='senluo:cuisine_heat_and_seasoning_v1';
const cuisineEnabled=()=>world.getDynamicProperty(CONFIG_KEY)!==false;
const META_PREFIX='senluo:cuisine_metadata:',RECEIPT_PREFIX='senluo:cuisine_output:',RECOVERY_PREFIX='senluo:cuisine_recovery:',CARRIER_PREFIX='senluo:cuisine_carrier:';
const key=b=>b.dimension.id+':'+b.x+','+b.y+','+b.z;
const station=b=>({dimensionId:b.dimension.id,x:b.x,y:b.y,z:b.z});
const same=(a,b)=>a?.typeId===b?.typeId&&a?.amount===b?.amount&&a?.nameTag===b?.nameTag&&JSON.stringify(a?.getRawLore())===JSON.stringify(b?.getRawLore());
function liveStackRelation(actual,expected){
 if(!same(actual,expected))return 'different';if(!expected)return 'same';
 try{
  // Native stackability includes custom data/properties, but cannot establish
  // identity for nonstackable items. Unknown ownership forbids destruction.
  if(expected.isStackableWith(expected.clone())!==true)return 'unknown';
  return actual.isStackableWith(expected)?'same':'different';
 }catch{return 'unknown'}
}
// Normal ACK retains the public-field fallback for native nonstackable items;
// an available native comparison that proves different is never ignored.
const acknowledgesStack=(actual,expected)=>liveStackRelation(actual,expected)!=='different';
function writeAcknowledged(property,value){
 let failure;try{world.setDynamicProperty(property,value)}catch(error){failure=error}
 if(world.getDynamicProperty(property)!==value)throw failure??Error('cuisine property readback');
}
const writeReceipt=(property,receipt)=>writeAcknowledged(property,JSON.stringify(receipt));
function cuisineEpoch(data){const epoch=data?.grillingOutputEpoch??'legacy';if(epoch!=='legacy'&&(!Number.isSafeInteger(epoch)||epoch<1))throw Error('cuisine batch identity invalid');return epoch;}
function recoveryKey(b,data){return RECOVERY_PREFIX+key(b)+':pot:'+cuisineEpoch(data);}
function readRecovery(b,data,id){
 const property=recoveryKey(b,data),raw=world.getDynamicProperty(property);
 if(raw!==undefined){
  if(typeof raw!=='string')throw Error('cuisine recovery fence unreadable');
  const intent=JSON.parse(raw);
  if(!intent||typeof intent!=='object'||Array.isArray(intent)||!sameRecovery(intent,data,id))throw Error('cuisine recovery fence invalid');
  return {property,raw,intent};
 }
 // G119 had per-portion break receipts but no epoch fence. Adopt an existing
 // receipt without rewriting it; every possible legacy portion is bounded by
 // the public 1..64 output contract. This runs only on a production operation.
 const epoch=cuisineEpoch(data);
 for(let count=1;count<=64;count++){
  const operationId='break:pot:'+epoch+':'+count,legacyRaw=world.getDynamicProperty(RECEIPT_PREFIX+key(b)+':'+operationId);
  if(legacyRaw===undefined)continue;
  const prior=JSON.parse(String(legacyRaw)),valid=requestedOutputId(prior)===id&&canonicalCuisineFoodId(prior.output?.id)===canonicalCuisineFoodId(id)&&Number.isInteger(prior.output?.amount)&&prior.output.amount>=1&&prior.output.amount<=count&&receiptQualityMatches(prior,savedCuisineQuality(data));
  const intent={version:1,kind:'pot',itemId:id,epoch,sourceCount:count,remaining:valid?prior.output.amount:null,operationId,phase:valid&&prior.phase==='committed'?'committed':'quarantined',legacy:true};
  writeReceipt(property,intent);return {property,raw:JSON.stringify(intent),intent};
 }
 return {property};
}
function sameRecovery(intent,batch,id){
 return intent?.version===1&&intent.kind==='pot'&&intent.itemId===id&&intent.epoch===cuisineEpoch(batch)
  &&Number.isInteger(intent.sourceCount)&&intent.sourceCount>=1&&intent.sourceCount<=64
  &&intent.operationId==='break:pot:'+intent.epoch+':'+intent.sourceCount
  &&(intent.legacy===true?savedCuisineQuality(batch)===undefined:!!normalizePublicFood(intent.metadata)&&intent.metadata.quality===savedCuisineQuality(batch))
  &&(['prepared','committed'].includes(intent.phase)
   ?Number.isInteger(intent.remaining)&&intent.remaining>=0&&intent.remaining<=intent.sourceCount
   :intent.phase==='quarantined');
}
const requestedOutputId=receipt=>receipt.requestedItemId??receipt.output?.id;
function savedCuisineQuality(data){
 const quality=data?.grillingPot?.quality;
 if(quality!==undefined&&(!Number.isInteger(quality)||quality<0||quality>3||['burnt','charcoal'].includes(data.grillingPot.phase)))throw Error('cuisine saved quality invalid');
 return quality;
}
function receiptQualityMatches(receipt,quality){
 const actualId=receipt.output?.id,portable=readPublicFoodLore(receipt.output?.lore??[]);
 const metadata=receipt.metadata===undefined?undefined:normalizePublicFood(receipt.metadata);
 if(portable.present&&!portable.valid||receipt.metadata!==undefined&&!metadata)return false;
 return cuisineQualityOfItem(actualId)===quality&&metadata?.quality===quality&&portable.state?.quality===quality&&cuisineQualityPayloadMatches(actualId,portable);
}
function canRebindBurntReceipt(b,data,prior,id,count,receiptId){
 const p=data.grillingPot,origin=data.grillingBurnOrigin,epoch=cuisineEpoch(data),s=prior.station;
 // A proven zero-credit attempt may change dish identity exactly once when
 // this saved epoch has subsequently burned. No other receipt phase is reusable.
 return id==='kaleidoscope_cookery:dark_cuisine'&&count===1&&p?.version===1&&p.phase==='burnt'&&p.epoch===epoch&&p.quality===undefined
  &&Number.isSafeInteger(epoch)&&epoch>0&&data.result?.id===id&&data.result.count===count&&p.output?.id===id&&p.output.count===count
  &&origin?.version===1&&origin.epoch===epoch&&origin.sourceCount===count&&typeof origin.resultId==='string'&&origin.resultId!==id
  &&canonicalCuisineFoodId(origin.resultId)===origin.resultId&&requestedOutputId(prior)===origin.resultId&&canonicalCuisineFoodId(prior.output?.id)===origin.resultId
  &&prior.api===2&&prior.kind==='pot'&&prior.phase==='rolled_back'&&prior.settlementVersion===1&&prior.output.amount===count
  &&receiptId===key(b)+':pot:'+epoch+':'+count&&prior.receiptId===receiptId
  &&s?.dimensionId===b.dimension.id&&s.x===b.x&&s.y===b.y&&s.z===b.z&&receiptQualityMatches(prior,origin.quality);
}
const carriers=new Map();
const carrierItem=slot=>slot.hasItem()?slot.getItem():undefined;
export function beginCuisineCarrier(player,outputReceipt){
 if(carriers.has(player.id))throw Error('carrier operation retained');
 const slot=player.getComponent('minecraft:equippable')?.getEquipmentSlot(EquipmentSlot.Mainhand);
 if(!slot)throw Error('carrier slot missing');
 const before=carrierItem(slot)?.clone(),after=before?.clone();if(after&&after.amount>1)after.amount--;
 const capture={slot,before,after:after?.amount===1&&before?.amount===1?undefined:after,outputReceipt};
 // A legacy capture without an operation identity cannot be settled by an
 // unrelated later give. The acknowledged caller explicitly binds its key.
 if(outputReceipt!==undefined){if(typeof outputReceipt!=='string'||!outputReceipt.startsWith(RECEIPT_PREFIX))throw Error('carrier operation identity');carriers.set(player.id,capture)}
 return capture;
}
function carrierPhase(player,r,phase){
 if(r.journal){r.journal.phase=phase;writeReceipt(r.property,r.journal)}
 if(phase==='committed'||phase==='rolled_back')carriers.delete(player.id);
}
function restoreCarrier(player,outputReceipt){
 const r=carriers.get(player.id);if(!r||r.outputReceipt!==outputReceipt)return;
 if(r.resolvedPhase){carrierPhase(player,r,r.resolvedPhase);return;}
 if(r.deliveryUnknown)throw Error('carrier output outcome retained');
 try{
  const actual=carrierItem(r.slot);
  if(liveStackRelation(actual,r.before)!=='same'){
   if(liveStackRelation(actual,r.after)!=='same')throw Error('carrier slot ownership changed or unknown');
   let failure;try{r.slot.setItem(r.before)}catch(error){failure=error}
   if(liveStackRelation(carrierItem(r.slot),r.before)!=='same')throw failure??Error('carrier restore readback');
  }
  r.resolvedPhase='rolled_back';carrierPhase(player,r,'rolled_back');
 }catch(error){try{carrierPhase(player,r,'quarantined')}catch{}throw error}
}
export function consumeCuisineCarrier(b,player,data,kind='pot',expectedId){
 const retained=carriers.get(player.id);
 if(retained?.resolvedPhase)carrierPhase(player,retained,retained.resolvedPhase);
 const property=CARRIER_PREFIX+player.id,raw=world.getDynamicProperty(property);
 if(raw!==undefined){
  const prior=typeof raw==='string'?JSON.parse(raw):undefined;
  if(prior?.version!==1||prior.playerId!==player.id||typeof prior.outputReceipt!=='string'||!prior.outputReceipt.startsWith(RECEIPT_PREFIX)||!prior.before||typeof prior.before.id!=='string'||!Number.isInteger(prior.before.amount)||prior.before.amount<1||!Array.isArray(prior.before.lore)||!['committed','rolled_back'].includes(prior.phase))throw Error('carrier debit outcome retained');
 }
 if(carriers.has(player.id))throw Error('carrier operation retained');
 // An existing output is handled by its receipt. Replaying it must not first
 // debit another container; an unresolved old output is also not a new sale.
 const outputReceipt=RECEIPT_PREFIX+key(b)+':'+portionOperation(data,kind),old=world.getDynamicProperty(outputReceipt);
 if(old!==undefined){const prior=JSON.parse(String(old));if(prior?.phase!=='rolled_back'||prior.settlementVersion!==1)return;}
 if(player.getGameMode()===GameMode.Creative)return;
 beginCuisineCarrier(player,outputReceipt);const r=carriers.get(player.id);
 try{
  if(!r.before||!Number.isInteger(r.before.amount)||r.before.amount<1||expectedId!==undefined&&r.before.typeId!==expectedId)throw Error('carrier item missing or changed');
  r.property=property;r.journal={version:1,playerId:player.id,outputReceipt,phase:'prepared',before:fingerprint(r.before),after:r.after?fingerprint(r.after):null};
  writeReceipt(property,r.journal);
  let failure;try{r.slot.setItem(r.after)}catch(error){failure=error}
  if(!acknowledgesStack(carrierItem(r.slot),r.after))throw failure??Error('carrier debit readback');
  carrierPhase(player,r,'debited');
 }catch(error){try{restoreCarrier(player,outputReceipt)}catch(rollback){console.warn('[Cookery cuisine API] carrier debit retained '+rollback)}throw error}
}
function claimCarrier(player,outputReceipt,unknown=false){
 const r=carriers.get(player.id);if(!r||r.outputReceipt!==outputReceipt)return;
 if(r.resolvedPhase){try{carrierPhase(player,r,r.resolvedPhase)}catch{}return;}
 // Delivery already exists (or may exist): a terminal storage failure cannot
 // refund its carrier. The pending journal blocks a new debit after restart.
 if(unknown)r.deliveryUnknown=true;else r.resolvedPhase='committed';
 try{carrierPhase(player,r,unknown?'quarantined':'committed')}catch(error){console.warn('[Cookery cuisine API] paid carrier retained '+error)}
}
export function nextCuisineBatch(b){const k=RECEIPT_PREFIX+key(b)+'_batch',previous=world.getDynamicProperty(k)??0,n=previous+1;if(!Number.isSafeInteger(previous)||previous<0||!Number.isSafeInteger(n))throw Error('batch sequence');writeAcknowledged(k,n);return n;}
export function readCuisineMetadata(b,data={},kind='pot'){
 const quality=savedCuisineQuality(data),extra=quality===undefined?{}:{quality};
 // Java creates a fresh dark dish after its takeout mixin touched the old result.
 if(data.grillingPot?.phase==='burnt')return {v:1,hotUntil:0,seasoning:[]};
 if(!cuisineEnabled()){const plain=normalizePublicFood({v:1,hotUntil:0,seasoning:[],...extra});if(!plain)throw Error('cuisine quality invalid');return plain;}
 let state={seasoning:[],oilType:data.grillingOilType??(data.oil?'default':'')};
 const raw=world.getDynamicProperty(META_PREFIX+key(b));if(raw!==undefined)state={...state,...JSON.parse(String(raw))};
 const oilType=data.grillingOilType||state.oilType;
 const heat=kind==='stockpot'?1200:oilType==='premium_chili'?24000:oilType==='secret_chili'?12000:1200;
 const result=normalizePublicFood({v:1,hotUntil:bucketHotUntil(Number(world.getAbsoluteTime())+heat),seasoning:[...(state.seasoning??[])],...extra});if(!result)throw Error('cuisine metadata invalid');return result;
}
export function createNativeSuspiciousStew(b,variant=Math.floor(Math.random()*11)){
 if(!Number.isInteger(variant)||variant<0||variant>10)throw Error('stew variant');
 const stand=b.dimension.spawnEntity('kaleidoscope_grilling:equipment_visual',{x:b.x+.5,y:b.y+.5,z:b.z+.5});
 try{
  stand.runCommand('replaceitem entity @s slot.inventory 0 minecraft:suspicious_stew 1 '+variant);
  const stack=stand.getComponent('minecraft:inventory')?.container?.getItem(0);if(stack?.typeId!=='minecraft:suspicious_stew')throw Error('native stew variant missing');writePublicFood(stack,{v:1,hotUntil:0,seasoning:[],nativeVariant:variant});return stack.clone();
 }finally{stand.remove();}
}
const fingerprint=s=>({id:s.typeId,amount:s.amount,name:s.nameTag,lore:s.getRawLore()});
function matchesFingerprint(s,f){return !!s&&JSON.stringify(fingerprint(s))===JSON.stringify(f);}
function emit(receipt){if(receipt.kind==='burnt'||receipt.kind==='pot_input')return;try{system.sendScriptEvent('kaleidoscope_grilling:cookery_output_ready',JSON.stringify({version:2,receiptId:receipt.receiptId,station:receipt.station,target:receipt.target,metadata:receipt.metadata}));}catch(e){console.warn('[Cookery cuisine API] committed notification deferred '+receipt.receiptId+' '+e)}}
function sameReceiptContainer(target,playerId,targetBlock){
 if(target?.kind==='player_slot')return !!playerId&&target.playerId===playerId;
 return target?.kind==='block_slot'&&!playerId&&!!targetBlock&&target.dimensionId===targetBlock.dimension.id&&target.x===targetBlock.x&&target.y===targetBlock.y&&target.z===targetBlock.z;
}
function finishReceipt(receiptKey,receipt){
 receipt.phase='committed';
 // Once the actual delivery is acknowledged, a failed terminal write may not
 // turn it back into an uncredited output. The durable prepared row remains.
 let recoveryPending=false;try{writeReceipt(receiptKey,receipt)}catch(error){recoveryPending=true;console.warn('[Cookery cuisine API] acknowledged output receipt retained '+receipt.receiptId+' '+error)}
 emit(receipt);return recoveryPending?{...receipt,recoveryPending:true}:receipt;
}
export function deliverCuisineOutput(b,data,id,count,kind,{container,playerId,targetBlock,dropLocation,nativeStack,operationId,recoveryIntent}={}){
 if(!Number.isInteger(count)||count<1||count>64)throw Error('output amount invalid');
 const plain=kind==='burnt'||kind==='pot_input';
 if(kind==='burnt'&&(id!=='minecraft:charcoal'||nativeStack||recoveryIntent))throw Error('plain burnt output identity');
 if(kind==='pot_input'&&(!nativeStack||recoveryIntent))throw Error('plain ingredient output identity');
 if(!plain&&canonicalCuisineFoodId(id)!==id)throw Error('requested cuisine identity must be canonical');
 if(kind==='pot'){
  if(world.getDynamicProperty(burntReceiptKey(b,data))!==undefined)throw Error('cuisine burnt batch retained');
  const recovery=readRecovery(b,data,id);
  if(recovery.intent){
   // Destruction closes the entire epoch, not only the last numbered portion.
   // A stale host save cannot resurrect it through an ordinary takeout.
   if(!recoveryIntent||JSON.stringify(recoveryIntent)!==recovery.raw||!sameRecovery(recoveryIntent,data,id)||recoveryIntent.phase!=='prepared'||recoveryIntent.operationId!==operationId||recoveryIntent.remaining!==count)throw Error('cuisine batch destruction retained');
  }else if(recoveryIntent)throw Error('cuisine recovery fence missing');
 }
 const op=operationId??'automatic:'+nextCuisineBatch(b),receiptId=key(b)+':'+op,receiptKey=RECEIPT_PREFIX+receiptId;
 const old=world.getDynamicProperty(receiptKey);
 if(old!==undefined){
  const prior=JSON.parse(String(old));
  const rebind=kind==='pot'&&canRebindBurntReceipt(b,data,prior,id,count,receiptId);
  if(!rebind&&(requestedOutputId(prior)!==id||canonicalCuisineFoodId(prior.output?.id)!==canonicalCuisineFoodId(id)||prior.output?.amount!==count||prior.kind!==undefined&&prior.kind!==kind))throw Error('cuisine operation conflict: '+receiptId);
  if(!plain&&!rebind&&!receiptQualityMatches(prior,savedCuisineQuality(data)))throw Error('cuisine receipt quality conflict: '+receiptId);
  if(prior.phase==='committed'){emit(prior);return {...prior,replayed:true};}
  if(prior.phase==='prepared'){
   // A retry by another player must not use that player's same-numbered slot
   // as evidence for the original recipient's delivery.
   const actual=prior.target?.kind==='item_entity'?world.getEntity(prior.target.entityId)?.getComponent('minecraft:item')?.itemStack:sameReceiptContainer(prior.target,playerId,targetBlock)?container?.getItem(prior.target.slot):undefined;
   if(matchesFingerprint(actual,prior.output))return {...finishReceipt(receiptKey,prior),replayed:true};
   // Delivery may have been collected before a crash. Retain its receipt; never credit twice.
   throw Error('cuisine delivery outcome unresolved: '+receiptId);
  }
  if(prior.phase!=='rolled_back'||prior.settlementVersion!==1)throw Error('cuisine receipt quarantined: '+receiptId);
 }
 const meta=plain?undefined:recoveryIntent?normalizePublicFood(recoveryIntent.metadata):readCuisineMetadata(b,data,kind);
 if(!plain&&!meta)throw Error('cuisine recovery metadata invalid');
 const actualId=plain||meta.quality===undefined?id:cuisineQualityItemId(id,meta.quality);if(!actualId)throw Error('cuisine native quality identity');
 const base=nativeStack?.clone()??new ItemStack(actualId,count);if(base.typeId!==actualId||base.amount!==count)throw Error('native output identity');
 let stack=base;
 if(!plain){
  const outputMeta=readPublicFood(base);if(outputMeta.present&&!outputMeta.valid)throw Error('native output metadata unreadable');
  if(nativeStack&&(!cuisineQualityPayloadMatches(base.typeId,outputMeta)||outputMeta.state?.quality!==meta.quality))throw Error('native output quality conflict');
  if(outputMeta.valid&&outputMeta.state.nativeVariant!==undefined)meta.nativeVariant=outputMeta.state.nativeVariant;
  stack=writePublicFood(base,meta);if(meta.hotUntil>Number(world.getAbsoluteTime())&&stack.getRawLore().length<20)stack.setLore([...stack.getRawLore(),{rawtext:[{text:'§c🔥 '},{translate:'tooltip.kaleidoscope_grilling.smoky_warmth'},{text:' '+Math.ceil((meta.hotUntil-Number(world.getAbsoluteTime()))/20)+'s'}]}]);
 }
 let slot=-1,target,entity,entityObserved=false;
 if(container)for(let i=0;i<container.size;i++)if(!container.getItem(i)){slot=i;break;}
 if(slot>=0){if(!playerId&&!targetBlock)throw Error('output block target missing');target=playerId?{kind:'player_slot',playerId,slot,expectedId:actualId,expectedAmount:count}:{kind:'block_slot',...station(targetBlock),slot,expectedId:actualId,expectedAmount:count};}
 else target={kind:'item_entity',entityId:'pending',expectedId:actualId,expectedAmount:count};
 const receipt={api:2,settlementVersion:1,receiptId,kind,requestedItemId:id,station:station(b),metadata:meta,target,output:fingerprint(stack),phase:'prepared'};
 // This acknowledgement precedes every output write/spawn. An ignored or
 // unreadable prepared write cannot leave an unrecorded credit to repeat.
 writeReceipt(receiptKey,receipt);
 try{
  if(slot>=0){container.setItem(slot,stack);if(!acknowledgesStack(container.getItem(slot),stack))throw Error('output slot readback');}
  else{entity=b.dimension.spawnItem(stack,dropLocation??{x:b.x+.5,y:b.y+.45,z:b.z+.5});if(!entity||world.getEntity(entity.id)?.id!==entity.id)throw Error('output entity unavailable');entityObserved=true;if(!acknowledgesStack(entity.getComponent('minecraft:item')?.itemStack,stack))throw Error('output entity readback');target.entityId=entity.id;}
 }catch(error){
  let unknown=false;try{
   if(slot>=0){
    const actual=container.getItem(slot);
    if(actual){
     if(liveStackRelation(actual,stack)!=='same')throw Error('output slot ownership changed or unknown');
     let failure;try{container.setItem(slot,undefined)}catch(rollback){failure=rollback}
     if(container.getItem(slot)!==undefined)throw failure??Error('output slot rollback readback');
    }
   }else{
    if(!entityObserved||liveStackRelation(entity.getComponent('minecraft:item')?.itemStack,stack)!=='same')throw Error('output entity outcome unknown');
    let failure;try{entity.remove()}catch(rollback){failure=rollback}
    if(world.getEntity(entity.id)!==undefined)throw failure??Error('output entity rollback readback');
   }
  }catch{unknown=true}
  receipt.phase=unknown?'quarantined':'rolled_back';receipt.reason=String(error);
  try{writeReceipt(receiptKey,receipt)}catch(storage){console.warn('[Cookery cuisine API] prepared output retained '+receiptId+' '+storage)}
  const failure=Error('cuisine delivery failed: '+String(error));failure.deliveryOutcomeUnknown=unknown;throw failure;
 }
 return finishReceipt(receiptKey,receipt);
}
function portionOperation(data,kind){return kind+':'+(data.grillingOutputEpoch??'legacy')+':'+Number(kind==='stockpot'?data.takeout??1:data.result?.count??1);}
export function giveCuisineOutput(b,p,data,id,count=1,kind='pot',{suspicious=false}={}){
 const operationId=portionOperation(data,kind),outputReceipt=RECEIPT_PREFIX+key(b)+':'+operationId;
 try{
  const receipt=deliverCuisineOutput(b,data,id,count,kind,{container:p.getComponent('minecraft:inventory')?.container,playerId:p.id,dropLocation:p.location,operationId,nativeStack:suspicious?createNativeSuspiciousStew(b):undefined});
  if(receipt.replayed)restoreCarrier(p,outputReceipt);else claimCarrier(p,outputReceipt);return receipt;
 }catch(e){try{
  // A newly attempted delivery may already exist. Retain that attempt's paid
  // carrier instead of refunding it while the output remains unresolved.
  if(e.deliveryOutcomeUnknown)claimCarrier(p,outputReceipt,true);else restoreCarrier(p,outputReceipt);
  console.warn('[Cookery cuisine API] output retained '+e);
 }catch{};throw e;}
}
const burntOperation=data=>'burnt:pot:'+cuisineEpoch(data);
const burntReceiptKey=(b,data)=>RECEIPT_PREFIX+key(b)+':'+burntOperation(data);
function assertUncreditedCuisine(b,data){
 const id=data.result?.id||data.grillingBurnOrigin?.resultId||'minecraft:charcoal';
 if(readRecovery(b,data,id).intent)throw Error('cuisine destruction retained before burn');
 if(world.getDynamicProperty(burntReceiptKey(b,data))!==undefined)throw Error('cuisine burnt output retained');
 if(data.result?.id){
  const raw=world.getDynamicProperty(RECEIPT_PREFIX+key(b)+':'+portionOperation(data,'pot'));
  if(raw!==undefined){const prior=JSON.parse(String(raw));if(prior?.phase!=='rolled_back'||prior.settlementVersion!==1)throw Error('cuisine takeout retained before burn');}
 }
}
export function assertCuisineBatchUncredited(b,data){assertUncreditedCuisine(b,data);}
function isNewActiveCuisine(data){return data.grillingOutputEpoch===undefined&&!data.result&&!data.burnt&&data.grillingBurnOrigin===undefined&&data.started===true&&typeof data.recipe?.result==='string'&&Array.isArray(data.items)&&data.items.length>0;}
function saveCuisineOrigin(b,data,next,host,requireActive=false){
 if(typeof host?.save!=='function'||typeof host?.raw!=='function')throw Error('cuisine origin host unavailable');
 const before=host.raw(b);if(typeof before!=='string')throw Error('cuisine origin source missing');
 const persisted=JSON.parse(before);
 if(!persisted||Array.isArray(persisted)||cuisineEpoch(persisted)!==cuisineEpoch(data))throw Error('cuisine origin source changed');
 if(requireActive&&(!isNewActiveCuisine(persisted)||persisted.recipe.result!==data.recipe.result||JSON.stringify(persisted.items)!==JSON.stringify(data.items)))throw Error('cuisine active origin changed');
 let failure;try{host.save(b,next)}catch(error){failure=error}
 if(host.raw(b)!==JSON.stringify(next))throw failure??Error('cuisine origin save readback');
 Object.assign(data,next);
}
export function prepareCuisineBurn(b,data,host){
 if(isNewActiveCuisine(data)){
  // A real new active batch must not inherit a prior legacy batch's fence.
  // Verify the saved source is still active before assigning its first epoch;
  // completed/burnt legacy data never receives this escape from old receipts.
  const epoch=nextCuisineBatch(b);
  saveCuisineOrigin(b,data,{...data,grillingOutputEpoch:epoch,grillingBurnOrigin:{version:1,epoch,resultId:'',sourceCount:0}},host,true);
 }
 assertUncreditedCuisine(b,data);
 const epoch=data.grillingOutputEpoch??nextCuisineBatch(b),quality=savedCuisineQuality(data),origin={version:1,epoch,resultId:data.result?.id??'',sourceCount:data.result?Number(data.result.count??1):0,...(quality===undefined?{}:{quality})};
 if(origin.resultId&&(!Number.isInteger(origin.sourceCount)||origin.sourceCount<1||origin.sourceCount>64))throw Error('cuisine burn source amount');
 // Capture the result before author burnWok clears it. For active cooking this
 // also persists the first epoch before any burnt state/output can be saved.
 if(JSON.stringify(data.grillingBurnOrigin)!==JSON.stringify(origin)||data.grillingOutputEpoch!==epoch)saveCuisineOrigin(b,data,{...data,grillingOutputEpoch:epoch,grillingBurnOrigin:origin},host);
}
function prepareBurntOutput(b,data,host){
 if(!data.burnt)throw Error('cuisine burnt state missing');
 const origin=data.grillingBurnOrigin;
 if(origin!==undefined){
  if(origin?.version!==1||origin.epoch!==cuisineEpoch(data)||typeof origin.resultId!=='string'||!Number.isInteger(origin.sourceCount)||origin.sourceCount<0||origin.sourceCount>64||!!origin.resultId!==(origin.sourceCount>0))throw Error('cuisine burnt origin invalid');
  if(origin.quality!==undefined&&!cuisineQualityItemId(origin.resultId,origin.quality))throw Error('cuisine burnt origin quality invalid');
 }else{
  // Old burnt saves lost their result before this hook existed. If any prior
  // food credit is recorded, there is no honest way to infer remaining coal
  // from ingredients/RNG. Keep that state for review rather than minting it.
  assertUncreditedCuisine(b,data);
  for(let count=1;count<=64;count++){
   const raw=world.getDynamicProperty(RECEIPT_PREFIX+key(b)+':pot:'+cuisineEpoch(data)+':'+count);
   if(raw!==undefined){const prior=JSON.parse(String(raw));if(prior?.phase!=='rolled_back'||prior.settlementVersion!==1)throw Error('legacy burnt food outcome retained');}
  }
  const epoch=data.grillingOutputEpoch??nextCuisineBatch(b);
  saveCuisineOrigin(b,data,{...data,grillingOutputEpoch:epoch,grillingBurnOrigin:{version:1,epoch,resultId:'',sourceCount:0}},host);
 }
 const id=data.grillingBurnOrigin.resultId||'minecraft:charcoal';
 if(readRecovery(b,data,id).intent)throw Error('cuisine destruction retained before charcoal');
 const count=Math.max(1,Number(data.charcoalCount??1));
 if(!Number.isInteger(count)||count>64)throw Error('cuisine charcoal amount');
 return count;
}
export function giveBurntCuisineOutput(b,p,data,host){
 const count=prepareBurntOutput(b,data,host);
 return deliverCuisineOutput(b,data,'minecraft:charcoal',count,'burnt',{container:p.getComponent('minecraft:inventory')?.container,playerId:p.id,dropLocation:p.location,operationId:burntOperation(data)});
}
export function recoverCuisineOutput(b,data,host){
 if(data.burnt){const count=prepareBurntOutput(b,data,host);deliverCuisineOutput(b,data,'minecraft:charcoal',count,'burnt',{operationId:burntOperation(data)});return true;}
 if(!data.result?.id)return false;
 if(world.getDynamicProperty(burntReceiptKey(b,data))!==undefined)throw Error('cuisine burnt batch retained');
 const id=data.result.id,recovery=readRecovery(b,data,id),sourceCount=Number(data.result.count??1);
 let intent=recovery.intent;
 if(intent){
  if(!sameRecovery(intent,data,id))throw Error('cuisine recovery batch conflict');
  if(intent.phase==='committed')return true;
  if(intent.phase!=='prepared'||intent.sourceCount!==sourceCount)throw Error('cuisine takeout outcome unresolved');
 }else{
  if(!Number.isInteger(sourceCount)||sourceCount<1||sourceCount>64)throw Error('cuisine recovery amount invalid');
  const operation=portionOperation(data,'pot'),raw=world.getDynamicProperty(RECEIPT_PREFIX+key(b)+':'+operation);
  let count=sourceCount,reason='';
  if(raw!==undefined){
   const prior=JSON.parse(String(raw));
   const rebind=canRebindBurntReceipt(b,data,prior,id,count,key(b)+':'+operation);
   if(!rebind&&(requestedOutputId(prior)!==id||canonicalCuisineFoodId(prior.output?.id)!==canonicalCuisineFoodId(id)||!Number.isInteger(prior.output?.amount)||prior.output.amount<1||prior.output.amount>count))reason='cuisine recovery operation conflict';
   else if(!rebind&&!receiptQualityMatches(prior,savedCuisineQuality(data)))reason='cuisine recovery quality conflict';
   else if(prior.phase==='committed')count-=prior.output.amount;
   else if(prior.phase!=='rolled_back'||prior.settlementVersion!==1)reason='cuisine takeout outcome unresolved';
  }
  intent={version:1,kind:'pot',itemId:id,epoch:cuisineEpoch(data),sourceCount,remaining:reason?null:count,operationId:'break:'+operation,phase:reason?'quarantined':'prepared',metadata:readCuisineMetadata(b,data,'pot')};
  // This fence is durable before any destruction credit. Even an unknown
  // takeout closes alternate portion numbers until that outcome is reviewed.
  writeReceipt(recovery.property,intent);if(reason)throw Error(reason);
 }
 // The author may not yet have saved its decreased portion count when a
 // successful takeout is followed by destruction. Both routes share that
 // portion identity; only its uncredited remainder may become a break drop.
 // Old break receipts keep their existing key and conflict guard.
 if(intent.remaining)deliverCuisineOutput(b,data,id,intent.remaining,'pot',{operationId:intent.operationId,recoveryIntent:intent});
 // The output/remaining-zero result is acknowledged. A failed final fence
 // write keeps the prepared fence and must not make the host credit again.
 intent.phase='committed';try{writeReceipt(recovery.property,intent)}catch(error){console.warn('[Cookery cuisine API] acknowledged recovery fence retained '+error)}return true;
}
scriptEvents(system)('cuisine_api_host',e=>{
 if(e.id!=='kaleidoscope_cookery:cuisine_metadata')return;try{
  const r=JSON.parse(e.message),s=r.station;if(r.api!==1||!s||typeof s.dimensionId!=='string'||![s.x,s.y,s.z].every(Number.isInteger))return;
  const valid=normalizePublicFood({v:1,hotUntil:0,seasoning:r.state?.seasoning});if(!valid)return;
  const k=META_PREFIX+s.dimensionId+':'+s.x+','+s.y+','+s.z;
  world.setDynamicProperty(k,JSON.stringify({seasoning:valid.seasoning,oilType:String(r.state.oilType??'')}));
 }catch(error){console.warn('[Cookery cuisine API] metadata retained '+error)}
});

scriptEvents(system)('cuisine_api_host',e=>{
 if(e.id!=='kaleidoscope_cookery:cuisine_config')return;
 try{const request=JSON.parse(e.message);if(request.api!==1||typeof request.enabled!=='boolean')throw Error('invalid cuisine configuration');
  world.setDynamicProperty(CONFIG_KEY,request.enabled);
  if(world.getDynamicProperty(CONFIG_KEY)!==request.enabled)throw Error('cuisine configuration readback');
 }catch(error){console.warn('[Cookery cuisine API] configuration retained '+error)}
});
system.run(()=>system.sendScriptEvent('kaleidoscope_grilling:cuisine_config_request','{"api":1}'));
