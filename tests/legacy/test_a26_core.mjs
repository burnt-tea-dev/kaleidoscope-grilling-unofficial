import assert from 'node:assert/strict';
import {
 PRESS_MAX_CAKES,PRESS_REQUIRED_PROGRESS,PRESS_ANVIL_PROGRESS,PRESS_STONE_PROGRESS,PRESS_COOLDOWN_TICKS,
 PRESS_IMPACT_TICK,PRESS_COMPLETION_DELAY,PRESS_OUTPUT_BUCKETS,VAT_CAPACITY_BUCKETS,
 toolProgress,pressVisualStage,pressAddCake,impactPress,finishPressTransfer,
 normalizeVat,vatVisualLevel,vatInsert,vatExtract,potFillPlan,nearbyOffsets
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/oil/oil_machine_core.js';
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Java press constants',()=>{assert.equal(PRESS_MAX_CAKES,4);assert.equal(PRESS_REQUIRED_PROGRESS,16);assert.equal(PRESS_ANVIL_PROGRESS,4);assert.equal(PRESS_STONE_PROGRESS,1);assert.equal(PRESS_COOLDOWN_TICKS,10);assert.equal(PRESS_IMPACT_TICK,6);assert.equal(PRESS_COMPLETION_DELAY,10);assert.equal(PRESS_OUTPUT_BUCKETS,4)});
t('Java press stone tag and anvils',()=>{for(const id of ['minecraft:stone','minecraft:cobblestone','minecraft:deepslate','minecraft:cobbled_deepslate','minecraft:blackstone'])assert.equal(toolProgress(id),1);for(const id of ['minecraft:anvil','minecraft:chipped_anvil','minecraft:damaged_anvil'])assert.equal(toolProgress(id),4);assert.equal(toolProgress('minecraft:dirt'),0)});
t('press needs exactly four cakes',()=>{assert.equal(impactPress({cakes:3,progress:0},4).ok,false);assert.equal(impactPress({cakes:4,progress:0},4).ok,true)});
t('press clamps fifth cake',()=>{let s={};for(let i=0;i<4;i++){const x=pressAddCake(s);assert.equal(x.ok,true);s=x.state}assert.equal(pressAddCake(s).ok,false)});
t('progress stages mirror Java visualStage',()=>{assert.deepEqual([0,1,4,5,8,9,12,13,16].map(pressVisualStage),[0,1,1,2,2,3,3,4,4])});
t('four anvil impacts complete the batch',()=>{let s={cakes:4,progress:0};for(let i=0;i<4;i++)s=impactPress(s,4).state;assert.equal(s.progress,16);assert.equal(s.completionDelay,10)});
t('sixteen stone impacts complete the batch',()=>{let s={cakes:4,progress:0};for(let i=0;i<16;i++)s=impactPress(s,1).state;assert.equal(s.progress,16)});
t('successful transfer outputs four buckets and four residue',()=>{const x=finishPressTransfer({cakes:4,progress:16},'SUCCESS');assert.equal(x.ok,true);assert.equal(x.oilBuckets,4);assert.equal(x.residue,4);assert.deepEqual(x.state,{cakes:0,progress:0,waiting:false,completionDelay:0})});
t('failed transfer backs down to 15 and waits',()=>{for(const reason of ['NO_CONTAINER','FULL','INCOMPATIBLE']){const x=finishPressTransfer({cakes:4,progress:16},reason);assert.equal(x.ok,false);assert.equal(x.state.progress,15);assert.equal(x.state.waiting,true)}});
t('vat is eight buckets single-fluid',()=>{assert.equal(VAT_CAPACITY_BUCKETS,8);let v={};for(let i=0;i<8;i++){const x=vatInsert(v,'canola',1);assert.equal(x.ok,true);v=x.state}assert.equal(v.buckets,8);assert.equal(vatInsert(v,'canola',1).ok,false);assert.equal(vatInsert(v,'water',1).ok,false)});
t('vat visual renderer has Java four fill heights',()=>{assert.deepEqual([0,1,2,3,4,5,6,7,8].map(vatVisualLevel),[0,1,1,2,2,3,3,4,4])});
t('vat empties and clears fluid type',()=>{const x=vatExtract({type:'lava',buckets:1},'lava',1);assert.deepEqual(x.state,{type:'',buckets:0})});
t('oil pot drains whole vat buckets in eight-point units',()=>{const p=potFillPlan({type:'canola',buckets:5},'',0);assert.deepEqual(p,{ok:true,type:'canola',buckets:5,points:40,nextCount:40});const q=potFillPlan({type:'canola',buckets:5},'canola',56);assert.equal(q.buckets,1);assert.equal(q.nextCount,64)});
t('oil pot rejects mixed type and non-oil vat',()=>{assert.equal(potFillPlan({type:'secret_chili',buckets:2},'canola',8).ok,false);assert.equal(potFillPlan({type:'water',buckets:2},'',0).ok,false)});
t('nearby scan exactly covers Java +/-4 +/-2 +/-4 box',()=>{const a=nearbyOffsets();assert.equal(a.length,9*5*9);assert.ok(a.some(x=>x.x===-4&&x.y===-2&&x.z===-4));assert.ok(a.some(x=>x.x===4&&x.y===2&&x.z===4))});

console.log(JSON.stringify({passed:n,failed:0,scope:'A2.6 Oil Press + Big Vat Java parity core'}));
