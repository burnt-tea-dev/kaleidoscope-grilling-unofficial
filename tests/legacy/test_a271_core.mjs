import assert from 'node:assert/strict';
import {POWDER_ID,SHEET_ID,KNEAD_TICKS,KNEAD_SECONDS,CHOPPING_BOARD_CUTS,normalizedStackAmount,kneadResult} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food/sweet_potato_core.js';

assert.equal(KNEAD_TICKS,30);
assert.equal(KNEAD_SECONDS,1.5);
assert.equal(CHOPPING_BOARD_CUTS,4);
assert.equal(normalizedStackAmount(0),1);
assert.equal(normalizedStackAmount(64),64);
assert.equal(normalizedStackAmount(99),64);
assert.equal(kneadResult('minecraft:dirt',3,30),null);
assert.equal(kneadResult(POWDER_ID,3,29),null);
assert.deepEqual(kneadResult(POWDER_ID,1,30),{id:SHEET_ID,amount:1});
assert.deepEqual(kneadResult(POWDER_ID,37,30),{id:SHEET_ID,amount:37});
assert.deepEqual(kneadResult(POWDER_ID,64,40),{id:SHEET_ID,amount:64});
console.log('A2.7.1 sweet-potato core: 11/11');
