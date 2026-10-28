import assert from 'node:assert/strict';
import {
 BOARD_ID,BEEF_ID,COOKERY_OFFAL_ID,BEEF_CHUNKS_ID,CUTS,OUTPUT_COUNT,
 stationKey,canonicalBeefState,classifyBoardState,overrideBuiltInBeefState,interactionDecision
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/recipe/beef_board_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('station key matches Cookery exact persistence key',()=>assert.equal(stationKey('minecraft:overworld',1,64,-3),'kc_station:minecraft:overworld:1,64,-3'));
t('canonical state matches Java result and Cookery shape',()=>assert.deepEqual(canonicalBeefState(),{input:BEEF_ID,cuts:0,max:4,result:{id:BEEF_CHUNKS_ID,count:2},extension:false}));
t('empty state classified empty',()=>assert.equal(classifyBoardState({}),'empty'));
t('Cookery built-in beef state detected',()=>assert.equal(classifyBoardState({input:BEEF_ID,cuts:3,max:4,result:{id:COOKERY_OFFAL_ID,count:2},extension:false}),'builtin_beef'));
t('canonical beef state detected',()=>assert.equal(classifyBoardState({input:BEEF_ID,cuts:4,max:4,result:{id:BEEF_CHUNKS_ID,count:2},extension:false}),'canonical_beef'));
t('unrelated occupied state preserved',()=>assert.equal(classifyBoardState({input:'minecraft:potato',cuts:0,max:4,result:{id:'x:y',count:1}}),'occupied'));
t('built-in migration changes only result contract',()=>{const src={input:BEEF_ID,cuts:2,max:4,result:{id:COOKERY_OFFAL_ID,count:2},extension:false,extra:7};const out=overrideBuiltInBeefState(src);assert.equal(out.result.id,BEEF_CHUNKS_ID);assert.equal(out.cuts,2);assert.equal(out.extra,7);assert.equal(src.result.id,COOKERY_OFFAL_ID)});
t('empty beef first interaction inserts',()=>assert.equal(interactionDecision({blockId:BOARD_ID,state:{},mainId:BEEF_ID,eventId:BEEF_ID,isFirstEvent:true}),'insert'));
t('held repeat on empty beef cancels without another insert',()=>assert.equal(interactionDecision({blockId:BOARD_ID,state:{},mainId:BEEF_ID,eventId:BEEF_ID,isFirstEvent:false}),'cancel'));
t('built-in in-progress state migrates on first interaction',()=>assert.equal(interactionDecision({blockId:BOARD_ID,state:{input:BEEF_ID,cuts:4,max:4,result:{id:COOKERY_OFFAL_ID,count:2}},mainId:'kaleidoscope_cookery:iron_kitchen_knife',eventId:'kaleidoscope_cookery:iron_kitchen_knife',isFirstEvent:true}),'migrate'));
t('canonical occupied board is left to Cookery',()=>assert.equal(interactionDecision({blockId:BOARD_ID,state:canonicalBeefState(),mainId:'kaleidoscope_cookery:iron_kitchen_knife',eventId:'kaleidoscope_cookery:iron_kitchen_knife',isFirstEvent:true}),'ignore'));
t('wrong target ignores',()=>assert.equal(interactionDecision({blockId:'minecraft:stone',state:{},mainId:BEEF_ID,eventId:BEEF_ID,isFirstEvent:true}),'ignore'));
assert.equal(CUTS,4);assert.equal(OUTPUT_COUNT,2);
console.log('A2.7.9 beef board core: '+n+'/'+n);
