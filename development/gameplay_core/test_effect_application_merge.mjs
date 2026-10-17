/** Actual production effect application and persisted-state functions; API doubles, not Minecraft acceptance.
 * Expected outcomes pinned to official 1.20.1 MobEffectInstance.update/tick (see source witness).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as lifecycle from '../../projects/grilling/gameplay_core/behavior_pack/scripts/effect_lifecycle_core.js';
import {seasoningEffectCounts} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2743_seasoning_contract_core.js';
import {rolledIngredientEffects} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_ingredient_effects.js';
import {registerSecretIngredientBehavior,resetSecretCompatRegistry} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_compat_core.js';
import {secretEatingRows} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_eating_core.js';
import {secretFood} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js';
const source=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/main.js',import.meta.url),'utf8');
function body(name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);let end=source.indexOf('{',start)+1,depth=1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++}return source.slice(start,end)}
function fixture(initial={}){
 let raw=JSON.stringify(initial),tick=100;const heals=[],writes=[];
 const ctx=vm.createContext({...lifecycle,now:()=>tick,readFx:()=>lifecycle.activeEffects(JSON.parse(raw??'{}'),tick),writeFx:(_p,value)=>{raw=lifecycle.effectPayload(value,tick);writes.push(raw);return lifecycle.activeEffects(JSON.parse(raw??'{}'),tick)},seasoningEffectCounts,nativeDragonHealth:(_p,amp)=>heals.push(amp),awardMetalToleranceFailed(){},COOKED_EFFECTS:{},canonicalFoodId:id=>id,readEffectiveSkewerRows:s=>s.rows,rolledIngredientEffects:r=>rolledIngredientEffects(r,()=>0),dangerousPreservation(){},behaviorRemainder:()=>null,emitSecretIngredientConsumed(){}});
 Object.assign(ctx,{secretEatingRows,secretFood,readSkewerRows:s=>s.rows,isSecretCooked:()=>false,ItemStack:class{constructor(typeId){this.typeId=typeId;}getComponent(){}}});
 ctx.readEffects=ctx.readFx;ctx.writeEffects=ctx.writeFx;
 const names=['fxGet','fxSet','fxClear','fxReduce','counts','applyDragonBlood','applySeasoning','secretEatingData','secretRemainders'];if(source.includes('function fxApply('))names.push('fxApply');
 vm.runInContext(names.map(body).join('\n'),ctx);
 return {ctx,heals,writes,player:{},get effects(){return lifecycle.activeEffects(JSON.parse(raw??'{}'),tick)},get raw(){return raw},advance(to){tick=to},reload(){raw=JSON.stringify(JSON.parse(raw??'{}'));},set raw(v){raw=v}};
}
const N='kaleidoscope_grilling:';
test('shorter weaker Heavy Metal seasoning cannot downgrade active stronger effect',()=>{
 const f=fixture({heavy_metal:{until:10000,amp:1}});f.ctx.applySeasoning(f.player,[N+'totem_powder']);assert.deepEqual(f.effects.heavy_metal,{until:10000,amp:1});
});
test('shorter equal Numb seasoning cannot truncate remaining duration',()=>{
 const f=fixture({numb:{until:10000,amp:0}});f.ctx.applySeasoning(f.player,Array(4).fill(N+'sichuan_pepper'));assert.deepEqual(f.effects.numb,{until:10000,amp:0});
});
test('longer equal Numb seasoning refreshes without stacking',()=>{
 const f=fixture({numb:{until:200,amp:0}});f.ctx.applySeasoning(f.player,Array(4).fill(N+'sichuan_pepper'));assert.deepEqual(f.effects.numb,{until:1000,amp:0});f.ctx.applySeasoning(f.player,Array(4).fill(N+'sichuan_pepper'));assert.deepEqual(f.effects.numb,{until:1000,amp:0});
});
test('long weaker Dragon Blood stays hidden while strong instance runs; hidden counts down and promotes on reload',()=>{
 const f=fixture({dragon_blood:{until:1100,amp:1}});f.ctx.applyDragonBlood(f.player,7200,0);assert.deepEqual(f.effects.dragon_blood,{until:1100,amp:1,hidden:{until:7300,amp:0}});assert.deepEqual(f.heals,[1]);f.reload();f.advance(1100);assert.deepEqual(f.effects.dragon_blood,{until:7300,amp:0});f.advance(7300);assert.equal(f.effects.dragon_blood,undefined);
});
test('short stronger Dragon Blood preserves long weaker instance across serialization',()=>{
 const f=fixture({dragon_blood:{until:7300,amp:0}});f.ctx.applyDragonBlood(f.player,1000,1);assert.deepEqual(f.effects.dragon_blood,{until:1100,amp:1,hidden:{until:7300,amp:0}});f.reload();f.advance(1101);assert.deepEqual(f.effects.dragon_blood,{until:7300,amp:0});
});
test('actual mixed custom ingredient finish does not combine maximum strength with maximum duration',()=>{
 resetSecretCompatRegistry();registerSecretIngredientBehavior({input:'fixture:strong',behavior:{effects:[{kind:'persistent_fx',effect:'numb',ticks:1000,amplifier:1}]}});registerSecretIngredientBehavior({input:'fixture:long',behavior:{effects:[{kind:'persistent_fx',effect:'numb',ticks:7200,amplifier:0}]}});
 const f=fixture();f.ctx.secretRemainders(f.player,{rows:['fixture:strong','fixture:long','minecraft:apple'].map(id=>({id,edible:true,nutrition:1,saturation:0}))});assert.deepEqual(f.effects.numb,{until:1100,amp:1,hidden:{until:7300,amp:0}});f.advance(1100);assert.deepEqual(f.effects.numb,{until:7300,amp:0});resetSecretCompatRegistry();
});
test('state codec preserves old rows and unrelated effects while restoring hidden chain',()=>{
 const before={warmth:{until:9000,amp:0},numb:{until:1100,amp:1,hidden:{until:7300,amp:0}}};assert.deepEqual(lifecycle.activeEffects(before,100),before);const output=JSON.parse(lifecycle.effectPayload(before,100));assert.deepEqual(output,before);output.numb.hidden.until=99999;assert.equal(before.numb.hidden.until,7300);assert.deepEqual(lifecycle.activeEffects(before,1100),{warmth:before.warmth,numb:{until:7300,amp:0}});
});
test('explicit fxSet reset retains overwrite semantics rather than creating a hidden reward',()=>{
 const f=fixture({numb:{until:7300,amp:1,hidden:{until:9000,amp:0}}});f.ctx.fxSet(f.player,'numb',50,0);assert.deepEqual(f.effects.numb,{until:150,amp:0});
});

test('repeated weaker applications refresh one hidden instance rather than grow a chain',()=>{
 const f=fixture({dragon_blood:{until:1100,amp:1}});for(let i=0;i<1000;i++)f.ctx.applyDragonBlood(f.player,7200,0);assert.deepEqual(f.effects.dragon_blood,{until:1100,amp:1,hidden:{until:7300,amp:0}});
});
test('expired chain, malformed tails and cycles preserve valid unrelated effects without looping',()=>{
 const cycle={until:9000,amp:1};cycle.hidden=cycle;
 const cases=[cycle,{until:9000,amp:1,hidden:{until:10000,amp:1}},{until:9000,amp:1,hidden:{until:Infinity,amp:0}},{until:9000,amp:1,hidden:[]}];
 for(const row of cases)assert.deepEqual(lifecycle.activeEffects({numb:row,warmth:{until:8000,amp:0}},100),{numb:{until:9000,amp:1},warmth:{until:8000,amp:0}});
 assert.equal(lifecycle.activeEffect({until:90,amp:2,hidden:{until:95,amp:1,hidden:{until:200,amp:0}}},100).amp,0);
 assert.equal(lifecycle.activeEffect({until:90,amp:1,hidden:{until:95,amp:0}},100),undefined);
});
test('full supported amplifier chain fits the explicit bound; unsupported infinite applications fail',()=>{
 let effect;for(let amp=0;amp<=255;amp++)effect=lifecycle.mergeEffectApplication(effect,10000-amp*10,amp,100);
 let count=0;for(let row=lifecycle.activeEffect(effect,100);row;row=row.hidden)count++;
 assert.equal(count,256);assert.equal(lifecycle.MAX_EFFECT_CHAIN,256);
 for(const ticks of [-1,0,Infinity,NaN])assert.throws(()=>lifecycle.mergeEffectApplication(effect,ticks,0,100),/Invalid effect application/);
 resetSecretCompatRegistry();registerSecretIngredientBehavior({input:'fixture:infinite',behavior:{effects:[{kind:'persistent_fx',effect:'numb',ticks:-1}]}});assert.equal(rolledIngredientEffects({id:'fixture:infinite',edible:true,nutrition:1}).effects.length,0);resetSecretCompatRegistry();
});
function runtimeFixture(raw){
 let tick=100,writes=0,fault;const world={getAbsoluteTime:()=>tick},system={get currentTick(){return tick}},entity={id:'saved-owner',getDynamicProperty:()=>raw,setDynamicProperty:(_key,value)=>{writes++;if(fault==='before')throw Error('rejected setter');raw=value;if(fault==='after')throw Error('post-write exception')}};
 function load(){const ctx=vm.createContext({...lifecycle,world,system,nativeDragonHealth(){}});const runtime=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/effect_state_runtime.js',import.meta.url),'utf8').replace(/^import.*\n/gm,'').replace(/export (?=(function|const))/g,'');vm.runInContext(runtime,ctx);return ctx;}
 let ctx=load();return {entity,get ctx(){return ctx},get raw(){return raw},get writes(){return writes},fail(mode){fault=mode},advance(to){tick=to},reconnect(){ctx=load()}};
}
test('actual effect runtime deep copies cache, serializes hidden chain and promotes after reconnect',()=>{
 const saved={warmth:{until:9000,amp:0},dragon_blood:{until:1100,amp:1,hidden:{until:7300,amp:0}}},f=runtimeFixture(JSON.stringify(saved));
 const first=f.ctx.readEffects(f.entity);first.dragon_blood.hidden.until=999999;
 assert.equal(f.ctx.readEffects(f.entity).dragon_blood.hidden.until,7300);
 f.ctx.writeEffects(f.entity,f.ctx.readEffects(f.entity));assert.deepEqual(JSON.parse(f.raw),saved);
 f.reconnect();f.advance(1100);assert.equal(f.ctx.readEffects(f.entity).dragon_blood.amp,0);assert.equal(f.ctx.readEffects(f.entity).dragon_blood.until,7300);
 f.ctx.writeEffects(f.entity,f.ctx.readEffects(f.entity));assert.deepEqual(JSON.parse(f.raw),{warmth:saved.warmth,dragon_blood:{until:7300,amp:0}});
 f.advance(7300);assert.equal(f.ctx.readEffects(f.entity).dragon_blood,undefined);assert.ok(f.ctx.readEffects(f.entity).warmth);
});
test('milk clears both active/hidden reward chain while retaining poisoning',()=>{
 const value={numb:{until:1100,amp:1,hidden:{until:7300,amp:0}},heavy_metal_poisoning:{until:9000,amp:0}};
 assert.deepEqual(lifecycle.milkEffects(value,100),{heavy_metal_poisoning:{until:9000,amp:0}});
});
test('Java hot-food extension replaces active instance and drops its hidden chain',()=>{
 const f=fixture({numb:{until:1100,amp:1,hidden:{until:7300,amp:0}},invincible:{until:400,amp:0}});vm.runInContext(body('doubleNewFx'),f.ctx);f.ctx.doubleNewFx(f.player,{});
 assert.deepEqual(f.effects.numb,{until:2100,amp:1});assert.deepEqual(f.effects.invincible,{until:400,amp:0});
});

test('refreshed strong effect cannot skip an expired immediate hidden layer and revive deeper weak effect',()=>{
 let row=lifecycle.mergeEffectApplication(undefined,1000,0,100);
 row=lifecycle.mergeEffectApplication(row,500,1,100);row=lifecycle.mergeEffectApplication(row,200,2,100);row=lifecycle.mergeEffectApplication(row,700,2,100);
 assert.deepEqual(row,{until:800,amp:2,hidden:{until:600,amp:1,hidden:{until:1100,amp:0}}});
 assert.equal(lifecycle.activeEffect(row,700).hidden.amp,1,'preserve expired immediate layer until owning head ends');
 assert.equal(lifecycle.activeEffect(row,800),undefined,'Java immediate promotion finds duration zero and ends the whole chain');
 const f=runtimeFixture(JSON.stringify({numb:row}));f.advance(700);f.ctx.writeEffects(f.entity,f.ctx.readEffects(f.entity));f.reconnect();f.advance(800);assert.equal(f.ctx.readEffects(f.entity).numb,undefined);
});

test('payload limit counts UTF-8 bytes and refuses whole oversized maps without truncation',()=>{
 const payloadFor=key=>({[key]:{until:9000,amp:0}}),overhead=Buffer.byteLength(JSON.stringify(payloadFor('')));
 const exact=payloadFor('x'.repeat(lifecycle.MAX_EFFECT_PAYLOAD_BYTES-overhead));assert.equal(Buffer.byteLength(lifecycle.effectPayload(exact,100)),32767);
 assert.throws(()=>lifecycle.effectPayload(payloadFor('x'.repeat(lifecycle.MAX_EFFECT_PAYLOAD_BYTES-overhead+1)),100),/32767 UTF-8 bytes/);
 const unicode=payloadFor('界'.repeat(Math.floor((lifecycle.MAX_EFFECT_PAYLOAD_BYTES-overhead)/3)+1));assert.ok(JSON.stringify(unicode).length<32767);assert.throws(()=>lifecycle.effectPayload(unicode,100),/32767 UTF-8 bytes/);
});
test('multiple valid maximum chains exceed storage budget without altering existing saved state',()=>{
 let chain;for(let amp=0;amp<=255;amp++)chain=lifecycle.mergeEffectApplication(chain,10000-amp*10,amp,100);
 const wanted=Object.fromEntries(Array.from({length:8},(_,i)=>['fixture_effect_'+i,structuredClone(chain)]));assert.ok(Buffer.byteLength(JSON.stringify(wanted))>32767);
 const initial=JSON.stringify({warmth:{until:9000,amp:0}}),f=runtimeFixture(initial);f.ctx.readEffects(f.entity);
 assert.throws(()=>f.ctx.writeEffects(f.entity,wanted),/32767 UTF-8 bytes/);assert.equal(f.writes,0);assert.equal(f.raw,initial);assert.equal(f.ctx.readEffects(f.entity).warmth.until,9000);assert.equal(Object.keys(f.ctx.readEffects(f.entity)).length,1);
});
test('application storage rejection leaves old effect intact and cannot grant speculative dragon health',()=>{
 const initial=JSON.stringify({dragon_blood:{until:9000,amp:0},warmth:{until:8000,amp:0}}),f=runtimeFixture(initial);let healed=0;const warnings=[];
 Object.assign(f.ctx,{now:f.ctx.effectTime,console:{warn:message=>warnings.push(message)},nativeDragonHealth(){healed++}});vm.runInContext(body('fxApply')+'\n'+body('applyDragonBlood'),f.ctx);f.fail('before');
 assert.doesNotThrow(()=>f.ctx.applyDragonBlood(f.entity,1000,1));assert.match(warnings[0],/dragon_blood.*rejected setter/);assert.equal(f.raw,initial);assert.equal(f.ctx.readEffects(f.entity).dragon_blood.amp,0);assert.equal(healed,0);
});
test('acknowledged setter-after-write exception preserves exactly one saved application',()=>{
 const f=runtimeFixture(JSON.stringify({dragon_blood:{until:9000,amp:0}}));let healed=0;Object.assign(f.ctx,{now:f.ctx.effectTime,nativeDragonHealth(){healed++}});vm.runInContext(body('fxApply')+'\n'+body('applyDragonBlood'),f.ctx);f.fail('after');f.ctx.applyDragonBlood(f.entity,1000,1);
 assert.equal(f.writes,1);assert.equal(healed,1);assert.deepEqual(JSON.parse(f.raw).dragon_blood,{until:1100,amp:1,hidden:{until:9000,amp:0}});
});
