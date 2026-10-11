import {isPendingSeasoningId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2743_seasoning_contract_core.js';
import {forgetNumbVisual} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/numb_visual_runtime.js';
import {isPlainEatingId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
/** Production subscribers/settlement with API doubles; native proof is a separate recording. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as presentation from '../../projects/grilling/gameplay_core/behavior_pack/scripts/player_presentation_core.js';
import {captureEatingIdentity,eatingEventMatches,eatingStillCurrent,commitEating} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_eating_transaction.js';
import {finishedFoodMeta} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food_finish_core.js';
import {FOOD_DATA,PROFILE_BY_ITEM,COOKED_EFFECTS,RAW_NAUSEA,MYSTERIOUS_ID,DARK_ID} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_data_lookup.js';
import {seasoningEffectCounts} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2743_seasoning_contract_core.js';
import {replaceSeasoningData} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/seasoning_registry_core.js';
import {canonicalFoodId,RANDOM_EATING_IDS,isAlternateEatingId,eatingItemId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {supportsJavaEatingProjection,JAVA_FP_EATING_ITEMS_BY_PROFILE} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_projection_items.js';
const eatingItemSource=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_item_runtime.js',import.meta.url),'utf8');
const selectedProfileSource=eatingItemSource.match(/export function selectedEatingProfile[^\n]+/)[0].replace(/^export /,'');

const source=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/main.js',import.meta.url),'utf8');
const begin=source.indexOf('world.afterEvents.itemStartUse.subscribe(e=>{');
const end=source.indexOf('// Native use poses cancel',begin);
const settleBegin=source.indexOf('function hungerSettle('),settleEnd=source.indexOf('function resolvedProfile(',settleBegin);
assert.ok(begin>=0&&end>begin&&settleBegin>=0&&settleEnd>settleBegin);
const id='kaleidoscope_grilling:grilled_beef_skewer';
class Stack{
 constructor(amount=2){this.typeId=id;this.amount=amount;this.nameTag='Same native serving';this.props={marker:'retained'};this.lore=['foreign lore'];}
 clone(){return Object.assign(new Stack(this.amount),structuredClone({...this}));}
 getLore(){return [...this.lore]}
 getRawLore(){return this.lore.map(text=>({text}))}
 getDynamicPropertyIds(){return Object.keys(this.props)}
 getDynamicProperty(key){return this.props[key]}
}
function fixture({creative=false,duration=90,profile='FOUR',requested,hand='main',start=100,mealId=duration===100?'kaleidoscope_grilling:grilled_ender_pearl_skewer':id,helperEmpty=false,amount=2,realEffects=false,hot=false,hotUntil=1000,seasonings=['salt'],saturationMultiplier=1}={}){
 const callbacks={},queue=[],effects=[],properties=new Map(),nutrition={hunger:10,saturation:2};
 const counts={nativeDebits:0,manualWrites:0,nativeRewards:0,manualRewards:0};
 const state={stack:new Stack(amount),other:new Stack(1),creative};state.stack.typeId=mealId;
 state.other.typeId='minecraft:torch';state.other.nameTag='Keep opposite equipment';state.other.props={foreign:'unchanged'};
 const hunger={effectiveMax:20,get currentValue(){return nutrition.hunger},setCurrentValue(n){nutrition.hunger=n}};
 const saturation={effectiveMax:20,get currentValue(){return nutrition.saturation},setCurrentValue(n){nutrition.saturation=n}};
 const bag={setItem(_slot,stack){counts.manualWrites++;state.stack=stack?.clone()}};
 const equipment={setEquipment(_slot,stack){counts.manualWrites++;state.stack=stack?.clone();return true}};
 if(helperEmpty)state.other=undefined;
 const animations=[],nativeEffects=new Map(),customEffects={};
 const player={id:'native-holder',selectedSlotIndex:3,setProperty:(key,value)=>properties.set(key,value),playAnimation:(...args)=>animations.push(args),playSound(){return 1},getEffects:()=>[...nativeEffects.values()],removeEffect:name=>nativeEffects.delete(name),addEffect:(name,ticks,options)=>{effects.push(structuredClone([name,ticks,options]));nativeEffects.set(name,{typeId:name,duration:ticks,amplifier:options?.amplifier??0})},getComponent:type=>type.endsWith('hunger')?hunger:type.endsWith('saturation')?saturation:type.endsWith('equippable')?equipment:undefined};
 const ctx={isPendingSeasoningId,isPlainEatingId,canonicalFoodId,RANDOM_EATING_IDS,isAlternateEatingId,supportsJavaEatingProjection,forgetEatingItem(){},prepareEatingItems(){},...presentation,world:{afterEvents:Object.fromEntries(['itemStartUse','itemCompleteUse','itemStopUse'].map(name=>[name,{subscribe:fn=>callbacks[name]=fn}]))},system:{currentTick:start,run:fn=>queue.push(fn)},ACTIVE_EATS:new Map(),SETTLED:new Map(),PLATE_EATS:new Map(),PENDING_USES:new Map(),CUISINE_EATS:new Map(),CUISINE_FOOD_SET:new Set(),FOOD_DATA,PROFILE_BY_ITEM:{...PROFILE_BY_ITEM},PENDING_SEASONING:'pending',PLATE_ID:'plate',SECRET_ID:'kaleidoscope_grilling:secret_skewer',MYSTERIOUS_ID,DARK_ID,RAW_NAUSEA,captureEatingIdentity,eatingEventMatches,eatingStillCurrent,commitEating,finishedFoodMeta,
  EquipmentSlot:{Offhand:'off'},now:()=>ctx.system.currentTick,captureInteractionIntent:()=>({hand}),syncSecretHeld(){},resolvedProfile:presentation.eatingProfile.bind(null),nativeSnapshot:()=>Object.fromEntries(nativeEffects),fxSnapshot:()=>structuredClone(customEffects),stackMeta:()=>({hot,seasonings,hotUntil:hot?hotUntil:0}),heldByHand:(_player,selectedHand)=>selectedHand===hand?state.stack?.clone():state.other?.clone(),copyOne:stack=>{const one=stack.clone();one.amount=1;return one},mainContainer:()=>bag,creative:()=>state.creative,grillingConfig:()=>({saturationMultiplier}),advanceBites(){},dangerousPreservation(){},stopSoundHandle(){},stopEatSound(){},soundFor:()=>'',secretRemainders(){},afterCommitted(_player,_id,_meta,_active,fullNative){counts[fullNative?'nativeRewards':'manualRewards']++}};
 // Production resolvedProfile returns a string, while the imported selector
 // returns its validated descriptor. Keep the real selector and source shape.
 if(requested)ctx.PROFILE_BY_ITEM[canonicalFoodId(mealId)]=requested;
 // Bind the actual production selector, including the captured native duration.
 const selectorBegin=source.indexOf('function resolvedProfile('),selectorEnd=source.indexOf('function writeUseHand(',selectorBegin);
 const soundBegin=source.indexOf('function startEatingSound('),soundEnd=source.indexOf('function spawnBiteCrumbs(',soundBegin);
 vm.runInNewContext(selectedProfileSource+'\n'+source.slice(soundBegin,soundEnd)+'\n'+source.slice(selectorBegin,selectorEnd),ctx);
 const constants=source.match(/const MINIMUM_EAT_TICKS=\d+,RELEASE_CHECKPOINT_GRACE_TICKS=\d+;/)[0]+'\n'+source.match(/const BITE_TIMES=Object.freeze\(\{[\s\S]*?\}\);/)[0];
 vm.runInNewContext(constants+'\n'+source.slice(settleBegin,settleEnd)+'\n'+source.slice(begin,end),ctx);
 if(realEffects){
  Object.assign(ctx,{COOKED_EFFECTS,seasoningEffectCounts,fxSet:(_player,key,ticks,amp=0)=>{effects.push([key,ticks]);customEffects[key]={until:ctx.system.currentTick+ticks,amp}},fxGet:(_player,key)=>customEffects[key],readFx:()=>customEffects,writeFx(){},nativeDragonHealth(){},awardMetalToleranceFailed(){},awardEatItHot(){},awardMentalPreparationFailed(){},goldenSkewerFeedback(){},applyOrdinary(){}});
  const fixedBegin=source.indexOf('function applyFixedEffect('),fixedEnd=source.indexOf('function counts(',fixedBegin);
  const committedBegin=source.indexOf('function afterCommitted('),committedEnd=source.indexOf('function stackMeta(',committedBegin);
  const countCommitted=ctx.afterCommitted;
  const doubleBegin=source.indexOf('function doubleNewNative('),seasoningEnd=source.indexOf('function dangerousPreservation(',fixedEnd);
  vm.runInNewContext(source.slice(doubleBegin,seasoningEnd)+'\n'+source.slice(committedBegin,committedEnd),ctx);
  const productionCommitted=ctx.afterCommitted;
  ctx.afterCommitted=(...args)=>{countCommitted(...args);ctx.effectFinishTick=ctx.system.currentTick;productionCommitted(...args)};
 }
 let event;
 function startUse(){event={source:player,itemStack:state.stack.clone(),useDuration:duration};callbacks.itemStartUse(event);return ctx.ACTIVE_EATS.get(player.id);}
 function complete({tick=start+duration-1,remaining=0,nativeDebit=false,stack=event.itemStack}={}){
  ctx.system.currentTick=tick;
  if(nativeDebit){counts.nativeDebits++;if(!creative){state.stack=state.stack.amount>1?state.stack.clone():undefined;if(state.stack)state.stack.amount--;}const food=FOOD_DATA[mealId];nutrition.hunger=Math.min(20,nutrition.hunger+food.nutrition);nutrition.saturation=Math.min(nutrition.hunger,nutrition.saturation+food.nutrition*food.saturation*2);}
  callbacks.itemCompleteUse({source:player,itemStack:stack,useDuration:remaining});
 }
 function stop({tick=ctx.system.currentTick,remaining=0,stack=event.itemStack}={}){ctx.system.currentTick=tick;callbacks.itemStopUse({source:player,itemStack:stack,useDuration:remaining})}
 function flush(tick=ctx.system.currentTick+1){ctx.system.currentTick=tick;while(queue.length)queue.shift()()}
 function tickPresentation(tick){
  ctx.system.currentTick=tick;ctx.tickPlayer=player;
  const tickBegin=source.indexOf('const active=ACTIVE_EATS.get(p.id);'),tickEnd=source.indexOf('if(system.currentTick%10',tickBegin);
  assert.ok(tickBegin>=0&&tickEnd>tickBegin);
  vm.runInNewContext('(()=>{const p=tickPlayer;'+source.slice(tickBegin,tickEnd)+'})();',ctx);
 }
 return {ctx,state,counts,properties,nutrition,animations,effects,nativeEffects,customEffects,player,startUse,complete,stop,flush,tickPresentation,get event(){return event}};
}

test('inclusive native boundary requires terminal zero and valid nonnegative ticks',()=>{
 for(const duration of [90,100]){
  assert.equal(presentation.nativeEatingCompleted(100,100+duration-2,duration,0),false);
  assert.equal(presentation.nativeEatingCompleted(100,100+duration-1,duration,0),true);
  assert.equal(presentation.nativeEatingCompleted(100,100+duration,duration,0),true);
  for(const remaining of [1,-1,undefined,NaN,'0'])assert.equal(presentation.nativeEatingCompleted(100,100+duration,duration,remaining),false);
 }
 for(const args of [[100,99,90,0],[-1,89,90,0],[NaN,100,90,0],[100,189.5,90,0],[100,190,0,0],[100,190,90.5,0]])assert.equal(presentation.nativeEatingCompleted(...args),false);
});
for(const duration of [90,100])for(const delta of [duration-1,duration])test(`production start/complete accepts native ${duration} at delta${delta}`,()=>{
 const f=fixture({duration,profile:duration===100?'THREE':'FOUR'}),a=f.startUse();
 assert.equal(a.start,100);assert.equal(a.nativeDuration,duration);
 f.complete({tick:100+delta,remaining:0});assert.equal(f.counts.nativeRewards,1);assert.equal(f.ctx.ACTIVE_EATS.size,0);
 for(const key of [presentation.EAT_PROFILE_PROPERTY,presentation.EAT_HAND_PROPERTY,presentation.EAT_NATIVE_TICKS_PROPERTY,presentation.EAT_ELAPSED_TICKS_PROPERTY])assert.equal(f.properties.get(key),0);
 assert.equal(f.properties.get(presentation.EAT_PROJECTION_PROPERTY),false);
});
for(const order of ['complete-first','stop-first'])for(const creative of [false,true])test(`inclusive completion ${order} Creative=${creative} does not debit/reward twice`,()=>{
 const f=fixture({creative});f.startUse();
 if(order==='stop-first')f.stop({tick:189});
 f.complete({tick:189,nativeDebit:true});if(order==='complete-first')f.stop({tick:189});f.flush();
 assert.deepEqual(f.counts,{nativeDebits:1,manualWrites:0,nativeRewards:1,manualRewards:0});
 assert.equal(f.state.stack.amount,creative?2:1);assert.equal(f.nutrition.hunger,15);
 assert.equal(f.state.stack.nameTag,'Same native serving');assert.deepEqual(f.state.stack.props,{marker:'retained'});assert.deepEqual(f.state.stack.lore,['foreign lore']);
 f.complete({tick:190});assert.equal(f.counts.nativeRewards,1);
});
test('early, nonterminal, negative and changed-metadata completion cannot reward current serving',()=>{
 for(const scenario of [{tick:188},{tick:189,remaining:1},{tick:99},{tick:189,remaining:-1}]){
  const f=fixture(),a=f.startUse();f.complete(scenario);assert.equal(f.counts.nativeRewards,0);assert.equal(f.ctx.ACTIVE_EATS.get('native-holder'),a);
 }
 for(const mutate of [s=>s.nameTag='replacement',s=>s.props.marker='changed',s=>s.amount--,s=>s.typeId='minecraft:apple']){
  const f=fixture(),a=f.startUse(),stale=f.event.itemStack.clone();mutate(stale);f.complete({stack:stale});assert.equal(f.counts.nativeRewards,0);assert.equal(f.ctx.ACTIVE_EATS.get('native-holder'),a);
 }
});
test('old stop callback and terminal event cannot remove next-tick auto-repeat',()=>{
 const f=fixture();f.startUse();const previous=f.event.itemStack.clone();f.stop({tick:189});f.complete({tick:189,nativeDebit:true});
 f.ctx.system.currentTick=190;const next=f.startUse();f.flush(190);
 assert.equal(f.ctx.ACTIVE_EATS.get('native-holder'),next);assert.equal(next.start,190);
 f.complete({tick:190,stack:previous});assert.equal(f.ctx.ACTIVE_EATS.get('native-holder'),next);
 assert.deepEqual(f.counts,{nativeDebits:1,manualWrites:0,nativeRewards:1,manualRewards:0});
 assert.equal(f.properties.get(presentation.EAT_NATIVE_TICKS_PROPERTY),90);
});
for(const delta of [23,24,25])test(`real hungerSettle production body retains release${delta} eligibility`,()=>{
 const f=fixture();f.startUse();f.stop({tick:100+delta,remaining:90-delta});f.flush();
 assert.deepEqual(f.counts,{nativeDebits:0,manualWrites:delta>=24?1:0,nativeRewards:0,manualRewards:delta>=24?1:0});
 assert.equal(f.state.stack.amount,delta>=24?1:2);assert.equal(f.nutrition.hunger,delta>=24?15:10);
 f.complete({tick:190});assert.equal(f.counts.nativeRewards,0);
});

// Match the captured-cap native attribute model already used by the G116 plate
// regression. Each new component view captures the hunger at that query.
function capturedSaturation(f,{maximum=20,failure}={}){
 const get=f.player.getComponent.bind(f.player);let rejectWrite=failure==='write';
 f.player.getComponent=type=>{
  if(!type.endsWith('saturation'))return get(type);
  if(f.nutrition.hunger===15&&failure==='missing')return undefined;
  if(f.nutrition.hunger===15&&failure==='read')throw Error('Current saturation unavailable');
  const cap=Math.min(maximum,f.nutrition.hunger);
  return {effectiveMax:cap,get currentValue(){return f.nutrition.saturation},setCurrentValue(value){
   if(!Number.isFinite(value)||value>cap)throw Error('Native saturation bounds');
   f.nutrition.saturation=Math.fround(value);
   if(rejectWrite&&f.nutrition.hunger===15){rejectWrite=false;throw Error('After saturation write');}
  }};
 };
}
test('handheld early release refreshes captured saturation bounds and respects the current cap',()=>{
 for(const [initial,maximum,expected] of [[2,20,8],[10,20,15],[10,12,12]]){
  const f=fixture({realEffects:true});f.nutrition.saturation=initial;capturedSaturation(f,{maximum});
  const before=f.state.stack.clone();f.startUse();f.stop({tick:125,remaining:65});f.flush();
  assert.equal(f.nutrition.hunger,15);assert.equal(f.nutrition.saturation,expected);
  const remaining=before.clone();remaining.amount--;assert.deepEqual(f.state.stack,remaining);
  assert.equal(f.counts.manualWrites,1);assert.equal(f.counts.manualRewards,1);assert.equal(f.nativeEffects.get('strength').duration,200);
  f.stop({tick:125,remaining:65});f.complete({tick:190});f.flush();
  assert.equal(f.counts.manualWrites,1);assert.equal(f.counts.manualRewards,1);assert.equal(f.counts.nativeRewards,0);
 }
});
test('failed handheld saturation refresh or write restores the exact serving and nutrition',()=>{
 for(const failure of ['missing','read','write']){
  const f=fixture({realEffects:true});f.nutrition.saturation=10;capturedSaturation(f,{failure});
  const before=f.state.stack.clone();f.startUse();f.stop({tick:125,remaining:65});f.flush();
  assert.deepEqual(f.state.stack,before);assert.deepEqual(f.nutrition,{hunger:10,saturation:10});
  assert.equal(f.counts.manualRewards,0);assert.deepEqual(f.effects,[]);
 }
});

test('THREE_RANDOM production start follows its captured native duration without changing either stack',()=>{
 for(const duration of [90,100]){
  const mealId=eatingItemId('kaleidoscope_grilling:grilled_gluten_skewer',duration===90);
  const f=fixture({duration,mealId,requested:'THREE_RANDOM'}),before=f.state.stack.clone(),a=f.startUse();
  assert.equal(a.profile,duration===100?'THREE':'THREE_ALT');
  assert.equal(presentation.eatingProfile(a.profile).duration,a.nativeDuration);
  assert.equal(f.properties.get(presentation.EAT_PROFILE_PROPERTY),duration===100?3:4);
  assert.deepEqual(f.state.stack,before);
  assert.deepEqual(f.event.itemStack,before);
  f.complete({nativeDebit:true});f.stop();f.flush();
  assert.deepEqual(f.counts,{nativeDebits:1,manualWrites:0,nativeRewards:1,manualRewards:0});
 }
});

test('native duration alignment preserves explicit profiles and unbound Java random selection',()=>{
 for(const random of [0,.49,.5,.99])for(const ticks of [90,100]){
  const selected=presentation.eatingProfile('THREE_RANDOM',random,ticks);
  assert.equal(selected.duration,ticks);
  assert.equal(selected.profile,ticks===100?'THREE':'THREE_ALT');
 }
 for(const profile of ['ONE','TWO','THREE','THREE_ALT','FOUR']){
  assert.equal(presentation.eatingProfile(profile,0,100).profile,profile);
 }
 assert.equal(presentation.eatingProfile('THREE_RANDOM',0).profile,'THREE');
 assert.equal(presentation.eatingProfile('THREE_RANDOM',.99).profile,'THREE_ALT');
});

test('production presentation publishes elapsed ticks then masks a changed item or metadata',()=>{
 for(const mutate of [f=>f.state.stack.typeId='minecraft:apple',f=>f.state.stack.props.marker='replacement',f=>f.player.selectedSlotIndex=4]){
  const f=fixture();f.startUse();const other=f.state.other.clone();
  f.tickPresentation(125);assert.equal(f.properties.get(presentation.EAT_ELAPSED_TICKS_PROPERTY),25);
  mutate(f);f.tickPresentation(126);
  for(const key of [presentation.EAT_PROFILE_PROPERTY,presentation.EAT_HAND_PROPERTY,presentation.EAT_NATIVE_TICKS_PROPERTY,presentation.EAT_ELAPSED_TICKS_PROPERTY])assert.equal(f.properties.get(key),0);
  assert.equal(f.properties.get(presentation.EAT_PROJECTION_PROPERTY),false);
  f.stop({tick:126,remaining:64});f.flush();
  assert.equal(f.counts.manualWrites,0);assert.equal(f.counts.manualRewards,0);assert.equal(f.counts.nativeRewards,0);
  assert.deepEqual(f.state.other,other);
 }
});

for(const hand of ['main','off'])test(`release settlement preserves metadata and opposite equipment for ${hand} hand`,()=>{
 const f=fixture({hand}),before=f.state.stack.clone(),other=f.state.other.clone();f.startUse();
 assert.equal(f.properties.get(presentation.EAT_HAND_PROPERTY),hand==='off'?2:1);
 f.stop({tick:124,remaining:66});f.stop({tick:124,remaining:66});f.flush();
 assert.deepEqual(f.counts,{nativeDebits:0,manualWrites:1,nativeRewards:0,manualRewards:1});
 assert.equal(f.state.stack.amount,before.amount-1);
 before.amount--;assert.deepEqual(f.state.stack,before);assert.deepEqual(f.state.other,other);
});

test('measured 14-tick automatic repeat cannot settle a second serving or clear a new session',()=>{
 const f=fixture({start:256800});f.startUse();f.stop({tick:256889});f.complete({tick:256889,nativeDebit:true});
 f.ctx.system.currentTick=256890;const next=f.startUse();f.flush(256890);
 assert.equal(f.ctx.ACTIVE_EATS.get('native-holder'),next);
 f.stop({tick:256904,remaining:76});f.flush();
 assert.deepEqual(f.counts,{nativeDebits:1,manualWrites:0,nativeRewards:1,manualRewards:0});
 assert.equal(f.state.stack.amount,1);
 assert.equal(f.ctx.ACTIVE_EATS.size,0);
});

for(const hand of ['main','off'])for(const [mealId,profile,duration] of [['kaleidoscope_grilling:grilled_fish_skewer','ONE',90],['kaleidoscope_grilling:grilled_ender_pearl_skewer','THREE',100]])test(`representative dual ${profile} ${hand} admits empty helper and preserves occupied helper`,()=>{
 for(const helperEmpty of [false,true]){
  const f=fixture({mealId,profile,duration,hand,helperEmpty}),before=f.state.stack.clone(),other=f.state.other?.clone();
  f.startUse();
  assert.equal(f.properties.get(presentation.EAT_PROJECTION_PROPERTY),helperEmpty);
  const sharedClip=`animation.kg_java_eating.player.${profile.toLowerCase()}.${hand==='off'?'left':'right'}`;
  const selectedClip=mealId==='kaleidoscope_grilling:grilled_ender_pearl_skewer'&&profile==='THREE'&&hand==='main'
   ?'animation.kg_isolated_two_route_v1.player.pearl_three.right':sharedClip;
  assert.equal(f.animations.some(([name])=>name===selectedClip),helperEmpty);
  if(selectedClip!==sharedClip)assert.equal(f.animations.some(([name])=>name===sharedClip),false);
  assert.equal(f.counts.manualWrites,0);assert.deepEqual(f.state.stack,before);assert.deepEqual(f.state.other,other);
  f.complete({nativeDebit:true});f.stop();f.flush();
  assert.deepEqual(f.counts,{nativeDebits:1,manualWrites:0,nativeRewards:1,manualRewards:0});
  before.amount--;assert.deepEqual(f.state.stack,before);assert.deepEqual(f.state.other,other);
 }
});

// The original released Java JAR settles a whole serving after the 25-tick
// checkpoint (release-only grace at 24); these recorded stops are eligible.
for(const row of [
 {mealId:'kaleidoscope_grilling:grilled_fish_skewer',profile:'ONE',duration:90,amount:1,start:390947,stop:390982,remaining:55,flush:390984,nutrition:6,saturation:.45,effect:'tundra_strider'},
 {mealId:'kaleidoscope_grilling:grilled_ender_pearl_skewer',profile:'THREE',duration:100,amount:2,start:393804,stop:393840,remaining:64,flush:393842,nutrition:4,saturation:.1,effect:'projectile_dodge'}
])for(const hand of ['main','off'])test(`released Java checkpoint settlement ${row.profile} remaining${row.remaining} ${hand} consumes one and grants full food/effect once`,()=>{
 const f=fixture({...row,hand,realEffects:true}),before=f.state.stack.clone(),other=f.state.other.clone();
 assert.deepEqual(FOOD_DATA[row.mealId],{nutrition:row.nutrition,saturation:row.saturation});
 f.startUse();f.stop({tick:row.stop,remaining:row.remaining});f.stop({tick:row.stop,remaining:row.remaining});
 const stopped=before.amount>1?before.clone():undefined;if(stopped)stopped.amount--;
 assert.deepEqual(f.state.stack,stopped,'Proven nonterminal release settles in its writable after-event');
 f.flush(row.flush);
 const expected=before.amount>1?before.clone():undefined;if(expected)expected.amount--;
 assert.deepEqual(f.state.stack,expected);assert.deepEqual(f.state.other,other);
 assert.deepEqual(f.counts,{nativeDebits:0,manualWrites:1,nativeRewards:0,manualRewards:1});
 assert.equal(f.nutrition.hunger,10+row.nutrition);
 assert.ok(Math.abs(f.nutrition.saturation-(2+row.nutrition*row.saturation*2))<1e-8);
 assert.deepEqual(f.effects,[[row.effect,600]]);
 assert.equal(f.ctx.SETTLED.size,1);assert.equal(f.ctx.ACTIVE_EATS.size,0);
 assert.equal(f.properties.get(presentation.EAT_PROJECTION_PROPERTY),false);
 f.complete({tick:row.flush+1});f.stop({tick:row.flush+1,remaining:0});f.flush();
 assert.deepEqual(f.counts,{nativeDebits:0,manualWrites:1,nativeRewards:0,manualRewards:1});assert.deepEqual(f.effects,[[row.effect,600]]);
});

for(const row of [
 {start:404385,stop:404401,remaining:74,flush:404403,eligible:false},
 {start:404557,stop:404593,remaining:54,flush:404595,eligible:true}
])test(`bounded native beef comparison at elapsed${row.stop-row.start} has expected Java full-serving settlement`,()=>{
 const f=fixture({start:row.start,realEffects:true}),before=f.state.stack.clone(),other=f.state.other.clone();f.nutrition.saturation=0;
 f.startUse();f.stop({tick:row.stop,remaining:row.remaining});f.flush(row.flush);
 if(row.eligible)before.amount--;
 assert.deepEqual(f.state.stack,before);assert.deepEqual(f.state.other,other);
 assert.equal(f.counts.manualWrites,row.eligible?1:0);assert.equal(f.counts.manualRewards,row.eligible?1:0);
 assert.equal(f.nutrition.hunger,row.eligible?15:10);assert.equal(f.nutrition.saturation,row.eligible?6:0);
 assert.deepEqual(f.effects,row.eligible?[['strength',200,{showParticles:true}]]:[]);
});
test('production projection admission agrees with every serialized item/profile blend gate at its JSON duration',()=>{
 const animations=JSON.parse(fs.readFileSync(new URL('../../projects/grilling/gameplay_core/resource_pack/animations/java_eating_player.animation.json',import.meta.url),'utf8')).animations;
 const dedicated=JSON.parse(fs.readFileSync(new URL('../../projects/grilling/gameplay_core/resource_pack/animations/kg_isolated_two_route_player.animation.json',import.meta.url),'utf8')).animations;
 const routes={
  'kaleidoscope_grilling:grilled_bun_slice_skewer':{profile:'TWO',clip:'animation.kg_isolated_two_route_v1.player.bun_two.right'},
  'kaleidoscope_grilling:grilled_ender_pearl_skewer':{profile:'THREE',clip:'animation.kg_isolated_two_route_v1.player.pearl_three.right'}
 };
 assert.deepEqual(Object.keys(dedicated).sort(),Object.values(routes).map(row=>row.clip).sort());
 for(const [declared,items] of Object.entries(JAVA_FP_EATING_ITEMS_BY_PROFILE))for(const mealId of items)for(const hand of ['main','off']){
  const item=JSON.parse(fs.readFileSync(new URL(`../../projects/grilling/gameplay_core/behavior_pack/items/${mealId.split(':')[1]}.json`,import.meta.url),'utf8'))['minecraft:item'];
  const duration=Math.round(item.components['minecraft:use_modifiers'].use_duration*20);
  const f=fixture({mealId,duration,hand,helperEmpty:true}),before=f.state.stack.clone(),a=f.startUse();
  const name=`animation.kg_java_eating.player.${a.profile.toLowerCase()}.${hand==='off'?'left':'right'}`;
  const route=routes[mealId],selectedClip=route&&route.profile===a.profile&&hand==='main'?route.clip:name;
  const q={is_using_item:true,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,is_item_equipped:()=>0,has_property:key=>f.properties.has(key),
   property:key=>f.properties.get(key),is_item_name_any:(slot,...ids)=>slot===(hand==='off'?'slot.weapon.offhand':'slot.weapon.mainhand')&&ids.includes(mealId)};
  // Supply projection=1 to ask whether the client's exact item/profile gate
  // can admit the request, rather than letting a false server flag mask it.
  const clientQuery={...q,property:key=>key===presentation.EAT_PROJECTION_PROPERTY?1:q.property(key)};
  const expected=Boolean(new Function('q','variable','return '+animations[name].blend_weight)(clientQuery,{is_first_person:true}));
  assert.equal(f.properties.get(presentation.EAT_PROJECTION_PROPERTY),expected,`${mealId} ${declared} -> ${a.profile} ${duration}`);
  if(selectedClip!==name){
   assert.equal(Boolean(new Function('q','variable','return '+dedicated[selectedClip].blend_weight)(clientQuery,{is_first_person:true})),expected);
   assert.equal(f.animations.some(([animation])=>animation===name),false);
  }
  assert.equal(f.animations.some(([animation])=>animation===selectedClip),expected);
  assert.equal(supportsJavaEatingProjection(mealId,a.profile),expected);
  assert.deepEqual(f.state.stack,before);assert.equal(f.state.other,undefined);assert.equal(f.counts.manualWrites,0);
 }
 for(const badProfile of ['THREE_RANDOM','toString','constructor','unknown',undefined])assert.equal(supportsJavaEatingProjection(id,badProfile),false);
 assert.equal(supportsJavaEatingProjection('minecraft:apple','FOUR'),false);
 assert.ok(Object.isFrozen(JAVA_FP_EATING_ITEMS_BY_PROFILE));
 for(const items of Object.values(JAVA_FP_EATING_ITEMS_BY_PROFILE))assert.ok(Object.isFrozen(items));
});

for(const [mealId,duration] of [['kaleidoscope_grilling:grilled_fish_skewer',90],['kaleidoscope_grilling:grilled_ender_pearl_skewer',100],['kaleidoscope_grilling:grilled_gluten_skewer',100]])for(const hand of ['main','off'])test(`production elapsed snapshots drive observer bites without owner countdown: ${mealId} ${hand}`,()=>{
 const desc=JSON.parse(fs.readFileSync(new URL(`../../projects/grilling/gameplay_core/resource_pack/attachables/${mealId.split(':')[1]}.attachable.json`,import.meta.url),'utf8'))['minecraft:attachable'].description;
 const f=fixture({mealId,duration,hand,helperEmpty:true}),a=f.startUse(),before=f.state.stack.clone();
 const activeSlot=hand==='off'?'off_hand':'main_hand',c={is_first_person:0,item_slot:activeSlot};
 const math={clamp:(value,lo,hi)=>Math.max(lo,Math.min(hi,value))};
 const evaluate=(remaining,using=true)=>{
  const v={},q={is_using_item:using,main_hand_item_use_duration:remaining,frame_alpha:.5,
   is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,property:key=>f.properties.get(key),
   is_item_name_any:()=>true,is_item_equipped:()=>0};
  new Function('q','c','math','v',desc.scripts.pre_animation.join('\n'))(q,c,math,v);return v;
 };
 const ticks=[0,...a.biteTimes.flatMap(t=>[Math.ceil(t*20)-1,Math.ceil(t*20)]),duration-1];
 for(const elapsed of ticks){
  f.tickPresentation(a.start+elapsed);
  for(const remaining of [0,17,90,100,72000]){
   c.item_slot=activeSlot;const v=evaluate(remaining);
   assert.equal(v.kg_eat_seconds,elapsed/20);assert.equal(v.kg_bite_stage,a.biteTimes.filter(t=>t<=elapsed/20).length);
   assert.equal(Boolean(v.kg_java_piece_visible),false);
   c.item_slot=activeSlot==='main_hand'?'off_hand':'main_hand';assert.equal(evaluate(remaining).kg_bite_stage,0);
  }
 }
 assert.deepEqual(f.state.stack,before);assert.equal(f.counts.manualWrites,0);assert.equal(f.counts.manualRewards,0);
 c.item_slot=activeSlot;assert.equal(evaluate(0,false).kg_bite_stage,0,'Native stopped-use signal closes the bite gate before delayed cleanup');
 f.complete({tick:a.start+duration-1,nativeDebit:true});f.stop();f.flush();
 assert.equal(evaluate(0,false).kg_eat_seconds,0);assert.equal(evaluate(0,false).kg_bite_stage,0);
 assert.deepEqual(f.counts,{nativeDebits:1,manualWrites:0,nativeRewards:1,manualRewards:0});
});

for(const hand of ['main','off'])test(`native final single fish serving completes once and leaves no artificial helper stack: ${hand}`,()=>{
 const f=fixture({mealId:'kaleidoscope_grilling:grilled_fish_skewer',duration:90,amount:1,hand,helperEmpty:true});
 assert.equal(f.state.stack.amount,1);f.startUse();f.stop({tick:189});f.complete({tick:189,nativeDebit:true});f.flush();
 assert.equal(f.state.stack,undefined);assert.equal(f.state.other,undefined);
 assert.deepEqual(f.counts,{nativeDebits:1,manualWrites:0,nativeRewards:1,manualRewards:0});
 f.complete({tick:190});f.stop({tick:190});f.flush();
 assert.equal(f.counts.nativeRewards,1);assert.equal(f.counts.manualWrites,0);
});


// Production subscribers and production fixed/finish effects, covering the
// native-duration variants as actual IDs rather than invented canonical items.
for(const [base,effect] of Object.entries(COOKED_EFFECTS))for(const mealId of new Set([base,eatingItemId(base,true)]))for(const hand of ['main','off'])for(const finish of ['release','native'])test(`full food/effect ${mealId} ${hand} ${finish}`,()=>{
 const item=JSON.parse(fs.readFileSync(new URL(`../../projects/grilling/gameplay_core/behavior_pack/items/${mealId.split(':')[1]}.json`,import.meta.url),'utf8'))['minecraft:item'];
 const duration=Math.round(item.components['minecraft:use_modifiers'].use_duration*20);
 const f=fixture({mealId,duration,hand,realEffects:true}),before=f.state.stack.clone(),other=f.state.other.clone();
 const a=f.startUse();assert.equal(a.id,base);assert.equal(JSON.parse(a.use.identity).id,mealId);
 if(RANDOM_EATING_IDS.has(base))assert.equal(a.profile,isAlternateEatingId(mealId)?'THREE_ALT':'THREE');
 if(finish==='release'){f.stop({tick:124,remaining:duration-24});f.stop({tick:124,remaining:duration-24});const stopped=before.clone();stopped.amount--;assert.deepEqual(f.state.stack,stopped);f.flush();}
 else{f.complete({nativeDebit:true});f.stop();f.flush();}
 before.amount--;assert.deepEqual(f.state.stack,before);assert.deepEqual(f.state.other,other);
 const facts=FOOD_DATA[mealId],hunger=Math.min(20,10+facts.nutrition);
 assert.equal(f.nutrition.hunger,hunger);assert.ok(Math.abs(f.nutrition.saturation-Math.min(hunger,2+facts.nutrition*facts.saturation*2))<1e-8);
 const expected=!effect.effect?[]:effect.effect.startsWith('minecraft:')?[[effect.effect.split(':')[1],effect.seconds*20,{showParticles:true}]]:[[effect.effect.split(':')[1],effect.seconds*20]];
 assert.deepEqual(f.effects,expected);
 const counts=finish==='release'?{nativeDebits:0,manualWrites:1,nativeRewards:0,manualRewards:1}:{nativeDebits:1,manualWrites:0,nativeRewards:1,manualRewards:0};
 assert.deepEqual(f.counts,counts);
 f.complete({tick:202});f.stop({tick:202});f.flush();assert.deepEqual(f.counts,counts);assert.deepEqual(f.effects,expected);
});
for(const [base,name,ticks] of [
 ...Object.entries(RAW_NAUSEA).filter(([,nausea])=>nausea).map(([id])=>[id,'nausea',60]),
 [MYSTERIOUS_ID,'nausea',100],[DARK_ID,'blindness',200]
])for(const mealId of new Set([base,eatingItemId(base,true)]))for(const hand of ['main','off'])for(const finish of ['release','native'])test(`negative food effect ${mealId} ${hand} ${finish}`,()=>{
 const item=JSON.parse(fs.readFileSync(new URL(`../../projects/grilling/gameplay_core/behavior_pack/items/${mealId.split(':')[1]}.json`,import.meta.url),'utf8'))['minecraft:item'];
 const duration=Math.round(item.components['minecraft:use_modifiers'].use_duration*20),f=fixture({mealId,duration,hand,realEffects:true});
 f.startUse();if(finish==='release'){f.stop({tick:125,remaining:duration-25});f.flush();}else{f.complete({nativeDebit:true});f.stop();f.flush();}
 assert.deepEqual(f.effects,[[name,ticks,{showParticles:true}]]);
 f.complete({tick:202});f.stop({tick:202});f.flush();assert.deepEqual(f.effects,[[name,ticks,{showParticles:true}]]);
});


for(const [mealId,effect] of Object.entries(COOKED_EFFECTS))for(const hand of ['main','off'])for(const finish of ['release','native'])test(`hot full fixed-effect duration ${mealId} ${hand} ${finish}`,()=>{
 const item=JSON.parse(fs.readFileSync(new URL(`../../projects/grilling/gameplay_core/behavior_pack/items/${mealId.split(':')[1]}.json`,import.meta.url),'utf8'))['minecraft:item'];
 const duration=Math.round(item.components['minecraft:use_modifiers'].use_duration*20),f=fixture({mealId,duration,hand,realEffects:true,hot:true,seasonings:[],saturationMultiplier:1.25});
 f.startUse();if(finish==='release'){f.stop({tick:125,remaining:duration-25});f.flush();}else{f.complete({nativeDebit:true});f.stop();f.flush();}
 const facts=FOOD_DATA[mealId],hunger=Math.min(20,10+facts.nutrition);assert.equal(f.nutrition.hunger,hunger);assert.ok(Math.abs(f.nutrition.saturation-Math.min(hunger,2+facts.nutrition*facts.saturation*2*1.25))<1e-8);
 if(effect.effect){const name=effect.effect.split(':')[1],ticks=effect.seconds*20*(name==='invincible'?1:2);if(effect.effect.startsWith('minecraft:'))assert.equal(f.nativeEffects.get(name).duration,ticks);else assert.equal(f.customEffects[name].until-f.ctx.effectFinishTick,ticks);}else assert.deepEqual(f.effects,[]);
 const before=structuredClone(f.effects);f.complete({tick:202});f.stop({tick:202});f.flush();assert.deepEqual(f.effects,before);
});
for(const hand of ['main','off'])for(const finish of ['release','native'])test(`hot seasoning applies after fixed doubling with full amplifier/duration ${hand} ${finish}`,()=>{
 const seasonings=[...Array(4).fill('minecraft:redstone'),...Array(4).fill('kaleidoscope_grilling:houttuynia_powder')],f=fixture({hand,realEffects:true,hot:true,seasonings});
 f.startUse();if(finish==='release'){f.stop({tick:125,remaining:65});f.flush();}else{f.complete({nativeDebit:true});f.stop();f.flush();}
 assert.equal(f.nativeEffects.get('strength').duration,400);assert.equal(f.nativeEffects.get('speed').duration,14400);assert.equal(f.nativeEffects.get('speed').amplifier,1);
});
for(const hand of ['main','off'])for(const finish of ['release','native'])test(`heat expiring at finish removes doubling and seasoning ${hand} ${finish}`,()=>{
 const finishTick=finish==='release'?125:189,f=fixture({hand,realEffects:true,hot:true,hotUntil:finishTick,seasonings:['minecraft:redstone'],saturationMultiplier:2});
 f.startUse();if(finish==='release'){f.stop({tick:125,remaining:65});f.flush(126);}else{f.complete({nativeDebit:true});f.stop();f.flush();}
 assert.equal(f.nativeEffects.get('strength').duration,200);assert.equal(f.nativeEffects.has('speed'),false);assert.equal(f.nutrition.saturation,8);
});
for(const order of ['complete-first','stop-first'])for(const hand of ['main','off'])test(`animation-off native 25-tick completion settles once: ${order} ${hand}`,()=>{
 const f=fixture({duration:25,mealId:eatingItemId(id,false,false),hand,realEffects:true});const active=f.startUse();
 assert.equal(active.plain,true);assert.equal(f.animations.length,0);assert.equal(f.properties.get(presentation.EAT_PROFILE_PROPERTY),0);
 if(order==='stop-first')f.stop({tick:124});f.complete({tick:124,nativeDebit:true});if(order==='complete-first')f.stop({tick:124});f.flush();
 assert.equal(f.counts.nativeDebits,1);assert.equal(f.counts.nativeRewards,1);assert.equal(f.counts.manualRewards,0);assert.equal(f.counts.manualWrites,0);assert.equal(f.state.stack.amount,1);
});
for(const elapsed of [1,23,24,25,26])test(`animation-off release ${elapsed} never adds a timer-based debit without native completion`,()=>{
 const f=fixture({duration:25,mealId:eatingItemId(id,false,false)});f.startUse();f.stop({tick:100+elapsed});f.flush();
 assert.equal(f.counts.manualWrites,0);assert.equal(f.counts.nativeRewards,0);assert.equal(f.counts.manualRewards,0);assert.equal(f.state.stack.amount,2);
});

// Actual production stop/leave subscribers with deterministic API/scheduler
// adapters. These tests create no Minecraft or simulated Player entities.
function productionLeave(f){
 const handlers=[];f.ctx.world.afterEvents.playerLeave={subscribe:fn=>handlers.push(fn)};
 Object.assign(f.ctx,{forgetHeavyMetalRescue(playerId){assert.equal(playerId,f.player.id)},VIGOR_LAST:new Map(),SNEAK_LAST:new Map(),THREAD_LAST:new Map(),forgetNumbVisual,forgetDragonHealth(){},forgetProjectileDodge(playerId){assert.equal(playerId,f.player.id)}});
 // Select the actual one-line leave subscriber, without importing unrelated
 // adjacent death/removal subscribers into this eating-only API adapter.
 const first=source.indexOf('world.afterEvents.playerLeave.subscribe(e=>{'),firstEnd=source.indexOf('\n',first);
 const last=source.indexOf('world.afterEvents.playerLeave.subscribe(({playerId})=>{'),lastEnd=source.indexOf('configureSecretVisuals(',last);
 assert.ok(first>=0&&firstEnd>first&&last>=0&&lastEnd>last);
 vm.runInNewContext(source.slice(first,firstEnd)+'\n'+source.slice(last,lastEnd),f.ctx);
 return ()=>{for(const fn of handlers)fn({playerId:f.player.id});};
}
for(const duration of [90,100])for(const hand of ['main','off'])for(const creative of [false,true])for(const elapsed of [24,25])test(`D02 nonterminal stop settles before leave duration=${duration} hand=${hand} creative=${creative} elapsed=${elapsed}`,()=>{
 const f=fixture({duration,hand,creative});const leave=productionLeave(f);f.startUse();
 const opposite=f.state.other.clone();f.stop({tick:100+elapsed,remaining:duration-elapsed});
 assert.equal(f.counts.manualRewards,1,'eligible nonterminal release owns its settlement in this writable after-event');
 assert.equal(f.counts.manualWrites,creative?0:1);assert.equal(f.state.stack.amount,creative?2:1);assert.equal(f.nutrition.hunger,duration===100?14:15); // source catalog: ender=4, beef=5
 leave();f.flush(500);assert.equal(f.counts.manualRewards,1);assert.equal(f.counts.nativeRewards,0);assert.deepEqual(f.state.other,opposite);
});
test('D02 ineligible stop plus leave preserves the serving and nutrition',()=>{
 const f=fixture();const leave=productionLeave(f);f.startUse();f.stop({tick:123,remaining:67});leave();f.flush();
 assert.equal(f.state.stack.amount,2);assert.equal(f.nutrition.hunger,10);assert.equal(f.counts.manualRewards,0);
});
test('D02 terminal or unknown native counters still let actual completion win',()=>{
 for(const remaining of [0,undefined,NaN,-1,1000]){const f=fixture();f.startUse();f.stop({tick:189,remaining});assert.equal(f.counts.manualRewards,0);f.complete({tick:189,nativeDebit:true});f.flush();assert.deepEqual(f.counts,{nativeDebits:1,manualWrites:0,nativeRewards:1,manualRewards:0});}
});
test('D02 immediately settled use cannot consume again through repeated stop or stale completion',()=>{
 const f=fixture();f.startUse();const old=f.event.itemStack.clone();f.stop({tick:125,remaining:65});f.stop({tick:125,remaining:65,stack:old});f.complete({tick:190,stack:old});f.flush();
 assert.equal(f.counts.manualRewards,1);assert.equal(f.counts.manualWrites,1);assert.equal(f.counts.nativeRewards,0);assert.equal(f.state.stack.amount,1);
});
test('D02 identity mismatch rejects immediate settlement without taking a replacement serving',()=>{
 const f=fixture();f.startUse();f.state.stack.nameTag='replacement before stop';f.stop({tick:125,remaining:65});f.flush();
 assert.equal(f.counts.manualRewards,0);assert.equal(f.state.stack.amount,2);assert.equal(f.state.stack.nameTag,'replacement before stop');assert.equal(f.nutrition.hunger,10);
});

test('D02 immediate debit write fault restores food/nutrition and cannot grant effects on retry',()=>{
 const f=fixture({realEffects:true});f.startUse();const before=f.state.stack.clone(),bag=f.ctx.mainContainer(f.player),write=bag.setItem.bind(bag);let once=true;
 bag.setItem=(...args)=>{write(...args);if(once){once=false;throw Error('after write fault');}};
 f.stop({tick:125,remaining:65});f.flush();f.stop({tick:125,remaining:65});f.flush();
 assert.deepEqual(f.state.stack,before);assert.equal(f.nutrition.hunger,10);assert.equal(f.nutrition.saturation,2);assert.equal(f.counts.manualRewards,0);assert.deepEqual(f.effects,[]);
});
test('D02 immediate nutrition fault restores the already debited serving before leave',()=>{
 const f=fixture({realEffects:true});const leave=productionLeave(f);f.startUse();const before=f.state.stack.clone(),h=f.player.getComponent('minecraft:player.hunger'),write=h.setCurrentValue.bind(h);let once=true;
 h.setCurrentValue=n=>{write(n);if(once){once=false;throw Error('after nutrition write fault');}};
 f.stop({tick:125,remaining:65});leave();f.flush();
 assert.deepEqual(f.state.stack,before);assert.equal(f.nutrition.hunger,10);assert.equal(f.nutrition.saturation,2);assert.equal(f.counts.manualRewards,0);assert.deepEqual(f.effects,[]);
});
for(const hand of ['main','off'])test(`D02 heat at stop is authoritative, not the removed extra scheduling tick ${hand}`,()=>{
 const f=fixture({hand,realEffects:true,hot:true,hotUntil:126,seasonings:['minecraft:redstone'],saturationMultiplier:2});f.startUse();f.stop({tick:125,remaining:65});
 assert.equal(f.ctx.effectFinishTick,125);assert.equal(f.nativeEffects.get('strength').duration,400);assert.ok(f.nativeEffects.has('speed'));f.flush(500);assert.equal(f.counts.manualRewards,1);
});

test('stored seasoning ingredients resolve the reloaded mapping through the production effect consumer',()=>{
 const stored=[...Array(4).fill('test:spice'),'kaleidoscope_grilling:houttuynia_powder'],f=fixture({realEffects:true});
 try{
  replaceSeasoningData([{seasoning_effects:[{ingredient:'test:spice',kind:'speed'}]}]);f.ctx.applySeasoning(f.player,stored);
  assert.equal(f.effects[0][0],'speed');assert.equal(f.effects[0][1],7200);assert.equal(f.effects[0][2].amplifier,1);
  f.effects.length=0;replaceSeasoningData([{seasoning_effects:[{ingredient:'test:spice',kind:'numbness'}]}]);f.ctx.applySeasoning(f.player,stored);
  assert.deepEqual(f.effects,[['numb',1800]]);
 }finally{replaceSeasoningData([]);}
});
