import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {secretEatingRows} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_eating_core.js';
import {SECRET_ID,SKEWER_INGREDIENTS_KEY,SECRET_COOKED_KEY,SECRET_COOKED_INGREDIENTS_KEY} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js';
/** Stable ItemStack API doubles, not simulated Minecraft players. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {captureSkewerMetadata,restoreSkewerMetadata,metadataSignature} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js';
import {configureItemDataWorld,setItemProperty,getItemProperty,setItemLore,getItemRawLore} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/itemDataCore.js';
const records=new Map();configureItemDataWorld({getDynamicProperty:k=>records.get(k),setDynamicProperty:(k,v)=>records.set(k,v)});
class Stack{
 constructor(typeId,amount=1){Object.assign(this,{typeId,amount,maxAmount:typeId.includes('sword')?1:64,lore:[],props:{},keepOnDeath:false,lockMode:'none',destroy:[],place:[],enchantments:[],damage:0});}
 getRawLore(){return this.lore.map(x=>typeof x==='string'?{text:x}:structuredClone(x))}setLore(v){this.lore=structuredClone(v)}
 getDynamicPropertyIds(){return Object.keys(this.props)}getDynamicProperty(k){return this.props[k]}setDynamicProperty(k,v){this.props[k]=v}
 getCanDestroy(){return this.destroy}getCanPlaceOn(){return this.place}setCanDestroy(v){this.destroy=[...v]}setCanPlaceOn(v){this.place=[...v]}
 getComponent(id){const s=this;if(id==='minecraft:durability'&&this.maxAmount===1)return {get damage(){return s.damage},set damage(n){s.damage=n}};
 if(id==='minecraft:enchantable'&&this.maxAmount===1)return {getEnchantments:()=>s.enchantments,removeAllEnchantments:()=>s.enchantments=[],addEnchantments:rows=>s.enchantments=rows};}
}
const restore=row=>restoreSkewerMetadata(row,(id,n)=>new Stack(id,n),id=>({id}));
for(const id of ['minecraft:apple','minecraft:diamond_sword'])test('metadata roundtrip '+id,()=>{
 const s=new Stack(id,17);s.nameTag='named';s.keepOnDeath=true;s.lockMode='slot';s.destroy=['minecraft:stone'];s.place=['minecraft:dirt'];
 setItemLore(s,[{translate:'item.apple.name'},{rawtext:[{text:'prefix '},{translate:'item.diamond.name'}]}]);
 setItemProperty(s,'test:vector',{x:1,y:2,z:3});setItemProperty(s,'test:false',false);setItemProperty(s,'test:zero',0);
 if(s.maxAmount===1){s.damage=31;s.enchantments=[{type:{id:'unbreaking'},level:3},{type:{id:'sharpness'},level:2}]}
 const data=captureSkewerMetadata(s),out=restore(JSON.parse(JSON.stringify(data)));
 assert.equal(out.amount,1);assert.equal(metadataSignature(captureSkewerMetadata(out)),metadataSignature(data));
 assert.deepEqual(getItemRawLore(out),getItemRawLore(s));assert.deepEqual(getItemProperty(out,'test:vector'),{x:1,y:2,z:3});
});
test('metadata has stable identity independent of dynamic-property insertion order',()=>{const a=new Stack('minecraft:apple'),b=new Stack('minecraft:apple');setItemProperty(a,'x:a',1);setItemProperty(a,'x:b',2);setItemProperty(b,'x:b',2);setItemProperty(b,'x:a',1);assert.equal(metadataSignature(captureSkewerMetadata(a)),metadataSignature(captureSkewerMetadata(b)));});
test('captures actual RawMessage rather than erasing translated lore',()=>{const s=new Stack('minecraft:apple');s.setLore([{translate:'test:key',with:['a']}]);assert.deepEqual(captureSkewerMetadata(s).rawLore,[{translate:'test:key',with:['a']}]);});
test('unreadable metadata is rejected rather than captured empty',()=>{const s=new Stack('minecraft:diamond_sword');s.getDynamicPropertyIds=()=>{throw Error('unreadable')};assert.throws(()=>captureSkewerMetadata(s),/unreadable/);});
test('metadata setter failure aborts restoration',()=>{const d=captureSkewerMetadata(new Stack('minecraft:apple'));assert.throws(()=>restoreSkewerMetadata(d,()=>{const s=new Stack(d.id);s.setCanPlaceOn=()=>{throw Error('denied')};return s},id=>({id})),/denied/);});
test('silently rejected field fails readback',()=>{const s=new Stack('minecraft:apple');s.keepOnDeath=true;const d=captureSkewerMetadata(s);assert.throws(()=>restoreSkewerMetadata(d,()=>{const out=new Stack(d.id);Object.defineProperty(out,'keepOnDeath',{get:()=>false,set(){}});return out},id=>({id})),/readback/);});
test('unknown snapshot version refuses lossy fallback',()=>assert.throws(()=>restore({version:2,id:'minecraft:apple'}),/unsupported/));
test('separate damage and raw-lore contents have different ingredient identity',()=>{const a=new Stack('minecraft:diamond_sword'),b=new Stack('minecraft:diamond_sword');b.damage=1;assert.notEqual(metadataSignature(captureSkewerMetadata(a)),metadataSignature(captureSkewerMetadata(b)));b.damage=0;b.lore=[{translate:'test:key'}];assert.notEqual(metadataSignature(captureSkewerMetadata(a)),metadataSignature(captureSkewerMetadata(b)));});
const src=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/main.js',import.meta.url),'utf8');
function body(name){const start=src.indexOf('function '+name+'(');let end=src.indexOf('{',start)+1,n=1;for(;n;end++){if(src[end]==='{')n++;if(src[end]==='}')n--}return src.slice(start,end)}
for(const kind of ['unmapped','invalid','nonfood','food'])test('actual smoking resolver preserves raw unless food result '+kind,()=>{
 const row={id:'test:raw',name:'Original',native:{marker:42}},ctx=vm.createContext({canonicalFoodId,forgetEatingItem(){},resolveSecretSmokedId:()=>kind==='unmapped'?null:'test:cooked',ItemStack:class{constructor(id){if(kind==='invalid')throw Error('missing');this.id=id}},ingredientSnapshot:s=>({id:s.id,edible:kind==='food',name:''})});
 vm.runInContext(body('cookedIngredientRows')+';this.run=cookedIngredientRows',ctx);const out=ctx.run([row])[0];
 if(kind==='food'){assert.equal(out.id,'test:cooked');assert.equal(out.name,'');assert.equal(out.native,undefined)}else assert.equal(out,row);
});
test('raw rows preserve corruption instead of silently turning into empty skewers',()=>{const ctx=vm.createContext({canonicalFoodId,forgetEatingItem(){},getItemProperty:()=>'{bad'});vm.runInContext(body('readRowsFromKey')+';this.run=readRowsFromKey',ctx);assert.throws(()=>ctx.run({},'key'));});
test('metadata verification happens before threading debits',()=>{const f=body('threadCurrent');assert.ok(f.indexOf('restoreIngredient(')<f.indexOf('main.write('));assert.ok(f.includes('ingredientSnapshot(food,true)'));});
const {ingredientContentSignature}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js');
const {secretFood}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js');
test('mixed legacy and native snapshots retain duplicate ingredient penalty',()=>{const legacy={id:'minecraft:apple',name:'named',lore:['text'],props:{'x:a':1},nutrition:4,saturation:.3};const s=new Stack(legacy.id);s.nameTag=legacy.name;s.setLore(legacy.lore);setItemProperty(s,'x:a',1);const current={...legacy,native:captureSkewerMetadata(s)};assert.equal(ingredientContentSignature(legacy),ingredientContentSignature(current));assert.equal(secretFood([legacy,current],true).duplicate,true);current.native.rawLore=[{translate:'different'}];assert.equal(secretFood([legacy,current],true).duplicate,false);});
function eatingContext(rows,cookedRows){
 const ctx=vm.createContext({secretEatingRows,secretFood,ItemStack:class extends Stack{constructor(id,n){if(id==='test:missing')throw Error('uninstalled item');super(id,n)}},readSkewerRows:()=>{if(rows==='{bad')throw Error('bad');return rows??[]},readEffectiveSkewerRows:()=>cookedRows,isSecretCooked:()=>cookedRows!==undefined});
 vm.runInContext(body('secretEatingData')+'\n'+body('canUseSecretSkewer')+';this.run=canUseSecretSkewer;this.data=secretEatingData;',ctx);return ctx;
}
for(const rows of [undefined,[],[{id:'a'}],[{id:'a'},{id:'b'}],'{bad'])test('secret use rejects missing or malformed raw data '+JSON.stringify(rows),()=>assert.equal(eatingContext(rows).run({}),false));
test('three registered ingredients can start native use even without food or a held palette',()=>{const ctx=eatingContext([{id:'test:a'},{id:'test:b'},{id:'test:c'}]);assert.equal(ctx.run({}),true);assert.equal(ctx.data({}).food.nutrition,1);assert.ok(src.indexOf('!canUseSecretSkewer(e.itemStack)')>0);});
test('unknown, air, corrupt numeric and native mismatches cannot turn three rows into edible air',()=>{
 for(const bad of [{id:'test:missing'},{id:'minecraft:air'},{id:'minecraft:apple',nutrition:'4'},{id:'minecraft:apple',nutrition:NaN},{id:'minecraft:apple',saturation:Infinity},{id:'minecraft:apple',nutrition:-1},{id:'minecraft:apple',native:null},{id:'minecraft:apple',native:{version:2,id:'minecraft:apple'}},{id:'minecraft:apple',native:{version:1,id:'minecraft:carrot'}}]){
  const rows=[bad,{id:'minecraft:beef'},{id:'minecraft:carrot'}];assert.equal(eatingContext(rows).run({}),false,JSON.stringify(bad));
  assert.equal(eatingContext([{id:'minecraft:apple'},{id:'minecraft:beef'},{id:'minecraft:carrot'}],rows).run({}),false,'cooked '+JSON.stringify(bad));
 }
});
test('missing legacy fields use installed food facts while explicit zero remains valid',()=>{
 const rows=[{id:'minecraft:apple'},{id:'minecraft:carrot'},{id:'minecraft:beef'}],before=structuredClone(rows),data=eatingContext(rows,rows).data({});
 assert.equal(data.food.nutrition,6);assert.deepEqual(rows,before);
 const explicit=rows.map(row=>({...row,edible:true,nutrition:0,saturation:0}));assert.equal(eatingContext(explicit).run({}),true);assert.equal(eatingContext(explicit).data({}).food.nutrition,1);
 const decoded=secretEatingRows([{id:'test:food'},{id:'minecraft:apple'},{id:'minecraft:carrot'}],id=>({typeId:id,getComponent:()=>id==='test:food'?{nutrition:5,saturationModifier:.7,usingConvertsTo:'minecraft:bowl'}:undefined}));
 assert.equal(decoded[0].nutrition,5);assert.equal(decoded[0].convertTo,'minecraft:bowl');
});
test('saved stackable secret reopens its canonical world record and refuses a missing record without rewriting it',()=>{
 const rows=['minecraft:apple','minecraft:carrot','minecraft:beef'].map(id=>({id})),skewer=new Stack(SECRET_ID+'_native_plain',3);
 setItemProperty(skewer,SKEWER_INGREDIENTS_KEY,JSON.stringify(rows));setItemProperty(skewer,SECRET_COOKED_KEY,true);setItemProperty(skewer,'foreign:owner','retained');
 const saved=JSON.parse(JSON.stringify({id:skewer.typeId,amount:skewer.amount,lore:skewer.getRawLore(),records:[...records]})),restoredRecords=new Map(saved.records);
 configureItemDataWorld({getDynamicProperty:k=>restoredRecords.get(k),setDynamicProperty:(k,v)=>restoredRecords.set(k,v)});
 try{
  const restored=new Stack(saved.id,saved.amount);restored.setLore(saved.lore);
  const ctx=vm.createContext({secretEatingRows,secretFood,ItemStack:Stack,canonicalFoodId,SECRET_ID,SKEWER_INGREDIENTS_KEY,SECRET_COOKED_KEY,SECRET_COOKED_INGREDIENTS_KEY,getItemProperty});
  vm.runInContext(['readRowsFromKey','readSkewerRows','isSecretCooked','readEffectiveSkewerRows','secretEatingData','canUseSecretSkewer'].map(body).join('\n'),ctx);
  assert.equal(ctx.canUseSecretSkewer(restored),true);assert.equal(ctx.secretEatingData(restored).food.nutrition,6);assert.equal(restored.amount,3);assert.equal(getItemProperty(restored,'foreign:owner'),'retained');assert.deepEqual([...restoredRecords],saved.records);
  restoredRecords.clear();assert.equal(ctx.canUseSecretSkewer(restored),false);assert.deepEqual(restored.getRawLore(),saved.lore);assert.equal(restored.amount,3);
 }finally{configureItemDataWorld({getDynamicProperty:k=>records.get(k),setDynamicProperty:(k,v)=>records.set(k,v)});}
});
test('five ordinary cooked-secret plate snapshots fit native string storage',()=>{
 const rows=['minecraft:apple','minecraft:carrot','minecraft:beef'].map(id=>({id,nutrition:4,saturation:.3,convertTo:'',edible:true,tags:[],native:captureSkewerMetadata(new Stack(id))}));
 const skewer=new Stack('kaleidoscope_grilling:secret_skewer');setItemLore(skewer,['Three ingredients']);setItemProperty(skewer,'kaleidoscope_grilling:skewer_ingredients',JSON.stringify(rows));setItemProperty(skewer,'kaleidoscope_grilling:secret_cooked_ingredients',JSON.stringify(rows));
 const row={id:skewer.typeId,native:captureSkewerMetadata(skewer),nutrition:7,saturation:.3};const payload=JSON.stringify(Array.from({length:5},()=>row));
 assert.ok(Buffer.byteLength(payload,'utf8')<32767,Buffer.byteLength(payload));
 const wrapped=JSON.stringify({'kaleidoscope_grilling:plate_skewers':payload});assert.ok(Buffer.byteLength(wrapped,'utf8')<32767,Buffer.byteLength(wrapped));
});
test('recorded cooked ingredient cache survives recooking as in Java',()=>{let writes=0,recomputes=0;const ctx=vm.createContext({SECRET_COOKED_INGREDIENTS_KEY:'cooked',getItemProperty:()=> 'existing cache',readRowsFromKey:()=>[{id:'test:a'},{id:'test:b'},{id:'test:c'}],cookedIngredientRows:()=>{recomputes++},setItemProperty:()=>writes++});vm.runInContext(body('validSecretIngredientRows')+'\n'+body('setCookedIngredientRows')+';this.run=setCookedIngredientRows',ctx);const stack={};assert.equal(ctx.run(stack,[]),stack);assert.equal(writes,0);assert.equal(recomputes,0);});
