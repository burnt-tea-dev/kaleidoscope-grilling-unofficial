import assert from 'node:assert/strict';
import test from 'node:test';
import {createFixture} from '../helpers/minecraft-fixture.mjs';
import {SEASONING_USES_KEY,SEASONING_VARIANT_KEY} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/seasoning/seasoning_contract_core.js';

const N='kaleidoscope_grilling:';
const ingredients=[N+'green_chili_powder',N+'sichuan_pepper',N+'onion_powder'];
const hint='tooltip.kaleidoscope_grilling.seasoning.';
const pendingLore=[
 {translate:hint+'uses',with:['7','16']},
 {translate:hint+'ingredients',with:['8','8']},
 {translate:hint+'ready'},
 {translate:hint+'missing_base'},
];
const finishedLore=[
 {translate:hint+'uses',with:['16','16']},
 {translate:hint+'ingredients',with:['3','8']},
];
const foreignLore=value=>[{text:'foreign retained'},{translate:'foreign.bottle.owner',with:[value]}];

test('pending completion retains current native metadata and refreshes owned state',async t=>{
 const f=createFixture();t.after(()=>f.dispose());await f.load('main.js');f.startup();f.tick(1);
 const data=await f.load('core/persist.js'),food=await f.load('food/food_state_adapter.js');
 const stack=f.item(N+'pending_seasoning_f3',1,{nameTag:'Owned bottle',keepOnDeath:true,lockMode:'slot',canDestroy:['minecraft:stone'],canPlaceOn:['minecraft:dirt'],rawLore:[...foreignLore('original'),...pendingLore]});
 data.setItemProperty(stack,'foreign:owner','retained');food.setFoodSeasonings(stack,ingredients);
 data.setItemProperty(stack,SEASONING_USES_KEY,9);data.setItemProperty(stack,SEASONING_VARIANT_KEY,1);
 const p=f.player({main:stack});
 f.emit('world.afterEvents.itemStartUse',{source:p,itemStack:p.main.clone(),useDuration:80});
 f.tick(80);
 // The completion event can lag public metadata changes on the held bottle.
 const eventStack=p.main,current=p.main;
 current.keepOnDeath=false;current.lockMode='inventory';
 current.setCanDestroy(['minecraft:glass']);current.setCanPlaceOn(['minecraft:stone']);
 data.setItemLore(current,[...foreignLore('updated'),...pendingLore]);p.main=current;
 f.emit('world.afterEvents.itemCompleteUse',{source:p,itemStack:eventStack,useDuration:0});
 const actual=p.main;
 const selected=/^kaleidoscope_grilling:special_seasoning_r8_v([0-7])$/.exec(actual?.typeId);
 assert.ok(selected,'completion reached a full SPECIAL bottle');
 const envelope=s=>({amount:s.amount,name:s.nameTag,keepOnDeath:s.keepOnDeath,lockMode:s.lockMode,canDestroy:s.getCanDestroy(),canPlaceOn:s.getCanPlaceOn(),foreign:data.getItemProperty(s,'foreign:owner')});
 assert.deepEqual(envelope(actual),envelope(current));
 assert.deepEqual(data.getItemRawLore(actual),[...foreignLore('updated'),...finishedLore]);
 assert.deepEqual(food.readFoodSeasonings(actual),ingredients);
 assert.equal(data.getItemProperty(actual,SEASONING_USES_KEY),0);
 assert.equal(data.getItemProperty(actual,SEASONING_VARIANT_KEY),Number(selected[1]));
});

