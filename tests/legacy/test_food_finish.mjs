import test from 'node:test';import assert from 'node:assert/strict';
import {finishedFoodMeta} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food_finish_core.js';
import {eatingProfile} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/player_presentation_core.js';
test('hot dishes crossing the completion boundary lose hot seasoning/saturation eligibility',()=>{
 const started={hot:true,hotUntil:100,seasonings:['salt'],origin:'wok'};
 assert.equal(finishedFoodMeta(started,99).hot,true);
 for(const finish of [100,101,190])assert.equal(finishedFoodMeta(started,finish).hot,false);
 assert.deepEqual(started,{hot:true,hotUntil:100,seasonings:['salt'],origin:'wok'});
 assert.deepEqual(finishedFoodMeta(started,101).seasonings,['salt']);
});
test('cold food never reacquires heat from a stale stored timestamp',()=>assert.equal(finishedFoodMeta({hot:false,hotUntil:300},50).hot,false));
test('both random branches select one shared curve, checkpoint duration and code',()=>{
 assert.deepEqual(eatingProfile('THREE_RANDOM',0),{profile:'THREE',code:3,duration:100});
 assert.deepEqual(eatingProfile('THREE_RANDOM',.4999),{profile:'THREE',code:3,duration:100});
 assert.deepEqual(eatingProfile('THREE_RANDOM',.5),{profile:'THREE_ALT',code:4,duration:90});
 assert.deepEqual(eatingProfile('THREE_RANDOM',.999),{profile:'THREE_ALT',code:4,duration:90});
 assert.throws(()=>eatingProfile('BAD'));
});

import {createFixture} from '../helpers/minecraft-fixture.mjs';
// Native subscribers take the start snapshots, run every intervening runtime
// tick, and settle the hot-food reward only on the matching completion event.
async function hotFoodFixture(t,id='kaleidoscope_grilling:grilled_bun_slice_skewer'){
 const f=createFixture({currentTick:1000});t.after(()=>f.dispose());await f.load('main.js');
 const data=await f.load('itemData.js'),state=await f.load('effect_state_runtime.js');
 const stack=f.item(id);data.setItemProperty(stack,'kaleidoscope_grilling:hot_until',5000);
 const player=f.player({main:stack});
 return {f,player,state,start(){f.emit('world.afterEvents.itemStartUse',{source:player,itemStack:stack.clone(),useDuration:90});},
  finish(){player.main=undefined;f.emit('world.afterEvents.itemCompleteUse',{source:player,itemStack:stack.clone(),useDuration:0});}};
}
test('hot completion compares custom and native effects against their start durations',async t=>{
 const {f,player,state,start,finish}=await hotFoodFixture(t);
 state.writeEffects(player,{warmth:{until:1800,amp:2},unchanged:{until:2000,amp:0},invincible:{until:1200,amp:1}});
 player.addEffect('strength',800,{amplifier:2});start();f.tick(90);
 state.writeEffects(player,{warmth:{until:1990,amp:2},unchanged:{until:2000,amp:0},invincible:{until:1290,amp:1},vigor:{until:1690,amp:0}});
 player.addEffect('strength',900,{amplifier:2});finish();
 const fx=state.readEffects(player);
 assert.equal(player.getEffect('strength').duration,1000);assert.equal(player.getEffect('strength').amplifier,2);
 assert.equal(fx.warmth.until-f.world.getAbsoluteTime(),1000);assert.equal(fx.warmth.amp,2);
 assert.equal(fx.unchanged.until,2000);assert.equal(fx.invincible.until,1290);
 assert.equal(fx.vigor.until-f.world.getAbsoluteTime(),1200);
});
test('an effect expiring during eating retains its original start-duration comparison',async t=>{
 const {f,player,state,start,finish}=await hotFoodFixture(t,'kaleidoscope_grilling:grilled_lamb_skewer_java_three_alt');
 state.writeEffects(player,{warmth:{until:1040,amp:0}});start();f.tick(90);
 assert.equal(state.readEffects(player).warmth,undefined,'the original effect really expired during scheduled runtime ticks');
 finish();
 assert.equal(state.readEffects(player).warmth.until-f.world.getAbsoluteTime(),1760);
 assert.equal(state.readEffects(player).warmth.amp,0);
});

// Alternate ingredient IDs retain their effects, containers and original snapshots.
import {FOOD_DATA,COOKED_EFFECTS,RAW_NAUSEA} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/data.js';
import {RANDOM_EATING_IDS,eatingItemId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {ingredientBehavior,rolledIngredientEffects} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_ingredient_effects.js';
import {registerSecretIngredientBehavior,secretIngredientRegistration,resetSecretCompatRegistry} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_compat_core.js';
function freeze(value){if(value&&typeof value==='object'){for(const row of Object.values(value))freeze(row);Object.freeze(value)}return value}
function row(id,base=id){return freeze({id,...(FOOD_DATA[base]??{nutrition:6,saturation:.3}),edible:true,convertTo:'fixture:original_container',tags:['fixture:ingredient'],name:'Original ingredient',lore:['foreign lore'],props:{'fixture:marker':'retained'},
 native:{version:1,id,name:'Native original',rawLore:[{translate:'fixture:foreign_lore',with:['kept']}],props:{'fixture:false':false,'fixture:zero':0,'fixture:vector':{x:1,y:2,z:3}},damage:7,enchantments:[{id:'unbreaking',level:3}],keepOnDeath:true,lockMode:'slot',canDestroy:['minecraft:stone'],canPlaceOn:['minecraft:dirt']}})}
for(const base of RANDOM_EATING_IDS)test(`all behavior flags/effects/remainder match for the actual alternate ingredient ${base}`,()=>{
 resetSecretCompatRegistry();const canonical=row(base),alternate=row(eatingItemId(base,true),base),before=structuredClone(alternate);
 assert.deepEqual(ingredientBehavior(alternate),ingredientBehavior(canonical));assert.deepEqual(rolledIngredientEffects(alternate,()=>0),rolledIngredientEffects(canonical,()=>0));
 assert.deepEqual(alternate,before);assert.equal(alternate.native.id,alternate.id);assert.deepEqual(ingredientBehavior(alternate).remainder,{id:'fixture:original_container',count:1});
});
for(const id of Object.keys(FOOD_DATA))test(`all fixed/raw ingredient effects retain released food behavior ${id}`,()=>{
 resetSecretCompatRegistry();const input=row(id),before=structuredClone(input),behavior=ingredientBehavior(input),fixed=COOKED_EFFECTS[id];
 const expected=[];
 if(fixed?.effect)expected.push({kind:fixed.effect.startsWith('minecraft:')?'native':'persistent_fx',effect:fixed.effect.split(':')[1],ticks:fixed.seconds*20,amplifier:0});
 if(RAW_NAUSEA[id])expected.push({kind:'native',effect:'nausea',ticks:60});
 if(id==='kaleidoscope_grilling:mysterious_skewer')expected.push({kind:'native',effect:'nausea',ticks:100});
 if(id==='kaleidoscope_grilling:dark_grilling')expected.push({kind:'native',effect:'blindness',ticks:200});
 assert.deepEqual(behavior.effects,expected);assert.equal(behavior.ordinary,id==='kaleidoscope_grilling:ordinary_skewer');assert.deepEqual(input,before);
});
for(const [base,effect,ticks,ordinary] of [
 ['kaleidoscope_grilling:mysterious_skewer','nausea',100,false],['kaleidoscope_grilling:dark_grilling','blindness',200,false],['kaleidoscope_grilling:ordinary_skewer','',0,true]
])test(`hidden special ingredient keeps its exact finish contract ${base}`,()=>{
 resetSecretCompatRegistry();const input=row(eatingItemId(base,true),base),behavior=ingredientBehavior(input);
 assert.deepEqual(behavior.effects,effect?[{kind:'native',effect,ticks}]:[]);assert.equal(behavior.ordinary,ordinary);
});
const container=(which)=>({id:'fixture:'+which+'_container',count:2,name:'Kept '+which+' container',lore:['foreign container lore'],props:{'fixture:text':'retained','fixture:false':false,'fixture:zero':0,'fixture:vector':{x:1,y:2,z:3}}});
const extension=(which,ticks)=>({mode:'merge',effects:[{effect:'fixture_'+which,ticks}],remainder:container(which),remainders:[{id:'fixture:extra',count:3,name:'Extra container',props:{'fixture:marker':'kept'}}]});
for(const base of RANDOM_EATING_IDS)test(`actual ID extension wins canonical fallback and tags without changing the original snapshot ${base}`,()=>{
 resetSecretCompatRegistry();const actual=eatingItemId(base,true),input=row(actual,base),before=structuredClone(input);
 assert(registerSecretIngredientBehavior({tag:'fixture:ingredient',behavior:extension('tag',333)}));
 assert(registerSecretIngredientBehavior({input:base,behavior:extension('canonical',111)}));
 const canonicalRegistration=secretIngredientRegistration({id:base}),fallback=ingredientBehavior(input);
 assert.equal(fallback.effects.at(-1).effect,'fixture_canonical');assert.deepEqual(fallback.remainder,container('canonical'));assert.deepEqual(secretIngredientRegistration(input),canonicalRegistration);
 assert(registerSecretIngredientBehavior({input:actual,behavior:extension('actual',222)}));
 const explicit=ingredientBehavior(input);assert.equal(explicit.effects.at(-1).effect,'fixture_actual');assert.equal(explicit.effects.some(e=>['fixture_canonical','fixture_tag'].includes(e.effect)),false);
 assert.deepEqual(explicit.remainder,container('actual'));assert.deepEqual(explicit.remainders,[{id:'fixture:extra',count:3,name:'Extra container',props:{'fixture:marker':'kept'}}]);
 assert.equal(ingredientBehavior(row(base)).effects.at(-1).effect,'fixture_canonical');assert.deepEqual(input,before);assert.equal(input.native.id,actual);
});
// Run real script-event registrations and native eating subscribers. Remainder
// data is inspected after production give()/inventory merging, not intercepted.
for(const base of ['kaleidoscope_grilling:mysterious_skewer','kaleidoscope_grilling:dark_grilling','kaleidoscope_grilling:ordinary_skewer'])for(const actualExtension of [false,true])test(`native secret completion delivers container metadata and preserves consumed ingredient ${base} explicit=${actualExtension}`,async t=>{
 const f=createFixture();t.after(()=>f.dispose());await f.load('main.js');
 const data=await f.load('itemData.js'),compat=await f.load('secret_compat_core.js'),effects=await f.load('a285_ingredient_effects.js');
 const {secretEatingRows}=await f.load('secret_eating_core.js'),{readEffects}=await f.load('effect_state_runtime.js');
 const {SECRET_BEHAVIOR_REGISTER_EVENT,SECRET_CONSUMED_EVENT}=await f.load('secret_compat_runtime.js');
 const actual=eatingItemId(base,true),input=row(actual,base),before=structuredClone(input),which=actualExtension?'actual':'canonical';
 const registration=(kind,ticks)=>({...extension(kind,ticks),effects:[{effect:kind==='actual'?'haste':'speed',ticks},{kind:'persistent_fx',effect:'warmth',ticks:ticks+100}]});
 function register(input,behavior){
  f.emit('system.afterEvents.scriptEventReceive',{sourceType:'Server',id:SECRET_BEHAVIOR_REGISTER_EVENT,message:JSON.stringify({input,behavior})});
  assert.ok(compat.secretIngredientRegistration({id:input}));
 }
 register(base,registration('canonical',111));if(actualExtension)register(actual,registration('actual',222));
 const rows=[input,...['minecraft:apple','minecraft:carrot'].map(id=>({id,edible:true,nutrition:0,saturation:0,convertTo:''}))];
 const normalized=secretEatingRows(rows,id=>f.item(id));
 assert.equal(normalized[0],input,'the public row normalizer preserves the complete original snapshot');
 const stack=f.item('kaleidoscope_grilling:secret_skewer_java_three_alt');
 data.setItemProperty(stack,'kaleidoscope_grilling:skewer_ingredients',JSON.stringify(rows));
 const stored=data.getItemProperty(stack,'kaleidoscope_grilling:skewer_ingredients');
 const player=f.player({main:stack}),damage=[];
 player.applyDamage=(...args)=>{damage.push(args);return true;};
 f.emit('world.afterEvents.itemStartUse',{source:player,itemStack:stack.clone(),useDuration:90});f.tick(90);
 player.main=undefined; // The native engine has consumed this single serving.
 f.emit('world.afterEvents.itemCompleteUse',{source:player,itemStack:stack.clone(),useDuration:0});
 const behavior=effects.ingredientBehavior(input);
 assert.deepEqual(f.effects.filter(e=>e.source===player).map(e=>[e.effect,e.duration,e.options]),behavior.effects.filter(e=>e.kind!=='persistent_fx').map(e=>[e.effect,e.ticks,{...(e.options??{}),amplifier:e.amplifier??0,showParticles:true}]));
 for(const e of behavior.effects.filter(e=>e.kind==='persistent_fx'))assert.deepEqual(readEffects(player)[e.effect],{until:f.world.getAbsoluteTime()+e.ticks,amp:e.amplifier??0});
 const delivered=player.inventory.items().filter(Boolean);assert.equal(delivered.length,2);assert.equal(f.drops.length,0);
 const main=delivered.find(item=>item.typeId===container(which).id),expected=container(which);assert.ok(main);
 assert.equal(main.amount,expected.count);assert.equal(main.nameTag,expected.name);assert.deepEqual(data.getItemLore(main),expected.lore);
 for(const [key,value] of Object.entries(expected.props))assert.deepEqual(data.getItemProperty(main,key),value);
 const extra=delivered.find(item=>item.typeId==='fixture:extra');assert.equal(extra.amount,3);assert.equal(extra.nameTag,'Extra container');assert.equal(data.getItemProperty(extra,'fixture:marker'),'kept');
 const consumed=f.scriptEvents.filter(e=>e.id===SECRET_CONSUMED_EVENT).map(e=>JSON.parse(e.message));
 assert.deepEqual(consumed,rows.map(row=>({version:1,playerId:player.id,playerName:player.name,itemId:row.id})));
 assert.deepEqual(input,before);assert.equal(input.native.id,actual);
 assert.equal(data.getItemProperty(stack,'kaleidoscope_grilling:skewer_ingredients'),stored,'completion never rewrites the original ingredient payload');
 f.tick();assert.equal(damage.length,base.endsWith('ordinary_skewer')?1:0);
 if(damage.length)assert.deepEqual(damage[0],[3.4028234663852886e38,{cause:'override'}]);
});
test('non-edible variants do not gain finish behavior through canonical aliases or extensions',()=>{
 resetSecretCompatRegistry();const base='kaleidoscope_grilling:mysterious_skewer',actual=eatingItemId(base,true);assert(registerSecretIngredientBehavior({input:base,behavior:extension('canonical',111)}));
 const input=freeze({...row(actual,base),edible:false,nutrition:0});assert.deepEqual(ingredientBehavior(input),{effects:[],convertTo:''});
});

import {milkEffects,effectPayload} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/effect_lifecycle_core.js';
import {normalizePublicFood,readPublicFood,writePublicFood} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/food_api_core.js';
test('milk cures every active grilling effect except Java uncurable poisoning',()=>{
 const input={invincible:{until:500,amp:0},dragon_blood:{until:500,amp:1},numb:{until:500,amp:0},heavy_metal:{until:500,amp:0},heavy_metal_poisoning:{until:700,amp:0},warmth:{until:20,amp:0}};
 assert.deepEqual(milkEffects(input,100),{heavy_metal_poisoning:{until:700,amp:0}});assert.deepEqual(milkEffects(input,701),{});assert.equal(effectPayload({},100),undefined);
});

test('public native variant survives heat metadata rewrites and rejects invalid data',()=>{
 const stack={lore:[],getRawLore(){return this.lore},setLore(v){this.lore=v}};
 writePublicFood(stack,{v:1,hotUntil:1201,seasoning:[],nativeVariant:7});const state=readPublicFood(stack).state;
 writePublicFood(stack,{...state,hotUntil:1200});assert.equal(readPublicFood(stack).state.nativeVariant,7);
 for(const nativeVariant of [-1,1.5,32768,'7'])assert.equal(normalizePublicFood({v:1,hotUntil:0,seasoning:[],nativeVariant}),undefined);
});

// T3.4 preparation: executable state timelines; no production behavior changes.
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createEatingLab,routes,java,beef} from '../helpers/eating-lab.mjs';

