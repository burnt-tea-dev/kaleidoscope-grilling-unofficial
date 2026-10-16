import {createFailedSkewer,FAILED_SOURCE_KEY} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_visual_core.js';
import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
/** Fault-injected production functions; storage doubles are not Minecraft players. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as tx from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_transaction_core.js';
import * as plate from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a25_plate_recipe_core.js';
import * as snapshot from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js';
import * as item from '../../projects/grilling/gameplay_core/behavior_pack/scripts/itemDataCore.js';
import * as intentCore from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2762_interaction_intent_core.js';
import {isInitialBlockPress} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a275_grill_input_core.js';
import * as support from '../../projects/grilling/gameplay_core/behavior_pack/scripts/blockSupport.js';
const base=new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/',import.meta.url);
const source=fs.readFileSync(new URL('a25_plate_recipe_runtime.js',base),'utf8').replace(/^import\b[\s\S]*?;\s*/gm,'').replace(/\bexport (?=(function|const))/g,'');
class Stack{
 constructor(typeId,amount=1){Object.assign(this,{typeId,amount,maxAmount:1,props:{},lore:[],keepOnDeath:false,lockMode:'none'});}
 clone(){const s=new Stack(this.typeId,this.amount);Object.assign(s,structuredClone({...this}));return s;}
 getDynamicProperty(k){return this.props[k]} getDynamicPropertyIds(){return Object.keys(this.props)}
 setDynamicProperty(k,v){if(v===undefined)delete this.props[k];else this.props[k]=v}
 getRawLore(){return structuredClone(this.lore)} getLore(){return this.lore.map(x=>typeof x==='string'?x:x.text??'')}
 setLore(v){this.lore=structuredClone(v)}
 getCanDestroy(){return []}getCanPlaceOn(){return []}setCanDestroy(){}setCanPlaceOn(){}
 getComponent(k){return k==='minecraft:food'?{nutrition:4,saturationModifier:.4}:undefined}
}
const N='kaleidoscope_grilling:',PLATE=N+'skewer_plate_block',food=()=>{const s=new Stack(N+'grilled_beef_skewer');s.nameTag='named food';s.lore=[{translate:'item.foreign.food',with:['保留']}];s.props['foreign:value']='preserve';return s;};
function fixture(savedDp){
 const dp=new Map(savedDp),slots=new Map(),entities=[],events={},scheduled=[],intervals=[],components=new Map(),neighbors=new Map(),dirty=[];let fault;
 function write(k,v){if(v===undefined)dp.delete(k);else dp.set(k,v);if(fault?.(k,v))throw Error('post-write failure')}
 const permutation=(typeId,states={})=>({type:{id:typeId},getState:k=>states[k],getAllStates:()=>({...states}),withState(k,v){return permutation(typeId,{...states,[k]:v})}});
 const at=p=>[p.x,p.y,p.z].join('/');
 const dimension={id:'minecraft:overworld',getBlock:p=>at(p)===at(block.location)?block:neighbors.get(at(p)),playSound(){},spawnItem(stack){
  let valid=true;const e={get isValid(){return fault?.('dropValidity')?undefined:valid},stack:stack.clone(),getComponent(){return {itemStack:fault?.('dropRead')?new Stack('minecraft:stone'):this.stack}},remove(){if(fault?.('dropRemoveBefore'))throw Error('drop removal unavailable');valid=false;if(fault?.('dropRemove'))throw Error('drop cleanup post-write failure')}};
  entities.push(e);if(fault?.('spawn'))throw Error('spawn outcome unknown');return e;
 }};
 const block={x:0,y:80,z:0,location:{x:0,y:80,z:0},dimension,typeId:PLATE,permutation:permutation(PLATE,{[N+'plate_count']:0,'minecraft:cardinal_direction':'north'}),
  setPermutation(p){this.permutation=p;this.typeId=p.type.id;if(fault?.('block',p))throw Error('block post-write failure')},
  setType(id){this.typeId=id;this.permutation=permutation(id,id===PLATE?{[N+'plate_count']:0,'minecraft:cardinal_direction':'north'}:id===plate.RECIPE_BLOCK_ID?{'minecraft:cardinal_direction':'north'}:{});if(id==='minecraft:air'&&fault?.('remove'))throw Error('remove post-write failure')}};
 const holder={selectedSlotIndex:0,isSneaking:true,getRotation:()=>({y:90}),creative:false};
 const held=(p,h)=>slots.get(h==='off'?'off':p.selectedSlotIndex);
 const setHand=(p,h,s)=>{const key=h==='off'?'off':p.selectedSlotIndex;slots.set(key,s?.clone());if(fault?.('hand',s))throw Error('hand post-write failure')};
 const captureWritableHand=(p,h)=>{const key=h==='off'?'off':p.selectedSlotIndex;return {before:slots.get(key)?.clone(),read:()=>slots.get(key),write(s){slots.set(key,s?.clone());if(fault?.('hand',s))throw Error('hand post-write failure')}}};
 const c=vm.createContext({canonicalFoodId,...tx,...plate,...snapshot,...item,recipeTable:()=>[{id:N+'raw_beef_skewer',cooked:N+'grilled_beef_skewer'}],RAW_SKEWER_TAG:'raw',GRILLED_SKEWER_TAG:'grilled',ItemStack:Stack,
  world:{getDynamicProperty:k=>dp.get(k),setDynamicProperty:write,getDynamicPropertyIds:()=>[...dp.keys()],getDimension:()=>dimension,beforeEvents:{itemUse:{subscribe(fn){events.itemUse=fn}},playerInteractWithBlock:{subscribe(fn){events.blockUse=fn}},playerBreakBlock:{subscribe(fn){events.break=fn}},explosion:{subscribe(fn){events.explosion=fn}}},afterEvents:{blockExplode:{subscribe(fn){events.blockExplode=fn}},playerBreakBlock:{subscribe(fn){events.afterBreak=fn}}}},
  system:{currentTick:1,run(fn){scheduled.push(fn)},runInterval(fn,ticks){intervals.push({fn,ticks})},
   beforeEvents:{startup:{subscribe(fn){
    fn({blockComponentRegistry:{registerCustomComponent:(id,handlers)=>components.set(id,handlers)}});
   }}}
  },
  console:{warn(){}},SECRET_ID:N+'secret_skewer',captureWritableHand,queueStationContentsVisual(b){dirty.push({typeId:b.typeId,location:{...b.location},saved:new Map(dp)});if(fault?.('queue'))throw Error('display queue unavailable')},
  mainContainer:()=>({size:36,getItem:k=>slots.get(k)?.clone(),setItem(k,s){slots.set(k,s?.clone());if(fault?.('inventory',s))throw Error('inventory post-write failure')}}),
  heldByHand:held,heldMain:p=>held(p,'main'),heldOff:p=>held(p,'off'),setHand,creative:p=>p?.creative??false,hasSolidTop:()=>true,hasFullCubeCollision:b=>support.hasFullCubeCollision(b?.permutation?b:b?{...b,permutation:permutation(b.typeId)}:b),hasSturdySide:support.hasSturdySide,isInitialBlockPress,grillingConfig:()=>({interceptCookeryTableWhenPlacingPlate:holder.interceptTable??true}),
  captureInteractionIntent:(p,s)=>intentCore.captureInteractionIntentFromStacks(s,held(p,'main'),held(p,'off'),p.selectedSlotIndex),
  interactionIntentStillCurrent:(p,i)=>intentCore.interactionIntentMatchesStacks(i,held(p,'main'),held(p,'off'),p.selectedSlotIndex),
  interactionStackSignature:s=>s?JSON.stringify(s):'',interactionFeedback(){},UNFINISHED_ID:N+'unfinished_skewer'});
 vm.runInContext(source+'\nglobalThis.api={a25PlateRows,a25PlateItem,a25RestoreStack,readPlateBlock,placePlateOn,handlePlateBlock,plateStorageStep,plateTransaction,posKey,plateFaultKey,breakPlate,bookItem,stackRow,placeRecipeBlock,readRecipeBlock,handleRecipeBlock,breakRecipe,recipeFaultKey,recipeActionSnapshot,recoverRecipeDelivery,a25ReadRecipeDisplayStack};',c);
 const api=c.api,key=api.posKey(N+'a25_plate_',block);
 return {dp,slots,entities,events,scheduled,intervals,components,dirty,flush(){while(scheduled.length)scheduled.shift()()},block,holder,api,key,
  neighbor(id,location,states={}){const b={typeId:id,...location,location,dimension,permutation:permutation(id,states)};neighbors.set(at(location),b);return b},
  set fault(f){fault=f},oneFailure(target){let once=true;fault=k=>k===target&&once?(once=false,true):false},rows(n=1){const rows=Array.from({length:n},(_,i)=>{const s=food();s.nameTag='named food '+i;s.props['qa:slot']=i;return {id:s.typeId,native:snapshot.captureSkewerMetadata(s),nutrition:4,saturation:.4}});dp.set(key,JSON.stringify(rows));block.permutation=block.permutation.withState(N+'plate_count',n);return rows;},
  recipe(){block.setType(plate.RECIPE_BLOCK_ID);const original=new Stack(plate.BOOK_ID);original.nameTag='named recipe';original.lore=[{translate:'item.foreign.recipe',with:['保留']}];original.props['foreign:value']='preserve';const book=api.bookItem({resultId:N+'raw_beef_skewer'},undefined,original),recipeKey=api.posKey(N+'a25_recipe_',block);dp.set(recipeKey,JSON.stringify({...api.stackRow(book),placementId:'original'}));return {book,key:recipeKey,raw:dp.get(recipeKey)}}};
}
test('invalid saved rows are rejected, never filtered or truncated',()=>{
 for(const raw of [null,1,'{',JSON.stringify({}),JSON.stringify([null]),JSON.stringify([{id:'bad'}]),JSON.stringify([{id:'x:food',native:{version:2,id:'x:food'}}]),JSON.stringify([{id:'x:food',native:{version:1,id:'x:other'}}]),JSON.stringify(Array(6).fill({id:'x:food'}))])assert.throws(()=>tx.decodePlateStorage(raw));
 assert.deepEqual(tx.decodePlateStorage(undefined),[]);
 const f=fixture();f.dp.set(f.key,'damaged');assert.throws(()=>f.api.readPlateBlock(f.block));assert.equal(f.dp.get(f.key),'damaged');
});
test('placement uses Java player direction, including wrap and exact quarter-turn boundaries',()=>{
 for(const [yaw,expected] of [[0,'south'],[90,'west'],[180,'north'],[-90,'east'],[360,'south'],[45,'west'],[-45,'south'],[-135,'east']])assert.equal(tx.plateFacingFromYaw(yaw),expected);
 assert.throws(()=>tx.plateFacingFromYaw(NaN));
});
for(const hand of ['main','off']){
 test('taking last skewer in '+hand+' preserves native metadata',()=>{
  const f=fixture(),rows=f.rows(2);f.api.handlePlateBlock(f.block,f.holder,hand);
  assert.equal(JSON.parse(f.dp.get(f.key)).length,1);assert.equal(f.block.permutation.getState(N+'plate_count'),1);
  assert.deepEqual(snapshot.captureSkewerMetadata(f.slots.get(hand==='off'?'off':0)),rows[1].native);
 });
 for(const target of ['hand', 'property', 'block'])test('take '+hand+' '+target+' post-write rejection restores ownership',()=>{
  const f=fixture();f.rows(2);const old=f.dp.get(f.key);f.oneFailure(target==='property'?f.key:target);
  f.api.handlePlateBlock(f.block,f.holder,hand);assert.equal(f.dp.get(f.key),old);assert.equal(f.slots.get(hand==='off'?'off':0),undefined);assert.equal(f.block.permutation.getState(N+'plate_count'),2);
 });
 test('inserting '+hand+' rolls back saved rows and original stack count on debit rejection',()=>{
  const f=fixture();f.rows(1);const old=f.dp.get(f.key),s=food();s.amount=3;f.slots.set(hand==='off'?'off':0,s);f.holder.isSneaking=false;f.oneFailure('hand');
  f.api.handlePlateBlock(f.block,f.holder,hand);assert.equal(f.dp.get(f.key),old);assert.equal(f.slots.get(hand==='off'?'off':0).amount,3);
 });
 for(const target of ['hand','property','block'])test('placement '+hand+' '+target+' rejection restores replaceable block, saved absence and source',()=>{
  const f=fixture();f.block.setType('minecraft:short_grass');const s=food();f.slots.set(hand==='off'?'off':0,s);f.oneFailure(target==='property'?f.key:target);
  assert.equal(f.api.placePlateOn({typeId:'minecraft:stone',x:0,y:79,z:0,dimension:f.block.dimension},'up',f.holder,s,hand),false);
  assert.equal(f.block.typeId,'minecraft:short_grass');assert.equal(f.dp.has(f.key),false);assert.deepEqual(snapshot.captureSkewerMetadata(f.slots.get(hand==='off'?'off':0)),snapshot.captureSkewerMetadata(s));
 });
}
test('successful placement faces west and creative placement retains source',()=>{
 for(const creative of [false,true]){const f=fixture();f.block.setType('minecraft:air');const s=food();f.slots.set(0,s);f.holder.creative=creative;
  assert.equal(f.api.placePlateOn({typeId:'minecraft:stone',x:0,y:79,z:0,dimension:f.block.dimension},'up',f.holder,s),true);
  assert.equal(f.block.permutation.getState('minecraft:cardinal_direction'),'west');assert.equal(f.api.readPlateBlock(f.block).length,1);assert.equal(!!f.slots.get(0),creative);
 }
});
test('orphaned data prevents overwriting a removed plate location',()=>{
 const f=fixture();f.rows(1);const old=f.dp.get(f.key);f.block.setType('minecraft:air');f.slots.set(0,food());
 assert.throws(()=>f.api.placePlateOn({typeId:'minecraft:stone',x:0,y:79,z:0,dimension:f.block.dimension},'up',f.holder,f.slots.get(0)),/orphaned/);assert.equal(f.dp.get(f.key),old);assert.equal(f.block.typeId,'minecraft:air');
});
test('incomplete rollback persists quarantine and blocks later reads/transfers',()=>{
 const f=fixture();f.rows(1);f.fault=k=>k==='hand';assert.throws(()=>f.api.handlePlateBlock(f.block,f.holder),/recovery required/);
 const key=f.api.plateFaultKey(f.block);assert.ok(f.dp.has(key));f.fault=undefined;assert.throws(()=>f.api.readPlateBlock(f.block),/quarantined/);
});
test('native hand adapter pins original slot for read, apply and rollback',()=>{
 const ioSource=fs.readFileSync(new URL('a2735_player_io.js',base),'utf8').replace(/^import\b[\s\S]*?;\s*/gm,'').replace(/\bexport (?=(function|const))/g,'');
 const rows=new Map([[3,food()],[4,new Stack('minecraft:stone')]]),io=vm.createContext({canonicalFoodId,EquipmentSlot:{Offhand:'off'}});
 vm.runInContext(ioSource+'\nglobalThis.capture=captureWritableHand;',io);
 const holder={selectedSlotIndex:3,getComponent:()=>({container:{size:36,getItem:k=>rows.get(k),setItem:(k,v)=>rows.set(k,v)}})};
 const bound=io.capture(holder,'main'),after=food();after.amount=2;
 holder.selectedSlotIndex=4;
 const step=tx.verifiedPlateStep({read:bound.read,write:bound.write,before:bound.before,after,signature:s=>s?JSON.stringify(s):''});
 step.apply();assert.equal(rows.get(3).amount,2);step.rollback();assert.equal(rows.get(3).amount,1);assert.equal(rows.get(4).typeId,'minecraft:stone');
});
test('pre-write conflict preserves changed input instead of rolling it back',()=>{
 let value='other';const step=tx.verifiedPlateStep({read:()=>value,write:v=>{value=v},before:'old',after:'new'});
 assert.equal(tx.commitPlateSteps([step],()=>assert.fail()).ok,false);assert.equal(value,'other');
});

