// Experimental C-1 transport. Production still uses the 27-property protocol.
// Keep this isolated until client-owned variables and re-entry are observed.
export const FRAME_PROPERTY='kg_snapshot_probe:frame';
export const FRAME_MAX=1000000;
export const FRAME_VARIABLE='v.kg_snapshot_frame';
export const SNAPSHOT_ANIMATION='animation.kg_snapshot_probe.carrier';
export const SNAPSHOT_CONTROLLER='controller.animation.kg_snapshot_probe.carrier';
export const WORD_MAX=684244;
export const variableName=(hand,index)=>'v.kg_snapshot_'+(hand==='main'?'m':'o')+index;
export function snapshotExpression(frame,main,off){
 if(!Number.isInteger(frame)||frame<1||frame>FRAME_MAX)throw Error('Invalid snapshot frame');
 for(const words of [main,off])if(!Array.isArray(words)||words.length!==12||words.some(x=>!Number.isInteger(x)||x<0||x>WORD_MAX))throw Error('Invalid complete hand snapshot');
 const assignments=[...main.map((x,i)=>variableName('main',i)+'='+x+';'),...off.map((x,i)=>variableName('off',i)+'='+x+';')].join('');
 // A late old controller may not overwrite the current frame. Publish the
 // frame variable last, after all 24 words, in the same Molang evaluation.
 return "q.property('"+FRAME_PROPERTY+"')=="+frame+'?{'+assignments+FRAME_VARIABLE+'='+frame+';};return 0;';
}
export function createSnapshotPublisher(){
 const states=new Map();
 function send(player,snapshot,players){
  player.playAnimation(SNAPSHOT_ANIMATION,{controller:SNAPSHOT_CONTROLLER,blendOutTime:0,
   stopExpression:snapshot.expression,...(players===undefined?{}:{players})});
 }
 return {
  publish(player,main,off){
   // Validation also bounds every interpolated token to an integer literal.
   snapshotExpression(1,main,off);
   const signature=JSON.stringify([main,off]);
   let state=states.get(player.id);
   if(!state){state={frame:0};states.set(player.id,state);}
   if(state.sent?.signature===signature)return false;
   if(state.pending?.signature!==signature){
    const frame=state.frame===FRAME_MAX?1:state.frame+1;state.frame=frame;
    state.pending={frame,signature,expression:snapshotExpression(frame,main,off)};
   }
   const next=state.pending;
   player.setProperty(FRAME_PROPERTY,next.frame);
   send(player,next);
   state.sent=next;state.pending=undefined;
   return true;
  },
  replay(player,players){
   const state=states.get(player.id);if(!state?.sent)return false;
   send(player,state.sent,players);return true;
  },
  forget(playerId){states.delete(playerId);}
 };
}
