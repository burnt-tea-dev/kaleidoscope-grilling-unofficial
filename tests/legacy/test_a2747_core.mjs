import assert from 'node:assert/strict';
import {
 WEDDING_CANDY_ID,WEDDING_CANDY_EFFECT,WEDDING_CANDY_EFFECT_TICKS,WEDDING_CANDY_XP,WEDDING_CANDY_FOOD,
 shanghaiCalendar,isWeddingCandyEventDate,weddingCandyRequiredSeconds,weddingCandyRewardAmount,nextWeddingCandyProgress
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2747_wedding_candy_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Java item contract constants',()=>{
 assert.equal(WEDDING_CANDY_ID,'kaleidoscope_grilling:wedding_candy');
 assert.equal(WEDDING_CANDY_FOOD.nutrition,20);
 assert.equal(WEDDING_CANDY_FOOD.saturation,0.5);
 assert.equal(WEDDING_CANDY_FOOD.canAlwaysEat,true);
 assert.equal(WEDDING_CANDY_EFFECT,'invincible');
 assert.equal(WEDDING_CANDY_EFFECT_TICKS,300);
 assert.equal(WEDDING_CANDY_XP,50);
});

t('Shanghai calendar crosses UTC date at +08:00',()=>{
 assert.deepEqual(shanghaiCalendar(Date.parse('2026-09-01T15:59:59Z')),{year:2026,month:9,day:1});
 assert.deepEqual(shanghaiCalendar(Date.parse('2026-09-01T16:00:00Z')),{year:2026,month:9,day:2});
});

t('event window is exactly September 1 through 12 2026',()=>{
 assert.equal(isWeddingCandyEventDate({year:2026,month:8,day:31}),false);
 assert.equal(isWeddingCandyEventDate({year:2026,month:9,day:1}),true);
 assert.equal(isWeddingCandyEventDate({year:2026,month:9,day:12}),true);
 assert.equal(isWeddingCandyEventDate({year:2026,month:9,day:13}),false);
 assert.equal(isWeddingCandyEventDate({year:2027,month:9,day:1}),false);
});

t('reward amount and online threshold equal day of month',()=>{
 assert.equal(weddingCandyRewardAmount(7),7);
 assert.equal(weddingCandyRequiredSeconds(7),420);
 assert.equal(weddingCandyRewardAmount(12),12);
 assert.equal(weddingCandyRequiredSeconds(12),720);
});

t('progress resets per event date and grants once at threshold',()=>{
 const cal={year:2026,month:9,day:3};
 let s=nextWeddingCandyProgress({trackingDate:'2026-09-02',playSeconds:999,claimedDate:''},cal);
 assert.equal(s.playSeconds,1);assert.equal(s.grant,0);assert.equal(s.requiredSeconds,180);
 s=nextWeddingCandyProgress({...s,playSeconds:179},cal);
 assert.equal(s.playSeconds,180);assert.equal(s.grant,3);assert.equal(s.claimedDate,'2026-09-03');
 const after=nextWeddingCandyProgress(s,cal);
 assert.equal(after.grant,0);assert.equal(after.playSeconds,180);
});

t('outside event does not mutate or grant',()=>{
 const s=nextWeddingCandyProgress({trackingDate:'x',playSeconds:9,claimedDate:'y'},{year:2026,month:9,day:22});
 assert.equal(s.active,false);assert.equal(s.grant,0);assert.equal(s.playSeconds,9);
});

console.log('A2.7.47 Wedding Candy core: '+n+'/'+n);