test('breaking a full plate delivers one packed item containing all native snapshots',()=>{
 const f=fixture(),rows=f.rows(5);assert.equal(f.api.breakPlate(f.block),true);
 assert.equal(f.block.typeId,'minecraft:air');assert.equal(f.dp.has(f.key),false);const live=f.entities.filter(e=>e.isValid);assert.equal(live.length,1);
 assert.deepEqual(JSON.parse(item.getItemProperty(live[0].stack,plate.PLATE_SKEWERS_KEY)).map(r=>r.native),rows.map(r=>r.native));
 assert.equal(f.api.breakPlate(f.block),false);assert.equal(f.entities.filter(e=>e.isValid).length,1);
});
for(const target of ['dropRead','property','remove'])test('break '+target+' failure preserves plate and removes provisional drop',()=>{
 const f=fixture();f.rows(3);const raw=f.dp.get(f.key),state=JSON.stringify(f.block.permutation.getAllStates());f.oneFailure(target==='property'?f.key:target);
 assert.equal(f.api.breakPlate(f.block),false);assert.equal(f.block.typeId,PLATE);assert.equal(f.dp.get(f.key),raw);assert.equal(JSON.stringify(f.block.permutation.getAllStates()),state);assert.equal(f.entities.filter(e=>e.isValid).length,0);
});
test('spawn exception leaves contents intact and persists quarantine instead of retrying',()=>{
 const f=fixture();f.rows(2);const raw=f.dp.get(f.key);f.oneFailure('spawn');assert.equal(f.api.breakPlate(f.block),false);assert.equal(f.dp.get(f.key),raw);assert.equal(f.block.typeId,PLATE);
 assert.ok(f.dp.has(f.api.plateFaultKey(f.block)));assert.throws(()=>f.api.breakPlate(f.block),/quarantined/);assert.equal(f.entities.length,1);
});
test('creative and empty plate breaks do not generate a packed plate',()=>{
 for(const creative of [false,true]){const f=fixture();if(creative)f.rows(2);f.holder.creative=creative;assert.equal(f.api.breakPlate(f.block,f.holder),true);assert.equal(f.entities.length,0);assert.equal(f.dp.has(f.key),false);assert.equal(f.block.typeId,'minecraft:air');}
});
test('explosion callback removes only plate blocks from native destruction',()=>{
 const f=fixture();f.rows(2);const other={typeId:'minecraft:stone'};let kept;
 f.events.explosion({cancel:false,getImpactedBlocks:()=>[other,f.block],setImpactedBlocks:r=>{kept=r}});
 assert.equal(kept.length,1);assert.equal(kept[0],other);assert.equal(f.dp.has(f.key),true); // Before-event only schedules the actual transaction.
});

