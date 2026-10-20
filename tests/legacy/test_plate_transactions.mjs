/** Real canonical ESM callbacks, with fault injection only at native API boundaries. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../helpers/minecraft-fixture.mjs';
import * as tx from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_transaction_core.js';
import * as plate from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a25_plate_recipe_core.js';
import * as snapshot from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js';
import * as support from '../../projects/grilling/gameplay_core/behavior_pack/scripts/blockSupport.js';
import {FAILED_SOURCE_KEY} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_visual_core.js';
const N='kaleidoscope_grilling:',PLATE=N+'skewer_plate_block',at={x:0,y:80,z:0};
const key=(kind='plate')=>N+'a25_'+kind+'_minecraft_overworld_p0_p80_p0';
const faultKey=(kind='plate')=>key(kind)+'_transaction_fault';
const modules=new WeakMap();
const signature=s=>modules.get(s.constructor).snapshot.captureSkewerMetadata(s);
const prop=(s,k,v)=>modules.get(s.constructor).data.setItemProperty(s,k,v);
const readProp=(s,k)=>modules.get(s.constructor).data.getItemProperty(s,k);
function afterOnce(object,method,predicate=()=>true,mutation=()=>{}){
 const original=object[method];let active=true;
 object[method]=function(...args){const result=original.apply(this,args);if(active&&predicate(...args)){active=false;mutation(...args);throw Error('injected native post-write failure')}return result};
 return ()=>{object[method]=original};
}
async function fixture(saved){
 const f=createFixture();if(saved)for(const [k,v] of saved)f.world.setDynamicProperty(k,v);
 const api=await f.load('a25_plate_recipe_runtime.js');modules.set(f.ItemStack,{snapshot:await f.load('skewer_item_snapshot.js'),data:await f.load('itemData.js')});f.startup();f.flush();
 const b=f.block(PLATE,at,{states:{[N+'plate_count']:0,'minecraft:cardinal_direction':'north'}});
 const p=f.player({id:'plate-test-player',location:at});p.id='plate-test-player';p.isSneaking=true;p.getRotation=()=>({y:90});
 const inv=p.getComponent('minecraft:inventory').container,equip=p.getComponent('minecraft:equippable');
 const get=(hand='main')=>hand==='off'?equip.getEquipment('Offhand'):inv.getItem(p.selectedSlotIndex);
 const set=(s,hand='main')=>hand==='off'?equip.setEquipment('Offhand',s):inv.setItem(p.selectedSlotIndex,s);
 const food=(type=N+'grilled_beef_skewer')=>{const s=f.item(type,1);s.nameTag='named food';s.setLore([{translate:'item.foreign.food',with:['保留']}]);prop(s,'foreign:value','preserve');return s};
 function rows(n=1){const rows=Array.from({length:n},(_,i)=>{const s=food();s.nameTag='named food '+i;prop(s,'qa:slot',i);return api.a25StackRow(s)});f.world.setDynamicProperty(key(),JSON.stringify(rows));b.setPermutation(b.permutation.withState(N+'plate_count',n));return rows}
 function use(target=b,hand='main',face='Up',flush=true){const e={block:target,player:p,itemStack:get(hand)?.clone(),blockFace:face,isFirstEvent:true,cancel:false};f.emit('world.beforeEvents.playerInteractWithBlock',e);if(flush)f.flush();return e}
 function breaking(target=b,flush=true){const e={block:target,player:p,cancel:false};f.emit('world.beforeEvents.playerBreakBlock',e);if(flush)f.flush();return e}
 function air(){const e={source:p,itemStack:get()?.clone(),cancel:false};f.emit('world.beforeEvents.itemUse',e);f.flush();return e}
 function book(record={resultId:N+'raw_beef_skewer'}){const s=f.item(plate.BOOK_ID,1);s.nameTag='named recipe';s.setLore([{translate:'item.foreign.recipe',with:['保留']}]);prop(s,'foreign:value','preserve');prop(s,plate.BOOK_RECORD_KEY,JSON.stringify(record));return s}
 function recipe(record){b.setType(plate.RECIPE_BLOCK_ID);b.setPermutation(b.permutation.withState('minecraft:cardinal_direction','north'));const item=book(record),raw=JSON.stringify({...api.a25StackRow(item),placementId:'original'});f.world.setDynamicProperty(key('recipe'),raw);return {book:item,raw}}
 const dp=()=>new Map(f.world.getDynamicPropertyIds().map(k=>[k,f.world.getDynamicProperty(k)]));
 const drops=()=>f.drops.filter(e=>e.isValid===true);
 return Object.assign(f,{api,b,p,inv,equip,get,set,food,rows,use,breaking,air,book,recipe,saved:dp,liveDrops:drops});
}

test('invalid saved plate rows fail closed without erasing storage',async()=>{
 for(const raw of [null,1,'{',JSON.stringify({}),JSON.stringify([null]),JSON.stringify([{id:'bad'}]),JSON.stringify([{id:'x:food',native:{version:2,id:'x:food'}}]),JSON.stringify([{id:'x:food',native:{version:1,id:'x:other'}}]),JSON.stringify(Array(6).fill({id:'x:food'}))])assert.throws(()=>tx.decodePlateStorage(raw));
 assert.deepEqual(tx.decodePlateStorage(undefined),[]);const f=await fixture();f.world.setDynamicProperty(key(),'damaged');assert.throws(()=>f.api.a25ReadPlateBlock(f.b));assert.equal(f.world.getDynamicProperty(key()),'damaged');
});
test('placement facing handles wrapped quarter-turn boundaries',()=>{
 for(const [yaw,expected] of [[0,'south'],[90,'west'],[180,'north'],[-90,'east'],[360,'south'],[45,'west'],[-45,'south'],[-135,'east']])assert.equal(tx.plateFacingFromYaw(yaw),expected);assert.throws(()=>tx.plateFacingFromYaw(NaN));
});
for(const hand of ['main','off'])test('registered interaction takes last skewer with exact metadata: '+hand,async()=>{
 const f=await fixture(),rows=f.rows(2);if(hand==='off')f.set(f.item('minecraft:stone'));
 f.use(f.b,hand);assert.equal(f.api.a25ReadPlateBlock(f.b).length,1);assert.equal(f.b.permutation.getState(N+'plate_count'),1);assert.deepEqual(signature(f.get(hand)),rows[1].native);
});
for(const target of ['hand','property','block'])test('take post-write '+target+' rejection restores rows, block count and hand',async()=>{
 const f=await fixture();f.rows(2);const raw=f.world.getDynamicProperty(key());
 if(target==='hand')afterOnce(f.inv,'setItem');if(target==='property')afterOnce(f.world,'setDynamicProperty',k=>k===key());if(target==='block')afterOnce(f.b,'setPermutation');
 f.use();assert.equal(f.world.getDynamicProperty(key()),raw);assert.equal(f.get(),undefined);assert.equal(f.b.permutation.getState(N+'plate_count'),2);
});
for(const hand of ['main','off'])test('insertion debit rejection preserves source count and metadata: '+hand,async()=>{
 const f=await fixture();f.rows(1);const raw=f.world.getDynamicProperty(key()),s=f.food();s.amount=3;f.set(s,hand);if(hand==='off')f.set(f.item('minecraft:stone'));f.p.isSneaking=false;
 afterOnce(hand==='off'?f.equip:f.inv,hand==='off'?'setEquipment':'setItem');f.use(f.b,hand);assert.equal(f.world.getDynamicProperty(key()),raw);assert.equal(f.get(hand).amount,3);assert.deepEqual(signature(f.get(hand)),signature(s));
});
for(const target of ['none','hand','property','block'])test('public plate placement is atomic after '+target+' rejection',async()=>{
 const f=await fixture();f.b.setType('minecraft:short_grass');const base=f.block('minecraft:stone',{x:0,y:79,z:0}),s=f.food();f.set(s);
 if(target==='hand')afterOnce(f.inv,'setItem');if(target==='property')afterOnce(f.world,'setDynamicProperty',k=>k===key());if(target==='block')afterOnce(f.b,'setPermutation');
 f.use(base);if(target==='none'){assert.equal(f.b.typeId,PLATE);assert.equal(f.get(),undefined);assert.equal(f.b.permutation.getState('minecraft:cardinal_direction'),'west')}
 else{assert.equal(f.b.typeId,'minecraft:short_grass');assert.equal(f.world.getDynamicProperty(key()),undefined);assert.deepEqual(signature(f.get()),signature(s))}
});
test('creative placement retains source; orphaned contents and partial support reject placement',async()=>{
 const f=await fixture();f.b.setType('minecraft:air');f.p.getGameMode=()=> 'Creative';const s=f.food();f.set(s);const base=f.block('minecraft:stone',{x:0,y:79,z:0});f.use(base);assert.deepEqual(signature(f.get()),signature(s));assert.equal(f.b.typeId,PLATE);
 for(const type of ['minecraft:oak_slab','minecraft:oak_stairs']){const g=await fixture();g.b.setType('minecraft:air');g.set(g.food());const partial=g.block(type,{x:0,y:79,z:0},{states:{'minecraft:vertical_half':'top',upside_down_bit:true}});g.use(partial);assert.equal(g.b.typeId,'minecraft:air');assert.ok(g.get())}
 const h=await fixture();h.rows(1);const raw=h.world.getDynamicProperty(key());h.b.setType('minecraft:air');h.set(h.food());assert.throws(()=>h.use(h.block('minecraft:stone',{x:0,y:79,z:0})),/orphaned/);assert.equal(h.world.getDynamicProperty(key()),raw);assert.ok(h.get());
});
test('deferred interaction rejects changed hand without spending or transferring',async()=>{
 const f=await fixture();f.rows(2);f.use(f.b,'main','Up',false);f.set(f.item('minecraft:diamond',7));f.flush();assert.equal(f.api.a25ReadPlateBlock(f.b).length,2);assert.equal(f.get().amount,7);
});
test('foreign post-write hand and moved selection remain untouched and quarantine persists after reload',async()=>{
 const f=await fixture();f.rows(2);const foreign=f.food();foreign.nameTag='foreign replacement';f.inv.setItem(4,f.item('minecraft:emerald',3));
 afterOnce(f.inv,'setItem',()=>true,()=>{f.inv.setItem(0,foreign);f.p.selectedSlotIndex=4});assert.throws(()=>f.use(),/recovery/);assert.equal(f.inv.getItem(0).nameTag,'foreign replacement');assert.equal(f.inv.getItem(4).amount,3);assert.ok(f.world.getDynamicProperty(faultKey()));
 const reload=await fixture(f.saved());assert.throws(()=>reload.api.a25ReadPlateBlock(reload.b),/quarantined/);assert.equal(reload.liveDrops().length,0);
});
for(const creative of [false,true])test('breaking full plate emits one packed metadata-preserving item, creative='+creative,async()=>{
 const f=await fixture(),rows=f.rows(5);if(creative)f.p.getGameMode=()=> 'Creative';f.breaking();assert.equal(f.b.typeId,'minecraft:air');assert.equal(f.world.getDynamicProperty(key()),undefined);assert.equal(f.liveDrops().length,creative?0:1);if(!creative)assert.deepEqual(f.api.a25PlateRows(f.liveDrops()[0].getComponent('minecraft:item').itemStack),rows);
 f.breaking();assert.equal(f.liveDrops().length,creative?0:1);
});
for(const target of ['property','remove'])test('break '+target+' post-write rejection restores plate and removes provisional drop',async()=>{
 const f=await fixture();f.rows(2);const raw=f.world.getDynamicProperty(key());if(target==='property')afterOnce(f.world,'setDynamicProperty',k=>k===key());else afterOnce(f.b,'setPermutation',p=>p.type.id==='minecraft:air');
 f.breaking();assert.equal(f.b.typeId,PLATE);assert.equal(f.world.getDynamicProperty(key()),raw);assert.equal(f.liveDrops().length,0);f.breaking();assert.equal(f.liveDrops().length,1);
});
test('unknown spawn outcome retains source and blocks automatic double delivery after reload',async()=>{
 const f=await fixture();f.rows(2);const raw=f.world.getDynamicProperty(key());afterOnce(f.dimension,'spawnItem');assert.throws(()=>f.breaking(),/recovery/);assert.equal(f.liveDrops().length,1);assert.equal(f.world.getDynamicProperty(key()),raw);assert.ok(f.world.getDynamicProperty(faultKey()));
 const reload=await fixture(f.saved());assert.throws(()=>reload.breaking(),/recovery|quarantined/);assert.equal(reload.liveDrops().length,0);
});
for(const mode of ['early','late','unreadable','valid'])test('registered explosion respects final cancellation: '+mode,async()=>{
 const f=await fixture();f.rows(2);let deferred=false,kept;const other={typeId:'minecraft:stone'};
 const event={get cancel(){if(mode==='unreadable'&&deferred)throw Error('expired');return mode==='early'||mode==='late'&&deferred},getImpactedBlocks:()=>[other,f.b],setImpactedBlocks:x=>{kept=x}};
 f.emit('world.beforeEvents.explosion',event);deferred=true;f.flush();if(mode!=='early')assert.deepEqual(kept,[other]);assert.equal(f.liveDrops().length,mode==='valid'?1:0);assert.equal(f.b.typeId,mode==='valid'?'minecraft:air':PLATE);
});
test('prepared plate delivery blocks reissue after module reload',async()=>{
 const f=await fixture();f.rows(2);f.world.setDynamicProperty(key()+'_delivery',JSON.stringify({phase:'prepared',saved:f.world.getDynamicProperty(key())}));const reload=await fixture(f.saved());assert.throws(()=>reload.breaking(),/recovery/);assert.equal(reload.liveDrops().length,0);
});
for(const kind of ['plate','recipe'])for(const action of ['place','remove'])test('foreign '+kind+' block survives '+action+' setter failure',async()=>{
 const f=await fixture();let source,base;
 if(kind==='plate'){f.rows(2);source=f.food();base=f.block('minecraft:stone',{x:0,y:79,z:0})}else{source=f.recipe().book;base=f.block('minecraft:stone',{x:0,y:80,z:1})}
 if(action==='place'){f.world.setDynamicProperty(key(kind),undefined);f.b.setType('minecraft:air');f.set(source)}
 afterOnce(f.b,'setPermutation',()=>true,()=>f.b.setType('minecraft:diamond_block'));
 try{if(action==='place')f.use(base,'main',kind==='plate'?'Up':'North');else f.breaking()}catch(error){assert.match(String(error),/recovery/)}
 assert.equal(f.b.typeId,'minecraft:diamond_block');assert.ok(f.world.getDynamicProperty(faultKey(kind)));if(action==='place')assert.ok(f.get());
});
for(const target of ['none','hand','storage','block'])test('wall recipe placement preserves original book on '+target+' rejection',async()=>{
 const f=await fixture(),book=f.book();f.b.setType('minecraft:air');f.set(book);const wall=f.block('minecraft:stone',{x:0,y:80,z:1});
 if(target==='hand')afterOnce(f.inv,'setItem');if(target==='storage')afterOnce(f.world,'setDynamicProperty',k=>k===key('recipe'));if(target==='block')afterOnce(f.b,'setPermutation');f.use(wall,'main','North');
 if(target==='none'){assert.equal(f.b.typeId,plate.RECIPE_BLOCK_ID);assert.equal(f.get(),undefined);assert.deepEqual(JSON.parse(f.world.getDynamicProperty(key('recipe'))).native,signature(book))}
 else{assert.equal(f.b.typeId,'minecraft:air');assert.equal(f.world.getDynamicProperty(key('recipe')),undefined);assert.deepEqual(signature(f.get()),signature(book))}
});
for(const mode of ['pickup','survival','creative'])test('recipe '+mode+' delivers exact metadata once and clears storage',async()=>{
 const f=await fixture(),r=f.recipe();if(mode==='creative')f.p.getGameMode=()=> 'Creative';if(mode==='pickup')f.use();else f.breaking();assert.equal(f.b.typeId,'minecraft:air');assert.equal(f.world.getDynamicProperty(key('recipe')),undefined);
 if(mode==='pickup')assert.deepEqual(signature(f.get()),signature(r.book));else if(mode==='survival')assert.deepEqual(signature(f.liveDrops()[0].getComponent('minecraft:item').itemStack),signature(r.book));else assert.equal(f.liveDrops().length,0);
});
test('recipe pickup inventory rejection restores recorded book and safe retry succeeds',async()=>{
 const f=await fixture(),r=f.recipe();afterOnce(f.inv,'setItem');f.use();assert.equal(f.get(),undefined);assert.equal(f.world.getDynamicProperty(key('recipe')),r.raw);assert.equal(f.b.typeId,plate.RECIPE_BLOCK_ID);f.use();assert.deepEqual(signature(f.get()),signature(r.book));
});
for(const stage of ['saved','cleared','removed'])test('credited recipe restart finishes only cleanup: '+stage,async()=>{
 const f=await fixture(),r=f.recipe();f.world.setDynamicProperty(key('recipe')+'_delivery',JSON.stringify({v:1,phase:'credited',dimension:f.dimension.id,location:at,states:snapshot.metadataSignature(f.b.permutation.getAllStates()),saved:r.raw}));if(stage!=='saved')f.world.setDynamicProperty(key('recipe'),undefined);
 const reload=await fixture(f.saved());reload.b.setType(stage==='removed'?'minecraft:air':plate.RECIPE_BLOCK_ID);if(stage!=='removed')reload.b.setPermutation(reload.b.permutation.withState('minecraft:cardinal_direction','north'));reload.tick(200);
 assert.equal(reload.b.typeId,'minecraft:air');assert.equal(reload.world.getDynamicProperty(key('recipe')),undefined);assert.equal(reload.world.getDynamicProperty(key('recipe')+'_delivery'),undefined);assert.equal(reload.liveDrops().length,0);
});
test('prepared recipe restart never silently reissues the recorded book',async()=>{
 const f=await fixture(),r=f.recipe();f.world.setDynamicProperty(key('recipe')+'_delivery',JSON.stringify({v:1,phase:'prepared',dimension:f.dimension.id,location:at,states:snapshot.metadataSignature(f.b.permutation.getAllStates()),saved:r.raw}));const reload=await fixture(f.saved());reload.b.setType(plate.RECIPE_BLOCK_ID);reload.tick(200);reload.breaking();assert.equal(reload.world.getDynamicProperty(key('recipe')),r.raw);assert.equal(reload.liveDrops().length,0);
});
test('actual recipe custom-component tick detaches missing support once, retains unloaded and unknown support',async()=>{
 const f=await fixture(),r=f.recipe();const tick=f.blockComponents.get(N+'recipe_support').onTick;
 const get=f.dimension.getBlock;f.dimension.getBlock=()=>undefined;tick({block:f.b});f.dimension.getBlock=get;assert.equal(f.world.getDynamicProperty(key('recipe')),r.raw);for(const type of ['foreign:unknown_shape','minecraft:stone']){f.block(type,{x:0,y:80,z:1});tick({block:f.b});assert.equal(f.world.getDynamicProperty(key('recipe')),r.raw)}f.block('minecraft:air',{x:0,y:80,z:1});tick({block:f.b});tick({block:f.b});assert.equal(f.liveDrops().length,1);assert.equal(f.world.getDynamicProperty(key('recipe')),undefined);
});
test('recipe display restores native recorded result without mutating saved data',async()=>{
 const f=await fixture(),secret=f.food(N+'secret_skewer');prop(secret,N+'secret_cooked',true);prop(secret,N+'model_variants','[4,5,6]');f.recipe({resultId:N+'raw_beef_skewer',recordedStack:f.api.a25StackRow(secret)});const before=f.saved();assert.deepEqual(signature(f.api.a25ReadRecipeDisplayStack(f.b)),signature(secret));for(const [k,v] of before)assert.equal(f.world.getDynamicProperty(k),v,'existing saved values remain unchanged');
});
for(const stage of ['none','debit','output'])test('Cookery conversion via item-use preserves input/output ownership: '+stage,async()=>{
 const f=await fixture(),source=f.item('kaleidoscope_cookery:recipe_block',2),off=f.item(N+'raw_beef_skewer');source.nameTag='source';prop(source,'foreign:input','retain');prop(off,'foreign:food','keep');f.set(source);f.set(off,'off');
 if(stage!=='none')afterOnce(f.inv,'setItem',slot=>slot===(stage==='debit'?0:1));f.air();assert.deepEqual(signature(f.get('off')),signature(off));assert.equal(f.get().amount,stage==='none'?1:2);if(stage==='none'){const out=f.inv.getItem(1);assert.equal(out.typeId,plate.BOOK_ID);assert.deepEqual(JSON.parse(readProp(out,plate.BOOK_RECORD_KEY)).recordedStack.native,signature(off))}else assert.equal(f.inv.getItem(1),undefined);
});
test('recording uses captured main-hand slot and preserves metadata when selection moves on rejected write',async()=>{
 const f=await fixture(),book=f.item(plate.BOOK_ID);book.nameTag='keep';prop(book,'foreign:value','record');f.set(book);f.set(f.item(N+'raw_beef_skewer'),'off');f.inv.setItem(4,f.item('minecraft:emerald',3));afterOnce(f.inv,'setItem',slot=>slot===0,()=>{f.p.selectedSlotIndex=4});f.air();assert.deepEqual(signature(f.inv.getItem(0)),signature(book));assert.equal(f.inv.getItem(4).amount,3);
});
test('portable plate preserves failure discriminator and original ingredient metadata',async()=>{
 const f=await fixture();for(const result of [N+'mysterious_skewer',N+'dark_grilling']){const input=f.food(N+'raw_gluten_skewer');prop(input,N+'model_variants','[9,5,4]');prop(input,N+'skewer_ingredients','[{"id":"minecraft:beef"}]');const failed=(await f.load('failure_skewer_visual_core.js')).createFailedSkewer(input,result,(id,n)=>f.item(id,n));const portable=f.api.a25PlateItem([f.api.a25StackRow(failed)]),restored=f.api.a25RestoreStack(f.api.a25PlateRows(portable)[0]);assert.deepEqual(signature(restored),signature(failed));assert.equal(readProp(restored,FAILED_SOURCE_KEY),N+'raw_gluten_skewer')}
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

for(const failure of ['throw','false'])test(`unchanged rejected write ${failure} requires no rollback write or quarantine`,()=>{
 let value={id:'before',metadata:{lore:['kept']}},writes=0;const before=structuredClone(value);
 const step=tx.verifiedPlateStep({read:()=>value,write(){writes++;if(failure==='throw')throw Error('before mutation');return false},before,after:{id:'after'}});
 const result=tx.commitPlateSteps([step],()=>assert.fail('confirmed unchanged state must not quarantine'));
 assert.equal(result.ok,false);assert.equal(result.rollbackErrors,0);assert.equal(writes,1);assert.deepEqual(value,before);
});
for(const outcome of ['void','false','throw'])test(`owned postimage restores exact preimage despite native rollback ${outcome}`,()=>{
 const before={id:'same',amount:2,metadata:{lore:[{translate:'foreign',with:['kept']}],properties:{x:4}}},after={...before,amount:1};let value=structuredClone(before),writes=0;
 const step=tx.verifiedPlateStep({read:()=>value,before,after,write(v){value=structuredClone(v);writes++;if(writes===1)throw Error('applied before throw');if(outcome==='throw')throw Error('restored before throw');if(outcome==='false')return false}});
 const result=tx.commitPlateSteps([step],()=>assert.fail('exact restoration is acknowledged'));
 assert.equal(result.ok,false);assert.equal(result.rollbackErrors,0);assert.deepEqual(value,before);assert.equal(writes,2);
});
for(const mutation of ['id','amount','name','lore','property'])test(`foreign ${mutation} after throw is preserved and earlier debit remains quarantined`,()=>{
 const before={id:'food',amount:1,name:'original',lore:['original'],properties:{foreign:1}},after={...before,amount:2};let source=1,value=structuredClone(before),writes=0,quarantines=0;
 const foreign=structuredClone(after);if(mutation==='property')foreign.properties.foreign=2;else if(mutation==='lore')foreign.lore=['replacement'];else foreign[mutation]=mutation==='amount'?9:'replacement';
 const debit=tx.verifiedPlateStep({read:()=>source,write:v=>{source=v},before:1,after:0});
 const credit=tx.verifiedPlateStep({read:()=>value,before,after,write(){writes++;value=foreign;throw Error('foreign postimage')}});
 assert.throws(()=>tx.commitPlateSteps([debit,credit],()=>quarantines++),/recovery required/);
 assert.equal(source,0,'uncertain credit cannot refund source');assert.equal(value,foreign);assert.equal(writes,1);assert.equal(quarantines,1);
});
test('unreadable rollback state retains debit and quarantines without another write',()=>{
 let source=1,unknown=false,writes=0,quarantines=0;
 const debit=tx.verifiedPlateStep({read:()=>source,write:v=>{source=v},before:1,after:0});
 const credit=tx.verifiedPlateStep({read(){if(unknown)throw Error('unreadable');return 0},write(){writes++;unknown=true;throw Error('unknown credit')},before:0,after:1});
 assert.throws(()=>tx.commitPlateSteps([debit,credit],()=>quarantines++),/recovery required/);assert.equal(source,0);assert.equal(writes,1);assert.equal(quarantines,1);
});

test('plate-targeted item use cancels native eating before and after the independent block gesture',async()=>{
 for(const order of ['before','after']){const f=await fixture(),s=f.food();s.amount=3;f.set(s);f.p.isSneaking=false;f.p.getHeadLocation=()=>({x:.5,y:80.1,z:-3});f.p.getBlockFromViewDirection=()=>({block:f.b,faceLocation:{x:.5,y:.1,z:0}});f.p.getEntitiesFromViewDirection=()=>[];
 const use=()=>{const before=signature(f.get()),e={source:f.p,itemStack:f.get().clone(),cancel:false};f.emit('world.beforeEvents.itemUse',e);assert.equal(e.cancel,true);assert.deepEqual(signature(f.get()),before)};
 if(order==='before')use();f.use();if(order==='after')use();assert.equal(f.get().amount,2);assert.equal(f.api.a25ReadPlateBlock(f.b).length,1);
 for(const [distance,cancel] of [[1,false],[4,true]]){f.p.getEntitiesFromViewDirection=()=>[{distance,entity:{typeId:'minecraft:cow'}}];const e={source:f.p,itemStack:f.get(),cancel:false};f.emit('world.beforeEvents.itemUse',e);assert.equal(e.cancel,cancel)}
 f.p.getBlockFromViewDirection=()=>({block:{typeId:'minecraft:dandelion'}});const e={source:f.p,itemStack:f.get(),cancel:false};f.emit('world.beforeEvents.itemUse',e);assert.equal(e.cancel,false);
 }
});
test('plate placement honors disabled Cookery table interception for packed and raw sources',async()=>{
 for(const packed of [false,true]){const f=await fixture();(await f.load('server_config_runtime.js')).setGrillingConfig('interceptCookeryTableWhenPlacingPlate',false);f.b.setType('minecraft:air');const source=packed?f.api.a25PlateItem([f.api.a25StackRow(f.food())]):f.food();f.set(source);const table=f.block('kaleidoscope_cookery:table',{x:0,y:79,z:0});const event=f.use(table);assert.equal(event.cancel,false);assert.equal(f.b.typeId,'minecraft:air');assert.deepEqual(signature(f.get()),signature(source))}
});
test('recipe placement keeps orphaned saved record and rejects non-sturdy walls',async()=>{
 const f=await fixture(),r=f.recipe();f.b.setType('minecraft:air');f.set(r.book);const wall=f.block('minecraft:stone',{x:0,y:80,z:1});assert.throws(()=>f.use(wall,'main','North'),/orphaned/);assert.equal(f.world.getDynamicProperty(key('recipe')),r.raw);assert.deepEqual(signature(f.get()),signature(r.book));
 f.world.setDynamicProperty(key('recipe'),undefined);for(const type of ['minecraft:oak_slab','foreign:unknown_shape']){const partial=f.block(type,wall.location,{states:{'minecraft:vertical_half':'top'}});f.use(partial,'main','North');assert.equal(f.b.typeId,'minecraft:air');assert.ok(f.get());assert.equal(f.world.getDynamicProperty(key('recipe')),undefined)}
});
test('recipe pickup with full inventory falls back to one verified drop',async()=>{
 const f=await fixture(),r=f.recipe();for(let i=0;i<f.inv.size;i++)f.inv.setItem(i,f.item('minecraft:stone',64));f.use(f.b,'off');assert.equal(f.liveDrops().length,1);assert.deepEqual(signature(f.liveDrops()[0].getComponent('minecraft:item').itemStack),signature(r.book));assert.equal(f.world.getDynamicProperty(key('recipe')),undefined);
});
for(const target of ['storage','receipt','remove'])test('recipe break '+target+' failure rolls back and permits safe retry',async()=>{
 const f=await fixture(),r=f.recipe();if(target==='remove')afterOnce(f.b,'setPermutation',p=>p.type.id==='minecraft:air');else afterOnce(f.world,'setDynamicProperty',k=>k===key('recipe')+(target==='receipt'?'_delivery':''));f.breaking();assert.equal(f.b.typeId,plate.RECIPE_BLOCK_ID);assert.equal(f.world.getDynamicProperty(key('recipe')),r.raw);assert.equal(f.liveDrops().length,0);f.breaking();assert.equal(f.liveDrops().length,1);
});
test('unknown recipe spawn preserves saved record and quarantines delivery across reload',async()=>{
 const f=await fixture(),r=f.recipe();afterOnce(f.dimension,'spawnItem');f.breaking();assert.equal(f.world.getDynamicProperty(key('recipe')),r.raw);assert.ok(f.world.getDynamicProperty(faultKey('recipe')));assert.equal(f.liveDrops().length,1);const reload=await fixture(f.saved());reload.b.setType(plate.RECIPE_BLOCK_ID);reload.breaking();reload.tick(200);assert.equal(reload.liveDrops().length,0);assert.equal(reload.world.getDynamicProperty(key('recipe')),r.raw);
});
for(const tickFirst of [false,true])test('recipe support and explosion arbitrate one delivery, component first='+tickFirst,async()=>{
 const f=await fixture(),r=f.recipe(),wall=f.block('minecraft:air',{x:0,y:80,z:1});let kept;f.emit('world.beforeEvents.explosion',{cancel:false,getImpactedBlocks:()=>[f.b,{typeId:'minecraft:stone'}],setImpactedBlocks:rows=>{kept=rows}});assert.equal(kept.length,1);f.emit('world.afterEvents.blockExplode',{block:wall,dimension:f.dimension});if(tickFirst)f.blockComponents.get(N+'recipe_support').onTick({block:f.b});f.flush();assert.equal(f.liveDrops().length,1);assert.deepEqual(signature(f.liveDrops()[0].getComponent('minecraft:item').itemStack),signature(r.book));assert.equal(f.world.getDynamicProperty(key('recipe')),undefined);
});
for(const mode of ['late','unreadable','replacement','rotation'])test('recipe explosion refuses '+mode+' target',async()=>{
 const f=await fixture();f.recipe();let deferred=false;const e={get cancel(){if(mode==='unreadable'&&deferred)throw Error('expired');return mode==='late'&&deferred},getImpactedBlocks:()=>[f.b],setImpactedBlocks(){}};f.emit('world.beforeEvents.explosion',e);deferred=true;if(mode==='replacement'){const r=JSON.parse(f.world.getDynamicProperty(key('recipe')));r.placementId='foreign';f.world.setDynamicProperty(key('recipe'),JSON.stringify(r))}if(mode==='rotation')f.b.setPermutation(f.b.permutation.withState('minecraft:cardinal_direction','east'));const raw=f.world.getDynamicProperty(key('recipe'));f.flush();assert.equal(f.world.getDynamicProperty(key('recipe')),raw);assert.equal(f.liveDrops().length,0);assert.equal(f.b.typeId,plate.RECIPE_BLOCK_ID);
});
test('repeated native hand post-write throws with exact readback do not falsely quarantine',async()=>{
 const f=await fixture();f.rows(2);const raw=f.world.getDynamicProperty(key()),set=f.inv.setItem;f.inv.setItem=function(...args){set.apply(this,args);throw Error('native applied before throw')};f.use();assert.equal(f.get(),undefined);assert.equal(f.world.getDynamicProperty(key()),raw);assert.equal(f.world.getDynamicProperty(faultKey()),undefined);
});
for(const validity of ['unknown','absent','throw'])test('provisional plate drop '+validity+' acknowledgement fails closed',async()=>{
 const f=await fixture();f.rows(1);const raw=f.world.getDynamicProperty(key()),spawn=f.dimension.spawnItem;f.dimension.spawnItem=function(...args){const e=spawn.apply(this,args);Object.defineProperty(e,'isValid',{configurable:true,get(){if(validity==='throw')throw Error('unreadable validity');return validity==='absent'?false:undefined}});return e};
 if(validity==='absent'){f.breaking();assert.equal(f.world.getDynamicProperty(faultKey()),undefined);assert.equal(f.world.getDynamicProperty(key()+'_delivery'),undefined)}else{assert.throws(()=>f.breaking(),/recovery/);assert.ok(f.world.getDynamicProperty(faultKey()));const reload=await fixture(f.saved());assert.throws(()=>reload.breaking(),/recovery|quarantined/);assert.equal(reload.liveDrops().length,0)}assert.equal(f.world.getDynamicProperty(key()),raw);
});
for(const phase of ['before','after'])test('drop cleanup '+phase+' throw uses native validity readback',async()=>{
 const f=await fixture();f.rows(1);const raw=f.world.getDynamicProperty(key()),spawn=f.dimension.spawnItem;f.dimension.spawnItem=function(...args){const e=spawn.apply(this,args),remove=e.remove;e.remove=function(){if(phase==='before')throw Error('not removed');remove.call(this);throw Error('removed before throw')};return e};afterOnce(f.world,'setDynamicProperty',k=>k===key());
 if(phase==='before'){assert.throws(()=>f.breaking(),/recovery/);assert.ok(f.world.getDynamicProperty(faultKey()));assert.equal(f.liveDrops().length,1)}else{f.breaking();assert.equal(f.world.getDynamicProperty(faultKey()),undefined);assert.equal(f.liveDrops().length,0)}assert.equal(f.world.getDynamicProperty(key()),raw);
});
test('foreign escrow metadata is never removed or recredited',async()=>{
 const f=await fixture();f.rows(1);afterOnce(f.world,'setDynamicProperty',k=>k===key(),()=>{const drop=f.drops.at(-1),foreign=drop.getComponent('minecraft:item').itemStack;foreign.nameTag='foreign replacement';drop.getComponent=()=>({itemStack:foreign})});assert.throws(()=>f.breaking(),/recovery/);assert.equal(f.liveDrops().length,1);assert.equal(f.liveDrops()[0].getComponent('minecraft:item').itemStack.nameTag,'foreign replacement');assert.ok(f.world.getDynamicProperty(faultKey()));assert.throws(()=>f.breaking(),/recovery|quarantined/);assert.equal(f.liveDrops().length,1);
});
test('foreign block count/facing after rejected write are preserved without refunding unknown credit',async()=>{
 const f=await fixture();f.rows(2);afterOnce(f.b,'setPermutation',()=>true,()=>{f.b.permutation=f.b.permutation.withState(N+'plate_count',5).withState('minecraft:cardinal_direction','south')});assert.throws(()=>f.use(),/recovery/);assert.equal(f.b.permutation.getState(N+'plate_count'),5);assert.equal(f.b.permutation.getState('minecraft:cardinal_direction'),'south');assert.equal(JSON.parse(f.world.getDynamicProperty(key())).length,1);assert.equal(f.get(),undefined);assert.ok(f.world.getDynamicProperty(faultKey()));
});
test('foreign delivered receipt is preserved and paid output is not refunded',async()=>{
 const f=await fixture();f.rows(2);let writes=0;const receipt=key()+'_delivery',foreign=JSON.stringify({phase:'foreign',evidence:'preserve'});afterOnce(f.world,'setDynamicProperty',k=>k===receipt&&++writes===2,()=>f.world.setDynamicProperty(receipt,foreign));assert.throws(()=>f.breaking(),/recovery/);assert.equal(f.world.getDynamicProperty(receipt),foreign);assert.equal(f.b.typeId,'minecraft:air');assert.equal(f.world.getDynamicProperty(key()),undefined);assert.equal(f.liveDrops().length,1);f.breaking();assert.equal(f.liveDrops().length,1);
});
test('foreign recorded-book slot survives rejected write and persistent receipt blocks duplicate retry',async()=>{
 const f=await fixture(),book=f.item(plate.BOOK_ID);f.set(book);f.set(f.item(N+'raw_beef_skewer'),'off');afterOnce(f.inv,'setItem',slot=>slot===0,()=>f.inv.setItem(0,f.item('minecraft:diamond',7)));f.air();assert.equal(f.get().typeId,'minecraft:diamond');assert.ok([...f.saved().keys()].some(k=>k.includes('player_item_receipt')));const reload=await fixture(f.saved());reload.set(reload.item(plate.BOOK_ID));reload.set(reload.item(N+'raw_beef_skewer'),'off');assert.throws(()=>reload.air(),/requires recovery/);assert.equal(readProp(reload.get(),plate.BOOK_RECORD_KEY),undefined);
});
test('foreign Cookery conversion output remains owned and source debit cannot retry',async()=>{
 const f=await fixture();f.set(f.item('kaleidoscope_cookery:recipe_block',2));f.set(f.item(N+'raw_beef_skewer'),'off');afterOnce(f.inv,'setItem',slot=>slot===1,()=>f.inv.setItem(1,f.item('minecraft:diamond',7)));f.air();assert.equal(f.get().amount,1);assert.equal(f.inv.getItem(1).typeId,'minecraft:diamond');assert.ok([...f.saved().keys()].some(k=>k.includes('player_item_receipt')));assert.throws(()=>f.air(),/requires recovery/);assert.equal(f.get().amount,1);assert.equal(f.liveDrops().length,0);
});
for(const creative of [false,true])test('full inventory conversion drops exactly one book, creative='+creative,async()=>{
 const f=await fixture();if(creative)f.p.getGameMode=()=> 'Creative';for(let i=0;i<f.inv.size;i++)f.inv.setItem(i,f.item('minecraft:stone',64));f.set(f.item('kaleidoscope_cookery:recipe_block',2));f.set(f.item(N+'raw_beef_skewer'),'off');f.air();assert.equal(f.get().amount,creative?2:1);assert.equal(f.liveDrops().length,1);assert.equal(f.liveDrops()[0].getComponent('minecraft:item').itemStack.typeId,plate.BOOK_ID);
});
test('unavailable captured coordinate cannot redirect rollback through a moved callback object',async()=>{
 const f=await fixture();f.rows(2);const original=f.b.location;afterOnce(f.b,'setPermutation',()=>true,()=>{f.b.location={x:9,y:80,z:9};const read=f.dimension.getBlock;f.dimension.getBlock=pos=>pos.x===0&&pos.y===80&&pos.z===0?undefined:read.call(f.dimension,pos)});assert.throws(()=>f.use(),/recovery/);assert.equal(f.b.permutation.getState(N+'plate_count'),1);assert.equal(f.get(),undefined);f.b.location=original;
});
test('unconfirmed recipe cleanup retains escrow and quarantine through fresh runtime reload',async()=>{
 const f=await fixture(),r=f.recipe(),spawn=f.dimension.spawnItem;f.dimension.spawnItem=function(...args){const e=spawn.apply(this,args);e.remove=()=>{throw Error('native cleanup unavailable')};return e};afterOnce(f.world,'setDynamicProperty',k=>k===key('recipe'));f.breaking();assert.equal(f.liveDrops().length,1);assert.equal(f.world.getDynamicProperty(key('recipe')),r.raw);assert.ok(f.world.getDynamicProperty(faultKey('recipe')));const reload=await fixture(f.saved());reload.b.setType(plate.RECIPE_BLOCK_ID);reload.breaking();reload.tick(200);assert.equal(reload.liveDrops().length,0);assert.equal(reload.world.getDynamicProperty(key('recipe')),r.raw);
});
