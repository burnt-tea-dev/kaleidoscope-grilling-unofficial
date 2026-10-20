import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a26_oil_machine_core.js';
import {createOilPressRegistry} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/oil_press_registry.js';
const N='kaleidoscope_grilling:';

test('legacy registry migration is resumable when a write fails',()=>{
 const dp=new Map([[N+'a26_press_registry',JSON.stringify([{d:'minecraft:overworld',x:1,y:2,z:3},{d:'minecraft:overworld',x:2,y:2,z:3}])]]);let fail=true;
 const world={getDynamicProperty:k=>dp.get(k),getDynamicPropertyIds:()=>[...dp.keys()],setDynamicProperty(k,v){if(fail&&k.endsWith('%7C2%7C2%7C3'))throw Error('migration failure');if(v===undefined)dp.delete(k);else dp.set(k,v);}};
 assert.throws(()=>createOilPressRegistry(world,N+'a26_press_registry').rows());assert.ok(dp.has(N+'a26_press_registry'));fail=false;assert.equal(createOilPressRegistry(world,N+'a26_press_registry').rows().length,2);assert.equal(dp.has(N+'a26_press_registry'),false);
});
test('press stones accept the native addon tag and preserve anvil precedence',()=>{
 assert.equal(core.toolProgress('addon:stone',['kaleidoscope_grilling:press_stones']),1);
 assert.equal(core.toolProgress('minecraft:anvil',['kaleidoscope_grilling:press_stones']),4);
 assert.equal(core.toolProgress('addon:stone',[]),0);
});
