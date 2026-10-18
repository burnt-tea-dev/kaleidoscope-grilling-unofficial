/** Production-source fault injection, not BDS or rendered/client acceptance.
 * Run: node --experimental-vm-modules --test development/tests/runtime/pepper_harvest_conservation.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const defaultScripts=fileURLToPath(new URL('../../../projects/grilling/gameplay_core/behavior_pack/scripts/',import.meta.url));
const scripts=path.resolve(process.env.GRILLING_TEST_SCRIPTS??defaultScripts);
const LEAF='kaleidoscope_grilling:pepper_leaves',FRUIT='kaleidoscope_grilling:has_pepper';
class Permutation{
 constructor(id,states={}){this.type={id};this.states={...states};}
 getState(key){return this.states[key];}
 getAllStates(){return {...this.states};}
 withState(key,value){return new Permutation(this.type.id,{...this.states,[key]:value});}
 static resolve(id,states){return new Permutation(id,states);}
}
class Stack{
 constructor(typeId,amount){this.typeId=typeId;this.amount=amount;this.metadata='plain';}
 isStackableWith(other){return this.typeId===other.typeId&&this.metadata===other.metadata;}
 clone(){const copy=new Stack(this.typeId,this.amount);copy.metadata=this.metadata;return copy;}
}
async function pepperHarness({random=0,tileDrops=true,clearMode='normal',spawnMode='normal'}={}){
 const entities=new Map(),properties=new Map(),components=new Map(),sounds=[],awards=[],warnings=[];
 let serial=0,spawnAttempts=0,permutation=new Permutation(LEAF,{[FRUIT]:true,'kaleidoscope_grilling:persistent':true});
 const event={subscribe(){}};
 const world={
  beforeEvents:{playerBreakBlock:event},
  afterEvents:{entitySpawn:event,entityLoad:event,entityRemove:event,playerSpawn:event,playerDimensionChange:event,playerLeave:event},
  gameRules:{doTileDrops:tileDrops},
  getDynamicProperty:key=>properties.get(key),setDynamicProperty:(key,value)=>properties.set(key,value),
  getEntity:id=>entities.get(id)
 };
 const dimension={id:'minecraft:overworld',playSound:(...args)=>sounds.push(args),spawnItem(stack){
  spawnAttempts++;
  if(spawnMode==='throwBefore')throw Error('native spawn failed before returning');
  const entity={id:'item-'+(++serial),isValid:true,stack:stack.clone(),getComponent:()=>({itemStack:entity.stack}),remove(){entity.isValid=false;entities.delete(entity.id)}};
  entities.set(entity.id,entity);
  if(spawnMode==='throwAfter')throw Error('native spawn threw after creation');
  if(spawnMode==='badReceipt')entity.stack.amount++;
  if(spawnMode==='wrongType')entity.stack.typeId='minecraft:stick';
  if(spawnMode==='wrongMetadata')entity.stack.metadata='foreign';
  if(spawnMode==='invalid')entity.isValid=false;
  if(spawnMode==='missingReceipt')return undefined;
  if(spawnMode==='unindexed')entities.delete(entity.id);
  return entity;
 }};
 const block={location:{x:0,y:64,z:0},x:0,y:64,z:0,dimension,
  get typeId(){return permutation.type.id},get permutation(){return permutation},
  setPermutation(next){
   if(next.getState(FRUIT)===false){
    if(clearMode==='throwBefore')throw Error('native clear rejected');
    if(clearMode==='noop')return;
    if(clearMode==='foreign'){permutation=new Permutation('minecraft:stone');throw Error('block replaced');}
    permutation=next;if(clearMode==='throwAfter')throw Error('clear completed before exception');
   }else permutation=next;
  }
 };
 const player={};
 async function reload(){
  const startup=[];
  const system={currentTick:0,beforeEvents:{startup:{subscribe:fn=>startup.push(fn)}},run(){},runInterval(){}};
  const native={world,system,ItemStack:Stack,BlockPermutation:Permutation,EquipmentSlot:{},GameMode:{Creative:'Creative'}};
  const context=vm.createContext({console:{warn:message=>warnings.push(message)},Math:Object.assign(Object.create(Math),{random:()=>random})});
  const cache=new Map();
  function synthetic(identifier,exports){return new vm.SyntheticModule(Object.keys(exports),function(){for(const [name,value] of Object.entries(exports))this.setExport(name,value)},{context,identifier});}
  function load(identifier){
   if(cache.has(identifier))return cache.get(identifier);
   const base=path.basename(identifier);let module;
   if(identifier==='@minecraft/server')module=synthetic(identifier,native);
   else if(base==='a2735_player_io.js')module=synthetic(identifier,{getMainHand:p=>p.hand,getOffHand:()=>undefined,setHand(){},isCreative:()=>false});
   else if(base==='a2753_advancement_runtime.js')module=synthetic(identifier,{awardMountainFragrance:p=>awards.push(p)});
   else module=new vm.SourceTextModule(readFileSync(identifier,'utf8'),{context,identifier});
   cache.set(identifier,module);return module;
  }
  const root=load(path.join(scripts,'a2748_pepper_tree_runtime.js'));
  await root.link((specifier,ref)=>load(specifier==='@minecraft/server'?specifier:path.resolve(path.dirname(ref.identifier),specifier)));
  await root.evaluate();
  for(const start of startup)start({blockComponentRegistry:{registerCustomComponent:(id,implementation)=>components.set(id,implementation)}});
 }
 await reload();
 const component=()=>components.get('kaleidoscope_grilling:pepper_leaves_logic');
 assert.ok(component(),'actual pepper leaf component registered');
 return {world,block,player,entities,properties,sounds,awards,warnings,reload,
  pick(){component().onPlayerInteract({block,player})},get spawnAttempts(){return spawnAttempts}};
}
test('pepper: actual handler produces Java one/two fruit and settles only once',async()=>{
 for(const [random,amount] of [[0,1],[.499,1],[.5,2],[.999,2]]){
  const h=await pepperHarness({random});h.pick();h.pick();
  assert.equal(h.spawnAttempts,1);assert.equal([...h.entities.values()][0].stack.amount,amount);
  assert.equal(h.block.permutation.getState(FRUIT),false);assert.equal(h.awards.length,1);assert.equal(h.sounds.length,1);assert.equal(h.properties.size,0);
 }
});
test('pepper: failed/no-op/throw-after-clear cannot report or deliver an uncommitted harvest',async()=>{
 for(const clearMode of ['throwBefore','noop','throwAfter']){
  const h=await pepperHarness({clearMode});h.pick();
  assert.equal(h.spawnAttempts,0,clearMode);assert.equal(h.block.permutation.getState(FRUIT),true,clearMode);
  assert.equal(h.awards.length,0);assert.equal(h.sounds.length,0);assert.equal(h.properties.size,0);
 }
});
test('pepper: unknown spawn outcome persists quarantine and cannot mint repeat harvests after reload',async()=>{
 for(const spawnMode of ['throwBefore','throwAfter','badReceipt']){
  const h=await pepperHarness({spawnMode});h.pick();
  assert.equal(h.block.permutation.getState(FRUIT),false);assert.equal(h.properties.size,1,spawnMode);
  assert.equal(h.awards.length,0);assert.equal(h.sounds.length,0);
  // Force fruit back to prove persisted recovery guard, not just empty fruit, blocks reuse.
  h.block.setPermutation(h.block.permutation.withState(FRUIT,true));
  await h.reload();h.pick();assert.equal(h.spawnAttempts,1,spawnMode);
 }
});
test('pepper: a replaced native block is preserved and quarantined without a drop',async()=>{
 const h=await pepperHarness({clearMode:'foreign'});h.pick();
 assert.equal(h.block.typeId,'minecraft:stone');assert.equal(h.spawnAttempts,0);assert.equal(h.properties.size,1);assert.equal(h.awards.length,0);
});
test('pepper: doTileDrops=false suppresses delivery, not the successful harvest feedback',async()=>{
 const h=await pepperHarness({tileDrops:false});h.pick();
 assert.equal(h.spawnAttempts,0);assert.equal(h.block.permutation.getState(FRUIT),false);assert.equal(h.awards.length,1);assert.equal(h.sounds.length,1);
 const unavailable=await pepperHarness();unavailable.world.gameRules.doTileDrops=undefined;unavailable.pick();
 assert.equal(unavailable.spawnAttempts,0);assert.equal(unavailable.block.permutation.getState(FRUIT),true);assert.equal(unavailable.awards.length,0);
});
test('pepper: nonempty main hand still bypasses empty-hand harvesting',async()=>{
 const h=await pepperHarness();h.player.hand=new Stack('minecraft:stick',1);h.pick();
 assert.equal(h.spawnAttempts,0);assert.equal(h.block.permutation.getState(FRUIT),true);assert.equal(h.awards.length,0);
});

test('pepper: missing, invalid, unindexed and mismatched native item receipts cannot commit or refund fruit',async()=>{
 for(const spawnMode of ['missingReceipt','invalid','unindexed','wrongType','wrongMetadata']){
  const h=await pepperHarness({spawnMode});h.pick();h.pick();
  assert.equal(h.spawnAttempts,1,spawnMode);assert.equal(h.block.permutation.getState(FRUIT),false,spawnMode);
  assert.equal(h.properties.size,1,spawnMode);assert.equal(h.awards.length,0,spawnMode);assert.equal(h.sounds.length,0,spawnMode);
 }
});
test('pepper: empty fruit and foreign blocks cannot enter harvest or create quarantine',async()=>{
 for(const permutation of [new Permutation(LEAF,{[FRUIT]:false}),new Permutation('minecraft:stone',{[FRUIT]:true})]){
  const h=await pepperHarness();h.block.setPermutation(permutation);h.pick();
  assert.equal(h.spawnAttempts,0);assert.equal(h.block.permutation,permutation);assert.equal(h.properties.size,0);assert.equal(h.awards.length,0);assert.equal(h.sounds.length,0);
 }
});
