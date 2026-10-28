// Sound lifecycle only. Callbacks are native sound handles, never inventory writes.
export const GRILL_LOOP_TICKS=569; // Released OGG: 28.416 s; do not overlap tails.
export const GRILL_AUDIO_STALE_TICKS=8;
export function stopSoundHandle(handle){
 if(!handle)return;
 try{handle.stop()}catch{} // A completed/unloaded native instance may already be gone.
}
/** Java has a moving local shake instance and a separate, uncancelled world
 * one-shot for observers. The local Bedrock request deliberately has no fixed
 * location. Observers retain the independent Java world one-shot. */
export function playSeasoningShakeAudio(player,observers,origin){
 let local;
 try{local=player.playSound('kg_imm.shake_seasoning',{volume:.8,pitch:1})}catch{}
 if(origin)for(const observer of observers){
  if(observer.id===player.id)continue;
  try{observer.playSound('kg_imm.shake_seasoning',{location:origin,volume:.8,pitch:1})}catch{}
 }
 // Only the local sound is cancelled on release; observers hear the one-shot.
 return local;
}
export function createGrillAudioController({play,stop=stopSoundHandle,repeatTicks=GRILL_LOOP_TICKS,staleTicks=GRILL_AUDIO_STALE_TICKS,nativeLoop=false}){
 const active=new Map();
 return {
  update(key,station,isActive,tick){
   let row=active.get(key);
   if(!isActive){if(row){stop(row.handle);active.delete(key)}return false}
   if(!row){row={handle:undefined,next:tick,seen:tick};active.set(key,row)}
   row.seen=tick;
   // Infinite native loops must keep a strong reference to their own handle.
   // Do not periodically restart them using a duration converted to game ticks.
   if(nativeLoop&&row.handle)return false;
   if(tick<row.next)return false;
   // Retire only this station's sound, never all sounds of the same type.
   stop(row.handle);row.handle=undefined;row.next=tick+20;
   try{
    row.handle=play(station);
    if(nativeLoop&&!row.handle)throw Error('Native loop did not return a sound handle');
    row.next=tick+repeatTicks;return true;
   }
   catch{return false} // Bounded retry; audio cannot abort a gameplay transaction.
  },
  sweep(tick){
   for(const [key,row] of active)if(tick-row.seen>staleTicks){stop(row.handle);active.delete(key)}
  },
  remove(key){const row=active.get(key);if(row){stop(row.handle);active.delete(key)}},
  get size(){return active.size}
 };
}