test('simulated offhand completion restores current metadata after a failed write and retries',async t=>{
 const f=createFixture();t.after(()=>f.dispose());await f.load('main.js');f.startup();f.tick(1);
 const data=await f.load('core/persist.js'),snapshot=await f.load('skewer_item_snapshot.js');
 const food=await f.load('food/food_state_adapter.js');const bottle=f.item(N+'pending_seasoning_f3',1,{nameTag:'Offhand bottle'});
 food.setFoodSeasonings(bottle,ingredients);const p=f.player({off:bottle});
 f.emit('world.afterEvents.itemStartUse',{source:p,itemStack:p.off.clone(),useDuration:80});f.tick(80);
 const eventStack=p.off,current=p.off;
 current.keepOnDeath=true;current.setCanPlaceOn(['minecraft:stone']);p.off=current;
 const before=snapshot.captureSkewerMetadata(current);
 f.faults.failNext(p.equipment,'setEquipment',{phase:'after',predicate:(_slot,stack)=>stack?.typeId.startsWith(N+'special_seasoning')});
 f.emit('world.afterEvents.itemCompleteUse',{source:p,itemStack:eventStack,useDuration:0});
 assert.equal(f.faults.pending.length,0,'the completed-bottle write was attempted');
 assert.deepEqual(snapshot.captureSkewerMetadata(p.off),before,'rollback retains the current pending bottle');

 f.emit('world.afterEvents.itemStartUse',{source:p,itemStack:p.off.clone(),useDuration:80});f.tick(80);
 f.emit('world.afterEvents.itemCompleteUse',{source:p,itemStack:p.off.clone(),useDuration:0});
 assert.ok(p.off?.typeId.startsWith(N+'special_seasoning'),'retry reaches SPECIAL');
 assert.equal(p.off.nameTag,'Offhand bottle');assert.equal(p.off.keepOnDeath,true);
 assert.deepEqual(p.off.getCanPlaceOn(),['minecraft:stone']);
 assert.deepEqual(data.getItemRawLore(p.off),finishedLore);
 assert.deepEqual(food.readFoodSeasonings(p.off),ingredients);
});

test('pending completion refuses a rejected variant refresh and can retry',async t=>{
 const f=createFixture();t.after(()=>f.dispose());await f.load('main.js');f.startup();f.tick(1);
 const data=await f.load('core/persist.js'),food=await f.load('food/food_state_adapter.js');
 const snapshot=await f.load('skewer_item_snapshot.js');
 const bottle=f.item(N+'pending_seasoning_f3',1,{nameTag:'Retry bottle',rawLore:foreignLore('retained')});
 food.setFoodSeasonings(bottle,ingredients);
 data.setItemProperty(bottle,SEASONING_USES_KEY,9);data.setItemProperty(bottle,SEASONING_VARIANT_KEY,1);
 const p=f.player({main:bottle});
 const setCanPlaceOn=f.ItemStack.prototype.setCanPlaceOn;
 let reject=true,rejected=0;
 t.mock.method(Math,'random',()=>.75);
 // Intercept only the native API boundary of newly constructed SPECIAL stacks:
 // copying variant 1 succeeds; refreshing the completed bottle to 6 does not.
 t.mock.method(f.ItemStack.prototype,'setCanPlaceOn',function(list){
  setCanPlaceOn.call(this,list);
  if(this.typeId.startsWith(N+'special_seasoning')){
   const setProperty=this.setDynamicProperty;
   this.setDynamicProperty=(key,value)=>{
    if(reject&&key===SEASONING_VARIANT_KEY&&value===6){rejected++;return;}
    return setProperty(key,value);
   };
  }
 });
 f.emit('world.afterEvents.itemStartUse',{source:p,itemStack:p.main.clone(),useDuration:80});f.tick(80);
 const before=snapshot.captureSkewerMetadata(p.main);
 assert.throws(()=>f.emit('world.afterEvents.itemCompleteUse',{source:p,itemStack:p.main.clone(),useDuration:0}),/Seasoning data write failed/);
 assert.equal(rejected,1);
 assert.deepEqual(snapshot.captureSkewerMetadata(p.main),before,'a rejected refresh leaves the original bottle intact');

 reject=false;
 f.emit('world.afterEvents.itemStartUse',{source:p,itemStack:p.main.clone(),useDuration:80});f.tick(80);
 f.emit('world.afterEvents.itemCompleteUse',{source:p,itemStack:p.main.clone(),useDuration:0});
 assert.equal(p.main.typeId,N+'special_seasoning_r8_v6');
 assert.equal(p.main.nameTag,'Retry bottle');
 assert.equal(data.getItemProperty(p.main,SEASONING_VARIANT_KEY),6);
 assert.equal(data.getItemProperty(p.main,SEASONING_USES_KEY),0);
 assert.deepEqual(data.getItemRawLore(p.main),[...foreignLore('retained'),...finishedLore]);
});

