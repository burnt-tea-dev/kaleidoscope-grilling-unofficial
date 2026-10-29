import {getWorldProperty} from '../core/persist.js';
import {PERSISTED_KEY as PersistedKey} from '../core/persist_keys.js';
import {onBeforeBlockBreak,onExplosion} from '../core/events.js';
import {onBlockInteraction} from '../core/events.js';
import {markStationContentsDirty} from '../station_contents_visual_runtime.js';
import {planRackInsert,commitRackTransfer,depositInventorySlot} from '../rack_transactions.js';
import {slotWrite,remainderOf,planInventoryInsert} from '../rack_transfer_plan.js';
import {retireEmptyStationContainer,quarantineStation,storageKey} from '../core/storage.js';
import {rackSlotAtHit} from './rack_quick_pick.js';
import {captureRackHit} from '../rack_aim_hit.js';
import {captureInteractionIntent,interactionIntentStillCurrent} from '../core/interaction_intent_adapter.js';
import {captureStackIntentSnapshot,stackIntentSnapshotMatches} from '../core/interaction_intent_core.js';
import {interactionFeedback} from '../core/interaction_feedback.js';
import {
 world,system,ItemStack,CommandPermissionLevel
} from '@minecraft/server';
import {
 playerInventory,getMainHand,isCreative as creative
} from '../core/player_io.js';
import {
 ADVANCED_RACK_ITEM_ID,ADVANCED_RACK_BLOCK_ID,RACK_COMPARTMENTS,RACK_RANGE,
 rackPlacementCandidates,rackCanPlace,rackItemKind,
 bindingInRange,RACK_PAYLOAD_KEY
} from './advanced_rack_core.js';
import {
 rackContainer,readRackFilters,writeRackFilters,clearRackFilters,captureRackFilters,rackFiltersKey,
 readRackItems,writeRackItems,clearRackItems,syncRackDisplay
} from './rack_state_adapter.js';
import {readRackPayloadItem,writeRackPayloadItem,encodeRackPayload} from './rack_item_codec.js';
import {awardNeatAndOrderly} from '../advancement/advancement_event_runtime.js';

const BIND_PREFIX=PersistedKey.RACK_BINDING_PREFIX;

function loc(block){return {x:block.x,y:block.y,z:block.z}}
function tags(stack){try{return stack?.getTags?.()??[]}catch{return []}}
const message=interactionFeedback;
function resolveRack(dimension,location){
 try{const b=dimension.getBlock(location);return b?.typeId===ADVANCED_RACK_BLOCK_ID?b:undefined}catch{return undefined}
}
function rackBreakSnapshot(block){
 return {dimension:block.dimension,location:loc(block),states:JSON.stringify(block.permutation.getAllStates()),
  owner:getWorldProperty(world,storageKey(block)),filters:getWorldProperty(world,rackFiltersKey(block))};
}
function sameRackForBreak(row){
 const block=resolveRack(row.dimension,row.location);
 return block&&JSON.stringify(block.permutation.getAllStates())===row.states&&
  getWorldProperty(world,storageKey(block))===row.owner&&getWorldProperty(world,rackFiltersKey(block))===row.filters?block:undefined;
}
function rackInUseRange(player,block){
 if(!player||!block||player.dimension.id!==block.dimension.id)return false;
 const dx=block.x+.5-player.location.x,dy=block.y+.5-player.location.y,dz=block.z+.5-player.location.z;
 return dx*dx+dy*dy+dz*dz<=64;
}
function bindingKey(slot){return BIND_PREFIX+slot}
function readBinding(player,hotbarSlot){
 try{
  const raw=player.getDynamicProperty(bindingKey(hotbarSlot));
  if(typeof raw!=='string')return undefined;
  const b=JSON.parse(raw);
  return b&&Number.isInteger(b.slot)?b:undefined;
 }catch{return undefined}
}
function writeBinding(player,hotbarSlot,block,slot){
 try{
  player.setDynamicProperty(bindingKey(hotbarSlot),JSON.stringify({
   dimension:block.dimension.id,x:block.x,y:block.y,z:block.z,slot
  }));
 }catch{}
}
function clearBinding(player,hotbarSlot){try{player.setDynamicProperty(bindingKey(hotbarSlot),undefined)}catch{}}

