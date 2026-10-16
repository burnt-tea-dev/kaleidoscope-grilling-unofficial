import {admitEatingProjection,selectEatingProjection} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_projection_routes.js';
import {supportsFailureEating,failureEatingAnimation} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_projection.js';
import {isFailureSkewer} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_visual_core.js';
/** Actual production subscribers with API doubles; this is not native visual proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as presentation from '../../projects/grilling/gameplay_core/behavior_pack/scripts/player_presentation_core.js';
import {canonicalFoodId,isPlainEatingId,isAlternateEatingId,RANDOM_EATING_IDS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {FOOD_DATA,PROFILE_BY_ITEM} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_data_lookup.js';
import {captureEatingIdentity,eatingEventMatches} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_eating_transaction.js';
import {supportsJavaEatingProjection} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_projection_items.js';
import {supportsReviewedThree,reviewedThreeAnimation} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/review_three_projection.js';
import {supportsRawOne,rawOneAnimation} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/raw_one_projection.js';
const root=new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/',import.meta.url);
const source=readFileSync(new URL('main.js',root),'utf8');
function slice(from,to){const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const startSource=slice('world.afterEvents.itemStartUse.subscribe(e=>{','world.afterEvents.itemCompleteUse.subscribe(e=>{');
const stopSource=slice('world.afterEvents.itemStopUse.subscribe(e=>{','// Native use poses cancel');
const selectedSource=readFileSync(new URL('eating_item_runtime.js',root),'utf8').match(/export function selectedEatingProfile[^\n]+/)[0].replace(/^export /,'');
const ids=['kaleidoscope_grilling:raw_fish_skewer','kaleidoscope_grilling:raw_caterpillar_skewer'];
function stack(typeId){return {typeId,amount:2,nameTag:'Original serving',getLore:()=>[],getDynamicPropertyIds:()=>[],getDynamicProperty:()=>undefined};}
function fixture({id=ids[0],hand='main',helper=false,duration=90,profile}={}){
 const callbacks={},queue=[],properties=new Map(),animations=[],sounds=[],settlements=[];
 const item=stack(id),other=helper?stack('minecraft:torch'):undefined;
 const player={id:'raw-one-holder',selectedSlotIndex:3,setProperty:(k,v)=>properties.set(k,v),playAnimation:(name,options)=>animations.push({name,options}),getComponent:()=>undefined};
 const ctx={admitEatingProjection,selectEatingProjection,supportsFailureEating,failureEatingAnimation,isFailureSkewer,...presentation,canonicalFoodId,isPlainEatingId,isAlternateEatingId,RANDOM_EATING_IDS,FOOD_DATA,PROFILE_BY_ITEM:{...PROFILE_BY_ITEM},supportsRawOne,rawOneAnimation,supportsReviewedThree,reviewedThreeAnimation,supportsJavaEatingProjection,captureEatingIdentity,eatingEventMatches,
 world:{afterEvents:Object.fromEntries(['itemStartUse','itemStopUse'].map(k=>[k,{subscribe:f=>callbacks[k]=f}]))},system:{currentTick:100,run:f=>queue.push(f)},
 ACTIVE_EATS:new Map(),SETTLED:new Map(),PLATE_EATS:new Map(),PENDING_USES:new Map(),CUISINE_EATS:new Map(),CUISINE_FOOD_SET:new Set(),PLATE_ID:'plate',SECRET_ID:'secret',
 isPendingSeasoningId:()=>false,captureInteractionIntent:()=>({hand}),stackMeta:()=>({hot:false}),syncSecretHeld(){},stopSoundHandle(){},grillingConfig:()=>({graphicalEatingHud:false}),heldByHand:(_p,h)=>h===hand?item:other,
 startEatingSound:(_p,a)=>sounds.push(a.profile),stopEatSound:()=>sounds.push('stop'),hideJavaEatingHud(){},forgetEatingItem(){},now:()=>ctx.system.currentTick,hungerSettle:()=>{settlements.push('settled');return true;},cuisineUseEventMatches:()=>false,console};
 if(profile)ctx.PROFILE_BY_ITEM[canonicalFoodId(id)]=profile;
 const constants=source.match(/const MINIMUM_EAT_TICKS=\d+,RELEASE_CHECKPOINT_GRACE_TICKS=\d+;/)[0]+'\n'+source.match(/const BITE_TIMES=Object.freeze\(\{[\s\S]*?\}\);/)[0];
 vm.runInNewContext(constants+'\n'+selectedSource+'\n'+slice('function resolvedProfile(','function writeUseHand(')+'\n'+startSource+'\n'+stopSource,ctx);
 const event={source:player,itemStack:item,useDuration:duration};callbacks.itemStartUse(event);
 return {ctx,properties,animations,sounds,settlements,item,other,player,stop:(changed=item)=>callbacks.itemStopUse({...event,itemStack:changed,useDuration:duration-1}),flush:()=>{while(queue.length)queue.shift()();}};
}
for(const id of ids)for(const hand of ['main','off'])test(`actual start routes ${id} ${hand} to dedicated raw ONE and retains native pose`,()=>{
 const f=fixture({id,hand}),side=hand==='off'?'left':'right',slot=hand==='off'?'offhand':'mainhand';
 assert.equal(f.animations.length,2);
 const [projection,native]=f.animations;
 assert.equal(projection.name,`animation.kg_raw_one.player.one.${side}`);
 assert.equal(projection.options.controller,'kg_java_eating_first_person');assert.equal(projection.options.blendOutTime,0);
 assert.equal(projection.options.stopExpression,`!q.is_using_item || !q.is_item_name_any('slot.weapon.${slot}','${id}')`);
 assert.equal(native.name,`animation.kg_eating.player.native_${side}`);assert.equal(native.options.blendOutTime,.08);
 assert.equal(native.options.stopExpression,projection.options.stopExpression);
 assert.equal(f.properties.get(presentation.EAT_PROJECTION_PROPERTY),true);
 assert.equal(f.properties.get(presentation.EAT_HAND_PROPERTY),hand==='off'?2:1);
 assert.equal(f.properties.get(presentation.EAT_NATIVE_TICKS_PROPERTY),90);
 assert.equal(f.ctx.ACTIVE_EATS.get(f.player.id).use.hand,hand);assert.equal(f.item.amount,2);assert.deepEqual(f.sounds,['ONE']);
 f.ctx.system.currentTick=101;f.stop();f.flush();
 assert.equal(f.ctx.ACTIVE_EATS.size,0);assert.equal(f.properties.get(presentation.EAT_PROJECTION_PROPERTY),false);assert.equal(f.properties.get(presentation.EAT_HAND_PROPERTY),0);assert.deepEqual(f.settlements,[]);assert.equal(f.item.amount,2);
});
for(const id of ids)for(const hand of ['main','off'])test(`occupied helper excludes raw ONE projection: ${id} ${hand}`,()=>{
 const f=fixture({id,hand,helper:true});assert.equal(f.properties.get(presentation.EAT_PROJECTION_PROPERTY),false);
 assert.equal(f.animations.length,1);assert.ok(f.animations[0].name.startsWith('animation.kg_eating.player.native_'));assert.equal(f.other.typeId,'minecraft:torch');
});
for(const id of ids)for(const hand of ['main','off'])test(`plain native variant has no custom dispatch: ${id} ${hand}`,()=>{
 const f=fixture({id:id+'_native_plain',hand,duration:25});assert.deepEqual(f.animations,[]);assert.deepEqual(f.sounds,[]);assert.equal(f.properties.get(presentation.EAT_PROJECTION_PROPERTY),false);assert.equal(f.ctx.ACTIVE_EATS.get(f.player.id).plain,true);
});
for(const profile of ['THREE','THREE_ALT'])for(const hand of ['main','off'])test(`raw ONE registry and dispatch exclude ${profile} ${hand}`,()=>{
 for(const id of ids){const f=fixture({id,hand,profile});assert.equal(supportsRawOne(id,profile,hand),false);assert.equal(rawOneAnimation(id,profile,hand),null);assert.ok(f.animations.every(a=>!a.name.startsWith('animation.kg_raw_one.')));}
});
test('raw ONE exact identity and hand whitelist rejects aliases and unrelated items',()=>{
 for(const id of [...ids.map(id=>id+'_java_three_alt'),...ids.map(id=>id+'_native_plain'),'kaleidoscope_grilling:grilled_fish_skewer','kaleidoscope_grilling:raw_beef_skewer','minecraft:cod',undefined])for(const hand of ['main','off']){assert.equal(supportsRawOne(id,'ONE',hand),false);assert.equal(rawOneAnimation(id,'ONE',hand),null);}
 for(const hand of ['',undefined,'left','right'])for(const id of ids){assert.equal(supportsRawOne(id,'ONE',hand),false);assert.equal(rawOneAnimation(id,'ONE',hand),null);}
 for(const id of ['minecraft:cod',ids[0]+'_java_three_alt']){const f=fixture({id});assert.deepEqual(f.animations,[]);assert.equal(f.ctx.ACTIVE_EATS.size,0);}
});
for(const duration of [0,-1,1.5,72001])test(`invalid native duration ${duration} cannot enable projection`,()=>{
 const f=fixture({duration});assert.equal(f.properties.get(presentation.EAT_PROJECTION_PROPERTY),false);assert.ok(f.animations.every(a=>!a.name.startsWith('animation.kg_raw_one.')));
});
test('mismatched stop identity leaves the active raw ONE session intact',()=>{
 const f=fixture(),active=f.ctx.ACTIVE_EATS.get(f.player.id);f.ctx.system.currentTick=101;f.stop({...f.item,nameTag:'Different serving'});f.flush();
 assert.equal(f.ctx.ACTIVE_EATS.get(f.player.id),active);assert.equal(f.properties.get(presentation.EAT_PROJECTION_PROPERTY),true);assert.deepEqual(f.settlements,[]);assert.deepEqual(f.sounds,['ONE']);
});

test('raw ONE registry full profile and hand matrix is exactly bounded',()=>{
 for(const id of ids)for(const profile of ['ONE','TWO','THREE','THREE_ALT','THREE_RANDOM','FOUR','',undefined,null])for(const hand of ['main','off','left','right','',undefined,null]){
  const supported=profile==='ONE'&&(hand==='main'||hand==='off');
  assert.equal(supportsRawOne(id,profile,hand),supported,`${id} ${profile} ${hand}`);
  assert.equal(rawOneAnimation(id,profile,hand),supported?`animation.kg_raw_one.player.one.${hand==='off'?'left':'right'}`:null);
 }
});
