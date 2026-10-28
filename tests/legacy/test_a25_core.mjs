import assert from 'node:assert/strict';
import {
 PLATE_CAPACITY,PLATE_ID,PLATE_BLOCK_ID,BOOK_ID,RECIPE_BLOCK_ID,
 normalizePlateRows,plateAdd,plateRemoveLast,plateHighestNutritionIndex,plateEatHighest,
 isRecordableRecipe,makeBookRecord,bookIngredientSlots,planInventoryConsumption
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate/plate_recipe_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('A2.5 ids are separate item/block where Bedrock needs dynamic edible plate data',()=>{
 assert.equal(PLATE_ID,'kaleidoscope_grilling:skewer_plate');
 assert.equal(PLATE_BLOCK_ID,'kaleidoscope_grilling:skewer_plate_block');
 assert.equal(BOOK_ID,'kaleidoscope_grilling:skewer_recipe_book');
 assert.equal(RECIPE_BLOCK_ID,'kaleidoscope_grilling:skewer_recipe');
});
t('plate capacity is Java five',()=>assert.equal(PLATE_CAPACITY,5));
t('plate accepts five and rejects sixth',()=>{
 let rows=[];for(let i=0;i<5;i++){const x=plateAdd(rows,{id:'x:'+i,nutrition:i});assert.equal(x.ok,true);rows=x.rows}
 assert.equal(rows.length,5);assert.equal(plateAdd(rows,{id:'x:5'}).ok,false);
});
t('plate removes last and compacts like Java block entity',()=>{
 const x=plateRemoveLast([{id:'a'},{id:'b'},{id:'c'}]);assert.equal(x.removed.id,'c');assert.deepEqual(x.rows.map(r=>r.id),['a','b']);
});
t('plate eating selects first highest nutrition on ties',()=>{
 const rows=[{id:'a',nutrition:3},{id:'b',nutrition:8},{id:'c',nutrition:8}];
 assert.equal(plateHighestNutritionIndex(rows),1);
 const x=plateEatHighest(rows);assert.equal(x.eaten.id,'b');assert.deepEqual(x.rows.map(r=>r.id),['a','c']);
});
t('normalization caps malformed packed data at five',()=>{
 const rows=normalizePlateRows([null,{id:'a'},{id:'b'},{id:'c'},{id:'d'},{id:'e'},{id:'f'}]);
 assert.deepEqual(rows.map(r=>r.id),['a','b','c','d','e']);
});
t('all configured raw/ordinary Java skewers are recordable',()=>{
 for(const id of ['kaleidoscope_grilling:raw_beef_skewer','kaleidoscope_grilling:raw_fish_skewer','kaleidoscope_grilling:ordinary_skewer'])assert.equal(isRecordableRecipe(id),true);
});
t('secret book requires exactly three recorded ingredients',()=>{
 assert.equal(isRecordableRecipe('kaleidoscope_grilling:secret_skewer',2),false);
 assert.equal(isRecordableRecipe('kaleidoscope_grilling:secret_skewer',3),true);
 const record=makeBookRecord('kaleidoscope_grilling:secret_skewer',['minecraft:apple','minecraft:carrot','minecraft:bread']);
 assert.deepEqual(bookIngredientSlots(record),[['minecraft:apple'],['minecraft:carrot'],['minecraft:bread']]);
});
t('fixed book uses the configured selector slots',()=>{
 const r=makeBookRecord('kaleidoscope_grilling:raw_fish_skewer');
 assert.deepEqual(bookIngredientSlots(r),[['minecraft:cod','minecraft:salmon','minecraft:tropical_fish','minecraft:pufferfish']]);
});
t('inventory plan reserves duplicate ingredients from one stack',()=>{
 const slots=[['minecraft:apple'],['minecraft:apple'],['minecraft:carrot']];
 const p=planInventoryConsumption([{id:'minecraft:apple',count:2},{id:'minecraft:carrot',count:1}],slots);
 assert.deepEqual(p,{ok:true,plan:[{slot:0,count:2},{slot:1,count:1}]});
});
t('inventory plan respects selected/offhand exclusions',()=>{
 const slots=[['minecraft:apple']];
 assert.equal(planInventoryConsumption([{id:'minecraft:apple',count:64}],slots,[0]).ok,false);
});
t('missing ingredient fails atomically with empty plan',()=>{
 const p=planInventoryConsumption([{id:'minecraft:apple',count:64}],[['minecraft:apple'],['minecraft:bread']]);
 assert.equal(p.ok,false);assert.deepEqual(p.plan,[]);
});

console.log(JSON.stringify({passed:n,failed:0,scope:'A2.5 Skewer Plate + Recipe Book pure Java parity'}));
