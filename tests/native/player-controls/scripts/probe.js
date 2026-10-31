import {GameMode,system,world} from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';
import {CONTROLS_PROPERTY,decodeControls,updatePlayerPresentation,resetPlayerPresentation,clearEatingPresentation,forgetPlayerPresentation} from './core/player_props.js';
const TAG='[Grilling player-controls probe]';
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const emit=value=>console.warn(TAG+' '+JSON.stringify(value));
function check(ok,message){if(!ok)throw Error(message);}
system.run(async()=>{
 let player;
 try{
  const dimension=world.getDimension('overworld');
  let loaded=false;
  for(let attempt=0;attempt<40;attempt++){
   try{loaded=!!dimension.getBlock({x:2,y:79,z:66});}catch{}
   if(loaded)break;
   await wait(5);
  }
  check(loaded,'isolated chunk unavailable');
  dimension.getBlock({x:2,y:79,z:66}).setType('minecraft:stone');
  player=gameTest.spawnSimulatedPlayer({dimension,x:2.5,y:80,z:66.5},'ControlProbe',GameMode.Survival);
  resetPlayerPresentation(player);await wait(2);
  check(player.getProperty(CONTROLS_PROPERTY)===0,'neutral initialization');
  updatePlayerPresentation(player,{eat_profile:5,eat_hand:2,eat_native_ticks:72000,eat_elapsed_ticks:72000});
  updatePlayerPresentation(player,{season_hand:1,season_phase:10,pending_hand:2,eat_projection:true});
  const immediate=player.getProperty(CONTROLS_PROPERTY);
  await wait(2);
  const state=decodeControls(player.getProperty(CONTROLS_PROPERTY));
  check(state.eat_profile===5&&state.eat_hand===2&&state.eat_projection&&state.season_hand===1&&state.season_phase===10&&state.pending_hand===2,'same-tick fields lost');
  check(player.getProperty('kaleidoscope_grilling:eat_native_ticks')===72000&&player.getProperty('kaleidoscope_grilling:eat_elapsed_ticks')===72000,'clock range truncated');
  emit({kind:'sample',immediate,state,next:player.getProperty(CONTROLS_PROPERTY)});
  clearEatingPresentation(player);await wait(2);
  const cleared=decodeControls(player.getProperty(CONTROLS_PROPERTY));
  check(cleared.eat_profile===0&&cleared.eat_hand===0&&!cleared.eat_projection&&cleared.season_phase===10&&cleared.pending_hand===2,'food reset changed seasoning');
  resetPlayerPresentation(player);await wait(2);
  check(player.getProperty(CONTROLS_PROPERTY)===0,'spawn/reset retained controls');
  check(immediate===0,'setProperty delay differs from documented next-tick boundary');
  emit({kind:'result',ok:true,sameTick:true,clock72000:true,neutralReset:true,client:false});
 }catch(error){emit({kind:'result',ok:false,reason:String(error),client:false});}
 finally{if(player){forgetPlayerPresentation(player.id);try{player.disconnect();}catch{}}}
});
