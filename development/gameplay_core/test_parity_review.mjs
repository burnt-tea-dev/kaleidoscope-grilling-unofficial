import {normalizePublicFood,readPublicFood,writePublicFood} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/food_api_core.js';
import {stationProjection,registerStationProjection} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/station_projection_core.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {TimedWorkQueue} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/timed_work_queue.js';
import {VisualTargetQueue} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/visual_target_queue.js';
import {activeEffects,milkEffects,effectPayload,FX_KEY} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/effect_lifecycle_core.js';
import {normalizeConfig,configValue} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/server_config_core.js';
import {seasoningLore,creatorLore} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/localized_lore_core.js';
const scriptRoot='projects/grilling/gameplay_core/behavior_pack/scripts/';
const strip=s=>s.replace(/^import\b[\s\S]*?;\s*/gm,'').replace(/\bexport /g,'');
test('milk cures every active grilling effect except Java uncurable poisoning',()=>{
 const input={invincible:{until:500,amp:0},dragon_blood:{until:500,amp:1},numb:{until:500,amp:0},heavy_metal:{until:500,amp:0},heavy_metal_poisoning:{until:700,amp:0},warmth:{until:20,amp:0}};
 assert.deepEqual(milkEffects(input,100),{heavy_metal_poisoning:{until:700,amp:0}});assert.deepEqual(milkEffects(input,701),{});assert.equal(effectPayload({},100),undefined);
});
test('shared effect runtime avoids empty/unchanged writes and preserves extended duration',()=>{
 const dp=new Map();let writes=0,reads=0,tick=1,time=100;
 const entity={getDynamicProperty(k){reads++;return dp.get(k)},setDynamicProperty(k,v){writes++;if(v===undefined)dp.delete(k);else dp.set(k,v)}};
 const cleared=[],context={world:{getAbsoluteTime:()=>time},system:{get currentTick(){return tick}},activeEffects,effectPayload,milkEffects,FX_KEY,nativeDragonHealth:(actor,level)=>cleared.push([actor,level])};
 vm.runInNewContext(strip(fs.readFileSync(scriptRoot+'effect_state_runtime.js','utf8'))+';this.api={readEffects,writeEffects,clearEffects}',context);
 for(let i=0;i<20;i++)context.api.writeEffects(entity,context.api.readEffects(entity));assert.equal(writes,0);assert.equal(reads,1);
 context.api.writeEffects(entity,{dragon_blood:{until:200,amp:0},heavy_metal_poisoning:{until:400,amp:0}});assert.equal(writes,1);
 context.api.writeEffects(entity,context.api.readEffects(entity));assert.equal(writes,1);
 context.api.clearEffects(entity,{milk:true});assert.deepEqual(JSON.parse(dp.get(FX_KEY)),{heavy_metal_poisoning:{until:400,amp:0}});
 assert.deepEqual(cleared,[[entity,undefined]]);
 context.api.clearEffects(entity);assert.equal(dp.get(FX_KEY),undefined);tick++;time=500;assert.equal(Object.keys(context.api.readEffects(entity)).length,0);
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
// Execute the maintained synchronous effect pass with the real state adapter;
// count API/parse work, not wall time or client network latency.
function effectPassFixture(source=fs.readFileSync(scriptRoot+'main.js','utf8')){
 const state={tick:0,raw:undefined,sneak:false},counts={effectReads:0,rawReads:0,parses:0,hunger:0,saturation:0},trace=[];
 const system={get currentTick(){return state.tick}},world={getAbsoluteTime:()=>state.tick};
 const hunger={currentValue:10,setCurrentValue(n){this.currentValue=n}},sat={currentValue:2,setCurrentValue(n){this.currentValue=n}};
 const player={id:'effect-holder',isSprinting:true,dimension:{id:'minecraft:overworld'},location:{x:0,y:64,z:0},
  get isSneaking(){return state.sneak},getDynamicProperty(){counts.rawReads++;return state.raw},setDynamicProperty(_key,value){state.raw=value},
  getComponent(name){if(name==='minecraft:player.hunger'){counts.hunger++;return hunger}if(name==='minecraft:player.saturation'){counts.saturation++;return sat}return {currentValue:20,effectiveMax:20}},
  getProperty(){return 0},applyImpulse:()=>trace.push('flatulence'),getBlockStandingOn:()=>undefined};
 const effects={world,system,activeEffects,effectPayload,milkEffects,FX_KEY,JSON:{parse(raw){counts.parses++;return JSON.parse(raw)},stringify:JSON.stringify},nativeDragonHealth(){}};
 vm.runInNewContext(strip(fs.readFileSync(scriptRoot+'effect_state_runtime.js','utf8'))+';this.api={readEffects,writeEffects}',effects);
 const readFx=actor=>{counts.effectReads++;return effects.api.readEffects(actor)};
 const context={p:player,system,readFx,writeFx:(actor,fx)=>effects.api.writeEffects(actor,fx),fxGet(actor,name){const v=readFx(actor)[name];return v&&v.until>state.tick?v:null},
  VIGOR_LAST:new Map(),SNEAK_LAST:new Map(),ACTIVE_EATS:new Map(),PENDING_USES:new Map(),TUNDRA_BLOCKS:new Set(),
  invincibleAmbientFeedback:()=>trace.push('invincible'),interactionParticleBurst(){},flatulenceSoundOrigin:()=>undefined,
  fleeCreepers:()=>trace.push('mustard'),repelPhantoms:()=>trace.push('sulfur'),nearHeat:()=>false,
  nativeDragonHealth:(_actor,amp)=>trace.push(['dragon',amp]),updateNumbVisual:(_actor,enabled)=>trace.push(['numb',enabled])};
 let start=source.indexOf('  // One local snapshot');
 if(start<0)start=source.indexOf("  if(system.currentTick%10===0&&fxGet(p,'invincible'))");
 const end=source.indexOf('\n\n }catch{}}',start);assert(start>=0&&end>start);
 vm.runInNewContext('this.run=()=>{'+source.slice(start,end)+'}',context);
 return {counts,trace,hunger,sat,state,step(tick,fx){state.tick=tick;if(fx!==undefined)state.raw=effectPayload(fx,tick);context.run()}};
}
test('idle player effect pass reads one snapshot and skips unrelated hunger components',()=>{
 const f=effectPassFixture();for(let tick=1;tick<=100;tick++)f.step(tick);
 assert.equal(f.counts.effectReads,100);assert.equal(f.counts.rawReads,100);
 assert.equal(f.counts.hunger,0);assert.equal(f.counts.saturation,0);
});
test('effect snapshot is fresh on the next pass, preserves sprint protection and exact expiry/feedback ticks',()=>{
 const f=effectPassFixture();f.step(1,{vigor:{until:3,amp:0},mustard:{until:11,amp:0},sulfur:{until:11,amp:0},numb:{until:3,amp:0}});
 f.hunger.currentValue=9;f.sat.currentValue=1;f.step(2);assert.equal(f.hunger.currentValue,10);assert.equal(f.sat.currentValue,2);
 f.step(3);assert.equal(f.counts.hunger,2);assert.deepEqual(f.trace.at(-1),['numb',false]);
 f.step(5);assert(f.trace.includes('mustard'));assert(f.trace.includes('sulfur'));
 const before=f.trace.filter(x=>x==='mustard').length;f.step(15);assert.equal(f.trace.filter(x=>x==='mustard').length,before);
 // An event-side effect write between passes must be visible immediately on
 // the next tick; no retained per-player snapshot or changed persistence.
 f.step(16,{dragon_blood:{until:18,amp:1},numb:{until:18,amp:0}});
 assert.deepEqual(f.trace.slice(-2),[['dragon',1],['numb',true]]);f.step(18);assert.deepEqual(f.trace.slice(-2),[['dragon',undefined],['numb',false]]);
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
 for(const lang of ['en_US','zh_TW','zh_CN']){const text=fs.readFileSync('projects/grilling/gameplay_core/resource_pack/texts/'+lang+'.lang','utf8');for(const line of [...seasoningLore(1,2,{missingBase:true}),creatorLore('name')])assert(text.includes(line.translate+'='));}
});

test('public native variant survives heat metadata rewrites and rejects invalid data',()=>{
 const stack={lore:[],getRawLore(){return this.lore},setLore(v){this.lore=v}};
 writePublicFood(stack,{v:1,hotUntil:1201,seasoning:[],nativeVariant:7});const state=readPublicFood(stack).state;
 writePublicFood(stack,{...state,hotUntil:1200});assert.equal(readPublicFood(stack).state.nativeVariant,7);
 for(const nativeVariant of [-1,1.5,32768,'7'])assert.equal(normalizePublicFood({v:1,hotUntil:0,seasoning:[],nativeVariant}),undefined);
});
test('render providers preserve the explicitly published item variant',()=>{
 const stack={typeId:'minecraft:suspicious_stew',getRawLore(){return []},getComponent(){},clone(){return {...this}}};assert.equal(stationProjection(stack,{nativeVariant:7}).data,7);
 assert(registerStationProjection('test:custom',()=>({data:4})));assert(!registerStationProjection('test:custom',()=>({data:2})));
 assert.equal(stationProjection({...stack,typeId:'test:custom'},{}).data,4);assert.throws(()=>stationProjection(stack,{nativeVariant:32768}));
});
test('native equipment commands include and verify the declared aux data',()=>{
 const text=fs.readFileSync(scriptRoot+'station_contents_visual_runtime.js','utf8');const code=text.slice(text.indexOf('export function renderItemType('),text.indexOf('function pose('));const cmds=[];
 const ctx={stationProjection,readPublicFood:()=>({present:true,valid:true,state:{nativeVariant:7}})};vm.runInNewContext(code.replace('export ','' )+';this.run=renderItemType',ctx);
 const result=ctx.run({runCommand:c=>cmds.push(c)},{typeId:'minecraft:suspicious_stew',getRawLore(){return []},getComponent(){},clone(){return {...this}}});
 assert.equal(result.data,7);assert.equal(cmds[0],'replaceitem entity @s slot.weapon.mainhand 0 minecraft:suspicious_stew 1 7');assert(cmds[1].includes('data=7'));
});

test('minimum visual budget alternates departed cleanup and active refresh',()=>{
 const q=new VisualTargetQueue();q.add('departed',{dimensionId:'overworld',location:{x:100,y:0,z:0}});q.add('active',{dimensionId:'overworld',location:{x:0,y:0,z:0}});q.observe([{dimensionId:'overworld',x:100,y:0,z:0}]);q.observe([{dimensionId:'overworld',x:0,y:0,z:0}]);const visited=[...q.take(1),...q.take(1)];assert(visited.includes('departed'));assert(visited.includes('active'));q.observe([]);assert.deepEqual(q.take(1),['active']);assert.deepEqual(q.take(1),[]);
});
test('same actor wrappers share acknowledged effects; unapplied faults cannot poison snapshots',()=>{
 const dp=new Map();let tick=1,reads=0,fail=false;
 const wrapper=()=>({id:'same-native-actor',getDynamicProperty(k){reads++;return dp.get(k)},setDynamicProperty(k,v){if(fail==='before')throw Error('before write');if(fail==='after'){dp.set(k,v);throw Error('after write')}if(v===undefined)dp.delete(k);else dp.set(k,v)}});
 const a=wrapper(),b=wrapper(),context={world:{getAbsoluteTime:()=>100},system:{get currentTick(){return tick}},activeEffects,effectPayload,milkEffects,FX_KEY};
 vm.runInNewContext(strip(fs.readFileSync(scriptRoot+'effect_state_runtime.js','utf8'))+';this.api={readEffects,writeEffects}',context);
 const api=context.api;api.readEffects(a);api.readEffects(b);assert.equal(reads,1);
 api.writeEffects(a,{vigor:{until:400,amp:0}});assert.equal(api.readEffects(b).vigor.until,400);
 const draft=api.readEffects(b);draft.vigor.until=600;assert.equal(api.readEffects(a).vigor.until,400);api.writeEffects(b,draft);assert.equal(api.readEffects(a).vigor.until,600);
 // An applied mutation is acknowledged by storage readback, even if its setter
 // reports a later error. It must neither refund nor invent an unapplied write.
 fail='after';assert.doesNotThrow(()=>api.writeEffects(a,{warmth:{until:500,amp:0}}));assert.equal(api.readEffects(b).warmth.until,500);assert.equal(api.readEffects(b).vigor,undefined);
 fail='before';assert.throws(()=>api.writeEffects(a,{vigor:{until:800,amp:0}}));assert.equal(api.readEffects(b).warmth.until,500);assert.equal(api.readEffects(b).vigor,undefined);tick++;assert.equal(api.readEffects(a).warmth.until,500);
});
