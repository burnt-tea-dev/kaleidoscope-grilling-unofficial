import assert from 'node:assert/strict';
import {initialState,FINISHED_TICKS,BURNT_TICKS,REQUIRED_FLIPS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/core_logic.js';
import {GRILL_HUD_TIMER_STEP,grillHudStatusKey,grillHudView} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2740_grill_hud_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Java timing and flip contract is shared',()=>{
 assert.equal(FINISHED_TICKS,800);
 assert.equal(BURNT_TICKS,400);
 assert.equal(REQUIRED_FLIPS,4);
 assert.equal(GRILL_HUD_TIMER_STEP,20);
});

t('unlit grill reports heat requirement before empty state',()=>{
 const s=initialState();
 assert.equal(grillHudStatusKey(s,0),'jade.kaleidoscope_grilling.grill.need_heat');
 assert.equal(grillHudStatusKey(s,2),'jade.kaleidoscope_grilling.grill.need_heat');
});

t('lit empty grill reports empty',()=>{
 const s={...initialState(),lit:true};
 assert.equal(grillHudStatusKey(s,0),'jade.kaleidoscope_grilling.grill.empty');
});

t('phase zero requires oil',()=>{
 const s={...initialState(),lit:true};
 assert.equal(grillHudStatusKey(s,2),'jade.kaleidoscope_grilling.grill.need_oil');
});

t('phase one distinguishes flip cooldown and parameterizes both flip messages',()=>{
 let s={...initialState(),lit:true,phase:1,flipCooldown:7,flips:2};
 let v=grillHudView(s,2);
 assert.equal(v.status,'jade.kaleidoscope_grilling.grill.flipping');
 assert.deepEqual(v.message.rawtext[3].with,['2','4']);
 s={...s,flipCooldown:0};
 v=grillHudView(s,2);
 assert.equal(v.status,'jade.kaleidoscope_grilling.grill.need_flip');
 assert.deepEqual(v.message.rawtext[3].with,['2','4']);
});

t('phase two distinguishes seasoning and ready',()=>{
 let s={...initialState(),lit:true,phase:2,flips:4,seasoned:false};
 assert.equal(grillHudStatusKey(s,3),'jade.kaleidoscope_grilling.grill.need_seasoning');
 s={...s,seasoned:true};
 // Java Jade statusKey uses this key; the message key is a separate interaction channel.
 // https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/compat/jade/GrillProvider.java#L37-L49
 assert.equal(grillHudStatusKey(s,3),'jade.kaleidoscope_grilling.grill.ready');
});

t('phase three is burning and uses 400 tick timer',()=>{
 const s={...initialState(),lit:true,phase:3,phaseTicks:111,flips:4};
 const v=grillHudView(s,1);
 assert.equal(v.status,'jade.kaleidoscope_grilling.grill.burning');
 assert.equal(v.max,400);
 assert.equal(v.shownTicks,100);
});

t('timer is sampled once per second to avoid actionbar spam',()=>{
 const base={...initialState(),lit:true,phase:1,flips:1};
 const a=grillHudView({...base,phaseTicks:101},2);
 const b=grillHudView({...base,phaseTicks:119},2);
 const c=grillHudView({...base,phaseTicks:120},2);
 assert.equal(a.shownTicks,100);assert.equal(b.shownTicks,100);assert.equal(c.shownTicks,120);
 assert.equal(a.signature,b.signature);assert.notEqual(b.signature,c.signature);
});

t('flip and seasoning changes refresh immediately',()=>{
 const base={...initialState(),lit:true,phase:2,phaseTicks:100,flips:4};
 const a=grillHudView({...base,seasoned:false},3);
 const b=grillHudView({...base,seasoned:true},3);
 assert.notEqual(a.signature,b.signature);
 assert.equal(b.message.rawtext[1].translate,'hud.kaleidoscope_grilling.grill.title');
});

console.log('A2.7.40 grill HUD core: '+n+'/'+n);
