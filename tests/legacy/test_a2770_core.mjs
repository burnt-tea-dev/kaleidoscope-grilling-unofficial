import assert from 'node:assert/strict';
import {bottlePlan,oilPlan,positions,decodeKey,rotationForStates,isSeasoningBlock,FALLBACK_COLORS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2770_placed_visual_core.js';
let n=0;const test=(name,fn)=>{fn();n++;console.log('PASS',name)};
test('all 128 special use/variant combinations match Java bins',()=>{
 for(let uses=0;uses<16;uses++)for(let variant=0;variant<8;variant++){
  const p=bottlePlan({kind:'special',uses,variant});
  assert.equal(p.fill,Math.min(8,Math.floor((16-uses+1)/2)));assert.equal(p.variant,variant);assert.equal(p.mode,2);
 }
});
test('exhausted bottle has no content helper',()=>assert.equal(bottlePlan({kind:'special',uses:16}),undefined));
test('empty bottle has no content helper',()=>assert.equal(bottlePlan({kind:'empty',ingredients:[]}),undefined));
test('unfinished ingredients keep insertion order and individual layer colors',()=>{
 const palette={a:[1,2],b:[3,4]},p=bottlePlan({kind:'pending',ingredients:['b','a']},palette);
 assert.equal(p.fill,2);assert.equal(p.mode,1);assert.deepEqual(p.colors,[[3,4],[1,2]]);
});
test('unknown ingredient uses Java fallback, not a random color',()=>assert.deepEqual(bottlePlan({kind:'empty',ingredients:['unknown']}).colors,[FALLBACK_COLORS]));
test('pending fill clamps to eight ingredients',()=>assert.equal(bottlePlan({kind:'pending',ingredients:Array(12).fill('a')}).fill,8));
test('placed ingredient indices match held rows, preserving repeats and order',()=>{
 const ids=['kaleidoscope_grilling:dragon_egg_powder','kaleidoscope_grilling:green_chili_powder','kaleidoscope_grilling:houttuynia_powder','kaleidoscope_grilling:onion_powder','kaleidoscope_grilling:sichuan_pepper','kaleidoscope_grilling:totem_powder','minecraft:gunpowder','minecraft:redstone'];
 for(const kind of ['empty','pending']){
  assert.deepEqual(bottlePlan({kind,ingredients:ids}).layers,[1,2,3,4,5,6,7,8]);
  assert.deepEqual(bottlePlan({kind,ingredients:['minecraft:redstone','minecraft:gunpowder','minecraft:redstone']}).layers,[8,7,8,0,0,0,0,0]);
  assert.deepEqual(bottlePlan({kind,ingredients:['external:unknown','toString']}).layers,[9,9,0,0,0,0,0,0]);
 }
 assert.deepEqual(bottlePlan({kind:'special',uses:2,variant:5,ingredients:ids}).layers,Array(8).fill(0));
});
test('four different bottles retain independent fill and variant',()=>{
 const p=[{kind:'special',uses:0,variant:7},{kind:'special',uses:15,variant:3},{kind:'pending',ingredients:['a','b']},{kind:'empty',ingredients:[]}].map(x=>bottlePlan(x));
 assert.deepEqual(p.map(x=>x?.fill),[8,1,2,undefined]);assert.deepEqual(p.slice(0,2).map(x=>x.variant),[7,3]);
});
test('Java placements for four bottles are preserved',()=>assert.deepEqual(positions(4),[[4,5],[-3,4],[3.5,-3.25],[-4.25,-3.25]]));
test('single bottle is centered',()=>assert.deepEqual(positions(1),[[0,0]]));
test('empty/native-fat pot does not acquire a typed overlay',()=>{
 for(const state of [undefined,{type:'',count:256},{type:'canola',count:0},{type:'invalid',count:1}])assert.equal(oilPlan(state),undefined);
});
test('three oil kinds choose their own renderer states',()=>{
 assert.deepEqual(['canola','secret_chili','premium_chili'].map(type=>oilPlan({type,count:1})),[{oil:1},{oil:2},{oil:3}]);
});
test('negative-coordinate seasoning recovery',()=>assert.deepEqual(decodeKey('kaleidoscope_grilling:sb_minecraft_overworld_m15_p64_m22',['minecraft:overworld']),{dimensionId:'minecraft:overworld',location:{x:-15,y:64,z:-22}}));
test('oil recovery uses unchanged persisted namespace',()=>assert.deepEqual(decodeKey('kaleidoscope_grilling:a2736_oilpot_type_minecraft_nether_p1_m5_p0',['minecraft:overworld','minecraft:nether']),{dimensionId:'minecraft:nether',location:{x:1,y:-5,z:0}}));
test('unrelated or corrupt keys are ignored',()=>{
 for(const key of ['other:sb_minecraft_overworld_p0_p0_p0','kaleidoscope_grilling:sb_minecraft_overworld_p0_p0','kaleidoscope_grilling:sb_minecraft_overworld_pNaN_p0_p0'])assert.equal(decodeKey(key,['minecraft:overworld']),undefined);
});
test('string and numeric facing map consistently',()=>{
 for(const [dir,num,angle] of [['north',2,0],['east',5,90],['south',3,180],['west',4,270]]){
  assert.equal(rotationForStates({'minecraft:cardinal_direction':dir}),angle);
  assert.equal(rotationForStates({'minecraft:facing_direction':num}),angle);
 }
});
test('legacy and numbered seasoning IDs remain supported',()=>{
 for(const id of ['seasoning_bottle','seasoning_bottle_1','seasoning_bottle_2','seasoning_bottle_3','seasoning_bottle_4'])assert.equal(isSeasoningBlock('kaleidoscope_grilling:'+id),true);
 assert.equal(isSeasoningBlock('other:seasoning_bottle_1'),false);
});
console.log(`A2.7.70 visual data rules: ${n}/${n}; no Minecraft player simulation`);
