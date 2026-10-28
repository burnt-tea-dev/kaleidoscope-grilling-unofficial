import assert from 'node:assert/strict';
import {
 CROSSHAIR_HUD_POLL_TICKS,CROSSHAIR_HUD_MAX_DISTANCE,
 shouldPublishHud,normalizeHudResult,oilPotHudView
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/hud/crosshair_hud_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('shared HUD cadence is bounded',()=>{
 assert.equal(CROSSHAIR_HUD_POLL_TICKS,4);
 assert.equal(CROSSHAIR_HUD_MAX_DISTANCE,6);
});

t('generic provider result is namespaced and deduplicated by signature',()=>{
 const x=normalizeHudResult('oil',{signature:'a',message:{text:'x'}});
 assert.deepEqual(x,{signature:'oil|a',message:{text:'x'}});
 assert.equal(shouldPublishHud(undefined,x.signature),true);
 assert.equal(shouldPublishHud(x.signature,x.signature),false);
 assert.equal(shouldPublishHud(x.signature,'oil|b'),true);
});

t('empty Cookery pot matches Java empty HUD semantics',()=>{
 const v=oilPotHudView({type:'',count:0,capacity:256});
 assert.equal(v.kind,'empty');assert.equal(v.remaining,256);
 assert.equal(v.signature,'oil_pot:empty:0:256');
 assert.equal(v.message.rawtext[3].translate,'tooltip.kaleidoscope_grilling.oil_pot.empty');
 assert.deepEqual(v.message.rawtext[3].with,['0']);
});

t('native fat uses 256 capacity and fat translation',()=>{
 const v=oilPotHudView({type:'',count:37,capacity:256});
 assert.equal(v.kind,'fat');assert.equal(v.capacity,256);assert.equal(v.remaining,219);
 assert.equal(v.message.rawtext[3].translate,'tooltip.kaleidoscope_grilling.oil_pot.fat');
});

t('typed oils use 64 capacity and per-oil translation',()=>{
 for(const [type,key] of [
  ['canola','tooltip.kaleidoscope_grilling.oil_pot.canola'],
  ['secret_chili','tooltip.kaleidoscope_grilling.oil_pot.secret_chili'],
  ['premium_chili','tooltip.kaleidoscope_grilling.oil_pot.premium_chili']
 ]){
  const v=oilPotHudView({type,count:8,capacity:64});
  assert.equal(v.kind,type);assert.equal(v.capacity,64);assert.equal(v.remaining,56);
  assert.equal(v.message.rawtext[3].translate,key);
  assert.deepEqual(v.message.rawtext[5].with,['8','64','56']);
 }
});

t('signature changes when live amount changes',()=>{
 assert.notEqual(
  oilPotHudView({type:'canola',count:8,capacity:64}).signature,
  oilPotHudView({type:'canola',count:16,capacity:64}).signature
 );
});

console.log('A2.7.39 crosshair HUD core: '+n+'/'+n);