// This is a logic-level event experiment, not a native client/BDS test.
// Completion inputs deliberately bracket engine debit and both event orders.
test('every skewer route keeps its clock until native settlement in either hand',async t=>{
  const lab=await createEatingLab();t.after(()=>lab.f.dispose());
  for(const route of routes)for(const hand of ['main','off']) {
    const a=lab.actor(route,hand);a.begin();lab.assertUsing(a);
    a.advance(route.duration-1,true);
    const last=lab.assertUsing(a);
    assert.equal(last.clock,route.duration-1);
    if(route.kind!=='plain'){
      const bites=java.profiles[route.profile].bite_seconds.filter(s=>s<=(route.duration-1)/20).length;
      assert.equal(last.crumbs,bites*5,`${route.id} Java bite checkpoints`);
    }
    a.nativeDebit();a.sample('engine-debit-before-callback');
    a.event('itemCompleteUse',0);const done=a.sample('complete');
    const handoff=supportsSourceFixedProjection(route.id,route.profile,hand)&&last.projection;
    assert.equal(done.profile,handoff?last.profile:0);assert.equal(done.clock,handoff?route.duration:0);assert.equal(a.p[hand].amount,1);
    const effects=done.effects,hunger=done.hunger;
    a.event('itemStopUse',0);a.event('itemCompleteUse',0);a.advance(1);
    assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_profile'),0);
    assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_elapsed_ticks'),0);
    assert.equal(a.p[hand].amount,1);assert.equal(a.sample('duplicate-events').effects,effects);
    assert.equal(a.p.components['minecraft:player.hunger'].currentValue,hunger);
    a.retire();
  }
  if(process.env.EATING_TIMELINE_DIR){mkdirSync(process.env.EATING_TIMELINE_DIR,{recursive:true});writeFileSync(join(process.env.EATING_TIMELINE_DIR,'normal.json'),JSON.stringify({boundary:'real runtime / fake Minecraft API; debit supplied by driver; no native nutrition or rendering',routeCount:routes.length,rows:lab.rows},null,2));}
});

test('each route cancels below the checkpoint, settles at its grace boundary, and restarts cleanly',async t=>{
  const lab=await createEatingLab();t.after(()=>lab.f.dispose());
  for(const route of routes)for(const hand of ['main','off'])for(const elapsed of [23,24,25]) {
    const a=lab.actor(route,hand);a.case='release-'+elapsed;a.begin();a.advance(elapsed);
    a.sample('before-stop');a.event('itemStopUse',Math.max(1,route.duration-elapsed));a.advance(1);a.sample('after-stop');
    const settled=route.kind!=='plain'&&elapsed+java.release_checkpoint_grace_ticks>=java.minimum_eat_ticks;
    assert.equal(a.p[hand].amount,settled?1:2,`${route.id} ${hand} release at ${elapsed}`);
    assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_profile'),0);
    assert.equal(lab.data.getItemProperty(a.p[hand],'foreign:timeline'),'retained');
    // A completed release cannot settle twice or cancel the following start.
    a.event('itemStopUse',1);a.advance(1);
    assert.equal(a.p[hand].amount,settled?1:2);
    a.begin();assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_elapsed_ticks'),0);
    a.advance(2);assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_elapsed_ticks'),2);
    a.retire();
  }
  if(process.env.EATING_TIMELINE_DIR)writeFileSync(join(process.env.EATING_TIMELINE_DIR,'release.json'),JSON.stringify(lab.rows,null,2));
});

test('every route consumes its final serving once with stop before complete and then starts another meal',async t=>{
  const lab=await createEatingLab();t.after(()=>lab.f.dispose());
  for(const route of routes)for(const hand of ['main','off']) {
    const a=lab.actor(route,hand,1);a.case='last-serving';a.begin();a.advance(route.duration-1);
    a.event('itemStopUse',0);a.sample('stop-before-complete');
    a.nativeDebit();assert.equal(a.p[hand],undefined);
    a.event('itemCompleteUse',0);a.sample('completed-empty-hand');
    const hunger=a.p.components['minecraft:player.hunger'].currentValue,effects=lab.f.effects.filter(e=>e.source===a.p).length;
    // Reholding and starting before the old deferred stop runs must retain the
    // newer session, even when the new item is indistinguishable from the old.
    a.p[hand]=a.stack;a.begin();a.advance(1);
    assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_elapsed_ticks'),1);
    a.advance(route.duration-2);a.nativeDebit();a.event('itemCompleteUse',0);
    a.event('itemCompleteUse',0);a.event('itemStopUse',0);a.advance(1);
    assert.equal(a.p[hand],undefined);assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_profile'),0);
    // Fixed/native food nutrition is intentionally not emulated by this driver.
    if(route.base.endsWith(':secret_skewer'))assert.ok(a.p.components['minecraft:player.hunger'].currentValue>hunger);
    const finalEffects=lab.f.effects.filter(e=>e.source===a.p).length;
    assert.equal(finalEffects,effects*2);
    a.sample('second-complete');a.retire();
  }
  if(process.env.EATING_TIMELINE_DIR)writeFileSync(join(process.env.EATING_TIMELINE_DIR,'last-serving.json'),JSON.stringify(lab.rows,null,2));
});

test('every route rejects release debit after slot, hand, or metadata replacement and clears on reconnect',async t=>{
  const lab=await createEatingLab();t.after(()=>lab.f.dispose());
  for(const route of routes)for(const hand of ['main','off'])for(const change of ['slot','hand','metadata']) {
    const a=lab.actor(route,hand);a.case=change;
    const otherHand=hand==='main'?'off':'main';
    a.p[otherHand]=lab.f.item('minecraft:diamond',3,{nameTag:'Other hand',lore:['Keep other hand lore']});
    a.p.inventory.setItem(7,lab.f.item('minecraft:stone',7,{nameTag:'Backpack reserve',lore:['Keep reserve lore']}));
    a.begin();a.advance(20);a.sample('before-switch',true);
    if(change==='slot')a.p.selectedSlotIndex=1;
    if(change==='hand'){const other=a.p[otherHand];a.p[otherHand]=a.p[hand];a.p[hand]=other;}
    if(change==='metadata'){const replacement=a.p[hand];replacement.nameTag='Replacement';a.p[hand]=replacement;}
    a.advance(5);a.sample('before-stop',true);
    // Idle prepareEatingItems may choose a fresh route after a cancelled use;
    // ownership is canonical food + count + saved metadata, not shadow ID.
    const before=lab.inventory(a.p),expected=structuredClone(before);
    a.event('itemStopUse',Math.max(1,route.duration-25));a.advance(1);
    // Offhand use is independent of the selected main-hand slot.
    const validOffhandSlot=hand==='off'&&change==='slot'&&route.kind!=='plain';
    if(validOffhandSlot)expected.off.amount--;
    assert.deepEqual(lab.inventory(a.p),expected,`${route.id} ${hand} ${change}: both hands and every slot, including metadata/lore`);
    a.sample('after-stop',true);
    if(!validOffhandSlot)assert.equal(a.p.components['minecraft:player.hunger'].currentValue,2);
    lab.f.emit('world.afterEvents.playerLeave',{playerId:a.p.id});
    a.p.selectedSlotIndex=0;a.p.main=undefined;a.p.off=undefined;a.p[hand]=a.stack;
    lab.f.emit('world.afterEvents.playerSpawn',{player:a.p,initialSpawn:true});a.advance(2);
    assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_profile'),0);
    assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_elapsed_ticks'),0);
    a.begin();a.advance(2);assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_elapsed_ticks'),2);
    a.retire();
  }
  if(process.env.EATING_TIMELINE_DIR)writeFileSync(join(process.env.EATING_TIMELINE_DIR,'switch-reconnect.json'),JSON.stringify(lab.rows,null,2));
});

test('beef terminal timeline distinguishes callback reset from an earlier inventory view change',async t=>{
  const lab=await createEatingLab();t.after(()=>lab.f.dispose());
  const route=routes.find(x=>x.id===beef);
  for(const mode of ['unchanged','engine-debit-first','metadata-first','complete-before-debit','stop-before-complete','new-use-before-deferred-stop']) {
    const a=lab.actor(route);a.case=mode;a.begin();a.advance(86,true);lab.assertUsing(a);
    if(mode==='engine-debit-first')a.nativeDebit();
    if(mode==='metadata-first'){const changed=a.p.main;changed.nameTag='Changed';a.p.main=changed;}
    a.advance(1,true);
    const observed=a.sample('pre-complete');
    assert.equal(observed.profile,['engine-debit-first','metadata-first'].includes(mode)?0:5);
    assert.equal(a.p.main.amount,mode==='engine-debit-first'?1:2);
    a.advance(2,true);
    if(mode==='stop-before-complete')a.event('itemStopUse',0);
    if(mode==='new-use-before-deferred-stop'){
      a.event('itemStopUse',0);a.begin();a.advance(1,true);
      assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_profile'),5);
      assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_elapsed_ticks'),1);
    }else{
      if(mode==='complete-before-debit'){
        a.event('itemCompleteUse',0);const r=a.sample('complete-held-original');
        assert.equal(r.profile,5);assert.equal(r.clock,90);assert.equal(r.main.amount,2);a.nativeDebit();
      }else{
        if(mode!=='engine-debit-first')a.nativeDebit();
        a.event('itemCompleteUse',0);a.sample('complete');
      }
    }
    a.retire();
  }
  if(process.env.EATING_TIMELINE_DIR)writeFileSync(join(process.env.EATING_TIMELINE_DIR,'beef-terminal.json'),JSON.stringify(lab.rows,null,2));
});

// Run setup, runtime and shape assertions in ordinary blocking parents. Only a
// pure assertion of the desired replacement behavior belongs inside each TODO.
// Unexpected exceptions or a different corruption must fail the parent normally.
// Presentation-only handoff: these run unchanged main.js through the external
// API fixture. They do not emulate client packet ordering or native item debit.
const handoffPropertyNames=['eat_profile','eat_hand','eat_projection','eat_native_ticks','eat_elapsed_ticks'];
const handoffProperties=p=>Object.fromEntries(handoffPropertyNames.map(key=>[key,p.getProperty('kaleidoscope_grilling:'+key)??(key==='eat_projection'?false:0)]));
const clearedHandoff={eat_profile:0,eat_hand:0,eat_projection:false,eat_native_ticks:0,eat_elapsed_ticks:0};
const handoffRoute=()=>routes.find(row=>row.id==='kaleidoscope_grilling:grilled_caterpillar_skewer');

