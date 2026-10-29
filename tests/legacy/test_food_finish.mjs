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
import {ingredientBehavior,rolledIngredientEffects} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/effect/ingredient_effects.js';
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
 const data=await f.load('itemData.js'),compat=await f.load('secret_compat_core.js'),effects=await f.load('effect/ingredient_effects.js');
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
    assert.equal(done.profile,0);assert.equal(done.clock,0);assert.equal(a.p[hand].amount,1);
    const effects=done.effects,hunger=done.hunger;
    a.event('itemStopUse',0);a.event('itemCompleteUse',0);a.advance(1);
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
        assert.equal(r.profile,0);assert.equal(r.main.amount,2);a.nativeDebit();
      }else{
        if(mode!=='engine-debit-first')a.nativeDebit();
        a.event('itemCompleteUse',0);a.sample('complete');
      }
    }
    a.retire();
  }
  if(process.env.EATING_TIMELINE_DIR)writeFileSync(join(process.env.EATING_TIMELINE_DIR,'beef-terminal.json'),JSON.stringify(lab.rows,null,2));
});

// Exercise callbacks from main.js; a foreign hand view cannot own completion.
test('stale fixed-skewer completions cannot reward replacement hands or slots',async t=>{
  for(const hand of ['main','off'])for(const replacement of ['foreign','metadata',...(hand==='main'?['slot']:[])]){
    const lab=await createEatingLab();t.after(()=>lab.f.dispose());
    const a=lab.actor(routes.find(x=>x.id===beef),hand);a.begin();a.advance(88);
    if(replacement==='slot')a.p.selectedSlotIndex=1;
    const next=replacement==='metadata'?a.stack.clone():lab.f.item('minecraft:stone');
    if(replacement==='metadata')next.nameTag='A different serving';
    a.p[hand]=next;a.advance(1);
    const before=lab.inventory(a.p);
    a.event('itemCompleteUse',0);a.event('itemCompleteUse',0);
    assert.deepEqual(lab.f.effects.filter(e=>e.source===a.p),[],hand+'/'+replacement);
    assert.deepEqual(lab.inventory(a.p),before);
    assert.equal(a.p.components['minecraft:player.hunger'].currentValue,2);
    assert.equal(a.p.getProperty('kaleidoscope_grilling:eat_profile'),0);
  }
});

test('restored hand views recover the active eating presentation without restarting progress',async t=>{
  for(const hand of ['main','off']){
    const lab=await createEatingLab();t.after(()=>lab.f.dispose());
    const a=lab.actor(routes.find(x=>x.id===beef),hand),before=lab.inventory(a.p);a.begin();a.advance(70);
    const projection=a.p.getProperty('kaleidoscope_grilling:eat_projection'),sounds=lab.f.sounds.length;
    a.nativeDebit();a.advance(1);
    assert.equal(a.p[hand].amount,1);
    for(const key of ['eat_profile','eat_hand','eat_native_ticks','eat_elapsed_ticks'])assert.equal(a.p.getProperty('kaleidoscope_grilling:'+key),0);
    a.p[hand]=a.stack;a.advance(1);
    const observed=a.sample('restored-view',true);
    assert.equal(observed.profile,5);assert.equal(observed.handCode,hand==='main'?1:2);assert.equal(observed.nativeTicks,90);assert.equal(observed.clock,72);
    assert.equal(observed.projection,projection);assert.equal(lab.f.sounds.length,sounds,'do not replay the eating sound');
    assert.deepEqual(lab.inventory(a.p),before);assert.equal(observed.hunger,2);assert.equal(observed.saturation,0);assert.equal(observed.effects,0);
    a.advance(18);a.nativeDebit();a.event('itemCompleteUse',0);a.event('itemCompleteUse',0);
    assert.equal(lab.f.effects.filter(e=>e.source===a.p).length,1,'the recovered meal completes once');
    assert.equal(a.p[hand].amount,1);
  }
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

// Preparation scenarios share this domain's real-runtime boundary.
{
const NS='kaleidoscope_grilling:';
const beef=NS+'grilled_beef_skewer';
const lamb=NS+'grilled_lamb_skewer';

test('unchanged idle hands are not inspected again after preparation',async t=>{
 const f=createFixture();t.after(()=>f.dispose());
 const prep=await f.load('eating_item_runtime.js');
 const p=f.player({main:f.item(beef,2)});
 prep.prepareChangedEatingItems(p,false,false);
 assert.equal(p.main.typeId,beef+'_native_plain');
 f.tick(2); // Drain the real API boundary's queued initial/write notifications.
 prep.prepareChangedEatingItems(p,false,false);
 let reads=0;
 const read=p.equipment.getEquipment.bind(p.equipment);
 p.equipment.getEquipment=slot=>{reads++;return read(slot);};
 for(let i=0;i<200;i++)prep.prepareChangedEatingItems(p,false,false);
 assert.equal(reads,0);
});

test('inventory, hotbar and config changes prepare the new hand once and retain metadata',async t=>{
 const f=createFixture();t.after(()=>f.dispose());
 const prep=await f.load('eating_item_runtime.js');
 const p=f.player({main:f.item(beef)});
 prep.prepareChangedEatingItems(p,false,true);
 p.inventory.setItem(1,f.item(beef,3,{nameTag:'Foreign serving',lore:['retain this']}));
 p.selectedSlotIndex=1;f.tick(2);
 prep.prepareChangedEatingItems(p,false,false);
 assert.equal(p.main.typeId,beef+'_native_plain');
 assert.equal(p.main.amount,3);assert.equal(p.main.nameTag,'Foreign serving');assert.deepEqual(p.main.getLore(),['retain this']);
 prep.prepareChangedEatingItems(p,false,true);
 assert.equal(p.main.typeId,beef);assert.equal(p.main.amount,3);
});

test('an inventory change waits while a hand action owns the captured stack',async t=>{
 const f=createFixture();t.after(()=>f.dispose());
 const prep=await f.load('eating_item_runtime.js');
 const p=f.player({main:f.item(beef,2)});
 for(let i=0;i<4;i++){prep.prepareChangedEatingItems(p,true,false);f.tick();}
 assert.equal(p.main.typeId,beef);
 prep.prepareChangedEatingItems(p,false,false);
 assert.equal(p.main.typeId,beef+'_native_plain');assert.equal(p.main.amount,2);
});

test('a direct offhand write is guarded at use, without relying on a missing native event',async t=>{
 const f=createFixture();t.after(()=>f.dispose());await f.load('main.js');
 const config=await f.load('server_config_runtime.js');config.setGrillingConfig('fullHungerEating',true);config.setGrillingConfig('enableEatingAnimations',false);
 const p=f.player();f.tick(3);
 p.off=f.item(lamb,2,{nameTag:'Direct offhand',lore:['foreign lore']});
 const before={source:p,itemStack:p.off.clone(),cancel:false};
 f.emit('world.beforeEvents.itemUse',before);
 assert.equal(before.cancel,true);
 f.tick(2);
 assert.equal(p.off.typeId,lamb+'_native_plain');
 assert.equal(p.off.amount,2);assert.equal(p.off.nameTag,'Direct offhand');assert.deepEqual(p.off.getLore(),['foreign lore']);
 const next={source:p,itemStack:p.off.clone(),cancel:false};f.emit('world.beforeEvents.itemUse',next);
 assert.equal(next.cancel,false);
});
}
