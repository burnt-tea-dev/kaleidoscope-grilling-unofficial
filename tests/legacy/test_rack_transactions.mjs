import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2746_advanced_rack_core.js';

test('Java public rack tags are independent per slot, including dual-tag items',()=>{
 const seasoningTag='kaleidoscope_grilling:advanced_rack_seasonings',toolTag='kaleidoscope_grilling:advanced_rack_tools';
 for(let slot=0;slot<9;slot++){
  assert.equal(core.rackCanPlace(slot,'custom:both',[seasoningTag,toolTag]),true);
  const filter=core.rackCanonicalFilter('custom:both',[seasoningTag,toolTag],slot);
  assert.equal(filter.kind,slot<5?'seasoning':'tool');assert.equal(core.rackCanPlace(slot,'custom:both',[seasoningTag,toolTag],filter),true);
  assert.equal(core.rackCanPlace(slot,'custom:one',[seasoningTag]),slot<5);
  assert.equal(core.rackCanPlace(slot,'custom:one',[toolTag]),slot>=5);
  assert.equal(core.rackCanPlace(slot,'custom:none',[]),false);
 }
});
