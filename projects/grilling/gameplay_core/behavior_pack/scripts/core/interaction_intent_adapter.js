import {getMainHand,getOffHand,captureWritableHand} from './player_io.js';
import {stackIntentSignature,captureStackIntentSnapshot,stackIntentSnapshotMatches} from './interaction_intent_core.js';
import {makeTwoHandIntent,sameTwoHandIntent} from './intent_core.js';
import {
 primitiveStackProps,captureInteractionIntentFromStacks,interactionIntentMatchesStacks
} from './interaction_intent_core.js';

export {primitiveStackProps};

export function captureInteractionIntent(player,eventStack){
 return captureInteractionIntentFromStacks(eventStack,getMainHand(player),getOffHand(player),player.selectedSlotIndex);
}

export function interactionIntentStillCurrent(player,intent){
 return interactionIntentMatchesStacks(intent,getMainHand(player),getOffHand(player),player.selectedSlotIndex);
}

// A threading/disassembly gesture owns BOTH hands, not just its event item.
const twoHandSnapshots=new WeakMap();
export function captureTwoHandIntent(player){
 try{
  if(!player.isValid)return null;
  // Native clones retain restricted capabilities without reading them here.
  // Keep transactional capture strict: tolerant display getters can mask faults.
  const main=captureWritableHand(player,'main').before,off=captureWritableHand(player,'off').before;
  const intent=makeTwoHandIntent(stackIntentSignature(main),stackIntentSignature(off),
   player.selectedSlotIndex,player.dimension.id,player.isSneaking);
  const snapshots={main:captureStackIntentSnapshot(main),off:captureStackIntentSnapshot(off)};
  if(!intent||!snapshots.main.readable||!snapshots.off.readable)return null;
  twoHandSnapshots.set(intent,snapshots);return intent;
 }catch{return null}
}
export function twoHandIntentStillCurrent(player,intent){
 const saved=twoHandSnapshots.get(intent),current=captureTwoHandIntent(player);
 const now=current&&twoHandSnapshots.get(current);
 return !!saved&&!!now&&sameTwoHandIntent(intent,current)
  &&stackIntentSnapshotMatches(saved.main,now.main.stack)&&stackIntentSnapshotMatches(saved.off,now.off.stack);
}
