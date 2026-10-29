/** Statistical source-contract checks; no player or renderer simulation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {interactionParticles,grillParticles,oilImpactPitch,goldenSkewerParticles,invincibleAmbientParticle,createFeedbackCooldown} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/immersion_particles_core.js';
import {emitParticleCommands as emitParticles} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/immersion_particle_delivery.js';
function seeded(){let n=13579;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}
test('unlit grill emits nothing and consumes no random values',()=>{
 assert.deepEqual(grillParticles(false,()=>{throw Error('unexpected draw')}),[]);
});
test('grill ambient samples use distinct Java firebox heights and horizontal bounds',()=>{
 const random=seeded(),counts={smoke:0,flame:0};
 for(let i=0;i<50000;i++)for(const p of grillParticles(true,random)){
  const smoke=p.id.includes('smoke'),key=smoke?'smoke':'flame';counts[key]++;
  assert.equal(p.offset[1],smoke?.22:.18);
  for(const axis of [0,2])assert.ok(p.offset[axis]>=(smoke?.25:.3)&&p.offset[axis]<(smoke?.75:.7));
 }
 assert.ok(Math.abs(counts.smoke/50000-1/3)<.01);assert.ok(Math.abs(counts.flame/50000-1/8)<.01);
});
test('success bursts preserve Java count, center and Gaussian spatial spread',()=>{
 const random=seeded();
 for(const [event,count,center,spread] of [
  ['seasoningFinished',12,[0,1,0],[.25,.35,.25]],
  ['seasoningAdded',5,[.5,.7,.5],[.12,.12,.12]],
  ['oilPressImpact',14,[.5,.9,.5],[.32,.18,.32]]
 ]){
  const sums=[0,0,0],squares=[0,0,0];let n=0,tail=false;
  for(let i=0;i<3000;i++){
   const burst=interactionParticles(event,random);assert.equal(burst.length,count);
   for(const {offset} of burst){n++;for(let axis=0;axis<3;axis++){const z=(offset[axis]-center[axis])/spread[axis];sums[axis]+=z;squares[axis]+=z*z;if(Math.abs(z)>3)tail=true;}}
  }
  for(let axis=0;axis<3;axis++){assert.ok(Math.abs(sums[axis]/n)<.035);assert.ok(Math.abs(squares[axis]/n-1)<.05)}
  assert.ok(tail,'Gaussian distribution must not collapse to a uniform box');
 }
});
test('particle delivery failures remain cosmetic and do not abort remaining emissions',()=>{
 const calls=[],origin={x:10,y:64,z:-7};
 const result=emitParticles({spawnParticle(id,pos){calls.push({id,pos});if(calls.length===1)throw Error('unloaded')}},origin,[{id:'a',offset:[.5,.7,.5]},{id:'b',offset:[0,1,0]}]);
 assert.deepEqual(calls,[{id:'a',pos:{x:10.5,y:64.7,z:-6.5}},{id:'b',pos:{x:10,y:65,z:-7}}]);
 assert.equal(result.accepted,1);assert.equal(result.failed,1);assert.match(result.lastError,/unloaded/);
});
test('oil press impact varies through the original pitch interval',()=>{
 assert.equal(oilImpactPitch(()=>0),.82);assert.ok(oilImpactPitch(()=>.99999)<.94);assert.ok(oilImpactPitch(()=>.99999)>.9399);
});
test('golden finish draws eighteen spiral points and invincible orbit stays within Java radius/height',()=>{
 const ring=goldenSkewerParticles(()=>0);assert.equal(ring.length,18);
 ring.forEach(({offset},i)=>{assert.ok(Math.abs(Math.hypot(offset[0],offset[2])-.65)<1e-12);assert.equal(offset[1],.25+i*.06)});
 const random=seeded();for(let i=0;i<1000;i++){
  const [{offset,velocity}]=invincibleAmbientParticle(random);assert.ok(Math.abs(Math.hypot(offset[0],offset[2])-.45)<1e-12);assert.ok(offset[1]>=.3&&offset[1]<1.7);assert.deepEqual(velocity,[0,0,0]);
 }
});
test('shield cooldown shares actor identity across wrappers and releases expired bookkeeping',()=>{
 const cooldown=createFeedbackCooldown();assert.equal(cooldown.claim('a',100),true);assert.equal(cooldown.claim('a',100),false);assert.equal(cooldown.claim('b',100),true);
 assert.equal(cooldown.claim('a',105),false);cooldown.sweep(106);assert.equal(cooldown.size,0);assert.equal(cooldown.claim('a',106),true);
});
test('owned particle definitions emit exactly once at zero offset without implicit engine direction',()=>{
 const dir=new URL('../../projects/grilling/gameplay_core/resource_pack/particles/',import.meta.url);
 for(const name of ['basic_crit','electric_spark','villager_happy','endrod','basic_smoke','basic_flame']){
  const {description,components:c}=JSON.parse(fs.readFileSync(new URL('feedback_'+name+'.json',dir),'utf8')).particle_effect;
  assert.equal(description.identifier,'kaleidoscope_grilling:feedback_'+name);
  assert.deepEqual(Object.keys(c).filter(x=>x.includes('emitter_rate')),['minecraft:emitter_rate_instant']);
  assert.equal(c['minecraft:emitter_rate_instant'].num_particles,1);assert.deepEqual(c['minecraft:emitter_shape_point'].offset,[0,0,0]);
  assert.deepEqual(c['minecraft:emitter_shape_point'].direction,['variable.kg_velocity.x','variable.kg_velocity.y','variable.kg_velocity.z']);
  assert.ok(!JSON.stringify(c).includes('variable.direction'));
 }
});

// The production router and scheduler run through the same native API boundary
// as gameplay scenarios; callbacks below stand for competing addon actions.
import {createFixture as createCoreFixture} from '../helpers/minecraft-fixture.mjs';
test('one block gesture has one writer and post-action observers',async()=>{
 const f=createCoreFixture(),{onBlockInteraction}=await f.load('core/events.js'),calls=[];
 onBlockInteraction('later',()=>calls.push('second writer'),{priority:20});
 onBlockInteraction('observer',event=>calls.push('observed '+event.cancel),{observe:true});
 onBlockInteraction('station',event=>{calls.push('accepted');event.cancel=true},{priority:10,blocks:['kaleidoscope_grilling:grill']});
 const block=f.block('kaleidoscope_grilling:grill',{x:0,y:64,z:0});
 f.emit('world.beforeEvents.playerInteractWithBlock',{block,cancel:false});
 assert.deepEqual(calls,['accepted','observed true']);
 calls.length=0;f.emit('world.beforeEvents.playerInteractWithBlock',{block,cancel:true});
 assert.deepEqual(calls,['observed true'],'a different addon keeps its accepted gesture');
});
test('script routes share one native subscription and close without skipping another owner',async()=>{
 const f=createCoreFixture(),{scriptEvents}=await f.load('host_api/event_router.js'),onEvent=scriptEvents(f.system),calls=[];
 let closeFirst;
 closeFirst=onEvent('first',()=>{calls.push('first');closeFirst();});
 const closeSecond=onEvent('second',()=>calls.push('second'));
 assert.equal(f.subscribers.get('system.afterEvents.scriptEventReceive').length,1);
 f.emit('system.afterEvents.scriptEventReceive',{id:'example:reply'});
 assert.deepEqual(calls,['first','second']);
 f.emit('system.afterEvents.scriptEventReceive',{id:'example:reply'});
 assert.deepEqual(calls,['first','second','second']);
 closeSecond();closeSecond();
 assert.equal(f.subscribers.get('system.afterEvents.scriptEventReceive').length,0);
 const closeNew=onEvent('new',()=>calls.push('new'));
 f.emit('system.afterEvents.scriptEventReceive',{id:'example:reply'});
 assert.equal(calls.at(-1),'new');closeNew();f.dispose();
});
test('shared routing keeps separate SDK contexts isolated and continues after an owner throws',async()=>{
 const a=createCoreFixture(),b=createCoreFixture(),{scriptEvents}=await a.load('host_api/event_router.js'),calls=[];
 scriptEvents(a.system)('failed',()=>{throw Error('owner failure');});
 scriptEvents(a.system)('healthy',()=>calls.push('a'));
 scriptEvents(b.system)('other-world',()=>calls.push('b'));
 a.emit('system.afterEvents.scriptEventReceive',{id:'example:reply'});assert.deepEqual(calls,['a']);
 b.emit('system.afterEvents.scriptEventReceive',{id:'example:reply'});assert.deepEqual(calls,['a','b']);
 assert.equal(a.subscribers.get('system.afterEvents.scriptEventReceive').length,1);
 assert.equal(b.subscribers.get('system.afterEvents.scriptEventReceive').length,1);
 a.dispose();b.dispose();
});
test('break phases stay distinct and a later explosion cancellation reaches deferred work',async()=>{
 const f=createCoreFixture(),router=await f.load('core/events.js'),calls=[];
 router.onBeforeBlockBreak('before',event=>{calls.push('before');event.cancel=true;});
 router.onBeforeBlockBreak('observer',event=>calls.push('cancelled:'+event.cancel));
 router.onAfterBlockBreak('after',()=>calls.push('after'));
 f.emit('world.beforeEvents.playerBreakBlock',{cancel:false});
 assert.deepEqual(calls,['before','cancelled:true']);
 f.emit('world.afterEvents.playerBreakBlock',{});assert.equal(calls.at(-1),'after');
 router.onExplosion('deferred',event=>f.system.run(()=>{if(event.cancel===false)calls.push('destroy');}));
 f.world.beforeEvents.explosion.subscribe(event=>{event.cancel=true;});
 f.emit('world.beforeEvents.explosion',{cancel:false});f.flush();
 assert.ok(!calls.includes('destroy'));f.dispose();
});
test('shared scheduling preserves deadlines, cancellation and failure isolation',async()=>{
 const f=createCoreFixture(),{every}=await f.load('core/scheduler.js'),calls=[];
 every('two',()=>{calls.push('two:'+f.system.currentTick);if(f.system.currentTick===4)throw Error('failed task')},2);
 every('three',()=>calls.push('three:'+f.system.currentTick),3);
 const cancel=every('cancelled',()=>calls.push('unexpected'),1);cancel();f.tick(6);
 assert.deepEqual(calls,['two:2','three:3','two:4','two:6','three:6']);
});
