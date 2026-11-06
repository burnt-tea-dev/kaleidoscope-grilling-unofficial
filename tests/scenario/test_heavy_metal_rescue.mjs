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
  assert.deepEqual(f.saved(),{});
  assert.deepEqual(f.state.readEffects(f.p),{},'same-tick cache reflects cure');
  assert.equal(f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY),undefined);
  f.tick();assert.equal(f.hp.currentValue,1);
  assert.equal(f.sounds.filter(s=>s.sound==='kg_java21.heavy_metal').length,0);
 }finally{f.dispose()}
});
for(const cause of ['entityAttack','magic','fall'])for(const hand of ['main','off'])test(cause+' yields to a native '+hand+'hand totem without spending Heavy Metal',async()=>{
 const f=await rescueFixture(1000);
 try{
  f.p[hand]=new f.ItemStack('minecraft:totem_of_undying');
  assert.equal(f.hurt({cause}).cancel,false);
  assert.deepEqual(f.saved(),f.before,'letting native death protection run is not a cure signal');
  assert.equal(f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY),undefined);
  f.hp.currentValue=1;f.p[hand]=undefined;
  f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing:1,healSource:{cause:'TotemOfUndying'}});
  assert.deepEqual(f.saved(),{});
  f.tick();assert.equal(f.hp.currentValue,1);
  assert.equal(f.sounds.filter(s=>s.sound==='kg_java21.heavy_metal').length,0);
 }finally{f.dispose()}
});
for(const cause of ['override','void','selfDestruct'])test(cause+' keeps Heavy Metal protection with an equipped totem',async()=>{
 const f=await rescueFixture(1000);
 try{
  f.p.off=new f.ItemStack('minecraft:totem_of_undying');
  assert.equal(f.hurt({cause}).cancel,true);
  assert.ok(f.saved().heavy_metal_poisoning);assert.equal(f.p.off.typeId,'minecraft:totem_of_undying');
 }finally{f.dispose()}
});
for(const hand of ['main','off'])for(const heavy of [false,true])test('Ordinary uses the totem-bypassing native damage route with '+hand+'hand totem and '+(heavy?'Heavy Metal':'no rescue'),async()=>{
 const f=await rescueFixture(1000);
 try{
  const effects=await f.load('effect/runtime.js');
  f.p[hand]=new f.ItemStack('minecraft:totem_of_undying');
  if(!heavy)f.p.setDynamicProperty(f.effectCore.FX_KEY,JSON.stringify({warmth:f.before.warmth}));
  const requests=[],cancellations=[];
  f.p.applyDamage=(amount,options)=>{
   requests.push({amount,options});
   // Only deliver the measured provisional-health API boundary to the real
   // registered handler. Native death, totem use and resistance are not modeled.
   f.hp.currentValue=-amount;let canceled=false;
   const event={hurtEntity:f.p,damage:amount,damageSource:options};
   Object.defineProperty(event,'cancel',{get:()=>canceled,set:value=>{
    canceled=value;if(value)f.hp.currentValue=20;
   }});
   f.emit('world.beforeEvents.entityHurt',event);
   cancellations.push(canceled);
   return true;
  };
  effects.applyOrdinary(f.p);
  assert.equal(requests.length,0,'Ordinary retains its scheduled native damage call');
  f.tick();
  assert.deepEqual(requests,[{amount:3.4028234663852886e38,options:{cause:'selfDestruct'}}]);
  assert.deepEqual(cancellations,[heavy]);
  assert.equal(f.p[hand].typeId,'minecraft:totem_of_undying','the owner never edits the held item');
  if(heavy){
   assert.ok(f.saved().heavy_metal_poisoning);assert.equal(f.saved().heavy_metal,undefined);
   f.tick();assert.equal(f.hp.currentValue,1);
  }else{
   assert.deepEqual(f.saved(),{warmth:f.before.warmth});
   assert.equal(f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY),undefined);
  }
 }finally{f.dispose()}
});
test('a totem in the backpack does not suppress Heavy Metal protection',async()=>{
 const f=await rescueFixture(1000);
 try{
  f.p.inventory.setItem(5,new f.ItemStack('minecraft:totem_of_undying'));
  assert.equal(f.hurt().cancel,true);f.tick();assert.equal(f.hp.currentValue,1);
  assert.ok(f.saved().heavy_metal_poisoning);
  assert.equal(f.p.inventory.getItem(5).typeId,'minecraft:totem_of_undying');
 }finally{f.dispose()}
});
for(const [outcome,random] of [['shield',0],['spear',1]])test('Ordinary retains the invincibility '+outcome+' outcome before native damage',async t=>{
 const f=await rescueFixture(1000);
 try{
  const effects=await f.load('effect/runtime.js');
  t.mock.method(Math,'random',()=>random);
  f.p.setDynamicProperty(f.effectCore.FX_KEY,JSON.stringify({invincible:{until:1000,amp:0}}));
  const damage=[];f.p.applyDamage=(...args)=>{damage.push(args);return true};
  effects.applyOrdinary(f.p);f.tick();
  assert.equal(f.saved().invincible,undefined);
  assert.deepEqual(damage,outcome==='shield'?[]:[[3.4028234663852886e38,{cause:'selfDestruct'}]]);
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
  f.tick();assert.equal(f.hp.currentValue,2);assert.deepEqual(f.saved(),{heavy_metal_poisoning:paid.heavy_metal_poisoning});
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

test('confirmed native totem cures all known defaults, including hidden layers and native side effects',async()=>{
 const f=await rescueFixture(1000),reloaded=await rescueFixture(1000);
 try{
  const props=await f.load('core/persist_keys.js'),dragon=await f.load('dragon_native_health.js'),numb=await f.load('numb_visual_runtime.js');
  const poison={until:3000,amp:1,hidden:{until:4000,amp:0}};
  const fx={...f.before,dragon_blood:{until:1000,amp:1,hidden:{until:2000,amp:0}},numb:{until:1000,amp:0},invincible:{until:1000,amp:0},heavy_metal_poisoning:poison,unknown_effect:{until:1000,amp:0}};
  for(const name of ['tundra_strider','satiated_shield','mustard','preservation','hinder','projectile_dodge','instant_smelting','vitality','flatulence','vigor','sulfur'])fx[name]={until:1000,amp:0};
  // Prime a different same-tick cache: cures must read the actual saved field.
  f.state.readEffects(f.p);f.p.setDynamicProperty(f.effectCore.FX_KEY,JSON.stringify(fx));
  const claim=f.claims.heavyMetalClaimPayload(f.before.heavy_metal,8);
  f.p.setDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY,claim);
  dragon.nativeDragonHealth(f.p,1,{heal:true});numb.updateNumbVisual(f.p,true,f.system.currentTick);
  assert.equal(f.p.triggeredEvents.at(-1),'kaleidoscope_grilling:dragon_health_2');
  f.hp.currentValue=2;
  f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing:91,healSource:{cause:'TotemOfUndying'}});
  const expected={heavy_metal_poisoning:poison,unknown_effect:fx.unknown_effect};
  assert.deepEqual(f.saved(),expected);assert.deepEqual(f.state.readEffects(f.p),expected);
  // The fixture records native requests; it does not simulate max-health groups or rendered poses.
  assert.equal(f.p.triggeredEvents.at(-1),props.LOCKED_DRAGON_HEALTH_EVENT_PREFIX+'0');
  assert.equal(f.p.getDynamicProperty(props.PERSISTED_KEY.DRAGON_NATIVE_LEVEL),undefined);
  assert.equal(f.p.animations.at(-1).animation,'animation.kg_a22.player.numb_stop');
  f.tick();assert.equal(f.hp.currentValue,2,'the earlier Dragon Blood gain must not heal after the cure');
  assert.equal(f.p.getDynamicProperty(f.claims.HEAVY_METAL_CLAIM_KEY),claim);
  reloaded.p.setDynamicProperty(reloaded.effectCore.FX_KEY,f.p.getDynamicProperty(f.effectCore.FX_KEY));
  reloaded.p.setDynamicProperty(reloaded.claims.HEAVY_METAL_CLAIM_KEY,claim);
  assert.deepEqual(reloaded.state.readEffects(reloaded.p),expected,'fresh runtime does not revive cured hidden layers');
  assert.equal(reloaded.p.getDynamicProperty(reloaded.claims.HEAVY_METAL_CLAIM_KEY),claim);
 }finally{f.dispose();reloaded.dispose()}
});
for(const name of ['dragon_blood','numb','invincible'])test('native totem cures '+name+' even without Heavy Metal',async()=>{
 const f=await rescueFixture(1000);
 try{
  f.p.setDynamicProperty(f.effectCore.FX_KEY,JSON.stringify({[name]:{until:1000,amp:0},warmth:f.before.warmth}));
  f.hp.currentValue=1;
  f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing:1,healSource:{cause:'TotemOfUndying'}});
  assert.deepEqual(f.saved(),{});
 }finally{f.dispose()}
});
for(const phase of ['before','after'])test('totem cure '+phase+'-write fault uses acknowledged state before native teardown',async()=>{
 const f=await rescueFixture(1000);
 try{
  const props=await f.load('core/persist_keys.js'),dragon=await f.load('dragon_native_health.js'),numb=await f.load('numb_visual_runtime.js');
  const fx={dragon_blood:{until:1000,amp:0},numb:{until:1000,amp:0}};
  f.p.setDynamicProperty(f.effectCore.FX_KEY,JSON.stringify(fx));
  dragon.nativeDragonHealth(f.p,0,{heal:true});numb.updateNumbVisual(f.p,true,f.system.currentTick);
  f.hp.currentValue=2;
  f.faults.failNext(f.p,'setDynamicProperty',{phase,predicate:key=>key===f.effectCore.FX_KEY});
  f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing:1,healSource:{cause:'TotemOfUndying'}});
  if(phase==='before'){
   assert.deepEqual(f.saved(),fx);assert.equal(f.p.getDynamicProperty(props.PERSISTED_KEY.DRAGON_NATIVE_LEVEL),1);
   assert.equal(f.p.animations.at(-1).animation,'animation.kg_a22.player.numb');
   f.tick();assert.equal(f.hp.currentValue,2,'failed saved cure must not replay the earlier Dragon gain');
  }else{
   assert.deepEqual(f.saved(),{});assert.equal(f.p.getDynamicProperty(props.PERSISTED_KEY.DRAGON_NATIVE_LEVEL),undefined);
   assert.equal(f.p.animations.at(-1).animation,'animation.kg_a22.player.numb_stop');
   f.tick();assert.equal(f.hp.currentValue,2);
  }
 }finally{f.dispose()}
});
test('ordinary, canceled, zero and dead-entity healing do not cure other Grilling effects',async()=>{
 const f=await rescueFixture(1000);
 try{
  const fx={dragon_blood:{until:1000,amp:0},numb:{until:1000,amp:0},invincible:{until:1000,amp:0}};
  f.p.setDynamicProperty(f.effectCore.FX_KEY,JSON.stringify(fx));
  for(const [cause,healing,hp] of [['Heal',1,1],['Regeneration',1,1],['TotemOfUndying',0,1],['TotemOfUndying',1,0]]){
   f.hp.currentValue=hp;f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing,healSource:{cause}});assert.deepEqual(f.saved(),fx);
  }
  f.hp.currentValue=1;
  f.emit('world.beforeEvents.entityHeal',{healedEntity:f.p,healing:1,healSource:{cause:'TotemOfUndying'},cancel:true});
  assert.deepEqual(f.saved(),fx,'a canceled before-heal without successful after-heal is not a cure');
 }finally{f.dispose()}
});

