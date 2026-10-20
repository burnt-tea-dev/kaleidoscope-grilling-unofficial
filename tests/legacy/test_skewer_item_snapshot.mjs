/** Stable ItemStack API doubles, not simulated Minecraft players. */
import test from 'node:test';import assert from 'node:assert/strict';
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
const {ingredientContentSignature}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_item_snapshot.js');
const {secretFood}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js');
test('mixed legacy and native snapshots retain duplicate ingredient penalty',()=>{const legacy={id:'minecraft:apple',name:'named',lore:['text'],props:{'x:a':1},nutrition:4,saturation:.3};const s=new Stack(legacy.id);s.nameTag=legacy.name;s.setLore(legacy.lore);setItemProperty(s,'x:a',1);const current={...legacy,native:captureSkewerMetadata(s)};assert.equal(ingredientContentSignature(legacy),ingredientContentSignature(current));assert.equal(secretFood([legacy,current],true).duplicate,true);current.native.rawLore=[{translate:'different'}];assert.equal(secretFood([legacy,current],true).duplicate,false);});
test('five ordinary cooked-secret plate snapshots fit native string storage',()=>{
 const rows=['minecraft:apple','minecraft:carrot','minecraft:beef'].map(id=>({id,nutrition:4,saturation:.3,convertTo:'',edible:true,tags:[],native:captureSkewerMetadata(new Stack(id))}));
 const skewer=new Stack('kaleidoscope_grilling:secret_skewer');setItemLore(skewer,['Three ingredients']);setItemProperty(skewer,'kaleidoscope_grilling:skewer_ingredients',JSON.stringify(rows));setItemProperty(skewer,'kaleidoscope_grilling:secret_cooked_ingredients',JSON.stringify(rows));
 const row={id:skewer.typeId,native:captureSkewerMetadata(skewer),nutrition:7,saturation:.3};const payload=JSON.stringify(Array.from({length:5},()=>row));
 assert.ok(Buffer.byteLength(payload,'utf8')<32767,Buffer.byteLength(payload));
 const wrapped=JSON.stringify({'kaleidoscope_grilling:plate_skewers':payload});assert.ok(Buffer.byteLength(wrapped,'utf8')<32767,Buffer.byteLength(wrapped));
});
