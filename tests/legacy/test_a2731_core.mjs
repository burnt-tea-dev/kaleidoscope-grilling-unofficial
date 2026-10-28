import assert from 'node:assert/strict';
import {farmlandCropTable,farmlandCropByKey} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/world/farmland_crop_host_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('host owns exactly the three ordinary farmland crops',()=>{
 const rows=farmlandCropTable();
 assert.equal(rows.length,3);
 assert.deepEqual(rows.map(x=>x.key),['canola','onion','sweet_potato']);
 assert.equal(rows.some(x=>x.cropId==='kaleidoscope_grilling:houttuynia_crop'),false);
});

t('component and block ids stay on the existing block contracts',()=>{
 const rows=farmlandCropTable();
 assert.deepEqual(rows.map(x=>x.componentId),[
  'kaleidoscope_grilling:canola_crop_logic',
  'kaleidoscope_grilling:onion_crop_logic',
  'kaleidoscope_grilling:sweet_potato_crop_logic'
 ]);
 assert.deepEqual(rows.map(x=>x.cropId),[
  'kaleidoscope_grilling:canola_crop',
  'kaleidoscope_grilling:onion_crop',
  'kaleidoscope_grilling:sweet_potato_crop'
 ]);
});

t('outputs and mature RNG draw counts preserve previous runtimes',()=>{
 const rows=farmlandCropTable();
 assert.deepEqual(rows.map(x=>[x.outputId,x.matureRandomDraws]),[
  ['kaleidoscope_grilling:canola_seeds',2],
  ['kaleidoscope_grilling:onion',2],
  ['kaleidoscope_grilling:sweet_potato',3]
 ]);
});

t('all common crops retain age 0..7 schema',()=>{
 for(const row of farmlandCropTable()){
  assert.equal(row.ageState,'kaleidoscope_grilling:age');
  assert.equal(row.maxAge,7);
 }
});

t('lookup returns defensive rows',()=>{
 const a=farmlandCropByKey('canola');assert.ok(a);a.outputId='broken';
 assert.equal(farmlandCropByKey('canola').outputId,'kaleidoscope_grilling:canola_seeds');
 assert.equal(farmlandCropByKey('missing'),undefined);
});

console.log('A2.7.31 farmland crop host core: '+n+'/'+n);