function slotRoom(stored,stack){
 if(!stored)return stack.maxAmount;
 if(!stored.isStackableWith(stack))return 0;
 return Math.max(0,stored.maxAmount-stored.amount);
}

function matchingLocalReturnSlot(block,stack,excluded){
 const c=rackContainer(block),filters=readRackFilters(block);if(!c)return -1;
 for(let i=0;i<RACK_COMPARTMENTS;i++){
  if(i===excluded||!filters[i])continue;
  if(!rackCanPlace(i,stack.typeId,tags(stack),filters[i]))continue;
  if(slotRoom(c.getItem(i),stack)>=stack.amount)return i;
 }
 return -1;
}

function boundRackForReturn(player,binding,stack,targetBlock,targetSlot){
 if(!binding||!bindingInRange(binding,player.dimension.id,player.location,RACK_RANGE))return undefined;
 const block=resolveRack(player.dimension,{x:binding.x,y:binding.y,z:binding.z});
 if(!block||(block.x===targetBlock.x&&block.y===targetBlock.y&&block.z===targetBlock.z&&binding.slot===targetSlot))return undefined;
 const c=rackContainer(block),filters=readRackFilters(block),slot=binding.slot;
 if(!c||!rackCanPlace(slot,stack.typeId,tags(stack),filters[slot]))return undefined;
 return slotRoom(c.getItem(slot),stack)>=stack.amount?{block,slot}:undefined;
}

function swapWithHotbar(player,block,slot){
 const c=rackContainer(block),requested=c?.getItem(slot);if(!c||!requested)return false;
 const inv=playerInventory(player),hot=player.selectedSlotIndex,held=inv?.getItem(hot);if(!inv)return false;
 if(held&&held.isStackableWith(requested)){
  const move=Math.min(requested.amount,held.maxAmount-held.amount);
  if(move>0){
   const h=held.clone();h.amount+=move;
   if(!commitRackTransfer([block],[slotWrite(inv,hot,h),slotWrite(c,slot,remainderOf(requested,move))]))return false;
  }
  writeBinding(player,hot,block,slot);return true;
 }
 const blocks=[block],steps=[slotWrite(c,slot,undefined)];
 if(held){
  let target=boundRackForReturn(player,readBinding(player,hot),held,block,slot);
  if(!target){const local=matchingLocalReturnSlot(block,held,slot);if(local>=0)target={block,slot:local};}
  if(target){
   const plan=planRackInsert(target.block,target.slot,held);
   if(!plan||plan.moved!==held.amount)return false;
   steps.push(...plan.steps);blocks.push(target.block);
  }else{
   const plan=planInventoryInsert(inv,held,hot);if(plan.remainder)return false;
   steps.push(...plan.steps);
  }
 }
 steps.push(slotWrite(inv,hot,requested));
 if(!commitRackTransfer(blocks,steps))return false;
 writeBinding(player,hot,block,slot);return true;
}

function depositSelected(player,block,slot){
 const inv=playerInventory(player),index=player.selectedSlotIndex;
 return !!inv&&depositInventorySlot(inv,index,block,slot)>0;
}

function withdrawToInventory(player,block,slot){
 const c=rackContainer(block),stored=c?.getItem(slot),inv=playerInventory(player);if(!c||!stored||!inv)return false;
 const plan=planInventoryInsert(inv,stored);if(!plan.moved)return false;
 return commitRackTransfer([block],[...plan.steps,slotWrite(c,slot,plan.remainder)]);
}

function findMatchingSlotWithRoom(block,stack){
 const c=rackContainer(block),filters=readRackFilters(block);if(!c)return -1;
 for(let i=0;i<RACK_COMPARTMENTS;i++){
  if(!filters[i]||!rackCanPlace(i,stack.typeId,tags(stack),filters[i]))continue;
  if(slotRoom(c.getItem(i),stack)>0)return i;
 }
 return -1;
}

function depositMatching(player,block){
 const inv=playerInventory(player);if(!inv)return false;
 let changed=false;
 for(let hot=0;hot<9;hot++){
  const stack=inv.getItem(hot),binding=readBinding(player,hot);
  if(!stack||!binding)continue;
  if(binding.dimension!==block.dimension.id||binding.x!==block.x||binding.y!==block.y||binding.z!==block.z)continue;
  const move=depositInventorySlot(inv,hot,block,binding.slot);
  if(move<=0)continue;
  clearBinding(player,hot);changed=true;
 }
 for(let i=0;i<Math.min(36,inv.size);i++){
  const stack=inv.getItem(i);if(!stack)continue;
  if(i<9&&readBinding(player,i))continue;
  const slot=findMatchingSlotWithRoom(block,stack);if(slot<0)continue;
  const move=depositInventorySlot(inv,i,block,slot);if(move<=0)continue;
  changed=true;
 }
 return changed;
}

