// These API-boundary outcomes check instrumentation fidelity, not native damage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createFixture} from '../../helpers/minecraft-fixture.mjs';

const target=fileURLToPath(new URL('../../../projects/grilling/gameplay_core/behavior_pack/scripts/effect/runtime.js',import.meta.url));
const builder=fileURLToPath(new URL('./prepare_ordinary_damage_trace.py',import.meta.url));
const generated=spawnSync('python3',['-c',
 'import importlib.util;from pathlib import Path;import sys;spec=importlib.util.spec_from_file_location("qa_trace",sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);print(m.instrument_source(Path(sys.argv[2]).read_text()),end="")',builder,target],{encoding:'utf8'});
assert.equal(generated.status,0,generated.stderr);

async function exercise(outcome,traced){
 const f=createFixture({currentTick:31}),calls=[];
 try{
  if(traced){
   const loader=new URL('./ordinary_damage_trace_loader.mjs',import.meta.url);loader.searchParams.set('fixture',f.id);
   register(loader,{data:{fixtureId:f.id,target,source:generated.stdout}});
  }
  const runtime=await f.load('effect/runtime.js'),player=f.player();
  const nativeError=new Error('native boundary rejected');nativeError.name='InvalidEntityError';
  player.applyDamage=function(amount,options){
   calls.push({sameActor:this===player,amount,options,tick:f.system.currentTick});
   if(outcome==='exception')throw nativeError;
   return outcome;
  };
  const hp=player.getComponent('minecraft:health').currentValue;
  runtime.applyOrdinary(player);
  assert.equal(calls.length,0,'Keep the original next-tick scheduling');
  assert.equal(f.logs.filter(row=>row.text.startsWith('GRILLING_QA_ORDINARY_DAMAGE_CALL ')).length,0);
  f.tick();assert.equal(calls.length,1);
  f.tick(3);assert.equal(calls.length,1,'Do not introduce another damage attempt');
  assert.deepEqual(calls[0],{sameActor:true,amount:3.4028234663852886e38,options:{cause:'selfDestruct'},tick:32});
  assert.equal(player.getComponent('minecraft:health').currentValue,hp,'Tracing does not settle health itself');
  const rows=f.logs.filter(row=>row.text.startsWith('GRILLING_QA_ORDINARY_DAMAGE_CALL ')).map(row=>JSON.parse(row.text.slice('GRILLING_QA_ORDINARY_DAMAGE_CALL '.length)));
  if(traced){
   assert.deepEqual(rows.map(row=>row.stage),['enter',outcome==='exception'?'exception':'return']);
   for(const row of rows){
    assert.equal(row.tick,32);assert.equal(row.actorId,player.id);
    assert.equal(row.amount,calls[0].amount);assert.equal(row.cause,calls[0].options.cause);
   }
   assert.equal(rows[1].enterRecorded,true);
   if(outcome==='exception')assert.deepEqual(rows[1].exception,{name:'InvalidEntityError',message:nativeError.message,text:String(nativeError)});
   else {assert.equal(rows[1].returnType,'boolean');assert.equal(rows[1].returnValue,outcome);}
  }else assert.deepEqual(rows,[]);
  return {calls,warnings:f.logs.filter(row=>row.text.startsWith('[Grilling ordinary damage]')).map(row=>row.text)};
 }finally{f.dispose();}
}
for(const outcome of [false,true,'exception'])test('same real implementation scheduling/call/catch with '+outcome,async()=>{
 const original=await exercise(outcome,false),instrumented=await exercise(outcome,true);
 assert.deepEqual(instrumented,original);
 assert.equal(original.warnings.length,outcome==='exception'?1:0,'Keep the original catch warning');
});
