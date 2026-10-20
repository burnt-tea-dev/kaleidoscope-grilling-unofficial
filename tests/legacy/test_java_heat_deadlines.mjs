import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bucketHotUntil} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/food_api_core.js';
const oracle=JSON.parse(fs.readFileSync(new URL('./fixtures/java-heat-deadlines.json',import.meta.url)));

test('all new heat deadlines match executed author Java bucket vectors',()=>{
 for(const v of oracle.vectors)assert.equal(bucketHotUntil(v.until),v.expected);
 for(const invalid of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>bucketHotUntil(invalid));
});
