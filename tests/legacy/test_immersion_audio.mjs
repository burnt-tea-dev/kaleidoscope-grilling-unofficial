import test from 'node:test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createFixture} from '../helpers/minecraft-fixture.mjs';
import {createGrillAudioController,GRILL_LOOP_TICKS,playSeasoningShakeAudio,stopSoundHandle} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/immersion_audio_core.js';
// Native sound-operation doubles; no Minecraft or simulated player is constructed.
function fixture(){
 const starts=[],stops=[];
 const audio=createGrillAudioController({play:station=>{
  const id=starts.length;starts.push(station);return {stop(){stops.push(id)}};
 }});
 return {audio,starts,stops};
}
test('cold and lit empty grills remain quiet',()=>{
 const {audio,starts}=fixture();audio.update('a',{},false,0);audio.sweep(20);
 assert.equal(starts.length,0);assert.equal(audio.size,0);
});
test('a loaded occupied grill starts once, and renews without overlapping handles',()=>{
 const {audio,starts,stops}=fixture();
 for(let t=0;t<GRILL_LOOP_TICKS;t++)audio.update('a',{x:1},true,t);
 assert.equal(starts.length,1);assert.deepEqual(stops,[]);
 audio.update('a',{x:1},true,GRILL_LOOP_TICKS);
 assert.equal(starts.length,2);assert.deepEqual(stops,[0]);
});
test('taking the last skewer or extinguishing stops only that grill',()=>{
 const {audio,starts,stops}=fixture();audio.update('a',{},true,0);audio.update('b',{},true,0);
 audio.update('a',{},false,1);assert.deepEqual(stops,[0]);assert.equal(audio.size,1);
 audio.update('b',{},true,2);assert.equal(starts.length,2);
});
test('destruction is immediate and does not stop another grill',()=>{
 const {audio,stops}=fixture();audio.update('a',{},true,0);audio.update('b',{},true,0);
 audio.remove('a');audio.remove('a');assert.deepEqual(stops,[0]);assert.equal(audio.size,1);
});
test('chunk unload expires the stale handle; reload starts a fresh instance',()=>{
 const {audio,starts,stops}=fixture();audio.update('a',{},true,0);audio.sweep(8);
 assert.equal(audio.size,1);audio.sweep(9);assert.deepEqual(stops,[0]);assert.equal(audio.size,0);
 audio.update('a',{},true,10);assert.equal(starts.length,2);
});
test('a failing sound start retries with bounded work and cannot alter station data',()=>{
 let attempts=0;const station=Object.freeze({lit:true,count:3});
 const audio=createGrillAudioController({play:()=>{attempts++;throw Error('sound unavailable')}});
 for(let tick=0;tick<40;tick++)audio.update('a',station,true,tick);
 assert.equal(attempts,2);assert.deepEqual(station,{lit:true,count:3});audio.update('a',station,false,40);
 assert.equal(audio.size,0);
});
test('shake release stops the local clip without cancelling the observer world one-shot',()=>{
 const calls=[],stops=[],origin={x:-.5,y:64.5,z:2.5};
 const listener=id=>({id,playSound(sound,options){calls.push({id,sound,options});return {stop(){stops.push(id)}}}});
 const owner=listener('owner'),observer=listener('observer');
 const handle=playSeasoningShakeAudio(owner,[owner,observer],origin);
 assert.equal(calls.length,2);assert.ok(!Object.hasOwn(calls[0].options,'location'),'local clip must not be pinned to the start position');
 assert.deepEqual(calls[1].options,{location:origin,volume:.8,pitch:1});
 stopSoundHandle(handle);assert.deepEqual(stops,['owner']);
});

test('native loop retains one handle rather than restarting on the old duration',()=>{
 let starts=0,stops=0;const handle={stop(){stops++}};
 const c=createGrillAudioController({nativeLoop:true,play:()=>{starts++;return handle}});
 for(let t=0;t<2000;t++)c.update('a',{},true,t);
 assert.equal(starts,1);assert.equal(stops,0);c.update('a',{},false,2000);assert.equal(stops,1);assert.equal(c.size,0);
});
test('removing or unloading one grill does not stop a different station',()=>{
 const stopped=[];const c=createGrillAudioController({nativeLoop:true,play:s=>({stop:()=>stopped.push(s.id)})});
 c.update('a',{id:'a'},true,0);c.update('b',{id:'b'},true,0);c.remove('a');
 assert.deepEqual(stopped,['a']);c.update('b',{id:'b'},true,20);c.sweep(20);assert.equal(c.size,1);
 c.sweep(29);assert.deepEqual(stopped,['a','b']);assert.equal(c.size,0);
});
test('missing native handles retry at the existing bounded cadence',()=>{
 let attempts=0;const c=createGrillAudioController({nativeLoop:true,play:()=>{attempts++;return undefined}});
 assert.equal(c.update('a',{},true,0),false);for(let t=1;t<20;t++)c.update('a',{},true,t);
 assert.equal(attempts,1);c.update('a',{},true,20);assert.equal(attempts,2);
});