test('unconfirmed provisional drop cleanup blocks later break retries',()=>{
 const f=fixture();f.rows(2);const raw=f.dp.get(f.key);let propertyOnce=true;
 f.fault=k=>k==='dropRemoveBefore'||(k===f.key&&propertyOnce?(propertyOnce=false,true):false);
 assert.throws(()=>f.api.breakPlate(f.block),/recovery required/);assert.equal(f.dp.get(f.key),raw);assert.equal(f.entities.filter(e=>e.isValid).length,1);
 f.fault=undefined;assert.throws(()=>f.api.breakPlate(f.block),/quarantined/);assert.equal(f.entities.length,1);
});

for(const timing of ['before','after'])test('cancelled explosion '+timing+' plate callback preserves block and payload',()=>{
 const f=fixture();f.rows(2);const raw=f.dp.get(f.key);let writes=0;
 const event={cancel:timing==='before',getImpactedBlocks:()=>[f.block],setImpactedBlocks(){writes++}};
 f.events.explosion(event);if(timing==='before'){assert.equal(writes,0);assert.equal(f.scheduled.length,0)}
 event.cancel=true;f.flush();assert.equal(f.block.typeId,PLATE);assert.equal(f.dp.get(f.key),raw);assert.equal(f.entities.length,0);
});
test('confirmed uncancelled explosion executes one packed drop in queued callback',()=>{
 const f=fixture();const rows=f.rows(2);f.events.explosion({cancel:false,getImpactedBlocks:()=>[f.block],setImpactedBlocks(){}});f.flush();
 assert.equal(f.block.typeId,'minecraft:air');assert.equal(f.dp.has(f.key),false);assert.equal(f.entities.filter(e=>e.isValid).length,1);
 assert.deepEqual(JSON.parse(item.getItemProperty(f.entities[0].stack,plate.PLATE_SKEWERS_KEY)).map(r=>r.native),rows.map(r=>r.native));
});
test('unreadable deferred explosion status fails closed without clearing plate',()=>{
 const f=fixture();f.rows(2);const raw=f.dp.get(f.key);let deferred=false;
 const event={get cancel(){if(deferred)throw Error('event unavailable');return false},getImpactedBlocks:()=>[f.block],setImpactedBlocks(){}};
 f.events.explosion(event);deferred=true;f.flush();assert.equal(f.block.typeId,PLATE);assert.equal(f.dp.get(f.key),raw);assert.equal(f.entities.length,0);
});

