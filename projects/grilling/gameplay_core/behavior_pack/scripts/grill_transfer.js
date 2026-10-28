/** Synchronous rollback, not crash atomicity. Unknown drop outcomes quarantine. */
import {commitSteps} from './grill/grill_transaction_core.js';
import {quarantineStation} from './family_station_storage.js';
export function acknowledgedDrop(dimension,stack,location){
 let entity,attempted=false;const snapshot=stack.clone(),position={...location};
 return {apply(){attempted=true;entity=dimension.spawnItem(snapshot.clone(),position);if(!entity)throw new Error('Drop creation was not acknowledged')},rollback(){if(!attempted)return;if(!entity)throw new Error('Drop outcome unknown');entity.remove();}};
}
export function commitStationTransfer(block,steps,label){
 const result=commitSteps(steps);
 if(!result.ok){if(result.rollbackErrors)quarantineStation(block,label+' rollback incomplete; inspect items before recovery');console.warn('[Grilling '+label+'] '+String(result.error)+'; rollback failures='+result.rollbackErrors);}
 return result;
}
