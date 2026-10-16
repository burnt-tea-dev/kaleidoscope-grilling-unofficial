import {SLIME_ID,SLIME_FRAME_MARKER_MIN,SLIME_FRAME_MARKER_MAX} from './slime_frame_core.js';
import {isFailureSkewer,FAILURE_VISUAL_MARKER} from './failure_skewer_visual_core.js';
import {canonicalFoodId} from './eating_profile_ids.js';
import {isBottleHeldVisualItem} from './bottle_held_visual_core.js';

// The player already uses all 32 entity properties. A hand can hold only one
// of these items, so its existing twelve presentation channels have one owner.
// Authoritative ItemStacks/world metadata are never written by this transport.
export const HELD_VISUAL_INVALID=254;
export const HELD_VISUAL_BOTTLE=214;
export const HELD_VISUAL_PLATE=255;
export const HELD_VISUAL_WORD_MAX=682708;
export const HELD_VISUAL_EMPTY=Object.freeze(Array(12).fill(0));
const cache=new Map();
const names=Object.freeze(Object.fromEntries(['main','off'].map(hand=>[hand,Object.freeze([
 ...Array.from({length:8},(_,i)=>'kaleidoscope_grilling:bottle_'+hand+'_'+i),
 ...Array.from({length:3},(_,i)=>'kaleidoscope_grilling:secret_'+hand+'_'+i),
 'kaleidoscope_grilling:secret_'+hand+'_piece'
])])));

export function heldVisualKind(typeId){
 if(typeId===SLIME_ID)return 'slime';
 if(typeId==='kaleidoscope_grilling:skewer_plate')return 'plate';
 const id=canonicalFoodId(typeId);
 if(isFailureSkewer(id))return 'failure';
 if(id==='kaleidoscope_grilling:secret_skewer'||id==='kaleidoscope_grilling:unfinished_skewer')return 'secret';
 return isBottleHeldVisualItem(typeId)?'bottle':'empty';
}
export function heldVisualPropertyNames(hand){
 const result=names[hand];if(!result)throw Error('Grilling: invalid held visual hand');return result;
}
export function forgetHeldVisual(playerId){cache.delete(playerId);}
export function invalidateHeldVisual(player,hand){
 cache.get(player.id)?.delete(hand);
 player.setProperty(heldVisualPropertyNames(hand)[11],HELD_VISUAL_INVALID);
}

// One cache for all former writers: switching from a plate back to an identical
// bottle/secret stack must still replace the values that the plate borrowed.
// Invalidate before payload writes; publish the owner last. A thrown write
// leaves no successful cache entry and does not proceed to the ready write.
// This orders server submissions; it cannot certify atomic same-frame delivery
// of separate native properties to a client.
export function writeHeldVisual(player,hand,kind,values){
 const keys=heldVisualPropertyNames(hand);
 if(!Array.isArray(values)||values.length!==12||values.some(v=>!Number.isInteger(v)||v<0||v>HELD_VISUAL_WORD_MAX))
  throw Error('Grilling: invalid held visual payload');
 const marker=values[11];
 if(!((kind==='plate'&&marker===HELD_VISUAL_PLATE&&values[10]<=5)||
      (kind==='bottle'&&marker===HELD_VISUAL_BOTTLE)||
      (kind==='failure'&&marker===FAILURE_VISUAL_MARKER&&values[0]<=19&&values[1]<=63&&values[2]<=213&&values.slice(3,11).every(v=>v===0))||
      (kind==='slime'&&marker>=SLIME_FRAME_MARKER_MIN&&marker<=SLIME_FRAME_MARKER_MAX&&values.slice(0,11).every(v=>v===0))||
      (kind==='secret'&&marker<=213)||(kind==='empty'&&values.every(v=>v===0))))
  throw Error('Grilling: invalid held visual owner');
 let hands=cache.get(player.id);if(!hands){hands=new Map();cache.set(player.id,hands);}
 const previous=hands.get(hand);
 if(previous?.kind===kind&&values.every((v,i)=>v===previous.values[i]))return false;
 hands.delete(hand);
 // Slime's complete state fits in its discriminant. No multiword frame can tear.
 if(kind==='slime'&&previous?.kind==='slime'){
  player.setProperty(keys[11],marker);
  hands.set(hand,{kind,values:[...values]});
  return true;
 }
 player.setProperty(keys[11],HELD_VISUAL_INVALID);
 for(let i=0;i<11;i++)if(!previous||values[i]!==previous.values[i])player.setProperty(keys[i],values[i]);
 player.setProperty(keys[11],marker);
 hands.set(hand,{kind,values:[...values]});
 return true;
}
