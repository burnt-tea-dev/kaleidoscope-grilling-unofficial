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
// The presentation producer owns these values and their clock. They travel
// beside the two hands, never in their integer words or another request.
// Paired contract: TACZ src/presentation/held-transport.json. View/action use
// at most 23 bits each, preserving exact binary32 integers for client decoding.
export const HELD_PRESENTATION_FIELDS=Object.freeze({
 view:Object.freeze({variable:'v.tacz_held_view',type:'int',min:0,max:8388607}),
 action:Object.freeze({variable:'v.tacz_held_action',type:'int',min:0,max:8388607}),
 offset:Object.freeze({variable:'v.tacz_held_offset',type:'float',min:0,max:10}),
 kickOffset:Object.freeze({variable:'v.tacz_held_kick_offset',type:'float',min:0,max:10}),
 mountScope:Object.freeze({variable:'v.tacz_held_mount_scope',type:'int',min:0,max:128}),
 mountMuzzle:Object.freeze({variable:'v.tacz_held_mount_muzzle',type:'int',min:0,max:128}),
 mountStock:Object.freeze({variable:'v.tacz_held_mount_stock',type:'int',min:0,max:128}),
 mountGrip:Object.freeze({variable:'v.tacz_held_mount_grip',type:'int',min:0,max:128}),
 mountLaser:Object.freeze({variable:'v.tacz_held_mount_laser',type:'int',min:0,max:128}),
 mountExtendedMag:Object.freeze({variable:'v.tacz_held_mount_extended_mag',type:'int',min:0,max:128}),
 scopeAdapter:Object.freeze({variable:'v.tacz_held_scope_adapter',type:'int',min:0,max:6}),
 scopeView:Object.freeze({variable:'v.tacz_held_scope_view',type:'int',min:0,max:1})
});
export const HELD_PRESENTATION_EMPTY=Object.freeze(Object.fromEntries(Object.keys(HELD_PRESENTATION_FIELDS).map(key=>[key,0])));
export const HELD_PRESENTATION_REQUEST='kaleidoscope_grilling:held_presentation_request';
export const HELD_PRESENTATION_RESPONSE='tacz:held_presentation_snapshot';
export const supportsHeldPresentation=typeId=>typeId==='tacz:kar98'||typeId==='tacz:m1866'||typeId==='tacz:hk_mk23';
export const variableName=(hand,index)=>'v.kg_held_'+(hand==='main'?'m':'o')+index;
export function heldSnapshotReadyMolang(owner='q'){
 const scope=owner.startsWith('c.owning_entity->')?'c.owning_entity->':'';
 const prop=owner+".property('"+FRAME_PROPERTY+"')";
 // The property authorizes a request; FRAME_VARIABLE identifies the last
 // complete client commit. Advancing the request must not clear that commit.
 return owner+".has_property('"+FRAME_PROPERTY+"') && "+prop+' > 0 && '+scope+FRAME_VARIABLE+' > 0';
}
export function heldWordMolang(hand,index,owner='q'){
 const scope=owner.startsWith('c.owning_entity->')?'c.owning_entity->':'';
 return '('+heldSnapshotReadyMolang(owner)+' ? '+scope+variableName(hand,index)+' : 0)';
}
function presentationPayload(presentation){
 const projection={};
 // This is the single side-payload trust boundary, before signatures or Molang.
 // Copy only contract fields; do not round, clamp or coerce producer values.
 for(const [key,field] of Object.entries(HELD_PRESENTATION_FIELDS)){
  const value=presentation?.[key];
  if(!Number.isFinite(value)||value<field.min||value>field.max||(field.type==='int'&&!Number.isInteger(value)))throw Error('Invalid held presentation '+key);
  projection[key]=value;
 }
 return projection;
}
function snapshotPayload(main,off,presentation){
 for(const words of [main,off])if(!Array.isArray(words)||words.length!==12||words.some(x=>!Number.isInteger(x)||x<0||x>WORD_MAX))throw Error('Invalid complete hand snapshot');
 return {main:[...main],off:[...off],presentation:presentationPayload(presentation)};
}
function molangNumber(value){
 // Keep the shortest round-tripping digits, without exponent syntax in Molang.
 const [coefficient,exponent]=String(value).split('e');
 if(exponent===undefined)return coefficient;
 const [whole,fraction='']=coefficient.split('.'),digits=whole+fraction,point=whole.length+Number(exponent);
 if(point<=0)return '0.'+'0'.repeat(-point)+digits;
 if(point>=digits.length)return digits+'0'.repeat(point-digits.length);
 return digits.slice(0,point)+'.'+digits.slice(point);
}
function expressionForSnapshot(frame,{main,off,presentation}){
 if(!Number.isInteger(frame)||frame<1||frame>FRAME_MAX)throw Error('Invalid held snapshot frame');
 const assignments=[...main.map((x,i)=>variableName('main',i)+'='+x+';'),...off.map((x,i)=>variableName('off',i)+'='+x+';'),
  ...Object.entries(HELD_PRESENTATION_FIELDS).map(([key,field])=>field.variable+'='+molangNumber(presentation[key])+';')].join('');
 const current="q.property('"+FRAME_PROPERTY+"')=="+frame;
 // Commit last in one evaluation. Old requests cannot overwrite a newer frame.
 // End this one-shot controller after commit; the refresh creates a new request.
 return current+'?{'+assignments+FRAME_VARIABLE+'='+frame+';};return '+current+';';
}
export function snapshotExpression(frame,main,off,presentation=HELD_PRESENTATION_EMPTY){
 return expressionForSnapshot(frame,snapshotPayload(main,off,presentation));
}
export function createSnapshotPublisher(currentTick=()=>0){
 const states=new Map();
 function send(player,snapshot,players){
  player.playAnimation(SNAPSHOT_ANIMATION,{controller:SNAPSHOT_CONTROLLER,blendOutTime:0,
   stopExpression:snapshot.expression,...(players===undefined?{}:{players})});
 }
 return {
  publish(player,main,off,presentation=HELD_PRESENTATION_EMPTY){
   const payload=snapshotPayload(main,off,presentation);
   const signature=JSON.stringify(payload);
   let state=states.get(player.id);
   if(!state){
    const saved=player.getProperty?.(FRAME_PROPERTY);
    state={frame:Number.isInteger(saved)&&saved>=0&&saved<=FRAME_MAX?saved:0};states.set(player.id,state);
   }
   // A failed newer submit may already have changed the native frame. Rebuild
   // even when the hand returns to older sent data, rather than leaving it stale.
   if(!state.pending&&state.sent?.signature===signature){
    if(currentTick()-state.lastBroadcastTick<REFRESH_TICKS)return false;
    // A failed refresh is pending too. Replay must not claim that an older
    // successful send completed this attempt.
    state.pending=state.sent;
   }
   if(state.pending?.signature!==signature){
    const frame=state.frame===FRAME_MAX?1:state.frame+1;state.frame=frame;
    state.pending={frame,signature,payload,expression:expressionForSnapshot(frame,payload)};
   }
   const next=state.pending;
   player.setProperty(FRAME_PROPERTY,next.frame);
   send(player,next);
   state.sent=next;state.pending=undefined;state.lastBroadcastTick=currentTick();return true;
  },
  replay(player,players){
   const state=states.get(player.id);if(!state?.sent||state.pending)return false;
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
let presentationSource;
let presentationSequence=0;
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
// Installed inside this BP by the dispatcher. Returning false defers an old
// projection until the native cross-pack reply, including food's tick flush.
export function configureHeldPresentation({sync}){
 if(typeof sync!=='function')throw Error('Invalid held presentation source');
 presentationSource={sync};
}
function heldVisualState(playerId){
 let state=cache.get(playerId);
 if(!state){state={hands:new Map(),presentation:HELD_PRESENTATION_EMPTY};cache.set(playerId,state);}
 return state;
}
// Only stage a detached complete projection. Validation belongs to the shared
// publisher; a bad projection fails the flush and cannot enter a request.
export function stageHeldPresentation(player,snapshot){
 const state=heldVisualState(player.id);
 const presentation=Object.fromEntries(Object.keys(HELD_PRESENTATION_FIELDS).map(key=>[key,snapshot?.[key]]));
 if(Object.keys(HELD_PRESENTATION_FIELDS).every(key=>state.presentation[key]===presentation[key]))return false;
 state.presentation=presentation;return true;
}
export function clearHeldPresentation(player){
 const state=cache.get(player.id);if(state)state.presentationRequest=undefined;
 stageHeldPresentation(player,HELD_PRESENTATION_EMPTY);
}
export function forgetHeldVisual(playerId){cache.delete(playerId);publisher.forget(playerId);}
export function requestHeldPresentation(player,viewers){
 const state=heldVisualState(player.id);
 const itemId=player.getComponent('minecraft:inventory')?.container.getItem(player.selectedSlotIndex)?.typeId;
 let request=state.presentationRequest;
 if(!request||request.slot!==player.selectedSlotIndex||request.dimensionId!==player.dimension.id||request.itemId!==itemId){
  request={epoch:++presentationSequence,slot:player.selectedSlotIndex,dimensionId:player.dimension.id,itemId,lastAccepted:0};
  state.presentationRequest=request;
  state.presentation=HELD_PRESENTATION_EMPTY;
 }
 request.lastIssued=++presentationSequence;
 return {defer:request.lastAccepted>0,row:{api:1,epoch:request.epoch,request:request.lastIssued,
  slot:request.slot,dimensionId:request.dimensionId,itemId:request.itemId,viewerIds:viewers?.map(viewer=>viewer.id)??null}};
}
// This is the native receive boundary. No sender-supplied expression, animation
// name or foreign ItemStack DP is consumed. The engine has no sending-pack UUID.
export function receiveHeldPresentation(event,currentTick,resolveViewer){
 if(event.id!==HELD_PRESENTATION_RESPONSE||!['Entity','Server'].includes(event.sourceType))return false;
 const player=event.sourceEntity;
 if(player?.typeId!=='minecraft:player'||!player.isValid||typeof event.message!=='string'||event.message.length>2048)return false;
 let row;try{row=JSON.parse(event.message)}catch{return false}
 const state=cache.get(player.id),request=state?.presentationRequest;
 if(!row||row.api!==1||!request||row.epoch!==request.epoch||
    !Number.isSafeInteger(row.request)||row.request<=request.lastAccepted||row.request>request.lastIssued||
    row.slot!==request.slot||row.slot!==player.selectedSlotIndex||
    row.dimensionId!==request.dimensionId||row.dimensionId!==player.dimension.id||row.itemId!==request.itemId)return false;
 if(row.viewerIds!==null&&(!Array.isArray(row.viewerIds)||row.viewerIds.some(id=>typeof id!=='string'||id.length>128)))return false;
 if(player.getComponent('minecraft:health')?.currentValue<=0||!supportsHeldPresentation(row.itemId)||
    player.getComponent('minecraft:inventory')?.container.getItem(player.selectedSlotIndex)?.typeId!==row.itemId)return false;
 const projection=presentationPayload(row.snapshot);
 const viewers=row.viewerIds?.map(resolveViewer).filter(viewer=>viewer?.typeId==='minecraft:player'&&viewer.isValid&&viewer.dimension.id===player.dimension.id);
 state.presentation=projection;request.lastAccepted=row.request;
 tick=currentTick;
 // Publish directly, without issuing another request. On failure the original
 // publisher retains pending; no targeted replay can bypass that failure.
 publishHeldVisualState(player);
 return viewers===undefined?true:publisher.replay(player,viewers);
}
export function invalidateHeldVisual(player,hand){
 heldVisualPropertyNames(hand);
 const hands=heldVisualState(player.id).hands;
 hands.set(hand,{kind:'invalid',values:[...Array(11).fill(0),HELD_VISUAL_INVALID]});
}
// Providers stage both hands before the shared dispatcher sends one snapshot.
// Invalidation hides a failed provider without changing its ItemStack metadata.
function publishHeldVisualState(player){
 const state=cache.get(player.id);if(!state)return false;
 const hands=state.hands;
 return publisher.publish(player,hands.get('main')?.values??HELD_VISUAL_EMPTY,hands.get('off')?.values??HELD_VISUAL_EMPTY,state.presentation);
}
export function flushHeldVisual(player,currentTick){
 tick=currentTick;
 if(presentationSource?.sync(player)===false)return false;
 return publishHeldVisualState(player);
}
export function replayHeldVisual(player,viewers,currentTick=tick){
 tick=currentTick;
 if(presentationSource?.sync(player,viewers)===false)return false;
 publishHeldVisualState(player);
 return publisher.replay(player,viewers);
}

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
 const hands=heldVisualState(player.id).hands;
 const previous=hands.get(hand);
 if(previous?.kind===kind&&values.every((v,i)=>v===previous.values[i]))return false;
 hands.set(hand,{kind,values:[...values]});
 return true;
}