test('terminal handoff retains only presentation across completion event orders and never delays or repeats debit',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 for(const hand of ['main','off'])for(const amount of [1,2])for(const debitOrder of ['before','after'])for(const stopOrder of ['before','after']){
  const a=lab.actor(handoffRoute(),hand,amount);a.begin();a.advance(89);
  const owned={...handoffProperties(a.p),eat_elapsed_ticks:90};assert.equal(owned.eat_projection,true);
  if(debitOrder==='before')a.nativeDebit();
  if(stopOrder==='before')a.event('itemStopUse',0);
  const before=lab.inventory(a.p);a.event('itemCompleteUse',0);
  assert.deepEqual(handoffProperties(a.p),owned,`${hand}/${amount}/${debitOrder}/${stopOrder}`);
  assert.deepEqual(lab.inventory(a.p),before,'completion handoff never writes the food');
  const effects=lab.f.effects.filter(row=>row.source===a.p).length;
  if(debitOrder==='after')a.nativeDebit();
  if(stopOrder==='after')a.event('itemStopUse',0);
  a.event('itemCompleteUse',0);a.event('itemStopUse',0);
  assert.equal(a.p[hand]?.amount??0,amount-1);
  assert.equal(lab.f.effects.filter(row=>row.source===a.p).length,effects,'retired gameplay session cannot reward twice');
  a.advance(1);assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  assert.equal(a.p[hand]?.amount??0,amount-1);a.retire();
 }
});

test('terminal handoff waits for an actual tick boundary even if system.run callbacks execute in the event tick',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 const a=lab.actor(handoffRoute());a.begin();a.advance(89);
 const owned={...handoffProperties(a.p),eat_elapsed_ticks:90},scheduled=[],run=lab.f.system.run;
 // Official System.run may execute an event's callback in the same tick.
 // Override only this external scheduling boundary, never production source.
 lab.f.system.run=callback=>{scheduled.push(callback);return -scheduled.length;};
 try{
  a.event('itemCompleteUse',0);
  for(const callback of scheduled.splice(0))callback();
  assert.deepEqual(handoffProperties(a.p),owned,'same-tick callbacks cannot retire presentation');
  a.advance(1);assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  assert.equal(a.p.main.amount,2,'even an unchanged server snapshot cannot strand presentation');
 }finally{lab.f.system.run=run;a.retire();}
});

test('terminal handoff early cancellation and failed release clear immediately while successful release debits exactly once',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 for(const hand of ['main','off'])for(const mode of ['early','success','failed-write']){
  const a=lab.actor(handoffRoute(),hand);a.begin();a.advance(mode==='early'?23:25);
  const owned=handoffProperties(a.p),before=lab.inventory(a.p);
  if(mode==='failed-write')lab.f.faults.failNext(hand==='main'?a.p.inventory:a.p.equipment,hand==='main'?'setItem':'setEquipment');
  a.event('itemStopUse',mode==='early'?67:65);
  if(mode==='success'){
   assert.equal(a.p[hand].amount,1,'eligible release debits in its event, not in retirement');
   assert.deepEqual(handoffProperties(a.p),{...owned,eat_elapsed_ticks:90});
  }else{
   assert.deepEqual(lab.inventory(a.p),before);
   assert.deepEqual(handoffProperties(a.p),clearedHandoff,mode+' does not arm terminal masking');
   assert.equal(a.p.components['minecraft:player.hunger'].currentValue,2);
  }
  const inventory=lab.inventory(a.p),hunger=a.p.components['minecraft:player.hunger'].currentValue;
  a.event('itemStopUse',65);a.advance(1);
  assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  assert.deepEqual(lab.inventory(a.p),inventory);assert.equal(a.p.components['minecraft:player.hunger'].currentValue,hunger);
  a.retire();
 }
});

test('terminal handoff cannot clear a fresh same-ID serving or consume its metadata',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 for(const hand of ['main','off'])for(const replacement of ['identical','metadata','slot','other-hand']){
  if(hand==='off'&&replacement==='slot')continue;
  const a=lab.actor(handoffRoute(),hand,1);a.begin();a.advance(89);
  a.event('itemStopUse',0);a.nativeDebit();a.event('itemCompleteUse',0);
  let next=a.stack.clone();
  if(replacement==='metadata'){next.nameTag='New serving';lab.data.setItemProperty(next,'foreign:timeline','new-owner');}
  if(replacement==='slot')a.p.selectedSlotIndex=1;
  if(replacement==='other-hand'){a.p[hand]=undefined;a.hand=hand==='main'?'off':'main';}
  // The lab event helper captures its original hand; send the next real event
  // directly so captureInteractionIntent, not the test, chooses the new hand.
  a.p[a.hand]=next;
  lab.f.emit('world.afterEvents.itemStartUse',{source:a.p,itemStack:next.clone(),useDuration:90});
  lab.f.emit('world.afterEvents.itemStopUse',{source:a.p,itemStack:a.stack.clone(),useDuration:0});
  const inventory=lab.inventory(a.p);a.advance(1);
  const current=handoffProperties(a.p);
  assert.equal(current.eat_profile,1);assert.equal(current.eat_hand,a.hand==='main'?1:2);
  assert.equal(current.eat_elapsed_ticks,1);assert.equal(current.eat_projection,true);
  assert.deepEqual(lab.inventory(a.p),inventory,'stale retirement neither debits nor replaces the new serving');
  a.retire();
 }
});

test('terminal handoff same-ID slot and metadata replacement restore normal ownership without modifying either stack',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 for(const hand of ['main','off'])for(const change of ['metadata','slot']){
  const a=lab.actor(handoffRoute(),hand);a.begin();a.advance(89);a.event('itemCompleteUse',0);
  if(change==='slot'){
   a.p.selectedSlotIndex=1;a.p.main=a.stack.clone();
  }else{
   const replacement=a.p[hand];replacement.nameTag='Replacement after completion';a.p[hand]=replacement;
  }
  const before=lab.inventory(a.p);a.advance(1);
  assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  assert.deepEqual(lab.inventory(a.p),before);a.retire();
 }
});

test('terminal handoff supports two continuous servings and bounded creative completion',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 for(const hand of ['main','off']){
  const a=lab.actor(handoffRoute(),hand,2);a.begin();
  for(const remaining of [1,0]){
   a.advance(remaining?89:88);a.event('itemStopUse',0);a.nativeDebit();a.event('itemCompleteUse',0);
   assert.equal(a.p[hand]?.amount??0,remaining);
   if(remaining){a.begin();a.advance(1);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,1);}
   else a.advance(1);
  }
  assert.deepEqual(handoffProperties(a.p),clearedHandoff);a.retire();
  const c=lab.actor(handoffRoute(),hand,2);c.p.gameMode=lab.f.server.GameMode.Creative;
  c.begin();c.advance(89);c.event('itemCompleteUse',0);
  assert.equal(handoffProperties(c.p).eat_profile,1);assert.equal(c.p[hand].amount,2);
  c.advance(1);assert.deepEqual(handoffProperties(c.p),clearedHandoff);assert.equal(c.p[hand].amount,2);c.retire();
 }
});

test('terminal handoff has no offhand no-start state and cannot survive spawn or leave',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 const idle=lab.actor(handoffRoute(),'off');idle.advance(100);
 const before=lab.inventory(idle.p);idle.event('itemStopUse',0);idle.event('itemCompleteUse',0);idle.advance(1);
 assert.deepEqual(handoffProperties(idle.p),clearedHandoff);assert.deepEqual(lab.inventory(idle.p),before);idle.retire();
 for(const boundary of ['spawn','leave']){
  const a=lab.actor(handoffRoute());a.begin();a.advance(89);a.event('itemCompleteUse',0);
  if(boundary==='leave')lab.f.emit('world.afterEvents.playerLeave',{playerId:a.p.id});
  lab.f.emit('world.afterEvents.playerSpawn',{player:a.p,initialSpawn:boundary==='leave'});
  assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  a.begin();a.advance(1);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,1);
  assert.equal(handoffProperties(a.p).eat_profile,1);a.retire();
 }
});

test('a stale fixed-skewer completion cannot reward a newly selected item',async t=>{
  const lab=await createEatingLab();t.after(()=>lab.f.dispose());
  const a=lab.actor(routes.find(x=>x.id===beef));a.begin();a.advance(88);
  a.p.selectedSlotIndex=1;a.p.main=lab.f.item('minecraft:stone');a.advance(1);
  const before=lab.inventory(a.p);
  a.event('itemCompleteUse',0);
  const actualEffects=lab.f.effects.filter(e=>e.source===a.p);
  assert.deepEqual(actualEffects.map(e=>[e.effect,e.duration]),[['strength',200]],'known failure shape, not any new effect or exception');
  assert.deepEqual(lab.inventory(a.p),before);
  assert.equal(a.p.components['minecraft:player.hunger'].currentValue,2);
  assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_profile'),0);
  a.event('itemCompleteUse',0);assert.equal(lab.f.effects.filter(e=>e.source===a.p).length,1);
  await t.test('desired: the stale completion awards no effect',{todo:'T3.4: fixed completion lacks the current-hand check used for secret skewers'},()=>assert.equal(actualEffects.length,0));
});

test('a brief inventory-view mismatch does not strand an active meal at profile zero',async t=>{
  const lab=await createEatingLab();t.after(()=>lab.f.dispose());
  const a=lab.actor(routes.find(x=>x.id===beef)),before=lab.inventory(a.p);a.begin();a.advance(70);
  a.nativeDebit();a.advance(1);
  assert.equal(a.p.main.amount,1);
  for(const key of ['eat_profile','eat_hand','eat_native_ticks','eat_elapsed_ticks'])assert.equal(a.p.getProperty('kaleidoscope_grilling:'+key),0);
  a.p.main=a.stack;a.advance(1);
  const observed=a.sample('restored-view',true);
  assert.equal(observed.profile,0);assert.equal(observed.handCode,0);assert.equal(observed.nativeTicks,0);assert.equal(observed.clock,72);
  assert.deepEqual(lab.inventory(a.p),before);assert.equal(observed.hunger,2);assert.equal(observed.saturation,0);assert.equal(observed.effects,0);
  await t.test('desired: restored use has its FOUR profile',{todo:'T3.4: current-identity mismatch clears presentation without ending or restoring the session'},()=>assert.equal(observed.profile,5));
});

test('logging out after the Java checkpoint settles a meal even without a stop event',async t=>{
  const lab=await createEatingLab();t.after(()=>lab.f.dispose());
  // Java use() splits a stack first: one active serving, with the cleared-profile
  // remainder returned to inventory. Model that shape, not two held servings.
  // This driver still does not execute Java use() or Java logout itself.
  const a=lab.actor(routes.find(x=>x.id===beef),'main',1);
  a.p.inventory.setItem(7,a.stack.clone());
  const before=lab.inventory(a.p);a.begin();a.advance(java.minimum_eat_ticks);
  lab.f.emit('world.beforeEvents.playerLeave',{player:a.p});
  lab.f.emit('world.afterEvents.playerLeave',{playerId:a.p.id});
  assert.deepEqual(lab.inventory(a.p),before);assert.equal(a.p.inventory.getItem(7).amount,1);
  assert.equal(a.p.main.amount,1);
  assert.equal(a.p.components['minecraft:player.hunger'].currentValue,2);
  assert.equal(lab.f.effects.filter(e=>e.source===a.p).length,0);
  const heldCount=a.p.main.amount;
  await t.test('desired: logout settles the one active serving',{todo:'T3.4: Java onPlayerLoggedOut settles; Bedrock leave only clears the active session'},()=>assert.equal(heldCount,0));
});