// These scenarios exercise the actual bottle transactions and helper API calls.
// The fake boundary does not render block transformations or glass materials.
for(const [facing,rotation] of [['north',0],['east',90],['south',180],['west',270]])test('bottle '+facing+' placement, stack, empty helpers and pickup keep orientation',async t=>{
 const f=createFixture();t.after(()=>f.dispose());await f.load('main.js');f.startup();f.tick(1);
 const p=f.player({main:f.item(N+'empty_seasoning_bottle',1,{nameTag:'Bottle 1'})});
 const support=f.block('minecraft:stone',{x:0,y:-1,z:0}),block=f.block('minecraft:air',{x:0,y:0,z:0});
 const moves=[];const spawn=p.dimension.spawnEntity;
 t.mock.method(p.dimension,'spawnEntity',function(type,location){
  const e=spawn.call(this,type,location);
  if(type===N+'placed_seasoning_visual'){
   const teleport=e.teleport;
   e.teleport=function(location,opts){moves.push({id:e.id,location:structuredClone(location),rotation:structuredClone(opts.rotation)});return teleport.call(this,location,opts)};
  }
  return e;
 });
 f.component('senluo:grilling_bottle_place','beforeOnPlayerPlace',{player:p,block,face:'Up',permutationToPlace:f.BlockPermutation.resolve(N+'seasoning_bottle_1',{'minecraft:cardinal_direction':facing}),cancel:false});
 f.tick(1);assert.equal(p.main,undefined);assert.equal(block.permutation.getState('minecraft:cardinal_direction'),facing);
 function interact(){const e=f.emit('world.beforeEvents.playerInteractWithBlock',{player:p,block,itemStack:p.main,blockFace:'Up',isFirstEvent:true,cancel:false});assert.equal(e.cancel,true);f.tick(1)}
 for(let count=2;count<=4;count++){
  p.main=f.item(N+'empty_seasoning_bottle',1,{nameTag:'Bottle '+count});interact();
  assert.equal(block.typeId,N+'seasoning_bottle_'+count);assert.equal(block.permutation.getState('minecraft:cardinal_direction'),facing);assert.equal(p.main,undefined);
 }
 f.tick(6);
 const helpers=p.dimension.getEntities({type:N+'placed_seasoning_visual'});
 assert.equal(helpers.length,4);
 const expected={north:[[4,5],[-3,4],[3.5,-3.25],[-4.25,-3.25]],east:[[-5,4],[-4,-3],[3.25,3.5],[3.25,-4.25]],south:[[-4,-5],[3,-4],[-3.5,3.25],[4.25,3.25]],west:[[5,-4],[4,3],[-3.25,-3.5],[-3.25,4.25]]}[facing];
 for(let i=0;i<4;i++){
  assert.equal(helpers[i].getProperty(N+'mode'),0);assert.equal(helpers[i].getProperty(N+'fill'),0);assert.equal(helpers[i].getProperty(N+'ready'),true);
  assert.deepEqual(helpers[i].location,{x:.5+expected[i][0]/16,y:0,z:.5+expected[i][1]/16});
  assert.equal(moves.filter(m=>m.id===helpers[i].id).at(-1).rotation.y,-rotation);
 }
 for(let count=4;count>=1;count--){
  p.main=undefined;interact();assert.equal(p.main.nameTag,'Bottle '+count);
  if(count>1){assert.equal(block.typeId,N+'seasoning_bottle_'+(count-1));assert.equal(block.permutation.getState('minecraft:cardinal_direction'),facing)}
  else assert.equal(block.typeId,'minecraft:air');
 }
 f.tick(6);assert.equal(p.dimension.getEntities({type:N+'placed_seasoning_visual'}).length,0);assert.equal(f.drops.length,0);
});

for(const [yaw,facing] of [[0,'north'],[90,'east'],[180,'south'],[-90,'west']])test('supplemental offhand bottle at yaw '+yaw+' faces '+facing,async t=>{
 const f=createFixture();t.after(()=>f.dispose());await f.load('main.js');f.startup();f.tick(1);
 const p=f.player({off:f.item(N+'empty_seasoning_bottle',1,{nameTag:'Offhand kept'})});p.setRotation({x:0,y:yaw});
 const support=f.block('minecraft:stone',{x:0,y:-1,z:0}),block=f.block('minecraft:air',{x:0,y:0,z:0});
 const e=f.emit('world.beforeEvents.playerInteractWithBlock',{player:p,block:support,itemStack:undefined,blockFace:'Up',isFirstEvent:true,cancel:false});
 assert.equal(e.cancel,true);f.tick(1);assert.equal(p.off,undefined);assert.equal(block.typeId,N+'seasoning_bottle_1');assert.equal(block.permutation.getState('minecraft:cardinal_direction'),facing);
});

