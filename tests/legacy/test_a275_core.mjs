import assert from 'node:assert/strict';
import {VANILLA_SHOVELS,COOKERY_EXTINGUISH_TOOLS,isExtinguishTool,isInitialBlockPress,nextDurability} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a275_grill_input_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('all six vanilla shovels extinguish',()=>{assert.equal(VANILLA_SHOVELS.length,6);for(const id of VANILLA_SHOVELS)assert.equal(isExtinguishTool(id),true)});
t('Cookery kitchen shovel extinguishes',()=>assert.equal(isExtinguishTool('kaleidoscope_cookery:kitchen_shovel'),true));
t('Bedrock Cookery oiled shovel alias extinguishes',()=>assert.equal(isExtinguishTool('kaleidoscope_cookery:oiled_kitchen_shovel'),true));
t('non-shovel does not extinguish',()=>assert.equal(isExtinguishTool('minecraft:diamond_pickaxe'),false));
t('initial interaction is dispatched',()=>assert.equal(isInitialBlockPress(true),true));
t('held repeat interaction is suppressed',()=>assert.equal(isInitialBlockPress(false),false));
t('undefined first-event stays backwards-compatible',()=>assert.equal(isInitialBlockPress(undefined),true));
t('durability increments by one',()=>assert.deepEqual(nextDurability(3,64,1,false),{broken:false,damage:4}));
t('durability breaks exactly at max',()=>assert.deepEqual(nextDurability(63,64,1,false),{broken:true,damage:64}));
t('unbreakable durability is untouched',()=>assert.deepEqual(nextDurability(63,64,1,true),{broken:false,damage:63}));
console.log('A2.7.5 grill input core: '+n+'/'+n);
