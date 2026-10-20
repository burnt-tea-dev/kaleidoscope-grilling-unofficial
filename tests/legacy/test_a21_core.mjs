import assert from 'node:assert/strict';
import {initialState,normalizeState,light,brush,flip,season,tickState,canExtract} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/core_logic.js';
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
let s=light(initialState(),true);s=brush(s,3,1200).state;for(let i=0;i<4;i++){s=flip(s).state;if(i<3)s=tickState(s,3,20).state}
const ingredients=['kaleidoscope_grilling:green_chili_powder','kaleidoscope_grilling:sichuan_pepper','kaleidoscope_grilling:onion_powder','minecraft:redstone'];
s=season(s,3,ingredients).state;
t('seasoning payload survives grill state',()=>assert.deepEqual(s.seasonings,ingredients));
t('seasoned state is extractable',()=>assert.equal(canExtract(s),true));
const round=normalizeState(JSON.parse(JSON.stringify(s)));
t('seasoning payload survives JSON persistence',()=>assert.deepEqual(round,s));
const dirty=normalizeState({...s,seasonings:['minecraft:redstone','bad id',7,...Array(20).fill('minecraft:gunpowder')]});
t('normalizer validates and caps seasoning payload',()=>{assert.equal(dirty.seasonings.length,8);assert.ok(dirty.seasonings.every(x=>typeof x==='string'&&x.includes(':')))});
console.log(JSON.stringify({passed:n,failed:0,scope:'A2.1 grill seasoning-state persistence'}));