test('bottle visual permutations retain the original world-aligned interaction boxes',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const name of ['seasoning_bottle',...Array.from({length:4},(_,i)=>'seasoning_bottle_'+(i+1))]){
  const definition=JSON.parse(await readFile(new URL('../../projects/grilling/gameplay_core/behavior_pack/blocks/'+name+'.json',import.meta.url),'utf8'))['minecraft:block'];
  assert.equal(definition.description.traits['minecraft:placement_direction'].y_rotation_offset,180);
  assert.equal(definition.permutations.length,4);
  for(const permutation of definition.permutations){
   const c=permutation.components,r=c['minecraft:transformation'].rotation[1]*Math.PI/180;
   for(const key of ['minecraft:collision_box','minecraft:selection_box']){
    const source=definition.components[key],box=c[key],o=box.origin,s=box.size;
    const points=[];for(const x of [o[0],o[0]+s[0]])for(const z of [o[2],o[2]+s[2]])points.push([x*Math.cos(r)-z*Math.sin(r),x*Math.sin(r)+z*Math.cos(r)]);
    for(let axis=0;axis<2;axis++){
     const k=axis===0?0:2,min=Math.min(...points.map(p=>p[axis])),max=Math.max(...points.map(p=>p[axis]));
     assert.ok(Math.abs(min-source.origin[k])<1e-8,name+' min '+key);
     assert.ok(Math.abs(max-source.origin[k]-source.size[k])<1e-8,name+' max '+key);
    }
    assert.equal(o[1],source.origin[1]);assert.equal(s[1],source.size[1]);
   }
  }
 }
});

test('failed bottle count permutation restores facing, original stack and source hand',async t=>{
 const f=createFixture();t.after(()=>f.dispose());await f.load('main.js');f.startup();f.tick(1);
 const p=f.player({main:f.item(N+'empty_seasoning_bottle',1,{nameTag:'Source hand'})});
 const block=f.block(N+'seasoning_bottle_1',{x:0,y:0,z:0},{states:{'minecraft:cardinal_direction':'east'}});f.block('minecraft:stone',{x:0,y:-1,z:0});
 const storage=await f.load('core/storage.js'),placed=await f.load('seasoning/seasoning_block_adapter.js');
 const container=storage.stationContainer(block);container.setItem(0,f.item(N+'empty_seasoning_bottle',1,{nameTag:'Original'}));
 placed.writePlacedSeasoningStack(block,[{kind:'empty',ingredients:[],uses:0,variant:0}]);
 f.faults.failNext(block,'setPermutation',{phase:'after',predicate:perm=>perm.type.id===N+'seasoning_bottle_2'});
 const event=f.emit('world.beforeEvents.playerInteractWithBlock',{player:p,block,itemStack:p.main,blockFace:'Up',isFirstEvent:true,cancel:false});assert.equal(event.cancel,true);f.tick(1);
 assert.equal(f.faults.pending.length,0);assert.equal(block.typeId,N+'seasoning_bottle_1');assert.equal(block.permutation.getState('minecraft:cardinal_direction'),'east');
 assert.equal(container.getItem(0).nameTag,'Original');assert.equal(container.getItem(1),undefined);assert.equal(p.main.nameTag,'Source hand');assert.equal(f.drops.length,0);
});

