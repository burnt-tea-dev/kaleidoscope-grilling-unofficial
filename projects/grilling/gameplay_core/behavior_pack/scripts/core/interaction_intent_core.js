import {getItemProperty,setItemProperty,getItemPropertyIds,getItemLore,setItemLore} from '../itemDataCore.js';
import {chooseInteractionHand,makeIntent,intentMatches} from '../grill/grill_intent_core.js';

export function primitiveStackProps(stack){
 const out={};let ids=[];try{ids=getItemPropertyIds(stack)??[]}catch{}
 for(const id of ids)try{
  const value=getItemProperty(stack,id);
  if(['string','number','boolean'].includes(typeof value))out[id]=value;
  else if(value&&typeof value==='object'&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&Number.isFinite(value.z))out[id]={x:value.x,y:value.y,z:value.z};
 }catch{}
 return out;
}

// Safe in before-events. Adventure-mode restriction getters are deliberately
// excluded: Bedrock prohibits getCanDestroy/getCanPlaceOn in restricted mode.
export function stackIntentSignature(stack){
 if(!stack)return null;
 const raw=primitiveStackProps(stack),props=Object.fromEntries(Object.keys(raw).sort().map(k=>[k,raw[k]]));
 let lore=[];try{lore=getItemLore(stack)}catch{}
 let name='';try{name=stack.nameTag??''}catch{}
 let damage=null;try{damage=Number(stack.getComponent('minecraft:durability')?.damage??0)}catch{}
 let keepOnDeath,lockMode;try{keepOnDeath=stack.keepOnDeath;lockMode=stack.lockMode}catch{}
 return JSON.stringify({id:stack.typeId,amount:Number(stack.amount)||1,name,lore,props,damage,keepOnDeath,lockMode});
}

// Only call in a deferred, unrestricted phase, including on captured clones.
export function fullStackIntentSignature(stack){
 if(!stack)return null;
 const keepOnDeath=stack.keepOnDeath,lockMode=stack.lockMode;
 if(typeof keepOnDeath!=='boolean'||typeof lockMode!=='string'
  ||typeof stack.getCanDestroy!=='function'||typeof stack.getCanPlaceOn!=='function')
  throw new Error('Grilling: item intent capabilities unavailable');
 const restrictions=value=>{
  if(!Array.isArray(value)||value.some(id=>typeof id!=='string'))
   throw new Error('Grilling: item intent restrictions unreadable');
  return [...value].sort();
 };
 return JSON.stringify({safe:stackIntentSignature(stack),
  canDestroy:restrictions(stack.getCanDestroy()),canPlaceOn:restrictions(stack.getCanPlaceOn())});
}

export function captureStackIntentSnapshot(stack){
 if(!stack)return {readable:true,stack:undefined};
 try{const copy=stack.clone();return {readable:!!copy,stack:copy}}
 catch{return {readable:false,stack:undefined}}
}
export function stackIntentSnapshotMatches(snapshot,current){
 if(!snapshot?.readable)return false;
 try{return fullStackIntentSignature(snapshot.stack)===fullStackIntentSignature(current)}
 catch{return false}
}
const interactionSnapshots=new WeakMap();

export function stackIntentDescriptor(stack){
 return stack?{empty:false,id:stack.typeId,sig:stackIntentSignature(stack)}:{empty:true,id:null,sig:null};
}

export function captureInteractionIntentFromStacks(eventStack,mainStack,offStack,selectedSlot){
 const e=stackIntentDescriptor(eventStack),m=stackIntentDescriptor(mainStack),o=stackIntentDescriptor(offStack);
 const hand=chooseInteractionHand(e,m,o),sig=hand==='off'?o.sig:m.sig;
 const intent=makeIntent(hand,sig,selectedSlot);
 interactionSnapshots.set(intent,{event:captureStackIntentSnapshot(eventStack),
  main:captureStackIntentSnapshot(mainStack),off:captureStackIntentSnapshot(offStack)});
 return intent;
}

export function interactionIntentMatchesStacks(intent,mainStack,offStack,selectedSlot){
 try{
  if(!intentMatches(intent,stackIntentSignature(mainStack),stackIntentSignature(offStack),selectedSlot))return false;
  const saved=interactionSnapshots.get(intent);
  if(!saved?.event.readable||!stackIntentSnapshotMatches(saved.main,mainStack)
   ||!stackIntentSnapshotMatches(saved.off,offStack))return false;
  const descriptor=stack=>stack?{empty:false,id:stack.typeId,sig:fullStackIntentSignature(stack)}:{empty:true,id:null,sig:null};
  const event=descriptor(saved.event.stack),main=descriptor(saved.main.stack),off=descriptor(saved.off.stack);
  // A closure already captured .hand. Never silently switch it after discovering
  // a restriction-only difference in the unrestricted phase.
  if(chooseInteractionHand(event,main,off)!==intent.hand)return false;
  if(!event.empty&&event.sig!==(intent.hand==='off'?off.sig:main.sig))return false;
  if(!event.empty&&!main.empty&&!off.empty&&event.sig===main.sig&&event.sig===off.sig)return false;
  return true;
 }
 catch{return false} // A deferred action cannot verify an unreadable hand.
}
