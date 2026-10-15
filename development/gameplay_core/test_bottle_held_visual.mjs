import * as failureSkewers from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_visual_core.js';
/** Production visual functions/adapters with API doubles; not native client evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as visuals from '../../projects/grilling/gameplay_core/behavior_pack/scripts/bottle_held_visual_core.js';
import * as seasoning from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2743_seasoning_contract_core.js';
import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';

const N='kaleidoscope_grilling:',EMPTY=N+'empty_seasoning_bottle',PENDING=N+'pending_seasoning';
const ids=[N+'dragon_egg_powder',N+'green_chili_powder',N+'houttuynia_powder',N+'onion_powder',N+'sichuan_pepper',N+'totem_powder','minecraft:gunpowder','minecraft:redstone'];
const zeros=()=>Array(8).fill(0);
const root=new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const strip=source=>source.replace(/^import\b[\s\S]*?;\s*/gm,'').replace(/\bexport (?=(class|const|function|async))/g,'');
const plain=value=>JSON.parse(JSON.stringify(value));

test('palette indices have one stable sorted contract shared with assets',()=>{
 assert.deepEqual(visuals.BOTTLE_HELD_INGREDIENT_IDS,ids);
 assert.deepEqual(ids.map(id=>visuals.BOTTLE_HELD_INGREDIENT_INDEX[id]),[1,2,3,4,5,6,7,8]);
 assert.equal(visuals.BOTTLE_HELD_FALLBACK_INDEX,9);
 assert.ok(Object.isFrozen(visuals.BOTTLE_HELD_INGREDIENT_IDS));
 assert.ok(Object.isFrozen(visuals.BOTTLE_HELD_INGREDIENT_INDEX));
});
test('empty and non-bottle items clear every layer, including finished bottles',()=>{
 for(const id of [undefined,EMPTY,PENDING,'minecraft:stone',N+'special_seasoning_r8_v0']){
  assert.deepEqual(visuals.bottleHeldVisualPlan(id),zeros());
 }
 assert.deepEqual(visuals.bottleHeldVisualPlan('minecraft:stone',ids),zeros());
 assert.deepEqual(visuals.bottleHeldVisualPlan(N+'special_seasoning_r8_v0',ids),zeros());
});
test('partial EMPTY and PENDING retain ingredient order, repeats and palette colors',()=>{
 for(const id of [EMPTY,PENDING]){
  assert.deepEqual(visuals.bottleHeldVisualPlan(id,[ids[7],ids[1],ids[7]]),[8,2,8,0,0,0,0,0]);
  assert.deepEqual(visuals.bottleHeldVisualPlan(id,ids),[1,2,3,4,5,6,7,8]);
 }
});
test('capacity and normalization match the seasoning mechanic contract',()=>{
 assert.deepEqual(visuals.bottleHeldVisualPlan(EMPTY,[null,ids[0],7,...ids]),[1,1,2,3,4,5,6,7]);
 assert.deepEqual(visuals.bottleHeldVisualPlan(PENDING,{ingredient:ids[0]}),zeros());
 assert.deepEqual(visuals.bottleHeldVisualPlan(PENDING,[...ids,'external:extra']),[1,2,3,4,5,6,7,8]);
});
test('preserved unknown ingredient IDs use fallback without mutating their array',()=>{
 const values=Object.freeze(['other_addon:seasoning','toString',ids[4]]);
 assert.deepEqual(visuals.bottleHeldVisualPlan(EMPTY,values),[9,9,5,0,0,0,0,0]);
 assert.deepEqual(values,['other_addon:seasoning','toString',ids[4]]);
});

