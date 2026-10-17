/** Actual source-state/transport modules with API doubles; not a Minecraft client. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as failure from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_visual_core.js';
import * as metadata from '../../projects/grilling/gameplay_core/behavior_pack/scripts/itemDataCore.js';
import {captureSkewerMetadata,restoreSkewerMetadata} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js';
import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {isBottleHeldVisualItem} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/bottle_held_visual_core.js';
import {secretVisualIndex} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/integration_registry_core.js';
import {secretHeldMarker} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state_core.js';
import {secretVisualState,partialVisualState} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state.js';
import {captureEatingIdentity,eatingStillCurrent} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_eating_transaction.js';
const N='kaleidoscope_grilling:',root=new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/',import.meta.url);
class Stack{
 constructor(typeId,amount=1,maxAmount=64){Object.assign(this,{typeId,amount,maxAmount,lore:[],props:{},nameTag:undefined,keepOnDeath:false,lockMode:'none',destroy:[],place:[],raw:[]});}
 getRawLore(){return structuredClone(this.lore)}setLore(v){this.lore=structuredClone(v)}getDynamicPropertyIds(){return Object.keys(this.props)}getDynamicProperty(k){return this.props[k]}setDynamicProperty(k,v){this.props[k]=v}
 getCanDestroy(){return this.destroy}getCanPlaceOn(){return this.place}setCanDestroy(v){this.destroy=[...v]}setCanPlaceOn(v){this.place=[...v]}getComponent(){}getTags(){return []}
 clone(){return Object.assign(new Stack(this.typeId,this.amount,this.maxAmount),structuredClone({...this}))}
}
function storage(){const saved=new Map();metadata.configureItemDataWorld({getDynamicProperty:k=>saved.get(k),setDynamicProperty:(k,v)=>saved.set(k,v)});return saved;}
const create=(id,n)=>new Stack(id,n);
function decorated(id){const s=new Stack(id,5);s.nameTag='Original';s.keepOnDeath=true;s.lockMode='slot';s.destroy=['minecraft:stone'];s.place=['minecraft:dirt'];metadata.setItemLore(s,[{translate:'original.key',with:['x']}]);for(const [k,v]of Object.entries({[N+'model_variants']:'[9,5,4]',[N+'skewer_ingredients']:'[{"id":"minecraft:beef","props":{"foreign":7}}]',[N+'secret_cooked_ingredients']:'[{"id":"minecraft:cooked_beef"}]','foreign:vector':{x:1,y:2,z:3},[failure.FAILED_SOURCE_KEY]:'obsolete'}))metadata.setItemProperty(s,k,v);return s;}
test('all19 exact Java source indices and raw aliases preserve complete accessible metadata',()=>{
 storage();assert.equal(failure.FAILURE_RAW_SOURCES.length,19);
 for(const [index,id]of failure.FAILURE_RAW_SOURCES.entries())for(const result of failure.FAILURE_IDS){
  const input=decorated(id),before=captureSkewerMetadata(input),output=failure.createFailedSkewer(input,result,create);
  const expected=structuredClone(before);expected.id=result;expected.props[failure.FAILED_SOURCE_KEY]=id;
  assert.deepEqual(captureSkewerMetadata(output),expected);assert.deepEqual(captureSkewerMetadata(input),before);assert.equal(output.amount,1);
  assert.equal(failure.failureSourceIndex(metadata.getItemProperty(output,failure.FAILED_SOURCE_KEY)),index+1);
 }
 const alt=failure.createFailedSkewer(decorated(N+'raw_gluten_skewer_java_three_alt'),failure.FAILURE_IDS[0],create);assert.equal(metadata.getItemProperty(alt,failure.FAILED_SOURCE_KEY),N+'raw_gluten_skewer');
});
test('custom and unknown sources overwrite stale values without fabricating provenance',()=>{
 storage();for(const id of [N+'secret_skewer',N+'secret_skewer_java_three_alt',N+'secret_skewer_native_plain']){
  const s=failure.createFailedSkewer(decorated(id),failure.FAILURE_IDS[1],create);assert.equal(metadata.getItemProperty(s,failure.FAILED_SOURCE_KEY),'custom');assert.equal(failure.failureHeldPayload(s,()=>[])[0],0);
 }
 assert.equal(failure.failureSourceIndex(undefined),0);assert.equal(failure.failureSourceIndex('foreign:raw'),0);
 const old=new Stack(failure.FAILURE_IDS[0]);assert.deepEqual(failure.failureHeldPayload(old,()=>[]),[0,0,0,0,0,0,0,0,0,0,0,220]);assert.deepEqual(old.props,{});
});
test('snapshot storage and profile changes preserve source, variants, raw ingredients and opaque custom fields',()=>{
 storage();const out=failure.createFailedSkewer(decorated(N+'raw_golden_skewer'),failure.FAILURE_IDS[0],create);
 for(const suffix of ['','_java_three_alt','_native_plain']){
  const data=JSON.parse(JSON.stringify(captureSkewerMetadata(out)));data.id=failure.FAILURE_IDS[0]+suffix;
  const restored=restoreSkewerMetadata(data,create);assert.deepEqual(captureSkewerMetadata(restored),data);assert.equal(failure.failureHeldPayload(restored,()=>[])[0],19);
 }
});
test('lost copied metadata or source write fails before delivering the new item',()=>{
 storage();const input=decorated(N+'raw_beef_skewer'),before=captureSkewerMetadata(input);
 assert.throws(()=>failure.createFailedSkewer(input,failure.FAILURE_IDS[0],(id,n)=>{const s=new Stack(id,n);s.setLore=()=>{};return s;}));
 assert.deepEqual(captureSkewerMetadata(input),before);assert.throws(()=>failure.createFailedSkewer(input,'foreign:output',create));
});
test('shape state keeps zero/malformed/missing slots; helper is raw-last and independent of bite/cooked rows',()=>{
 storage();assert.equal(failure.failureModelState(undefined),0);assert.equal(failure.failureModelState('[]'),0);assert.equal(failure.failureModelState('[1,2,3]'),27);assert.equal(failure.failureModelState('[4,8,9]'),27);assert.equal(failure.failureModelState('[0,11,2]'),2);
 const s=decorated(failure.FAILURE_IDS[0]);s.raw=[{id:'minecraft:apple'},{id:'minecraft:beef'}];
 for(const stage of [0,1,2,3]){s.stage=stage;const p=failure.failureHeldPayload(s,x=>x.raw);assert.equal(p[1],57);assert.equal(p[2],secretVisualIndex('minecraft:beef'));}
 assert.equal(failure.failureHeldPayload(s)[2],0);
});
const stripped=name=>fs.readFileSync(new URL(name,root),'utf8').replace(/^import .*;\n/gm,'').replace(/\bexport (?=(const|function))/g,'');
function runtime(stack){
 const held={main:stack},values={},writes=[],callbacks={},queue=[];let fail;
 const player={id:'failure-holder',selectedSlotIndex:0,setProperty(k,v){writes.push([k,v]);if(fail?.(k,v))throw Error('injected write');values[k]=v;}};
 const ctx={...failure,canonicalFoodId,isBottleHeldVisualItem,secretVisualIndex,secretHeldMarker,secretVisualState,partialVisualState,eatingStillCurrent,getMainHand:()=>held.main,getOffHand:()=>held.off,isCreative:()=>!!held.creative,console:{warn(){}},world:{getAllPlayers:()=>[player],afterEvents:Object.fromEntries(['playerInventoryItemChange','playerHotbarSelectedSlotChange','playerSpawn','playerLeave'].map(k=>[k,{subscribe:f=>callbacks[k]=f}]))},system:{currentTick:100,run:f=>queue.push(f),runInterval(){}}};
 vm.runInNewContext(stripped('slime_frame_core.js')+'\n'+stripped('held_visual_transport.js')+'\n'+stripped('held_visual_dispatch_runtime.js')+'\n'+stripped('secret_held_runtime.js')+'\nthis.api={configureSecretHeldReader,syncSecretHeld,writeHeldVisual,heldVisualKind};',ctx);
 ctx.api.configureSecretHeldReader(s=>s.raw,s=>s.raw);return {held,values,writes,player,callbacks,queue,api:ctx.api,fail:f=>fail=f};
}
test('actual shared provider owns six identities and both hands without stack mutation or extra player scan',()=>{
 storage();for(const id of failure.FAILURE_IDS)for(const suffix of ['','_java_three_alt','_native_plain']){
  const s=decorated(id+suffix);s.raw=[{id:'minecraft:beef'}];const before=captureSkewerMetadata(s),f=runtime(s);f.held.off=s.clone();f.api.syncSecretHeld(f.player);
  for(const hand of ['main','off']){assert.equal(f.values[N+'secret_'+hand+'_piece'],220);assert.equal(f.values[N+'bottle_'+hand+'_2'],secretVisualIndex('minecraft:beef'));}
  const n=f.writes.length;f.api.syncSecretHeld(f.player);assert.equal(f.writes.length,n);assert.deepEqual(captureSkewerMetadata(s),before);
 }
});
test('owner transitions and write failures invalidate before payload, retry without stale success cache',()=>{
 storage();const f=runtime(decorated(failure.FAILURE_IDS[0]));f.api.syncSecretHeld(f.player);
 f.held.main=new Stack(N+'secret_skewer');f.api.syncSecretHeld(f.player);assert.equal(f.values[N+'secret_main_piece'],0);
 f.held.main=decorated(failure.FAILURE_IDS[1]);f.fail(k=>k===N+'bottle_main_1');f.api.syncSecretHeld(f.player);assert.equal(f.values[N+'secret_main_piece'],254);
 f.fail();f.api.syncSecretHeld(f.player);assert.equal(f.values[N+'secret_main_piece'],220);
 assert.throws(()=>f.api.writeHeldVisual(f.player,'main','failure',[20,0,0,0,0,0,0,0,0,0,0,220]));
 assert.throws(()=>f.api.writeHeldVisual(f.player,'main','failure',[0,0,0,0,0,0,0,0,0,0,0,219]));
});
test('completion masks only exact single-serving identity; replacement and fresh start release mask',()=>{
 storage();const s=decorated(failure.FAILURE_IDS[0]);s.amount=1;const f=runtime(s),use=captureEatingIdentity(s,'main',0);
 f.api.syncSecretHeld(f.player,{completedUse:use});assert.equal(f.values[N+'secret_main_piece'],254);
 f.api.syncSecretHeld(f.player);assert.equal(f.values[N+'secret_main_piece'],254);
 f.api.syncSecretHeld(f.player,{beginHand:'main'});assert.equal(f.values[N+'secret_main_piece'],220);
 f.api.syncSecretHeld(f.player,{completedUse:use});f.held.main=s.clone();f.held.main.nameTag='Different serving';f.api.syncSecretHeld(f.player);assert.equal(f.values[N+'secret_main_piece'],220);
});