// Source-grounded presentation selection; native rendering remains a separate gate.
import {presentation} from '../helpers/skewer-presentation.mjs';
import {admitEatingProjection,selectEatingProjection,supportsSourceFixedProjection} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_projection_routes.js';
import {readFileSync as readPresentationJson} from 'node:fs';
const javaPresentation=JSON.parse(readPresentationJson(new URL('../../data/java/eating_profiles.json',import.meta.url),'utf8')).loaders['forge-1.20.1'];
const compositedPresentation=new Set(['kaleidoscope_grilling:secret_skewer','kaleidoscope_grilling:mysterious_skewer','kaleidoscope_grilling:dark_grilling']);
const fixedPresentation=Object.entries(javaPresentation.profile_by_item).filter(([id])=>!compositedPresentation.has(id)).flatMap(([id,{profile}])=>profile==='THREE_RANDOM'?[[id,'THREE'],[id+'_java_three_alt','THREE_ALT']]:[[id,profile]]);
const presentationCodes={ONE:1,TWO:2,THREE:3,THREE_ALT:4,FOUR:5};
test('every fixed family uses one Java source profile in either hand without consuming the other hand',()=>{
 assert.equal(fixedPresentation.length,58);
 for(const [id,p]of fixedPresentation)for(const hand of ['main','off']){
  const other={typeId:'minecraft:diamond',amount:3,nameTag:'control'};
  const e={itemStack:{typeId:id},source:{}};
  assert.equal(admitEatingProjection(e,p,hand,()=>other),!['ONE','THREE'].includes(p),id+' occupied '+hand);
  assert.equal(admitEatingProjection(e,p,hand,()=>undefined),true,id+' empty '+hand);
  assert.deepEqual(other,{typeId:'minecraft:diamond',amount:3,nameTag:'control'});
  assert.equal(selectEatingProjection(e,p,hand),'animation.kg_java_eating.player.'+p.toLowerCase()+'.'+(hand==='main'?'right':'left'));
  assert.equal(supportsSourceFixedProjection(id+'_native_plain',p,hand),false);
 }
});
test('fixed bite geometry advances on Java integer checkpoints, not a render fraction',()=>{
 for(const [id,p]of fixedPresentation)for(const hand of ['main','off']){
  const profile=javaPresentation.profiles[p],code=presentationCodes[p],duration=profile.duration_ticks;
  for(const seconds of profile.bite_seconds){
   const boundary=Math.ceil(seconds*20);
   for(const tick of [boundary-1,boundary])for(const alpha of [0,.5,.999]){
    const result=presentation(id,{profile:code,hand,tick,alpha,duration});
    assert.equal(result.variables.kg_bite_stage,profile.bite_seconds.filter(s=>tick/20>=s).length,`${id} ${hand} tick=${tick} alpha=${alpha}`);
    assert.deepEqual(result.clips,['animation.kg_java_eating.item.'+p.toLowerCase()+'.'+(hand==='main'?'right':'left')]);
   }
  }
 }
});
test('fixed presentation returns to holding on interruption and starts a fresh continuous serving',()=>{
 for(const [id,p]of fixedPresentation)for(const hand of ['main','off']){
  const options={profile:presentationCodes[p],hand,duration:javaPresentation.profiles[p].duration_ticks};
  const terminal=presentation(id,{...options,tick:options.duration-1});
  assert.equal(terminal.variables.kg_bite_stage,javaPresentation.profiles[p].bite_seconds.length);
  for(const extra of [{using:false},{same:false},{profile:0},{slot:hand==='main'?'off':'main'}]){
   const stopped=presentation(id,{...options,tick:options.duration-1,...extra});
   assert.equal(stopped.variables.kg_bite_stage,0);
   assert.equal(stopped.clips.filter(x=>x.startsWith('animation.kg_java_eating.')).length,0);
  }
  assert.equal(presentation(id,{...options,tick:0}).variables.kg_bite_stage,0);
  const tp=presentation(id,{...options,tick:30,first:false});
  assert.deepEqual(tp.clips,['animation.kg_a287.skewer_tp_'+(hand==='main'?'right':'left')]);
 }
});
test('source routing preserves every slime frame at every bite stage and does not duplicate the caterpillar helper',()=>{
 const id='kaleidoscope_grilling:grilled_slime_skewer';
 for(const hand of ['main','off'])for(const [tick,stage]of [[0,0],[20,1],[80,2]])for(let frame=0;frame<5;frame++){
  const result=presentation(id,{profile:2,hand,tick,duration:90,slimeFrame:frame});
  assert.equal(result.variables.kg_slime_frame,frame);
  assert.equal(result.variables.kg_slime_index,stage*5+frame);
 }
 const rp=new URL('../../projects/grilling/gameplay_core/resource_pack/',import.meta.url);
 const caterpillar=JSON.parse(readPresentationJson(new URL('attachables/grilled_caterpillar_skewer.attachable.json',rp),'utf8'))['minecraft:attachable'].description;
 assert.deepEqual(caterpillar.render_controllers,['controller.render.kg_diagnostic.one_marker','controller.render.kg_java_eating.piece']);
 assert.ok(caterpillar.geometry.java_piece);
});
import {sourcePlayerBlend} from '../helpers/skewer-presentation.mjs';
test('dual helper fallback masks source rendering when the opposite held item is present or arrives mid-use',()=>{
 for(const [id,p]of fixedPresentation.filter(([,p])=>['ONE','THREE'].includes(p)))for(const hand of ['main','off']){
  const options={profile:presentationCodes[p],hand,tick:30,duration:javaPresentation.profiles[p].duration_ticks};
  assert.equal(sourcePlayerBlend(id,p,hand,false).weight,true);
  assert.equal(presentation(id,options).variables.kg_source_projection,true);
  // Replicated projection remains true after start, but current equipment wins.
  const active=presentation(id,{...options,oppositeOccupied:true});
  const otherSlot=hand==='main'?'off':'main';
  const inactive=presentation('kaleidoscope_grilling:grilled_beef_skewer',{...options,slot:otherSlot,oppositeOccupied:true});
  assert.equal(active.variables.kg_java_piece_visible,false);
  assert.equal(active.clips.some(clip=>clip.startsWith('animation.kg_java_eating.')),false);
  assert.deepEqual(inactive.clips,['animation.kg_a287.skewer_fp_'+(otherSlot==='main'?'right':'left')]);
  assert.equal(sourcePlayerBlend(id,p,hand,true).weight,false);
  assert.equal(presentation(id,options).variables.kg_source_projection,true,'removing opposite stack permits the source route again');
 }
});

test('terminal handoff masks all 58 fixed main models without extending helper or player motion',()=>{
 assert.equal(fixedPresentation.length,58);
 for(const [id,p]of fixedPresentation)for(const hand of ['main','off']){
  const duration=javaPresentation.profiles[p].duration_ticks;
  const options={profile:presentationCodes[p],hand,tick:duration-1,duration};
  const mainController=id==='kaleidoscope_grilling:grilled_slime_skewer'?'controller.render.kg_slime.frame':id==='kaleidoscope_grilling:grilled_caterpillar_skewer'?'controller.render.kg_diagnostic.one_marker':'controller.render.kg_a22.bite';
  const active=presentation(id,options),terminal=presentation(id,{...options,using:false});
  assert.equal(active.visibility[mainController]['*'],true,id+' active '+hand);
  assert.equal(terminal.variables.kg_terminal_wait,true,id+' terminal '+hand);
  assert.equal(terminal.visibility[mainController]['*'],false,id+' stale serving '+hand);
  if(['ONE','THREE'].includes(p))assert.equal(terminal.visibility['controller.render.kg_java_eating.piece']['*'],false,id+' helper stopped '+hand);
  else assert.equal(terminal.visibility['controller.render.kg_java_eating.piece'],undefined,id+' no helper in this source family');
  assert.equal(terminal.clips.some(clip=>clip.startsWith('animation.kg_java_eating.')),false,id+' item motion stopped');
  assert.equal(Boolean(sourcePlayerBlend(id,p,hand,false,false).weight),false,id+' player motion stopped');
  for(const cleared of [{profile:0},{same:false},{slot:hand==='main'?'off':'main'},{projection:false},{first:false}]){
   const other=presentation(id,{...options,using:false,...cleared});
   assert.equal(other.variables.kg_terminal_wait,false,id+' not owned '+JSON.stringify(cleared));
   assert.equal(other.visibility[mainController]['*'],true,id+' unrelated/TP model visible');
  }
  // The live helper admission may change while stopping. The consumed active
  // serving stays masked; no empty-opposite-hand latch extends its helper.
  const occupied=presentation(id,{...options,using:false,oppositeOccupied:true});
  assert.equal(occupied.visibility[mainController]['*'],false,id+' occupied opposite hand at completion');
  if(['ONE','THREE'].includes(p))assert.equal(occupied.visibility['controller.render.kg_java_eating.piece']['*'],false);
  const early=presentation(id,{...options,tick:23,using:false});
  assert.equal(early.visibility[mainController]['*'],true,id+' early cancellation is not a terminal serving');
  const next=presentation(id,{...options,tick:0});
  assert.equal(next.visibility[mainController]['*'],true);
  assert.equal(next.variables.kg_bite_stage,0,'a new native use starts the next whole serving');
 }
});

test('terminal handoff for a near-end release starts after its deferred settlement and never repeats it',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 for(const hand of ['main','off']){
  const a=lab.actor(handoffRoute(),hand);a.begin();a.advance(89);a.event('itemStopUse',1);
  assert.equal(a.p[hand].amount,2,'terminal stop leaves existing completion arbitration unchanged');
  a.advance(1);
  assert.equal(a.p[hand].amount,1,'deferred release settles exactly once when no completion arrives');
  assert.equal(handoffProperties(a.p).eat_profile,1);
  assert.equal(handoffProperties(a.p).eat_elapsed_ticks,90);
  const hunger=a.p.components['minecraft:player.hunger'].currentValue;
  a.event('itemCompleteUse',0);a.event('itemStopUse',0);a.advance(1);
  assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  assert.equal(a.p[hand].amount,1);assert.equal(a.p.components['minecraft:player.hunger'].currentValue,hunger);
  a.retire();
 }
});

test('terminal handoff snapshot or property failure cannot suppress completion rewards or repeat debit',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 for(const hand of ['main','off'])for(const failure of ['clone','property']){
  const a=lab.actor(routes.find(route=>route.id===beef),hand);a.begin();a.advance(89);a.nativeDebit();
  const before=lab.inventory(a.p),eventStack=a.stack.clone();
  // Only the presentation token's snapshot fails. The event and current item
  // remain readable for the unchanged completion/identity/reward contract.
  if(failure==='clone')eventStack.clone=()=>{throw new Error('Injected presentation snapshot failure');};
  else lab.f.faults.failNext(a.p,'setProperty',{phase:'after',predicate:(key,value)=>key==='kaleidoscope_grilling:eat_elapsed_ticks'&&value===90});
  assert.doesNotThrow(()=>lab.f.emit('world.afterEvents.itemCompleteUse',{source:a.p,itemStack:eventStack,useDuration:0}));
  assert.deepEqual(lab.inventory(a.p),before,'presentation failure never owns food writes');
  assert.deepEqual(handoffProperties(a.p),clearedHandoff,'failed token cannot leave a stale owner gate');
  assert.deepEqual(lab.f.effects.filter(row=>row.source===a.p).map(row=>[row.effect,row.duration]),[['strength',200]]);
  a.event('itemCompleteUse',0);a.event('itemStopUse',0);a.advance(1);
  assert.deepEqual(lab.inventory(a.p),before);assert.equal(lab.f.effects.filter(row=>row.source===a.p).length,1);a.retire();
 }
});

test('terminal handoff leaves composite and unadmitted fixed cancellation timing unchanged',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 const composite=new Set(['kaleidoscope_grilling:secret_skewer','kaleidoscope_grilling:mysterious_skewer','kaleidoscope_grilling:dark_grilling']);
 const excluded=routes.filter(row=>row.kind!=='plain'&&composite.has(row.base));assert.equal(excluded.length,6);
 for(const hand of ['main','off'])for(const route of [...excluded,handoffRoute()]){
  const a=lab.actor(route,hand);
  if(route.id===handoffRoute().id)a.p[hand==='main'?'off':'main']=lab.f.item('minecraft:diamond',3,{nameTag:'Occupied fallback'});
  a.begin();a.advance(23);const owned=handoffProperties(a.p),before=lab.inventory(a.p);
  if(route.id===handoffRoute().id)assert.equal(owned.eat_projection,false);
  a.event('itemStopUse',route.duration-23);
  assert.deepEqual(handoffProperties(a.p),owned,route.id+' retains its pre-existing deferred cancel');
  assert.deepEqual(lab.inventory(a.p),before);
  a.advance(1);assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  assert.deepEqual(lab.inventory(a.p),before);a.retire();
 }
});

test('terminal handoff retirement tolerates one reset failure without a hidden item or a stale retry clearing the next use',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 for(const hand of ['main','off'])for(const failedField of handoffPropertyNames)for(const startNext of [false,true]){
  const a=lab.actor(handoffRoute(),hand);a.begin();a.advance(89);a.nativeDebit();a.event('itemCompleteUse',0);
  const before=lab.inventory(a.p),effects=lab.f.effects.filter(row=>row.source===a.p).length;
  lab.f.faults.failNext(a.p,'setProperty',{predicate:(key,value)=>key==='kaleidoscope_grilling:'+failedField&&value===(failedField==='eat_projection'?false:0)});
  a.advance(1);
  const partial=handoffProperties(a.p);
  // Keep the original hand in this pure expression evaluation: clearing other
  // owner gates must suffice even without relying on a cleared hand field.
  const rendered=presentation(handoffRoute().id,{profile:partial.eat_profile,hand,projection:partial.eat_projection,duration:partial.eat_native_ticks,tick:partial.eat_elapsed_ticks,using:false});
  assert.equal(rendered.visibility['controller.render.kg_diagnostic.one_marker']['*'],true,failedField+' reset failure cannot strand terminal masking');
  assert.deepEqual(lab.inventory(a.p),before);
  if(startNext){
   a.begin();a.advance(1);
   assert.equal(handoffProperties(a.p).eat_profile,1);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,1);
   assert.equal(handoffProperties(a.p).eat_projection,true,'new start owns its properties, not the old retry');
  }else{
   a.advance(1);assert.deepEqual(handoffProperties(a.p),clearedHandoff,'existing scheduler retries the failed reset');
  }
  assert.deepEqual(lab.inventory(a.p),before);assert.equal(lab.f.effects.filter(row=>row.source===a.p).length,effects);a.retire();
 }
});

test('terminal handoff documents the supplied-query same-ID replacement gap before server identity refresh',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 for(const hand of ['main','off']){
  const a=lab.actor(handoffRoute(),hand);a.begin();a.advance(89);
  const replacement=a.p[hand];replacement.nameTag='Different serving with the same public ID';
  lab.data.setItemProperty(replacement,'foreign:timeline','replacement-owner');a.p[hand]=replacement;
  const before=lab.inventory(a.p),effects=lab.f.effects.filter(row=>row.source===a.p).length;
  const visible=using=>{
   const owner=handoffProperties(a.p);
   return presentation(handoffRoute().id,{profile:owner.eat_profile,hand,projection:owner.eat_projection,duration:owner.eat_native_ticks,tick:owner.eat_elapsed_ticks,using}).visibility['controller.render.kg_diagnostic.one_marker']['*'];
  };
  // Deliberately supply ended native use with old published owner fields. The
  // client expression knows the ID, not stack metadata: it can mask this new
  // serving until a server identity refresh arrives. This is a documented
  // packet-boundary limitation, NOT observed native timing or desired parity.
  assert.equal(visible(false),false,'same ID alone cannot disprove stale client ownership');
  assert.deepEqual(lab.inventory(a.p),before);
  a.advance(1);
  assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  assert.equal(visible(false),true,'server metadata mismatch clears the old owner gate');
  assert.deepEqual(lab.inventory(a.p),before);
  a.begin();assert.equal(visible(true),true,'a fresh native use shows its new whole serving');
  a.advance(1);assert.equal(visible(true),true);
  assert.deepEqual(lab.inventory(a.p),before);assert.equal(lab.f.effects.filter(row=>row.source===a.p).length,effects);
  a.retire();
 }
});