test('runtime requests a continuous native grill sound and stops each station independently',async()=>{
 const f=createFixture(),instances=[];
 try{
  // Model the documented native boundary: omitted loopCount is a one-shot.
  // Keep the real runtime adapter so a misspelled option cannot pass through
  // a controller-only fake which returns an indefinitely valid handle.
  f.dimension.playSound=(sound,location,options={})=>{
   const row={sound,location,playing:true,stops:0};instances.push(row);
   if(options.loopCount!==-1)f.system.runTimeout(()=>{row.playing=false},GRILL_LOOP_TICKS);
   return {stop(){row.playing=false;row.stops++}};
  };
  const {updateGrillAudio,removeGrillAudio}=await f.load('immersion_audio_runtime.js');
  const first=f.block('kaleidoscope_grilling:grill',{x:0,y:64,z:0});
  const second=f.block('kaleidoscope_grilling:grill',{x:4,y:64,z:0});
  for(let tick=0;tick<GRILL_LOOP_TICKS*2;tick++){
   updateGrillAudio(first,true,1);updateGrillAudio(second,true,1);f.tick();
  }
  assert.equal(instances.length,2,'each occupied grill starts only one sound');
  assert(instances.every(row=>row.sound==='kg_imm.grill_loop'&&row.playing),'both native loops continue past the clip duration');
  updateGrillAudio(first,false,1);
  assert.equal(instances[0].playing,false);assert.equal(instances[0].stops,1);
  assert.equal(instances[1].playing,true);assert.equal(instances[1].stops,0);
  removeGrillAudio(second);assert.equal(instances[1].stops,1);
 }finally{f.dispose()}
});

