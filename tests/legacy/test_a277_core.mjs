import assert from 'node:assert/strict';
import {commitTwoParty,chooseExtractDelivery,breakEscrowDropCount,shouldResetAfterExtract} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/grill/grill_transaction_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('two-party success applies state then resource',()=>{
 const log=[];const r=commitTwoParty(()=>log.push('state'),()=>log.push('resource'),()=>log.push('undo-state'),()=>log.push('undo-resource'));
 assert.equal(r.ok,true);assert.deepEqual(log,['state','resource']);
});
t('primary failure restores changed state and leaves the resource unchanged',()=>{
 let state='before',resource=3;
 const r=commitTwoParty(
  ()=>{state='partial';throw new Error('state')},
  ()=>{resource-=1},
  ()=>{state='before'},
  ()=>{resource=3}
 );
 assert.equal(r.ok,false);
 assert.equal(state,'before');
 assert.equal(resource,3);
});
t('secondary failure restores resource then state',()=>{
 const log=[];const r=commitTwoParty(()=>log.push('state'),()=>{log.push('resource');throw new Error('resource')},()=>log.push('undo-state'),()=>log.push('undo-resource'));
 assert.equal(r.ok,false);assert.deepEqual(log,['state','resource','undo-resource','undo-state']);
});
t('rollback exceptions are contained and counted',()=>{
 const r=commitTwoParty(()=>{},()=>{throw new Error('x')},()=>{throw new Error('a')},()=>{throw new Error('b')});
 assert.equal(r.ok,false);assert.equal(r.rollbackErrors,2);
});
t('extract uses exact empty inventory slot when available',()=>assert.deepEqual(chooseExtractDelivery(7),{kind:'inventory',slot:7}));
t('extract falls back to world spawn when no empty slot',()=>assert.deepEqual(chooseExtractDelivery(-1),{kind:'spawn',slot:-1}));
t('survival break escrows raw outputs plus grill',()=>assert.equal(breakEscrowDropCount(3,false),4));
t('creative break escrows raw outputs only',()=>assert.equal(breakEscrowDropCount(3,true),3));
t('break escrow count clamps invalid slot counts',()=>assert.equal(breakEscrowDropCount(99,false),4));
t('extract reset only when no grill items remain',()=>{assert.equal(shouldResetAfterExtract(0),true);assert.equal(shouldResetAfterExtract(2),false)});
console.log('A2.7.7 grill transaction core: '+n+'/'+n);
