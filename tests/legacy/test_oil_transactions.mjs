import {createFixture} from '../helpers/minecraft-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../../projects/grilling/gameplay_core/behavior_pack/scripts/oil/oil_machine_core.js';
import {createOilPressRegistry} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/oil_press_registry.js';
const N='kaleidoscope_grilling:';

test('legacy registry migration is resumable when a write fails',()=>{
 const dp=new Map([[N+'a26_press_registry',JSON.stringify([{d:'minecraft:overworld',x:1,y:2,z:3},{d:'minecraft:overworld',x:2,y:2,z:3}])]]);let fail=true;
 const world={getDynamicProperty:k=>dp.get(k),getDynamicPropertyIds:()=>[...dp.keys()],setDynamicProperty(k,v){if(fail&&k.endsWith('%7C2%7C2%7C3'))throw Error('migration failure');if(v===undefined)dp.delete(k);else dp.set(k,v);}};
 assert.throws(()=>createOilPressRegistry(world,N+'a26_press_registry').rows());assert.ok(dp.has(N+'a26_press_registry'));fail=false;assert.equal(createOilPressRegistry(world,N+'a26_press_registry').rows().length,2);assert.equal(dp.has(N+'a26_press_registry'),false);
});
test('press stones accept the native addon tag and preserve anvil precedence',()=>{
 assert.equal(core.toolProgress('addon:stone',['kaleidoscope_grilling:press_stones']),1);
 assert.equal(core.toolProgress('minecraft:anvil',['kaleidoscope_grilling:press_stones']),4);
 assert.equal(core.toolProgress('addon:stone',[]),0);
});