const N='kaleidoscope_grilling:';
test('grill bounds background lookups for missing linked storage and resumes with the saved skewer',async()=>{
 const f=createFixture({currentTick:1197});
 try{
  await f.load('main.js');f.startup();f.flush();
  const storage=await f.load('core/storage.js'),state=await f.load('grill/grill_state_adapter.js');
  const grill=f.block(N+'grill',{x:0,y:80,z:0});f.block('minecraft:stone',{x:0,y:79,z:0});
  const inventory=storage.stationContainer(grill),ledgerKey=storage.storageKey(grill);
  const entityId=JSON.parse(f.world.getDynamicProperty(ledgerKey)).entity;
  const saved=f.item(N+'raw_fish_skewer',1,{nameTag:'Saved skewer'});
  saved.setLore(['Original lore']);inventory.setItem(0,saved);
  f.world.setDynamicProperty(state.grillStateKey(grill),JSON.stringify({lit:true,phase:1}));

  let missing=false,idLookups=0,nearbyLookups=0,starts=0,stops=0;
  const getEntity=f.world.getEntity.bind(f.world),getEntities=f.dimension.getEntities.bind(f.dimension);
  f.world.getEntity=id=>{
   if(id===entityId){idLookups++;if(missing)return undefined;}
   return getEntity(id);
  };
  f.dimension.getEntities=query=>{
   if(query?.type===N+'inventory_grill_v1')nearbyLookups++;
   return getEntities(query).filter(entity=>!missing||entity.id!==entityId);
  };
  f.dimension.playSound=sound=>{
   if(sound==='kg_imm.grill_loop'){starts++;return {stop(){stops++}};}
  };
  function tickGrill(){f.system.currentTick++;f.component(N+'grill_tick','onTick',{block:grill});}
  tickGrill();
  assert.deepEqual([idLookups,nearbyLookups],[1,0]);assert.equal(starts,1);
  const before=f.snapshotProperties(),expectedWarning=
   '[Grilling tick] StorageUnavailable: Grilling storage unavailable: linked inventory is unavailable; contents not reset';
  const warnings=()=>f.logs.filter(log=>log.level==='warn').map(log=>log.text);

  missing=true;idLookups=nearbyLookups=0;
  for(let elapsed=0;elapsed<1200;elapsed++)tickGrill();
  assert.equal(stops,1);assert.equal(starts,1);
  assert.deepEqual(f.snapshotProperties(),before);
  assert.deepEqual(warnings(),[expectedWarning]);
  assert.deepEqual([idLookups,nearbyLookups],[60,60],'one ID and local query per 20 missing ticks');

  const player=f.player({location:{x:1,y:80,z:0}});
  idLookups=nearbyLookups=0;tickGrill();
  assert.deepEqual([idLookups,nearbyLookups],[1,1],'nearby display respects the failed tick lookup');
  assert.deepEqual(warnings(),[expectedWarning,expectedWarning]);
  const interact=()=>f.component(N+'grill_tick','onPlayerInteract',{block:grill,player});
  assert.throws(interact,/linked inventory is unavailable/);
  assert.deepEqual([idLookups,nearbyLookups],[2,2],'interaction still attempts the original lookup');

  missing=false;
  for(let elapsed=0;elapsed<19;elapsed++)tickGrill();
  assert.deepEqual([idLookups,nearbyLookups],[2,2]);
  assert.deepEqual(f.snapshotProperties(),before);
  tickGrill();
  assert.equal(starts,2);assert.equal(stops,1);
  assert.equal(f.world.getDynamicProperty(ledgerKey),before[ledgerKey]);
  assert.equal(state.readGrillState(grill).phaseTicks,2);
  const after=inventory.getItem(0);
  assert.equal(after.typeId,saved.typeId);assert.equal(after.amount,saved.amount);
  assert.equal(after.nameTag,saved.nameTag);assert.deepEqual(after.getLore(),saved.getLore());
  assert.equal(f.drops.length,0);

  missing=true;tickGrill();assert.equal(stops,2);
  missing=false;interact();
  assert.equal(state.readGrillState(grill).flips,1,'normal interaction sees a returning original before the background retry');
  tickGrill();assert.equal(starts,3,'successful interaction wakes the next audio update');

  f.world.setDynamicProperty(ledgerKey,'{');tickGrill();
  f.world.setDynamicProperty(ledgerKey,before[ledgerKey]);tickGrill();
  assert.equal(starts,4,'ledger errors do not enter the missing-inventory retry window');
 }finally{f.dispose()}
});
async function interactionFixture(){
 const f=createFixture();await f.load('main.js');f.startup();f.flush();
 f.p=f.player({location:{x:-.2,y:80.9,z:2.1}});
 f.grill=f.block(N+'grill',{x:-2,y:80,z:0});
 f.block('minecraft:stone',{x:-2,y:79,z:0});
 f.use=()=>{f.emit('world.beforeEvents.playerInteractWithBlock',{block:f.grill,player:f.p,itemStack:f.p.main,blockFace:'Up',isFirstEvent:true,cancel:false});f.flush()};
 return f;
}
test('ignition respects tool durability and Unbreaking while preserving Java sounds and redundant-use silence',async()=>{
 const f=await interactionFixture(),random=Math.random;
 try{
  Math.random=()=>.25;f.p.main=f.item('minecraft:flint_and_steel');f.use();
  assert.equal(f.p.main.getComponent('minecraft:durability').damage,1);
  const ignition=f.sounds.filter(s=>s.sound==='fire.ignite');assert.equal(ignition.length,1);
  assert.deepEqual(ignition[0].options,{volume:1,pitch:.9});assert.deepEqual(ignition[0].location,{x:-1.5,y:80.5,z:.5});
  f.use();assert.equal(f.sounds.filter(s=>s.sound==='fire.ignite').length,1);
  let draws=0;Math.random=()=>[.75,.25][draws++%2];
  f.p.main=f.item('minecraft:iron_shovel');f.use();
  const fizz=f.sounds.filter(s=>s.sound==='random.fizz');assert.equal(fizz.length,1);
  assert.deepEqual(fizz[0].options,{volume:.5,pitch:3});assert.deepEqual(fizz[0].location,ignition[0].location);
  f.use();assert.equal(f.sounds.filter(s=>s.sound==='random.fizz').length,1);
  const tool=f.item('minecraft:flint_and_steel',1,{nameTag:'Lasting spark',enchantments:[{id:'unbreaking',level:3}]}),durability=tool.getComponent('minecraft:durability');
  durability.damage=durability.maxDurability-1;
  f.p.main=tool;Math.random=()=>.75;f.use();
  assert.equal(f.p.main?.typeId,'minecraft:flint_and_steel','Unbreaking can preserve the last durability point');
  assert.equal(f.p.main.nameTag,'Lasting spark');
  assert.equal(f.p.main.getComponent('minecraft:durability').damage,durability.damage);
  assert.equal(f.sounds.filter(s=>s.sound==='fire.ignite').length,2);
  const saved=f.p.main;
  f.p.main=f.item('minecraft:iron_shovel');f.use();
  f.p.main=saved;Math.random=()=>0;f.use();
  assert.equal(f.p.main,undefined,'an accepted damage roll still breaks at the normal limit');
  assert.equal(f.sounds.filter(s=>s.sound==='random.break').length,1);
  assert.equal(f.sounds.filter(s=>s.sound==='fire.ignite').length,3);
 }finally{Math.random=random;f.dispose()}
});
test('thread, disassemble and grill insert emit exactly one action-specific category after successful mutation',async()=>{
 const f=await interactionFixture();
 try{
  const definitions=JSON.parse(await readFile(new URL('../../projects/grilling/gameplay_core/resource_pack/sounds/sound_definitions.json',import.meta.url),'utf8')).sound_definitions;
  f.p.main=f.item('minecraft:cod',2);f.p.off=f.item('minecraft:stick');
  f.emit('world.beforeEvents.itemUse',{source:f.p,itemStack:f.p.main,cancel:false});f.flush();
  let actions=f.sounds.filter(s=>s.sound.startsWith('kg_imm.'));
  assert.equal(actions.length,1);assert.equal(definitions[actions[0].sound].category,'player');
  assert.deepEqual(actions[0].options,{volume:.7,pitch:1});assert.deepEqual(actions[0].location,{x:-.5,y:80.5,z:2.5});
  assert.equal(f.p.main.amount,1);assert.equal(f.p.off.typeId,N+'raw_fish_skewer');
  f.p.main=undefined;f.p.isSneaking=true;
  const blockUse=f.emit('world.beforeEvents.playerInteractWithBlock',{block:f.grill,player:f.p,itemStack:f.p.main,blockFace:'Up',isFirstEvent:true,cancel:false});
  if(!blockUse.cancel)f.emit('world.beforeEvents.itemUse',{source:f.p,itemStack:f.p.off,cancel:false});
  f.flush();
  actions=f.sounds.filter(s=>s.sound.startsWith('kg_imm.'));assert.equal(actions.length,2);
  assert.equal(definitions[actions[1].sound].category,'player');assert.deepEqual(actions[1].options,{volume:.8,pitch:1});
  assert.deepEqual(actions[1].location,actions[0].location);f.use();assert.equal(f.sounds.filter(s=>s.sound.startsWith('kg_imm.')).length,2);
  f.p.isSneaking=false;f.p.main=f.item('minecraft:flint_and_steel');f.use();
  f.p.main=f.item(N+'raw_fish_skewer');f.use();
  const insert=f.sounds.filter(s=>s.sound==='kg_imm.action_success');assert.equal(insert.length,1);
  assert.equal(definitions[insert[0].sound].category,'block');assert.deepEqual(insert[0].options,{volume:.65,pitch:1});
  assert.deepEqual(insert[0].location,{x:-1.5,y:80.5,z:.5});
 }finally{f.dispose()}
});
test('fire pitch extrema follow uniform ignition and triangular extinguish formulas without changing loop origin',async()=>{
 const f=createFixture();
 try{
  const {grillFireSound,updateGrillAudio}=await f.load('immersion_audio_runtime.js');
  const block=f.block(N+'grill',{x:1,y:64,z:3});
  for(const r of [0,.25,.5,.75,1-2**-24]){
   let draws=0;grillFireSound(block,true,()=>{draws++;return r});assert.equal(draws,1);
   const sound=f.sounds.at(-1);assert.equal(sound.options.volume,1);assert.equal(sound.options.pitch,.8+r*.4);
   assert(sound.options.pitch>=.8&&sound.options.pitch<1.2);
  }
  for(const a of [0,.5,1-2**-24])for(const b of [0,.5,1-2**-24]){
   let draws=0;grillFireSound(block,false,()=>[a,b][draws++]);assert.equal(draws,2);
   const sound=f.sounds.at(-1);assert.equal(sound.options.volume,.5);assert.equal(sound.options.pitch,2.6+(a-b)*.8);
   assert(sound.options.pitch>1.8&&sound.options.pitch<3.4);
  }
  updateGrillAudio(block,true,1);assert.deepEqual(f.sounds.at(-1).location,{x:1.5,y:64.35,z:3.5});
 }finally{f.dispose()}
});
test('failed ignition hand commit produces no ignition sound',async()=>{
 const f=await interactionFixture();
 try{
  f.p.main=f.item('minecraft:flint_and_steel');
  f.p.inventory.setItem=()=>{throw Error('injected denied tool write')};
  f.use();assert.equal(f.sounds.filter(s=>s.sound==='fire.ignite').length,0);
  const state=await f.load('grill/grill_state_adapter.js');assert.equal(state.readGrillState(f.grill).lit,false);
 }finally{f.dispose()}
});

