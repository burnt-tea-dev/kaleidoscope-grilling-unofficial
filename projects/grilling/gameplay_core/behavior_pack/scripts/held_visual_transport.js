import {SLIME_ID,SLIME_FRAME_MARKER_MIN,SLIME_FRAME_MARKER_MAX} from './slime_frame_core.js';
import {isFailureSkewer,FAILURE_VISUAL_MARKER} from './failure_skewer_visual_core.js';
import {canonicalFoodId} from './eating_profile_ids.js';
import {isBottleHeldVisualItem} from './bottle_held_visual_core.js';
import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';


// Item metadata remains authoritative. These variables are rebuilt on client
// actor creation; playAnimation is a request, not persistent client storage.
export const FRAME_PROPERTY=PersistedKey.HELD_FRAME;
export const FRAME_MAX=1000000;
export const FRAME_VARIABLE='v.kg_held_frame';
export const SNAPSHOT_ANIMATION='animation.kg_held_snapshot.carrier';
export const SNAPSHOT_CONTROLLER='controller.animation.kg_held_snapshot.carrier';
export const WORD_MAX=684244;
export const REFRESH_TICKS=100;
export const variableName=(hand,index)=>'v.kg_held_'+(hand==='main'?'m':'o')+index;
export function heldWordMolang(hand,index,owner='q'){
 const scope=owner.startsWith('c.owning_entity->')?'c.owning_entity->':'';
 const prop=owner+".property('"+FRAME_PROPERTY+"')";
 const ready=owner+".has_property('"+FRAME_PROPERTY+"') && "+prop+' > 0 && '+scope+FRAME_VARIABLE+' == '+prop;
 return '('+ready+' ? '+scope+variableName(hand,index)+' : 0)';
}
export function snapshotExpression(frame,main,off){
 if(!Number.isInteger(frame)||frame<1||frame>FRAME_MAX)throw Error('Invalid held snapshot frame');
 for(const words of [main,off])if(!Array.isArray(words)||words.length!==12||words.some(x=>!Number.isInteger(x)||x<0||x>WORD_MAX))throw Error('Invalid complete hand snapshot');
 const assignments=[...main.map((x,i)=>variableName('main',i)+'='+x+';'),...off.map((x,i)=>variableName('off',i)+'='+x+';')].join('');
 const current="q.property('"+FRAME_PROPERTY+"')=="+frame;
 // Commit last in one evaluation. Old requests cannot overwrite a newer frame.
 // End this one-shot controller after commit; the refresh creates a new request.
 return current+'?{'+assignments+FRAME_VARIABLE+'='+frame+';};return '+current+';';
}
export function createSnapshotPublisher(currentTick=()=>0){
 const states=new Map();
 function send(player,snapshot,players){
  player.playAnimation(SNAPSHOT_ANIMATION,{controller:SNAPSHOT_CONTROLLER,blendOutTime:0,
   stopExpression:snapshot.expression,...(players===undefined?{}:{players})});
 }
 return {
  publish(player,main,off){
   snapshotExpression(1,main,off);
   const signature=JSON.stringify([main,off]);
   let state=states.get(player.id);
   if(!state){
    const saved=player.getProperty?.(FRAME_PROPERTY);
    state={frame:Number.isInteger(saved)&&saved>=0&&saved<=FRAME_MAX?saved:0};states.set(player.id,state);
   }
   // A failed newer submit may already have changed the native frame. Rebuild
   // even when the hand returns to older sent data, rather than leaving it hidden.
   if(!state.pending&&state.sent?.signature===signature){
    if(currentTick()-state.lastBroadcastTick<REFRESH_TICKS)return false;
    send(player,state.sent);state.lastBroadcastTick=currentTick();return true;
   }
   if(state.pending?.signature!==signature){
    const frame=state.frame===FRAME_MAX?1:state.frame+1;state.frame=frame;
    state.pending={frame,signature,expression:snapshotExpression(frame,main,off)};
   }
   const next=state.pending;
   player.setProperty(FRAME_PROPERTY,next.frame);
   send(player,next);
   state.sent=next;state.pending=undefined;state.lastBroadcastTick=currentTick();return true;
  },
  replay(player,players){
   const state=states.get(player.id);if(!state?.sent)return false;
   send(player,state.sent,players);return true;
  },
  forget(playerId){states.delete(playerId);}
 };
}