// Native registered-event scenarios retained from PR250; pure assertions above remain unchanged.
{
/** Real oil-machine/world-fluid event handlers with native-ESM Minecraft doubles. */

const N='kaleidoscope_grilling:';
const PRESS='kaleidoscope_grilling:a26_press_';
const VAT='kaleidoscope_grilling:a26_vat_';
const REGISTRY='kaleidoscope_grilling:a26_press_registry';
const FAULT='kaleidoscope_grilling:oil_transaction_fault_';
const COOKERY_FILLED='kaleidoscope_cookery:oil_pot_filled';
const point=(x=0)=>({x,y:64,z:0});
const stateKey=(prefix,block)=>prefix+block.dimension.id.replace(/[^a-z0-9]/gi,'_')+'_'+['x','y','z'].map(axis=>block[axis]<0?'m'+Math.abs(block[axis]):'p'+block[axis]).join('_');
const registryRow=block=>({d:block.dimension.id,...block.location});

async function fixture({count=16,creative=false,full=false,off=false,press:pressState,vat={type:'canola',buckets:4},worldOil=false}={}){
 const h=createFixture();
 let fault=()=>false,unloaded=false;
 const mayFail=(kind,value)=>{if(fault(kind,value))throw Error('injected '+kind)};
 const rawSet=h.world.setDynamicProperty.bind(h.world);
 const dp={
  get:key=>h.world.getDynamicProperty(key),
  set(key,value){rawSet(key,value);return this},
  has:key=>h.world.getDynamicPropertyIds().includes(key),
  keys:()=>h.world.getDynamicPropertyIds(),
  entries:()=>h.world.getDynamicPropertyIds().map(key=>[key,h.world.getDynamicProperty(key)]),
  [Symbol.iterator](){return this.entries()[Symbol.iterator]()}
 };
 h.world.setDynamicProperty=(key,value)=>{rawSet(key,value);mayFail(key,value)};
 const getBlock=h.dimension.getBlock.bind(h.dimension);
 h.dimension.getBlock=location=>{if(unloaded)throw Error('unloaded');return getBlock(location)};
 const spawn=h.dimension.spawnItem.bind(h.dimension);
 h.dimension.spawnItem=(stack,location)=>{
  mayFail('spawn',stack);
  const entity=spawn(stack,location),remove=entity.remove.bind(entity);
  entity.remove=()=>{mayFail('drop_remove_before',entity);if(fault('drop_remove_noop',entity))return;remove();mayFail('drop_remove_after',entity)};
  mayFail('spawn_after',entity);
  return fault('spawn_unacknowledged',entity)?undefined:entity;
 };
 function block(typeId,x=0){
  const b=h.block(typeId,point(x));
  const setPermutation=b.setPermutation.bind(b),setType=b.setType.bind(b);
  b.setPermutation=value=>{mayFail('permutation_before',value);setPermutation(value);mayFail('permutation',value)};
  b.setType=value=>{setType(value);mayFail('type',value)};
  return b;
 }
 function participant(id,main,offhand){
  const p=h.player({id,main,off:offhand,location:point(0),gameMode:creative?'Creative':'Survival',inventorySize:2});
  const setSlot=p.inventory.setItem.bind(p.inventory),setEquipment=p.equipment.setEquipment.bind(p.equipment);
  p.inventory.setItem=(slot,item)=>{setSlot(slot,item);mayFail('slot'+slot,item)};
  p.equipment.setEquipment=(slot,item)=>{const result=setEquipment(slot,item);mayFail('offhand',item);return result};
  return {holder:p,held:()=>off?p.equipment.getEquipment('Offhand'):p.inventory.getItem(p.selectedSlotIndex),
   setHand:item=>off?setEquipment('Offhand',item):setSlot(p.selectedSlotIndex,item),
   setMain:item=>setSlot(p.selectedSlotIndex,item)};
 }
 const buckets=h.item('minecraft:bucket',count);
 const owner=participant('oil-player',off?h.item('minecraft:stone'):buckets,off?buckets:undefined);
 if(full)owner.holder.inventory.setItem(1,h.item('minecraft:stone',64));
 const seedVat=(b,state)=>{
  const value=core.normalizeVat(state);dp.set(stateKey(VAT,b),JSON.stringify(value));
  b.setPermutation(b.permutation.withState(N+'vat_level',core.vatVisualLevel(value.buckets)).withState(N+'vat_fluid',value.type||'empty'));
 };
 const seedPress=(b,state)=>{
  const value=core.normalizePress(state);dp.set(stateKey(PRESS,b),JSON.stringify(value));
  b.setPermutation(b.permutation.withState(N+'cake_count',value.cakes).withState(N+'press_stage',core.pressVisualStage(value.progress)));
  if(value.completionDelay>0||value.progress>=core.PRESS_REQUIRED_PROGRESS)createOilPressRegistry(h.world,REGISTRY).add(registryRow(b));
 };
 const vatBlock=block(core.BIG_VAT_ID,1);seedVat(vatBlock,vat);
 const press=pressState===undefined?undefined:block(core.OIL_PRESS_ID,0);
 if(press)seedPress(press,pressState);
 const api=await h.load(worldOil?'oil/oil_world.js':'oil/oil_machine_runtime.js');
 const {nativeItemSignature}=await h.load('owned_item_transaction_core.js');
 h.startup();
 // First-load recovery arms native ticks; it does not advance saved work.
 h.tick(1);
 const f={h,api,signature:nativeItemSignature,world:h.world,dimension:h.dimension,dp,vat:vatBlock,press,block,seedVat,seedPress,...owner,
  item:(...args)=>h.item(...args),hand:off?'off':'main',
  setFault:fn=>{fault=fn},unload:value=>{unloaded=value},
  flush:()=>h.flush(),tick:n=>h.tick(n),
  place:b=>h.emit('world.afterEvents.playerPlaceBlock',{block:b,player:owner.holder}),
  registry:()=>createOilPressRegistry(h.world,REGISTRY).rows(),
  addPlayer:(id,stack)=>participant(id,stack),
  readVat:b=>api.a26ReadVat(b??vatBlock),readPress:b=>api.a26ReadPress(b??press),
  use(b=vatBlock,who=owner,{cancel=false,first=true,face='Up'}={}){
   const event={block:b,player:who.holder,itemStack:who.held()?.clone(),cancel,isFirstEvent:first,blockFace:face};
   h.emit('world.beforeEvents.playerInteractWithBlock',event);return event;
  },
  break(b,cancel=false){const event={block:b,player:owner.holder,cancel};h.emit('world.beforeEvents.playerBreakBlock',event);return event}
 };
 Object.defineProperty(f,'drops',{get:()=>h.drops.filter(entity=>entity.isValid!==false)});
 return f;
}
const recoveries=f=>[...f.dp].filter(([key])=>key.startsWith(FAULT));
const snapshot=f=>Object.fromEntries(f.dp);
const dropped=f=>f.drops.map(entity=>entity.getComponent('minecraft:item').itemStack);
function use(f,block=f.vat,who=f){assert.equal(f.use(block,who).cancel,true);f.flush()}
function breakBlock(f,block){assert.equal(f.break(block).cancel,true);f.flush()}
function failOnce(f,predicate){let once=true;f.setFault((key,value)=>{if(once&&predicate(key,value)){once=false;return true}return false})}
async function publicPot(f,{type='canola',count=8,lore=['custom oil pot']}={}){
 const {writePublicOil}=await f.h.load('host_api/oil_api_core.js');
 const pot=f.item(COOKERY_FILLED);pot.setLore(lore);
 return writePublicOil(pot,{v:1,type,count,revision:2},{presentation:false});
}

for(const off of [false,true])for(const count of [1,16])test(`${off?'off':'main'} hand vat bucket count ${count} retains the exact remainder`,async()=>{
 const f=await fixture({off,count});use(f);
 assert.equal(f.held().typeId,count===1?N+'canola_oil_bucket':'minecraft:bucket');
 assert.equal(f.held().amount,count===1?1:15);
 if(count>1)assert.equal(f.holder.inventory.getItem(1).typeId,N+'canola_oil_bucket');
 assert.equal(f.readVat().buckets,3);
});
test('full inventory spills one filled bucket and keeps fifteen empty buckets',async()=>{
 const f=await fixture({full:true});use(f);
 assert.equal(f.held().amount,15);assert.deepEqual(dropped(f).map(s=>[s.typeId,s.amount]),[[N+'canola_oil_bucket',1]]);
 assert.equal(f.readVat().buckets,3);
});
test('creative vat extraction drains one bucket without changing the hand or minting output',async()=>{
 const f=await fixture({creative:true});use(f);
 assert.equal(f.held().amount,16);assert.equal(f.holder.inventory.getItem(1),undefined);
 assert.equal(f.drops.length,0);assert.equal(f.readVat().buckets,3);
});
for(const kind of ['hand','output','spawn','vat'])test(`${kind} failure restores bucket, inventory, drops and vat through the registered callback`,async()=>{
 const f=await fixture({full:kind==='spawn'});
 failOnce(f,key=>kind==='hand'&&key==='slot0'||kind==='output'&&key==='slot1'||kind==='spawn'&&key==='spawn'||kind==='vat'&&key.startsWith(VAT));
 use(f);
 assert.equal(f.held().typeId,'minecraft:bucket');assert.equal(f.held().amount,16);
 assert.equal(f.readVat().buckets,4);assert.equal(f.drops.length,0);
 if(kind!=='spawn')assert.equal(f.holder.inventory.getItem(1),undefined);
 assert.equal(recoveries(f).length,0);
});
test('filled bucket insertion credits one bucket and rejects incompatible or full vats',async()=>{
 for(const vat of [{type:'canola',buckets:4},{type:'premium_chili',buckets:4},{type:'canola',buckets:8}]){
  const f=await fixture({vat}),bucket=f.item(N+'canola_oil_bucket');f.setHand(bucket);use(f);
  const accepted=vat.type==='canola'&&vat.buckets<8;
  assert.equal(f.held().typeId,accepted?'minecraft:bucket':bucket.typeId);
  assert.equal(f.readVat().buckets,vat.buckets+(accepted?1:0));assert.equal(f.readVat().type,vat.type);
 }
});
test('filled-bucket credit failure restores its original native item metadata',async()=>{
 const f=await fixture(),bucket=f.item(N+'canola_oil_bucket');bucket.nameTag='owned oil';bucket.setLore(['keep me']);f.setHand(bucket);
 failOnce(f,key=>key.startsWith(VAT));use(f);
 assert.equal(f.signature(f.held()),f.signature(bucket));assert.equal(f.readVat().buckets,4);
});
test('public Cookery pot fills from the real adapter without discarding custom metadata',async()=>{
 const f=await fixture(),pot=await publicPot(f);pot.nameTag='kitchen';pot.setCanPlaceOn(['minecraft:stone']);f.setHand(pot);use(f);
 const {readCookeryOilPot}=await f.h.load('oil/cookery_oil_pot_adapter.js');
 assert.equal(readCookeryOilPot(f.held()).count,40);assert.equal(f.readVat().buckets,0);
 assert.equal(f.held().nameTag,'kitchen');assert.deepEqual(f.held().getCanPlaceOn(),['minecraft:stone']);
 assert.ok(f.held().getLore().includes('custom oil pot'));
});
test('native pot builder rejects twenty occupied lore lines without draining oil or altering the pot',async()=>{
 const f=await fixture(),pot=await publicPot(f,{lore:Array.from({length:19},(_,i)=>'custom '+i)});f.setHand(pot);use(f);
 assert.equal(f.readVat().buckets,4);assert.equal(f.signature(f.held()),f.signature(pot));assert.equal(f.held().getRawLore().length,20);
});
test('pot save failure restores both the native pot and vat',async()=>{
 const f=await fixture(),pot=await publicPot(f);f.setHand(pot);failOnce(f,key=>key.startsWith(VAT));use(f);
 assert.equal(f.signature(f.held()),f.signature(pot));assert.equal(f.readVat().buckets,4);
});
for(const kind of ['reset','residue'])test(`press ${kind} failure restores the batch and oil before the bounded recovery retries once`,async()=>{
 const f=await fixture({vat:{},press:{cakes:4,progress:16}});
 failOnce(f,key=>kind==='reset'?key.startsWith(PRESS)&&!key.startsWith(REGISTRY):key==='spawn');f.tick(1);
 assert.equal(f.readVat().buckets,0);assert.equal(f.readPress().cakes,4);assert.equal(f.drops.length,0);
 f.tick(20);assert.equal(f.readVat().buckets,4);assert.equal(f.readPress().cakes,0);
 assert.deepEqual(dropped(f).map(s=>[s.typeId,s.amount]),[[core.OIL_RESIDUE_ID,4]]);
 f.tick(2);assert.equal(f.drops.length,1);assert.equal(f.readVat().buckets,4);
});
test('failed rollback quarantines the vat and prevents a later interaction from retrying',async()=>{
 const f=await fixture();f.setFault(key=>key.startsWith(VAT));use(f);f.setFault(()=>false);
 assert.equal(recoveries(f).length,1);const before=snapshot(f),hand=f.signature(f.held());use(f);
 assert.deepEqual(snapshot(f),before);assert.equal(f.signature(f.held()),hand);assert.equal(f.drops.length,0);
});
test('unloaded press remains pending and settles exactly once after the chunk returns',async()=>{
 const f=await fixture({vat:{},press:{cakes:4,progress:16,completionDelay:1}});f.unload(true);f.tick(1);
 assert.equal(f.registry().length,1);assert.equal(f.readPress().completionDelay,1);
 f.unload(false);f.tick(1);assert.equal(f.readVat().buckets,4);assert.equal(f.registry().length,0);assert.equal(f.drops.length,1);
});
test('saved pending press resumes once in a fresh runtime and world instance',async()=>{
 const f=await fixture({vat:{},press:{cakes:4,progress:16,completionDelay:2}});f.tick(1);
 assert.equal(f.readPress().completionDelay,1);assert.equal(f.drops.length,0);
 const reloaded=createFixture({dynamicProperties:snapshot(f)});
 const vat=reloaded.block(core.BIG_VAT_ID,f.vat.location,{states:f.vat.permutation.getAllStates()});
 const press=reloaded.block(core.OIL_PRESS_ID,f.press.location,{states:f.press.permutation.getAllStates()});
 const api=await reloaded.load('oil/oil_machine_runtime.js');reloaded.startup();reloaded.tick(1);
 assert.equal(api.a26ReadPress(press).completionDelay,1,'recovery only arms the saved work');
 reloaded.tick(1);
 assert.equal(api.a26ReadVat(vat).buckets,4);assert.equal(api.a26ReadPress(press).cakes,0);
 assert.deepEqual(reloaded.drops.map(e=>[e.itemStack.typeId,e.itemStack.amount]),[[core.OIL_RESIDUE_ID,4]]);
 assert.equal(createOilPressRegistry(reloaded.world,REGISTRY).rows().length,0);
 reloaded.tick(12);assert.equal(api.a26ReadVat(vat).buckets,4);assert.equal(reloaded.drops.length,1);
});
test('durable quarantine still blocks a vat after its runtime cache is replaced',async()=>{
 const f=await fixture();f.setFault(key=>key.startsWith(VAT));use(f);f.setFault(()=>false);
 assert.equal(recoveries(f).length,1);assert.equal(f.held().amount,16);assert.equal(f.readVat().buckets,4);
 const reloaded=createFixture({dynamicProperties:snapshot(f)});
 const vat=reloaded.block(core.BIG_VAT_ID,f.vat.location,{states:f.vat.permutation.getAllStates()});
 const player=reloaded.player({main:reloaded.item('minecraft:bucket',16),inventorySize:2});
 const api=await reloaded.load('oil/oil_machine_runtime.js');reloaded.startup();
 const before=Object.fromEntries(reloaded.world.dynamicProperties),event={block:vat,player,itemStack:player.inventory.getItem(0),cancel:false,isFirstEvent:true};
 reloaded.emit('world.beforeEvents.playerInteractWithBlock',event);assert.equal(event.cancel,true);reloaded.flush();
 assert.deepEqual(Object.fromEntries(reloaded.world.dynamicProperties),before);assert.equal(api.a26ReadVat(vat).buckets,4);
 assert.equal(player.inventory.getItem(0).amount,16);assert.equal(player.inventory.getItem(1),undefined);assert.equal(reloaded.drops.length,0);
});
test('three hundred durable press entries survive an independent registry reload',async()=>{
 const f=await fixture(),registry=createOilPressRegistry(f.world,REGISTRY);
 for(let i=0;i<300;i++)registry.add({d:f.dimension.id,x:10+i,y:64,z:0});
 assert.equal(registry.rows().length,300);assert.equal(createOilPressRegistry(f.world,REGISTRY).rows().length,300);
});
test('legacy press registry migration resumes after a partial native write failure',async()=>{
 const f=await fixture();f.dp.set(REGISTRY,JSON.stringify([{d:f.dimension.id,x:1,y:2,z:3},{d:f.dimension.id,x:2,y:2,z:3}]));
 f.setFault(key=>key.endsWith('%7C2%7C2%7C3'));
 assert.throws(()=>createOilPressRegistry(f.world,REGISTRY).rows(),/injected/);assert.equal(f.dp.has(REGISTRY),true);
 f.setFault(()=>false);assert.equal(createOilPressRegistry(f.world,REGISTRY).rows().length,2);assert.equal(f.dp.has(REGISTRY),false);
});
test('native press stones respect tags and anvil precedence',()=>{
 assert.equal(core.toolProgress('addon:stone',[N+'press_stones']),1);
 assert.equal(core.toolProgress('minecraft:anvil',[N+'press_stones']),4);assert.equal(core.toolProgress('addon:stone',[]),0);
});
test('interactions cannot settle the normal ten-tick completion delay early',async()=>{
 const f=await fixture({vat:{},press:{cakes:4,progress:16,completionDelay:10}});
 for(let tick=0;tick<10;tick++){
  assert.equal(f.readPress().completionDelay,10-tick);assert.equal(f.readVat().buckets,0);assert.equal(f.drops.length,0);
  assert.equal(f.use(f.press).cancel,true);f.tick(1);
 }
 assert.equal(f.readVat().buckets,4);assert.equal(f.drops.length,1);assert.equal(dropped(f)[0].amount,4);
 use(f,f.press);f.tick(1);assert.equal(f.drops.length,1);assert.equal(f.readVat().buckets,4);
});
test('waiting press retries on interaction once a compatible vat is available',async()=>{
 const f=await fixture({vat:{},press:{cakes:4,progress:15,waiting:true}});use(f,f.press);
 assert.equal(f.readVat().buckets,4);assert.equal(f.readPress().cakes,0);assert.equal(f.drops.length,1);
});
test('container probing distinguishes absent, incompatible, full and available vats',async()=>{
 for(const [vat,status] of [[null,'NO_CONTAINER'],[{type:'premium_chili',buckets:1},'INCOMPATIBLE'],[{type:'canola',buckets:5},'FULL'],[{},'SUCCESS']]){
  const f=await fixture({vat:vat??{},press:{cakes:4}});if(vat===null)f.vat.setType('minecraft:air');
  assert.equal(f.api.a26ProbePressContainer(f.press).status,status);
 }
});
test('deferred cake insertion refuses cancelled, removed and replaced press targets',async()=>{
 for(const change of ['air','same-type-placement','cancelled']){
  const f=await fixture({press:{}});f.setHand(f.item(core.OIL_CAKE_ID,2));
  if(change==='cancelled')f.use(f.press,f,{cancel:true});
  else{assert.equal(f.use(f.press).cancel,true);if(change==='air')f.press.setType('minecraft:air');else f.place(f.block(core.OIL_PRESS_ID,0))}
  const before=snapshot(f);f.flush();assert.equal(f.held().amount,2,change);assert.deepEqual(snapshot(f),before,change);assert.equal(f.drops.length,0);
 }
});
test('two queued players use the latest capacity of the same press instance',async()=>{
 for(const cakes of [2,3]){
  const f=await fixture({press:{cakes}}),first=f.item(core.OIL_CAKE_ID,2);first.nameTag='first player';f.setHand(first);
  const next=f.item(core.OIL_CAKE_ID,2);next.nameTag='second player';const second=f.addPlayer('second-player',next);
  assert.equal(f.use(f.press).cancel,true);assert.equal(f.use(f.press,second).cancel,true);f.flush();
  assert.equal(f.readPress().cakes,4);assert.equal(f.held().amount,1);assert.equal(second.held().amount,cakes===2?1:2);
  assert.equal(f.held().nameTag,'first player');assert.equal(second.held().nameTag,'second player');assert.equal(f.drops.length,0);
 }
});
test('cake insertion debits the captured main or offhand and preserves native metadata',async()=>{
 for(const off of [false,true]){
  const f=await fixture({off,press:{}}),cake=f.item(core.OIL_CAKE_ID,2);cake.nameTag='owned cake';cake.setLore(['custom']);cake.setCanPlaceOn(['minecraft:stone']);cake.setCanDestroy(['minecraft:dirt']);cake.keepOnDeath=true;cake.lockMode='slot';
  const {setItemProperty}=await f.h.load('itemData.js');setItemProperty(cake,'test:owner','kitchen');f.setHand(cake);
  use(f,f.press);const remaining=cake.clone();remaining.amount=1;
  assert.equal(f.signature(f.held()),f.signature(remaining));assert.equal(f.readPress().cakes,1);assert.equal(f.press.permutation.getState(N+'cake_count'),1);
 }
});
test('post-write cake debit and credit failures restore only confirmed owned values',async()=>{
 for(const kind of ['hand','save','projection']){
  const f=await fixture({press:{}});f.setHand(f.item(core.OIL_CAKE_ID,2));
  failOnce(f,key=>kind==='hand'&&key==='slot0'||kind==='save'&&key.startsWith(PRESS)&&!key.startsWith(REGISTRY)||kind==='projection'&&key==='permutation');use(f,f.press);
  // The native projection is authoritative even when setPermutation throws after applying it.
  assert.equal(f.held().amount,kind==='projection'?1:2);assert.equal(f.readPress().cakes,kind==='projection'?1:0);
  assert.equal(f.press.permutation.getState(N+'cake_count'),kind==='projection'?1:0);
 }
});
test('failed cake credit never refunds over a foreign hand or overwrites foreign press state',async()=>{
 for(const change of ['hand','press']){
  const f=await fixture({press:{}});f.setHand(f.item(core.OIL_CAKE_ID,2));let once=true;
  f.setFault(key=>{
   if(!once||key!==stateKey(PRESS,f.press))return false;once=false;
   if(change==='hand'){const foreign=f.held();foreign.nameTag='another owner';f.setHand(foreign)}
   else f.dp.set(key,JSON.stringify(core.normalizePress({cakes:3})));
   return true;
  });use(f,f.press);
  assert.equal(f.held().amount,1);if(change==='hand')assert.equal(f.held().nameTag,'another owner');else assert.equal(f.readPress().cakes,3);
  assert.equal(recoveries(f).length,1);f.setFault(()=>false);const before=snapshot(f),hand=f.signature(f.held());use(f,f.press);
  assert.deepEqual(snapshot(f),before);assert.equal(f.signature(f.held()),hand);
 }
});
test('delayed hammer hit keeps other players progress but cannot strike a replacement press',async()=>{
 for(const replace of [false,true]){
  const f=await fixture({press:{cakes:4}});f.setHand(f.item('minecraft:anvil'));use(f,f.press);
  const target=replace?f.block(core.OIL_PRESS_ID,0):f.press;if(replace)f.place(target);
  f.seedPress(target,{cakes:4,progress:2});f.tick(core.PRESS_IMPACT_TICK);
  assert.equal(f.readPress(target).progress,replace?2:6);
 }
});
test('deferred machine break refuses cancellations, replacement, changed contents and unloaded chunks',async()=>{
 for(const type of [core.OIL_PRESS_ID,core.BIG_VAT_ID])for(const change of ['already-cancelled','late-uncancel','same-type','foreign','contents','unloaded']){
  const f=await fixture({press:{cakes:3,progress:4}}),machine=type===core.OIL_PRESS_ID?f.press:f.vat;
  const event=f.break(machine,change==='already-cancelled');let current=machine;
  if(change==='late-uncancel')event.cancel=false;
  if(change==='same-type'){current=f.block(type,machine.x);f.place(current)}
  if(change==='foreign')current=f.block('minecraft:stone',machine.x);
  if(change==='contents'){if(type===core.OIL_PRESS_ID)f.seedPress(machine,{cakes:4,progress:4});else f.seedVat(machine,{type:'premium_chili',buckets:6})}
  if(change==='unloaded')f.unload(true);
  const before=snapshot(f);f.flush();assert.equal(f.drops.length,0,change);assert.deepEqual(snapshot(f),before,change);
  assert.equal(current.typeId,change==='foreign'?'minecraft:stone':type,change);
 }
});
test('breaking machines preserves press cakes, packed vat contents and creative no-drop rules',async()=>{
 for(const creative of [false,true]){
  const f=await fixture({creative,press:{cakes:3,progress:5}});breakBlock(f,f.press);
  assert.equal(f.press.typeId,'minecraft:air');assert.equal(f.readPress().cakes,0);
  assert.deepEqual(dropped(f).map(s=>[s.typeId,s.amount]),creative?[]:[[core.OIL_PRESS_ID,1],[core.OIL_CAKE_ID,3]]);assert.equal(recoveries(f).length,0);
  const v=await fixture({creative,vat:{type:'premium_chili',buckets:7}});breakBlock(v,v.vat);
  assert.equal(v.vat.typeId,'minecraft:air');assert.equal(v.readVat().buckets,0);assert.equal(v.drops.length,creative?0:1);
  if(!creative){const {getItemProperty}=await v.h.load('itemData.js');assert.equal(getItemProperty(dropped(v)[0],N+'vat_type'),'premium_chili');assert.equal(getItemProperty(dropped(v)[0],N+'vat_buckets'),7)}
  assert.equal(recoveries(v).length,0);
 }
});
test('timer-only progress after a captured break permits removal without later oil output',async()=>{
 const f=await fixture({vat:{},press:{cakes:4,progress:16,completionDelay:8}});f.break(f.press);
 f.seedPress(f.press,{cakes:4,progress:16,completionDelay:7});f.flush();
 assert.equal(f.press.typeId,'minecraft:air');assert.equal(dropped(f)[1].amount,4);assert.equal(f.registry().length,0);
 const saved=snapshot(f),drops=dropped(f).map(s=>[s.typeId,s.amount]);
 f.tick(20);assert.deepEqual(snapshot(f),saved);assert.equal(f.readVat().buckets,0);
 assert.deepEqual(dropped(f).map(s=>[s.typeId,s.amount]),drops);assert.equal(f.registry().length,0);
});
test('rejected block removal restores the source and durable press registration without drops',async()=>{
 const f=await fixture({press:{cakes:4,progress:16,completionDelay:8}}),before=snapshot(f);
 failOnce(f,(key,value)=>key==='permutation_before'&&value.type.id==='minecraft:air');breakBlock(f,f.press);
 // The registered timer advances before the queued break; that tick is retained by rollback.
 before[stateKey(PRESS,f.press)]=JSON.stringify(core.normalizePress({cakes:4,progress:16,completionDelay:7}));
 assert.equal(f.press.typeId,core.OIL_PRESS_ID);assert.deepEqual(snapshot(f),before);
 assert.equal(f.drops.length,0);assert.equal(f.registry().length,1);assert.equal(recoveries(f).length,0);
});
test('unknown second-drop outcomes retain recovery data and prevent refund or retry of the source',async()=>{
 for(const outcome of ['before','after','unacknowledged']){
  const f=await fixture({press:{cakes:3,progress:5}});
  f.setFault((key,value)=>outcome==='before'?key==='spawn'&&value.typeId===core.OIL_CAKE_ID:
   key===(outcome==='after'?'spawn_after':'spawn_unacknowledged')&&value.getComponent('minecraft:item').itemStack.typeId===core.OIL_CAKE_ID);
  breakBlock(f,f.press);assert.equal(f.press.typeId,'minecraft:air');assert.equal(f.readPress().cakes,0);assert.equal(f.drops.length,outcome==='before'?0:1);
  const [[faultKey,raw]]=recoveries(f),recovery=JSON.parse(raw);
  assert.equal(recovery.phase,'incomplete');assert.equal(JSON.parse(recovery.saved).cakes,3);
  assert.equal(recovery.outputs[0].recovered,true);assert.equal(recovery.outputs[1].attempted,true);assert.equal(recovery.outputs[1].recovered,false);
  f.setFault(()=>false);const replacement=f.block(core.OIL_PRESS_ID,0);f.place(replacement);
  assert.equal(f.dp.get(faultKey),raw);breakBlock(f,replacement);assert.equal(replacement.typeId,core.OIL_PRESS_ID);assert.equal(f.drops.length,outcome==='before'?0:1);
 }
});
function rejectFinalRelease(f,extra=()=>false){let prepared,once=true;f.setFault((key,value)=>{
 if(key.startsWith(FAULT)){
  if(typeof value==='string')prepared=value;
  else if(once){once=false;f.dp.set(key,prepared);return true}
 }
 return extra(key,value);
})}
test('confirmed native drop removal, even a post-apply throw, permits source and registry rollback',async()=>{
 const f=await fixture({press:{cakes:4,progress:16,completionDelay:8}}),before=snapshot(f);
 rejectFinalRelease(f,key=>key==='drop_remove_after');breakBlock(f,f.press);
 before[stateKey(PRESS,f.press)]=JSON.stringify(core.normalizePress({cakes:4,progress:16,completionDelay:7}));
 assert.equal(f.press.typeId,core.OIL_PRESS_ID);assert.deepEqual(snapshot(f),before);
 assert.equal(f.drops.length,0);assert.equal(f.registry().length,1);assert.equal(recoveries(f).length,0);
 f.setFault(()=>false);breakBlock(f,f.press);assert.equal(f.drops.length,2);assert.equal(dropped(f)[1].amount,4);assert.equal(f.registry().length,0);
});
test('break rollback never overwrites a foreign replacement block or saved state',async()=>{
 const f=await fixture({press:{cakes:3,progress:5}});let foreign,once=true;
 const key=stateKey(PRESS,f.press),foreignRaw=JSON.stringify(core.normalizePress({cakes:1}));
 f.setFault(kind=>{if(once&&kind==='spawn_after'){once=false;foreign=f.block('minecraft:stone',0);f.dp.set(key,foreignRaw)}return false});
 breakBlock(f,f.press);assert.equal(foreign.typeId,'minecraft:stone');assert.equal(f.dp.get(key),foreignRaw);assert.equal(f.drops.length,0);
 const recovery=JSON.parse(recoveries(f)[0][1]);assert.equal(recovery.phase,'incomplete');assert.equal(JSON.parse(recovery.saved).cakes,3);assert.equal(recovery.sourceRecovered,false);
});
test('unconfirmed drop removal keeps the paid packed vat and never recreates its source',async()=>{
 const f=await fixture();rejectFinalRelease(f,key=>key==='drop_remove_noop');breakBlock(f,f.vat);
 assert.equal(f.vat.typeId,'minecraft:air');assert.equal(f.readVat().buckets,0);assert.equal(f.drops.length,1);
 const {getItemProperty}=await f.h.load('itemData.js');assert.equal(getItemProperty(dropped(f)[0],N+'vat_buckets'),4);
 const recovery=JSON.parse(recoveries(f)[0][1]);assert.equal(recovery.phase,'incomplete');assert.equal(recovery.outputs[0].confirmed,true);assert.equal(recovery.outputs[0].recovered,false);assert.equal(recovery.sourceRecovered,false);
});
for(const change of ['air','same-type-instance'])test(`deferred vat use refuses ${change} without changing the captured bucket`,async()=>{
 const f=await fixture({count:1});assert.equal(f.use().cancel,true);let current=f.vat;
 if(change==='air')current.setType('minecraft:air');else{current=f.block(core.BIG_VAT_ID,f.vat.x);f.place(current);f.seedVat(current,{type:'canola',buckets:4})}
 const before=snapshot(f);f.flush();assert.deepEqual(snapshot(f),before);assert.equal(f.drops.length,0);
 assert.equal(f.held().typeId,'minecraft:bucket');assert.equal(f.held().amount,1);assert.equal(f.holder.inventory.getItem(1),undefined);
 assert.equal(current.typeId,change==='air'?'minecraft:air':core.BIG_VAT_ID);assert.equal(f.readVat(current).buckets,4);
});
test('packed vat item can be placed through the real interaction callback with its oil intact',async()=>{
 const f=await fixture({count:1}),support=f.block('minecraft:stone',10),target=f.h.block('minecraft:air',{x:10,y:65,z:0});
 f.setHand(f.api.a26VatItem({type:'secret_chili',buckets:6}));use(f,support);
 assert.equal(target.typeId,core.BIG_VAT_ID);assert.deepEqual(f.readVat(target),{type:'secret_chili',buckets:6});assert.equal(f.held(),undefined);
});

// Keep the source pickup/place rollback cases from the retired source-slicing file.
for(const count of [1,16])for(const creative of [false,true])test(`world-source pickup with ${count} bucket(s), creative ${creative}, follows real container delivery`,async()=>{
 const f=await fixture({worldOil:true,count,creative}),source=f.block(N+'canola_oil',20);
 source.setPermutation(source.permutation.withState(N+'level',0));use(f,source);
 assert.equal(source.typeId,'minecraft:air');assert.equal(f.held().typeId,creative||count>1?'minecraft:bucket':N+'canola_oil_bucket');
 assert.equal(f.held().amount,creative?count:count>1?count-1:1);
 assert.equal(f.holder.inventory.getItem(1)?.typeId,creative||count>1?N+'canola_oil_bucket':undefined);
});
test('world-source output failure restores the source and entire empty-bucket stack',async()=>{
 const f=await fixture({worldOil:true}),source=f.block(N+'canola_oil',20);source.setPermutation(source.permutation.withState(N+'level',0));
 failOnce(f,key=>key==='slot1');use(f,source);
 assert.equal(f.held().amount,16);assert.equal(f.holder.inventory.getItem(1),undefined);assert.equal(source.typeId,N+'canola_oil');
});
test('world-source registry failure rolls back placement and the original oil bucket',async()=>{
 const f=await fixture({worldOil:true,count:1}),support=f.block('minecraft:stone',20),target=f.h.block('minecraft:air',{x:20,y:65,z:0});
 const {OIL_REG_PREFIX}=await f.h.load('oil_source_registry_core.js');f.setHand(f.item(N+'canola_oil_bucket'));
 failOnce(f,key=>key.startsWith(OIL_REG_PREFIX));use(f,support);
 assert.equal(target.typeId,'minecraft:air');assert.equal(f.held().typeId,N+'canola_oil_bucket');
 assert.equal(f.world.getDynamicPropertyIds().filter(key=>key.startsWith(OIL_REG_PREFIX)).length,0);
});
test('world-fluid placement cannot overwrite another oil or an existing source',async()=>{
 for(const type of ['canola','secret_chili']){
  const f=await fixture({worldOil:true,count:1}),support=f.block('minecraft:stone',20),target=f.h.block(N+'canola_oil',{x:20,y:65,z:0},{states:{[N+'level']:0}});
  f.setHand(f.item(N+type+'_oil_bucket'));use(f,support);
  assert.equal(target.typeId,N+'canola_oil');assert.equal(target.permutation.getState(N+'level'),0);assert.equal(f.held().typeId,N+type+'_oil_bucket');
 }
});
}

