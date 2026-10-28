// Synchronous best-effort rollback, not a crash-safe database transaction.
// Native container writes return void; adapters may explicitly return false.
function requireApplied(result){if(result===false)throw new Error('Grilling: transaction step rejected')}
export function commitSteps(steps){
 let attempted=0;
 try{
  for(const step of steps){attempted++;requireApplied(step.apply())}
  return {ok:true,rollbackErrors:0};
 }catch(error){
  let rollbackErrors=0;
  for(let i=attempted-1;i>=0;i--)try{requireApplied(steps[i].rollback())}catch{rollbackErrors++}
  return {ok:false,error,rollbackErrors};
 }
}
export function commitTwoParty(applyPrimary,applySecondary,rollbackPrimary,rollbackSecondary){
 return commitSteps([
  {apply:applyPrimary,rollback:rollbackPrimary},
  {apply:applySecondary,rollback:rollbackSecondary}
 ]);
}

export function chooseExtractDelivery(emptySlot){
 return Number.isInteger(emptySlot)&&emptySlot>=0?{kind:'inventory',slot:emptySlot}:{kind:'spawn',slot:-1};
}

export function breakEscrowDropCount(rawCount,creative){
 const n=Math.max(0,Math.min(3,Math.floor(Number(rawCount)||0)));
 return n+(creative?0:1);
}

export function shouldResetAfterExtract(remaining){
 return Math.max(0,Math.floor(Number(remaining)||0))===0;
}
