import {isPendingSeasoningId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2743_seasoning_contract_core.js';
import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {nativeEatingCompleted} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/player_presentation_core.js';
const source=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/main.js',import.meta.url),'utf8');
const begin=source.indexOf('world.afterEvents.itemCompleteUse.subscribe(e=>{');
const end=source.indexOf('// Native use poses cancel',begin);
assert.ok(begin>=0&&end>begin);
// Exercise production subscribers with deterministic event scheduling, not simulated players.
function fixture(tick=24,{eventMatches=true,currentMatches=true,item=true}={}){
 const callbacks={},queue=[],counts={manual:0,native:0};
 const active={id:'fixed',start:0,nativeDuration:100,profile:'THREE',use:{},meta:{}};
 const ACTIVE_EATS=new Map([['player',active]]),SETTLED=new Map();
 const player={id:'player',setProperty(){}};
 const event={source:player,itemStack:item?{typeId:'fixed'}:undefined,useDuration:0};
 const ctx={isPendingSeasoningId,canonicalFoodId,forgetEatingItem(){},hideJavaEatingHud(){},world:{afterEvents:{itemCompleteUse:{subscribe:f=>callbacks.complete=f},itemStopUse:{subscribe:f=>callbacks.stop=f}}},system:{currentTick:tick,run:f=>queue.push(f)},ACTIVE_EATS,SETTLED,PLATE_EATS:new Map(),PENDING_USES:new Map(),CUISINE_EATS:new Map(),CUISINE_FOOD_SET:new Set(),FOOD_DATA:{fixed:{}},PENDING_SEASONING:'pending',PLATE_ID:'plate',SECRET_ID:'secret',MYSTERIOUS_ID:'mystery',DARK_ID:'dark',RAW_NAUSEA:{},EAT_PROFILE_PROPERTY:'profile',EAT_HAND_PROPERTY:'hand',nativeEatingCompleted,now:()=>ctx.system.currentTick,eatingEventMatches:()=>eventMatches,finishedFoodMeta:x=>x,dangerousPreservation(){},stopEatSound(){},stopSoundHandle(){},afterCommitted(){counts.native++},hungerSettle(){if(!currentMatches)return false;counts.manual++;return true}};
 const constants=source.match(/const MINIMUM_EAT_TICKS=\d+,RELEASE_CHECKPOINT_GRACE_TICKS=\d+;/);
 assert.ok(constants,'production release constants are defined');
 vm.runInNewContext(constants[0]+'\n'+source.slice(begin,end),ctx);
 return {ctx,active,event,counts,complete:()=>callbacks.complete(event),stop:()=>callbacks.stop(event),flush(){ctx.system.currentTick++;while(queue.length)queue.shift()();}};
}
test('Java release boundary is 23 refusal, 24 grace, 25 ready',()=>{
 for(const tick of [0,22,23,24,25,26]){const f=fixture(tick);f.stop();assert.equal(f.counts.manual,0);f.flush();assert.equal(f.counts.manual,tick>=24?1:0,`release at ${tick}`);assert.equal(f.ctx.ACTIVE_EATS.size,0);}
});
test('deferred execution never promotes a 23-tick release to eligibility',()=>{const f=fixture(23);f.stop();f.ctx.system.currentTick=500;f.flush();assert.equal(f.counts.manual,0);});
test('completion wins both event orders without a manual second serving',()=>{
 for(const order of ['complete-first','stop-first']){const f=fixture(100);if(order==='complete-first'){f.complete();f.stop()}else{f.stop();f.complete()}f.flush();assert.deepEqual(f.counts,{manual:0,native:1});assert.equal(f.ctx.ACTIVE_EATS.size,0);}
});
test('repeated stop callbacks settle the same session once',()=>{const f=fixture(24);f.stop();f.stop();f.flush();assert.deepEqual(f.counts,{manual:1,native:0});});
test('release grace does not relax native completion duration',()=>{const f=fixture(24);f.complete();f.flush();assert.deepEqual(f.counts,{manual:0,native:0});assert.equal(f.ctx.ACTIVE_EATS.get('player'),f.active);});
test('old deferred stop cannot settle or remove a replacement session',()=>{const f=fixture(24);f.stop();const next={...f.active,start:24};f.ctx.ACTIVE_EATS.set('player',next);f.flush();assert.equal(f.ctx.ACTIVE_EATS.get('player'),next);assert.equal(f.counts.manual,0);});
test('unmatched event identity is ignored and current inventory identity still gates settlement',()=>{
 const mismatched=fixture(24,{eventMatches:false});mismatched.stop();mismatched.flush();assert.equal(mismatched.ctx.ACTIVE_EATS.get('player'),mismatched.active);assert.equal(mismatched.counts.manual,0);
 const replaced=fixture(24,{currentMatches:false});replaced.stop();replaced.flush();assert.equal(replaced.counts.manual,0);assert.equal(replaced.ctx.SETTLED.size,0);
});
test('stop without an item cannot grant nutrition',()=>{const f=fixture(25,{item:false});f.stop();f.flush();assert.equal(f.counts.manual,0);});
