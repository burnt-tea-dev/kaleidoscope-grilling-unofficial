import {every,onlinePlayers} from '../core/scheduler.js';
import {world,system,ItemStack} from '@minecraft/server';
import {
 WEDDING_CANDY_ID,WEDDING_CANDY_STATE_KEY,
 shanghaiCalendar,isWeddingCandyEventDate,nextWeddingCandyProgress
} from './wedding_candy_core.js';
import {awardWeddingCandy} from '../advancement/advancement_challenge_runtime.js';

function readState(player){
 try{
  const raw=player.getDynamicProperty(WEDDING_CANDY_STATE_KEY);
  if(typeof raw!=='string')return {};
  const value=JSON.parse(raw);return value&&typeof value==='object'?value:{};
 }catch{return {}}
}
function writeState(player,state){
 try{player.setDynamicProperty(WEDDING_CANDY_STATE_KEY,JSON.stringify({
  trackingDate:state.trackingDate??'',playSeconds:Number(state.playSeconds)||0,claimedDate:state.claimedDate??''
 }))}catch{}
}
function giveCandy(player,amount){
 let stack;try{stack=new ItemStack(WEDDING_CANDY_ID,Math.max(1,amount|0))}catch{return false}
 try{
  const container=player.getComponent('minecraft:inventory')?.container;
  if(container){const remainder=container.addItem(stack);if(remainder)player.dimension.spawnItem(remainder,player.location)}
  else player.dimension.spawnItem(stack,player.location);
  return true;
 }catch{try{player.dimension.spawnItem(stack,player.location);return true}catch{return false}}
}
function announce(player,amount){
 try{player.sendMessage({rawtext:[{translate:'message.kaleidoscope_grilling.wedding_candy.received',with:[String(amount)]}]})}catch{}
}

export function tickWeddingCandyPlayer(player,calendar=shanghaiCalendar()){
 const before=readState(player),next=nextWeddingCandyProgress(before,calendar);
 if(!next.active)return false;
 writeState(player,next);
 if(next.grant<=0)return false;
 giveCandy(player,next.grant);
 awardWeddingCandy(player);
 announce(player,next.grant);
 return true;
}

every('a2747_wedding_candy_runtime:1',()=>{
 const calendar=shanghaiCalendar();if(!isWeddingCandyEventDate(calendar))return;
 for(const player of onlinePlayers())try{tickWeddingCandyPlayer(player,calendar)}catch{}
},20);
