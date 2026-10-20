import assert from 'node:assert/strict';
import {
 COW_ID,SQUID_ID,RAW_COW_OFFAL_ID,SQUID_TENTACLE_ID,SQUID_DROP_CHANCE,
 cowOffalDropCount,squidTentacleDropCount,squidTentacleShouldDrop
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2712_remaining_knife_drops_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('entity and item ids stay exact',()=>{
 assert.equal(COW_ID,'minecraft:cow');
 assert.equal(SQUID_ID,'minecraft:squid');
 assert.equal(RAW_COW_OFFAL_ID,'kaleidoscope_cookery:raw_cow_offal');
 assert.equal(SQUID_TENTACLE_ID,'kaleidoscope_grilling:squid_tentacle');
});
t('squid chance stays Java 50 percent',()=>assert.equal(SQUID_DROP_CHANCE,0.5));
t('cow no-looting count is Java 1..2',()=>{
 assert.equal(cowOffalDropCount(0,0,0),1);
 assert.equal(cowOffalDropCount(.999,0,0),2);
});
t('cow Looting bonus is inclusive 0..level',()=>{
 assert.equal(cowOffalDropCount(0,0,3),1);
 assert.equal(cowOffalDropCount(.999,.999,3),5);
});
t('squid no-looting count is Java 2..3',()=>{
 assert.equal(squidTentacleDropCount(0,0,0),2);
 assert.equal(squidTentacleDropCount(.999,0,0),3);
});
t('squid Looting bonus is inclusive 0..level',()=>{
 assert.equal(squidTentacleDropCount(0,0,3),2);
 assert.equal(squidTentacleDropCount(.999,.999,3),6);
});
t('squid chance boundary is strict below 0.5',()=>{
 assert.equal(squidTentacleShouldDrop(0),true);
 assert.equal(squidTentacleShouldDrop(.499999),true);
 assert.equal(squidTentacleShouldDrop(.5),false);
 assert.equal(squidTentacleShouldDrop(.999),false);
});
console.log('A2.7.12 remaining knife drops core: '+n+'/'+n);