const ui=(key,withArgs=[])=>({translate:'ui.kaleidoscope_grilling.advanced_rack.'+key,with:withArgs});
function playRackSound(block,placing){
 try{block.dimension.playSound(placing?'block.itemframe.add_item':'block.itemframe.remove_item',
  {x:block.x+.5,y:block.y+.5,z:block.z+.5},{volume:1,pitch:1})}catch{}
}

function clearEmptySlotFilter(block,slot){
 const c=rackContainer(block);if(!c||c.getItem(slot))return false;
 const state=captureRackFilters(block);if(!state.filters[slot])return false;
 const next=state.filters.slice();next[slot]=null;
 return commitRackTransfer([block],[state.step(next)]);
}

/** Ordinary Cookery-style placement/pickup, retaining advanced stacks/filters.
 * Sneak keeps advanced bound swaps and clears an empty slot's filter empty-handed.
 * Re-read live native contents here; deferred events never own an item snapshot.
 */
function interactRackSlot(player,block,slot,sneaking=false){
 if(!Number.isInteger(slot)||slot<0||slot>=RACK_COMPARTMENTS||!rackInUseRange(player,block))return false;
 const c=rackContainer(block),inv=playerInventory(player),hot=player.selectedSlotIndex;
 if(!c||!inv||!Number.isInteger(hot)||hot<0||hot>=inv.size)return false;
 const stored=c.getItem(slot),held=inv.getItem(hot);
 let changed=false,action;
 if(sneaking&&!stored&&!held){changed=clearEmptySlotFilter(block,slot);action='clear_filter';}
 else if(stored&&(!held||sneaking)){
  changed=swapWithHotbar(player,block,slot);action=held?'swap':'pickup';
  if(changed&&c.getItem(slot)?.amount!==stored.amount)playRackSound(block,false);
 }else if(held){changed=depositSelected(player,block,slot);action='insert';if(changed)playRackSound(block,true);}
 if(changed)markStationContentsDirty(block);
 return changed?action:false;
}

function restorePlacedRack(block,item){
 const raw=item.getDynamicProperty(RACK_PAYLOAD_KEY),payload=readRackPayloadItem(item);
 if(raw!==undefined&&encodeRackPayload(payload.items,payload.filters)!==raw)
  throw new Error('Packed rack metadata cannot round-trip; refusing partial restore');
 const existing=readRackItems(block);
 if(existing.some(Boolean))throw new Error('Refusing to overwrite occupied backing inventory');
 if(!writeRackItems(block,payload.items)||!writeRackFilters(block,payload.filters)){
  quarantineStation(block,'packed placement commit incomplete');
  throw new Error('Packed rack restore incomplete; inventory quarantined');
 }
 syncRackDisplay(block);markStationContentsDirty(block);return true;
}

function scheduleRackPlacement(event){
 if(event.isFirstEvent===false||event.itemStack?.typeId!==ADVANCED_RACK_ITEM_ID)return;
 const snapshot=event.itemStack.clone(),dimension=event.block.dimension,player=event.player;
 const candidates=rackPlacementCandidates(event.block.location,event.blockFace)
  .map(location=>({location,wasRack:dimension.getBlock(location)?.typeId===ADVANCED_RACK_BLOCK_ID}));
 system.run(()=>{
  for(const row of candidates){
   if(row.wasRack)continue;
   const block=dimension.getBlock(row.location);
   if(block?.typeId===ADVANCED_RACK_BLOCK_ID){restorePlacedRack(block,snapshot);awardNeatAndOrderly(player);return}
  }
 });
}