// A hand can hold only one
// of these items, so its existing twelve presentation channels have one owner.
// Authoritative ItemStacks/world metadata are never written by this transport.
export const HELD_VISUAL_INVALID=254;
export const HELD_VISUAL_BOTTLE=214;
export const HELD_VISUAL_PLATE=255;
export const HELD_VISUAL_WORD_MAX=684244;
export const HELD_VISUAL_EMPTY=Object.freeze(Array(12).fill(0));
const cache=new Map();
let tick=0;
const publisher=createSnapshotPublisher(()=>tick);
const names=Object.freeze(Object.fromEntries(['main','off'].map(hand=>[hand,Object.freeze([
 ...Array.from({length:8},(_,i)=>PersistedKey.BOTTLE_PREFIX+hand+'_'+i),
 ...Array.from({length:3},(_,i)=>PersistedKey.SECRET_PREFIX+hand+'_'+i),
 PersistedKey.SECRET_PREFIX+hand+'_piece'
])])));

export function heldVisualKind(typeId){
 if(typeId==='kaleidoscope_cookery:oil_pot'||typeId==='kaleidoscope_cookery:oil_pot_filled')return 'oilbrush';
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
export function forgetHeldVisual(playerId){cache.delete(playerId);publisher.forget(playerId);}
export function invalidateHeldVisual(player,hand){
 heldVisualPropertyNames(hand);
 let hands=cache.get(player.id);if(!hands){hands=new Map();cache.set(player.id,hands);}
 hands.set(hand,{kind:'invalid',values:[...Array(11).fill(0),HELD_VISUAL_INVALID]});
}
// Providers stage both hands before the shared dispatcher sends one snapshot.
// Invalidation hides a failed provider without changing its ItemStack metadata.
export function flushHeldVisual(player,currentTick){
 tick=currentTick;const hands=cache.get(player.id);if(!hands)return false;
 return publisher.publish(player,hands.get('main')?.values??HELD_VISUAL_EMPTY,hands.get('off')?.values??HELD_VISUAL_EMPTY);
}
export function replayHeldVisual(player,viewers){return publisher.replay(player,viewers);}

export function writeHeldVisual(player,hand,kind,values){
 heldVisualPropertyNames(hand);
 if(!Array.isArray(values)||values.length!==12||values.some(v=>!Number.isInteger(v)||v<0||v>HELD_VISUAL_WORD_MAX))
  throw Error('Grilling: invalid held visual payload');
 const marker=values[11];
 if(!((kind==='plate'&&marker===HELD_VISUAL_PLATE&&values[10]<=5)||
      (kind==='bottle'&&marker===HELD_VISUAL_BOTTLE)||
      (kind==='oilpot'&&marker===226&&values[0]<=4&&values.slice(1,11).every(v=>v===0))||
      (kind==='oilbrush'&&marker===225&&values[0]>=1&&values[0]<=60&&values.slice(1,11).every(v=>v===0))||
      (kind==='failure'&&marker===FAILURE_VISUAL_MARKER&&values[0]<=19&&values[1]<=63&&values[2]<=225&&values.slice(3,11).every(v=>v===0))||
      (kind==='slime'&&marker>=SLIME_FRAME_MARKER_MIN&&marker<=SLIME_FRAME_MARKER_MAX&&values.slice(0,11).every(v=>v===0))||
      (kind==='secret'&&(marker<=213||(marker>=221&&marker<=224)||(marker>=227&&marker<=234)))||(kind==='empty'&&values.every(v=>v===0))))
  throw Error('Grilling: invalid held visual owner');
 let hands=cache.get(player.id);if(!hands){hands=new Map();cache.set(player.id,hands);}
 const previous=hands.get(hand);
 if(previous?.kind===kind&&values.every((v,i)=>v===previous.values[i]))return false;
 hands.set(hand,{kind,values:[...values]});
 return true;
}
