import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFixture} from '../helpers/minecraft-fixture.mjs';
import {
 LEAF_DECAY_DISTANCE,STING_INTERVAL_TICKS,
 shouldFruitPepperLeaf,treeLeafStartsFruiting,harvestedPepperCount,
 saplingBonemealSucceeds,saplingRandomTickSucceeds,nextSaplingAction,pepperTreeHeight,
 pepperLogAxis,pepperLeafBreakPlan,pepperTreePlan
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/world/pepper_tree_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Java growth constants and chances',()=>{
 assert.equal(LEAF_DECAY_DISTANCE,6);
 assert.equal(STING_INTERVAL_TICKS,20);
 assert.equal(shouldFruitPepperLeaf(0.049),true);
 assert.equal(shouldFruitPepperLeaf(0.05),false);
 assert.equal(treeLeafStartsFruiting(0.249),true);
 assert.equal(treeLeafStartsFruiting(0.25),false);
 assert.equal(saplingBonemealSucceeds(0.449),true);
 assert.equal(saplingBonemealSucceeds(0.45),false);
});

t('sapling is two-stage and random growth requires light 9',()=>{
 assert.equal(nextSaplingAction(0),'advance');
 assert.equal(nextSaplingAction(1),'grow');
 assert.equal(saplingRandomTickSucceeds(8,0),false);
 assert.equal(saplingRandomTickSucceeds(9,0),true);
 assert.equal(saplingRandomTickSucceeds(9,0.2),false);
});

t('tree height is Java 2 or 3',()=>{
 assert.equal(pepperTreeHeight(0),2);
 assert.equal(pepperTreeHeight(0.499),2);
 assert.equal(pepperTreeHeight(0.5),3);
 assert.equal(pepperTreeHeight(0.999),3);
});

t('harvest gives one or two pepper',()=>{
 assert.equal(harvestedPepperCount(0),1);
 assert.equal(harvestedPepperCount(.499),1);
 assert.equal(harvestedPepperCount(.5),2);
});

t('leaf break plan follows Java shears/silk and fortune chances',()=>{
 assert.deepEqual(pepperLeafBreakPlan({shears:true,hasPepper:true}),{leaves:1,saplings:0,sticks:0,pepper:1});
 assert.deepEqual(pepperLeafBreakPlan({silkTouch:true}),{leaves:1,saplings:0,sticks:0,pepper:0});
 const plain=pepperLeafBreakPlan({fortune:0,saplingRandom:.099,stickRandom:.019,hasPepper:true});
 assert.deepEqual(plain,{leaves:0,saplings:1,sticks:1,pepper:1});
 const f3=pepperLeafBreakPlan({fortune:3,saplingRandom:.199,stickRandom:.032});
 assert.deepEqual(f3,{leaves:0,saplings:1,sticks:1,pepper:0});
});

t('tree plan has Java trunk and crown anchors',()=>{
 const p=pepperTreePlan(2,Array(100).fill(0));
 assert.equal(p.logs.length,3);
 assert.deepEqual(p.logs,[{x:0,y:0,z:0},{x:0,y:1,z:0},{x:0,y:2,z:0}]);
 for(const key of ['0,3,0','-1,3,0','1,3,0','0,3,-1','0,3,1'])
  assert.equal(p.leaves.some(x=>[x.x,x.y,x.z].join(',')===key),true,key);
 assert.equal(p.leaves.every(x=>x.hasPepper),true);
});

