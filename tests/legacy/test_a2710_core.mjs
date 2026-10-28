import assert from 'node:assert/strict';
import {
 BOARD_ID,CHICKEN_ID,CHICKEN_SKIN_ID,CHICKEN_WING_ID,RAW_SMALL_MEATS_ID,CUTS,KITCHEN_KNIVES,
 isKitchenKnife,stationKey,chickenSkinCompletionCandidate,chickenBoardCompletionCommitted,
 chickenSkinDropCount,chickenWingDropCount
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/world/chicken_acquisition_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
const done={input:CHICKEN_ID,cuts:4,max:4,result:{id:RAW_SMALL_MEATS_ID,count:2},extension:false};

t('constants stay exact',()=>{assert.equal(BOARD_ID,'kaleidoscope_cookery:chopping_board');assert.equal(CHICKEN_SKIN_ID,'kaleidoscope_grilling:chicken_skin');assert.equal(CHICKEN_WING_ID,'kaleidoscope_grilling:chicken_wing');assert.equal(CUTS,4)});
t('Cookery 1.0.6 knife set stays exact',()=>assert.deepEqual([...KITCHEN_KNIVES],['kaleidoscope_cookery:iron_kitchen_knife','kaleidoscope_cookery:gold_kitchen_knife','kaleidoscope_cookery:diamond_kitchen_knife','kaleidoscope_cookery:netherite_kitchen_knife']));
t('knife predicate rejects vanilla sword',()=>{assert.equal(isKitchenKnife('kaleidoscope_cookery:diamond_kitchen_knife'),true);assert.equal(isKitchenKnife('minecraft:diamond_sword'),false)});
t('station key matches Cookery persistence',()=>assert.equal(stationKey('minecraft:overworld',4,70,-2),'kc_station:minecraft:overworld:4,70,-2'));
t('skin candidate requires completed chicken board and knife',()=>assert.equal(chickenSkinCompletionCandidate(done,KITCHEN_KNIVES[0],true),true));
t('skin candidate rejects pre-final cut',()=>assert.equal(chickenSkinCompletionCandidate({...done,cuts:3},KITCHEN_KNIVES[0],true),false));
t('skin candidate rejects hold-repeat',()=>assert.equal(chickenSkinCompletionCandidate(done,KITCHEN_KNIVES[0],false),false));
t('skin candidate rejects wrong board result',()=>assert.equal(chickenSkinCompletionCandidate({...done,result:{id:'x:y',count:2}},KITCHEN_KNIVES[0],true),false));
t('cleared board means completion committed',()=>assert.equal(chickenBoardCompletionCommitted(done,{}),true));
t('refilled chicken with lower cut count still means prior completion committed',()=>assert.equal(chickenBoardCompletionCommitted(done,{...done,cuts:0}),true));
t('unchanged completed board means no commit',()=>assert.equal(chickenBoardCompletionCommitted(done,{...done}),false));
t('skin count is Java 1..3',()=>{assert.equal(chickenSkinDropCount(0),1);assert.equal(chickenSkinDropCount(.34),2);assert.equal(chickenSkinDropCount(.999),3)});
t('wing no-looting is Java 1..2',()=>{assert.equal(chickenWingDropCount(0,0,0),1);assert.equal(chickenWingDropCount(.999,0,0),2)});
t('Looting adds inclusive 0..level bonus',()=>{assert.equal(chickenWingDropCount(0,0,3),1);assert.equal(chickenWingDropCount(.999,.999,3),5)});
console.log('A2.7.10 chicken acquisition core: '+n+'/'+n);