function createRackDrop(block){
 const items=readRackItems(block),filters=readRackFilters(block);
 const drop=new ItemStack(ADVANCED_RACK_ITEM_ID,1);
 return writeRackPayloadItem(drop,items,filters);
}
function manuallyBreakRack(block,drop=true){
 if(!block||block.typeId!==ADVANCED_RACK_BLOCK_ID)return false;
 const dimension=block.dimension,location=loc(block),permutation=block.permutation;
 let items,filters,item,escrow;
 try{
  items=readRackItems(block);filters=readRackFilters(block);
  const raw=encodeRackPayload(items,filters);
  item=writeRackPayloadItem(new ItemStack(ADVANCED_RACK_ITEM_ID,1),items,filters);
  if(item.getDynamicProperty(RACK_PAYLOAD_KEY)!==raw)throw new Error('Packed rack payload was not saved');
  const check=readRackPayloadItem(item);
  if(encodeRackPayload(check.items,check.filters)!==raw)throw new Error('Rack item metadata cannot round-trip');
  if(drop)escrow=dimension.spawnItem(item,{x:location.x+.5,y:location.y+.35,z:location.z+.5});
 }catch(error){console.warn('[Grilling rack break preparation] '+error);return false}
 try{
  if(!clearRackItems(block)||!clearRackFilters(block))throw new Error('rack state commit failed');
  block.setType('minecraft:air');
 }catch(error){
  try{escrow?.remove()}catch(cleanup){quarantineStation(block,'escrow removal unconfirmed');console.warn('[Grilling rack quarantine] '+cleanup);return false}
  try{const live=dimension.getBlock(location);live.setPermutation(permutation);if(!writeRackItems(live,items)||!writeRackFilters(live,filters))throw new Error('rollback commit failed')}catch(restore){quarantineStation(block,'rollback incomplete');console.warn('[Grilling rack rollback] '+restore)}
  console.warn('[Grilling rack break] '+error);return false;
 }
 try{retireEmptyStationContainer(dimension.getBlock(location))}catch(error){console.warn('[Grilling storage retirement] '+error)}
 return true;
}

function nearestRack(player){
 const d=player.dimension,p=player.location;let best,bestD=RACK_RANGE*RACK_RANGE+.001;
 const ox=Math.floor(p.x),oy=Math.floor(p.y),oz=Math.floor(p.z);
 for(let x=ox-RACK_RANGE;x<=ox+RACK_RANGE;x++)for(let y=oy-RACK_RANGE;y<=oy+RACK_RANGE;y++)for(let z=oz-RACK_RANGE;z<=oz+RACK_RANGE;z++){
  const dx=x+.5-p.x,dy=y+.5-p.y,dz=z+.5-p.z,d2=dx*dx+dy*dy+dz*dz;
  if(d2>bestD)continue;
  const b=d.getBlock({x,y,z});if(b?.typeId!==ADVANCED_RACK_BLOCK_ID)continue;
  best=b;bestD=d2;
 }
 return best;
}