// Optional next-tick Entity.setProperty publication is a server API boundary,
// not a simulated renderer/transport. Supply the observed stale-held native
// use=false view explicitly, then evaluate actual emitted RP expressions.
function publishedEatingView(a,using=false){
 const o=handoffProperties(a.p);
 const view=presentation(a.route.id,{hand:a.hand,ownerHand:o.eat_hand,profile:o.eat_profile,
  projection:o.eat_projection,duration:o.eat_native_ticks,tick:o.eat_elapsed_ticks,using});
 return {...view,visible:Object.values(view.visibility)[0]['*']};
}

test('deferred entity properties publish before next-tick jobs without changing the default fixture',t=>{
 const immediate=createFixture(),deferred=createFixture({deferEntityProperties:true});
 t.after(()=>{immediate.dispose();deferred.dispose();});
 const direct=immediate.player(),p=deferred.player(),other=deferred.player();
 direct.setProperty('test:value',1);assert.equal(direct.getProperty('test:value'),1);
 p.setProperty('test:value',1);p.setProperty('test:value',2);other.setProperty('test:value',9);
 assert.equal(p.getProperty('test:value'),undefined);assert.equal(other.getProperty('test:value'),undefined);
 const reads=[];deferred.system.run(()=>{
  reads.push(p.getProperty('test:value'));p.setProperty('test:value',3);reads.push(p.getProperty('test:value'));
 });
 deferred.tick();assert.deepEqual(reads,[2,2]);assert.equal(p.getProperty('test:value'),2);
 assert.equal(other.getProperty('test:value'),9);
 deferred.tick();assert.equal(p.getProperty('test:value'),3);
});

test('deferred completion properties reproduce start zero, complete at89 reading88, handoff90 then clear',async t=>{
 const lab=await createEatingLab({deferEntityProperties:true});t.after(()=>lab.f.dispose());
 const a=lab.actor(handoffRoute(),'main',1);a.begin();
 assert.deepEqual(handoffProperties(a.p),clearedHandoff);
 let rows=trace164ServerRows(lab.f);assert.deepEqual(rows.map(row=>row[0]),[10,11]);
 assert.ok(rows.every(row=>row.slice(8).every(value=>value===0)),'both start callbacks read old published properties');
 a.advance(89);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,88);
 a.event('itemStopUse',0);a.nativeDebit();a.event('itemCompleteUse',0);
 const before=lab.inventory(a.p);rows=trace164ServerRows(lab.f);
 for(const event of [20,30,31]){
  const row=rows.find(row=>row[0]===event);assert.equal(row[2],89);
  assert.deepEqual(row.slice(8),[1,1,1,90,88],'event '+event+' reads the previous tick, not its queued write');
 }
 assert.equal(publishedEatingView(a).visible,false,'completion stale-held frame is hidden before the handoff write publishes');
 a.advance(1);assert.deepEqual(handoffProperties(a.p),{eat_profile:1,eat_hand:1,eat_projection:true,eat_native_ticks:90,eat_elapsed_ticks:90});
 assert.equal(publishedEatingView(a).visible,false);
 rows=trace164ServerRows(lab.f);
 for(const event of [40,41])assert.deepEqual(rows.find(row=>row[0]===event).slice(8),[1,1,1,90,90]);
 a.advance(1);assert.deepEqual(handoffProperties(a.p),clearedHandoff);
 assert.equal(publishedEatingView(a).visible,true);assert.deepEqual(lab.inventory(a.p),before);
 assert.equal(a.p.main,undefined);a.retire();
});

test('deferred completion hides the first stale frame for58 fixed routes in both hands without extending active motion or debit',async t=>{
 const lab=await createEatingLab({deferEntityProperties:true});t.after(()=>lab.f.dispose());
 const profiles=new Set();let count=0;
 for(const [id,profile] of fixedPresentation)for(const hand of ['main','off']){
  const route=routes.find(row=>row.id===id);assert.ok(route,id);
  const a=lab.actor(route,hand,2);a.begin();
  assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  a.advance(route.duration-2);
  assert.equal(handoffProperties(a.p).eat_elapsed_ticks,route.duration-3);
  assert.equal(publishedEatingView(a).visible,true,id+' remains visible before the completion window');
  a.advance(1);
  const current=handoffProperties(a.p);assert.equal(current.eat_profile,presentationCodes[profile]);
  assert.equal(current.eat_elapsed_ticks,route.duration-2);assert.equal(current.eat_projection,true);
  const active=publishedEatingView(a,true),ended=publishedEatingView(a);
  assert.equal(active.visible,true,id+' ongoing native use is never hidden');
  assert.equal(ended.visible,false,id+' '+hand+' stale frame at inclusive completion');
  assert.equal(ended.clips.some(clip=>clip.startsWith('animation.kg_java_eating.')),false);
  a.nativeDebit();const inventory=lab.inventory(a.p);a.event('itemCompleteUse',0);
  assert.deepEqual(handoffProperties(a.p),current,'completion writes are not readable in their own tick');
  assert.deepEqual(lab.inventory(a.p),inventory,'presentation never owns inventory settlement');
  a.advance(1);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,route.duration);
  assert.equal(publishedEatingView(a).visible,false);
  a.advance(1);assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  assert.equal(publishedEatingView(a).visible,true);assert.deepEqual(lab.inventory(a.p),inventory);
  assert.equal(a.p[hand].amount,1);profiles.add(profile);count++;a.retire();
 }
 assert.equal(count,116);assert.deepEqual([...profiles].sort(),['FOUR','ONE','THREE','THREE_ALT','TWO']);
});

test('deferred completion respects stop and native-debit ordering without repeating rewards',async t=>{
 const lab=await createEatingLab({deferEntityProperties:true});t.after(()=>lab.f.dispose());
 for(const hand of ['main','off'])for(const amount of [1,2])for(const debitOrder of ['before','after'])for(const stopOrder of ['before','after']){
  const a=lab.actor(routes.find(row=>row.id===beef),hand,amount);a.begin();a.advance(89);
  if(debitOrder==='before')a.nativeDebit();if(stopOrder==='before')a.event('itemStopUse',0);
  const before=lab.inventory(a.p);a.event('itemCompleteUse',0);
  assert.deepEqual(lab.inventory(a.p),before);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,88);
  assert.equal(publishedEatingView(a).visible,false);
  if(debitOrder==='after')a.nativeDebit();if(stopOrder==='after')a.event('itemStopUse',0);
  const settled=lab.inventory(a.p),effects=()=>lab.f.effects.filter(row=>row.source===a.p).map(row=>[row.effect,row.duration]);
  assert.deepEqual(effects(),[['strength',200]]);a.event('itemCompleteUse',0);a.event('itemStopUse',0);
  a.advance(1);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,90);
  a.advance(1);assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  assert.deepEqual(lab.inventory(a.p),settled);assert.equal(a.p[hand]?.amount??0,amount-1);
  assert.deepEqual(effects(),[['strength',200]]);a.retire();
 }
});

test('deferred completion keeps early cancellation visible and preserves successful or failed early-release settlement',async t=>{
 const lab=await createEatingLab({deferEntityProperties:true});t.after(()=>lab.f.dispose());
 const representatives=[...new Map(fixedPresentation.map(([id,profile])=>[profile,id])).values()];
 for(const id of representatives)for(const hand of ['main','off'])for(const mode of ['early','release','failed-release']){
  const a=lab.actor(routes.find(row=>row.id===id),hand);a.begin();a.advance(mode==='early'?23:25);
  assert.equal(publishedEatingView(a).visible,true,id+' native end well before completion is visible');
  const before=lab.inventory(a.p),hunger=a.p.components['minecraft:player.hunger'].currentValue;
  if(mode==='failed-release')lab.f.faults.failNext(hand==='main'?a.p.inventory:a.p.equipment,hand==='main'?'setItem':'setEquipment');
  a.event('itemStopUse',a.route.duration-(mode==='early'?23:25));
  assert.equal(publishedEatingView(a).visible,true,'a stop callback cannot publish properties in the same tick');
  if(mode==='release')assert.equal(a.p[hand].amount,1,'eligible release still debits immediately');
  else {assert.deepEqual(lab.inventory(a.p),before);assert.equal(a.p.components['minecraft:player.hunger'].currentValue,hunger);}
  const settled=lab.inventory(a.p);a.event('itemStopUse',a.route.duration-25);a.advance(1);
  if(mode==='release'){
   assert.equal(handoffProperties(a.p).eat_elapsed_ticks,a.route.duration);
   assert.equal(publishedEatingView(a).visible,false,'existing successful-release handoff behavior is retained');
  }else {assert.deepEqual(handoffProperties(a.p),clearedHandoff);assert.equal(publishedEatingView(a).visible,true);}
  a.advance(1);assert.deepEqual(handoffProperties(a.p),clearedHandoff);
  assert.deepEqual(lab.inventory(a.p),settled);a.retire();
 }
});

test('deferred completion failed terminal release restores visibility after publication without debit or nutrition',async t=>{
 const lab=await createEatingLab({deferEntityProperties:true});t.after(()=>lab.f.dispose());
 for(const hand of ['main','off']){
  const a=lab.actor(handoffRoute(),hand);a.begin();a.advance(89);
  const inventory=lab.inventory(a.p),hunger=a.p.components['minecraft:player.hunger'].currentValue,
   saturation=a.p.components['minecraft:player.saturation'].currentValue,effects=lab.f.effects.filter(row=>row.source===a.p).length;
  assert.equal(handoffProperties(a.p).eat_elapsed_ticks,88);assert.equal(publishedEatingView(a).visible,false);
  lab.f.faults.failNext(hand==='main'?a.p.inventory:a.p.equipment,hand==='main'?'setItem':'setEquipment');
  a.event('itemStopUse',0);assert.deepEqual(lab.inventory(a.p),inventory);
  a.advance(1);assert.equal(publishedEatingView(a).visible,false,'deferred failure queues the reset, not immediate publication');
  assert.deepEqual(lab.inventory(a.p),inventory);
  a.advance(1);assert.deepEqual(handoffProperties(a.p),clearedHandoff);assert.equal(publishedEatingView(a).visible,true);
  assert.deepEqual(lab.inventory(a.p),inventory);assert.equal(a.p.components['minecraft:player.hunger'].currentValue,hunger);
  assert.equal(a.p.components['minecraft:player.saturation'].currentValue,saturation);
  assert.equal(lab.f.effects.filter(row=>row.source===a.p).length,effects);a.retire();
 }
 // Two fixture boundaries: deferred stop settlement, then Entity.setProperty.
 // This bound is not a network-packet or retail-frame delivery guarantee.
});

test('deferred completion bounds stale same-ID replacement masking and cannot clear a fresh continuous serving',async t=>{
 const lab=await createEatingLab({deferEntityProperties:true});t.after(()=>lab.f.dispose());
 for(const hand of ['main','off'])for(const change of ['metadata','slot','continuous','restart','restart-after-retirement']){
  if(hand==='off'&&change==='slot')continue; // Hotbar selection does not replace the offhand slot.
  const a=lab.actor(handoffRoute(),hand,2);a.begin();a.advance(89);
  if(change==='metadata'||change==='slot'){
   if(change==='slot'){a.p.selectedSlotIndex=1;a.p.main=a.stack.clone();}
   else {const stack=a.p[hand];stack.nameTag='Same ID different serving';a.p[hand]=stack;}
   const before=lab.inventory(a.p);
   // Same ID is insufficient client evidence until the server identity check
   // clears ownership and that reset crosses the explicit property boundary.
   assert.equal(publishedEatingView(a).visible,false);
   a.advance(1);assert.equal(publishedEatingView(a).visible,false);
   a.advance(1);assert.deepEqual(handoffProperties(a.p),clearedHandoff);
   assert.equal(publishedEatingView(a).visible,true);assert.deepEqual(lab.inventory(a.p),before);
  }else{
   a.nativeDebit();a.event('itemCompleteUse',0);a.event('itemStopUse',0);
   if(change.startsWith('restart')){const next=a.p[hand];next.nameTag='New metadata owner';a.p[hand]=next;}
   if(change==='restart-after-retirement')a.advance(1); // A reset is already queued; the fresh start must supersede it.
   a.begin();const before=lab.inventory(a.p);
   a.advance(1);assert.equal(handoffProperties(a.p).eat_profile,1);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,0);
   assert.equal(publishedEatingView(a,true).visible,true);
   a.advance(1);assert.equal(handoffProperties(a.p).eat_profile,1);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,1);
   assert.deepEqual(lab.inventory(a.p),before,'old-token cleanup cannot consume or reset the new serving');
   a.advance(87);a.nativeDebit();a.event('itemCompleteUse',0);a.advance(2);
   assert.deepEqual(handoffProperties(a.p),clearedHandoff);assert.equal(a.p[hand],undefined);
  }
  a.retire();
 }
 const idle=lab.actor(handoffRoute(),'off');const before=lab.inventory(idle.p);
 idle.advance(100);idle.event('itemStopUse',0);idle.event('itemCompleteUse',0);idle.advance(2);
 assert.deepEqual(handoffProperties(idle.p),clearedHandoff);assert.deepEqual(lab.inventory(idle.p),before);idle.retire();
});

