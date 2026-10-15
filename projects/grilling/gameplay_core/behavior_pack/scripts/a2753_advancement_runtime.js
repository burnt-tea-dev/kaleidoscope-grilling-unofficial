import {world} from '@minecraft/server';
import {
 MOUNTAIN_FRAGRANCE,advancementAwardPlan
} from './a2753_advancement_core.js';
import {advancementFrameTranslationKeys} from './a2758_advancement_challenge_core.js';

// The existing per-advancement field retains legacy boolean true. A pending
// receipt owns a possible XP side effect across callbacks and script reloads.
function readClaim(player,key){
 try{return {known:true,value:player.getDynamicProperty(key)}}catch{return {known:false}}
}
function writeClaim(player,key,value){
 // A setter may apply and then throw. Only exact readback acknowledges it.
 try{player.setDynamicProperty(key,value)}catch{}
 const current=readClaim(player,key);
 return current.known&&current.value===value;
}
function giveExperience(player,amount){
 const n=Math.max(0,Math.floor(Number(amount)||0));if(n<=0)return true;
 // An exception does not prove that the native XP mutation had no effect.
 // Keep its pending receipt; a command fallback could award the same XP twice.
 try{player.addExperience(n);return true}catch{return false}
}
function announce(player,spec){
 if(!spec.announce)return;
 const keys=advancementFrameTranslationKeys(spec.frame);
 try{
  world.sendMessage({rawtext:[
   {text:'§d'+String(player.name??'Player')+'§r'},
   {translate:keys.announce},
   {translate:spec.titleKey}
  ]});
 }catch{}
 try{
  player.sendMessage({rawtext:[
   {translate:keys.self},
   {translate:spec.titleKey},
   {text:'§r — §7'},
   {translate:spec.descriptionKey}
  ]});
 }catch{}
}

export function awardOneShotAdvancement(player,spec){
 if(!player||!spec)return false;
 const plan=advancementAwardPlan(spec,false);
 if(!plan.grant||!Number.isFinite(plan.xp))return false;
 const prior=readClaim(player,plan.propertyKey);
 // Unreadable/unknown values and pending receipts are not unclaimed awards.
 if(!prior.known||(prior.value!==undefined&&prior.value!==false))return false;
 const claim=JSON.stringify({version:1,state:'pending',xp:plan.xp});
 if(!writeClaim(player,plan.propertyKey,claim))return false;
 if(!giveExperience(player,plan.xp))return false;
 const current=readClaim(player,plan.propertyKey);
 if(!current.known||current.value!==claim)return false;
 if(!writeClaim(player,plan.propertyKey,true))return false;
 announce(player,{...spec,...plan});
 return true;
}

export function awardMountainFragrance(player){
 return awardOneShotAdvancement(player,MOUNTAIN_FRAGRANCE);
}
