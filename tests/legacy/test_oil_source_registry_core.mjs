import assert from 'node:assert/strict';
import {
 LEGACY_OIL_REG,OIL_REG_PREFIX,FLOW_CELL_BUDGET,FLOW_SOURCE_BUDGET,
 oilPosKey,oilSourcePropertyId,normalizeOilSourceRow
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/oil_source_registry_core.js';

assert.equal(LEGACY_OIL_REG,'kaleidoscope_grilling:a23_oil_sources');
assert(OIL_REG_PREFIX.startsWith('kaleidoscope_grilling:'));
assert.equal(FLOW_CELL_BUDGET,512);assert.equal(FLOW_SOURCE_BUDGET,8);
const ids=new Set();
for(let i=0;i<128;i++){
 const row=normalizeOilSourceRow({
  d:'minecraft:overworld',x:i-64,y:64,z:i,type:'canola',
  cells:[oilPosKey('minecraft:overworld',i-64,63,i)],nextTick:i
 },['canola','secret_chili','premium_chili']);
 assert(row);ids.add(oilSourcePropertyId(row));
}
assert.equal(ids.size,128); // proves there is no 64-source serialization ceiling in the registry key model.
const a=oilSourcePropertyId({d:'a:b',x:1,y:2,z:3}),b=oilSourcePropertyId({d:'a_b',x:1,y:2,z:3});
assert.notEqual(a,b);
assert.equal(normalizeOilSourceRow({d:'x',x:0,y:0,z:0,type:'bad'},['canola']),null);
const tooMany=normalizeOilSourceRow({d:'x',x:0,y:0,z:0,type:'canola',cells:Array(600).fill('x|0|0|0')},['canola']);
assert.equal(tooMany.cells.length,FLOW_CELL_BUDGET);
console.log('Per-source oil registry/migration core: PASS');