function fixture(){
 const callbacks={},queue=[],intervals=[],writes=[],warnings=[],properties=new Map();
 let main,off,failure,failureBefore=false,readFailure;
 const component={size:9,getItem(slot){assert.equal(slot,player.selectedSlotIndex);return main},setItem(){throw Error('Visual runtime must not write inventory')}};
 const equipment={getEquipment(slot){assert.equal(slot,'offhand');return off},setEquipment(){throw Error('Visual runtime must not write equipment')}};
 const player={id:'holder',selectedSlotIndex:2,getComponent(id){return id==='minecraft:inventory'?{container:component}:id==='minecraft:equippable'?equipment:undefined},setProperty(key,value){writes.push([key,value]);const rejected=failure?.(key);if(rejected&&failureBefore)throw Error('Injected property write failure before mutation');properties.set(key,value);if(rejected)throw Error('Injected property write failure after mutation')}};
 const players=[player];
 const world={afterEvents:Object.fromEntries(['playerInventoryItemChange','playerHotbarSelectedSlotChange','playerSpawn','playerLeave'].map(name=>[name,{subscribe(callback){callbacks[name]=callback}}])),getAllPlayers:()=>players,getDynamicProperty(){throw Error('Unstackable bottles must read native item properties')},setDynamicProperty(){throw Error('Visual runtime must not write world metadata')}};
 const system={currentTick:100,run:callback=>queue.push(callback),runInterval(callback,ticks){intervals.push({callback,ticks})}};
 const context=vm.createContext({...failureSkewers,...visuals,...seasoning,canonicalFoodId,world,system,EquipmentSlot:{Offhand:'offhand'},GameMode:{Creative:'creative'},console:{warn:value=>warnings.push(value)}});
 vm.runInContext(strip(read('a2735_player_io.js')),context);
 // itemDataCore has module-private world state. Keep it in its own scope,
 // as the real ESM import does, instead of shadowing the Minecraft world.
 vm.runInContext('Object.assign(globalThis,(function(){'+strip(read('itemDataCore.js'))+';return {configureItemDataWorld,getItemProperty};})())',context);
 vm.runInContext('configureItemDataWorld(world)',context);
 // Load the production shared writer and dispatcher. These existing adapter
 // regressions must exercise the real cache/owner path after the G119 split.
 vm.runInContext(strip(read('held_visual_transport.js')),context);
 vm.runInContext(strip(read('held_visual_dispatch_runtime.js')),context);
 vm.runInContext(strip(read('bottle_held_visual_runtime.js')),context);
 const api=vm.runInContext('({syncBottleHeld,readBottleHeldSeasonings})',context);
 const stack=(typeId,ingredients,...explicitRaw)=>Object.freeze({typeId,amount:1,maxAmount:1,nameTag:'Preserve me',getDynamicProperty(key){assert.equal(key,seasoning.SEASONING_LIST_KEY);if(readFailure===true||typeof readFailure==='function'&&readFailure(this))throw Error('Injected item read failure');return explicitRaw.length?explicitRaw[0]:JSON.stringify(ingredients)},setDynamicProperty(){throw Error('Visual runtime must not write item metadata')},setLore(){throw Error('Visual runtime must not write lore')}});
 function addPlayer(id){
  let ownMain,ownOff;const ownProperties=new Map(),ownWrites=[];
  const ownPlayer={id,selectedSlotIndex:0,getComponent(name){
   if(name==='minecraft:inventory')return {container:{size:9,getItem(){return ownMain},setItem(){throw Error('Visual runtime must not write another inventory')}}};
   if(name==='minecraft:equippable')return {getEquipment(slot){assert.equal(slot,'offhand');return ownOff},setEquipment(){throw Error('Visual runtime must not write another equipment')}};
  },setProperty(key,value){ownWrites.push([key,value]);ownProperties.set(key,value)}};
  players.push(ownPlayer);return {player:ownPlayer,writes:ownWrites,get main(){return ownMain},set main(s){ownMain=s},get off(){return ownOff},set off(s){ownOff=s},layers(hand){return Array.from({length:8},(_,i)=>ownProperties.get(N+'bottle_'+hand+'_'+i))}};
 }
 return {player,api,callbacks,writes,warnings,properties,intervals,stack,addPlayer,get main(){return main},set main(value){main=value},get off(){return off},set off(value){off=value},setFailure(value,{before=false}={}){failure=value;failureBefore=before},setReadFailure(value){readFailure=value},flush(){while(queue.length)queue.shift()()},layers(hand){return Array.from({length:8},(_,i)=>properties.get(N+'bottle_'+hand+'_'+i))}};
}

