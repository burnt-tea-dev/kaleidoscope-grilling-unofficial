/** Stable ItemStack API doubles and canonical function bodies, never an engine certificate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2743_seasoning_contract_core.js';
import * as metadata from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js';
import * as itemData from '../../projects/grilling/gameplay_core/behavior_pack/scripts/itemDataCore.js';
import * as rack from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2746_advanced_rack_core.js';
import {bottleHeldVisualPlan} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/bottle_held_visual_core.js';
import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {playSeasoningShakeAudio,stopSoundHandle} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/immersion_audio_core.js';
import {flatulenceSoundOrigin as seasoningFinishSoundOrigin} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/flatulence_sound_runtime.js';
const N='kaleidoscope_grilling:',EMPTY=core.EMPTY_BOTTLE_ID,PENDING=core.PENDING_SEASONING_ID;
const root=new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const strip=s=>s.replace(/^import\b[\s\S]*?;\s*/gm,'').replace(/\bexport (?=(class|const|function|async))/g,'');
function body(s,n){const start=s.indexOf('function '+n+'(');assert.ok(start>=0,n);let i=s.indexOf('{',start),d=1,end=i+1;for(;d&&end<s.length;end++){if(s[end]==='{')d++;if(s[end]==='}')d--;}return s.slice(start,end)}
class Stack{
 constructor(typeId,amount=1){Object.assign(this,{typeId,amount,maxAmount:1,props:{},lore:[],canDestroy:[],canPlaceOn:[]});}
 clone(){return Object.assign(new Stack(this.typeId,this.amount),structuredClone({...this}));}
 getRawLore(){return structuredClone(this.lore)} getLore(){return this.lore} setLore(v){this.lore=structuredClone(v)}
 getDynamicPropertyIds(){return Object.keys(this.props)} getDynamicProperty(k){return structuredClone(this.props[k])} setDynamicProperty(k,v){if(v===undefined)delete this.props[k];else this.props[k]=structuredClone(v)}
 getCanDestroy(){return [...this.canDestroy]} setCanDestroy(v){this.canDestroy=[...v]} getCanPlaceOn(){return [...this.canPlaceOn]} setCanPlaceOn(v){this.canPlaceOn=[...v]} getComponent(){return undefined}
}
function decorated(id,fill){const s=new Stack(id);Object.assign(s,{nameTag:'Exact name',lore:[{translate:'custom.lore',with:['kept']},{text:'§rCustom'}],keepOnDeath:true,lockMode:'inventory',canDestroy:['minecraft:dirt'],canPlaceOn:['minecraft:stone'],opaque:{nativeOnly:true}});s.props={[core.SEASONING_LIST_KEY]:JSON.stringify(Array(fill).fill('minecraft:redstone')),'x:string':'value','x:bool':true,'x:vector':{x:1,y:2,z:3},'x:number':13};return s}
function fixture(){
 const events={},system={currentTick:10},inventory={size:3,rows:[],getItem(i){return this.rows[i]?.clone()},setItem(i,s){this.rows[i]=s?.clone()}},player={id:'holder',selectedSlotIndex:0};let off;
 const world={afterEvents:Object.fromEntries(['playerSpawn','playerLeave'].map(k=>[k,{subscribe(f){events[k]=f}}]))};
 const context=vm.createContext({...core,...metadata,...itemData,world,system,ItemStack:Stack,EnchantmentType:class {constructor(id){this.id=id}},playerInventory:()=>inventory,getOffHand:()=>off?.clone(),setOffHand:(_,s)=>off=s?.clone()});
 vm.runInContext(body(read('eating_item_runtime.js'),'copyEatingVariant'),context);vm.runInContext(strip(read('bottle_fill_item_runtime.js')),context);
 const api=vm.runInContext('({retargetBottleFillStack,bottleFillIngredients,refreshBottleFillSlot,prepareBottleFillItems})',context);
 return {api,events,system,inventory,player,get off(){return off},set off(s){off=s}};
}
const plain=x=>JSON.parse(JSON.stringify(x));
for(const [kind,base] of [['partial',EMPTY],['pending',PENDING]])for(let fill=1;fill<=8;fill++)test(kind+' '+fill+' aliases held/rack mechanics and preserves stable metadata',()=>{
 const id=N+kind+'_seasoning_f'+fill,source=decorated(base,fill),f=fixture(),out=f.api.retargetBottleFillStack(source);
 assert.equal(out.typeId,id);assert.equal(core.canonicalSeasoningBottleId(id),base);assert.equal(core.isPendingSeasoningId(id),kind==='pending');assert.equal(core.isEmptySeasoningId(id),kind==='partial');
 const expected=metadata.captureSkewerMetadata(source);expected.id=id;assert.equal(metadata.metadataSignature(metadata.captureSkewerMetadata(out)),metadata.metadataSignature(expected));assert.equal(out.amount,source.amount);assert.equal(out.opaque,undefined);
 assert.deepEqual(bottleHeldVisualPlan(id,Array(fill).fill('minecraft:redstone')),Array.from({length:8},(_,i)=>i<fill?8:0));
 assert.equal(rack.rackCanPlace(0,id),true);assert.equal(rack.rackCanPlace(5,id),false);assert.deepEqual(rack.rackCanonicalFilter(id),rack.rackCanonicalFilter(base));
 assert.equal(core.seasoningFillVisualId(out.typeId,[]),base);assert.equal(core.seasoningFillVisualId(out.typeId,['minecraft:redstone']),N+kind+'_seasoning_f1');
 assert.equal(source.typeId,base);assert.deepEqual(source.opaque,{nativeOnly:true});
});
test('lookalike IDs are not aliases and pending never demotes based on missing base',()=>{
 for(const id of [N+'pending_seasoning_f0',N+'pending_seasoning_f9',N+'pending_seasoning_f1_extra',N+'partial_seasoning_f01','other:pending_seasoning_f1'])assert.equal(core.canonicalSeasoningBottleId(id),id);
 const f=fixture(),s=decorated(PENDING,1);assert.equal(f.api.retargetBottleFillStack(s).typeId,PENDING+'_f1');
});
test('same-type clone retains opaque native fields and never runs reconstruction',()=>{
 const f=fixture(),s=decorated(PENDING+'_f2',2);assert.deepEqual(plain(f.api.retargetBottleFillStack(s)),plain(s));assert.notStrictEqual(f.api.retargetBottleFillStack(s),s);
});
test('malformed ingredient storage fails closed instead of changing item',()=>{
 const f=fixture();for(const raw of ['broken','{}','null',42]){const s=decorated(PENDING,1);s.props[core.SEASONING_LIST_KEY]=raw;assert.throws(()=>f.api.retargetBottleFillStack(s));assert.equal(s.typeId,PENDING);}
});
test('metadata write/readback failure rejects proxy and leaves source untouched',()=>{
 const f=fixture(),s=decorated(EMPTY,2),old=Stack.prototype.setDynamicProperty;
 Stack.prototype.setDynamicProperty=function(k,v){if(k!=='x:string')old.call(this,k,v)};
 try{assert.throws(()=>f.api.retargetBottleFillStack(s),/readback differs/);assert.equal(s.props['x:string'],'value');assert.equal(s.typeId,EMPTY)}finally{Stack.prototype.setDynamicProperty=old}
});
test('prewrite stale slot is never overwritten or rolled back',()=>{
 const f=fixture(),s=decorated(EMPTY,2),newer=new Stack('minecraft:diamond');let reads=0,writes=0;
 assert.throws(()=>f.api.refreshBottleFillSlot(()=>++reads===1?s:newer,()=>writes++),/changed before write/);assert.equal(writes,0);
});
test('failed readback restores original type and all native fields',()=>{
 const f=fixture(),s=decorated(EMPTY,2);let current=s,writes=0;
 assert.throws(()=>f.api.refreshBottleFillSlot(()=>current,item=>{current=item.clone();if(++writes===1)current.nameTag='corrupt'}),/readback differs/);
 assert.deepEqual(plain(current),plain(s));assert.equal(writes,2);
});
test('failed rollback is reported',()=>{
 const f=fixture(),s=decorated(EMPTY,2);let current=s;
 assert.throws(()=>f.api.refreshBottleFillSlot(()=>current,item=>{current=item.clone();current.nameTag='corrupt'}),/rollback failed/);
});
test('inventory/offhand refresh skips active use and clears scan history on leave/spawn',()=>{
 const f=fixture();f.inventory.rows[0]=decorated(EMPTY,1);f.inventory.rows[2]=decorated(PENDING,4);f.off=decorated(PENDING,2);
 f.api.prepareBottleFillItems(f.player,true);assert.equal(f.off.typeId,PENDING);assert.equal(f.inventory.rows[0].typeId,EMPTY);
 f.api.prepareBottleFillItems(f.player,false);assert.equal(f.inventory.rows[0].typeId,N+'partial_seasoning_f1');assert.equal(f.inventory.rows[2].typeId,PENDING+'_f4');assert.equal(f.off.typeId,PENDING+'_f2');
 for(const event of ['playerLeave','playerSpawn']){f.inventory.rows[2]=decorated(PENDING,3);f.events[event]({player:f.player,playerId:f.player.id});f.api.prepareBottleFillItems(f.player);assert.equal(f.inventory.rows[2].typeId,PENDING+'_f3');}
});
test('one unreadable bottle preserves its data without blocking other slots, food preparation or bounding scans',()=>{
 const f=fixture(),bad=decorated(PENDING,1);bad.props[core.SEASONING_LIST_KEY]='broken';
 f.inventory.rows[0]=bad;f.inventory.rows[2]=decorated(PENDING,4);f.off=decorated(PENDING,2);
 const reads=[],originalRead=f.inventory.getItem;f.inventory.getItem=function(slot){reads.push(slot);return originalRead.call(this,slot)};
 assert.throws(()=>f.api.prepareBottleFillItems(f.player),error=>error.name==='SyntaxError');
 assert.deepEqual(plain(f.inventory.rows[0]),plain(bad));assert.equal(f.inventory.rows[2].typeId,PENDING+'_f4');assert.equal(f.off.typeId,PENDING+'_f2');
 f.inventory.rows[2]=decorated(PENDING,3);f.system.currentTick++;reads.length=0;
 assert.throws(()=>f.api.prepareBottleFillItems(f.player),error=>error.name==='SyntaxError');assert.deepEqual(reads,[0],'failed sweep must retain its twenty-tick budget');assert.equal(f.inventory.rows[2].typeId,PENDING);
 const main=read('main.js'),start=main.indexOf('  try{prepareBottleFillItems(p,'),end=main.indexOf('  if(active&&',start);let foodPrepares=0;
 assert.ok(start>0&&end>start);
 vm.runInNewContext(main.slice(start,end),{p:f.player,active:undefined,PENDING_USES:new Map(),system:{currentTick:1},
  prepareBottleFillItems(){throw Error('unreadable bottle')},prepareEatingItems(){foodPrepares++},grillingConfig:()=>({enableEatingAnimations:true}),console:{warn(){}}});
 assert.equal(foodPrepares,1,'independent native food animation preparation must still run');
});
test('all pending proxies start and complete native use; partial proxies do not shake',()=>{
 const events={},uses=new Map(),animations=[],sounds=[];let completed=0;
 const world={afterEvents:Object.fromEntries(['itemStartUse','itemCompleteUse'].map(k=>[k,{subscribe(f){events[k]=f}}]))};
 const context=vm.createContext({...core,world,canonicalFoodId,PENDING_USES:uses,stopSoundHandle,playSeasoningShakeAudio,seasoningFinishSoundOrigin,captureInteractionIntent:()=>({hand:'off'}),captureEatingIdentity:s=>({identity:s.typeId}),hideJavaEatingHud(){},syncSeasoningMotion(){},completePending(){completed++},PLATE_ID:N+'skewer_plate',CUISINE_FOOD_SET:new Set(),FOOD_DATA:{},SECRET_ID:N+'secret_skewer',dangerousPreservation(){}});
 // Keep the real runtime wrapper and its pure audio/origin dependencies; only
 // the native Player sound request/handle is doubled in this extracted fixture.
 vm.runInContext(body(read('immersion_audio_runtime.js'),'seasoningShakeSound'),context);
 const source=read('main.js');
 // Only register the two relevant listeners, using their original complete bodies.
 for(const [event,next] of [['itemStartUse','itemCompleteUse'],['itemCompleteUse','itemStopUse']]){const a=source.indexOf('world.afterEvents.'+event+'.subscribe('),b=source.indexOf('world.afterEvents.'+next+'.subscribe(',a);vm.runInContext(source.slice(a,b),context);}
 const player={id:'holder',selectedSlotIndex:0,location:{x:1,y:64,z:2},dimension:{getPlayers:()=>[player]},playAnimation(name,options){animations.push({name,options})},playSound(name,options){const handle={stops:0,stop(){this.stops++}};sounds.push({name,options,handle});return handle}};
 for(let fill=1;fill<=8;fill++){
  const previous={stops:0,stop(){this.stops++}};uses.set(player.id,{audio:previous});
  const pending=decorated(PENDING+'_f'+fill,fill);events.itemStartUse({source:player,itemStack:pending});assert.equal(uses.get(player.id).stack.typeId,pending.typeId);assert.ok(animations.at(-1).options.stopExpression.includes(pending.typeId));events.itemCompleteUse({source:player,itemStack:pending});
  assert.equal(previous.stops,1);assert.equal(sounds.length,fill);assert.equal(sounds.at(-1).name,'kg_imm.shake_seasoning');assert.deepEqual(sounds.at(-1).options,{volume:.8,pitch:1});assert.equal(uses.get(player.id).audio,sounds.at(-1).handle);assert.equal(sounds.at(-1).handle.stops,0);
  uses.clear();events.itemStartUse({source:player,itemStack:decorated(N+'partial_seasoning_f'+fill,fill)});assert.equal(uses.size,0);
  assert.equal(sounds.length,fill);assert.equal(previous.stops,1);assert.equal(sounds.at(-1).handle.stops,0);
 }
 assert.equal(completed,8);
});