test('confirmed native totem revokes an earlier queued Projectile Dodge',async()=>{
 const f=await rescueFixture(1000);
 try{
  f.p.setDynamicProperty(f.effectCore.FX_KEY,JSON.stringify({projectile_dodge:{until:1000,amp:0}}));
  const dodge=await f.load('projectile_dodge_runtime.js'),claim=dodge.reserveProjectileDodge(f.p);
  assert.ok(claim);let moved=0;
  f.system.run(()=>dodge.settleProjectileDodge(f.p,claim,()=>{moved++}));
  f.hp.currentValue=1;
  f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing:1,healSource:{cause:'TotemOfUndying'}});
  assert.deepEqual(f.saved(),{});
  f.tick();assert.equal(moved,0);assert.deepEqual(f.saved(),{});
 }finally{f.dispose()}
});

for(const boundary of ['expired','failed write'])test('confirmed totem revokes queued dodge even with '+boundary+' effect state',async()=>{
 const f=await rescueFixture(1000);
 try{
  const until=boundary==='expired'?f.system.currentTick+1:1000;
  const fx={projectile_dodge:{until,amp:0}};
  f.p.setDynamicProperty(f.effectCore.FX_KEY,JSON.stringify(fx));
  const dodge=await f.load('projectile_dodge_runtime.js'),claim=dodge.reserveProjectileDodge(f.p);
  assert.ok(claim);let moved=0;
  if(boundary==='expired')f.system.currentTick=until;
  else f.faults.failNext(f.p,'setDynamicProperty',{phase:'before',predicate:key=>key===f.effectCore.FX_KEY});
  f.hp.currentValue=1;
  f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing:1,healSource:{cause:'TotemOfUndying'}});
  assert.equal(dodge.settleProjectileDodge(f.p,claim,()=>{moved++}),false);
  assert.equal(moved,0,'confirmed native outcome supersedes earlier queued movement');
  if(boundary==='failed write')assert.deepEqual(f.saved(),fx,'failed cure does not invent a saved removal');
 }finally{f.dispose()}
});

test('confirmed totem revokes Dragon gain when its saved effect has just expired',async()=>{
 const f=await rescueFixture(1000);
 try{
  const dragon=await f.load('dragon_native_health.js');
  const until=f.system.currentTick+1;
  f.p.setDynamicProperty(f.effectCore.FX_KEY,JSON.stringify({dragon_blood:{until,amp:0}}));
  dragon.nativeDragonHealth(f.p,0,{heal:true});f.system.currentTick=until;f.hp.currentValue=1;
  f.emit('world.afterEvents.entityHeal',{healedEntity:f.p,healing:1,healSource:{cause:'TotemOfUndying'}});
  f.tick();assert.equal(f.hp.currentValue,1);
 }finally{f.dispose()}
});
