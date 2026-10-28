import {world,system} from '@minecraft/server';
import {readPublicOil,isOilPayloadLine,normalizePublicOil} from './host_api/oil_api_core.js';
import {readCookeryOilPot,buildCookeryOilPot,COOKERY_FILLED_ID} from './oil/cookery_oil_pot_adapter.js';
import {getHand,setHand,playerInventory} from './core/player_io.js';
import {captureSkewerMetadata,metadataSignature} from './skewer_item_snapshot.js';
const pending=new Map(),lifecycles=new Map(),gestures=new Map();let sequence=0;
// The host only adds its portable oil line when publishing a legacy pot.
// Preserve every other exposed field; same-looking replacement pots must not
// inherit a deferred interaction belonging to the original native stack.
// A moved owner cancels this asynchronous gesture; the newly published pot
// remains available for a fresh synchronous interaction at the new location.
function stable(stack,allowOilPublication=false){
 if(!stack)return '';
 const copy=stack.clone();if(allowOilPublication)copy.setLore(copy.getRawLore().filter(x=>!isOilPayloadLine(x)));
 return metadataSignature({amount:copy.amount,native:captureSkewerMetadata(copy)});
}
function pendingStillCurrent(row){
 try{
  const p=row.player,location=p.location;
  return p.isValid===true&&p.id===row.playerId&&gestures.get(row.playerId)===row.gesture&&(lifecycles.get(row.playerId)??0)===row.lifecycle&&p.dimension.id===row.dimensionId&&
   ['x','y','z'].every(axis=>location[axis]===row.location[axis])&&p.selectedSlotIndex===row.slot&&
   stable(getHand(p,'main'),!row.published&&row.hand==='main')===(row.published?.main??row.main)&&
   stable(getHand(p,'off'),!row.published&&row.hand==='off')===(row.published?.off??row.off)&&
   readCookeryOilPot(getHand(p,row.hand)).valid;
 }catch{return false}
}
function invalidateOwner(playerId){
 lifecycles.set(playerId,(lifecycles.get(playerId)??0)+1);gestures.delete(playerId);
 for(const [id,row] of pending)if(row.playerId===playerId)pending.delete(id);
}
export function publishLegacyGrillingPot(stack){
 const state=readCookeryOilPot(stack);if(state.source!=='legacy_grilling')return undefined;
 return buildCookeryOilPot(state.type,state.count,stack);
}
export function ensureOilHandPublished(player,hand,continueUse){
 // Every newer gesture supersedes earlier waits, including rows already queued
 // for continuation after a host reply. A synchronous use also owns this order.
 let gesture,ownerId;
 try{
  ownerId=player.id;if(typeof ownerId!=='string'||!ownerId)return false;
  gesture={};gestures.set(ownerId,gesture);
  for(const [id,row] of pending)if(row.playerId===ownerId)pending.delete(id);
 }catch{return false}
 const stack=getHand(player,hand),read=readCookeryOilPot(stack);
 if(read.valid){
  if(read.source==='legacy_grilling'){const next=publishLegacyGrillingPot(stack);if(!next)return false;setHand(player,hand,next);if(JSON.stringify(readCookeryOilPot(getHand(player,hand)))!==JSON.stringify(readCookeryOilPot(next)))return false;}
  return true;
 }
 if(read.reason!=='host_snapshot_required')return false;
 let main,off,playerId,dimensionId,slot,location;
 try{
  if(player.isValid!==true||(hand!=='main'&&hand!=='off'))return false;
  playerId=player.id;dimensionId=player.dimension.id;slot=player.selectedSlotIndex;location={...player.location};
  if(!['x','y','z'].every(axis=>Number.isFinite(location[axis])))return false;
  main=stable(getHand(player,'main'),hand==='main');off=stable(getHand(player,'off'),hand==='off');
 }catch{return false}
 const id=playerId+':'+(++sequence);
 pending.set(id,{player,playerId,dimensionId,location,gesture,lifecycle:lifecycles.get(playerId)??0,hand,slot,main,off,continueUse});
 system.sendScriptEvent('senluo:oil_snapshot_request',JSON.stringify({api:1,id,playerId:player.id,hand,expectedId:stack.typeId,expectedLore:JSON.stringify(stack.getRawLore())}));
 system.runTimeout(()=>{const r=pending.get(id);if(!r)return;pending.delete(id);try{console.warn('[Grilling Oil API] host snapshot unavailable')}catch{}},60);return false;
}
system.afterEvents.scriptEventReceive.subscribe(ev=>{
 if(ev.id!=='senluo:oil_snapshot_response')return;
 try{const reply=JSON.parse(ev.message),r=pending.get(reply.id);if(!r||reply.api!==1)return;pending.delete(reply.id);
  if(!reply.ok){console.warn('[Grilling Oil API] host snapshot rejected');return}
  const published=normalizePublicOil(reply.publishedOil),actual=readPublicOil(getHand(r.player,r.hand));
  // An acknowledgement binds the host-published public quantity/type/revision.
  // Unknown old-format replies retain the published pot for the next gesture.
  if(!published||actual.source!=='public_api'||metadataSignature(actual.state)!==metadataSignature(published)||!pendingStillCurrent(r))return;
  r.published={main:stable(getHand(r.player,'main')),off:stable(getHand(r.player,'off'))};
  system.run(()=>{if(pendingStillCurrent(r))r.continueUse?.();});
 }catch(e){console.warn('[Grilling Oil API] deferred use retained '+e)}
});
world.afterEvents.playerLeave.subscribe(({playerId})=>invalidateOwner(playerId));
function migrate(p){
 const c=playerInventory(p);if(c)for(let i=0;i<c.size;i++){const s=c.getItem(i);if(s?.typeId!==COOKERY_FILLED_ID||readPublicOil(s).source==='public_api')continue;const next=publishLegacyGrillingPot(s);if(next)c.setItem(i,next)}
 const off=getHand(p,'off');if(off?.typeId===COOKERY_FILLED_ID){const next=publishLegacyGrillingPot(off);if(next)setHand(p,'off',next)}
}
world.afterEvents.playerSpawn.subscribe(e=>{invalidateOwner(e.player.id);system.runTimeout(()=>{try{migrate(e.player)}catch(error){console.warn('[Grilling Oil API] legacy pot retained '+error)}},5)});
system.runTimeout(()=>{for(const p of world.getAllPlayers())try{migrate(p)}catch{}},10);