// Bounded server diagnostics retained from164. Client color controls below
// evaluate actual JSON under supplied queries, not a Molang VM, renderer,
// native packet stream, or successful content-log capture.
const trace164Id='kaleidoscope_grilling:grilled_caterpillar_skewer';
function trace164ServerRows(f){
 return f.logs.filter(row=>row.text.startsWith('[KG164] ')).map(row=>{
  const fields=JSON.parse(row.text.slice('[KG164] '.length));
  assert.equal(fields.length,13);assert.ok(fields.every(Number.isFinite));return fields;
 });
}

test('ONE flash colors leave functional state, clips and visibility equal to the unchanged raw counterpart',()=>{
 const tracedState={},controlState={};
 const core=result=>({variables:Object.fromEntries(Object.entries(result.variables).filter(([name])=>!name.startsWith('kg_diag_')&&!name.startsWith('kg_local_'))),clips:result.clips,visibility:Object.fromEntries(Object.entries(result.visibility).map(([name,value])=>[name==='controller.render.kg_diagnostic.one_marker'?'controller.render.kg_a22.bite':name,value]))});
 const cases=[{using:false,profile:0,ownerHand:0,projection:false,duration:0},{tick:0},{tick:23},{tick:24},{tick:61},{tick:62},{tick:89},{tick:90,using:false},
  {tick:90,using:false,oppositeOccupied:true},{using:false,profile:0,ownerHand:0,projection:false,duration:0},{tick:0},{tick:70,hand:'off'},
  {tick:70,first:false},{tick:70,same:false},{tick:70,projection:false},{tick:70,alpha:.999}];
 for(const options of cases){
  const input={profile:1,hand:'main',duration:90,...options};
  const traced=presentation(trace164Id,{...input,state:tracedState}),control=presentation('kaleidoscope_grilling:raw_caterpillar_skewer',{...input,state:controlState});
  assert.deepEqual(core(traced),core(control),JSON.stringify(options));assert.deepEqual(traced.logs,[]);assert.deepEqual(control.logs,[]);
 }
});

test('164 server trace records numeric event and property handoff order without owning food debit or rewards',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 const a=lab.actor(handoffRoute(),'main');a.begin();
 let rows=trace164ServerRows(lab.f);assert.deepEqual(rows.map(row=>row[0]),[10,11]);
 assert.deepEqual(rows[0].slice(8),[0,0,0,0,0]);assert.deepEqual(rows[1].slice(8),[1,1,1,90,0]);
 assert.equal(rows[0][3],90);assert.equal(rows[0][7],1);
 a.advance(89);a.nativeDebit();const before=lab.inventory(a.p);
 a.event('itemStopUse',0);a.event('itemCompleteUse',0);a.advance(1);
 rows=trace164ServerRows(lab.f);
 const stop=rows.find(row=>row[0]===20),complete=rows.find(row=>row[0]===30),handoff=rows.find(row=>row[0]===31);
 assert.equal(stop[3],0);assert.equal(complete[3],0);assert.equal(complete[5],1);assert.equal(complete[6],0);assert.equal(complete[7],1);
 assert.equal(handoff[7],0);assert.deepEqual(handoff.slice(8),[1,1,1,90,90]);
 const clearing=rows.findIndex(row=>row[0]===40),cleared=rows.findIndex(row=>row[0]===41);
 assert.ok(clearing>=0&&cleared>clearing);assert.deepEqual(rows[cleared].slice(8),[0,0,0,0,0]);
 assert.ok(rows.every(row=>row[1]-row[2]===a.start));
 assert.deepEqual(lab.inventory(a.p),before);assert.equal(lab.f.effects.filter(row=>row.source===a.p).length,0);
 const count=rows.length;a.advance(3);
 assert.equal(trace164ServerRows(lab.f).length,count,'the first all-inactive scheduled row closes the trace');
 a.retire();
});

test('164 server trace arms only the first public mainhand actor and ignores other players',async t=>{
 const lab=await createEatingLab();t.after(()=>lab.f.dispose());
 const off=lab.actor(handoffRoute(),'off'),other=lab.actor(routes.find(route=>route.id===beef),'main');
 off.begin();other.begin();off.advance(1);assert.deepEqual(trace164ServerRows(lab.f),[]);
 const a=lab.actor(handoffRoute(),'main');a.begin();let count=trace164ServerRows(lab.f).length;assert.equal(count,2);
 const second=lab.actor(handoffRoute(),'main');second.begin();assert.equal(trace164ServerRows(lab.f).length,count);
 a.advance(1);assert.equal(trace164ServerRows(lab.f).length,count+1,'only the traced player emits the scheduled row');
 for(const actor of [off,other,a,second])actor.retire();
});

test('164 server trace has independent row and140-tick limits and never rearms after closing',async t=>{
 for(const bound of ['rows','ticks']){
  const lab=await createEatingLab();t.after(()=>lab.f.dispose());
  const a=lab.actor(handoffRoute(),'main');a.begin();const before=lab.inventory(a.p);
  if(bound==='rows')for(let i=0;i<150;i++)a.event('itemStopUse',90);
  else a.advance(141);
  const rows=trace164ServerRows(lab.f),count=rows.length;
  if(bound==='rows'){assert.equal(count,300);assert.ok(rows.every(row=>row[2]===0));}
  else{assert.ok(count<300);assert.equal(Math.max(...rows.map(row=>row[2])),140);}
  a.advance(1);a.begin();a.advance(2);
  assert.equal(trace164ServerRows(lab.f).length,count,'closed VM trace cannot be rearmed by another use');
  assert.deepEqual(lab.inventory(a.p),before);assert.equal(lab.f.effects.filter(row=>row.source===a.p).length,0);a.retire();
 }
});

test('164 server trace closes at a new native use boundary before logging unrelated subsequent state',async t=>{
 for(const next of ['same','offhand','different','leave']){
  const lab=await createEatingLab();t.after(()=>lab.f.dispose());
  const a=lab.actor(handoffRoute(),'main');a.begin();a.advance(10);
  const before=trace164ServerRows(lab.f).length,inventory=lab.inventory(a.p);
  if(next==='leave')lab.f.emit('world.afterEvents.playerLeave',{playerId:a.p.id});
  else{
   const stack=next==='different'?lab.f.item(beef):a.stack.clone();
   if(next==='offhand'){a.p.main=undefined;a.p.off=stack;}else a.p.main=stack;
   lab.f.emit('world.afterEvents.itemStartUse',{source:a.p,itemStack:stack.clone(),useDuration:90});
  }
  const rows=trace164ServerRows(lab.f);
  if(next==='leave')assert.equal(rows.length,before);
  else{assert.equal(rows.length,before+1);assert.equal(rows.at(-1)[0],60);assert.deepEqual(rows.at(-1).slice(8),[1,1,1,90,10]);}
  const count=rows.length;a.advance(2);
  lab.f.emit('world.afterEvents.itemStartUse',{source:a.p,itemStack:a.stack.clone(),useDuration:90});a.advance(1);
  assert.equal(trace164ServerRows(lab.f).length,count,'later native uses cannot rearm the closed first-use trace');
  if(next==='same'||next==='leave')assert.deepEqual(lab.inventory(a.p),inventory);
  a.retire();
 }
});

import {presentationTextures} from '../helpers/skewer-presentation.mjs';
const markerController='controller.render.kg_diagnostic.one_marker';
const markerAttachable=id=>JSON.parse(readPresentationJson(new URL('../../projects/grilling/gameplay_core/resource_pack/attachables/'+id.split(':')[1]+'.attachable.json',import.meta.url),'utf8'))['minecraft:attachable'].description;
const markerTexture=(options={})=>presentationTextures(trace164Id,options)[markerController][0];
const flashColors=['lime','orange','red','cyan','magenta','white'];
const flashTexture=state=>markerTexture({state:Object.freeze({...state})});

test('ONE flash colors partition actual mainhand use ownership and terminal-clock inputs without changing the mask',()=>{
 const observed=new Set();let count=0;
 for(const using of [false,true])for(const ownerHand of [0,1,2])for(const profile of [0,1,2])
 for(const projection of [false,true])for(const same of [false,true])for(const duration of [0,1,90])
 for(const tick of [0,.999,1,87,88,90])for(const oppositeOccupied of [false,true]){
  const input={hand:'main',using,ownerHand,profile,projection,same,duration,tick,oppositeOccupied};
  const result=presentation(trace164Id,input),v=result.variables;
  const owner=ownerHand===1&&profile===1&&projection&&same;
  const clock=duration>0&&tick>=duration-2;
  // Independent partition from supplied engine-query/property inputs. These
  // controls do not assert when a retail client receives those values.
  const predicates=[using&&owner&&!oppositeOccupied,using&&!(owner&&!oppositeOccupied),
   !using&&!owner,!using&&owner&&!clock,!using&&owner&&clock];
  assert.equal(predicates.filter(Boolean).length,1,JSON.stringify(input));
  const expected=predicates.findIndex(Boolean),masked=!using&&owner&&clock;
  assert.equal(v.kg_diag_state,expected,JSON.stringify(input));
  assert.equal(Boolean(v.kg_diag_using),using);
  assert.equal(Boolean(v.kg_terminal_wait),masked);
  assert.equal(v.kg_diag_state===4,masked,'magenta corresponds to the actual mask, not just a clock label');
  assert.equal(result.visibility[markerController]['*'],!masked,'diagnostics never make masked food visible');
  assert.equal(flashTexture(v),'textures/blocks/concrete_'+(expected===0?(duration<=0?'black':duration-tick-1<0?'gray':duration-tick-1===0?'light_blue':duration-tick-1<=1?'pink':'green'):expected===3?(duration<=0?'black':'white'):flashColors[expected]));
  assert.deepEqual(result.logs,[],'client q.log telemetry is no longer executed');
  observed.add(expected);count++;
 }
 assert.equal(count,2592);assert.deepEqual([...observed].sort(),[0,1,2,3,4]);
});

test('ONE flash colors distinguish source-route fallback and local use from unrelated owner-use queries',()=>{
 for(const gate of ['oppositeOccupied','sneaking','swimming','gliding','riding']){
  const result=presentation(trace164Id,{profile:1,hand:'main',using:true,ownerUsing:false,[gate]:true});
  assert.equal(result.variables.kg_diag_state,1,gate+' blocks source route while native using remains true');
  assert.equal(flashTexture(result.variables),'textures/blocks/concrete_orange');
  assert.ok(!result.clips.some(name=>name.startsWith('animation.kg_java_eating.')));
  assert.deepEqual(result.logs,[]);
 }
 for(const ownerUsing of [false,true])for(const [input,expected] of [
  [{using:true,tick:0},0],
  [{using:false,tick:87},3],
  [{using:false,tick:89},4],
  [{using:false,profile:0,ownerHand:0,projection:false,duration:0},2]]){
  const result=presentation(trace164Id,{profile:1,hand:'main',duration:90,...input,ownerUsing});
  assert.equal(result.variables.kg_diag_state,expected);
  assert.deepEqual(result.logs,[]);
 }
});

test('ONE flash color RC uses white for uninitialized observers and reads frozen state without attachable context',()=>{
 for(const state of [{},{kg_diag_main:1},{kg_diag_main:undefined,kg_diag_state:undefined},{kg_diag_main:1,kg_diag_state:5}]){
  const snapshot={...state};assert.equal(flashTexture(state),'textures/blocks/concrete_white');
  assert.deepEqual(state,snapshot,'RC evaluation does not initialize or mutate observer state');
 }
 // Explicit decoder controls include the otherwise-unreachable WHITE branch;
 // only actual pre-animation results above are evidence for the five gates.
 for(let phase=0;phase<6;phase++){
  const state={kg_diag_main:1,kg_diag_state:phase};
  assert.equal(flashTexture(state),'textures/blocks/concrete_'+(phase===0||phase===3?'white':flashColors[phase]));
 }
});

test('ONE flash colors recompute across completion cancellation and restart instead of retaining a prior color',()=>{
 const state={};
 const cases=[
  [{using:false,profile:0,ownerHand:0,projection:false,duration:0},2,true],
  [{using:true,tick:0},0,true],
  [{using:true,projection:false,tick:10},1,true],
  [{using:false,tick:10},3,true],
  [{using:false,tick:87},3,true],
  [{using:false,tick:89},4,false],
  [{using:false,profile:0,ownerHand:0,projection:false,duration:0},2,true],
  [{using:true,tick:0},0,true]
 ];
 for(const [input,phase,visible] of cases){
  const result=presentation(trace164Id,{profile:1,hand:'main',duration:90,state,...input});
  assert.equal(state.kg_diag_state,phase);
  assert.equal(result.visibility[markerController]['*'],visible);
  assert.equal(flashTexture(state),'textures/blocks/concrete_'+(phase===0?'green':phase===3?'white':flashColors[phase]));
  assert.deepEqual(result.logs,[]);
 }
});

test('ONE flash colors keep nonmain bite textures despite persisted observer state and do not affect other routes',()=>{
 const doc=markerAttachable(trace164Id);
 for(const first of [false,true])for(const hand of ['main','off']){
  if(first&&hand==='main')continue;
  for(const [tick,stage] of [[0,0],[24,1],[62,2]]){
   const state={kg_diag_main:1,kg_diag_state:4};
   const result=presentation(trace164Id,{state,first,hand,using:true,profile:1,duration:90,tick});
   assert.equal(Boolean(state.kg_diag_main),false);
   assert.equal(flashTexture(state),doc.textures['stage'+stage]);
   assert.deepEqual(result.logs,[]);
  }
 }
 const otherRoutes=[...fixedPresentation.map(([id])=>id),...Array.from(compositedPresentation).flatMap(id=>[id,id+'_java_three_alt'])];
 assert.equal(otherRoutes.length,64);
 for(const id of otherRoutes){
  if(id===trace164Id)continue;
  assert.ok(!markerAttachable(id).render_controllers.includes(markerController),id);
 }
});