async function cuisineFixture(type='pot',ready=true){
 const f=await interactionFixture();
 f.station=f.block('kaleidoscope_cookery:'+type,{x:5,y:80,z:5});
 f.cuisine=await f.load('food/cookery_cuisine_runtime.js');
 f.food=await f.load('food/food_state_adapter.js');
 f.data=await f.load('core/persist.js');
 f.bottle=f.item(N+'special_seasoning');
 f.food.setFoodSeasonings(f.bottle,[N+'green_chili_powder',N+'onion_powder']);
 f.data.setItemProperty(f.bottle,N+'uses',15);f.p.main=f.bottle;
 if(ready)f.emit('system.afterEvents.scriptEventReceive',{
  id:'kaleidoscope_cookery:api_ready',sourceType:'Server',
  message:JSON.stringify({api:1,capabilities:['cuisine_output_receipt_v2']})
 });
 f.season=(first=true)=>f.emit('world.beforeEvents.playerInteractWithBlock',{
  block:f.station,player:f.p,itemStack:f.p.main,blockFace:'Up',isFirstEvent:first,cancel:false
 });
 return f;
}
for(const type of ['pot','stockpot'])test(type+' seasoning broadcasts once at the player BlockPos in PLAYERS after commit',async()=>{
 const f=await cuisineFixture(type);
 try{
  const definitions=JSON.parse(await readFile(new URL('../../projects/grilling/gameplay_core/resource_pack/sounds/sound_definitions.json',import.meta.url),'utf8')).sound_definitions;
  f.season();f.flush();
  const sounds=f.sounds.filter(s=>s.sound==='kg_imm.cuisine_season');
  assert.equal(sounds.length,1);assert.strictEqual(sounds[0].source,f.dimension);
  assert.deepEqual(sounds[0].location,{x:-.5,y:80.5,z:2.5});
  assert.deepEqual(sounds[0].options,{volume:.85,pitch:1});
  assert.equal(definitions[sounds[0].sound].category,'player');
  assert.deepEqual(definitions[sounds[0].sound].sounds,definitions['kg_imm.season'].sounds);
  assert.equal(definitions['kg_imm.season'].category,'block','grill seasoning keeps its BLOCKS category');
  assert.equal(f.sounds.filter(s=>s.sound==='kg_imm.season').length,0,'no private duplicate');
  assert.deepEqual(f.cuisine.readCuisineExtensionState(f.station).seasoning,[N+'green_chili_powder',N+'onion_powder']);
  assert.equal(f.p.main.typeId,N+'empty_seasoning_bottle');
 }finally{f.dispose()}
});
for(const mode of ['host unavailable','empty ingredients','hand changed','repeated input','commit rejected'])test('cuisine seasoning is silent when '+mode,async()=>{
 const f=await cuisineFixture('pot',mode!=='host unavailable');
 try{
  if(mode==='empty ingredients'){
   f.food.setFoodSeasonings(f.bottle,[]);f.p.main=f.bottle;
  }
  if(mode==='commit rejected')f.faults.failNext(f.p.inventory,'setItem',{
   phase:'before',predicate:(slot,stack)=>stack?.typeId===N+'empty_seasoning_bottle'
  });
  f.season(mode!=='repeated input');
  if(mode==='hand changed')f.p.main=f.item('minecraft:stick');
  f.flush();
  assert.equal(f.sounds.filter(s=>s.sound==='kg_imm.cuisine_season'||s.sound==='kg_imm.season').length,0);
  assert.deepEqual(f.cuisine.readCuisineExtensionState(f.station).seasoning,[]);
 }finally{f.dispose()}
});
