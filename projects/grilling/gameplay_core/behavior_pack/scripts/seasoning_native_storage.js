/** Native bottle items are authoritative once a station ledger exists.
 * The old four-field rows remain a checked projection for HUD/visual readers.
 */
import {stationContainer,inspectStationStorage,quarantineStation} from './core/storage.js';
import {readPlacedSeasoningStack} from './seasoning/seasoning_block_adapter.js';
import {SEASONING_MAX_BOTTLES,isEmptySeasoningId,isPendingSeasoningId} from './seasoning/seasoning_contract_core.js';
import {isSpecialSeasoningId} from './seasoning/special_seasoning_visual_core.js';
import {commitSteps} from './grill/grill_transaction_core.js';
import {slotWrite} from './rack_transfer_plan.js';
export const isNativeBottleItem=stack=>!!stack&&(isEmptySeasoningId(stack.typeId)||isPendingSeasoningId(stack.typeId)||isSpecialSeasoningId(stack.typeId));

export function readNativeBottles(block,describe,restoreLegacy,{fresh=false}={}){
 const rows=readPlacedSeasoningStack(block,true),presence=inspectStationStorage(block);
 if(!fresh&&!rows.length)throw new Error('Placed bottle has no readable saved contents');
 let native;try{native=block.getComponent('minecraft:inventory')?.container}catch{}
 const newHelper=!presence.linked&&!presence.orphans&&!native;
 if(fresh&&(!newHelper||rows.length))throw new Error('Fresh bottle coordinate still owns previous storage');
 // Prepare legacy projections before creating any new helper. Old discarded
 // metadata cannot be reconstructed; never apply this path over an existing owner.
 const migrated=newHelper?rows.map(row=>restoreLegacy(row)):undefined;
 const container=stationContainer(block);if(!container||container.size!==SEASONING_MAX_BOTTLES)throw new Error('Bottle inventory unavailable');
 if(newHelper){
  for(let i=0;i<SEASONING_MAX_BOTTLES;i++)if(container.getItem(i))throw new Error('New bottle helper unexpectedly contains items');
  // A genuinely fresh placement already has a verified empty inventory. Do not
  // manufacture four writes whose failure would quarantine an empty coordinate.
  const result=commitSteps(rows.length?Array.from({length:SEASONING_MAX_BOTTLES},(_,i)=>slotWrite(container,i,migrated[i])):[]);
  if(!result.ok){
   try{quarantineStation(block,'bottle legacy bootstrap failed')}catch{}
   throw new Error('Bottle legacy bootstrap requires recovery');
  }
 }
 const items=Array.from({length:SEASONING_MAX_BOTTLES},(_,i)=>container.getItem(i)?.clone());
 for(let i=0;i<SEASONING_MAX_BOTTLES;i++){
  if(i>=rows.length){if(items[i])throw new Error('Bottle storage/projection count mismatch');continue;}
  if(!isNativeBottleItem(items[i])||items[i].amount!==1||JSON.stringify(describe(items[i]))!==JSON.stringify(rows[i]))throw new Error('Bottle native item/projection mismatch; refusing reconstruction');
 }
 return {container,items:items.slice(0,rows.length),rows,created:newHelper};
}
