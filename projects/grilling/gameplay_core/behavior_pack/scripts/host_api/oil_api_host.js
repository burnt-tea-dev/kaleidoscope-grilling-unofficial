import {getWorldProperty,setWorldProperty} from '../core/persist.js';
import {scriptEvents,blockEvents} from './event_router.js';
/** Reviewed Cookery-owned adapter. Portable items; authoritative placed-state receipts. */
import {world,system,ItemStack,EquipmentSlot,GameMode} from '@minecraft/server';
import {EMPTY_POT,FILLED_POT,readPublicOil,writePublicOil,createPublicOilPot,normalizePublicOil,planPublicOilAddition,planPublicOilConsumption,OIL_API_VERSION} from './oil_api_core.js';
import {PERSISTED_KEY as PersistedKey} from '../core/persist_keys.js';
const ITEM_KEY=PersistedKey.COOKERY_OIL_COUNT,PLACED_PREFIX=PersistedKey.OIL_API_PLACED_PREFIX,RECEIPT_PREFIX=PersistedKey.OIL_API_RECOVERY_PREFIX;
const BUCKETS=Object.freeze({'kaleidoscope_grilling:canola_oil_bucket':'canola','kaleidoscope_grilling:secret_chili_oil_bucket':'secret_chili','kaleidoscope_grilling:premium_chili_oil_bucket':'premium_chili'});
const placement=new Map();
const location=b=>({dimensionId:b.dimension.id,x:b.x,y:b.y,z:b.z});
const key=(prefix,b)=>prefix+b.dimension.id+':'+b.x+','+b.y+','+b.z;
const nativeKey=b=>PersistedKey.COOKERY_OIL_BLOCK_PREFIX+b.dimension.id+':'+b.x+','+b.y+','+b.z;
const hand=p=>p?.getComponent('minecraft:equippable')?.getEquipmentSlot(EquipmentSlot.Mainhand);
function emitBlock(b,state){try{system.sendScriptEvent('senluo:oil_block_snapshot',JSON.stringify({api:1,version:OIL_API_VERSION,station:location(b),state}));}catch(e){console.warn('[Cookery Oil API] snapshot deferred '+e)}}
function notice(p,reason){try{console.warn('[Cookery Oil API] interaction retained: '+reason)}catch{}}
function itemSame(a,b){return a?.typeId===b?.typeId&&a?.amount===b?.amount&&a?.nameTag===b?.nameTag&&JSON.stringify(a?.getRawLore())===JSON.stringify(b?.getRawLore());}
export function readHostOilItem(stack,{legacyFull=false}={}){
 const portable=readPublicOil(stack);
 if(!portable.handled||portable.valid||portable.reason!=='host_snapshot_required')return portable;
 let raw;try{raw=stack.getDynamicProperty(ITEM_KEY)}catch{return {handled:true,valid:false,reason:'legacy_unreadable'}}
 if(raw===undefined&&!legacyFull)return {handled:true,valid:false,reason:'unknown_legacy'};
 const state=normalizePublicOil({v:1,type:'',count:raw===undefined?256:raw,revision:0});
 return state?{handled:true,valid:true,state,source:'legacy_host'}:{handled:true,valid:false,reason:'legacy_invalid'};
}
export function publishHostOil(stack,count){
 const prior=readPublicOil(stack);if(prior.handled&&!prior.valid&&prior.reason!=='host_snapshot_required')throw Error('oil payload invalid');
 const type=count?(prior.state?.type??''):'';
 const out=writePublicOil(stack,{v:1,type,count,revision:(prior.state?.revision??0)+1});
 out.setDynamicProperty(ITEM_KEY,count||undefined);return out;
}
export function publishLegacyHostOil(stack){
 // The author explicitly defines a filled legacy can without saved quantity as full.
 const read=readHostOilItem(stack,{legacyFull:true});if(!read.valid)throw Error(read.reason);
 if(read.source==='public_api')return stack.clone();
 const out=stack.clone();writePublicOil(out,read.state,{presentation:false});return out;
}
export function hostOilCountOverride(stack){
 const p=readPublicOil(stack);return p.source==='public_api'?p.state.count:p.handled&&!p.valid&&p.reason!=='host_snapshot_required'?0:undefined;
}
const consumedOil=new Map(),oilOwnerFaults=new Set(),oilStationFaults=new Set(),oilOwnerReceipts=new Map();
const oilOwnerKey=id=>PersistedKey.OIL_HAND_FAULT_PREFIX+(typeof id==='string'&&id?id:'unscoped');
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function oilItemSnapshot(stack){
 if(!stack)return null;
 const ids=stack.getDynamicPropertyIds?.()??[ITEM_KEY];
 return {id:stack.typeId,amount:stack.amount,name:stack.nameTag,lore:stack.getRawLore(),
  properties:Object.fromEntries([...ids].sort().map(k=>[k,stack.getDynamicProperty(k)])),
  keepOnDeath:stack.keepOnDeath,lockMode:stack.lockMode,
  canPlaceOn:stack.getCanPlaceOn?.()??[],canDestroy:stack.getCanDestroy?.()??[]};
}
const sameOilItem=(a,b)=>stable(oilItemSnapshot(a))===stable(oilItemSnapshot(b));
function ownsOilItem(actual,expected){
 if(!sameOilItem(actual,expected))return false;if(!expected)return true;
 // Persisted/exposed fields alone cannot authorize replacing a native item.
 // Nonstackable or unreadable native identity retains the debit for recovery.
 try{return expected.isStackableWith(expected.clone())===true&&actual.isStackableWith(expected)===true}catch{return false}
}
function writeOilReceipt(k,value){
 let failure;try{setWorldProperty(world,k,value)}catch(e){failure=e}
 // A throwing writer may already have committed. Readback, not its return,
 // decides acknowledgement; an unreadable outcome must fail closed.
 if(getWorldProperty(world,k)!==value)throw failure??Error('oil recovery receipt not acknowledged');
}
function oilRecoveryPending(k){try{return oilOwnerFaults.has(k)||getWorldProperty(world,k)!==undefined}catch{return true}}
function requireOilOwner(k){
 if(oilOwnerFaults.has(k))throw Error('oil hand requires recovery');
 const raw=getWorldProperty(world,k);if(raw===undefined)return;
 const receipt=JSON.parse(String(raw));
 if(!['committed','rolled_back'].includes(receipt.phase))throw Error('oil hand requires recovery');
}