test('persisted quarantine blocks transfers after production module reload',()=>{
 const f=fixture();f.rows(2);f.fault=k=>k==='hand';assert.throws(()=>f.api.handlePlateBlock(f.block,f.holder),/recovery required/);
 const restored=fixture(f.dp);assert.throws(()=>restored.api.readPlateBlock(restored.block),/quarantined/);assert.equal(restored.entities.length,0);
});

test('prepared plate delivery survives module reload and prevents a second credit',()=>{const f=fixture();f.rows(2);f.dp.set(f.key+'_delivery',JSON.stringify({phase:'prepared',saved:f.dp.get(f.key)}));const restored=fixture(f.dp);assert.throws(()=>restored.api.breakPlate(restored.block),/delivery requires recovery/);assert.equal(restored.entities.length,0);});

test('plate-targeted item use cannot eat a second skewer, while other gestures retain their ownership',()=>{
 const setup=()=>{const f=fixture(),s=food();s.amount=3;f.slots.set(0,s);f.holder.isSneaking=false;f.holder.getHeadLocation=()=>({x:.5,y:80.1,z:-3});f.holder.getBlockFromViewDirection=()=>({block:f.block,faceLocation:{x:.5,y:.1,z:0}});f.holder.getEntitiesFromViewDirection=()=>[];return f;};
 for(const order of ['item_before_block','item_after_debit']){
  const f=setup(),original=f.slots.get(0).clone(),blockUse={block:f.block,player:f.holder,itemStack:original.clone(),isFirstEvent:true,cancel:false};
  const use=()=>{const stack=f.slots.get(0).clone(),event={source:f.holder,itemStack:stack,cancel:false},before=JSON.stringify(stack);f.events.itemUse(event);assert.equal(event.cancel,true,order);assert.equal(JSON.stringify(f.slots.get(0)),before);assert.equal(f.scheduled.length,0);};
  if(order==='item_before_block')use();
  f.events.blockUse(blockUse);assert.equal(blockUse.cancel,true);f.flush();
  if(order==='item_after_debit')use();
  assert.equal(f.api.readPlateBlock(f.block).length,1);assert.equal(f.slots.get(0).amount,2);
  const remaining=f.slots.get(0).clone();remaining.amount=original.amount;assert.deepEqual(snapshot.captureSkewerMetadata(remaining),snapshot.captureSkewerMetadata(original));
 }
 const full=setup();full.rows(5);const fullUse={source:full.holder,itemStack:full.slots.get(0).clone(),cancel:false};full.events.itemUse(fullUse);assert.equal(fullUse.cancel,true);assert.equal(full.slots.get(0).amount,3);assert.equal(full.api.readPlateBlock(full.block).length,5);
 for(const target of [undefined,{typeId:'minecraft:stone'}]){const f=setup();f.holder.getBlockFromViewDirection=()=>target?{block:target}:undefined;const event={source:f.holder,itemStack:f.slots.get(0).clone(),cancel:false};f.events.itemUse(event);assert.equal(event.cancel,false);assert.equal(f.slots.get(0).amount,3);assert.equal(f.scheduled.length,0);}
 const flower=setup();flower.holder.getBlockFromViewDirection=options=>({block:options.includePassableBlocks?{typeId:'minecraft:dandelion',x:0,y:80,z:-2}:flower.block,faceLocation:{x:.5,y:.1,z:0}});const flowerUse={source:flower.holder,itemStack:flower.slots.get(0).clone(),cancel:false};flower.events.itemUse(flowerUse);assert.equal(flowerUse.cancel,false,'a flower outline in front owns the block target');assert.equal(flower.slots.get(0).amount,3);assert.equal(flower.scheduled.length,0);
 for(const [distance,cancel] of [[1,false],[4,true]]){const f=setup();f.holder.getEntitiesFromViewDirection=()=>[{distance,entity:{typeId:'minecraft:cow'}}];const event={source:f.holder,itemStack:f.slots.get(0).clone(),cancel:false};f.events.itemUse(event);assert.equal(event.cancel,cancel,'entity at '+distance);assert.equal(f.slots.get(0).amount,3);assert.equal(f.scheduled.length,0);}
 const unreadable=setup();unreadable.holder.getEntitiesFromViewDirection=()=>{throw Error('ray unavailable')};const unreadableUse={source:unreadable.holder,itemStack:unreadable.slots.get(0).clone(),cancel:false};unreadable.events.itemUse(unreadableUse);assert.equal(unreadableUse.cancel,false);assert.equal(unreadable.slots.get(0).amount,3);assert.equal(unreadable.scheduled.length,0);
 const off=setup();off.slots.set(0,new Stack('minecraft:stone'));off.slots.set('off',food());off.holder.isSneaking=true;const offUse={source:off.holder,itemStack:off.slots.get('off').clone(),cancel:false};off.events.itemUse(offUse);assert.equal(offUse.cancel,false);assert.equal(off.slots.get('off').amount,1);
 const cancelled=setup();cancelled.holder.getBlockFromViewDirection=()=>assert.fail('an already-cancelled gesture must not be inspected');cancelled.events.itemUse({source:cancelled.holder,itemStack:cancelled.slots.get(0).clone(),cancel:true});assert.equal(cancelled.slots.get(0).amount,3);assert.equal(cancelled.scheduled.length,0);
});

