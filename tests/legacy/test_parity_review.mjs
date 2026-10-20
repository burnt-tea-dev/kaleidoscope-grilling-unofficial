import {normalizePublicFood,readPublicFood,writePublicFood} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/food_api_core.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TimedWorkQueue} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/timed_work_queue.js';
import {VisualTargetQueue} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/visual_target_queue.js';
import {milkEffects,effectPayload} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/effect_lifecycle_core.js';
import {normalizeConfig,configValue} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/server_config_core.js';
import {seasoningLore,creatorLore} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/localized_lore_core.js';
test('milk cures every active grilling effect except Java uncurable poisoning',()=>{
 const input={invincible:{until:500,amp:0},dragon_blood:{until:500,amp:1},numb:{until:500,amp:0},heavy_metal:{until:500,amp:0},heavy_metal_poisoning:{until:700,amp:0},warmth:{until:20,amp:0}};
 assert.deepEqual(milkEffects(input,100),{heavy_metal_poisoning:{until:700,amp:0}});assert.deepEqual(milkEffects(input,701),{});assert.equal(effectPayload({},100),undefined);
});
test('deadline queue orders work, replaces keys and cancels without visiting future keys',()=>{
 const q=new TimedWorkQueue();for(let i=0;i<1000;i++)q.schedule('future'+i,5000+i);q.schedule('urgent',2);q.schedule('cancel',1);q.cancel('cancel');q.schedule('urgent',0);
 assert.deepEqual(q.take(0,8),['urgent']);assert.deepEqual(q.take(4999,8),[]);assert.equal(q.size,1000);assert.deepEqual(q.take(5007,8),Array.from({length:8},(_,i)=>'future'+i));
});
test('deadline replacement/cancellation cannot retain a stale-node burst outside the dequeue budget',()=>{
 const q=new TimedWorkQueue();
 for(let i=0;i<20000;i++)q.schedule('same-hot-slot',100000+i);
 assert.equal(q.size,1);assert.equal(q.heap.length,1);
 q.cancel('same-hot-slot');assert.equal(q.heap.length,0);q.cancel('already-gone');
 q.schedule('due',1);let pops=0;const pop=q.pop.bind(q);q.pop=()=>{pops++;return pop()};
 assert.deepEqual(q.take(1000000,1),['due']);assert.equal(pops,1);assert.equal(q.size,0);
});
test('deadline replacement preserves due/serial ties, no-budget calls and late-clock work limits',()=>{
 const q=new TimedWorkQueue();q.schedule('first',10);q.schedule('second',10);q.schedule('first',20);q.schedule('first',10);q.schedule('second',10);
 q.schedule('undefined-deadline',undefined);assert.equal(q.size,2); // Existing undefined schedule is a no-op.
 assert.deepEqual(q.take(1000,0),[]);assert.deepEqual(q.take(1000,-1),[]);assert.equal(q.size,2);
 assert.deepEqual(q.take(9,2),[]);assert.deepEqual(q.take(1000,1),['second']);assert.deepEqual(q.take(1001,1),['first']);
 q.schedule('cancelled',1002);q.cancel('cancelled');q.schedule('cancelled',1003);
 assert.deepEqual(q.take(1002,1),[]);assert.deepEqual(q.take(1003,1),['cancelled']);
});
test('mixed deadline replacement/removal agrees with a stable due-order reference',()=>{
 const q=new TimedWorkQueue(),pending=new Map();let seed=17,serial=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed};
 for(let i=0;i<600;i++){
  const key='slot'+random()%29,at=random()%41;
  if(i%4===0){q.cancel(key);pending.delete(key)}else{
   q.schedule(key,at);if(pending.get(key)?.at!==at)pending.set(key,{at,serial:++serial});
  }
  if(i%7===0){
   const now=random()%41,budget=1+random()%5,expected=[...pending].filter(([,v])=>v.at<=now).sort((a,b)=>a[1].at-b[1].at||a[1].serial-b[1].serial).slice(0,budget).map(([key])=>key);
   assert.deepEqual(q.take(now,budget),expected);for(const key of expected)pending.delete(key);
  }
  assert.equal(q.size,pending.size);assert.equal(q.heap.length,pending.size);
 }
 assert.deepEqual(q.take(Infinity,Infinity),[...pending].sort((a,b)=>a[1].at-b[1].at||a[1].serial-b[1].serial).map(([key])=>key));
});
test('dirty nearby station updates before 1000 far saved stations; idle world visits none',()=>{
 const q=new VisualTargetQueue();for(let i=0;i<1000;i++)q.add('far'+i,{dimensionId:'overworld',location:{x:10000+i,y:0,z:0}});
 for(let i=0;i<20;i++)q.add('near'+i,{dimensionId:'overworld',location:{x:i,y:0,z:0}});
 q.observe([{dimensionId:'overworld',x:0,y:0,z:0}]);q.take(8);q.mark('near19');assert(q.take(8).includes('near19'));assert(q.take(8).every(k=>k.startsWith('near')));
 q.observe([]);for(let i=0;i<8;i++)q.take(8);assert.deepEqual(q.take(8),[]);assert.equal(q.dirty.size,0);
});
test('continuous edits cannot starve fair refresh with a bounded work budget',()=>{
 const q=new VisualTargetQueue();for(let i=0;i<20;i++)q.add(String(i),{dimensionId:'overworld',location:{x:i,y:0,z:0}});q.observe([{dimensionId:'overworld',x:0,y:0,z:0}]);
 const seen=new Set();for(let i=0;i<40;i++){q.mark('0');for(const k of q.take(2))seen.add(k)}assert.equal(seen.size,20);
});
test('configuration accepts meaningful limits and rejects invalid/unknown values',()=>{
 assert.equal(normalizeConfig({saturationMultiplier:2}).saturationMultiplier,2);assert.equal(configValue('fullHungerEating','false'),false);assert.equal(configValue('contentsHelpers','4096'),4096);
 for(const [k,v] of [['contentsHelpers',0],['contentsTargetsPerTick',100],['saturationMultiplier',Infinity],['fullHungerEating','yes'],['unknown',1]])assert.throws(()=>configValue(k,v));
});
test('runtime lore uses language keys rather than fixed language text',()=>{
 assert.equal(seasoningLore(16,8,{pending:true}).length,3);assert.equal(creatorLore('name').with[0],'name');
 for(const lang of ['en_US','zh_TW','zh_CN']){const text=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/resource_pack/texts/'+lang+'.lang',import.meta.url),'utf8');for(const line of [...seasoningLore(1,2,{missingBase:true}),creatorLore('name')])assert(text.includes(line.translate+'='));}
});

test('public native variant survives heat metadata rewrites and rejects invalid data',()=>{
 const stack={lore:[],getRawLore(){return this.lore},setLore(v){this.lore=v}};
 writePublicFood(stack,{v:1,hotUntil:1201,seasoning:[],nativeVariant:7});const state=readPublicFood(stack).state;
 writePublicFood(stack,{...state,hotUntil:1200});assert.equal(readPublicFood(stack).state.nativeVariant,7);
 for(const nativeVariant of [-1,1.5,32768,'7'])assert.equal(normalizePublicFood({v:1,hotUntil:0,seasoning:[],nativeVariant}),undefined);
});
test('minimum visual budget alternates departed cleanup and active refresh',()=>{
 const q=new VisualTargetQueue();q.add('departed',{dimensionId:'overworld',location:{x:100,y:0,z:0}});q.add('active',{dimensionId:'overworld',location:{x:0,y:0,z:0}});q.observe([{dimensionId:'overworld',x:100,y:0,z:0}]);q.observe([{dimensionId:'overworld',x:0,y:0,z:0}]);const visited=[...q.take(1),...q.take(1)];assert(visited.includes('departed'));assert(visited.includes('active'));q.observe([]);assert.deepEqual(q.take(1),['active']);assert.deepEqual(q.take(1),[]);
});
