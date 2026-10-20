import assert from 'node:assert/strict';
import {VAT_CAPACITY_BUCKETS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a26_oil_machine_core.js';
import {bigVatContentKey,bigVatHudView} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2742_big_vat_hud_core.js';
import {grillHudStatusKey,grillHudView} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2740_grill_hud_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('reuses A2.6 vat capacity',()=>{
 assert.equal(VAT_CAPACITY_BUCKETS,8);
});

t('empty vat uses empty content key',()=>{
 const v=bigVatHudView({});
 assert.equal(v.type,'');
 assert.equal(v.buckets,0);
 assert.equal(v.capacity,8);
 assert.equal(v.message.rawtext[3].translate,'hud.kaleidoscope_grilling.vat.content.empty');
});

t('all Bedrock A2.6 fluid types resolve to dedicated content keys',()=>{
 for(const type of ['water','lava','canola','secret_chili','premium_chili']){
  const v=bigVatHudView({type,buckets:3});
  assert.equal(v.type,type);
  assert.equal(v.message.rawtext[3].translate,bigVatContentKey(type));
  assert.deepEqual(v.message.rawtext[5].with,['3','8']);
 }
});

t('invalid content normalizes back to empty',()=>{
 const v=bigVatHudView({type:'not_real',buckets:8});
 assert.equal(v.type,'');
 assert.equal(v.buckets,0);
 assert.equal(v.message.rawtext[3].translate,'hud.kaleidoscope_grilling.vat.content.empty');
});

t('amount changes refresh signature',()=>{
 const a=bigVatHudView({type:'canola',buckets:1});
 const b=bigVatHudView({type:'canola',buckets:2});
 assert.notEqual(a.signature,b.signature);
});

t('type changes refresh signature',()=>{
 const a=bigVatHudView({type:'water',buckets:2});
 const b=bigVatHudView({type:'lava',buckets:2});
 assert.notEqual(a.signature,b.signature);
});

t('Grill ready keeps Jade state but renders Machine HUD ready text',()=>{
 const state={phase:2,phaseTicks:120,flips:4,flipCooldown:0,seasoned:true,failed:false,heatTicks:1200,lit:true,seasonings:[]};
 assert.equal(grillHudStatusKey(state,2),'jade.kaleidoscope_grilling.grill.ready');
 const v=grillHudView(state,2);
 assert.equal(v.status,'jade.kaleidoscope_grilling.grill.ready');
 assert.equal(v.message.rawtext[3].translate,'message.kaleidoscope_grilling.grill_ready_to_take');
});

console.log('A2.7.42 Big Vat HUD core: '+n+'/'+n);
