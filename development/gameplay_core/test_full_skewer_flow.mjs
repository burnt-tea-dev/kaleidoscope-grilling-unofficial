import * as failureSkewers from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_visual_core.js';
import {canonicalFoodId,eatingItemId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {finishedFoodMeta} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food_finish_core.js';
import {CONFIG_DEFAULTS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/server_config_core.js';
/** Actual runtime bodies + storage-operation doubles. Not Minecraft/client evidence. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as data from '../../projects/grilling/gameplay_core/behavior_pack/scripts/data.js';
import * as logic from '../../projects/grilling/gameplay_core/behavior_pack/scripts/core_logic.js';
import * as secretShape from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_visual_state_core.js';
import * as skewers from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js';
import * as items from '../../projects/grilling/gameplay_core/behavior_pack/scripts/itemDataCore.js';
import * as snapshots from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js';
import * as seasoning from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2743_seasoning_contract_core.js';
import * as bottleVisuals from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2766_special_seasoning_visual_core.js';
import * as oil from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2734_cookery_oil_pot_core.js';
import * as portableOil from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/oil_api_core.js';
import * as portableFood from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/food_api_core.js';
import * as cuisineQuality from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/cuisine_quality_core.js';
import {resolveSecretSmokedId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_compat_core.js';
import * as tools from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a275_grill_input_core.js';
import * as heat from '../../projects/grilling/gameplay_core/behavior_pack/scripts/localized_lore_core.js';
import {foodFacts} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food_snapshot_core.js';
import {secretEatingRows} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_eating_core.js';
import {primitiveStackProps} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2762_interaction_intent_core.js';
import {commitSteps,commitTwoParty} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a277_grill_transaction_core.js';
import {slotWrite,planInventoryInsert} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/rack_transfer_plan.js';
import {nativeItemSignature,ownedItemStep,planOwnedInventoryDelivery,commitPlayerItemTransaction} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/owned_item_transaction_core.js';
import {captureEatingIdentity,eatingStillCurrent,commitEating} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_eating_transaction.js';
const root=new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/',import.meta.url),read=n=>fs.readFileSync(new URL(n,root),'utf8'),source=read('main.js');
function fn(name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);let end=source.indexOf('{',start)+1,depth=1;while(depth){const c=source[end++];if(c==='{')depth++;if(c==='}')depth--}return source.slice(start,end)}
const strip=s=>s.replace(/^import\b[\s\S]*?;\s*/gm,'').replace(/^export \{[^\n]*\n/gm,'').replace(/\bexport (?=(function|const|class))/g,'');
const ingredientTags=new Map([['example:chicken_skin',['kaleidoscope_grilling:ingredients/chicken_skin']]]);
const secretNativeFood=JSON.parse(fs.readFileSync(new URL('../items/secret_skewer.json',root),'utf8'))['minecraft:item'].components['minecraft:food'];
class Stack{
 constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;this.nameTag='';this.lore=[];this.props={};this.damage=0;this.keepOnDeath=false;this.lockMode='none';this.destroy=[];this.place=[]}
 get maxAmount(){return 64}clone(){return Object.assign(new Stack(this.typeId,this.amount),structuredClone({...this}))}
 isStackableWith(other){if(!other)return false;const {amount,...own}=this,{amount:otherAmount,...theirs}=other;return JSON.stringify(own)===JSON.stringify(theirs)}
 getRawLore(){return structuredClone(this.lore)}setLore(lore){this.lore=structuredClone(lore)}getDynamicPropertyIds(){return Object.keys(this.props)}getDynamicProperty(k){return this.props[k]}setDynamicProperty(k,v){if(v===undefined)delete this.props[k];else this.props[k]=v}
 getCanDestroy(){return this.destroy}getCanPlaceOn(){return this.place}setCanDestroy(v){this.destroy=v}setCanPlaceOn(v){this.place=v}getTags(){return ingredientTags.get(this.typeId)??[]}
 getComponent(id){if(id==='minecraft:food'&&canonicalFoodId(this.typeId)===skewers.SECRET_ID)return {nutrition:secretNativeFood.nutrition,saturationModifier:secretNativeFood.saturation_modifier};if(id==='minecraft:food'&&data.FOOD_DATA[this.typeId])return {nutrition:data.FOOD_DATA[this.typeId].nutrition,saturationModifier:data.FOOD_DATA[this.typeId].saturation};if(id==='minecraft:durability'&&this.typeId==='minecraft:flint_and_steel'){const self=this;return {maxDurability:64,get damage(){return self.damage},set damage(v){self.damage=v}}}}
}
class Container{constructor(size){this.size=size;this.rows=Array(size)}getItem(i){return this.rows[i]?.clone()}setItem(i,s){this.rows[i]=s?.clone()}}
function fixture({creative=false}={}){
 let state=logic.initialState(),off,tick=1000,failHand=false;const metadata=new Map(),grill=new Container(3),bag=new Container(12),sounds=[],settlements=[],notices=[],drops=[];
 const world={getAbsoluteTime:()=>tick,getDynamicProperty:k=>metadata.get(k),setDynamicProperty:(k,v)=>v===undefined?metadata.delete(k):metadata.set(k,v)};items.configureItemDataWorld(world);
 const dimension={playSound(){},spawnItem(stack){const entity={stack:stack.clone(),removed:false,remove(){this.removed=true}};drops.push(entity);return entity}},block={isValid:true,typeId:data.GRILL_ID,x:0,y:0,z:0,location:{x:0,y:0,z:0},dimension};
 const hunger={currentValue:0,effectiveMax:20,setCurrentValue(v){this.currentValue=v}},saturation={currentValue:0,effectiveMax:20,setCurrentValue(v){this.currentValue=v}};
 const holder={id:'storage-adapter',name:'Storage adapter',selectedSlotIndex:0,isSneaking:false,dimension,location:block.location,playAnimation(){},getComponent:id=>id.endsWith('hunger')?hunger:id.endsWith('saturation')?saturation:undefined};
 const write=(hand,s)=>{if(hand==='off')off=s?.clone();else bag.setItem(0,s);if(failHand){failHand=false;throw Error('injected hand write')}};
 const ctx=vm.createContext({secretEatingRows,...failureSkewers,EnchantmentType:class {constructor(id){this.id=id}},canonicalFoodId,forgetEatingItem(){},finishedFoodMeta,grillingConfig:()=>CONFIG_DEFAULTS,...data,...logic,...skewers,...secretShape,...items,...snapshots,...seasoning,...bottleVisuals,...oil,...tools,...heat,world,system:{get currentTick(){return tick}},ItemStack:Stack,foodFacts,primitiveStackProps,commitSteps,commitTwoParty,slotWrite,planInventoryInsert,nativeItemSignature,ownedItemStep,planOwnedInventoryDelivery,commitPlayerItemTransaction,captureEatingIdentity,eatingStillCurrent,commitEating,
  console:{warn(){}},COOKERY_FILLED:oil.COOKERY_FILLED_ID,SEASON_USES_KEY:seasoning.SEASONING_USES_KEY,SEASON_VARIANT_KEY:seasoning.SEASONING_VARIANT_KEY,OIL_TOOLS:{},
  ...portableOil,...portableFood,...cuisineQuality,ensureOilHandPublished:()=>true,OIL_TYPES:{canola:{heatTicks:1200},secret_chili:{heatTicks:12000},premium_chili:{heatTicks:24000}},heldMain:()=>bag.getItem(0),heldOff:()=>off,heldByHand:(_,hand)=>hand==='off'?off:bag.getItem(0),creative:()=>creative,
  captureWritableHand:(_,hand)=>({before:(hand==='off'?off:bag.getItem(0))?.clone(),read:()=>(hand==='off'?off:bag.getItem(0))?.clone(),write:s=>write(hand,s)}),mainContainer:()=>bag,inv:()=>grill,occupied:()=>grill.rows.filter(Boolean).length,
  readState:()=>structuredClone(state),writeState:(_b,s)=>state=structuredClone(s),resetBlock:(_b,lit)=>state={...logic.initialState(),lit},commitStationTransfer:(_b,steps)=>commitSteps(steps),quarantineStation(){throw Error('quarantine')},
  blockSound:(_b,id)=>sounds.push(id),useSound:(_p,id)=>sounds.push(id),message(){},javaInteractionFeedback:(_p,key)=>notices.push(key),interactionFailure:(_p,text)=>notices.push(text),awardLookingThePart(){},awardGleamingWithOil(){},
  isCompatRawSkewer:()=>false,customSkewerCookedId:()=>undefined,skewerIngredientDecision:()=>'',resolveSecretSmokedId,
  afterCommitted:(_p,id,meta)=>settlements.push({id,hot:meta.hot,seasonings:meta.seasonings}),RAW_NAUSEA:{},secretRemainders(){},now:()=>tick
 });
 vm.runInContext(strip(read('grill_transfer.js')),ctx);
 vm.runInContext(strip(read('a2769_food_tooltip_core.js')),ctx);
 vm.runInContext(strip(read('a2734_cookery_oil_pot_adapter.js')),ctx);
 vm.runInContext(strip(read('a2750_food_state_adapter.js')),ctx);
 vm.runInContext(strip(read('a2766_special_seasoning_visual_runtime.js')),ctx);
 vm.runInContext('const setHot=setHotFood,isHot=isHotFood,setSeasonings=setFoodSeasonings,readSeasonings=readFoodSeasonings;',ctx);
 const names=['copyOne','copyCustomData','reducedStack','planDamagedHand','transactionStatus','commitGrillAndHand','commitGrillFlip','ingredientSnapshot','restoreIngredient','readRowsFromKey','readSkewerRows','validSecretIngredientRows','isSecretCooked','readEffectiveSkewerRows','rowLabel','writeSkewerRows','setSecretCreator','secretEatingData','dynamicFood','isEdible','canUseSecretSkewer','threadOutcome','prepareOutputDelivery','threadCurrent','canDisassembleOff','disassembleOff','getUses','setUses','heatForOil','planCookeryOil','planSeasoningBottle','cookedIngredientRows','setCookedIngredientRows','cookedStack','failedStack','outputFor','extract','handleGrill','hungerSettle'];
 vm.runInContext(names.map(fn).join('\n')+';this.api={threadCurrent,disassembleOff,handleGrill,extract,outputFor,hungerSettle,readSkewerRows,readEffectiveSkewerRows,isSecretCooked,setSeasonings,buildCookeryOilPot,readCookeryOilPot,getUses,setUses,readSeasonings,isHot};',ctx);
 return {api:ctx.api,holder,block,grill,bag,sounds,settlements,notices,drops,hunger,saturation,get main(){return bag.getItem(0)},set main(s){write('main',s)},get off(){return off},set off(s){write('off',s)},get state(){return state},failNextHand(){failHand=true},tick(n){tick+=n;state=logic.tickState(state,grill.rows.filter(Boolean).length,n).state},handle(){ctx.api.handleGrill(block,holder)},seasoning(){const s=new Stack(data.SEASONING_ID);ctx.api.setSeasonings(s,seasoning.BASE_SEASONINGS);ctx.api.setUses(s,0);return s}};
}
const cooked=skewers.recipeTable().filter(r=>r.cooked);
function thread(f,recipe){f.off=new Stack(skewers.UNFINISHED_ID);for(const [index,slot] of recipe.slots.entries()){f.main=new Stack(slot[0]);assert.equal(f.api.threadCurrent(f.holder),true);assert.equal(f.main,undefined);const progress=items.getItemRawLore(f.off).find(row=>row.translate==='tooltip.kaleidoscope_grilling.skewer.progress');assert.deepEqual([...progress.with],[String(index+1),String(recipe.slots.length)])}assert.equal(f.off.typeId,recipe.id);return f.off.clone()}
function cook(f,raw,count=1,take=true){f.main=new Stack('minecraft:flint_and_steel');f.handle();assert.equal(f.state.lit,true);assert.equal(f.main.damage,1);for(let i=0;i<count;i++){f.main=raw.clone();f.handle()}assert.equal(f.grill.rows.filter(Boolean).length,count);f.main=f.api.buildCookeryOilPot('canola',10);f.handle();assert.equal(f.api.readCookeryOilPot(f.main).count,10-count);assert.equal(f.state.phase,1);f.main=undefined;for(let i=0;i<4;i++){f.handle();if(i<3)f.tick(20)}assert.equal(f.state.phase,2);f.main=f.seasoning();f.handle();assert.equal(f.api.getUses(f.main),count);assert.equal(f.state.seasoned,true);f.main=undefined;if(!take)return;assert.equal(f.api.extract(f.block,f.holder,true),count);assert.equal(f.drops.length,0);return f.bag.getItem(0)}
for(const recipe of cooked)test(recipe.id+' threads, cooks, retains heat/seasoning and settles once',()=>{const f=fixture(),raw=thread(f,recipe);f.off=undefined;const output=cook(f,raw);assert.equal(output.typeId,recipe.cooked);assert.equal(f.api.isHot(output),true);assert.deepEqual([...f.api.readSeasonings(output)],[...seasoning.BASE_SEASONINGS]);assert.equal(f.state.phase,0);assert.equal(f.state.lit,true);f.hunger.currentValue=10;f.main=output;const active={hand:'main',use:captureEatingIdentity(output,'main',0),meta:{hot:true,hotUntil:2200,seasonings:[...seasoning.BASE_SEASONINGS]}};assert.equal(f.api.hungerSettle(f.holder,recipe.cooked,active),true);assert.equal(f.main,undefined);assert.equal(f.bag.getItem(0),undefined);assert.equal(f.api.hungerSettle(f.holder,recipe.cooked,active),false);assert.equal(f.settlements.length,1);const facts=data.FOOD_DATA[recipe.cooked];assert.equal(f.hunger.currentValue,Math.min(20,10+facts.nutrition));assert.equal(f.saturation.currentValue,Math.min(f.hunger.currentValue,facts.nutrition*facts.saturation*2*1.25));});
test('three occupied slots cost three oil points and three seasoning uses, then merge into one native stack',()=>{const f=fixture(),raw=thread(f,cooked.find(r=>r.id.endsWith('fish_skewer')));f.off=undefined;cook(f,raw,3);assert.equal(f.bag.rows.filter(Boolean).length,1);assert.equal(f.main.amount,3);assert.equal(f.grill.rows.filter(Boolean).length,0)});
test('insufficient oil/seasoning blocks phase progress and preserves inputs',()=>{const f=fixture(),raw=thread(f,cooked.find(r=>r.id.endsWith('fish_skewer')));f.off=undefined;f.main=new Stack('minecraft:flint_and_steel');f.handle();for(let i=0;i<3;i++){f.main=raw;f.handle()}f.main=f.api.buildCookeryOilPot('canola',2);f.handle();assert.equal(f.state.phase,0);assert.equal(f.api.readCookeryOilPot(f.main).count,2);f.main=f.api.buildCookeryOilPot('canola',3);f.handle();f.main=undefined;for(let i=0;i<4;i++){f.handle();if(i<3)f.tick(20)}const bottle=f.seasoning();f.api.setUses(bottle,14);f.main=bottle;f.handle();assert.equal(f.state.seasoned,false);assert.equal(f.api.getUses(f.main),14)});
test('failed oil hand write rolls both oil and cooking state back without success sound',()=>{const f=fixture(),raw=thread(f,cooked.find(r=>r.id.endsWith('fish_skewer')));f.off=undefined;f.main=new Stack('minecraft:flint_and_steel');f.handle();f.main=raw;f.handle();f.main=f.api.buildCookeryOilPot('canola',3);const before=f.sounds.length;f.failNextHand();f.handle();assert.equal(f.state.phase,0);assert.equal(f.api.readCookeryOilPot(f.main).count,3);assert.equal(f.sounds.length,before)});

test('custom three-food secret skewer cooks ingredient food and creator data before settling',()=>{
 const f=fixture(),recipe={id:skewers.SECRET_ID,slots:[['minecraft:apple'],['minecraft:carrot'],['minecraft:beef']]};
 const raw=thread(f,recipe);assert.equal(JSON.parse(items.getItemProperty(raw,skewers.SECRET_CREATOR_KEY)).id,f.holder.id);f.off=undefined;
 const output=cook(f,raw);assert.equal(f.api.isSecretCooked(output),true);
 assert.deepEqual([...f.api.readEffectiveSkewerRows(output)].map(r=>r.id),['minecraft:apple','minecraft:carrot','minecraft:cooked_beef']);
 f.main=output;const active={hand:'main',use:captureEatingIdentity(output,'main',0),meta:{hot:true,hotUntil:2200,seasonings:[...seasoning.BASE_SEASONINGS]}};
 assert.equal(f.api.hungerSettle(f.holder,skewers.SECRET_ID,active),true);assert.equal(f.main,undefined);assert.equal(f.hunger.currentValue,9);assert.equal(f.settlements.length,1);
});

test('tag-selected two-ingredient skewer completes and disassembles the exact native ingredients',()=>{
 const f=fixture(),ingredients=[new Stack('example:chicken_skin'),new Stack('kaleidoscope_grilling:chicken_skin')];
 ingredients[0].nameTag='Tagged skin';ingredients[0].keepOnDeath=true;ingredients[0].destroy=['minecraft:stone'];
 items.setItemLore(ingredients[0],[{translate:'example:original_lore'}]);items.setItemProperty(ingredients[0],'example:batch','recipe-input');
 const expected=ingredients.map(snapshots.captureSkewerMetadata);
 f.off=new Stack('minecraft:stick');
 for(const ingredient of ingredients){f.main=ingredient;assert.equal(f.api.threadCurrent(f.holder),true);assert.equal(f.main,undefined)}
 assert.equal(f.off.typeId,'kaleidoscope_grilling:raw_chicken_skin_skewer');
 assert.deepEqual([...f.api.readSkewerRows(f.off)].map(row=>row.id),ingredients.map(row=>row.typeId));
 assert.deepEqual([...f.api.readSkewerRows(f.off)[0].tags],ingredientTags.get('example:chicken_skin'));
 assert.equal(f.api.disassembleOff(f.holder),true);assert.equal(f.off,undefined);
 assert.deepEqual(f.bag.rows.slice(0,2).map(snapshots.captureSkewerMetadata),expected);
 assert.equal(f.bag.getItem(2).typeId,'minecraft:stick');assert.equal(f.bag.getItem(2).amount,1);assert.equal(f.drops.length,0);
 assert.equal(f.api.disassembleOff(f.holder),false);
});
test('mushroom alternatives remain ordered and preserve the chosen second mushroom',()=>{
 const f=fixture();f.off=new Stack(skewers.UNFINISHED_ID);
 const ids=['minecraft:brown_mushroom','kaleidoscope_grilling:carrot_dice','minecraft:red_mushroom'];
 for(const id of ids){f.main=new Stack(id);assert.equal(f.api.threadCurrent(f.holder),true)}
 assert.equal(f.off.typeId,'kaleidoscope_grilling:raw_mushroom_skewer');
 assert.deepEqual([...f.api.readSkewerRows(f.off)].map(row=>row.id),ids);
 const wrong=fixture();wrong.off=new Stack(skewers.UNFINISHED_ID);
 for(const id of [ids[1],ids[0],ids[2]]){wrong.main=new Stack(id);assert.equal(wrong.api.threadCurrent(wrong.holder),true)}
 assert.equal(wrong.off.typeId,skewers.SECRET_ID);
});
for(const native of [{version:1,id:'minecraft:carrot'},{version:99,id:'minecraft:apple'}])test('unrestorable existing ingredient '+JSON.stringify(native)+' rejects threading before debit',()=>{
 const f=fixture();f.off=new Stack(skewers.UNFINISHED_ID);
 const invalid=[{id:'minecraft:apple',nutrition:4,saturation:.3,edible:true,tags:[],native}];
 items.setItemProperty(f.off,skewers.SKEWER_INGREDIENTS_KEY,JSON.stringify(invalid));f.main=new Stack('minecraft:bread',2);
 const main=f.main,off=f.off.clone(),sounds=f.sounds.length;
 assert.throws(()=>f.api.threadCurrent(f.holder),/ingredient identity mismatch|unsupported ingredient snapshot/);
 assert.deepEqual(f.main,main);assert.deepEqual(f.off,off);assert.equal(f.drops.length,0);assert.equal(f.sounds.length,sounds);
});
for(const count of [0,1,2])test('incomplete secret with '+count+' ingredients cannot be threaded through another dispatcher',()=>{
 const f=fixture(),secret=new Stack(skewers.SECRET_ID);
 const rows=['minecraft:apple','minecraft:carrot'].slice(0,count).map(id=>({id,nutrition:3,saturation:.3}));
 if(count)items.setItemProperty(secret,skewers.SKEWER_INGREDIENTS_KEY,JSON.stringify(rows));
 f.main=secret;f.off=new Stack(skewers.UNFINISHED_ID);const main=f.main,off=f.off.clone();
 assert.equal(f.api.threadCurrent(f.holder),false);assert.deepEqual(f.main,main);assert.deepEqual(f.off,off);assert.equal(f.drops.length,0);
});
test('a complete three-ingredient zero-nutrition secret remains a valid threading ingredient',()=>{
 const f=fixture(),secret=new Stack(skewers.SECRET_ID);
 const rows=['minecraft:stone','minecraft:dirt','minecraft:sand'].map(id=>({id,nutrition:0,saturation:0,edible:false}));
 items.setItemProperty(secret,skewers.SKEWER_INGREDIENTS_KEY,JSON.stringify(rows));f.main=secret;f.off=new Stack(skewers.UNFINISHED_ID);
 assert.equal(f.api.threadCurrent(f.holder),true);assert.equal(f.main,undefined);assert.equal(f.off.typeId,skewers.UNFINISHED_ID);
 assert.equal(f.api.readSkewerRows(f.off)[0].id,skewers.SECRET_ID);
});
test('ordinary configured skewer threads but cannot enter the raw cooking pipeline',()=>{
 const f=fixture(),recipe=skewers.recipeTable().find(r=>!r.cooked),raw=thread(f,recipe);f.off=undefined;
 f.main=new Stack('minecraft:flint_and_steel');f.handle();f.main=raw;f.handle();
 assert.equal(f.grill.rows.filter(Boolean).length,0);assert.equal(f.main.typeId,recipe.id);assert.equal(f.state.phase,0);
});


test('actual alternate secret enters the grill, freezes fourth-flip ingredients and retains slot metadata on extraction and settlement',()=>{
 const f=fixture(),recipe={id:skewers.SECRET_ID,slots:[['minecraft:apple'],['minecraft:carrot'],['minecraft:beef']]};
 const raw=thread(f,recipe);raw.typeId=eatingItemId(skewers.SECRET_ID,true);raw.nameTag='kept alternate serving';items.setItemLore(raw,[{text:'foreign lore'}]);raw.keepOnDeath=true;raw.lockMode='slot';raw.destroy=['minecraft:stone'];raw.place=['minecraft:dirt'];items.setItemProperty(raw,'test:foreign','retained');
 const before=snapshots.captureSkewerMetadata(raw);f.off=undefined;
 const output=cook(f,raw);assert.equal(output.typeId,raw.typeId);assert.equal(output.amount,1);assert.equal(f.api.isSecretCooked(output),true);
 assert.deepEqual([...f.api.readEffectiveSkewerRows(output)].map(r=>r.id),['minecraft:apple','minecraft:carrot','minecraft:cooked_beef']);
 const after=snapshots.captureSkewerMetadata(output);
 for(const key of ['id','name','damage','keepOnDeath','lockMode','canDestroy','canPlaceOn','enchantments'])assert.deepEqual(after[key],before[key]);
 assert.equal(items.getItemProperty(output,'test:foreign'),'retained');assert.equal(items.getItemProperty(output,skewers.SKEWER_INGREDIENTS_KEY),items.getItemProperty(raw,skewers.SKEWER_INGREDIENTS_KEY));assert.equal(items.getItemProperty(output,skewers.SECRET_CREATOR_KEY),items.getItemProperty(raw,skewers.SECRET_CREATOR_KEY));
 f.main=output;const active={hand:'main',use:captureEatingIdentity(output,'main',0),meta:{hot:true,hotUntil:2200,seasonings:[...seasoning.BASE_SEASONINGS]}};
 assert.equal(f.api.hungerSettle(f.holder,skewers.SECRET_ID,active),true);assert.equal(f.main,undefined);assert.equal(f.hunger.currentValue,9);assert.equal(f.settlements.length,1);
 assert.equal(f.api.hungerSettle(f.holder,skewers.SECRET_ID,active),false);
});

function fullBagGrill(targetAmount){
 const f=fixture();cook(f,new Stack('kaleidoscope_grilling:raw_fish_skewer'),3,false);
 const output=f.api.outputFor(f.grill.getItem(0),f.state,logic.outputKind(f.state));
 for(let slot=0;slot<f.bag.size;slot++)f.bag.setItem(slot,new Stack('minecraft:stone',64));
 const target=output.clone();target.amount=targetAmount;f.bag.setItem(3,target);
 return {f,output,target};
}
test('full inventory extraction reserves compatible native capacity for every output and drops only overflow',()=>{
 for(const amount of [61,63]){
  const {f,output}=fullBagGrill(amount);
  assert.equal(f.api.extract(f.block,f.holder,true),3);
  assert.equal(f.bag.getItem(3).amount,64);assert.equal(f.bag.getItem(3).isStackableWith(output),true);
  assert.equal(f.drops.length,amount===61?0:2);
  for(const drop of f.drops){assert.equal(drop.stack.amount,1);assert.equal(drop.stack.isStackableWith(output),true);assert.equal(drop.removed,false)}
  assert.equal(f.grill.rows.filter(Boolean).length,0);assert.equal(f.state.phase,0);
  assert.equal(f.bag.getItem(0).typeId,'minecraft:stone');assert.equal(f.bag.getItem(0).amount,64);
 }
});
test('same food ID with a different native component cannot absorb grill output',()=>{
 const {f,target}=fullBagGrill(61);target.keepOnDeath=true;f.bag.setItem(3,target);
 assert.equal(f.api.extract(f.block,f.holder,true),3);
 assert.deepEqual(f.bag.getItem(3),target);assert.equal(f.drops.length,3);
 assert.ok(f.drops.every(drop=>drop.stack.keepOnDeath===false&&drop.stack.amount===1));
});
test('failed merged inventory write restores the whole grill batch, target metadata and ready state',()=>{
 const {f,target}=fullBagGrill(61),raws=structuredClone(f.grill.rows),state=structuredClone(f.state),write=f.bag.setItem.bind(f.bag);let fail=true;
 f.bag.setItem=(slot,stack)=>{write(slot,stack);if(slot===3&&fail){fail=false;throw Error('Injected after native merge credit')}};
 assert.equal(f.api.extract(f.block,f.holder,true),0);
 assert.deepEqual(structuredClone(f.grill.rows),raws);assert.deepEqual(f.bag.getItem(3),target);
 assert.deepEqual(f.state,state);assert.equal(f.drops.length,0);
});
test('Creative brushing and seasoning consume per occupied skewer while ignition retains durability',()=>{
 for(const occupied of [1,2,3]){
  const f=fixture({creative:true});f.main=new Stack('minecraft:flint_and_steel');f.handle();assert.equal(f.main.damage,0);
  f.main=new Stack('kaleidoscope_grilling:raw_fish_skewer');for(let slot=0;slot<occupied;slot++)f.handle();
  assert.equal(f.main.amount,1);assert.equal(f.grill.rows.filter(Boolean).length,occupied);
  f.main=f.api.buildCookeryOilPot('canola',5);f.handle();
  assert.equal(f.api.readCookeryOilPot(f.main).count,5-occupied);assert.equal(f.state.phase,1);assert.equal(f.state.heatTicks,1200);
  f.main=undefined;for(let flip=0;flip<4;flip++){f.handle();if(flip<3)f.tick(20)}
  f.main=f.seasoning();f.handle();assert.equal(f.api.getUses(f.main),occupied);assert.equal(f.state.seasoned,true);
 }
});
test('Creative brush still rejects insufficient oil and rolls back a failed pot write',()=>{
 const f=fixture({creative:true});f.main=new Stack('minecraft:flint_and_steel');f.handle();
 f.main=new Stack('kaleidoscope_grilling:raw_fish_skewer');for(let slot=0;slot<3;slot++)f.handle();
 f.main=f.api.buildCookeryOilPot('canola',2);f.handle();assert.equal(f.api.readCookeryOilPot(f.main).count,2);assert.equal(f.state.phase,0);
 f.main=f.api.buildCookeryOilPot('canola',3);const before=f.main,sounds=f.sounds.length;f.failNextHand();f.handle();
 assert.deepEqual(f.main,before);assert.equal(f.state.phase,0);assert.equal(f.sounds.length,sounds);
});

test('actual failure and unknown-cooked fallback preserve source and all accessible metadata',()=>{
 const f=fixture();
 for(const inputId of ['kaleidoscope_grilling:raw_gluten_skewer','kaleidoscope_grilling:secret_skewer','foreign:raw_without_recipe'])for(const kind of ['mysterious','dark',...(inputId.startsWith('foreign:')?['cooked']:[])]){
  const raw=new Stack(inputId,3);raw.nameTag='Failed source';raw.keepOnDeath=true;raw.lockMode='slot';raw.destroy=['minecraft:stone'];raw.place=['minecraft:dirt'];items.setItemLore(raw,[{translate:'source.lore'}]);
  items.setItemProperty(raw,'foreign:metadata','opaque');items.setItemProperty(raw,secretShape.SECRET_MODEL_VARIANTS_KEY,'[6,5,4]');const before=snapshots.captureSkewerMetadata(raw);
  const output=f.api.outputFor(raw,f.state,kind);assert.equal(output.typeId,kind==='dark'?data.DARK_ID:data.MYSTERIOUS_ID);assert.equal(output.amount,1);
  const expected=structuredClone(before);expected.id=output.typeId;expected.props[failureSkewers.FAILED_SOURCE_KEY]=inputId===skewers.SECRET_ID?'custom':inputId;
  assert.deepEqual(snapshots.captureSkewerMetadata(output),expected);assert.deepEqual(snapshots.captureSkewerMetadata(raw),before);
 }
});
