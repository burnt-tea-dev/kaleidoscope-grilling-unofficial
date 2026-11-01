// Experimental C-1 transport. Production still uses the 27-property protocol.
// Keep this isolated until client-owned variables and re-entry are observed.
export const FRAME_PROPERTY='kg_snapshot_probe:frame';
export const FRAME_MAX=1000000;
export const FRAME_VARIABLE='v.kg_snapshot_frame';
export const SNAPSHOT_ANIMATION='animation.kg_snapshot_probe.carrier';
export const SNAPSHOT_CONTROLLER='controller.animation.kg_snapshot_probe.carrier';
export const WORD_MAX=684244;
export const REFRESH_TICKS=100;
export const FP_OFFSET_VARIABLE='v.kg_snapshot_fp_offset';
export const FP_OFFSETS=Object.freeze([0,4,8]);
export const variableName=(hand,index)=>'v.kg_snapshot_'+(hand==='main'?'m':'o')+index;
export function snapshotExpression(frame,main,off,fpOffset=0){
 if(!Number.isInteger(frame)||frame<1||frame>FRAME_MAX)throw Error('Invalid snapshot frame');
 for(const words of [main,off])if(!Array.isArray(words)||words.length!==12||words.some(x=>!Number.isInteger(x)||x<0||x>WORD_MAX))throw Error('Invalid complete hand snapshot');
 if(!FP_OFFSETS.includes(fpOffset))throw Error('Use first-person diagnostic offset 0, 4 or 8');
 const assignments=[...main.map((x,i)=>variableName('main',i)+'='+x+';'),...off.map((x,i)=>variableName('off',i)+'='+x+';')].join('');
 // A late old controller may not overwrite the current frame. Publish the
 // frame variable last, after all 24 words, in the same Molang evaluation.
 // Stop after this frame commits. A later refresh installs a fresh one-shot
 // request instead of keeping every historical expression alive indefinitely.
 const current="q.property('"+FRAME_PROPERTY+"')=="+frame;
 return current+'?{'+assignments+FP_OFFSET_VARIABLE+'='+fpOffset+';'+FRAME_VARIABLE+'='+frame+';};return '+current+';';
}
export function createSnapshotPublisher(currentTick=()=>0){
 const states=new Map();
 function send(player,snapshot,players){
  player.playAnimation(SNAPSHOT_ANIMATION,{controller:SNAPSHOT_CONTROLLER,blendOutTime:0,
   stopExpression:snapshot.expression,...(players===undefined?{}:{players})});
 }
 return {
  publish(player,main,off,fpOffset=0){
   // Validation also bounds every interpolated token to an integer literal.
   snapshotExpression(1,main,off,fpOffset);
   const signature=JSON.stringify([main,off,fpOffset]);
   let state=states.get(player.id);
   if(!state){state={frame:0,broadcasts:0,refreshes:0,replays:0};states.set(player.id,state);}
   if(state.sent?.signature===signature){
    // playAnimation submits a client request, not a persistent property. A
    // viewer can recreate its actor after the join-time request was sent.
    if(currentTick()-state.lastBroadcastTick<REFRESH_TICKS)return false;
    send(player,state.sent);
    state.lastBroadcastTick=currentTick();state.broadcasts++;state.refreshes++;
    return true;
   }
   if(state.pending?.signature!==signature){
    const frame=state.frame===FRAME_MAX?1:state.frame+1;state.frame=frame;
    state.pending={frame,signature,expression:snapshotExpression(frame,main,off,fpOffset)};
   }
   const next=state.pending;
   player.setProperty(FRAME_PROPERTY,next.frame);
   send(player,next);
   state.sent=next;state.pending=undefined;state.lastBroadcastTick=currentTick();state.broadcasts++;
   return true;
  },
  replay(player,players){
   const state=states.get(player.id);if(!state?.sent)return false;
   send(player,state.sent,players);state.replays++;return true;
  },
  inspect(playerId){
   const state=states.get(playerId);if(!state?.sent)return undefined;
   const [main,off,fpOffset]=JSON.parse(state.sent.signature);
   return {frame:state.sent.frame,main,off,fpOffset,broadcasts:state.broadcasts,refreshes:state.refreshes,replays:state.replays,lastBroadcastTick:state.lastBroadcastTick,expressionCharacters:state.sent.expression.length};
  },
  forget(playerId){states.delete(playerId);}
 };
}