test('real reader and hand adapters publish independent hands without changing native stacks',()=>{
 const f=fixture();f.main=f.stack(EMPTY,[ids[1],ids[4]]);f.off=f.stack(PENDING,[ids[7],'external:spice']);
 const main=f.main,off=f.off;f.api.syncBottleHeld(f.player);
 assert.deepEqual(f.layers('main'),[2,5,0,0,0,0,0,0]);assert.deepEqual(f.layers('off'),[8,9,0,0,0,0,0,0]);
 assert.strictEqual(f.main,main);assert.strictEqual(f.off,off);assert.equal(f.main.nameTag,'Preserve me');
 assert.equal(f.properties.get(N+'secret_main_piece'),214);assert.equal(f.properties.get(N+'secret_off_piece'),214);
 const written=f.writes.length;f.api.syncBottleHeld(f.player);assert.equal(f.writes.length,written);
});
test('malformed or missing data clears contents without trying to rewrite it',()=>{
 const f=fixture();for(const raw of [undefined,'broken','{}','null','[4,null]']){
  const stack=f.stack(PENDING,[],raw);assert.deepEqual(plain(f.api.readBottleHeldSeasonings(stack)),[]);
 }
 const nonBottle=f.stack('minecraft:stone',[],JSON.stringify(ids));assert.deepEqual(plain(f.api.readBottleHeldSeasonings(nonBottle)),[]);
});
test('inventory and hotbar callbacks defer reads and publish the latest actual slots',()=>{
 const f=fixture();f.main=f.stack(EMPTY,[ids[0]]);f.callbacks.playerInventoryItemChange({player:f.player});
 assert.equal(f.writes.length,0);f.main=f.stack(PENDING,[ids[5]]);f.flush();assert.deepEqual(f.layers('main'),[6,0,0,0,0,0,0,0]);
 f.main=undefined;f.callbacks.playerHotbarSelectedSlotChange({player:f.player});f.flush();assert.deepEqual(f.layers('main'),zeros());
});
test('five-tick interval picks up offhand-only changes and clears unequipped bottles',()=>{
 const f=fixture();assert.equal(f.intervals.length,1);assert.equal(f.intervals[0].ticks,5);
 f.off=f.stack(EMPTY,[ids[6]]);f.intervals[0].callback();assert.deepEqual(f.layers('off'),[7,0,0,0,0,0,0,0]);
 f.off=f.stack('minecraft:stone',ids);f.intervals[0].callback();assert.deepEqual(f.layers('off'),zeros());
});
test('failed property writes retry the complete projection and cache only successful state',()=>{
 const f=fixture();f.main=f.stack(EMPTY,[ids[0]]);let fail=true;f.setFailure(key=>key===N+'bottle_main_1'&&fail?(fail=false,true):false);
 f.intervals[0].callback();assert.equal(f.warnings.length,1);assert.equal(f.properties.get(N+'secret_main_piece'),254);
 f.intervals[0].callback();assert.deepEqual(f.layers('main'),[1,0,0,0,0,0,0,0]);assert.equal(f.properties.get(N+'secret_main_piece'),214);
 const written=f.writes.length;f.intervals[0].callback();assert.equal(f.writes.length,written);
});
test('reverting hands after a partial write failure restores the previous projection',()=>{
 const f=fixture();f.main=f.stack(EMPTY,[ids[0]]);f.api.syncBottleHeld(f.player);
 f.main=f.stack(EMPTY,[ids[7],ids[6]]);let fail=true;f.setFailure(key=>key===N+'bottle_main_1'&&fail?(fail=false,true):false);
 f.intervals[0].callback();assert.equal(f.properties.get(N+'bottle_main_0'),8);
 f.main=f.stack(EMPTY,[ids[0]]);f.intervals[0].callback();assert.deepEqual(f.layers('main'),[1,0,0,0,0,0,0,0]);
});
test('item property read errors retry when the native item becomes readable',()=>{
 const f=fixture();f.main=f.stack(EMPTY,[ids[2]]);f.setReadFailure(true);f.intervals[0].callback();
 assert.equal(f.writes.filter(([key])=>key.startsWith(N+'bottle_main_')).length,0);assert.equal(f.properties.get(N+'secret_main_piece'),254);assert.equal(f.warnings.length,1);
 f.setReadFailure(false);f.intervals[0].callback();assert.deepEqual(f.layers('main'),[3,0,0,0,0,0,0,0]);
});
test('player leave clears successful cache for the same player ID',()=>{
 const f=fixture();f.main=f.stack(PENDING,[ids[3]]);f.api.syncBottleHeld(f.player);const written=f.writes.length;
 f.callbacks.playerLeave({playerId:f.player.id});f.api.syncBottleHeld(f.player);assert.ok(f.writes.length>written);
 assert.deepEqual(f.layers('main'),[4,0,0,0,0,0,0,0]);assert.equal(f.properties.get(N+'secret_main_piece'),214);
});

