import {planRackInsert,commitRackTransfer} from '../rack_transactions.js';
import {slotWrite,remainderOf} from '../rack_transfer_plan.js';
import {
 ADVANCED_RACK_BLOCK_ID,RACK_COMPARTMENTS,rackCanPlace,rackCanonicalFilter,rackFilterMatches
} from './advanced_rack_core.js';
import {
 rackContainer,readRackFilters,writeRackFilters,syncRackDisplay
} from './rack_state_adapter.js';

function tags(stack){try{return stack?.getTags?.()??[]}catch{return []}}
function cloneAmount(stack,amount){const out=stack.clone();out.amount=amount;return out}

function canReturn(block,slot,stack){
 const c=rackContainer(block);if(!c||slot<0||slot>=RACK_COMPARTMENTS)return false;
 const filters=readRackFilters(block),filter=filters[slot];
 if(!rackCanPlace(slot,stack.typeId,tags(stack),filter))return false;
 const stored=c.getItem(slot);
 return !stored||(stored.isStackableWith(stack)&&stored.amount+stack.amount<=stored.maxAmount);
}

export function borrowAdvancedRackItem(dimension,location,predicate=()=>true,simulate=false){
 const block=dimension?.getBlock?.(location);
 if(!block||block.typeId!==ADVANCED_RACK_BLOCK_ID)return {stack:undefined,receipt:undefined,success:false};
 const c=rackContainer(block);if(!c)return {stack:undefined,receipt:undefined,success:false};
 for(let slot=0;slot<RACK_COMPARTMENTS;slot++){
  const stored=c.getItem(slot);
  if(!stored||!predicate(stored))continue;
  const borrowed=cloneAmount(stored,1);
  if(!simulate){
   if(!commitRackTransfer([block],[slotWrite(c,slot,remainderOf(stored,1))]))return {stack:undefined,receipt:undefined,success:false};
  }
  return {
   stack:borrowed,
   receipt:{dimension:block.dimension.id,x:block.x,y:block.y,z:block.z,slot},
   success:true
  };
 }
 return {stack:undefined,receipt:undefined,success:false};
}

export function returnAdvancedRackItem(dimension,receipt,returned,simulate=false){
 if(!receipt||!returned||dimension?.id!==receipt.dimension)return {success:false,remainder:returned?.clone?.()};
 const block=dimension.getBlock({x:receipt.x,y:receipt.y,z:receipt.z});
 if(!block||block.typeId!==ADVANCED_RACK_BLOCK_ID)return {success:false,remainder:returned.clone()};
 const preferred=Math.floor(Number(receipt.slot));
 const slots=[preferred,...Array.from({length:RACK_COMPARTMENTS},(_,i)=>i).filter(i=>i!==preferred)];
 for(const slot of slots){
  if(!canReturn(block,slot,returned))continue;
  if(!simulate){
   const plan=planRackInsert(block,slot,returned);
   if(!plan||plan.moved!==returned.amount||!commitRackTransfer([block],plan.steps))return {success:false,remainder:returned.clone()};
  }
  return {success:true,remainder:undefined};
 }
 return {success:false,remainder:returned.clone()};
}