test('raw and packed plate placement obey the same Cookery table switch in both admission and commit',()=>{
 for(const packed of [false,true])for(const enabled of [false,true]){
  const f=fixture();f.block.setType('minecraft:air');f.holder.interceptTable=enabled;
  const held=packed?new Stack(plate.PLATE_ID):food();if(packed)item.setItemProperty(held,plate.PLATE_SKEWERS_KEY,JSON.stringify([f.api.stackRow(food())]));
  f.slots.set(0,held);const table=f.neighbor('kaleidoscope_cookery:table',{x:0,y:79,z:0});
  const event={block:table,player:f.holder,itemStack:held.clone(),blockFace:'Up',isFirstEvent:true,cancel:false};
  f.events.blockUse(event);assert.equal(event.cancel,enabled);f.flush();assert.equal(f.block.typeId,enabled?PLATE:'minecraft:air');assert.equal(!!f.slots.get(0),!enabled);
  if(!enabled)assert.equal(f.api.placePlateOn(table,'up',f.holder,held),false);
 }
});
test('a sturdy top slab/upside-down stair is insufficient for Java full-cube plate placement',()=>{
 for(const [id,states] of [['minecraft:oak_slab',{'minecraft:vertical_half':'top'}],['minecraft:oak_stairs',{weirdo_direction:0,upside_down_bit:true}]]){
  const f=fixture();f.block.setType('minecraft:air');f.slots.set(0,food());const base=f.neighbor(id,{x:0,y:79,z:0},states);
  assert.equal(support.hasSolidTop(base),true);assert.equal(f.api.placePlateOn(base,'up',f.holder,f.slots.get(0)),false);assert.equal(f.block.typeId,'minecraft:air');assert.ok(f.slots.get(0));
 }
});

