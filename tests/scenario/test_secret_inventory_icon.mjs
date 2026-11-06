import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../helpers/minecraft-fixture.mjs';

async function fixture(){
 const f=createFixture();await f.load('main.js');f.startup();f.flush();
 f.persist=await f.load('core/persist.js');f.gui=await f.load('secret_gui_core.js');
 f.catalog=(await f.load('secret_visual_catalog.js')).SECRET_VISUAL_SLOTS;
 f.p=f.player({selectedSlotIndex:8});f.bag=f.p.getComponent('minecraft:inventory').container;
 f.saved=stack=>Object.fromEntries(f.persist.getItemPropertyIds(stack).map(k=>[k,f.persist.getItemProperty(stack,k)]));
 f.cache=stack=>stack.getRawLore().flatMap(row=>row.rawtext??[]).map(row=>f.gui.decodeSecretGuiCache(row.text)).find(Boolean);
 f.secret=(foods,variants=[4,7,9])=>{
  const stack=f.item('kaleidoscope_grilling:secret_skewer',3,{nameTag:'My skewer'});
  f.persist.setItemLore(stack,[{translate:f.gui.SECRET_GUI_PROGRESS,with:['3','3']},{text:'Foreign lore'}]);
  f.persist.setItemProperty(stack,'kaleidoscope_grilling:skewer_ingredients',JSON.stringify(foods.map(id=>({id}))));
  f.persist.setItemProperty(stack,'kaleidoscope_grilling:model_variants',JSON.stringify(variants));return stack;
 };
 return f;
}
test('registered inventory refresh gives same-ID skewers independent GUI data without changing gameplay metadata',async()=>{
 const f=await fixture();
 try{
  const recipes=[['minecraft:apple','minecraft:carrot','minecraft:beef'],['minecraft:beef','minecraft:apple','minecraft:carrot']];
  const before=recipes.map(foods=>f.secret(foods));
  const saved=before.map(f.saved),raw=before.map(x=>x.getRawLore());
  for(let slot=0;slot<2;slot++){f.bag.setItem(slot,before[slot]);f.emit('world.afterEvents.playerInventoryItemChange',{player:f.p,slot})}
  f.tick(3);
  const results=[0,1].map(slot=>f.bag.getItem(slot));
  for(let i=0;i<2;i++){
   assert.deepEqual(f.cache(results[i]),{foods:recipes[i].map(id=>f.catalog[id]),variants:6,style:0});
   assert.equal(results[i].typeId,before[i].typeId);assert.equal(results[i].amount,3);assert.equal(results[i].maxAmount,64);
   assert.equal(results[i].nameTag,'My skewer');assert.deepEqual(f.saved(results[i]),saved[i]);
   assert.ok(results[i].getRawLore().some(row=>row.text==='Foreign lore'));
   for(const carrier of raw[i].filter(row=>row.text?.startsWith('§r§0§r§1§r§2')))assert.ok(results[i].getRawLore().some(row=>row.text===carrier.text));
  }
  assert.notDeepEqual(f.cache(results[0]),f.cache(results[1]));
  const first=results.map(x=>x.getRawLore());f.tick(25);
  assert.deepEqual([0,1].map(slot=>f.bag.getItem(slot).getRawLore()),first,'unchanged cold items stop rewriting their presentation');
 }finally{f.dispose()}
});
test('registered refresh uses the cooked ingredient snapshot and does not alter its saved payload',async()=>{
 const f=await fixture();
 try{
  const stack=f.secret(['minecraft:apple','minecraft:carrot','minecraft:beef'],[7,4,7]);
  const cooked=['minecraft:cooked_beef','minecraft:baked_potato','minecraft:golden_carrot'];
  f.persist.setItemProperty(stack,'kaleidoscope_grilling:secret_cooked',true);
  f.persist.setItemProperty(stack,'kaleidoscope_grilling:secret_cooked_ingredients',JSON.stringify(cooked.map(id=>({id}))));
  const saved=f.saved(stack);f.bag.setItem(0,stack);f.emit('world.afterEvents.playerInventoryItemChange',{player:f.p,slot:0});f.tick(3);
  const result=f.bag.getItem(0);
  assert.deepEqual(f.cache(result),{foods:cooked.map(id=>f.catalog[id]),variants:5,style:6});assert.deepEqual(f.saved(result),saved);
 }finally{f.dispose()}
});
test('original item-use events still thread three named ingredients in the offhand and disassemble them',async()=>{
 const f=await fixture();
 try{
  const skewer=await f.load('skewer/runtime.js'),profile=await f.load('eating_profile_ids.js');
  const equipment=f.p.getComponent('minecraft:equippable');f.p.selectedSlotIndex=0;
  equipment.setEquipment(f.EquipmentSlot.Offhand,f.item('minecraft:stick'));
  const ids=['minecraft:apple','minecraft:carrot','minecraft:beef'];
  for(let i=0;i<3;i++){
   const food=f.item(ids[i],2,{nameTag:'Ingredient '+i,rawLore:[{text:'Original '+i}]});
   f.bag.setItem(0,food);
   const event=f.emit('world.beforeEvents.itemUse',{source:f.p,itemStack:food,cancel:false});
   assert.equal(event.cancel,true);f.tick(3);
   assert.equal(f.bag.getItem(0).amount,1,'the existing transaction consumes exactly one ingredient');
  }
  const result=equipment.getEquipment(f.EquipmentSlot.Offhand);
  assert.equal(profile.canonicalFoodId(result.typeId),'kaleidoscope_grilling:secret_skewer');
  assert.deepEqual(f.cache(result).foods,ids.map(id=>f.catalog[id]));
  assert.deepEqual(skewer.readSkewerRows(result).map(x=>x.native.name),['Ingredient 0','Ingredient 1','Ingredient 2']);
  f.p.isSneaking=true;
  const event=f.emit('world.beforeEvents.itemUse',{source:f.p,itemStack:f.bag.getItem(0),cancel:false});
  assert.equal(event.cancel,true);f.tick(3);
  assert.equal(equipment.getEquipment(f.EquipmentSlot.Offhand),undefined);
  const items=Array.from({length:f.bag.size},(_,i)=>f.bag.getItem(i));
  for(let i=0;i<3;i++){
   const returned=items.find(x=>x?.nameTag==='Ingredient '+i);
   assert.equal(returned.typeId,ids[i]);assert.ok(returned.getRawLore().some(x=>x.text==='Original '+i));
  }
  assert.ok(items.some(x=>x?.typeId==='minecraft:stick'));
 }finally{f.dispose()}
});
test('presentation refresh does not change the repeated-ingredient identity of an old skewer',async()=>{
 const f=await fixture();
 try{
  const snapshot=await f.load('skewer_item_snapshot.js');
  const old=f.secret(['minecraft:apple','minecraft:carrot','minecraft:beef']);
  // Both items already have the existing visible cold badge; only GUI cache differs.
  const stage=await f.load('localized_lore_core.js');
  f.persist.setItemLore(old,[...f.persist.getItemRawLore(old),stage.secretStageLore(false)]);
  const before={id:old.typeId,native:snapshot.captureSkewerMetadata(old)};
  f.bag.setItem(0,old);f.emit('world.afterEvents.playerInventoryItemChange',{player:f.p,slot:0});f.tick(3);
  const current=f.bag.getItem(0),after={id:current.typeId,native:snapshot.captureSkewerMetadata(current)};
  assert.notDeepEqual(after.native.rawLore,before.native.rawLore);
  assert.equal(snapshot.ingredientContentSignature(after),snapshot.ingredientContentSignature(before));
 }finally{f.dispose()}
});
