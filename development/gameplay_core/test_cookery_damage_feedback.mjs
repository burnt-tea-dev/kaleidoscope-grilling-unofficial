/** Actual G damage/feedback subscribers with API-operation adapters, not clients. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {activeEffects,FX_KEY} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/effect_lifecycle_core.js';
import {interactionParticles} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/immersion_particles_core.js';
import {emitParticleCommands} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/immersion_particle_delivery.js';
import {FLATULENCE_SOUND_ID} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_audio_core.js';
import {isCookeryLivingEntity} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/cookery_living_class.js';
import {flatulenceSoundOrigin,flatulenceSoundPitch} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/flatulence_sound_runtime.js';

const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const main=read('projects/grilling/gameplay_core/behavior_pack/scripts/main.js');
const flatulenceOracle=JSON.parse(read('development/gameplay_core/fixtures/java-flatulence-sound-160.json'));
const flatulenceWorld=JSON.parse(read('development/gameplay_core/fixtures/java-flatulence-world-160.json'));
const floatBits=value=>{const view=new DataView(new ArrayBuffer(4));view.setFloat32(0,value);return view.getUint32(0).toString(16).padStart(8,'0')};
const fxGet=main.slice(main.indexOf('function fxGet('),main.indexOf('function fxSet('));
function actor({living=true,typeId='minecraft:cow',families=['mob'],health=10,effect='hinder',until=2000}={}){
 const applied=[],sound=[],particles=[],impulses=[];
 return {id:'native-actor-'+Math.random(),typeId,isSneaking:false,applied,sound,particles,impulses,
  location:{x:2,y:80,z:3},
  dimension:{playSound:(...v)=>sound.push(v),spawnParticle:(...v)=>particles.push(v)},
  getComponent:id=>id==='minecraft:health'&&living?{currentValue:health}:id==='minecraft:type_family'&&families?{hasTypeFamily:family=>families.includes(family)}:undefined,
  getDynamicProperty:key=>key===FX_KEY?JSON.stringify({[effect]:{until,amp:0}}):undefined,
  addEffect:(...v)=>applied.push(v),applyImpulse:v=>impulses.push(v)};
}
function harness({legacy=false,draw=.5,worldCaptureBefore=false}={}){
 let pitchDraws=0;const pitchRandom=()=>{pitchDraws++;return draw};
 const callbacks={},context=vm.createContext({console,
  Math:Object.assign(Object.create(Math),{random:()=>draw}),SNEAK_LAST:new Map(),FLATULENCE_SOUND_ID,isCookeryLivingEntity,flatulenceSoundOrigin,flatulenceSoundPitch:()=>flatulenceSoundPitch(pitchRandom),
  now:()=>1000,readFx:entity=>activeEffects(JSON.parse(entity.getDynamicProperty(FX_KEY)??'{}'),1000),
  interactionParticleBurst:(dimension,origin,event)=>emitParticleCommands(dimension,origin,interactionParticles(event,()=>.25)),
  world:{afterEvents:Object.fromEntries(['entityHurt','entityHitEntity'].map(k=>[k,{subscribe:callback=>{callbacks[k]=callback}}]))}});
 vm.runInContext(fxGet,context);
 const handler=legacy?"world.afterEvents.entityHitEntity.subscribe(e=>{if(fxGet(e.damagingEntity,'hinder'))try{e.hitEntity.addEffect('slowness',100,{amplifier:1,showParticles:true})}catch{}});":
  main.slice(main.indexOf('world.afterEvents.entityHurt.subscribe(e=>{'),main.indexOf('function canUseSecretSkewer('));
 vm.runInContext(handler,context);
 const line=worldCaptureBefore?flatulenceWorld.before_source.line:main.split('\n').find(x=>x.includes('const sneak=!!p.isSneaking'));
 const snapshot=worldCaptureBefore?'':main.split('\n').find(x=>x.trim()==='const fx=readFx(p);');
 assert.ok(worldCaptureBefore||snapshot,'Current effect feedback uses the production local snapshot');
 return {callbacks,get pitchDraws(){return pitchDraws},hurt:event=>callbacks.entityHurt?.(event),tick:entity=>{context.p=entity;vm.runInContext('(()=>{'+snapshot+line+'})()',context)}};
}
function expectSlow(target){assert.equal(target.applied.length,1);const [name,ticks,options]=target.applied[0];assert.equal(name,'slowness');assert.equal(ticks,100);assert.equal(options.amplifier,1);assert.equal(options.showParticles,true)}
test('a responsible living attacker applies authored Hinder on projectile damage; the old melee-only handler misses it',()=>{
 const attacker=actor(),target=actor();const event={hurtEntity:target,damage:2,damageSource:{cause:'projectile',damagingEntity:attacker,damagingProjectile:actor({living:false})}};
 harness({legacy:true}).hurt(event);assert.equal(target.applied.length,0);
 harness().hurt(event);expectSlow(target);
});
test('melee and attributed non-melee after-hurt callbacks retain the same effect contract',()=>{
 for(const cause of ['entityAttack','magic','thorns']){const target=actor();harness().hurt({hurtEntity:target,damage:2,damageSource:{cause,damagingEntity:actor()}});expectSlow(target)}
});
test('Hinder does not add a positive damage gate absent in both original loader branches',()=>{
 const target=actor();harness().hurt({hurtEntity:target,damage:0,damageSource:{damagingEntity:actor()}});expectSlow(target);
});
test('missing responsible entity uses a native projectile owner, never the projectile effect state',()=>{
 const owner=actor(),target=actor(),projectile={getComponent:id=>id==='minecraft:projectile'?{owner}:undefined};
 harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingProjectile:projectile}});expectSlow(target);
});
test('a native arrow reported in both source fields resolves to its living owner, including separate wrappers for the same ID',()=>{
 for(const separateWrapper of [false,true]){
  const owner=actor(),target=actor(),projectile={id:'native-arrow',getComponent:id=>id==='minecraft:projectile'?{owner}:undefined};
  const damagingEntity=separateWrapper?{id:projectile.id,getComponent:projectile.getComponent}:projectile;
  harness().hurt({hurtEntity:target,damage:2,damageSource:{cause:'projectile',damagingEntity,damagingProjectile:projectile}});expectSlow(target);
 }
});
test('a reported arrow alone resolves its owner only through a recognized native projectile component',()=>{
 const target=actor(),owner=actor(),projectile={id:'native-arrow-only',getComponent:id=>id==='minecraft:projectile'?{owner}:undefined};
 harness().hurt({hurtEntity:target,damage:2,damageSource:{cause:'projectile',damagingEntity:projectile}});expectSlow(target);
 const unrelated=actor({living:false});harness().hurt({hurtEntity:target,damage:2,damageSource:{cause:'projectile',damagingEntity:unrelated}});assert.equal(target.applied.length,1);
});
test('an unrelated nonliving damager cannot inherit an owner from a different reported projectile',()=>{
 for(const damager of [actor({living:false}),{id:'another-native-arrow',getComponent:id=>id==='minecraft:projectile'?{owner:actor()}:undefined}]){
  const target=actor(),projectile={id:'damage-native-arrow',getComponent:id=>id==='minecraft:projectile'?{owner:actor()}:undefined};
  harness().hurt({hurtEntity:target,damage:2,damageSource:{cause:'projectile',damagingEntity:damager,damagingProjectile:projectile}});assert.equal(target.applied.length,0);
 }
});
test('reported responsible attacker takes precedence over a projectile owner',()=>{
 const target=actor(),attacker=actor({effect:'vigor'}),projectile={getComponent:()=>({owner:actor()})};
 harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingEntity:attacker,damagingProjectile:projectile}});assert.equal(target.applied.length,0);
});
test('missing, expired, nonliving attackers and nonliving victims do not gain Hinder',()=>{
 for(const attacker of [undefined,actor({until:1000}),actor({living:false}),actor({effect:'vigor'})]){
  const target=actor();harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingEntity:attacker}});assert.equal(target.applied.length,0);
 }
 const target=actor({living:false});harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingEntity:actor()}});assert.equal(target.applied.length,0);
});
test('a removed source/projectile or rejected effect remains local to that callback',()=>{
 const h=harness(),target=actor(),broken={getComponent(){throw Error('Removed entity')}};
 assert.doesNotThrow(()=>h.hurt({hurtEntity:target,damageSource:{damagingProjectile:broken}}));assert.equal(target.applied.length,0);
 target.addEffect=()=>{throw Error('Removed target')};assert.doesNotThrow(()=>h.hurt({hurtEntity:target,damageSource:{damagingEntity:actor()}}));
});
test('Hinder class guard rejects health-bearing boat, chest boat and minecart victims',()=>{
 for(const [typeId,families] of [['minecraft:boat',['boat','inanimate']],['minecraft:chest_boat',['boat','inanimate']],['minecraft:minecart',['minecart','inanimate']]]){
  const target=actor({typeId,families});harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingEntity:actor()}});assert.equal(target.applied.length,0);
 }
});
test('Hinder class permission retains cow, armor stand and player class controls without a mob-only assumption',()=>{
 for(const [typeId,families] of [['minecraft:cow',['mob']],['minecraft:armor_stand',['inanimate']],['minecraft:player',['player']]]){
  const target=actor({typeId,families});harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingEntity:actor({typeId,families})}});expectSlow(target);
 }
});
test('Hinder class permission does not introduce a positive-health or amount gate for health-zero living controls',()=>{
 for(const damage of [0,2]){
  const target=actor({health:0}),attacker=actor({health:0});harness().hurt({hurtEntity:target,damage,damageSource:{damagingEntity:attacker}});expectSlow(target);
 }
 const target=actor(),attacker=actor(),getComponent=attacker.getComponent;
 attacker.getComponent=id=>id==='minecraft:health'?{get currentValue(){throw Error('Class must not read life value')}}:getComponent(id);
 harness().hurt({hurtEntity:target,damage:0,damageSource:{damagingEntity:attacker}});expectSlow(target);
});
test('Hinder rejects health-bearing nonliving attackers even with active Hinder effect state',()=>{
 for(const [typeId,families] of [['minecraft:boat',['boat','inanimate']],['minecraft:chest_boat',['boat','inanimate']],['minecraft:minecart',['minecart','inanimate']]]){
  const target=actor();harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingEntity:actor({typeId,families})}});assert.equal(target.applied.length,0);
 }
});
test('Hinder reported health-vehicle damagers cannot inherit a living owner from a different arrow',()=>{
 const target=actor(),owner=actor(),vehicle=actor({typeId:'minecraft:boat',families:['boat','inanimate']}),projectile={id:'other-native-arrow',getComponent:id=>id==='minecraft:projectile'?{owner}:undefined};
 harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingEntity:vehicle,damagingProjectile:projectile}});assert.equal(target.applied.length,0);
});
test('Hinder projectile owner resolution rejects a vehicle owner while reported living attacker priority is retained',()=>{
 const owner=actor({typeId:'minecraft:minecart',families:['minecart','inanimate']}),arrow={id:'owner-vehicle-arrow',getComponent:id=>id==='minecraft:projectile'?{owner}:undefined};
 const denied=actor();harness().hurt({hurtEntity:denied,damage:2,damageSource:{damagingEntity:arrow,damagingProjectile:arrow}});assert.equal(denied.applied.length,0);
 const target=actor();harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingEntity:actor(),damagingProjectile:arrow}});expectSlow(target);
});
test('Hinder unknown custom classes, missing family membership and family faults cannot be inferred living',()=>{
 for(const mode of ['missing-family','nonmob-family','missing-method','throws'])for(const role of ['attacker','victim']){
  const unknown=actor({typeId:'addon:unknown_living_class',families:mode==='missing-family'?undefined:['unreviewed']});
  const getComponent=unknown.getComponent;
  unknown.getComponent=id=>id==='minecraft:type_family'?mode==='missing-family'?undefined:mode==='missing-method'?{}:mode==='throws'?{hasTypeFamily(){throw Error('Unloaded family')}}:getComponent(id):getComponent(id);
  const target=role==='victim'?unknown:actor(),attacker=role==='attacker'?unknown:actor();
  assert.doesNotThrow(()=>harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingEntity:attacker}}));assert.equal(target.applied.length,0);
 }
});
test('Hinder known player or armor stand still requires health presence and damaged component reads fail closed',()=>{
 for(const typeId of ['minecraft:player','minecraft:armor_stand']){
  const target=actor({typeId,families:undefined,living:false});harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingEntity:actor()}});assert.equal(target.applied.length,0);
 }
 const target=actor(),attacker=actor();attacker.getComponent=()=>{throw Error('Removed health component')};assert.doesNotThrow(()=>harness().hurt({hurtEntity:target,damage:2,damageSource:{damagingEntity:attacker}}));assert.equal(target.applied.length,0);
});
test('flatulence press sends ten Cloud commands and the existing original host audio exactly once',()=>{
 const h=harness(),subject=actor({effect:'flatulence'});h.tick(subject);subject.isSneaking=true;h.tick(subject);h.tick(subject);
 assert.equal(subject.impulses.length,1);assert.equal(subject.impulses[0].y,.75);assert.equal(subject.particles.length,10);
 assert.ok(subject.particles.every(x=>x[0]==='kaleidoscope_grilling:feedback_cloud'));assert.equal(subject.sound.length,1);
 const [id,location,options]=subject.sound[0];assert.equal(id,'kg_cookery.flatulence');assert.deepEqual(location,{x:2.5,y:80.5,z:3.5});assert.equal(options.volume,1);assert.equal(options.pitch,1);
 subject.isSneaking=false;h.tick(subject);subject.isSneaking=true;h.tick(subject);assert.equal(subject.sound.length,2);
});
test('flatulence producer pitch matches the independent Java scalar fixture without firing for inactive effects',()=>{
 for(const oracle of flatulenceOracle.pitch_oracle.cases){
  const h=harness({draw:oracle.draw}),subject=actor({effect:'flatulence'});subject.isSneaking=true;h.tick(subject);
  assert.equal(subject.sound.length,1);const pitch=subject.sound[0][2].pitch;
  assert.equal(pitch,oracle.pitch);assert.equal(floatBits(pitch),oracle.float_bits);assert.equal(h.pitchDraws,flatulenceOracle.sound.random_draw_count);
 }
 for(const subject of [actor({effect:'vigor'}),actor({effect:'flatulence',until:1000})]){const h=harness();subject.isSneaking=true;h.tick(subject);assert.equal(subject.sound.length,0);assert.equal(subject.particles.length,0);assert.equal(h.pitchDraws,0)}
});
test('flatulence producer keeps ten Cloud commands at continuous fractional positions while sound uses negative block centers',()=>{
 const cases=[
  [{x:1.2,y:80.1,z:-.2},{x:1.5,y:80.5,z:-.5}],
  [{x:-1.01,y:-.2,z:-3.9},{x:-1.5,y:-.5,z:-3.5}]
 ];
 for(const [location,soundCenter] of cases){
  const h=harness(),subject=actor({effect:'flatulence'});subject.location={...location};subject.isSneaking=true;h.tick(subject);
  assert.equal(subject.impulses.length,1);assert.equal(subject.impulses[0].y,.75);assert.equal(subject.sound.length,1);assert.deepEqual(subject.sound[0][1],soundCenter);assert.equal(h.pitchDraws,1);
  assert.equal(subject.particles.length,10);
  for(const [id,point] of subject.particles){assert.equal(id,'kaleidoscope_grilling:feedback_cloud');assert.ok(Math.abs(point.x-location.x)<1e-14);assert.ok(Math.abs(point.y-(location.y+.25))<1e-14);assert.ok(Math.abs(point.z-location.z)<1e-14)}
  assert.deepEqual(subject.location,location);
 }
});
test('flatulence producer does not fabricate a cue or consume RNG when its second location read fails after Cloud',()=>{
 const h=harness(),subject=actor({effect:'flatulence'}),location={x:-.01,y:70.99,z:5.01};let reads=0;
 Object.defineProperty(subject,'location',{get(){reads++;if(reads===2)throw Error('Unavailable audio position after Cloud');return location}});
 subject.isSneaking=true;assert.doesNotThrow(()=>h.tick(subject));
 assert.equal(reads,2);assert.equal(subject.impulses.length,1);assert.equal(subject.impulses[0].y,.75);assert.equal(subject.particles.length,10);assert.equal(subject.sound.length,0);assert.equal(h.pitchDraws,0);
 for(const [,point] of subject.particles){assert.ok(Math.abs(point.x-location.x)<1e-14);assert.ok(Math.abs(point.y-(location.y+.25))<1e-14);assert.ok(Math.abs(point.z-location.z)<1e-14)}
 // Subsequent reads would succeed. A held press must still not retry that cue.
 h.tick(subject);h.tick(subject);assert.equal(reads,2);assert.equal(subject.impulses.length,1);assert.equal(subject.particles.length,10);assert.equal(subject.sound.length,0);assert.equal(h.pitchDraws,0);
 subject.isSneaking=false;h.tick(subject);subject.isSneaking=true;h.tick(subject);
 assert.equal(reads,4);assert.equal(subject.impulses.length,2);assert.equal(subject.particles.length,20);assert.equal(subject.sound.length,1);assert.deepEqual(subject.sound[0][1],{x:-.5,y:70.5,z:5.5});assert.equal(h.pitchDraws,1);
});
test('unavailable particles or audio never change the authored impulse or the other feedback channel',()=>{
 const h=harness(),subject=actor({effect:'flatulence'});subject.dimension.spawnParticle=()=>{throw Error('Unloaded particle')};subject.isSneaking=true;assert.doesNotThrow(()=>h.tick(subject));assert.equal(subject.impulses.length,1);assert.equal(subject.sound.length,1);
 const other=actor({effect:'flatulence'});other.dimension.playSound=()=>{throw Error('Unloaded audio')};other.isSneaking=true;assert.doesNotThrow(()=>h.tick(other));assert.equal(other.impulses.length,1);assert.equal(other.particles.length,10);
});
test('Cloud Gaussian event vectors retain source offset, spread and speed',()=>{
 const particles=interactionParticles('flatulence',()=>.25);assert.equal(particles.length,10);
 for(const p of particles){assert.ok(Math.abs(p.offset[0])<1e-14);assert.ok(Math.abs(p.offset[1]-.25)<1e-14);assert.ok(Math.abs(p.offset[2])<1e-14);assert.ok(p.velocity.every(v=>Math.abs(v)<1e-14))}
 const varied=interactionParticles('flatulence',()=>.5),gaussian=-Math.sqrt(2*Math.log(2));
 for(const p of varied){assert.ok(Math.abs(p.offset[0]-gaussian*.25)<1e-14);assert.ok(Math.abs(p.offset[1]-(.25+gaussian*.25))<1e-14);assert.ok(p.velocity.every(v=>Math.abs(v-gaussian*.1)<1e-14))}
});
test('owned Cloud uses the existing G atlas/velocity contract and retains its declared limitation',()=>{
 const cloud=JSON.parse(read('projects/grilling/gameplay_core/resource_pack/particles/feedback_cloud.json')).particle_effect;
 assert.equal(cloud.description.identifier,'kaleidoscope_grilling:feedback_cloud');assert.equal(cloud.description.basic_render_parameters.texture,'textures/particle/kg_java_smoke');
 assert.equal(cloud.components['minecraft:emitter_rate_instant'].num_particles,1);assert.equal(cloud.components['minecraft:particle_appearance_billboard'].uv.texture_width,64);
 const text=JSON.stringify(cloud);assert.ok(text.includes('variable.kg_velocity_x'));assert.ok(!text.includes('variable.kt_'));assert.ok(!text.includes('kaleidoscope_tavern:'));
 const proof=JSON.parse(read('development/gameplay_core/fixtures/java-cookery-effect-feedback-160.json'));assert.equal(proof.client,false);assert.ok(proof.boundaries.some(x=>x.includes('Nearest-player')));
});

// Guard only the client-confirmed ?? direct-variable rule. This is not a
// replacement for Minecraft's complete Molang parser or rendered acceptance.
function cloudCoalescingOperands(expression){
 const operands=[...expression.matchAll(/([a-z_][a-z0-9_.]*)\s*\?\?\s*0\b/gi)].map(match=>match[1]);
 assert.equal(operands.length,(expression.match(/\?\?/g)??[]).length,'Cloud fallbacks must retain numeric zero');
 for(const operand of operands)assert.match(operand,/^variable\.[a-z_][a-z0-9_]*$/i,'Cloud ?? requires a direct scalar variable');
 return operands;
}
test('Cloud preserves all three scalar zero fallbacks and rejects the reported vector-member parser forms',()=>{
 const expression=JSON.parse(read('projects/grilling/gameplay_core/resource_pack/particles/feedback_cloud.json')).particle_effect.events.kg_cloud_init.expression;
 assert.deepEqual(cloudCoalescingOperands(expression),['variable.kg_velocity_x','variable.kg_velocity_y','variable.kg_velocity_z']);
 for(const axis of ['x','y','z']){
  assert.throws(()=>cloudCoalescingOperands(`variable.kg_velocity.${axis} ?? 0`),/direct scalar variable/);
  assert.deepEqual(cloudCoalescingOperands(`variable.kg_velocity_${axis} ?? 0`),[`variable.kg_velocity_${axis}`]);
  assert.throws(()=>cloudCoalescingOperands(`variable.kg_velocity_${axis} ?? 1`),/numeric zero/);
 }
 const source=JSON.parse(read('development/gameplay_core/fixtures/java-cookery-effect-feedback-160.json')).cloud_template.particle_effect.events.kt_init.expression;
 const restored=expression.replace(/variable\.kg_velocity_([xyz])/g,'variable.kt_v$1').replace(/variable\.kg_cloud_/g,'variable.kt_');
 assert.equal(restored,source,'Only Molang transport names may change; Java math, units and RNG remain exact');
});


test('flatulence world capture keeps the original pre-Cloud dimension while sound reads fresh post-Cloud coordinates',()=>{
 for(const before of [true,false]){
  const h=harness({worldCaptureBefore:before}),subject=actor({effect:'flatulence'}),original=subject.dimension,newSounds=[];
  const moved={x:-1.01,y:72.3,z:-.2},other={playSound:(...args)=>newSounds.push(args)};let current=original,dimensionReads=0;
  Object.defineProperty(subject,'dimension',{get(){dimensionReads++;return current}});
  original.spawnParticle=(id,point)=>{subject.particles.push([id,point]);if(subject.particles.length===1){current=other;subject.location={...moved}}};
  subject.isSneaking=true;h.tick(subject);
  assert.equal(subject.particles.length,10);assert.equal(subject.impulses.length,1);assert.equal(h.pitchDraws,1);
  const expectedCloud={x:2,y:80.25,z:3};for(const [,point] of subject.particles)assert.deepEqual(point,expectedCloud);
  assert.equal(subject.sound.length,before?0:1);assert.equal(newSounds.length,before?1:0);assert.equal(dimensionReads,before?2:flatulenceWorld.contract.server_world_reads);
  const cue=(before?newSounds:subject.sound)[0];assert.equal(cue[0],'kg_cookery.flatulence');assert.deepEqual(cue[1],{x:-1.5,y:72.5,z:-.5});assert.equal(cue[2].volume,1);assert.equal(cue[2].pitch,1);
 }
});
test('flatulence world capture does not repeat a post-Cloud dimension getter that has become unavailable',()=>{
 for(const before of [true,false]){
  const h=harness({worldCaptureBefore:before}),subject=actor({effect:'flatulence'}),original=subject.dimension;let reads=0,cloudStarted=false;
  Object.defineProperty(subject,'dimension',{get(){reads++;if(cloudStarted)throw Error('Unavailable post-Cloud world');return original}});
  original.spawnParticle=(id,point)=>{cloudStarted=true;subject.particles.push([id,point])};
  subject.isSneaking=true;assert.doesNotThrow(()=>h.tick(subject));
  assert.equal(subject.particles.length,10);assert.equal(subject.impulses.length,1);assert.equal(reads,before?2:flatulenceWorld.contract.server_world_reads);assert.equal(subject.sound.length,before?0:1);assert.equal(h.pitchDraws,before?0:flatulenceWorld.contract.pitch_draws);
  if(!before)assert.deepEqual(subject.sound[0][1],{x:2.5,y:80.5,z:3.5});
 }
});
