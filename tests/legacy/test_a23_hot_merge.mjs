import assert from 'node:assert/strict';
import {NORMAL_HEAT_WINDOW,weightedHeat,normalHeatCompatible,compactGroups} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer/hot_merge.js';
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('weighted heat matches Java count average',()=>assert.equal(weightedHeat(1200,2,600,1),1000));
t('normal hot window is five minutes',()=>{assert.equal(NORMAL_HEAT_WINDOW,6000);assert.equal(normalHeatCompatible({hot:true,remaining:10000},{hot:true,remaining:4000}),true);assert.equal(normalHeatCompatible({hot:true,remaining:10001},{hot:true,remaining:4000}),false)});
t('normal never mixes hot and cold',()=>assert.equal(normalHeatCompatible({hot:true,remaining:100},{hot:false,remaining:0}),false));
t('normal compaction averages compatible heat and caps 64',()=>{const out=compactGroups([{key:'x',count:40,hot:true,remaining:1200},{key:'x',count:40,hot:true,remaining:600}],false,64);assert.deepEqual(out,[{key:'x',count:64,hot:true,remaining:900},{key:'x',count:16,hot:true,remaining:900}])});
t('full sort can combine hot and cold like Java refrigerator full sort',()=>{const out=compactGroups([{key:'x',count:1,hot:true,remaining:1000},{key:'x',count:1,hot:false,remaining:0}],true,64);assert.deepEqual(out,[{key:'x',count:2,hot:true,remaining:500}])});
console.log(JSON.stringify({passed:n,failed:0,scope:'pure Java HotFoodMerge/RefrigeratorSkewerSorter heat arithmetic'}));