test('recipe placement verifies metadata and atomically restores book/support on a post-write failure',()=>{
 for(const target of ['none','hand','storage','block']){
  const f=fixture(),r=f.recipe();f.dp.delete(r.key);f.block.setType('minecraft:air');f.slots.set(0,r.book.clone());
  const wall=f.neighbor('minecraft:stone',{x:0,y:80,z:1});if(target!=='none')f.oneFailure(target==='storage'?r.key:target);
  const ok=f.api.placeRecipeBlock(wall,'north',f.holder,f.slots.get(0));assert.equal(ok,target==='none');
  if(ok){assert.equal(f.block.typeId,plate.RECIPE_BLOCK_ID);assert.equal(f.block.permutation.getState('minecraft:cardinal_direction'),'north');assert.deepEqual(JSON.parse(f.dp.get(r.key)).native,snapshot.captureSkewerMetadata(r.book));assert.equal(f.slots.get(0),undefined)}
  else{assert.equal(f.block.typeId,'minecraft:air');assert.equal(f.dp.has(r.key),false);assert.deepEqual(snapshot.captureSkewerMetadata(f.slots.get(0)),snapshot.captureSkewerMetadata(r.book))}
 }
});
test('recipe placing cannot overwrite an orphaned recording and does not debit a non-sturdy wall',()=>{
 const f=fixture(),r=f.recipe();f.block.setType('minecraft:air');f.slots.set(0,r.book.clone());const wall=f.neighbor('minecraft:stone',{x:0,y:80,z:1});
 assert.throws(()=>f.api.placeRecipeBlock(wall,'north',f.holder,f.slots.get(0)),/orphaned/);assert.equal(f.dp.get(r.key),r.raw);assert.ok(f.slots.get(0));
 f.dp.delete(r.key);for(const id of ['minecraft:oak_slab','foreign:unknown_shape']){const partial=f.neighbor(id,wall.location,{'minecraft:vertical_half':'top'});assert.equal(f.api.placeRecipeBlock(partial,'north',f.holder,f.slots.get(0)),false);assert.ok(f.slots.get(0));assert.equal(f.dp.has(r.key),false)}
});
test('recipe pickup/break preserve exact native metadata, one delivery and clear coordinate data',()=>{
 for(const mode of ['pickup','survival','creative']){
  const f=fixture(),r=f.recipe();f.holder.creative=mode==='creative';
  if(mode==='pickup')f.api.handleRecipeBlock(f.block,f.holder);else assert.equal(f.api.breakRecipe(f.block,f.holder),true);
  assert.equal(f.block.typeId,'minecraft:air');assert.equal(f.dp.has(r.key),false);assert.equal(f.dp.has(r.key+'_delivery'),false);
  if(mode==='pickup'){assert.deepEqual(snapshot.captureSkewerMetadata(f.slots.get(0)),snapshot.captureSkewerMetadata(r.book));assert.equal(f.entities.length,0)}
  else if(mode==='survival'){assert.equal(f.entities.filter(e=>e.isValid).length,1);assert.deepEqual(snapshot.captureSkewerMetadata(f.entities[0].stack),snapshot.captureSkewerMetadata(r.book))}
  else assert.equal(f.entities.length,0);
  assert.equal(f.api.breakRecipe(f.block,f.holder),false);
 }
});
test('recipe pickup with full inventory follows Java drop fallback once',()=>{
 const f=fixture(),r=f.recipe();for(let slot=0;slot<36;slot++)f.slots.set(slot,new Stack('minecraft:stone')); // Empty offhand can retrieve the page.
 f.api.handleRecipeBlock(f.block,f.holder,'off');assert.equal(f.entities.length,1);assert.equal(f.dp.has(r.key),false);assert.equal(f.block.typeId,'minecraft:air');assert.ok(f.slots.get(0));
});
for(const target of ['dropRead','storage','remove','receipt'])test('recipe '+target+' failure returns ownership and permits a later safe retry',()=>{
 const f=fixture(),r=f.recipe();f.oneFailure(target==='storage'?r.key:target==='receipt'?r.key+'_delivery':target);
 assert.equal(f.api.breakRecipe(f.block),false);assert.equal(f.block.typeId,plate.RECIPE_BLOCK_ID);assert.equal(f.dp.get(r.key),r.raw);assert.equal(f.entities.filter(e=>e.isValid).length,0);assert.equal(f.dp.has(r.key+'_delivery'),false);
 assert.equal(f.api.breakRecipe(f.block),true);assert.equal(f.entities.filter(e=>e.isValid).length,1);assert.equal(f.dp.has(r.key),false);
});
test('recipe pickup post-write inventory rejection rolls back the credited book and keeps the wall recording',()=>{
 const f=fixture(),r=f.recipe();f.oneFailure('inventory');f.api.handleRecipeBlock(f.block,f.holder);
 assert.equal(f.slots.get(0),undefined);assert.equal(f.dp.get(r.key),r.raw);assert.equal(f.block.typeId,plate.RECIPE_BLOCK_ID);assert.equal(f.entities.length,0);
 f.api.handleRecipeBlock(f.block,f.holder);assert.ok(f.slots.get(0));assert.equal(f.dp.has(r.key),false);
});
test('unknown recipe spawn and unconfirmed cleanup persist quarantine across reload without a second credit',()=>{
 for(const mode of ['spawn','cleanup','unknown_handle']){
  const f=fixture(),r=f.recipe();if(mode==='spawn')f.oneFailure('spawn');else if(mode==='unknown_handle')f.fault=k=>k==='dropValidity';else{let once=true;f.fault=k=>k==='dropRemoveBefore'||(k===r.key&&once?(once=false,true):false)}
  assert.throws(()=>f.api.breakRecipe(f.block),/recovery required/);
  assert.equal(f.dp.get(r.key),r.raw);assert.ok(f.dp.has(f.api.recipeFaultKey(f.block)));assert.equal(f.entities.length,1);if(mode!=='unknown_handle')assert.equal(f.entities.filter(e=>e.isValid).length,1);
  const restored=fixture(f.dp);restored.block.setType(plate.RECIPE_BLOCK_ID);assert.throws(()=>restored.api.breakRecipe(restored.block),/quarantined/);for(const task of restored.intervals)task.fn();assert.equal(restored.entities.length,0);assert.equal(restored.dp.get(r.key),r.raw);
 }
});
test('verified recipe credit after restart finishes only cleanup at each interrupted source stage',()=>{
 for(const stage of ['saved','cleared','removed']){
  const f=fixture(),r=f.recipe(),captured=f.api.recipeActionSnapshot(f.block);f.block.dimension.spawnItem(r.book);
  f.dp.set(r.key+'_delivery',JSON.stringify({v:1,phase:'credited',dimension:f.block.dimension.id,location:captured.location,states:captured.states,saved:captured.saved}));
  if(stage!=='saved')f.dp.delete(r.key);
  const restored=fixture(f.dp);restored.block.setType(stage==='removed'?'minecraft:air':plate.RECIPE_BLOCK_ID);
  for(const task of restored.intervals)task.fn();assert.equal(restored.block.typeId,'minecraft:air');assert.equal(restored.dp.has(r.key),false);assert.equal(restored.dp.has(r.key+'_delivery'),false);assert.equal(restored.entities.length,0);assert.equal(f.entities.filter(e=>e.isValid).length,1);
 }
});
test('prepared recipe credit remains reviewable after reload and never silently reissues a book',()=>{
 const f=fixture(),r=f.recipe(),captured=f.api.recipeActionSnapshot(f.block);f.dp.set(r.key+'_delivery',JSON.stringify({v:1,phase:'prepared',dimension:f.block.dimension.id,location:captured.location,states:captured.states,saved:captured.saved}));
 const restored=fixture(f.dp);restored.block.setType(plate.RECIPE_BLOCK_ID);for(const task of restored.intervals)task.fn();
 assert.throws(()=>restored.api.breakRecipe(restored.block),/delivery requires recovery/);assert.equal(restored.dp.get(r.key),r.raw);assert.equal(JSON.parse(restored.dp.get(r.key+'_delivery')).saved,r.raw);assert.equal(restored.entities.length,0);
});
test('loaded recipe ticks detach non-player support removal once and retain unreadable/unknown support',()=>{
 const f=fixture(),r=f.recipe(),tick=f.components.get(N+'recipe_support').onTick;
 tick({block:f.block});assert.equal(f.dp.get(r.key),r.raw); // Unloaded support.
 f.neighbor('foreign:unknown_shape',{x:0,y:80,z:1});tick({block:f.block});assert.equal(f.dp.get(r.key),r.raw);
 f.neighbor('minecraft:stone',{x:0,y:80,z:1});tick({block:f.block});assert.equal(f.dp.get(r.key),r.raw);
 f.neighbor('minecraft:air',{x:0,y:80,z:1});tick({block:f.block});tick({block:f.block});assert.equal(f.dp.has(r.key),false);assert.equal(f.entities.length,1);
});
test('recipe support explosion and direct recipe explosion arbitrate one recorded-book delivery',()=>{
 for(const tickFirst of [false,true]){
  const f=fixture(),r=f.recipe(),wall=f.neighbor('minecraft:air',{x:0,y:80,z:1});let kept;
  f.events.explosion({cancel:false,getImpactedBlocks:()=>[f.block,{typeId:'minecraft:stone'}],setImpactedBlocks(rows){kept=rows}});assert.equal(kept.length,1);
  f.events.blockExplode({block:wall,dimension:wall.dimension});if(tickFirst)f.components.get(N+'recipe_support').onTick({block:f.block});f.flush();
  assert.equal(f.entities.filter(e=>e.isValid).length,1);assert.equal(f.dp.has(r.key),false);assert.deepEqual(snapshot.captureSkewerMetadata(f.entities[0].stack),snapshot.captureSkewerMetadata(r.book));
 }
});
test('cancelled, unreadable and replaced recipe explosion targets keep their recorded data',()=>{
 for(const mode of ['before','after','unreadable','replacement','rotation','capture']){
  const f=fixture(),r=f.recipe();let deferred=false,writes=0;
  const event={get cancel(){if(mode==='unreadable'&&deferred)throw Error('expired');return mode==='before'||(mode==='after'&&deferred)},getImpactedBlocks:()=>[f.block],setImpactedBlocks(){writes++}};
  if(mode==='capture')f.block.permutation.getAllStates=()=>{throw Error('unreadable snapshot')};
  f.events.explosion(event);deferred=true;if(mode==='replacement')f.dp.set(r.key,JSON.stringify({...JSON.parse(r.raw),placementId:'new'}));if(mode==='rotation')f.block.permutation=f.block.permutation.withState('minecraft:cardinal_direction','east');
  const raw=f.dp.get(r.key);f.flush();assert.equal(f.block.typeId,plate.RECIPE_BLOCK_ID);assert.equal(f.dp.get(r.key),raw);assert.equal(f.entities.length,0);if(mode==='before')assert.equal(writes,0);
 }
});

