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
 assert.deepEqual(caterpillar.render_controllers,['controller.render.kg_a22.bite','controller.render.kg_java_eating.piece']);
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
  const mainController=id==='kaleidoscope_grilling:grilled_slime_skewer'?'controller.render.kg_slime.frame':'controller.render.kg_a22.bite';
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
  assert.equal(rendered.visibility['controller.render.kg_a22.bite']['*'],true,failedField+' reset failure cannot strand terminal masking');
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
   return presentation(handoffRoute().id,{profile:owner.eat_profile,hand,projection:owner.eat_projection,duration:owner.eat_native_ticks,tick:owner.eat_elapsed_ticks,using}).visibility['controller.render.kg_a22.bite']['*'];
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
