import assert from 'node:assert/strict';
import {chooseInteractionHand,makeIntent,intentMatches} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a276_grill_intent_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
const E={empty:true,id:null,sig:null};
const M={empty:false,id:'minecraft:flint_and_steel',sig:'main-flint'};
const O={empty:false,id:'kaleidoscope_cookery:oil_pot_filled',sig:'off-oil'};

t('exact main event resolves main',()=>assert.equal(chooseInteractionHand(M,M,O),'main'));
t('exact off event resolves off',()=>assert.equal(chooseInteractionHand(O,M,O),'off'));
t('empty event with empty main resolves main',()=>assert.equal(chooseInteractionHand(E,E,O),'main'));
t('empty event with occupied main and empty off resolves off',()=>assert.equal(chooseInteractionHand(E,M,E),'off'));
t('same item in both hands is deterministic main fallback',()=>{
 const a={empty:false,id:'minecraft:stone_shovel',sig:'same'};
 assert.equal(chooseInteractionHand(a,a,a),'main');
});
t('type-only unique off fallback works',()=>{
 const e={empty:false,id:'x:item',sig:'event-copy'},m={empty:false,id:'y:item',sig:'m'},o={empty:false,id:'x:item',sig:'o'};
 assert.equal(chooseInteractionHand(e,m,o),'off');
});
t('main intent survives exact same slot/signature',()=>assert.equal(intentMatches(makeIntent('main','abc',4),'abc','off',4),true));
t('main intent aborts when selected slot changes',()=>assert.equal(intentMatches(makeIntent('main','abc',4),'abc','off',5),false));
t('main intent aborts when stack changes',()=>assert.equal(intentMatches(makeIntent('main','abc',4),'def','off',4),false));
t('offhand intent ignores main selected-slot changes',()=>assert.equal(intentMatches(makeIntent('off','xyz',4),'whatever','xyz',8),true));
t('offhand intent aborts when offhand changes',()=>assert.equal(intentMatches(makeIntent('off','xyz',4),'whatever','changed',4),false));
console.log('A2.7.6 grill intent core: '+n+'/'+n);
