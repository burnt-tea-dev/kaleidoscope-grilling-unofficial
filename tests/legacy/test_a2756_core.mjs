import assert from 'node:assert/strict';
import {
 EVENT_ADVANCEMENTS,REQUIRED_SEASONINGS,
 threadingCompletedForAdvancement,seasoningAdvancementIds,hotFoodAdvancementEligible
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2756_advancement_event_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('six event-driven Java advancements are declared',()=>{
 assert.deepEqual(Object.keys(EVENT_ADVANCEMENTS).sort(),[
  'eat_it_hot','gleaming_with_oil','looking_the_part','neat_and_orderly','three_flavors_base','world_in_a_bottle'
 ]);
 assert.equal(EVENT_ADVANCEMENTS.looking_the_part.xp,10);
 assert.equal(EVENT_ADVANCEMENTS.gleaming_with_oil.xp,10);
 assert.equal(EVENT_ADVANCEMENTS.three_flavors_base.xp,10);
 assert.equal(EVENT_ADVANCEMENTS.world_in_a_bottle.xp,25);
 assert.equal(EVENT_ADVANCEMENTS.eat_it_hot.xp,25);
 assert.equal(EVENT_ADVANCEMENTS.neat_and_orderly.xp,25);
});

t('threading awards only completed fixed or secret skewers',()=>{
 assert.equal(threadingCompletedForAdvancement({kind:'fixed'}),true);
 assert.equal(threadingCompletedForAdvancement({kind:'secret'}),true);
 assert.equal(threadingCompletedForAdvancement({kind:'continue'}),false);
 assert.equal(threadingCompletedForAdvancement(null),false);
});

t('three flavors requires all Java base seasonings',()=>{
 const [a,b,c]=REQUIRED_SEASONINGS;
 assert.deepEqual(seasoningAdvancementIds([a,b]),[]);
 assert.deepEqual(seasoningAdvancementIds([a,b,c]),['three_flavors_base']);
});

t('eight ingredients also awards world in a bottle',()=>{
 const list=[...REQUIRED_SEASONINGS,'minecraft:redstone','minecraft:gunpowder',
  'kaleidoscope_grilling:houttuynia_powder','kaleidoscope_grilling:totem_powder','kaleidoscope_grilling:dragon_egg_powder'];
 assert.deepEqual(seasoningAdvancementIds(list),['three_flavors_base','world_in_a_bottle']);
});

t('hot food advancement follows Java grilled/secret rule only',()=>{
 assert.equal(hotFoodAdvancementEligible('kaleidoscope_grilling:grilled_beef_skewer',true),true);
 assert.equal(hotFoodAdvancementEligible('kaleidoscope_grilling:secret_skewer',true),true);
 assert.equal(hotFoodAdvancementEligible('kaleidoscope_grilling:ordinary_skewer',true),false);
 assert.equal(hotFoodAdvancementEligible('kaleidoscope_grilling:grilled_beef_skewer',false),false);
});

t('metadata preserves Java parent/frame categories',()=>{
 assert.equal(EVENT_ADVANCEMENTS.looking_the_part.parent,'human_fireworks');
 assert.equal(EVENT_ADVANCEMENTS.gleaming_with_oil.parent,'looking_the_part');
 assert.equal(EVENT_ADVANCEMENTS.three_flavors_base.parent,'gleaming_with_oil');
 assert.equal(EVENT_ADVANCEMENTS.world_in_a_bottle.parent,'three_flavors_base');
 assert.equal(EVENT_ADVANCEMENTS.eat_it_hot.parent,'gleaming_with_oil');
 assert.equal(EVENT_ADVANCEMENTS.neat_and_orderly.parent,'better_write_it_down');
 assert.equal(EVENT_ADVANCEMENTS.world_in_a_bottle.frame,'goal');
});

console.log('A2.7.56 event advancement core: '+n+'/'+n);
