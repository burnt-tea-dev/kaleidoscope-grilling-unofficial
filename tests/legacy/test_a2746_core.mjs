import assert from 'node:assert/strict';
import {
 RACK_COMPARTMENTS,RACK_SEASONING_SLOTS,RACK_TOOL_SLOTS,RACK_RANGE,
 rackSlotKind,rackItemKind,rackCanonicalFilter,rackFilterMatches,rackCanPlace,
 normalizeRackFilters,rackDisplayLevel,rackPlacementCandidates,bindingInRange
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/rack/advanced_rack_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Java rack topology is 5 seasoning + 4 tool compartments',()=>{
 assert.equal(RACK_COMPARTMENTS,9);assert.equal(RACK_SEASONING_SLOTS,5);assert.equal(RACK_TOOL_SLOTS,4);assert.equal(RACK_RANGE,8);
 assert.equal(rackSlotKind(0),'seasoning');assert.equal(rackSlotKind(4),'seasoning');assert.equal(rackSlotKind(5),'tool');assert.equal(rackSlotKind(8),'tool');
});

t('Bedrock split oil-pot IDs share one Java-compatible category',()=>{
 const a=rackCanonicalFilter('kaleidoscope_cookery:oil_pot');
 const b=rackCanonicalFilter('kaleidoscope_cookery:oil_pot_filled');
 assert.deepEqual(a,b);assert.equal(a.category,'oil_pot');
});

t('all seasoning bottle states share one category',()=>{
 const ids=['kaleidoscope_grilling:empty_seasoning_bottle','kaleidoscope_grilling:pending_seasoning','kaleidoscope_grilling:special_seasoning'];
 const f=rackCanonicalFilter(ids[0]);
 for(const id of ids)assert.equal(rackFilterMatches(f,id),true);
});

t('tools accept exact Cookery tools and vanilla flint-and-steel',()=>{
 for(const id of ['kaleidoscope_cookery:iron_kitchen_knife','kaleidoscope_cookery:kitchen_shovel','minecraft:flint_and_steel'])
  assert.equal(rackItemKind(id),'tool');
 assert.equal(rackCanPlace(5,'minecraft:flint_and_steel'),true);
 assert.equal(rackCanPlace(0,'minecraft:flint_and_steel'),false);
});

t('external Cookery tool tags are honored without another registry',()=>{
 assert.equal(rackItemKind('addon:knife',['kaleidoscope_cookery:kitchen_knife']),'tool');
});

t('filter survives empty slot and rejects wrong category',()=>{
 const f=rackCanonicalFilter('kaleidoscope_grilling:special_seasoning');
 assert.equal(rackCanPlace(0,'kaleidoscope_grilling:empty_seasoning_bottle',[],f),true);
 assert.equal(rackCanPlace(0,'kaleidoscope_cookery:oil_pot',[],f),false);
});

t('display level counts only first five occupied slots and caps at four',()=>{
 assert.equal(rackDisplayLevel([1,1,1,1,1,1,1,1,1]),4);
 assert.equal(rackDisplayLevel([1,0,1,0,0,1,1,1,1]),2);
});

t('placement checks clicked and adjacent positions',()=>{
 assert.deepEqual(rackPlacementCandidates({x:1,y:2,z:3},'Up'),[{x:1,y:2,z:3},{x:1,y:3,z:3}]);
});

t('shortcut range matches Java eight-block contract',()=>{
 const b={dimension:'minecraft:overworld',x:0,y:64,z:0,slot:0};
 assert.equal(bindingInRange(b,'minecraft:overworld',{x:.5,y:64.5,z:7.5}),true);
 assert.equal(bindingInRange(b,'minecraft:overworld',{x:.5,y:64.5,z:9.5}),false);
 assert.equal(bindingInRange(b,'minecraft:nether', {x:.5,y:64.5,z:.5}),false);
});

t('filter normalization always returns nine entries',()=>{
 assert.equal(normalizeRackFilters([{kind:'tool',category:'exact',typeId:'minecraft:flint_and_steel'}]).length,9);
});
console.log('A2.7.46 Advanced Rack core: '+n+'/'+n);
