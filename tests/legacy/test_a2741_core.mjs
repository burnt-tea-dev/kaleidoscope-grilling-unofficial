import assert from 'node:assert/strict';
import {PRESS_MAX_CAKES,PRESS_REQUIRED_PROGRESS,VAT_CAPACITY_BUCKETS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a26_oil_machine_core.js';
import {oilPressHudView} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2741_oil_press_hud_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('reuses A2.6 press constants',()=>{
 assert.equal(PRESS_MAX_CAKES,4);
 assert.equal(PRESS_REQUIRED_PROGRESS,16);
 assert.equal(VAT_CAPACITY_BUCKETS,8);
});

t('empty press with no vat',()=>{
 const v=oilPressHudView({cakes:0,progress:0,waiting:false},{status:'NO_CONTAINER'});
 assert.equal(v.cakes,0);assert.equal(v.progress,0);assert.equal(v.vatStatus,'NO_CONTAINER');
 assert.equal(v.message.rawtext.at(-1).translate,'hud.kaleidoscope_grilling.press.vat.none');
});

t('progress and ready vat are visible',()=>{
 const v=oilPressHudView({cakes:4,progress:9,waiting:false},{status:'SUCCESS',vat:{type:'canola',buckets:3}});
 assert.equal(v.cakes,4);assert.equal(v.progress,9);assert.equal(v.vatStatus,'SUCCESS');
 assert.deepEqual(v.message.rawtext.at(-1).with,['3','8']);
 assert.equal(v.message.rawtext.at(-1).translate,'hud.kaleidoscope_grilling.press.vat.found');
});

t('full vat reports capacity',()=>{
 const v=oilPressHudView({cakes:4,progress:15,waiting:true},{status:'FULL',vat:{type:'canola',buckets:6}});
 assert.equal(v.waiting,true);assert.equal(v.vatStatus,'FULL');
 assert.deepEqual(v.message.rawtext.at(-1).with,['6','8']);
 assert.equal(v.message.rawtext.at(-1).translate,'hud.kaleidoscope_grilling.press.vat.full');
});

t('incompatible vat preserves status',()=>{
 const v=oilPressHudView({cakes:4,progress:15,waiting:true},{status:'INCOMPATIBLE',vat:{type:'water',buckets:2}});
 assert.equal(v.vatStatus,'INCOMPATIBLE');
 assert.equal(v.message.rawtext.at(-1).translate,'hud.kaleidoscope_grilling.press.vat.wrong');
});

t('state or container change refreshes signature',()=>{
 const a=oilPressHudView({cakes:2,progress:0},{status:'NO_CONTAINER'});
 const b=oilPressHudView({cakes:3,progress:0},{status:'NO_CONTAINER'});
 const c=oilPressHudView({cakes:3,progress:0},{status:'SUCCESS',vat:{buckets:0}});
 assert.notEqual(a.signature,b.signature);assert.notEqual(b.signature,c.signature);
});

console.log('A2.7.41 oil press HUD core: '+n+'/'+n);