// ONE native countdown observer: replay actual JSON with independently supplied
// owner elapsed and native queries. No native clock/renderer behavior is mocked.
const clockColors=['white','black','blue','yellow','purple','brown'];
function localClockFrame(state,input={}){
 const result=presentation(trace164Id,{profile:1,hand:'main',duration:90,tick:10,state,...input});
 return {...result,texture:flashTexture(result.variables)};
}
test('ONE local countdown observer classifies the last owned native sample only on the old cyan branch',()=>{
 for(const [remaining,bucket] of [[.25,2],[1,2],[1.0001,3],[2,3],[2.0001,4],[4,4],[4.0001,5],[89,5],[90,5]]){
  const state={};
  const using=localClockFrame(state,{using:true,nativeRemaining:remaining,nativeMaximum:90,tick:10});
  assert.equal(Boolean(using.variables.kg_diag_clock_seen),true);assert.equal(using.variables.kg_diag_clock_last,remaining);
  assert.equal(using.texture,'textures/blocks/concrete_'+(remaining<=1?'pink':'green'),'live bins do not replace stopped-cache bins');
  const stop=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:10});
  assert.equal(stop.variables.kg_diag_state,3);assert.equal(stop.variables.kg_diag_clock_bucket,bucket);
  assert.equal(stop.variables.kg_diag_clock_last,remaining,'do not sample native zero-reset at stop');
  assert.equal(stop.texture,'textures/blocks/concrete_'+clockColors[bucket]);
  assert.equal(stop.visibility[markerController]['*'],remaining>1,'only the observed local terminal edge adds masking');
  assert.equal(Boolean(stop.variables.kg_local_terminal),remaining<=1);
 }
});
test('ONE local countdown observer distinguishes missing samples from a nonpositive owner duration',()=>{
 for(const input of [{},{nativeRemaining:0},{nativeRemaining:1},{nativeRemaining:90}]){
  const state={},stop=localClockFrame(state,{...input,using:false,nativeMaximum:90});
  assert.equal(Boolean(stop.variables.kg_diag_clock_seen),false);assert.equal(stop.variables.kg_diag_clock_last,-1);
  assert.equal(stop.texture,'textures/blocks/concrete_white','no while-using sample is unknown, never a terminal zero');
 }
 const state={};localClockFrame(state,{using:true,nativeRemaining:1});
 const zero=localClockFrame(state,{using:false,duration:0,nativeRemaining:0,nativeMaximum:0});
 assert.equal(zero.variables.kg_diag_state,3);assert.equal(zero.variables.kg_diag_clock_bucket,1);
 assert.equal(zero.texture,'textures/blocks/concrete_black');assert.equal(Boolean(zero.variables.kg_diag_clock_seen),false);
 assert.equal(flashTexture({kg_diag_main:1,kg_diag_state:3}),'textures/blocks/concrete_white');
});
test('ONE local countdown observer invalidates unusable samples and observed context changes',()=>{
 const invalid=[{nativeRemaining:0},{nativeRemaining:-1},{nativeRemaining:91},{nativeMaximum:0},{nativeMaximum:89},
  {projection:false},{same:false},{ownerHand:2},{profile:2},{oppositeOccupied:true},{sneaking:true},{swimming:true},{gliding:true},{riding:true}];
 for(const bad of invalid){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1});
  const using=localClockFrame(state,{using:true,nativeRemaining:50,nativeMaximum:90,...bad});
  assert.equal(Boolean(using.variables.kg_diag_clock_seen),false,JSON.stringify(bad));
  assert.equal(using.variables.kg_diag_clock_last,-1);assert.equal(using.variables.kg_diag_clock_last_max,0);
  const stop=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0});
  assert.equal(stop.texture,'textures/blocks/concrete_white','do not reuse a previous session terminal sample');
 }
 for(const context of [{first:false},{hand:'off',ownerHand:2},{same:false},{profile:2},{ownerHand:2},{projection:false},{duration:100}]){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1});
  localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,...context});
  assert.equal(Boolean(state.kg_diag_clock_seen),false,JSON.stringify(context));
  assert.equal(localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0}).texture,'textures/blocks/concrete_white');
 }
});
test('ONE local countdown observer overwrites a last sample rather than latching terminal across restarts',()=>{
 const state={};localClockFrame(state,{using:true,nativeRemaining:1});
 // A countdown increase can represent a new use without a rendered false frame.
 localClockFrame(state,{using:true,nativeRemaining:89});
 assert.equal(state.kg_diag_clock_last,89);
 const stop=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0});
 assert.equal(stop.texture,'textures/blocks/concrete_brown');
 localClockFrame(state,{using:true,nativeRemaining:1});
 localClockFrame(state,{using:false,projection:false,nativeRemaining:0,nativeMaximum:0});
 assert.equal(localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0}).texture,'textures/blocks/concrete_white');
 // A recreated attachable has no prior sample and must not guess completion.
 assert.equal(localClockFrame({}, {using:false,nativeRemaining:0,nativeMaximum:0}).texture,'textures/blocks/concrete_white');
});
test('ONE local countdown observer leaves functional outputs and nonflash textures unchanged',()=>{
 const tracked={},control={};
 const functional=r=>({variables:Object.fromEntries(Object.entries(r.variables).filter(([k])=>!k.startsWith('kg_diag_')&&!k.startsWith('kg_local_'))),clips:r.clips,visibility:Object.values(r.visibility)});
 const cases=[{using:true,nativeRemaining:89},{using:true,nativeRemaining:1},{using:false,nativeRemaining:0,expectedLocalHold:true},
  {using:false,nativeRemaining:0,tick:88,expectedLocalHold:true},{using:false,projection:false},{using:true,nativeRemaining:89},
  {using:true,nativeRemaining:0},{using:false,nativeRemaining:0},{using:false,duration:0}];
 for(const input of cases){
  const options={profile:1,hand:'main',duration:90,tick:10,nativeMaximum:90,...input};
  const a=presentation(trace164Id,{...options,state:tracked}),b=presentation('kaleidoscope_grilling:raw_caterpillar_skewer',{...options,state:control});
  const expected=functional(b);
  if(input.expectedLocalHold)expected.visibility[0]['*']=false;
  assert.equal(Boolean(a.variables.kg_local_terminal),!!input.expectedLocalHold);
  assert.deepEqual(functional(a),expected,'only the explicit ONE-main local mask exception may differ; clips/clocks/bites remain equal');
  if(![0,3].includes(a.variables.kg_diag_state))assert.equal(flashTexture(a.variables),'textures/blocks/concrete_'+flashColors[a.variables.kg_diag_state]);
 }
 for(const first of [false,true])for(const hand of ['main','off']){
  if(first&&hand==='main')continue;
  for(const stage of [0,1,2]){
   const state=Object.freeze({kg_diag_main:0,kg_diag_state:3,kg_diag_clock_bucket:2,kg_bite_stage:stage});
   assert.equal(flashTexture(state),markerAttachable(trace164Id).textures['stage'+stage]);
  }
 }
});
test('ONE local countdown observer actual RC supports every bucket without attachable context or state writes',()=>{
 for(let bucket=0;bucket<6;bucket++){
  const state=Object.freeze({kg_diag_main:1,kg_diag_state:3,kg_diag_clock_bucket:bucket});
  assert.equal(flashTexture(state),'textures/blocks/concrete_'+clockColors[bucket]);
 }
});


test('ONE local terminal edge hides the observed cache-positive stale model even when owner elapsed is below the server window',()=>{
 const state={};
 const active=localClockFrame(state,{using:true,nativeRemaining:1,nativeMaximum:90,tick:80});
 assert.equal(active.visibility[markerController]['*'],true);
 const stopped=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:80});
 // Regression assertion first: actual169 JSON remains visible here. The local
 // native query and owner elapsed are explicit independent client inputs.
 assert.equal(stopped.visibility[markerController]['*'],false,'same owned native-use falling edge hides the stale full model');
 assert.equal(stopped.variables.kg_terminal_wait,false,'server elapsed is deliberately too early');
 assert.equal(stopped.variables.kg_local_terminal,1);
 assert.equal(stopped.texture,'textures/blocks/concrete_blue','original observation classifier is not changed to manufacture success');
 for(let frame=0;frame<3;frame++){
  const held=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:80});
  assert.equal(held.visibility[markerController]['*'],false);
  assert.ok(!held.clips.some(x=>x.startsWith('animation.kg_java_eating.')),'no arm/helper/pose extension');
 }
 const cleared=localClockFrame(state,{using:false,profile:0,ownerHand:0,projection:false,duration:0,nativeRemaining:0,nativeMaximum:0});
 assert.equal(cleared.visibility[markerController]['*'],true);assert.equal(cleared.variables.kg_local_terminal,0);
});
test('ONE local terminal edge requires an observed valid owned use and never treats absent cache as zero',()=>{
 for(const state of [{},{kg_diag_clock_seen:1,kg_diag_clock_last:1,kg_diag_clock_last_max:90}]){
  const view=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:80});
  assert.equal(view.visibility[markerController]['*'],true,'without observed previous using frame a cached numeric value cannot arm');
  assert.equal(view.variables.kg_local_terminal,0);
 }
 for(const bad of [{nativeRemaining:0},{nativeRemaining:-1},{nativeRemaining:91},{nativeMaximum:0},{nativeMaximum:89},{oppositeOccupied:true},{sneaking:true}]){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1});
  localClockFrame(state,{using:true,nativeRemaining:1,...bad});
  const stop=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:80});
  assert.equal(stop.visibility[markerController]['*'],true,JSON.stringify(bad));assert.equal(stop.variables.kg_local_terminal,0);
 }
});
test('ONE local terminal edge does not mask early release and unlocks an observed owner-clock reset',()=>{
 for(const remaining of [89,70,65,64,2,1.01]){
  const state={};localClockFrame(state,{using:true,nativeRemaining:remaining,tick:10});
  const stop=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:10});
  assert.equal(stop.visibility[markerController]['*'],true);assert.equal(stop.variables.kg_local_terminal,0);
 }
 for(const remaining of [89,0]){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1});
  localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0});
  const next=localClockFrame(state,{using:true,nativeRemaining:remaining,tick:0});
  assert.equal(next.variables.kg_local_terminal,0);assert.equal(next.visibility[markerController]['*'],true);
  const cancel=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0});
  assert.equal(cancel.visibility[markerController]['*'],true,'new observed use cannot inherit previous terminal hold');
 }
 // No observed false frame: the new countdown still overwrites the sample.
 const continuous={};localClockFrame(continuous,{using:true,nativeRemaining:1});localClockFrame(continuous,{using:true,nativeRemaining:89});
 assert.equal(localClockFrame(continuous,{using:false,nativeRemaining:0,nativeMaximum:0}).visibility[markerController]['*'],true);
});
test('ONE local terminal edge is main-FP only and clears on observed item owner or duration mismatch',()=>{
 for(const change of [{first:false},{hand:'off',ownerHand:2},{same:false},{profile:2},{ownerHand:2},{projection:false},{duration:100},{duration:0}]){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1});localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0});
  const lost=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,...change});
  assert.equal(lost.variables.kg_local_terminal,0,JSON.stringify(change));
  assert.equal(lost.visibility[markerController]['*'],true);
  assert.equal(localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0}).visibility[markerController]['*'],true,'restored identity does not rearm without a new use edge');
 }
});
test('ONE local terminal edge leaves existing server masking and every other fixed or composite RC route unchanged',()=>{
 for(const [id,profile] of fixedPresentation){
  for(const hand of ['main','off']){
   const state={},options={profile:presentationCodes[profile],hand,duration:profile==='THREE'?100:90,tick:10,state};
   presentation(id,{...options,using:true,nativeRemaining:1});
   const stopped=presentation(id,{...options,using:false,nativeRemaining:0,nativeMaximum:0});
   assert.equal(Object.values(stopped.visibility)[0]['*'],!(id===trace164Id&&hand==='main'),id+' '+hand);
  }
 }
 for(const id of Array.from(compositedPresentation).flatMap(id=>[id,id+'_java_three_alt']))assert.ok(!markerAttachable(id).render_controllers.includes(markerController));
 const server=localClockFrame({}, {using:false,nativeRemaining:0,nativeMaximum:0,tick:88});
 assert.equal(server.variables.kg_local_terminal,0);assert.equal(server.variables.kg_terminal_wait,true);
 assert.equal(server.visibility[markerController]['*'],false,'old server terminal predicate remains active without any local cache');
});
test('ONE local terminal edge releases after failed near-terminal settlement or same-ID identity replacement without inventory writes',async t=>{
 for(const mode of ['failed-settlement','metadata','slot']){
  const lab=await createEatingLab({deferEntityProperties:true});t.after(()=>lab.f.dispose());
  const a=lab.actor(handoffRoute(),'main',2),state={};a.begin();a.advance(88);
  const draw=using=>{const o=handoffProperties(a.p);return localClockFrame(state,{using,profile:o.eat_profile,ownerHand:o.eat_hand,projection:o.eat_projection,duration:o.eat_native_ticks,tick:o.eat_elapsed_ticks,nativeRemaining:using?1:0,nativeMaximum:using?90:0});};
  draw(true);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,87);
  if(mode==='metadata'){const x=a.p.main;x.nameTag='Replacement metadata';a.p.main=x;}
  if(mode==='slot'){a.p.selectedSlotIndex=1;a.p.main=a.stack.clone();}
  const before=lab.inventory(a.p),hunger=a.p.components['minecraft:player.hunger'].currentValue;
  assert.equal(draw(false).visibility[markerController]['*'],false,'same-ID replacement is not visible to these client predicates until reset');
  if(mode==='failed-settlement'){
   lab.f.faults.failNext(a.p.inventory,'setItem');a.event('itemStopUse',2);
  }
  a.advance(2);
  assert.deepEqual(handoffProperties(a.p),clearedHandoff);assert.equal(draw(false).visibility[markerController]['*'],true);
  assert.deepEqual(lab.inventory(a.p),before);assert.equal(a.p.components['minecraft:player.hunger'].currentValue,hunger);
  a.retire();
 }
});
test('ONE local terminal edge releases a fresh continuous serving after replicated reset without double debit',async t=>{
 const lab=await createEatingLab({deferEntityProperties:true});t.after(()=>lab.f.dispose());
 const a=lab.actor(handoffRoute(),'main',2),state={};a.begin();a.advance(89);
 localClockFrame(state,{using:true,nativeRemaining:1,tick:87});
 assert.equal(localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:87}).visibility[markerController]['*'],false);
 a.nativeDebit();a.event('itemCompleteUse',0);a.event('itemStopUse',0);a.begin();
 assert.equal(localClockFrame(state,{using:true,nativeRemaining:89,tick:87}).visibility[markerController]['*'],false,'a fresh serving may be hidden until its delayed owner reset is observed');
 a.advance(1);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,0);
 assert.equal(localClockFrame(state,{using:true,nativeRemaining:88,tick:handoffProperties(a.p).eat_elapsed_ticks}).visibility[markerController]['*'],true);
 assert.equal(state.kg_local_terminal,0);
 a.advance(1);assert.equal(a.p.main.amount,1);assert.equal(handoffProperties(a.p).eat_profile,1);
 assert.equal(handoffProperties(a.p).eat_elapsed_ticks,1);
 a.advance(87);a.nativeDebit();a.event('itemCompleteUse',0);a.advance(2);
 assert.equal(a.p.main,undefined);assert.deepEqual(handoffProperties(a.p),clearedHandoff);a.retire();
});


