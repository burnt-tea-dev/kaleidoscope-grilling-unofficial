import {world,system} from '@minecraft/server';
import {createFailureFeedbackGate,javaInteractionMessage} from '../interaction_feedback_core.js';

// Compatibility for older interaction and pending eating callers. Routine
// hints/progress never write or clear the shared actionbar, even on completion.
export function interactionFeedback(){return false}
export function eatingProgress(){return false}
// Only source-backed displayClientMessage call sites may use this outlet.
// It is event driven; no timer/crosshair poll calls it.
export function javaInteractionFeedback(player,key,args=[],red=false){
 const text=javaInteractionMessage(key,args,red);if(!player||!text)return false;
 try{player.onScreenDisplay.setActionBar(text);return true}catch{return false}
}

// Java displayClientMessage(..., false) belongs in chat, never the actionbar.
export function javaInteractionChat(player,key,args=[]){
 const text=javaInteractionMessage(key,args);if(!player||!text)return false;
 try{player.sendMessage(text);return true}catch{return false}
}

// Bedrock storage faults are operator diagnostics, not new Java HUD messages.
// Repeated attempts do not flood the Content Log.
const failures=createFailureFeedbackGate();
export function interactionFailure(player,text){
 if(!player?.id||!text||!failures.allow(player.id,system.currentTick))return false;
 try{console.warn('[Grilling transaction] '+text);return true}catch{return false}
}
world.afterEvents.playerLeave.subscribe(e=>failures.forget(e.playerId));
