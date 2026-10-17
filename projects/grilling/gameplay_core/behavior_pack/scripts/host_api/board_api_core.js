// Authored host API extension. No Cookery implementation is copied here.
export const BOARD_API_VERSION='0.1.0';
export const BOARD_CAPABILITIES=Object.freeze(['chopping_board_v2','chopping_board_recipe_selection','chopping_board_multi_output','chopping_board_commit_receipt']);
const id=v=>typeof v==='string'&&/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(v);
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
function normalizeBuiltin(value){
 if(!value||!integer(value.cuts,1,64))return undefined;
 if(value.outputs!==undefined){
  if(value.result!==undefined||value.count!==undefined||!Array.isArray(value.outputs)||value.outputs.length<1||value.outputs.length>4)return undefined;
  if(Object.keys(value).some(key=>!['outputs','cuts'].includes(key)))return undefined;
  if(value.outputs.some(row=>!row||!id(row.id)||!integer(row.count,1,64)||Object.keys(row).some(key=>!['id','count'].includes(key))))return undefined;
  return {outputs:value.outputs.map(row=>({id:row.id,count:row.count})),cuts:value.cuts};
 }
 if(!id(value.result)||!integer(value.count,1,64))return undefined;
 return {result:value.result,count:value.count,cuts:value.cuts};
}
export function normalizeBoardV2Recipe(payload){
 if(payload?.api!==1||payload?.kind!=='chopping_board_v2'||!id(payload.source))return undefined;
 const r=payload.recipe,b=normalizeBuiltin(r?.builtin);
 if(!r||!id(r.id)||!id(r.input)||!b)return undefined;
 if(!['replace','supplement'].includes(r.mode))return undefined;
 if(r.mode==='replace'&&(!id(r.result)||!integer(r.count,1,64)))return undefined;
 const bonuses=r.bonusOutputs??[];
 if(!Array.isArray(bonuses)||bonuses.length>3||bonuses.some(x=>!id(x.id)||!integer(x.min,1,64)||!integer(x.max,x.min,64)))return undefined;
 if(r.mode==='supplement'&&!bonuses.length)return undefined;
 const permitted=new Set(['id','input','builtin','mode','result','count','bonusOutputs']);
 if(Object.keys(r).some(k=>!permitted.has(k)))return undefined;
 const primary=b.outputs?.[0]??{id:b.result,count:b.count};
 return {id:r.id,source:payload.source,input:r.input,builtin:b,mode:r.mode,
  result:r.mode==='replace'?r.result:primary.id,count:r.mode==='replace'?r.count:primary.count,cuts:b.cuts,
  ...(r.mode==='supplement'&&b.outputs?{outputs:b.outputs.map(row=>({...row}))}:{}),
  bonusOutputs:bonuses.map(x=>({id:x.id,min:x.min,max:x.max})),apiVersion:BOARD_API_VERSION};
}
export function createBoardRegistry(){
 const rows=new Map(),conflicts=new Set();
 return {register(payload){
  const r=normalizeBoardV2Recipe(payload);if(!r)return {ok:false,reason:'schema'};
  if(conflicts.has(r.input))return {ok:false,reason:'input_conflict'};
  const old=rows.get(r.input);
  if(old&&JSON.stringify(old)!==JSON.stringify(r)){rows.delete(r.input);conflicts.add(r.input);return {ok:false,reason:'input_conflict'};}
  rows.set(r.input,r);return {ok:true,kind:payload.kind,source:r.source,id:r.id,apiVersion:BOARD_API_VERSION};
 },select(input,builtin){
  const r=rows.get(input);if(!r||conflicts.has(input)||!builtin)return undefined;
  // Keep exact author identity/count/order. Multi-output matching must also
  // bind secondary products, so a missing/changed bone cannot pass silently.
  if(JSON.stringify(normalizeBuiltin(builtin))!==JSON.stringify(r.builtin))return undefined;
  return JSON.parse(JSON.stringify(r));
 }};
}
export function sampleBoardOutputs(recipe,random=Math.random){
 // Old saved boardV2 recipes retain their single-output contract. New host
 // supplements carry every author output before sampling the additive bonus.
 const rows=recipe.outputs?recipe.outputs.map(row=>({...row})):[{id:recipe.result,count:recipe.count}];
 for(const b of recipe.bonusOutputs){const n=Number(random());if(!Number.isFinite(n)||n<0||n>=1)throw Error('invalid random sample');rows.push({id:b.id,count:b.min+Math.floor(n*(b.max-b.min+1))});}
 return rows;
}
const clone=x=>JSON.parse(JSON.stringify(x));
const effect=fn=>{try{fn()}catch{}};
export function executeBoardOperation(io,recipe,{random=Math.random,operationId}={}){
 const before=io.readState()??{},last=io.readReceipt(),held=io.readHeld();
 if(last?.phase==='quarantined'){io.notice('quarantined');return true;}
 if(!before.input){
  if(!recipe||held?.typeId!==recipe.input)return false;
  const ingredient=io.snapshot(held),state={input:recipe.input,cuts:0,max:recipe.cuts,result:{id:recipe.result,count:recipe.count},extension:true,
   boardV2:{version:BOARD_API_VERSION,operationId:operationId??io.newOperationId(),phase:'cutting',recipe:clone(recipe),ingredient,inputDebited:!io.creative}};
  const original=held.clone(),next=held.amount>1?held.clone():undefined;if(next)next.amount--;
  try{io.writeState(state);if(!io.creative)io.writeHeld(next);effect(()=>io.sound('place'));return true}
  catch(error){try{if(!io.creative)io.writeHeld(original);io.writeState(before)}catch(rollback){io.quarantine(state,'placement rollback: '+rollback)};io.notice('retry');return true;}
 }
 const op=before.boardV2;if(!op)return false;
 if(op.version!==BOARD_API_VERSION||!op.operationId||!op.recipe||!op.ingredient){io.quarantine(before,'invalid operation');io.notice('quarantined');return true;}
 if(last?.operationId===op.operationId&&last.phase==='committed'){try{io.writeState({})}catch{}return true;}
 if(op.phase==='committing'||op.phase==='quarantined'){io.quarantine(before,'unfinished delivery');io.notice('quarantined');return true;}
 if(io.sneaking){
  if(!op.inputDebited){io.writeState({});return true;}
  deliver(io,before,[op.ingredient],true);return true;
 }
 if(!io.isKnife(held)){io.notice('knife',before.cuts,before.max);return true;}
 if(before.cuts<before.max){
  const next=clone(before),original=held.clone(),damage=io.damagePlan(held,random);next.cuts++;
  try{io.writeState(next);if(damage.mutate)io.writeHeld(damage.next);effect(()=>io.particles());effect(()=>io.sound(damage.broken?'break':'cut'));return true}
  catch(error){try{if(damage.mutate)io.writeHeld(original);io.writeState(before)}catch(rollback){io.quarantine(next,'cut rollback: '+rollback)};io.notice('retry');return true;}
 }
 // Sample once, durably, at release. Retrying a confirmed failure reuses the plan.
 let prepared=before;
 if(!op.outputs){prepared=clone(before);prepared.boardV2.outputs=sampleBoardOutputs(op.recipe,random);prepared.boardV2.phase='prepared';
  try{io.writeState(prepared)}catch{io.notice('retry');return true;}}
 deliver(io,prepared,prepared.boardV2.outputs,false);return true;
}
function deliver(io,state,rows,refund){
 const prepared=clone(state),op=prepared.boardV2,receipts=[];let unknown=false,committed=false;
 prepared.boardV2.phase='committing';
 try{
  io.writeState(prepared);
  for(const row of rows){
   let receipt;
   try{receipt=io.deliver(row,refund)}catch(error){
    if(error.receipt)receipts.push(error.receipt);
    unknown=error.uncertain!==false;throw error;
   }
   receipts.push(receipt);if(!receipt?.acknowledged){unknown=true;throw Error('output not acknowledged')}
  }
  const final={version:BOARD_API_VERSION,operationId:op.operationId,phase:'committed',kind:refund?'cancel':'complete',outputs:clone(rows)};
  try{io.writeReceipt(final);committed=true}catch(error){
   // Native write may throw after mutation: durable readback decides the commit.
   let readback;try{readback=io.readReceipt()}catch{unknown=true;throw error}
   if(JSON.stringify(readback)===JSON.stringify(final))committed=true;else throw error;
  }
 }catch(error){
  if(committed)return;
  let rollbackFailed=false;for(const receipt of receipts.reverse())try{receipt.undo()}catch{rollbackFailed=true;}
  if(unknown||rollbackFailed){io.quarantine(prepared,'unacknowledged delivery: '+error);effect(()=>io.notice('quarantined'));return;}
  try{io.writeState(state)}catch{io.quarantine(prepared,'delivery rollback state unavailable')}
  effect(()=>io.notice('retry'));return;
 }
 // Effects and clearing cannot roll back a durably committed delivery.
 try{io.writeState({})}catch{effect(()=>io.notice('retry'))}
 if(!refund)effect(()=>io.particles());effect(()=>io.sound('release'));
}
export function recoverBoardOperation(io,state){
 const op=state?.boardV2;if(!op)return false;
 const last=io.readReceipt();
 if(last?.operationId===op.operationId&&last.phase==='committed')return true;
 if(['committing','quarantined'].includes(op.phase)||last?.phase==='quarantined'){io.quarantine(state,'destroyed unconfirmed operation');return true;}
 if(op.inputDebited)deliver(io,state,[op.ingredient],true);
 return true;
}