test('swapping distinct held bottles swaps projections without cross-hand stale layers',()=>{
 const f=fixture(),main=f.stack(EMPTY,ids),off=f.stack(PENDING,[ids[7],ids[1]]);
 f.main=main;f.off=off;f.api.syncBottleHeld(f.player);
 f.main=off;f.off=main;f.intervals[0].callback();
 assert.deepEqual(f.layers('main'),[8,2,0,0,0,0,0,0]);assert.deepEqual(f.layers('off'),[1,2,3,4,5,6,7,8]);
 assert.strictEqual(f.main,off);assert.strictEqual(f.off,main);
});
for(const hand of ['main','off'])for(const next of [undefined,'minecraft:stone',N+'special_seasoning_r8_v0'])test(`${hand} full bottle to ${next??'unequipped'} clears all stale layers and preserves opposite hand`,()=>{
 const f=fixture(),opposite=hand==='main'?'off':'main';f[hand]=f.stack(EMPTY,ids);const other=f.stack(PENDING,[ids[7]]);f[opposite]=other;
 f.api.syncBottleHeld(f.player);f[hand]=next===undefined?undefined:f.stack(next,ids);f.intervals[0].callback();
 assert.deepEqual(f.layers(hand),zeros());assert.deepEqual(f.layers(opposite),[8,0,0,0,0,0,0,0]);assert.strictEqual(f[opposite],other);
});
for(const hand of ['main','off'])test(`${hand} malformed or missing DP clears an already populated projection without touching the other hand`,()=>{
 const f=fixture(),opposite=hand==='main'?'off':'main',other=f.stack(PENDING,[ids[4]]);f[opposite]=other;
 for(const raw of [undefined,'broken','{}','null','[4,null]']){
  f[hand]=f.stack(EMPTY,ids);f.api.syncBottleHeld(f.player);
  const broken=f.stack(EMPTY,[],raw);f[hand]=broken;f.api.syncBottleHeld(f.player);
  assert.deepEqual(f.layers(hand),zeros());assert.deepEqual(f.layers(opposite),[5,0,0,0,0,0,0,0]);assert.strictEqual(f[hand],broken);assert.strictEqual(f[opposite],other);
 }
});
for(const hand of ['main','off'])test(`${hand}-only DP read failure hides that hand, preserves its payload and retries independently`,()=>{
 const f=fixture(),opposite=hand==='main'?'off':'main';f[hand]=f.stack(EMPTY,[ids[0]]);f[opposite]=f.stack(PENDING,[ids[1]]);f.api.syncBottleHeld(f.player);
 const unreadable=f.stack(EMPTY,[ids[7]]);f[hand]=unreadable;f[opposite]=f.stack(PENDING,[ids[6]]);
 const written=f.writes.length;f.setReadFailure(s=>s===unreadable);f.intervals[0].callback();assert.equal(f.warnings.length,1);
 assert.equal(f.writes.slice(written).filter(([key])=>key.startsWith(N+'bottle_'+hand+'_')).length,0);
 assert.equal(f.properties.get(N+'secret_'+hand+'_piece'),254);
 assert.deepEqual(f.layers(hand),[1,0,0,0,0,0,0,0]);assert.deepEqual(f.layers(opposite),[7,0,0,0,0,0,0,0]);
 f.setReadFailure(false);f.intervals[0].callback();assert.equal(f.properties.get(N+'secret_'+hand+'_piece'),214);
 assert.deepEqual(f.layers(hand),[8,0,0,0,0,0,0,0]);assert.deepEqual(f.layers(opposite),[7,0,0,0,0,0,0,0]);
});
for(const hand of ['main','off'])for(const index of [0,7])for(const before of [false,true])test(`failed ${hand} layer ${index} ${before?'before':'after'} property mutation retries both hands after reverting to cached state`,()=>{
 const f=fixture(),originalMain=f.stack(EMPTY,[ids[0]]),originalOff=f.stack(PENDING,[ids[1]]);
 f.main=originalMain;f.off=originalOff;f.api.syncBottleHeld(f.player);
 f.main=f.stack(EMPTY,ids.slice().reverse());f.off=f.stack(PENDING,ids);
 let once=true;f.setFailure(key=>key===N+'bottle_'+hand+'_'+index&&once?(once=false,true):false,{before});
 f.intervals[0].callback();assert.equal(f.warnings.length,1);
 const attempts=f.writes.length;f.main=originalMain;f.off=originalOff;f.intervals[0].callback();
 assert.ok(f.writes.length>attempts,'An old successful signature must not suppress retry');
 assert.deepEqual(f.layers('main'),[1,0,0,0,0,0,0,0]);assert.deepEqual(f.layers('off'),[2,0,0,0,0,0,0,0]);
 assert.equal(f.properties.get(N+'secret_main_piece'),214);assert.equal(f.properties.get(N+'secret_off_piece'),214);
 const written=f.writes.length;f.intervals[0].callback();assert.equal(f.writes.length,written);
});
test('interval isolates projections and successful caches between separate players',()=>{
 const f=fixture(),other=f.addPlayer('other-holder');f.main=f.stack(EMPTY,[ids[0]]);f.off=f.stack(PENDING,[ids[7]]);
 other.main=f.stack(EMPTY,[ids[0]]);other.off=f.stack(PENDING,[ids[7]]);f.intervals[0].callback();
 assert.ok(f.writes.length>0);assert.equal(other.writes.length,f.writes.length,'An identical projection for another ID is still published');
 const otherWritten=other.writes.length;
 f.main=f.stack(EMPTY,[ids[4]]);f.intervals[0].callback();assert.deepEqual(f.layers('main'),[5,0,0,0,0,0,0,0]);
 assert.deepEqual(other.layers('main'),[1,0,0,0,0,0,0,0]);assert.equal(other.writes.length,otherWritten);
 const written=f.writes.length;f.callbacks.playerLeave({playerId:f.player.id});f.intervals[0].callback();assert.ok(f.writes.length>written);assert.equal(other.writes.length,otherWritten);
});
test('one unreadable player cannot prevent the interval from publishing another player',()=>{
 const f=fixture(),other=f.addPlayer('healthy-holder'),broken=f.stack(EMPTY,[ids[0]]);f.main=broken;other.main=f.stack(PENDING,[ids[6]]);
 f.setReadFailure(s=>s===broken);f.intervals[0].callback();assert.equal(f.writes.filter(([key])=>key.startsWith(N+'bottle_main_')).length,0);assert.equal(f.warnings.length,1);
 assert.equal(f.properties.get(N+'secret_main_piece'),254);
 assert.deepEqual(other.layers('main'),[7,0,0,0,0,0,0,0]);assert.ok(other.writes.length>0);
});