function beginOilDebit(k,before,next,context){
 const value=JSON.stringify({phase:'prepared',before:oilItemSnapshot(before),after:oilItemSnapshot(next),context});
 if(value.length>30000)throw Error('oil recovery receipt too large');
 oilOwnerFaults.add(k);oilOwnerReceipts.set(k,value);writeOilReceipt(k,value);
}
function finishOilDebit(k,phase='rolled_back'){
 const receipt=JSON.parse(oilOwnerReceipts.get(k)??String(getWorldProperty(world,k)));
 // Keep one settled receipt per owner. Never delete the durable guard and then
 // discover that its disappearance could not be acknowledged.
 writeOilReceipt(k,JSON.stringify({...receipt,phase}));
 oilOwnerFaults.delete(k);oilOwnerReceipts.delete(k);
}
function acknowledgeOilDebit(k){
 try{finishOilDebit(k,'committed');return false}catch(error){
  // The actual debit/station save is already acknowledged. Journal housekeeping
  // must not report an uncredited failure or trigger compensating debits.
  console.warn('[Cookery Oil API] acknowledged debit awaits receipt recovery '+error);return true;
 }
}

export function consumeSharedOilSlot(slot,points=1,creative=false,{ownerId,retainReceipt=false,context,expected}={}){
 const recoveryKey=oilOwnerKey(ownerId);
 try{
  requireOilOwner(recoveryKey);
  const held=slot?.hasItem()?slot.getItem():undefined,read=readHostOilItem(held,{legacyFull:true});
  if(!read.valid||held?.typeId!==FILLED_POT)return {ok:false};
  if(expected!==undefined&&!sameOilItem(held,expected))return {ok:false,reason:'oil source changed before debit'};
  const plan=planPublicOilConsumption(read.state,points);if(!plan.ok)return plan;
  const consumedType=read.state.type,heatTicks=consumedType==='premium_chili'?24000:consumedType==='secret_chili'?12000:1200;
  if(creative)return {ok:true,consumedType,heatTicks,remaining:read.state.count};
  const next=createPublicOilPot(ItemStack,plan.state.type,plan.state.count,held,plan.state.revision);next.setDynamicProperty(ITEM_KEY,plan.state.count||undefined);
  const before=held.clone();beginOilDebit(recoveryKey,before,next,context);let handAttempted=false;
  try{
   if(!sameOilItem(slot?.hasItem()?slot.getItem():undefined,before))throw Error('oil hand owner changed before debit');
   handAttempted=true;
   if(slot.setItem(next)===false||!sameOilItem(slot.getItem(),next))throw Error('oil hand readback');
  }catch(error){
   try{
    if(handAttempted){
     const actual=slot?.hasItem()?slot.getItem():undefined;
     if(!ownsOilItem(actual,before)){
      if(!ownsOilItem(actual,next))throw Error('oil hand rollback ownership changed');
      let failure;try{slot.setItem(before)}catch(error){failure=error}
      if(!ownsOilItem(slot?.hasItem()?slot.getItem():undefined,before))throw failure??Error('oil hand rollback not acknowledged');
     }
    }
    finishOilDebit(recoveryKey);
   }catch(rollback){return {ok:false,recoveryRequired:true,recoveryKey,reason:String(error),rollback:String(rollback)}}
   return {ok:false,recoveryRequired:false,reason:String(error)};
  }
  const recoveryPending=!retainReceipt&&acknowledgeOilDebit(recoveryKey);
  // Native clones remain ephemeral; public receipts are bounded fingerprints.
  return {ok:true,consumedType,heatTicks,remaining:plan.state.count,...(retainReceipt?{recoveryKey,nativeBefore:before,nativeAfter:next.clone()}:{}),...(recoveryPending?{recoveryPending:true}:{})};
 }catch(error){return {ok:false,recoveryRequired:oilRecoveryPending(recoveryKey),recoveryKey,reason:String(error)};}
}
export function consumeSharedOilFromHeldPot(player){
 consumedOil.delete(player?.id);
 const r=consumeSharedOilSlot(hand(player),1,player?.getGameMode?.()===GameMode.Creative,{ownerId:player?.id});
 if(r.ok)consumedOil.set(player.id,{...r,tick:system.currentTick});return r.ok;
}
/** The prepared owner receipt spans both the actual debit and station save. */
export function commitSharedStationOil(b,slot,data,host,{creative=false,ownerId}={}){
 const faultKey=PersistedKey.OIL_STATION_FAULT_PREFIX+key('',b);
 if(oilStationFaults.has(faultKey)||getWorldProperty(world,faultKey)!==undefined)throw Error('oil station requires recovery');
 if(typeof host.raw!=='function')throw Error('oil station raw readback unavailable');
 const captured=slot?.hasItem()?slot.getItem()?.clone():undefined,saved=JSON.parse(JSON.stringify(data)),savedRaw=host.raw(b);
 const encoded=value=>Object.keys(value).length?JSON.stringify(value):undefined;
 if(savedRaw!==encoded(saved))throw Error('oil station source changed');
 const result=consumeSharedOilSlot(slot,1,creative,{ownerId,retainReceipt:true,context:{station:location(b)},expected:captured});if(!result.ok)return result;
 const {nativeBefore:before,nativeAfter:debited,...summary}=result;let stationAttempted=false,expectedState;
 try{
  if(!creative&&(!before||!debited||!sameOilItem(slot?.hasItem()?slot.getItem():undefined,debited)))throw Error('oil debit postimage changed');
  if(host.raw(b)!==savedRaw)throw Error('oil station owner changed after debit');
  data.oil=true;data.grillingOilType=result.consumedType;data.oilTicks=result.heatTicks;
  host.prepareState?.(data);expectedState=encoded(data);
  if(host.raw(b)!==savedRaw)throw Error('oil station owner changed before save');
  stationAttempted=true;host.save(b,data);
  if(host.raw(b)!==expectedState)throw Error('oil station save not acknowledged');
  host.sync(b,data);
 }catch(error){
  const rollback=[];let stateRestored=false;
  // The station may own oil after a write-then-throw. Remove/read back that
  // ownership FIRST. An unknown or failed state rollback cannot refund its cost.
  try{
   const actual=host.raw(b);
   if(actual===savedRaw)stateRestored=true;
   else{
    if(!stationAttempted||actual!==expectedState)throw Error('oil station rollback ownership changed');
    let failure;try{host.save(b,saved)}catch(e){failure=e}
    if(host.raw(b)!==savedRaw)throw failure??Error('oil station rollback readback');
    stateRestored=true;
   }
   Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,saved);
   try{host.sync(b,saved)}catch(e){console.warn('[Cookery Oil API] restored state visual deferred '+e)}
  }catch(e){rollback.push(String(e))}
  if(stateRestored&&!creative)try{
   const actual=slot?.hasItem()?slot.getItem():undefined;
   if(!ownsOilItem(actual,before)){
    if(!debited||!ownsOilItem(actual,debited))throw Error('oil hand rollback ownership changed');
    let failure;try{slot.setItem(before)}catch(e){failure=e}
    if(!ownsOilItem(slot?.hasItem()?slot.getItem():undefined,before))throw failure??Error('oil hand rollback readback');
   }
  }catch(e){rollback.push(String(e))}
  if(!stateRestored&&!rollback.length)rollback.push('oil station rollback unproven; debit retained');
  if(!rollback.length&&result.recoveryKey)try{finishOilDebit(result.recoveryKey)}catch(e){rollback.push(String(e))}
  if(rollback.length){
   oilStationFaults.add(faultKey);
   try{writeOilReceipt(faultKey,JSON.stringify({reason:String(error),rollback,state:saved}))}catch(e){console.warn('[Cookery Oil API] recovery marker retained in memory '+e)}
  }
  throw error;
 }
 const recoveryPending=result.recoveryKey&&acknowledgeOilDebit(result.recoveryKey);
 return {...summary,...(recoveryPending?{recoveryPending:true}:{})};
}
export function handleSharedStationOil(b,p,data,host){
 try{const result=commitSharedStationOil(b,hand(p),data,host,{creative:p?.getGameMode?.()===GameMode.Creative,ownerId:p?.id});if(result.recoveryRequired)notice(p,'unavailable');}catch(e){notice(p,'unavailable');console.warn('[Cookery Oil API] station retained '+e)}return true;
}
export function lastConsumedOil(player){
 const r=consumedOil.get(player?.id);return r&&system.currentTick-r.tick<=2?r:{consumedType:'',heatTicks:1200};
}
function requireOilAvailable(b){const raw=getWorldProperty(world,key(RECEIPT_PREFIX,b));if(raw){const receipt=JSON.parse(String(raw));if(['pending','quarantined'].includes(receipt.phase))throw Error('oil recovery unresolved');}}
export function readSharedPlacedOil(b){
 requireOilAvailable(b);
 const raw=getWorldProperty(world,key(PLACED_PREFIX,b));
 if(raw!==undefined){const s=normalizePublicOil(JSON.parse(String(raw)));if(!s)throw Error('placed oil payload invalid');return s;}
 const qty=getWorldProperty(world,nativeKey(b));
 let has=false;try{has=b.permutation.getState('kaleidoscope_cookery:has_oil')===true}catch{}
 if(qty===undefined&&has)throw Error('unknown legacy placed oil');
 const s=normalizePublicOil({v:1,type:'',count:qty??0,revision:0});if(!s)throw Error('invalid legacy placed oil');return s;
}
export function writeSharedPlacedOil(b,state){
 const s=normalizePublicOil(state);if(!s)throw Error('placed oil schema');
 const clockKey=PersistedKey.OIL_API_REVISION,revision=Math.max(s.revision,Number(getWorldProperty(world,clockKey)??0)+1);if(!Number.isSafeInteger(revision))throw Error('oil revision');s.revision=revision;setWorldProperty(world,clockKey,revision);
 const raw=JSON.stringify(s);setWorldProperty(world,key(PLACED_PREFIX,b),raw);if(getWorldProperty(world,key(PLACED_PREFIX,b))!==raw)throw Error('placed oil write not acknowledged');
 setWorldProperty(world,nativeKey(b),s.count||undefined);if(Number(getWorldProperty(world,nativeKey(b))??0)!==s.count)throw Error('native oil count write not acknowledged');
 if(b.typeId===EMPTY_POT){b.setPermutation(b.permutation.withState('kaleidoscope_cookery:has_oil',s.count>0));if(b.permutation.getState('kaleidoscope_cookery:has_oil')!==(s.count>0))throw Error('oil visual state rejected');}
 emitBlock(b,s);return s;
}
export function sharedPlacedCount(b){return readSharedPlacedOil(b).count;}
export function updateSharedPlacedCount(b,count){
 const previous=readSharedPlacedOil(b);return writeSharedPlacedOil(b,{v:1,type:count?previous.type:'',count,revision:previous.revision+1});
}
export function captureSharedOilPlacement(ev){
 if(ev.block?.typeId===EMPTY_POT)requireOilAvailable(ev.block);
 const slot=hand(ev.player),held=slot?.hasItem()?slot.getItem():undefined;
 if(![EMPTY_POT,FILLED_POT].includes(held?.typeId))return;
 const read=readHostOilItem(held,{legacyFull:true});if(!read.valid){ev.cancel=true;system.run(()=>notice(ev.player,'unavailable'));return;}
 const pending={tick:system.currentTick,state:read.state,station:location(ev.block)},id=ev.player.id;
 placement.set(id,pending);system.runTimeout(()=>{if(placement.get(id)===pending)placement.delete(id)},16);
}
export function finalizeSharedOilPlacement(ev){
 if(ev.block?.typeId!==EMPTY_POT)return false;
 const cached=placement.get(ev.player?.id);placement.delete(ev.player?.id);
 if(!cached||system.currentTick-cached.tick>12||system.currentTick<cached.tick||stable(cached.station)!==stable(location(ev.block)))return false;
 // The captured item is authoritative for this placement. Reading the block
 // first would reject a newly placed filled pot: its visual state is already
 // true, but the author's quantity has not been initialized yet. Do not grant
 // this initialization path to an unknown legacy block or another placement.
 requireOilAvailable(ev.block);
 writeSharedPlacedOil(ev.block,cached.state);return true;
}
export function handleSharedPlacedOil(block,player,sound=()=>{}){
 try{
  const state=readSharedPlacedOil(block),slot=hand(player),held=slot?.hasItem()?slot.getItem():undefined;
  if(!slot)return true;
  if(!held){
   if(state.type||state.count<=0)return true;
   const n=Math.min(64,state.count),next={v:1,type:'',count:state.count-n,revision:state.revision+1};
   mutateSharedOil(block,slot,state,next,undefined,new ItemStack('kaleidoscope_cookery:oil',n));sound(.8+Math.random()*.2);return true;
  }
  if(held.typeId!=='kaleidoscope_cookery:oil')return false;
  if(state.type){notice(player,'different_content');return true;}
  const n=Math.min(256-state.count,held.amount);if(n<=0)return true;
  let after=held.clone();if(player.getGameMode()!==GameMode.Creative){if(n===held.amount)after=undefined;else after.amount-=n;}
  mutateSharedOil(block,slot,state,{v:1,type:'',count:state.count+n,revision:state.revision+1},held,after);sound(.4+Math.random()*.2);return true;
 }catch(e){notice(player,'unavailable');console.warn('[Cookery Oil API] interaction retained '+e);return true;}
}
function mutateSharedOil(block,slot,state,next,before,after){
 try{slot.setItem(after);if(!itemSame(slot.getItem(),after))throw Error('oil hand write');writeSharedPlacedOil(block,next)}catch(error){
  let rollback;try{slot.setItem(before);if(!itemSame(slot.getItem(),before))throw Error('oil hand rollback');writeSharedPlacedOil(block,state)}catch(e){rollback=e}
  if(rollback)setWorldProperty(world,key(RECEIPT_PREFIX,block),JSON.stringify({phase:'quarantined',state,reason:String(rollback)}));throw error;
 }
}
export function fillSharedPlacedOil(block,slot,type,{creative=false}={}){
 const before=slot.getItem();if(BUCKETS[before?.typeId]!==type||before.amount!==1)return {ok:false,reason:'different_content'};
 const state=readSharedPlacedOil(block),plan=planPublicOilAddition(state,type,8);if(!plan.ok)return plan;
 const after=creative?before.clone():new ItemStack('minecraft:bucket');
 mutateSharedOil(block,slot,state,plan.state,before,after);
 return {ok:true,state:plan.state};
}
export function recoverSharedOilPot(ev){
 const b={dimension:ev.dimension,x:ev.block.x,y:ev.block.y,z:ev.block.z},state=readSharedPlacedOil(b);
 const receiptKey=key(RECEIPT_PREFIX,b),creative=ev.player?.getGameMode?.()===GameMode.Creative;
 const existing=getWorldProperty(world,receiptKey);
 if(existing&&['pending','quarantined'].includes(JSON.parse(String(existing)).phase))throw Error('previous oil recovery unresolved');
 const receipt={phase:creative?'delivered':'pending',state,location:location(b),createdTick:system.currentTick};setWorldProperty(world,receiptKey,JSON.stringify(receipt));
 if(!creative){
  const stack=createPublicOilPot(ItemStack,state.type,state.count,undefined,state.revision+1);
  let drop;try{drop=b.dimension.spawnItem(stack,{x:b.x+.5,y:b.y+.5,z:b.z+.5});const actual=drop?.getComponent('minecraft:item')?.itemStack;if(!drop||!itemSame(actual,stack))throw Error('oil drop not acknowledged')}
  catch(error){if(drop){try{drop.remove();receipt.phase='pending'}catch{receipt.phase='quarantined'}}else receipt.phase='quarantined';receipt.reason=String(error);setWorldProperty(world,receiptKey,JSON.stringify(receipt));console.warn('[Cookery Oil API] recovery retained '+receiptKey);return true;}
  receipt.phase='delivered';setWorldProperty(world,receiptKey,JSON.stringify(receipt));
 }
 setWorldProperty(world,key(PLACED_PREFIX,b));setWorldProperty(world,nativeKey(b));emitBlock(b,undefined);return true;
}
function publishInventory(player){
 const inventory=player.getComponent('minecraft:inventory')?.container;
 if(inventory)for(let i=0;i<inventory.size;i++){const item=inventory.getItem(i);if(item?.typeId!==FILLED_POT||readPublicOil(item).source==='public_api')continue;const read=readHostOilItem(item);if(read.valid)inventory.setItem(i,publishLegacyHostOil(item));}
 const slot=player.getComponent('minecraft:equippable')?.getEquipmentSlot(EquipmentSlot.Offhand),item=slot?.hasItem()?slot.getItem():undefined;
 if(item?.typeId===FILLED_POT&&readPublicOil(item).source!=='public_api'&&readHostOilItem(item).valid)slot.setItem(publishLegacyHostOil(item));
}
world.afterEvents.playerSpawn.subscribe(ev=>system.runTimeout(()=>{try{publishInventory(ev.player)}catch(e){console.warn('[Cookery Oil API] legacy item retained '+e)}},20));
system.runTimeout(()=>{for(const p of world.getAllPlayers())try{publishInventory(p)}catch{}},40);
scriptEvents(system)('oil_api_host',ev=>{
 if(ev.id!=='senluo:oil_snapshot_request'&&ev.id!=='senluo:oil_block_query')return;
 try{
  const r=JSON.parse(ev.message);if(r.api!==1)return;
  if(ev.id==='senluo:oil_block_query'){
   const s=r.station,d=world.getDimension(s.dimensionId),b=d.getBlock({x:s.x,y:s.y,z:s.z});if(b?.typeId===EMPTY_POT){let state=readSharedPlacedOil(b);if(r.legacyType&&['canola','secret_chili','premium_chili'].includes(r.legacyType)&&!state.type&&state.count>0&&state.count<=64)state=writeSharedPlacedOil(b,{...state,type:r.legacyType,revision:state.revision+1});emitBlock(b,state);}return;
  }
  const p=world.getAllPlayers().find(x=>x.id===r.playerId),e=p?.getComponent('minecraft:equippable'),slot=e?.getEquipmentSlot(r.hand==='off'?EquipmentSlot.Offhand:EquipmentSlot.Mainhand);
  let ok=false,publishedOil;if(slot?.hasItem()){const item=slot.getItem();if(item.typeId===r.expectedId&&JSON.stringify(item.getRawLore())===r.expectedLore){const next=publishLegacyHostOil(item);slot.setItem(next);ok=itemSame(slot.getItem(),next);if(ok)publishedOil=readPublicOil(next).state}}
  system.sendScriptEvent('senluo:oil_snapshot_response',JSON.stringify({api:1,id:r.id,ok,publishedOil}));
 }catch(e){console.warn('[Cookery Oil API] snapshot retained '+e)}
});
blockEvents(world).interact('oil_api_host',ev=>{
 if(ev.cancel||ev.block?.typeId!==EMPTY_POT)return;
 const type=BUCKETS[ev.itemStack?.typeId];if(!type)return;
 ev.cancel=true;if(ev.isFirstEvent===false)return;
 const p=ev.player,d=ev.block.dimension,loc={...ev.block.location},held=ev.itemStack.clone();
 system.run(()=>{try{const b=d.getBlock(loc),slot=hand(p);if(b?.typeId!==EMPTY_POT||!slot?.hasItem()||!itemSame(slot.getItem(),held))return;const r=fillSharedPlacedOil(b,slot,type,{creative:p.getGameMode()===GameMode.Creative});if(!r.ok)notice(p,r.reason);else d.playSound(type==='premium_chili'?'bucket.empty_lava':'bucket.empty_water',loc)}catch(e){notice(p,'unavailable');console.warn('[Cookery Oil API] fill retained '+e)}});
});
blockEvents(world).beforeBreak('oil_api_host',ev=>{if(ev.block.typeId!==EMPTY_POT)return;try{readSharedPlacedOil(ev.block)}catch{ev.cancel=true;system.run(()=>notice(ev.player,'unavailable'))}});
blockEvents(world).explosion('oil_api_host',ev=>{ev.setImpactedBlocks(ev.getImpactedBlocks().filter(b=>{if(b.typeId!==EMPTY_POT)return true;try{return !!readSharedPlacedOil(b)}catch{return false}}))});

