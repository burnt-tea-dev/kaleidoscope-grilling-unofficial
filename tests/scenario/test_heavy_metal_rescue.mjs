import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../helpers/minecraft-fixture.mjs';

async function rescueFixture(until=10){
 const f=createFixture({currentTick:8});
 await f.load('main.js');f.startup();f.flush();
 f.p=f.player();f.hp=f.p.getComponent('minecraft:health');
 f.effectCore=await f.load('effect_lifecycle_core.js');
 f.claims=await f.load('heavy_metal_claim_core.js');
 f.state=await f.load('effect_state_runtime.js');
 f.before={heavy_metal:{until,amp:0},warmth:{until:1000,amp:0}};
 f.p.setDynamicProperty(f.effectCore.FX_KEY,JSON.stringify(f.before));
 f.saved=()=>JSON.parse(f.p.getDynamicProperty(f.effectCore.FX_KEY)??'{}');
 f.hurt=({health=0,rejectCancel=false,cause='entityAttack'}={})=>{
  // Measured before-hurt boundary: provisional health, restored by cancellation.
  // This fixture does not model native armor, totem activation or damage order.
  f.hp.currentValue=health;let canceled=false;
  const event={hurtEntity:f.p,damage:20,damageSource:{cause}};
  Object.defineProperty(event,'cancel',{get:()=>canceled,set:value=>{
   if(rejectCancel)throw Error('cancellation denied');
   canceled=value;if(value)f.hp.currentValue=20;
  }});
  f.emit('world.beforeEvents.entityHurt',event);return event;
 };
 return f;
}
for(const until of [10,1000])test((until===10?'last-tick':'unexpired')+' rescue pays poisoning immediately and settles health once',async()=>{
 const f=await rescueFixture(until);
 try{
  assert.equal(f.hurt().cancel,true);
  assert.deepEqual(f.saved(),{warmth:f.before.warmth,heavy_metal_poisoning:{until:12009,amp:0}});
  f.tick();assert.equal(f.hp.currentValue,1);
  assert.deepEqual(f.saved(),{warmth:f.before.warmth,heavy_metal_poisoning:{until:12009,amp:0}});
  assert.equal(f.sounds.filter(s=>s.sound==='kg_java21.heavy_metal').length,1);
  f.tick(2);assert.equal(f.sounds.filter(s=>s.sound==='kg_java21.heavy_metal').length,1);
 }finally{f.dispose()}
});
test('an effect already expired at the hit cannot reserve or pay a rescue',async()=>{
 const f=await rescueFixture(9);
 try{
  assert.equal(f.hurt().cancel,false);
  assert.equal(f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY),undefined);
  f.tick();assert.equal(f.saved().heavy_metal_poisoning,undefined);
  assert.equal(f.sounds.filter(s=>s.sound==='kg_java21.heavy_metal').length,0);
 }finally{f.dispose()}
});
test('same-tick seasoning sees poisoning and cannot renew a rescue already spent',async()=>{
 const f=await rescueFixture();
 try{
  assert.equal(f.hurt().cancel,true);
  const effects=await f.load('effect/runtime.js');
  effects.applySeasoning(f.p,['kaleidoscope_grilling:totem_powder']);
  assert.equal(f.saved().heavy_metal,undefined);
  assert.equal(f.saved().heavy_metal_poisoning.until,12009);
 }finally{f.dispose()}
});
for(const mode of ['effect write','queued scheduler','cancel'])test(mode+' rejection without cancellation restores effects and claim',async()=>{
 const f=await rescueFixture();
 try{
  if(mode==='effect write')f.faults.failNext(f.p,'setDynamicProperty',{
   phase:'before',predicate:(key,value)=>key===f.effectCore.FX_KEY&&value?.includes('heavy_metal_poisoning')
  });
  const run=f.system.run;
  if(mode==='queued scheduler')f.system.run=callback=>{run(callback);throw Error('queued then failed')};
  const event=f.hurt({rejectCancel:mode==='cancel'});f.system.run=run;
  assert.equal(event.cancel,false);assert.deepEqual(f.saved(),f.before);
  assert.deepEqual(f.state.readEffects(f.p),f.before,'same-tick effect cache matches restored state');
  assert.equal(f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY),undefined);
  f.hp.currentValue=20;f.tick();assert.equal(f.hp.currentValue,20);
  assert.equal(f.sounds.filter(s=>s.sound==='kg_java21.heavy_metal').length,0);
 }finally{f.dispose()}
});
test('an acknowledged effect write that throws still pays and rescues only once',async()=>{
 const f=await rescueFixture();
 try{
  f.faults.failNext(f.p,'setDynamicProperty',{
   phase:'after',predicate:(key,value)=>key===f.effectCore.FX_KEY&&value?.includes('heavy_metal_poisoning')
  });
  assert.equal(f.hurt().cancel,true);f.tick();assert.equal(f.hp.currentValue,1);
  assert.equal(f.saved().heavy_metal_poisoning.until,12009);
  assert.equal(f.hurt().cancel,false,'poisoning prevents another rescue');
 }finally{f.dispose()}
});
test('a later death is not revived by the queued health settlement',async()=>{
 const f=await rescueFixture();
 try{
  assert.equal(f.hurt().cancel,true);f.hp.currentValue=0;f.tick();
  assert.equal(f.hp.currentValue,0);assert.equal(f.sounds.filter(s=>s.sound==='kg_java21.heavy_metal').length,0);
 }finally{f.dispose()}
});
test('saving and reloading spent effects retains poisoning without replaying the rescue',async()=>{
 const f=await rescueFixture(),reloaded=await rescueFixture();
 try{
  assert.equal(f.hurt().cancel,true);f.tick();
  const fx=f.p.getDynamicProperty(f.effectCore.FX_KEY),claim=f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY);
  reloaded.p.setDynamicProperty(reloaded.effectCore.FX_KEY,fx);
  reloaded.p.setDynamicProperty(reloaded.claims.HEAVY_METAL_CLAIM_KEY,claim);
  assert.equal(reloaded.hurt().cancel,false);reloaded.hp.currentValue=20;reloaded.tick();
  assert.equal(reloaded.hp.currentValue,20);assert.equal(reloaded.saved().heavy_metal_poisoning.until,12009);
  assert.equal(reloaded.sounds.filter(s=>s.sound==='kg_java21.heavy_metal').length,0);
 }finally{f.dispose();reloaded.dispose()}
});
test('confirmed native totem cure removes Heavy Metal after an absorption-ambiguous hit',async()=>{
 const f=await rescueFixture(1000);
 try{
  f.p.off=new f.ItemStack('minecraft:totem_of_undying');
  f.p.addEffect('absorption',400,{amplifier:0});
  assert.equal(f.hurt({health:-3}).cancel,false,'remaining shield is unknown, so current admission does not spend rescue');
  assert.deepEqual(f.saved(),f.before,'holding a totem never implies cure');
  assert.equal(f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY),undefined);
  // API boundary only: the engine has separately confirmed TotemOfUndying.
  // This fixture does not decide native absorption/totem outcome or order.
  f.hp.currentValue=1;f.p.off=undefined;
  f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing:4,healSource:{cause:'TotemOfUndying'}});
  assert.deepEqual(f.saved(),{warmth:f.before.warmth});
  assert.deepEqual(f.state.readEffects(f.p),{warmth:f.before.warmth},'same-tick cache reflects cure');
  assert.equal(f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY),undefined);
  f.tick();assert.equal(f.hp.currentValue,1);
  assert.equal(f.sounds.filter(s=>s.sound==='kg_java21.heavy_metal').length,0);
 }finally{f.dispose()}
});
for(const cause of ['entityAttack','override','void','selfDestruct'])test(cause+' rescue admission is unchanged by an equipped totem',async()=>{
 const f=await rescueFixture(1000);
 try{
  f.p.off=new f.ItemStack('minecraft:totem_of_undying');
  assert.equal(f.hurt({cause}).cancel,true);
  assert.ok(f.saved().heavy_metal_poisoning);assert.equal(f.p.off.typeId,'minecraft:totem_of_undying');
 }finally{f.dispose()}
});
test('ordinary healing, zero healing and missing after-heal cannot infer a totem cure',async()=>{
 const f=await rescueFixture(1000);
 try{
  f.p.off=new f.ItemStack('minecraft:totem_of_undying');f.hp.currentValue=1;
  for(const [cause,healing] of [['Heal',10],['Regeneration',1],['SelfHeal',1],['TotemOfUndying',0]]){
   f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing,healSource:{cause}});
   assert.deepEqual(f.saved(),f.before);
  }
  f.p.off=undefined;f.tick();assert.deepEqual(f.saved(),f.before,'slot removal without confirmed native heal is not cure');
 }finally{f.dispose()}
});
test('native totem after an earlier rescue revokes only pending health settlement and keeps poisoning',async()=>{
 const f=await rescueFixture(1000);
 try{
  assert.equal(f.hurt().cancel,true);
  const paid=f.saved(),claim=f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY);
  f.hp.currentValue=2;
  f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing:91,healSource:{cause:'TotemOfUndying'}});
  f.tick();assert.equal(f.hp.currentValue,2);assert.deepEqual(f.saved(),paid);
  assert.equal(f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY),claim);
  assert.equal(f.sounds.filter(s=>s.sound==='kg_java21.heavy_metal').length,0);
 }finally{f.dispose()}
});
test('totem cure write failure preserves saved Heavy Metal and claim',async()=>{
 const f=await rescueFixture(1000);
 try{
  f.hp.currentValue=1;
  f.faults.failNext(f.p,'setDynamicProperty',{phase:'before',predicate:key=>key===f.effectCore.FX_KEY});
  f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing:91,healSource:{cause:'TotemOfUndying'}});
  assert.deepEqual(f.saved(),f.before);
  assert.equal(f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY),undefined);
 }finally{f.dispose()}
});
