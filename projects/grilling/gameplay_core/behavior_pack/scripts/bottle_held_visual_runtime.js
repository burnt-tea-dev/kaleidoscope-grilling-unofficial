import {getMainHand,getOffHand} from './core/player_io.js';
import {getItemProperty} from './itemData.js';
import {SEASONING_LIST_KEY,normalizeSeasoningList} from './seasoning/seasoning_contract_core.js';
import {bottleHeldVisualPlan,isBottleHeldVisualItem} from './bottle_held_visual_core.js';
import {heldVisualKind,writeHeldVisual,invalidateHeldVisual,HELD_VISUAL_BOTTLE,HELD_VISUAL_EMPTY} from './held_visual_transport.js';
import {registerHeldVisualProvider,reportHeldVisualError} from './held_visual_dispatch_runtime.js';

export function readBottleHeldSeasonings(stack){
 if(!isBottleHeldVisualItem(stack?.typeId))return [];
 const raw=getItemProperty(stack,SEASONING_LIST_KEY);
 if(typeof raw!=='string')return [];
 try{return normalizeSeasoningList(JSON.parse(raw))}catch{return []}
}

// Derived client properties only; never replace or write a held ItemStack.
export function syncBottleHeld(player){
 for(const [hand,read] of [['main',getMainHand],['off',getOffHand]])try{
  const stack=read(player),kind=heldVisualKind(stack?.typeId);
  if(kind==='empty'){writeHeldVisual(player,hand,'empty',HELD_VISUAL_EMPTY);continue;}
  if(kind!=='bottle')continue;
  const plan=bottleHeldVisualPlan(stack?.typeId,readBottleHeldSeasonings(stack));
  writeHeldVisual(player,hand,'bottle',[...plan,0,0,0,HELD_VISUAL_BOTTLE]);
 }catch(error){
  try{invalidateHeldVisual(player,hand)}catch{}
  reportHeldVisualError('bottle contents '+hand,player,error);
 }
}
registerHeldVisualProvider('bottle contents',syncBottleHeld);