export function retrySharedOilRecovery(b){
 const receiptKey=key(RECEIPT_PREFIX,b),raw=getWorldProperty(world,receiptKey);if(!raw)return {ok:false,reason:'missing'};
 const receipt=JSON.parse(String(raw));if(receipt.phase!=='pending')return {ok:false,reason:receipt.phase};
 if(b.dimension.getBlock({x:b.x,y:b.y,z:b.z})?.typeId===EMPTY_POT)return {ok:false,reason:'block_present'};
 const state=normalizePublicOil(receipt.state);if(!state)throw Error('oil recovery state invalid');
 const stack=createPublicOilPot(ItemStack,state.type,state.count,undefined,state.revision+1);let drop;
 try{drop=b.dimension.spawnItem(stack,{x:b.x+.5,y:b.y+.5,z:b.z+.5});if(!drop||!itemSame(drop.getComponent('minecraft:item')?.itemStack,stack))throw Error('oil retry unacknowledged');}
 catch(error){if(drop){try{drop.remove()}catch{receipt.phase='quarantined'}}else receipt.phase='quarantined';receipt.reason=String(error);setWorldProperty(world,receiptKey,JSON.stringify(receipt));return {ok:false,reason:receipt.phase};}
 receipt.phase='delivered';setWorldProperty(world,receiptKey,JSON.stringify(receipt));setWorldProperty(world,key(PLACED_PREFIX,b));setWorldProperty(world,nativeKey(b));emitBlock(b,undefined);return {ok:true};
}