// Java 1.1.1: PepperLeavesBlock.java (NeoForge) randomTick L74-75,
// useWithoutItem L122-131; loot_table/blocks/pepper_leaves.json (world_data).
// These scenarios call the registered, unchanged runtime callbacks. The fixture
// models the API boundary only; this is neither native client nor worldgen QA.
const javaRules=JSON.parse(readFileSync(new URL('../../data/java/gameplay_rules.json',import.meta.url)));
const javaWorld=JSON.parse(readFileSync(new URL('../../data/java/world_data.json',import.meta.url)));
const javaLeaf=javaRules.classes['neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/world/PepperLeavesBlock.java'];
const [harvestBase,harvestBound]=javaLeaf.rules.find(rule=>rule.method==='useWithoutItem'&&rule.line===122).numeric_literals.map(row=>row.value);
// Java base + nextInt(bound): the draw is 0..bound-1, not 0..bound.
const harvestMin=harvestBase,harvestMax=harvestBase+harvestBound-1;
const fruitDivisor=javaLeaf.rules.find(rule=>rule.method==='randomTick'&&rule.line===74).numeric_literals[0].value;
const loot=javaWorld.resources['common/src/main/resources/data/kaleidoscope_grilling/loot_table/blocks/pepper_leaves.json'].data;
const leafDefinition=JSON.parse(readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/blocks/pepper_leaves.json',import.meta.url)))['minecraft:block'];
const leafId=leafDefinition.description.identifier;
const leafComponent='kaleidoscope_grilling:pepper_leaves_logic';
const fruitState='kaleidoscope_grilling:has_pepper',persistentState='kaleidoscope_grilling:persistent';
const leafLoot=loot.pools[0].entries[0].children[0].name;
const saplingLoot=loot.pools[1].entries[0].name,stickLoot=loot.pools[2].entries[0].name;
const pepperLoot=loot.pools[3].entries[0].name;
const chance=pool=>pool.conditions.find(condition=>condition.condition==='minecraft:table_bonus').chances;
const drops=f=>f.drops.filter(drop=>drop.isValid).map(drop=>[drop.stack.typeId,drop.stack.amount]).sort();
const expectDrops=(f,expected)=>assert.deepEqual(drops(f),expected.slice().sort());
function randomAt(value,fn){
 const original=Math.random;Math.random=()=>value;
 try{return fn()}finally{Math.random=original}
}
function randomSequence(values,fn){
 const original=Math.random,consumed=[];
 Math.random=()=>{
  const value=values[consumed.length];consumed.push(value);
  assert.notEqual(value,undefined,'runtime requested an unexpected extra random draw');
  return value;
 };
 try{
  const result=fn();
  assert.deepEqual(consumed,values,'runtime must consume both independent leaf-drop draws in order');
  return result;
 }finally{Math.random=original}
}
async function scenario(name,fn){
 const f=createFixture();
 // This existing fixture has no gameRules surface yet. Supply the normal
 // native gamerule value locally; do not replace harvest or event handlers.
 f.world.gameRules={doTileDrops:true};
 try{
  await f.load('world/pepper_tree_runtime.js');f.startup();
  assert.ok(Object.hasOwn(leafDefinition.components,leafComponent));
  t(name,()=>fn(f));
 }finally{f.dispose()}
}
function leaf(f,{ripe=true,persistent=false,x=0}={}){
 return f.block(leafId,{x,y:0,z:0},{states:{[fruitState]:ripe,[persistentState]:persistent}});
}
const interact=(f,block,player)=>f.component(leafComponent,'onPlayerInteract',{block,player});
function breakLeaf(f,block,player,itemStack,cancel=false){
 return f.emit('world.beforeEvents.playerBreakBlock',{block,player,itemStack,cancel});
}

await scenario('pepper log stripping keeps axis and charges the held axe with Unbreaking and rollback',f=>{
 const logId='kaleidoscope_grilling:pepper_log',component='kaleidoscope_grilling:pepper_log_logic';
 let x=20;
 const log=(face='up')=>f.block(logId,{x:x++,y:0,z:0},{states:{'minecraft:block_face':face}});
 const strip=(block,player)=>f.component(component,'onPlayerInteract',{block,player});
 for(const [index,[face,axis]] of Object.entries([['up','y'],['down','y'],['east','x'],['west','x'],['north','z'],['south','z']])){
  assert.equal(pepperLogAxis(face),axis);
  const hand=index%2?'off':'main',other=hand==='main'?'off':'main';
  const player=f.player({[hand]:f.item('minecraft:iron_axe'),[other]:f.item('minecraft:stick',3)}),block=log(face);
  strip(block,player);
  assert.equal(block.typeId,'minecraft:stripped_oak_log');assert.equal(block.permutation.getState('pillar_axis'),axis);
  assert.equal(player[hand].getComponent('minecraft:durability').damage,1);
  assert.equal(player[other].amount,3);
 }
 const axe=f.item('minecraft:diamond_axe',1,{nameTag:'Lasting axe',enchantments:[{id:'unbreaking',level:3}]}),durability=axe.getComponent('minecraft:durability');
 durability.damage=durability.maxDurability-1;
 const player=f.player({main:axe}),protectedLog=log(),beforeWrites=f.writes.length;
 randomAt(.75,()=>strip(protectedLog,player));
 assert.equal(protectedLog.typeId,'minecraft:stripped_oak_log');
 assert.equal(player.main?.typeId,axe.typeId,'Unbreaking preserves the last durability point');
 assert.equal(player.main.nameTag,axe.nameTag);assert.equal(player.main.getComponent('minecraft:durability').damage,durability.damage);
 assert.equal(f.writes.slice(beforeWrites).some(write=>write.target===player.inventory),false,'protected use must not replace the held axe');
 randomAt(0,()=>strip(log(),player));
 assert.equal(player.main,undefined,'accepted damage still breaks at the normal limit');
 for(const mode of ['unbreakable','creative']){
  const tool=axe.clone();if(mode==='unbreakable')tool.getComponent('minecraft:durability').unbreakable=true;
  const free=f.player({main:tool,gameMode:mode==='creative'?f.GameMode.Creative:f.GameMode.Survival}),block=log();
  randomAt(0,()=>strip(block,free));
  assert.equal(block.typeId,'minecraft:stripped_oak_log');assert.equal(free.main.getComponent('minecraft:durability').damage,durability.damage);
 }
 // A failed block or hand write must not leave a paid axe or a free stripped log.
 for(const faultTarget of ['block','hand']){
  const tool=f.item('minecraft:iron_axe',1,{damage:7}),owner=f.player({main:tool}),block=log('west');
  const soundCount=f.sounds.length;
  if(faultTarget==='block')f.faults.failNext(block,'setPermutation',{phase:'after'});
  else f.faults.failNext(owner.inventory,'setItem',{phase:'after'});
  strip(block,owner);
  assert.equal(block.typeId,logId);assert.equal(block.permutation.getState('minecraft:block_face'),'west');
  assert.equal(owner.main.getComponent('minecraft:durability').damage,7);assert.equal(f.sounds.length,soundCount);
  strip(block,owner);
  assert.equal(block.typeId,'minecraft:stripped_oak_log');assert.equal(owner.main.getComponent('minecraft:durability').damage,8);
 }
});

await scenario('empty-hand harvest dispatch gives Java one-or-two pepper and preserves either leaf kind',f=>{
 assert.deepEqual({min:harvestMin,max:harvestMax},{min:1,max:2});
 const player=f.player({off:f.item('minecraft:stick',3)});
 let x=0;
 for(const persistent of [false,true])for(const [sample,amount] of [[0,harvestMin],[.499,harvestMin],[.5,harvestMax],[.999999,harvestMax]]){
  const block=leaf(f,{persistent,x:x++}),before=f.drops.length;
  randomAt(sample,()=>interact(f,block,player));
  assert.equal(f.drops.length,before+1);
  assert.deepEqual([f.drops.at(-1).stack.typeId,f.drops.at(-1).stack.amount],[pepperLoot,amount]);
  assert.equal(block.typeId,leafId);
  assert.equal(block.permutation.getState(fruitState),false);
  assert.equal(block.permutation.getState(persistentState),persistent);
  assert.equal(f.sounds.at(-1).sound,'block.sweet_berry_bush.pick');
 }
 assert.equal(player.main,undefined);
 assert.deepEqual([player.off.typeId,player.off.amount],['minecraft:stick',3]);
 assert.equal(f.sounds.length,8);
});

await scenario('unripe leaves, occupied main hand and absent player do not harvest',f=>{
 const empty=f.player(),holding=f.player({main:f.item('minecraft:stick',4)});
 const unripe=leaf(f,{ripe:false}),ripe=leaf(f,{x:1});
 interact(f,unripe,empty);interact(f,ripe,holding);interact(f,ripe,undefined);
 expectDrops(f,[]);assert.equal(f.sounds.length,0);
 assert.equal(unripe.permutation.getState(fruitState),false);
 assert.equal(ripe.permutation.getState(fruitState),true);
 assert.deepEqual([holding.main.typeId,holding.main.amount],['minecraft:stick',4]);
});

await scenario('repeat clicks cannot harvest twice; another ripe leaf works immediately and regrowth re-enables harvest',f=>{
 const player=f.player(),first=leaf(f,{persistent:true}),second=leaf(f,{persistent:true,x:1});
 randomAt(0,()=>{interact(f,first,player);interact(f,first,player);interact(f,second,player)});
 expectDrops(f,[[pepperLoot,harvestMin],[pepperLoot,harvestMin]]);
 assert.equal(f.sounds.length,2);
 // Java has a sting cooldown, but harvesting is gated by fruit, not time.
 f.tick(STING_INTERVAL_TICKS);interact(f,first,player);
 assert.equal(f.drops.length,2);assert.equal(f.sounds.length,2);
 randomAt(1/fruitDivisor,()=>f.component(leafComponent,'onRandomTick',{block:first}));
 assert.equal(first.permutation.getState(fruitState),false);
 randomAt(1/fruitDivisor-.000001,()=>f.component(leafComponent,'onRandomTick',{block:first}));
 assert.equal(first.permutation.getState(fruitState),true);
 randomAt(.5,()=>interact(f,first,player));
 expectDrops(f,[[pepperLoot,harvestMin],[pepperLoot,harvestMin],[pepperLoot,harvestMax]]);
 assert.equal(first.permutation.getState(fruitState),false);
 assert.equal(first.permutation.getState(persistentState),true);
 assert.equal(f.sounds.length,3);
});

await scenario('placed persistent leaves start unripe and connected natural leaves can fruit and be harvested',f=>{
 const player=f.player(),placed=leaf(f);
 const event={permutationToPlace:placed.permutation};
 f.component(leafComponent,'beforeOnPlayerPlace',event);
 placed.setPermutation(event.permutationToPlace);
 assert.equal(placed.permutation.getState(persistentState),true);
 assert.equal(placed.permutation.getState(fruitState),false);
 interact(f,placed,player);expectDrops(f,[]);
 const natural=leaf(f,{ripe:false,x:3});
 f.block('kaleidoscope_grilling:pepper_log',{x:4,y:0,z:0});
 randomAt(0,()=>f.component(leafComponent,'onRandomTick',{block:natural}));
 assert.equal(natural.typeId,leafId);
 assert.equal(natural.permutation.getState(fruitState),true);
 randomAt(0,()=>interact(f,natural,player));
 expectDrops(f,[[pepperLoot,harvestMin]]);
 assert.equal(natural.permutation.getState(persistentState),false);
});

await scenario('tile drops controls harvest, player breaking and natural decay without preventing leaf removal',f=>{
 const player=f.player(),block=leaf(f);
 f.world.gameRules.doTileDrops=false;
 randomAt(0,()=>interact(f,block,player));
 expectDrops(f,[]);assert.equal(block.permutation.getState(fruitState),false);
 assert.equal(f.sounds.length,1);
 const broken=leaf(f,{x:3}),decayed=leaf(f,{x:6});
 assert.equal(breakLeaf(f,broken,player).cancel,true);
 randomAt(0,()=>f.tick());
 randomAt(0,()=>f.component(leafComponent,'onRandomTick',{block:decayed}));
 assert.equal(broken.typeId,'minecraft:air');assert.equal(decayed.typeId,'minecraft:air');
 expectDrops(f,[]);
 f.world.gameRules.doTileDrops=true;
 const creative=f.player({gameMode:f.GameMode.Creative});
 randomAt(.5,()=>interact(f,leaf(f,{x:1}),creative));
 expectDrops(f,[[pepperLoot,harvestMax]]);
 const enabled=leaf(f,{x:6});
 randomAt(0,()=>f.component(leafComponent,'onRandomTick',{block:enabled}));
 assert.equal(enabled.typeId,'minecraft:air');
 expectDrops(f,[[pepperLoot,harvestMax],[saplingLoot,1],[stickLoot,1],[pepperLoot,1]]);
});

await scenario('breaking dispatch is deferred, honors prior cancellation, and settles duplicate events once',f=>{
 const player=f.player(),block=leaf(f);
 assert.equal(breakLeaf(f,block,player,undefined,true).cancel,true);
 f.tick();expectDrops(f,[]);assert.equal(block.typeId,leafId);
 assert.equal(breakLeaf(f,block,player).cancel,true);
 assert.equal(breakLeaf(f,block,player).cancel,true);
 expectDrops(f,[]);assert.equal(block.typeId,leafId);
 randomAt(.99,()=>f.tick());
 expectDrops(f,[[pepperLoot,1]]);assert.equal(block.typeId,'minecraft:air');
 f.tick();expectDrops(f,[[pepperLoot,1]]);
});

await scenario('breaking mature or unripe leaves with shears or silk touch follows Java loot',f=>{
 const player=f.player();let x=0;
 for(const ripe of [false,true])for(const persistent of [false,true])for(const tool of [f.item('minecraft:shears'),f.item('minecraft:diamond_hoe',1,{enchantments:[{id:'silk_touch',level:1}]})]){
  const block=leaf(f,{ripe,persistent,x:x++}),before=f.drops.length;
  assert.equal(breakLeaf(f,block,player,tool).cancel,true);
  randomAt(0,()=>f.tick());
  assert.deepEqual(f.drops.slice(before).map(drop=>[drop.stack.typeId,drop.stack.amount]).sort(),
   (ripe?[[leafLoot,1],[pepperLoot,1]]:[[leafLoot,1]]).sort());
  assert.equal(block.typeId,'minecraft:air');
 }
});

await scenario('fortune leaf breaks use Java sapling and stick probability boundaries and ripe-only pepper',f=>{
 const player=f.player();let x=0;
 for(let fortune=0;fortune<=3;fortune++)for(const ripe of [false,true]){
  const tool=f.item('minecraft:diamond_hoe',1,{enchantments:fortune?[{id:'fortune',level:fortune}]:[]});
  const saplingChance=chance(loot.pools[1])[fortune],stickChance=chance(loot.pools[2])[fortune];
  for(const [samples,expected] of [
   [[stickChance-.000001,stickChance-.000001],[[saplingLoot,1],[stickLoot,1]]],
   [[stickChance,stickChance],[[saplingLoot,1]]],
   [[saplingChance-.000001,saplingChance-.000001],[[saplingLoot,1]]],
   [[saplingChance,saplingChance],[]],
   // Opposite outcomes detect reused draws and swapped sapling/stick inputs.
   [[0,.999999],[[saplingLoot,1]]],
   [[.999999,0],[[stickLoot,1]]]
  ]){
   const block=leaf(f,{ripe,x:x++}),before=f.drops.length;
   breakLeaf(f,block,player,tool);randomSequence(samples,()=>f.tick());
   assert.deepEqual(f.drops.slice(before).map(drop=>[drop.stack.typeId,drop.stack.amount]).sort(),
    [...expected,...(ripe?[[pepperLoot,1]]:[])].sort());
   assert.equal(block.typeId,'minecraft:air');
  }
 }
});

await scenario('creative breaking removes the leaf without survival loot',f=>{
 const player=f.player({gameMode:f.GameMode.Creative}),block=leaf(f);
 breakLeaf(f,block,player,f.item('minecraft:shears'));randomAt(0,()=>f.tick());
 assert.equal(block.typeId,'minecraft:air');expectDrops(f,[]);
});

// A player can strip every trunk block of a normal pepper tree. Java leaves
// retain log support because stripped oak is in the vanilla LOGS tag. Drive
// actual growth, strip and random-tick callbacks; no renderer is simulated.
for(const hand of ['main','off'])await scenario(`fully stripped pepper tree keeps its natural leaves and fruit (${hand} axe)`,f=>{
 const logId='kaleidoscope_grilling:pepper_log',saplingId='kaleidoscope_grilling:pepper_sapling';
 const sapling=f.block(saplingId,{x:0,y:1,z:0},{states:{'kaleidoscope_grilling:stage':1}}),d=sapling.dimension;
 f.block('minecraft:dirt',{x:0,y:0,z:0});
 d.getLightLevel=()=>15; // Documented API input: loaded, unobstructed daylight.
 randomAt(0,()=>f.component('kaleidoscope_grilling:pepper_sapling_logic','onRandomTick',{block:sapling}));
 const logs=[...d.blocks.values()].filter(b=>b.typeId===logId),leaves=[...d.blocks.values()].filter(b=>b.typeId===leafId);
 assert.equal(logs.length,3);assert.ok(leaves.length>0);
 const player=f.player({[hand]:f.item('minecraft:iron_axe')});
 for(const block of logs)f.component('kaleidoscope_grilling:pepper_log_logic','onPlayerInteract',{block,player});
 assert.ok(logs.every(b=>b.typeId==='minecraft:stripped_oak_log'));
 assert.equal([...d.blocks.values()].some(b=>b.typeId===logId),false,'no unstripped log can mask lost support');
 assert.equal(player[hand].getComponent('minecraft:durability').damage,logs.length);
 randomAt(.99,()=>{for(const block of leaves)f.component(leafComponent,'onRandomTick',{block});});
 assert.ok(leaves.every(b=>b.typeId===leafId),'stripping must not trigger natural leaf decay');
 assert.ok(leaves.every(b=>b.permutation.getState(persistentState)===false),'support must not turn natural leaves persistent');
 expectDrops(f,[]);
 const picker=f.player();randomAt(0,()=>interact(f,leaves[0],picker));
 expectDrops(f,[[pepperLoot,harvestMin]]);
 assert.equal(leaves[0].permutation.getState(fruitState),false);
});
for(const distance of [1,6,7])await scenario(`stripped log support preserves the six-block decay boundary (distance ${distance})`,f=>{
 const log=f.block('kaleidoscope_grilling:pepper_log',{x:0,y:0,z:0});
 for(let x=1;x<=distance;x++)leaf(f,{x,ripe:false});
 const target=log.dimension.getBlock({x:distance,y:0,z:0}),player=f.player({main:f.item('minecraft:iron_axe')});
 f.component('kaleidoscope_grilling:pepper_log_logic','onPlayerInteract',{block:log,player});
 assert.equal(log.typeId,'minecraft:stripped_oak_log');
 randomAt(.99,()=>f.component(leafComponent,'onRandomTick',{block:target}));
 assert.equal(target.typeId,distance<=6?leafId:'minecraft:air');
 expectDrops(f,[]);
 if(distance<=6){
  log.setType('minecraft:air');
  randomAt(.99,()=>f.component(leafComponent,'onRandomTick',{block:target}));
  assert.equal(target.typeId,'minecraft:air','actually removing the supporting log still permits decay');
  expectDrops(f,[]);
 }
});

console.log('Pepper Tree core and registered runtime scenarios: '+n+'/'+n);