import {createOilPressScheduler,OIL_PRESS_TICK_NAME} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/oil_press_registry.js';
function pressFixture(step){
 let tick=0,scheduled=false,fail=false,schedules=0;
 const errors=[];
 const block={dimension:{id:'overworld'},x:0,y:64,z:0,
  hasScheduledNamedTick(name){assert.equal(name,OIL_PRESS_TICK_NAME);if(fail)throw Error('unloaded');return scheduled},
  scheduleNamedTick(name,delay){assert.equal(name,OIL_PRESS_TICK_NAME);assert.equal(delay,1);scheduled=true;schedules++}};
 const scheduler=createOilPressScheduler({now:()=>tick,step,report:e=>errors.push(e)});
 const eventFor=(name=OIL_PRESS_TICK_NAME,owner='grilling')=>({block,isName:expected=>owner==='grilling'&&name===expected});
 const event=eventFor();
 return {block,scheduler,event,eventFor,errors,fire(){assert.equal(scheduled,true);scheduled=false;tick++;return scheduler.onNamedTick(event)},
  set fail(value){fail=value},get schedules(){return schedules},get scheduled(){return scheduled}};
}

test('native scheduling is idempotent and unrelated named ticks do not run work',()=>{
 let calls=0;const f=pressFixture(()=>{calls++;return true});
 assert(f.scheduler.ensure(f.block));assert(f.scheduler.ensure(f.block));
 assert.equal(f.schedules,1);assert.equal(f.scheduler.onNamedTick(f.eventFor('other_work')),false);
 assert.equal(calls,0);assert.equal(f.scheduled,true);assert.deepEqual(f.errors,[]);
});
test('a duplicate callback cannot decrement twice in one game tick',()=>{
 let remaining=3;const f=pressFixture(()=>--remaining>0);f.scheduler.ensure(f.block);
 assert.equal(f.fire(),true);assert.equal(f.scheduler.onNamedTick(f.event),false);
 assert.equal(remaining,2);assert.equal(f.schedules,2);
 f.fire();f.fire();assert.equal(remaining,0);assert.equal(f.scheduled,false);
 assert.equal(f.schedules,3);assert.deepEqual(f.errors,[]);
});
test('completion consumes the native tick without rearming or reporting a cancellation error',()=>{
 let calls=0;const f=pressFixture(()=>{calls++;return false});f.scheduler.ensure(f.block);
 assert.equal(f.fire(),true);assert.equal(calls,1);assert.equal(f.scheduled,false);
 assert.equal(f.schedules,1);assert.deepEqual(f.errors,[]);
});
test('a transient unloaded block can be scheduled again without consuming work',()=>{
 let calls=0;const f=pressFixture(()=>{calls++;return false});f.fail=true;
 assert.equal(f.scheduler.ensure(f.block),false);assert.equal(calls,0);assert.equal(f.schedules,0);
 assert.match(f.errors[0].message,/unloaded/);
 f.fail=false;assert(f.scheduler.ensure(f.block));assert.equal(f.fire(),true);
 assert.equal(calls,1);assert.equal(f.scheduled,false);assert.equal(f.schedules,1);assert.equal(f.errors.length,1);
});
test('step failure is contained and a later recovery attempt can rearm',()=>{
 let broken=true,calls=0;const f=pressFixture(()=>{calls++;if(broken)throw Error('retained data');return false});
 f.scheduler.ensure(f.block);assert.equal(f.fire(),false);assert.equal(f.errors.length,1);
 assert.match(f.errors[0].message,/retained data/);assert.equal(f.scheduled,false);assert.equal(f.schedules,1);
 broken=false;assert(f.scheduler.ensure(f.block));assert.equal(f.fire(),true);
 assert.equal(calls,2);assert.equal(f.scheduled,false);assert.equal(f.schedules,2);assert.equal(f.errors.length,1);
});

test('an identically named tick from another script owner cannot run or rearm work',()=>{
 let calls=0;const f=pressFixture(()=>{calls++;return true});f.scheduler.ensure(f.block);
 assert.equal(f.scheduler.onNamedTick(f.eventFor(OIL_PRESS_TICK_NAME,'other-script')),false);
 assert.equal(calls,0);assert.equal(f.scheduled,true);assert.equal(f.schedules,1);assert.deepEqual(f.errors,[]);
});