// Live observer changes only the old source-projection (LIME) texture branch.
const liveColors=['white','black','gray','light_blue','pink','green'];
test('ONE live clock observer separates the two full-model counterexamples from a zero remaining terminal stick',()=>{
 for(const [input,color,stage,seconds] of [
  [{duration:0,nativeMaximum:0,nativeRemaining:0},'black',0,0],
  [{duration:90,nativeMaximum:90,nativeRemaining:89},'green',0,0],
  [{duration:90,nativeMaximum:90,nativeRemaining:0},'light_blue',2,4.45]]){
  const r=localClockFrame({}, {using:true,tick:10,...input});
  assert.equal(Boolean(r.variables.kg_source_projection),true);
  assert.equal(r.variables.kg_diag_state,0);assert.equal(r.texture,'textures/blocks/concrete_'+color);
  assert.equal(r.variables.kg_bite_stage,stage);assert.equal(r.variables.kg_eat_seconds,seconds);
  assert.equal(r.visibility[markerController]['*'],true,'observer does not repair or hide the counterexample');
 }
});
test('ONE live clock observer exhaustively classifies observed duration maximum and remaining ranges',()=>{
 for(const duration of [0,90])for(const nativeMaximum of [0,89,90,100])for(const nativeRemaining of [-1,0,.5,1,1.001,2,89,90,91,101]){
  const r=localClockFrame({}, {using:true,duration,nativeMaximum,nativeRemaining});
  const bucket=duration<=0?1:nativeMaximum!==duration||nativeRemaining<0||nativeRemaining>nativeMaximum?2:nativeRemaining===0?3:nativeRemaining<=1?4:5;
  assert.equal(r.variables.kg_diag_live_bucket,bucket,JSON.stringify({duration,nativeMaximum,nativeRemaining}));
  assert.equal(r.texture,'textures/blocks/concrete_'+liveColors[bucket]);
  assert.equal(r.visibility[markerController]['*'],true);
 }
});
test('ONE live clock observer unknown state stays white and actual RC has no attachable context or writes',()=>{
 for(const state of [{},{kg_diag_main:1,kg_diag_state:0},{kg_diag_main:1,kg_diag_state:0,kg_diag_live_bucket:undefined}]){
  assert.equal(flashTexture(Object.freeze(state)),'textures/blocks/concrete_white');
 }
 for(let bucket=0;bucket<6;bucket++)assert.equal(flashTexture(Object.freeze({kg_diag_main:1,kg_diag_state:0,kg_diag_live_bucket:bucket})),'textures/blocks/concrete_'+liveColors[bucket]);
});
test('ONE live clock observer recomputes current values without changing stop cache or local hold',()=>{
 const state={};
 const use=localClockFrame(state,{using:true,nativeRemaining:1,nativeMaximum:90,tick:80});
 assert.equal(use.texture,'textures/blocks/concrete_pink');
 const stop=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:80});
 assert.equal(stop.variables.kg_diag_live_bucket,2,'current zero max is invalid, but stopped texture uses the prior cache');
 assert.equal(stop.texture,'textures/blocks/concrete_blue');assert.equal(stop.variables.kg_diag_clock_last,1);
 assert.equal(stop.variables.kg_local_terminal,1);assert.equal(stop.visibility[markerController]['*'],false);
 const next=localClockFrame(state,{using:true,nativeRemaining:89,nativeMaximum:90,tick:0});
 assert.equal(next.texture,'textures/blocks/concrete_green');assert.equal(next.variables.kg_diag_clock_last,89);
 assert.equal(next.variables.kg_local_terminal,0);assert.equal(next.visibility[markerController]['*'],true);
});
test('ONE live clock observer cannot change non-source or nonmain texture branches',()=>{
 for(const bucket of [undefined,0,1,2,3,4,5]){
  for(const phase of [1,2,4,5])assert.equal(flashTexture({kg_diag_main:1,kg_diag_state:phase,kg_diag_live_bucket:bucket}),'textures/blocks/concrete_'+flashColors[phase]);
  for(let old=0;old<6;old++)assert.equal(flashTexture({kg_diag_main:1,kg_diag_state:3,kg_diag_clock_bucket:old,kg_diag_live_bucket:bucket}),'textures/blocks/concrete_'+clockColors[old]);
  for(let stage=0;stage<5;stage++)assert.equal(flashTexture({kg_diag_main:0,kg_diag_state:0,kg_diag_live_bucket:bucket,kg_bite_stage:stage}),markerAttachable(trace164Id).textures['stage'+stage]);
 }
});


test('ONE owned handoff retains an already armed hold across native-use rebound without an owner-clock reset',()=>{
 for(const elapsed of [87,88,90]){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1,tick:87});
  localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:87});
  const rebound=localClockFrame(state,{using:true,nativeRemaining:89,nativeMaximum:90,tick:elapsed});
  // Actual171 is visible GREEN here: this is an observable RC counterfactual.
  assert.equal(rebound.visibility[markerController]['*'],false,'native query rebound alone is not owner-session reset evidence');
  assert.equal(rebound.texture,'textures/blocks/concrete_green');assert.equal(rebound.variables.kg_bite_stage,0);
  assert.equal(rebound.variables.kg_eat_seconds,0);assert.equal(rebound.variables.kg_diag_clock_last,89);
  assert.equal(rebound.variables.kg_local_terminal,1);assert.equal(rebound.variables.kg_local_owner_elapsed,87);
  assert.equal(rebound.variables.kg_local_owner_duration,90);
  const stoppedAgain=localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:elapsed});
  assert.equal(stoppedAgain.variables.kg_local_terminal,1,'an existing eligible hold also survives a second stopped frame after rebound');
  assert.equal(stoppedAgain.visibility[markerController]['*'],false);
 }
});
test('ONE owned handoff waits through delayed reset then releases on observed elapsed regression',()=>{
 for(const reset of [0,1,86]){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1,tick:87});
  localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:87});
  for(const tick of [87,88,90])assert.equal(localClockFrame(state,{using:true,nativeRemaining:89,tick}).visibility[markerController]['*'],false);
  const restarted=localClockFrame(state,{using:true,nativeRemaining:88,tick:reset});
  assert.equal(restarted.variables.kg_local_terminal,0);assert.equal(restarted.visibility[markerController]['*'],true);
  assert.equal(localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:reset+1}).visibility[markerController]['*'],true,'early cancel of the fresh sample does not inherit terminal status');
 }
});
test('ONE owned handoff cannot infer a terminal session without a sampled stop edge or valid last sample',()=>{
 for(const prior of [undefined,0,2,89]){
  const state={};if(prior!==undefined)localClockFrame(state,{using:true,nativeRemaining:prior,tick:87});
  if(prior!==undefined)localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:87});
  const next=localClockFrame(state,{using:true,nativeRemaining:89,tick:87});
  assert.equal(next.variables.kg_local_terminal,0);assert.equal(next.visibility[markerController]['*'],true);
 }
 const noEdge={};localClockFrame(noEdge,{using:true,nativeRemaining:1,tick:87});
 assert.equal(localClockFrame(noEdge,{using:true,nativeRemaining:89,tick:87}).visibility[markerController]['*'],true,'remaining rebound never creates a new hold');
});
test('ONE owned handoff binds duration and context independently of the overwritten native cache',()=>{
 for(const change of [{duration:100,nativeMaximum:100},{duration:0,nativeMaximum:0},{same:false},{profile:2},{ownerHand:2},{projection:false},{first:false},{hand:'off',ownerHand:2}]){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1,tick:87});localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:87});
  const changed=localClockFrame(state,{using:true,nativeRemaining:89,tick:87,...change});
  assert.equal(changed.variables.kg_local_terminal,0,JSON.stringify(change));assert.equal(changed.visibility[markerController]['*'],true);
 }
});
test('ONE owned handoff falls back to prior behavior for zero invalid or missing anchors and invalid rebound samples',()=>{
 for(const anchor of [0,-1,91]){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1,tick:anchor});
  localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:anchor});
  const rebound=localClockFrame(state,{using:true,nativeRemaining:89,tick:anchor});
  assert.equal(rebound.variables.kg_local_terminal,0);assert.equal(rebound.visibility[markerController]['*'],true,'an unusable anchor cannot extend masking into resumed native use');
 }
 for(const missing of ['kg_local_owner_elapsed','kg_local_owner_duration']){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1,tick:87});localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:87});
  delete state[missing];assert.equal(localClockFrame(state,{using:true,nativeRemaining:89,tick:87}).visibility[markerController]['*'],true);
 }
 for(const input of [{nativeRemaining:0},{nativeMaximum:0},{nativeMaximum:89},{nativeRemaining:91}]){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1,tick:87});localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:87});
  assert.equal(localClockFrame(state,{using:true,nativeRemaining:89,tick:87,...input}).visibility[markerController]['*'],true,'invalid current use retains the old fail-visible branch');
 }
});
test('ONE owned handoff distinguishes source-route fallback from actual owner-context loss',()=>{
 for(const gate of ['oppositeOccupied','sneaking','swimming','gliding','riding']){
  const state={};localClockFrame(state,{using:true,nativeRemaining:1,tick:87});localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:87});
  const fallback=localClockFrame(state,{using:true,nativeRemaining:89,tick:87,[gate]:true});
  assert.equal(Boolean(fallback.variables.kg_source_projection),false);
  assert.equal(fallback.texture,'textures/blocks/concrete_orange');
  assert.equal(fallback.variables.kg_local_terminal,0);assert.equal(fallback.visibility[markerController]['*'],true,'using source fallback must not inherit the new retention extension');
  assert.equal(localClockFrame(state,{using:true,nativeRemaining:89,tick:87}).visibility[markerController]['*'],true);
  assert.equal(localClockFrame(state,{using:false,nativeRemaining:0,nativeMaximum:0,tick:87}).variables.kg_local_terminal,0,'return from fallback without a valid terminal edge cannot rearm');
  assert.equal(localClockFrame(state,{using:false,projection:false,tick:87}).visibility[markerController]['*'],true);
 }
});
test('ONE owned handoff retires a same-ID early-cancelled second serving before reset publication without another debit',async t=>{
 const lab=await createEatingLab({deferEntityProperties:true});t.after(()=>lab.f.dispose());
 const a=lab.actor(handoffRoute(),'main',2),state={};a.begin();a.advance(89);
 const draw=(using,remaining)=>{const o=handoffProperties(a.p);return localClockFrame(state,{using,profile:o.eat_profile,ownerHand:o.eat_hand,projection:o.eat_projection,duration:o.eat_native_ticks,tick:o.eat_elapsed_ticks,nativeRemaining:remaining,nativeMaximum:90});};
 draw(true,1);assert.equal(draw(false,0).visibility[markerController]['*'],false);
 a.nativeDebit();a.event('itemCompleteUse',0);a.event('itemStopUse',0);
 // Separate the previous completion tick from this new release: the unchanged
 // BP intentionally ignores same-tick StopUse after SETTLED, which cannot
 // identify an old stop versus a new-session stop without a native session ID.
 a.advance(1);a.begin();
 assert.equal(a.p.main.amount,1);assert.equal(handoffProperties(a.p).eat_elapsed_ticks,90);
 const before=lab.inventory(a.p),hunger=a.p.components['minecraft:player.hunger'].currentValue;
 assert.equal(draw(true,89).visibility[markerController]['*'],false,'second start reset has not published yet');
 a.event('itemStopUse',89);
 assert.equal(handoffProperties(a.p).eat_profile,1,'property retirement is deferred, not a synchronous client guarantee');
 a.advance(2);
 assert.deepEqual(handoffProperties(a.p),clearedHandoff);
 assert.equal(draw(false,0).visibility[markerController]['*'],true);
 assert.equal(state.kg_local_terminal,0);assert.equal(a.p.main.amount,1);
 assert.deepEqual(lab.inventory(a.p),before);assert.equal(a.p.components['minecraft:player.hunger'].currentValue,hunger);a.retire();
});
