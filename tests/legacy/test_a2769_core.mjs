import assert from 'node:assert/strict';
import {createFixture} from '../helpers/minecraft-fixture.mjs';
// The lore module imports itemData, whose external server boundary needs a fixture.
const {MAXIM_ITEMS,foodMaximKey,isHeatLore,planMaximLore}=
 await createFixture().load('a2769_food_tooltip_core.js');
let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS',name)};
const id='kaleidoscope_grilling:potato_beef_stew';
const custom={rawtext:[{text:'Custom '},{translate:'other:description',with:['x']}]};
test('all eight translated foods have one canonical maxim',()=>{
 assert.equal(MAXIM_ITEMS.length,8);
 for(const name of MAXIM_ITEMS){
  const key='tooltip.kaleidoscope_grilling.'+name+'.maxim';
  assert.equal(foodMaximKey('kaleidoscope_grilling:'+name),key);
  const next=planMaximLore('kaleidoscope_grilling:'+name,[]);
  assert.deepEqual(next,[{rawtext:[{text:'§r§8§o'},{translate:key},{text:'§r'}]}]);
 }
});
test('foreign/raw skewer items are unchanged',()=>{
 for(const other of ['minecraft:beef','kaleidoscope_grilling:raw_beef_skewer',undefined])
  assert.equal(planMaximLore(other,[custom]),undefined);
});
test('localized user lore remains the same structured value',()=>{
 const original=[custom,{text:'§c🔥 煙火氣 1:00'},{translate:'another:addon'}];
 const before=JSON.stringify(original),next=planMaximLore(id,original);
 assert.deepEqual(next.slice(1),original);assert.equal(JSON.stringify(original),before);
});
test('repeat application is idempotent (no inventory-event loop)',()=>{
 const next=planMaximLore(id,[custom]);
 assert.equal(planMaximLore(id,next),undefined);
});
test('owned duplicate lines are removed without losing custom lines',()=>{
 const first=planMaximLore(id,[])[0];
 const next=planMaximLore(id,[first,custom,first]);
 assert.deepEqual(next,[first,custom]);
});
test('retargeting a food replaces only the owned maxim',()=>{
 const previous=planMaximLore('kaleidoscope_grilling:pepper_honey',[custom]);
 const next=planMaximLore(id,previous);
 assert.equal(next[0].rawtext[1].translate,foodMaximKey(id));assert.deepEqual(next[1],custom);
});
test('unrelated line containing a translation key is not discarded',()=>{
 const customMaxim={rawtext:[{text:'my prefix'},{translate:foodMaximKey(id)}]};
 const next=planMaximLore(id,[customMaxim]);assert.deepEqual(next[1],customMaxim);
});
test('full lore is retained instead of truncating a user line',()=>{
 const full=Array.from({length:20},(_,i)=>({text:String(i)}));
 assert.equal(planMaximLore(id,full),undefined);assert.equal(full.length,20);
});
test('19 existing lines can receive one maxim',()=>{
 const lines=Array.from({length:19},(_,i)=>({text:String(i)}));
 assert.equal(planMaximLore(id,lines).length,20);
});
test('heat filtering recognizes string and RawMessage text only',()=>{
 assert.equal(isHeatLore('§c🔥 煙火氣 1:00'),true);
 assert.equal(isHeatLore({text:'§c🔥 煙火氣 1:00'}),true);
 assert.equal(isHeatLore(custom),false);
 assert.equal(isHeatLore({translate:'§c🔥:foreign'}),false);
 const next=planMaximLore(id,[custom,{text:'§c🔥 煙火氣 1:00'}]).filter(x=>!isHeatLore(x));
 assert.equal(next.length,2);assert.deepEqual(next[1],custom);
});
console.log('A2.7.69 pure lore rules: '+cases+'/'+cases+' (no Minecraft player simulation)');
