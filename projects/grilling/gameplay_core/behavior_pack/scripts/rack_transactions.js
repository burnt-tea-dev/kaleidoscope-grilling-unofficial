import {rackContainer,captureRackFilters,syncRackDisplay,quarantineRackTransaction} from './rack/rack_state_adapter.js';
import {rackCanPlace,rackCanonicalFilter} from './rack/advanced_rack_core.js';
import {commitSteps} from './grill/grill_transaction_core.js';
import {slotWrite,remainderOf} from './rack_transfer_plan.js';

export function planRackInsert(block,slot,stack,amount=stack?.amount??0){
 const container=rackContainer(block);if(!container||!stack)return undefined;
 const filterState=captureRackFilters(block),filters=filterState.filters,tags=stack.getTags?.()??[];
 if(!rackCanPlace(slot,stack.typeId,tags,filters[slot]))return undefined;
 const stored=container.getItem(slot);
 const room=stored?(stored.isStackableWith(stack)?stored.maxAmount-stored.amount:0):stack.maxAmount;
 const moved=Math.min(room,amount,stack.amount);if(moved<=0)return undefined;
 const steps=[];
 if(!filters[slot]){
  const next=filters.slice();next[slot]=rackCanonicalFilter(stack.typeId,tags,slot);
  steps.push(filterState.step(next));
 }
 const next=(stored??stack).clone();next.amount=(stored?.amount??0)+moved;
 steps.push(slotWrite(container,slot,next));
 return {moved,steps};
}

export function commitRackTransfer(blocks,steps){
 const result=commitSteps(steps);
 if(!result.ok){
  if(result.rollbackErrors){
   for(const block of new Set(blocks))try{quarantineRackTransaction(block,'normal transfer rollback incomplete')}catch(error){console.warn('[Grilling rack quarantine persistence] '+error)}
   // Never return an ordinary rejection/remainder when destination ownership is ambiguous.
   throw new Error('Rack transfer recovery required; rollback incomplete');
  }
  return false;
 }
 for(const block of new Set(blocks))try{syncRackDisplay(block)}catch(error){console.warn('[Grilling rack display refresh] '+error)}
 return true;
}

export function depositInventorySlot(container,index,block,slot){
 const stack=container?.getItem(index);if(!stack)return 0;
 const plan=planRackInsert(block,slot,stack);if(!plan)return 0;
 return commitRackTransfer([block],[...plan.steps,slotWrite(container,index,remainderOf(stack,plan.moved))])?plan.moved:0;
}