test('one bottle keeps foreign lore from filling through every nonfinal grill dose',async t=>{
 const f=createFixture();t.after(()=>f.dispose());
 await f.load('main.js');f.startup();f.tick(1);
 const p=f.player(),data=await f.load('core/persist.js'),food=await f.load('food/food_state_adapter.js');
 const storage=await f.load('core/storage.js'),state=await f.load('grill/grill_state_adapter.js');
 const oil=await f.load('oil/cookery_oil_pot_adapter.js');
 const notes=foreignLore('retained');
 const empty=f.item(N+'empty_seasoning_bottle',1,{nameTag:'Owned bottle',keepOnDeath:true,lockMode:'inventory',canDestroy:['minecraft:stone'],canPlaceOn:['minecraft:dirt'],rawLore:notes});
 data.setItemProperty(empty,'foreign:owner','retained');p.main=empty;
 const support=f.block('minecraft:stone',{x:0,y:-1,z:0}),bottleBlock=f.block('minecraft:air',{x:0,y:0,z:0});
 const placed={player:p,block:bottleBlock,face:'Up',permutationToPlace:f.BlockPermutation.resolve(N+'seasoning_bottle_1'),cancel:false};
 f.component('senluo:grilling_bottle_place','beforeOnPlayerPlace',placed);assert.equal(placed.cancel,true);f.tick(1);
 assert.equal(bottleBlock.typeId,N+'seasoning_bottle_1');assert.equal(p.main,undefined);
 function interact(block){const e=f.emit('world.beforeEvents.playerInteractWithBlock',{player:p,block,itemStack:p.main,blockFace:'Up',isFirstEvent:true,cancel:false});assert.equal(e.cancel,true);f.tick(1);}
 for(const id of ingredients){p.main=f.item(id,1);interact(bottleBlock);assert.equal(p.main,undefined);}
 const native=storage.stationContainer(bottleBlock).getItem(0);assert.equal(native.typeId,N+'pending_seasoning_f3');
 interact(bottleBlock);assert.equal(p.main.typeId,N+'pending_seasoning_f3');assert.equal(bottleBlock.typeId,'minecraft:air');
 f.emit('world.afterEvents.itemStartUse',{source:p,itemStack:p.main.clone(),useDuration:80});f.tick(79);assert.equal(p.main.typeId,N+'pending_seasoning_f3');f.tick(1);
 f.emit('world.afterEvents.itemCompleteUse',{source:p,itemStack:p.main.clone(),useDuration:0});assert.match(p.main.typeId,/special_seasoning_r8_v[0-7]$/);
 const envelope=s=>({name:s.nameTag,keepOnDeath:s.keepOnDeath,lockMode:s.lockMode,canDestroy:s.getCanDestroy(),canPlaceOn:s.getCanPlaceOn(),foreign:data.getItemProperty(s,'foreign:owner')});
 const original=envelope(empty);
 assert.deepEqual(envelope(p.main),original);
 assert.deepEqual(data.getItemRawLore(p.main),[...notes,...finishedLore]);
 p.inventory.setItem(1,p.main);p.main=undefined;
 const grill=f.block(N+'grill',{x:3,y:0,z:0});f.block('minecraft:stone',{x:3,y:-1,z:0});f.emit('world.afterEvents.playerPlaceBlock',{block:grill,player:p});f.tick(1);
 p.main=f.item('minecraft:flint_and_steel');interact(grill);assert.equal(state.readGrillState(grill).lit,true);
 for(let dose=1;dose<=16;dose++){
  p.main=f.item(N+'raw_beef_skewer');interact(grill);assert.equal(p.main,undefined);
  p.main=oil.buildCookeryOilPot('canola',1);interact(grill);assert.equal(oil.readCookeryOilPot(p.main).empty,true);
  p.main=undefined;
  for(let flip=1;flip<=4;flip++){interact(grill);assert.equal(state.readGrillState(grill).flips,flip);for(let tick=0;tick<20;tick++){f.tick(1);f.component(N+'grill_tick','onTick',{block:grill});}}
  p.main=p.inventory.getItem(1);p.inventory.setItem(1,undefined);interact(grill);assert.equal(state.readGrillState(grill).seasoned,true);assert.deepEqual(state.readGrillState(grill).seasonings,ingredients);
  if(dose<16){
   assert.deepEqual(envelope(p.main),original,'the same named bottle survives each visual bucket');
   assert.equal(data.getItemProperty(p.main,SEASONING_USES_KEY),dose);
   assert.deepEqual(food.readFoodSeasonings(p.main),ingredients);
   assert.deepEqual(data.getItemRawLore(p.main),[
    {translate:hint+'uses',with:[String(16-dose),'16']},...notes,
    {translate:hint+'ingredients',with:['3','8']},
   ],'only the remaining-use line changes when sprinkling');
  }else{
   // Java explicitly returns a new empty bottle after its final dose.
   assert.equal(p.main.typeId,N+'empty_seasoning_bottle');assert.equal(p.main.amount,1);
   assert.deepEqual(food.readFoodSeasonings(p.main),[]);assert.deepEqual(data.getItemRawLore(p.main),[]);
  }

  p.inventory.setItem(1,p.main);p.main=undefined;p.isSneaking=true;interact(grill);p.isSneaking=false;assert.equal(state.readGrillState(grill).phase,0);
  // Remove extracted food only from the test inventory before next round.
  for(let slot=0;slot<p.inventory.size;slot++)if(p.inventory.getItem(slot)?.typeId===N+'grilled_beef_skewer')p.inventory.setItem(slot,undefined);
 }
 assert.equal(f.drops.length,0);
});
