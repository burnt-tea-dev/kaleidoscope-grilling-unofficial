import assert from 'node:assert/strict';
import * as shared from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2738_oil_contract_core.js';
import {
 FAT_CAPACITY,FLUID_CAPACITY,OIL_BUCKET_POINTS
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js';
import {
 HOST_FAT_CAPACITY,GRILLING_FLUID_CAPACITY,GRILLING_OIL_BUCKET_POINTS,
 normalizeOilType,oilCapacity,oilTypeForBucketId
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2734_cookery_oil_pot_core.js';
import {
 OIL_BUCKET_POINTS as BLOCK_BUCKET_POINTS
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2736_typed_oil_pot_block_core.js';
import {
 ITEM_FILL_POINTS,oilTypeForBucketId as ITEM_LOOKUP
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2737_offhand_oil_fill_core.js';

assert.equal(FAT_CAPACITY,shared.HOST_FAT_CAPACITY);
assert.equal(FLUID_CAPACITY,shared.GRILLING_FLUID_CAPACITY);
assert.equal(OIL_BUCKET_POINTS,shared.GRILLING_OIL_BUCKET_POINTS);
assert.equal(HOST_FAT_CAPACITY,shared.HOST_FAT_CAPACITY);
assert.equal(GRILLING_FLUID_CAPACITY,shared.GRILLING_FLUID_CAPACITY);
assert.equal(GRILLING_OIL_BUCKET_POINTS,shared.GRILLING_OIL_BUCKET_POINTS);
assert.equal(BLOCK_BUCKET_POINTS,shared.GRILLING_OIL_BUCKET_POINTS);
assert.equal(ITEM_FILL_POINTS,shared.GRILLING_OIL_BUCKET_POINTS);
assert.equal(normalizeOilType,shared.normalizeOilType);
assert.equal(oilCapacity,shared.oilCapacity);
assert.equal(oilTypeForBucketId,shared.oilTypeForBucketId);
assert.equal(ITEM_LOOKUP,shared.oilTypeForBucketId);
console.log('A2.7.38 integrated oil contract consumers: PASS');
