// Pure lore-value regression. No game, player, world, or interaction simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {seasoningLore} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/localized_lore_core.js';
import {replaceSeasoningUsesLore,isOwnedSeasoningUsesLore,bottleLoreSignature} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/bottle_lore_core.js';
const KEY='tooltip.kaleidoscope_grilling.seasoning.uses';
const ING='tooltip.kaleidoscope_grilling.seasoning.ingredients';
const wrap=x=>({rawtext:[x]});
const translated={translate:KEY,with:['16','16']};
const ingredients={translate:ING,with:['8','8']};
const own=lines=>lines.filter(isOwnedSeasoningUsesLore);
const legacy=(lines,remaining)=>{
 const filtered=lines.filter(x=>typeof x!=='string'||!x.startsWith('§7Uses:'));
 filtered.unshift('§7Uses: '+remaining+'/16');return filtered;
};
for(const [name,row] of [
 ['plain translation',translated],
 ['rawtext translation',wrap(translated)],
 ['nested translation',wrap(wrap(translated))],
 ['translation raw arguments',{translate:KEY,with:{rawtext:[{text:'16'},{text:'16'}]}}],
 ['legacy literal','§7Uses: 16/16'],
 ['legacy text',{text:'§7Uses: 16/16'}],
 ['legacy rawtext',wrap({text:'§7Uses: 16/16'})],
 ['legacy nested rawtext',wrap(wrap({text:'§7Uses: 16/16'}))]
])test(name+' replaces prior Uses with one localized current line',()=>{
 assert.deepEqual(replaceSeasoningUsesLore([row,ingredients],15),[...seasoningLore(15),ingredients]);
});
test('Repair all previously accumulated known Uses forms in one pass',()=>{
 const rows=[translated,'§7Uses: 15/16',wrap({text:'§7Uses: 14/16'}),{text:'§7Uses: 13/16'},ingredients];
 assert.deepEqual(replaceSeasoningUsesLore(rows,12),[...seasoningLore(12),ingredients]);
});
test('Do not erase custom or mixed RawMessages, ingredient count, or unknown keys',()=>{
 const custom=['my note','Uses: custom label','§7Uses: 99/16',{text:'§7Uses: 15/16',custom:true},
  {translate:'custom:uses',with:['16']},{translate:KEY,with:['16','16'],custom:true},
  {rawtext:[{text:'§7Uses: 15/16'},{text:' personal note'}]},
  {rawtext:[{text:'custom: '},translated]},ingredients];
 const before=structuredClone(custom),next=replaceSeasoningUsesLore([translated,...custom],15);
 assert.deepEqual(next,[...seasoningLore(15),...custom]);assert.deepEqual(custom,before);
 for(let i=0;i<custom.length;i++)assert.strictEqual(next[i+1],custom[i]);
});
test('Old source accumulates wrapped English rows, candidate remains one through remaining 15..1',()=>{
 let broken=[translated,ingredients],fixed=[translated,ingredients];
 // This is a serialization-form case, not a claim every engine version does it.
 const nativeShape=rows=>rows.map(x=>typeof x==='string'?wrap({text:x}):wrap(x));
 for(let n=15;n>=1;n--){
  broken=legacy(nativeShape(broken),n);fixed=replaceSeasoningUsesLore(nativeShape(fixed),n);
  assert.equal(own(fixed).length,1);assert.deepEqual(own(fixed)[0],seasoningLore(n)[0]);
  assert.equal(fixed.length,2);assert.equal(bottleLoreSignature(fixed),bottleLoreSignature(seasoningLore(n,8)));
 }
 assert.equal(own(broken).length,16);assert.equal(broken.length,17);
});
test('Both 3/8 and 8/8 counts stay unchanged and repeated same value is idempotent',()=>{
 for(const count of [3,8])for(const n of [16,15,14,8,2,1]){
  const before=seasoningLore(16,count),once=replaceSeasoningUsesLore(before,n),twice=replaceSeasoningUsesLore(once,n);
  assert.deepEqual(once,seasoningLore(n,count));assert.deepEqual(twice,once);assert.deepEqual(before,seasoningLore(16,count));
 }
});
test('Runtime wiring uses raw visible lore helper; empty-replacement and transaction remain',()=>{
 const c=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/a2750_cookery_cuisine_runtime.js',import.meta.url),'utf8');
 assert.ok(c.includes("import {replaceSeasoningUsesLore} from './bottle_lore_core.js';"));
 assert.ok(c.includes('getItemRawLore,setItemLore'));
 assert.ok(c.includes('setItemLore(next,replaceSeasoningUsesLore(getItemRawLore(next),SEASONING_MAX_USES-plan.nextUses));'));
 assert.ok(c.includes('if(!plan.replaceEmpty)try{'));
 assert.ok(c.includes('next=plan.replaceEmpty?new ItemStack(EMPTY_SEASONING_ID,1):retargetSpecialSeasoningStack(held,plan.nextUses,specialSeasoningVariant(held));'));
 assert.ok(c.includes('const result=commitTwoParty('));assert.ok(!c.includes("lore.unshift('§7Uses:"));
});
