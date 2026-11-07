// Tests the actual QA admission decision, not the Minecraft API or Heavy owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {plainKillGate} from './entity_kill_gate.js';
function observation(){
 return {before:{id:'native-plain',valid:true,health:10,off:{id:'minecraft:totem_of_undying',amount:1}},
  after:{off:{id:'minecraft:totem_of_undying',amount:1}},
  call:{terminal:{stage:'return',returnType:'boolean',returnValue:true}},
  events:[{id:'native-plain',event:'beforeHurt',damage:100},{id:'native-plain',event:'death'}]};
}
test('API true alone cannot admit Heavy',()=>{
 const row=observation();row.events=[];
 assert.equal(plainKillGate(row).eligible,false);
});
test('direct death without positive beforeHurt cannot admit Heavy',()=>{
 const row=observation();row.events.shift();
 assert.equal(plainKillGate(row).eligible,false);
});
test('consumed totem or native totem healing cannot admit Heavy',()=>{
 const row=observation();row.after.off=null;
 assert.equal(plainKillGate(row).eligible,false);
 row.after=row.before;row.events.push({id:'native-plain',event:'heal',totem:true});
 assert.equal(plainKillGate(row).eligible,false);
});
test('already dead input or another actor death cannot admit Heavy',()=>{
 const row=observation();row.before.health=0;
 assert.equal(plainKillGate(row).eligible,false);
 row.before.health=10;row.events[1].id='other';
 assert.equal(plainKillGate(row).eligible,false);
});
test('alive native death, beforeHurt and preserved totem admit one next case regardless of return',()=>{
 const row=observation();row.call.terminal.returnValue=false;
 assert.equal(plainKillGate(row).eligible,true);
 assert.deepEqual(plainKillGate(row).missing,[]);
});
