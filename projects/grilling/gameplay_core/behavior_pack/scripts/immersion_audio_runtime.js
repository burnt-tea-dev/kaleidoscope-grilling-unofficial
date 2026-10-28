import {flatulenceSoundOrigin as seasoningFinishSoundOrigin} from './flatulence_sound_runtime.js';
export const SEASONING_FINISH_SOUND_ID='kg_java21.seasoning_finished';
import {interactionParticleBurst} from './immersion_particles_runtime.js';
import {system} from '@minecraft/server';
import {createGrillAudioController,playSeasoningShakeAudio,stopSoundHandle} from './immersion_audio_core.js';

const stationKey=block=>[block.dimension.id,block.x,block.y,block.z].join('|');
const center=block=>({x:block.x+.5,y:block.y+.35,z:block.z+.5});
const grillAudio=createGrillAudioController({nativeLoop:true,play:({dimension,location})=>
 dimension.playSound('kg_imm.grill_loop',location,{volume:.65,pitch:1,loopCount:-1})});
export function updateGrillAudio(block,lit,count){
 grillAudio.update(stationKey(block),{dimension:block.dimension,location:center(block)},!!lit&&count>0,system.currentTick);
}
export function removeGrillAudio(block){grillAudio.remove(stationKey(block))}
// Block ticks cease when a chunk unloads. Drop and stop stale native handles.
system.runInterval(()=>grillAudio.sweep(system.currentTick),4);
export function blockSound(block,id,volume=1,pitch=1){
 try{return block.dimension.playSound('kg_imm.'+id,center(block),{volume,pitch})}catch{}
}
export function useSound(player,id,volume=1,pitch=1){
 try{return player.dimension.playSound('kg_imm.'+id,player.location,{volume,pitch})}catch{}
}
export function seasoningShakeSound(player){
 let observers=[];try{observers=player.dimension.getPlayers()}catch{}
 return playSeasoningShakeAudio(player,observers,seasoningFinishSoundOrigin(player));
}
export function seasoningFinished(player){
 const dimension=player.dimension;
 interactionParticleBurst(dimension,player.location,'seasoningFinished');
 // Java retains its level argument, then reads the current BlockPos for sound.
 const origin=seasoningFinishSoundOrigin(player);
 if(origin)try{dimension.playSound(SEASONING_FINISH_SOUND_ID,origin,{volume:.8,pitch:1})}catch{}
}
export {stopSoundHandle};
