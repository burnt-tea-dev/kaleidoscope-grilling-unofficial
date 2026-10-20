import assert from 'node:assert/strict';
import {PLATE_CAPACITY} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a25_plate_recipe_core.js';
import {skewerPlateHudView} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2744_skewer_plate_hud_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('reuses A2.5 plate capacity',()=>{
 assert.equal(PLATE_CAPACITY,5);
});

t('empty plate shows Java Jade empty state',()=>{
 const v=skewerPlateHudView([]);
 assert.equal(v.count,0);
 assert.equal(v.capacity,5);
 assert.equal(v.state,'empty');
 assert.equal(v.message.rawtext[3].translate,'jade.kaleidoscope_grilling.skewer_plate.empty');
 assert.equal(v.message.rawtext.some(x=>x.translate==='jade.kaleidoscope_grilling.skewer_plate.pack'),false);
});

t('non-empty plate shows take and pack state',()=>{
 const v=skewerPlateHudView([{id:'kaleidoscope_grilling:ordinary_skewer'}]);
 assert.equal(v.count,1);
 assert.equal(v.state,'take');
 assert.equal(v.message.rawtext[3].translate,'jade.kaleidoscope_grilling.skewer_plate.take');
 assert.equal(v.message.rawtext.at(-1).translate,'jade.kaleidoscope_grilling.skewer_plate.pack');
 assert.deepEqual(v.message.rawtext[1].with,['1','5']);
});

t('capacity clamps through existing A2.5 normalizer',()=>{
 const rows=Array.from({length:9},(_,i)=>({id:'test:item_'+i}));
 const v=skewerPlateHudView(rows);
 assert.equal(v.count,5);
 assert.deepEqual(v.message.rawtext[1].with,['5','5']);
});

t('same count but different contents refreshes signature',()=>{
 const a=skewerPlateHudView([{id:'test:a'},{id:'test:b'}]);
 const b=skewerPlateHudView([{id:'test:a'},{id:'test:c'}]);
 assert.notEqual(a.signature,b.signature);
});

console.log('A2.7.44 Skewer Plate HUD core: '+n+'/'+n);
