import {ItemStack,EnchantmentType,world} from '@minecraft/server';
import {captureSkewerMetadata,restoreSkewerMetadata,metadataSignature} from './skewer_item_snapshot.js';
import {canonicalFoodId,eatingItemId,RANDOM_EATING_IDS,isAlternateEatingId,SKEWER_EATING_IDS} from './eating_profile_ids.js';
import {getHand,setHand} from './core/player_io.js';
import {eatingIdentity} from './core/eating_transaction.js';
const prepared=new Map();
const preparation=new Map();
function markChanged(player){const state=preparation.get(player.id);if(state)state.dirty=true;else preparation.set(player.id,{dirty:true});}
world.afterEvents.playerInventoryItemChange.subscribe(({player})=>markChanged(player));
world.afterEvents.playerHotbarSelectedSlotChange.subscribe(({player})=>markChanged(player));
export function forgetEatingItem(playerId){prepared.delete(playerId);preparation.delete(playerId);}
export function prepareChangedEatingItems(player,using,animations=true){
 let state=preparation.get(player.id);
 if(!state){state={dirty:true};preparation.set(player.id,state);}
 if(state.animations!==animations){state.animations=animations;state.dirty=true;}
 if(using||!state.dirty)return;
 // Clear before writing: native inventory events from this preparation or a
 // foreign writer must remain pending, rather than being erased afterwards.
 state.dirty=false;
 try{prepareEatingItems(player,false,animations);}catch(error){state.dirty=true;throw error;}
}
export function selectedEatingProfile(requested,id){return RANDOM_EATING_IDS.has(canonicalFoodId(id))?(isAlternateEatingId(id)?'THREE_ALT':'THREE'):requested;}
export function copyEatingVariant(stack,id){
 const snapshot=captureSkewerMetadata(stack);snapshot.id=id;
 const out=restoreSkewerMetadata(snapshot,(type,n)=>new ItemStack(type,n),type=>new EnchantmentType(type));out.amount=stack.amount;
 if(out.amount!==stack.amount||metadataSignature(captureSkewerMetadata(out))!==metadataSignature(snapshot))throw Error('Eating variant metadata readback differs');
 return out;
}
// Native duration is chosen BEFORE use begins. No timer debit or selected-slot
// swap can race the engine's food completion. Variants retain all exposed data.
export function prepareEatingItems(player,using,animations=true){
 if(using)return;
 const prior=prepared.get(player.id)??{};
 for(const hand of ['main','off']){
  const stack=getHand(player,hand),id=stack?.typeId;
  const base=canonicalFoodId(id);
  if(!SKEWER_EATING_IDS.has(base)||(animations&&!RANDOM_EATING_IDS.has(base)&&id===base)){delete prior[hand];continue;}
  const identity=eatingIdentity(stack);
  if(prior[hand]?.animations===animations&&prior[hand]?.identity===identity&&prior[hand]?.slot===(hand==='off'?-1:player.selectedSlotIndex))continue;
  const target=eatingItemId(id,animations&&RANDOM_EATING_IDS.has(canonicalFoodId(id))?Math.random()>=.5:false,animations);
  if(target!==id){const out=copyEatingVariant(stack,target);try{setHand(player,hand,out);if(eatingIdentity(getHand(player,hand))!==eatingIdentity(out))throw Error('Eating variant hand write failed');}catch(error){setHand(player,hand,stack);throw error;}prior[hand]={animations,identity:eatingIdentity(out),slot:hand==='off'?-1:player.selectedSlotIndex};}
  else prior[hand]={animations,identity,slot:hand==='off'?-1:player.selectedSlotIndex};
 }
 prepared.set(player.id,prior);
}
