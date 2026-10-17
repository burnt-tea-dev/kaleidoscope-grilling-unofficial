import {isFailureSkewer,failureHeldPayload} from './failure_skewer_visual_core.js';
import {canonicalFoodId} from './eating_profile_ids.js';
import {system} from '@minecraft/server';
import {getMainHand,getOffHand,isCreative} from './a2735_player_io.js';
import {eatingStillCurrent} from './a285_eating_transaction.js';
import {secretVisualIndex} from './integration_registry_core.js';
import {secretVisualState,partialVisualState} from './secret_visual_state.js';
import {secretHeldMarker} from './secret_visual_state_core.js';
import {heldVisualKind,writeHeldVisual,invalidateHeldVisual,HELD_VISUAL_EMPTY} from './held_visual_transport.js';
import {registerHeldVisualProvider,reportHeldVisualError} from './held_visual_dispatch_runtime.js';
let reader,rawReader;const completedHands=new Map();
export function configureSecretHeldReader(read,readRaw){reader=read;rawReader=readRaw;}
export function syncSecretHeld(player,{beginHand,completedUse}={}){
 if(!reader)return;
 let completed=completedHands.get(player.id);
 if(beginHand)completed?.delete(beginHand);
 if(completedUse&&!isCreative(player)){
  // A confirmed native single serving can outlive its debit in the held
  // render snapshot. Suppress that exact hand/slot/identity, never a new meal.
  const before=JSON.parse(completedUse.identity),current=completedUse.hand==='off'?getOffHand(player):getMainHand(player);
  if((canonicalFoodId(before.id)==='kaleidoscope_grilling:secret_skewer'||isFailureSkewer(before.id))&&before.amount===1&&
   eatingStillCurrent(completedUse,current,player.selectedSlotIndex,system.currentTick)){
   if(!completed){completed=new Map();completedHands.set(player.id,completed);}
   completed.set(completedUse.hand,completedUse);
  }
 }
 for(const [hand,read] of [['main',getMainHand],['off',getOffHand]])try{
  const current=read(player);
  const done=completed?.get(hand);
  if(done&&!eatingStillCurrent(done,current,player.selectedSlotIndex,system.currentTick))completed.delete(hand);
  const kind=heldVisualKind(current?.typeId);
  if(kind==='empty'){writeHeldVisual(player,hand,'empty',HELD_VISUAL_EMPTY);continue;}
  if(kind==='failure'){
   if(completed?.has(hand))invalidateHeldVisual(player,hand);
   else writeHeldVisual(player,hand,'failure',failureHeldPayload(current,rawReader));
   continue;
  }
  if(kind!=='secret')continue;
  const stack=completed?.has(hand)?undefined:current;
  const id=canonicalFoodId(stack?.typeId);
  const ingredients=id==='kaleidoscope_grilling:secret_skewer'?secretVisualState(stack,reader):id==='kaleidoscope_grilling:unfinished_skewer'?partialVisualState(stack,reader):[];
  // Pinned Java helper resolution reads the original last snapshot, not the
  // cooked/effective rows and not a destructively shortened bite-stage list.
  const raw=canonicalFoodId(stack?.typeId)==='kaleidoscope_grilling:secret_skewer'&&rawReader?rawReader(stack):[];
  writeHeldVisual(player,hand,'secret',[
   ...Array(8).fill(0),...Array.from({length:3},(_,i)=>ingredients[i]??0),secretHeldMarker(secretVisualIndex(raw[raw.length-1]?.id))
  ]);
 }catch(error){
  try{invalidateHeldVisual(player,hand)}catch{}
  reportHeldVisualError('ingredients '+hand,player,error);
 }
}
registerHeldVisualProvider('ingredients',syncSecretHeld,{
 period:20,
 inventory:id=>completedHands.delete(id),
 hotbar:id=>completedHands.get(id)?.delete('main'),
 spawn:id=>completedHands.delete(id),
 leave:id=>completedHands.delete(id)
});