test('wall recipe selection matches Java 10 x 13 x 0.25 model units and has a looping support tick',()=>{
 const definition=JSON.parse(fs.readFileSync(new URL('../blocks/skewer_recipe.json',base),'utf8'))['minecraft:block'];
 assert.deepEqual(definition.components['minecraft:selection_box'],{origin:[-5,1.5,7.75],size:[10,13,.25]});
 assert.deepEqual(definition.components['minecraft:tick'],{interval_range:[20,20],looping:true});assert.deepEqual(definition.components[N+'recipe_support'],{});
 assert.deepEqual(definition.permutations.map(p=>p.components['minecraft:transformation'].rotation[1]),[0,180,90,270]);
});
test('full-cube admission distinguishes known partial blocks from positive shape families and unknown geometry',()=>{
 const block=(name,states={})=>({typeId:name.includes(':')?name:'minecraft:'+name,permutation:{getAllStates:()=>states}});
 for(const name of ['azalea','flowering_azalea','pink_petals','wildflowers','leaf_litter','tripwire_hook','powered_repeater','unpowered_repeater','powered_comparator','unpowered_comparator','snow_layer','honey_block','decorated_pot'])assert.equal(support.hasFullCubeCollision(block(name)),false,name);
 for(const name of ['stone','oak_planks','mushroom_stem','red_mushroom_block','grass_block','muddy_mangrove_roots','oak_double_slab','kaleidoscope_grilling:pepper_log','copper_block','cut_copper','exposed_copper','weathered_copper','oxidized_copper','waxed_exposed_cut_copper','waxed_weathered_chiseled_copper'])assert.equal(support.hasFullCubeCollision(block(name)),true,name);
 for(const name of ['foreign:solid_looking_block','future_vanilla_shape','piston'])assert.equal(support.hasFullCubeCollision(block(name)),undefined,name);
});
test('stair support uses high face and resolved corners for all four facings, in both vertical halves',()=>{
 const faces=['east','west','south','north'],left={east:'north',west:'south',south:'east',north:'west'},right={east:'south',west:'north',south:'west',north:'east'};
 for(let value=0;value<4;value++)for(const top of [false,true])for(const corner of ['none','inner_left','inner_right','outer_left','outer_right']){
  const block={typeId:'minecraft:oak_stairs',permutation:{getAllStates:()=>({weirdo_direction:value,upside_down_bit:top,'minecraft:corner':corner})}};
  for(const side of faces)assert.equal(support.hasSturdySide(block,side),corner.startsWith('outer_')?false:side===faces[value]||(corner==='inner_left'&&side===left[faces[value]])||(corner==='inner_right'&&side===right[faces[value]]),[value,top,corner,side].join('/'));
 }
});
test('wall support follows Java support shape exceptions without weakening plate collision admission',()=>{
 const block=name=>({typeId:name.includes(':')?name:'minecraft:'+name,permutation:{getAllStates:()=>({})}});
 for(const [name,collision,sturdy] of [['oak_leaves',true,false],['soul_sand',false,true],['composter',false,true],['glass',true,true],['ice',true,true],['cauldron',false,false],['water_cauldron',false,false],['lava_cauldron',false,false],['kaleidoscope_grilling:pepper_leaves',false,false],['kaleidoscope_grilling:pepper_log',true,true]]){
  assert.equal(support.hasFullCubeCollision(block(name)),collision,name);
  for(const side of ['north','south','west','east'])assert.equal(support.hasSturdySide(block(name),side),sturdy,name+'/'+side);
 }
});
test('closed trapdoors have no sturdy horizontal face; open trapdoors expose only the outside face',()=>{
 const facing=['south','west','north','east'],outside=['north','east','south','west'];
 for(const id of ['minecraft:trapdoor','minecraft:iron_trapdoor','minecraft:waxed_copper_trapdoor'])for(let direction=0;direction<4;direction++)for(const open of [false,true])for(const top of [false,true]){
  const block={typeId:id,permutation:{getAllStates:()=>({direction,open_bit:open,upside_down_bit:top})}};
  assert.equal(support.hasFullCubeCollision(block),false);
  for(const side of facing)assert.equal(support.hasSturdySide(block,side),open&&side===outside[direction],[id,direction,open,top,side].join('/'));
 }
 for(const states of [{open_bit:true},{open_bit:true,direction:4},{direction:0}])assert.equal(support.hasSturdySide({typeId:'minecraft:trapdoor',permutation:{getAllStates:()=>states}},'north'),undefined);
});
test('recipe display restores the recorded native result before considering the stored ID fallback',()=>{
 const f=fixture(),saved=f.recipe(),secret=food();secret.typeId=N+'secret_skewer';secret.props[N+'secret_cooked']=true;secret.props[N+'model_variants']='[4,5,6]';
 const book=f.api.bookItem({resultId:N+'raw_beef_skewer'},{id:secret.typeId,native:snapshot.captureSkewerMetadata(secret)},saved.book);
 f.dp.set(saved.key,JSON.stringify(f.api.stackRow(book)));const before=new Map(f.dp),display=f.api.a25ReadRecipeDisplayStack(f.block);
 assert.deepEqual(snapshot.captureSkewerMetadata(display),snapshot.captureSkewerMetadata(secret));assert.deepEqual(f.dp,before);
 f.dp.set(saved.key,saved.raw);assert.equal(f.api.a25ReadRecipeDisplayStack(f.block).typeId,N+'raw_beef_skewer');
});
test('display dirtiness follows completed plate and recipe transactions, never failed ownership transfer',()=>{
 const plate=fixture();plate.rows(1);plate.api.handlePlateBlock(plate.block,plate.holder);assert.equal(plate.dirty.length,1);assert.equal(JSON.parse(plate.dirty[0].saved.get(plate.key)).length,0);
 const failed=fixture();failed.rows(1);failed.oneFailure('hand');failed.api.handlePlateBlock(failed.block,failed.holder);assert.equal(failed.dirty.length,0);
 const recipe=fixture(),saved=recipe.recipe();recipe.api.breakRecipe(recipe.block,recipe.holder);assert.equal(recipe.dirty.length,1);assert.equal(recipe.dirty[0].typeId,'minecraft:air');assert.equal(recipe.dirty[0].saved.has(saved.key),false);assert.equal(recipe.dirty[0].saved.has(saved.key+'_delivery'),false);
});
test('a display queue failure cannot roll back a completed serving',()=>{
 const f=fixture();f.rows(1);f.fault=k=>k==='queue';f.api.handlePlateBlock(f.block,f.holder);assert.equal(f.api.readPlateBlock(f.block).length,0);assert.equal(f.slots.get(0).typeId,N+'grilled_beef_skewer');
});

test('failure discriminator and original ingredient metadata survive actual portable plate storage',()=>{
 const f=fixture();
 for(const result of [N+'mysterious_skewer',N+'dark_grilling']){
  const input=food();input.typeId=N+'raw_gluten_skewer';
  item.setItemProperty(input,N+'model_variants','[9,5,4]');
  item.setItemProperty(input,N+'skewer_ingredients','[{"id":"minecraft:beef"}]');
  const failed=createFailedSkewer(input,result,(id,n)=>new Stack(id,n));
  const row=f.api.stackRow(failed),portable=f.api.a25PlateItem([row]);
  const restored=f.api.a25RestoreStack(f.api.a25PlateRows(portable)[0]);
  assert.deepEqual(snapshot.captureSkewerMetadata(restored),snapshot.captureSkewerMetadata(failed));
  assert.equal(item.getItemProperty(restored,FAILED_SOURCE_KEY),N+'raw_gluten_skewer');
 }
});