// Opt-in QA only. No identities, absolute coordinates, stack lore or metadata.
// Remove kg_rack_qa from the isolated tester to disable these content-log records.
function rackQa(player,stage,details={}){
 try{if(player.hasTag('kg_rack_qa'))console.warn('[Grilling rack QA] '+JSON.stringify({stage,...details}));}catch{}
}
onBlockInteraction('a2746_advanced_rack_runtime',event=>{
 const p=event.player;
 if(event.isFirstEvent!==false){
  const hit=event.faceLocation;
  rackQa(p,'target',{block:event.block.typeId,face:event.blockFace,
   hit:hit?{x:hit.x,y:hit.y,z:hit.z}:null,cancelled:!!event.cancel});
 }
 if(event.cancel){rackQa(p,'reject',{reason:'already_cancelled'});return;}
 if(event.block.typeId===ADVANCED_RACK_BLOCK_ID){
  event.cancel=true;
  if(event.isFirstEvent!==false){
   const d=event.block.dimension,l=loc(event.block),sneaking=p.isSneaking,
    facing=event.block.permutation.getState('minecraft:cardinal_direction'),
    hit=captureRackHit(p,event.block,event.blockFace,event.faceLocation),
    slot=rackSlotAtHit(facing,hit.point),intent=captureInteractionIntent(p,event.itemStack);
   rackQa(p,'resolved',{facing,slot,row:slot<0?'outside':slot<5?'seasoning':'tool',hand:intent.hand,
    mode:hit.mode,source:hit.source,headRelative:hit.origin,view:hit.direction,aimed:hit.aimed,used:hit.point??null});
   if(slot<0||intent.hand!=='main'){rackQa(p,'reject',{reason:slot<0?(hit.reason??'outside_hit_cells'):'non_main_hand'});return;}
   system.run(()=>{
    try{
     const live=resolveRack(d,l);
     const reason=p.isValid===false?'player_invalid':!live?'rack_missing':!rackInUseRange(p,live)?'out_of_range':
      p.isSneaking!==sneaking?'sneak_changed':live.permutation.getState('minecraft:cardinal_direction')!==facing?'facing_changed':
      !interactionIntentStillCurrent(p,intent)?'intent_changed':null;
     if(reason){rackQa(p,'reject',{reason});return;}
     // Read-only admission detail. Actual ownership still uses the transaction below.
     try{if(p.hasTag('kg_rack_qa')){
      const c=rackContainer(live),held=getMainHand(p),stored=c?.getItem(slot),filter=readRackFilters(live)[slot];
      rackQa(p,'admission',{slot,heldKind:held?rackItemKind(held.typeId,tags(held)):'empty',
       occupied:!!stored,filter:filter?.category??null,canPlace:held?rackCanPlace(slot,held.typeId,tags(held),filter):null});
     }}catch{rackQa(p,'admission',{reason:'diagnostic_read_failed'});}
     const action=interactRackSlot(p,live,slot,sneaking);
     rackQa(p,'result',{action:action||'no_transfer'});
    }catch(error){rackQa(p,'reject',{reason:'runtime_exception'});console.warn('[Grilling rack interaction] '+error)}
   });
  }
  return;
 }
 try{scheduleRackPlacement(event)}catch{}
},{"priority":70,"blocks":["kaleidoscope_grilling:advanced_rack_block"]});

onBeforeBlockBreak('rack/advanced_rack_runtime.js:0',event=>{
 if(event.cancel||event.block.typeId!==ADVANCED_RACK_BLOCK_ID)return;
 event.cancel=true;const row=rackBreakSnapshot(event.block),drop=!creative(event.player);
 system.run(()=>{try{const block=sameRackForBreak(row);if(block)manuallyBreakRack(block,drop)}catch(error){console.warn('[Grilling rack break identity] '+error)}});
});
onExplosion('rack/advanced_rack_runtime.js:0',event=>{
 try{if(event.cancel!==false)return}catch{return}
 const keep=[],racks=[];let protectedRack=false;
 for(const block of event.getImpactedBlocks()){
  if(block.typeId===ADVANCED_RACK_BLOCK_ID){protectedRack=true;try{racks.push(rackBreakSnapshot(block))}catch(error){console.warn('[Grilling rack explosion capture] retained '+error)}}else keep.push(block);
 }
 if(!protectedRack)return;
 event.setImpactedBlocks(keep);if(!racks.length)return;system.run(()=>{
  // The final event status belongs to every before-event subscriber. Keep a
  // cancelled/unreadable event and a replacement rack out of deferred payout.
  try{if(event.cancel!==false)return}catch(error){console.warn('[Grilling rack explosion status] '+error);return}
  for(const row of racks)try{const block=sameRackForBreak(row);if(block)manuallyBreakRack(block,true)}catch(error){console.warn('[Grilling rack explosion recovery] '+error)}
 });
});

system.beforeEvents.startup.subscribe(event=>{
 event.customCommandRegistry.registerCommand({
  name:'kaleidoscope_grilling:rack',
  description:'Return matching items to the nearest Advanced Rack within 8 blocks',
  permissionLevel:CommandPermissionLevel.Any,
  cheatsRequired:false
 },origin=>{
  const player=origin.sourceEntity;
  if(!player||player.typeId!=='minecraft:player')return;
  // Commands have no originating hand. Physical event ambiguity checks would
  // incorrectly reject unchanged identical items in both hands.
  const hand=captureStackIntentSnapshot(getMainHand(player)),hot=player.selectedSlotIndex,dimension=player.dimension.id;
  system.run(()=>{
   if(player.isValid===false||player.dimension.id!==dimension||player.selectedSlotIndex!==hot||
    !stackIntentSnapshotMatches(hand,getMainHand(player)))return;
   const rack=nearestRack(player);
   if(!rack)message(player,ui('not_found'));
   else if(depositMatching(player,rack)){playRackSound(rack,true);markStationContentsDirty(rack);}
  });
 });
});
