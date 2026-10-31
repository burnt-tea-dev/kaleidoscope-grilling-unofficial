/** Canonical spellings for persisted Grilling/host keys. The save guard also
 * retains three older literal matches that are event/item identifiers, not keys.
 */
export const GRILLING_NAMESPACE_KEY='kaleidoscope_grilling:';
export const A21_FX_KEY='kaleidoscope_grilling:a21_fx';
export const A23_OIL_SOURCE_PREFIX='kaleidoscope_grilling:a23_oil_source_';
export const A25_PLATE_PREFIX='kaleidoscope_grilling:a25_plate_';
export const A25_RECIPE_PREFIX='kaleidoscope_grilling:a25_recipe_';
export const A26_PRESS_PREFIX='kaleidoscope_grilling:a26_press_';
export const A26_PRESS_INSTANCE_PREFIX='kaleidoscope_grilling:a26_press_instance_';
export const A26_PRESS_REGISTRY_KEY='kaleidoscope_grilling:a26_press_registry';
export const A26_PRESS_REGISTRY_ENTRY_PREFIX='kaleidoscope_grilling:a26_press_registry_entry_';
export const A26_VAT_PREFIX='kaleidoscope_grilling:a26_vat_';
export const A26_VAT_INSTANCE_PREFIX='kaleidoscope_grilling:a26_vat_instance_';
export const A2736_OILPOT_TYPE_PREFIX='kaleidoscope_grilling:a2736_oilpot_type_';
export const ADVANCEMENT_PREFIX='kaleidoscope_grilling:adv_';
export const BOTTLE_PREFIX='kaleidoscope_grilling:bottle_';
// Presentation cache only. Legacy eating spellings below remain registered
// for save compatibility; the controls word is rebuilt on player spawn.
export const CONTROLS_KEY='kaleidoscope_grilling:controls';
export const CUISINE_PREFIX='kaleidoscope_grilling:cuisine_';
export const DRAGON_NATIVE_LEVEL_KEY='kaleidoscope_grilling:dragon_native_level';
export const DRAGON_POOL_KEY='kaleidoscope_grilling:dragon_pool';
export const EAT_ELAPSED_TICKS_KEY='kaleidoscope_grilling:eat_elapsed_ticks';
export const EAT_HAND_KEY='kaleidoscope_grilling:eat_hand';
export const EAT_NATIVE_TICKS_KEY='kaleidoscope_grilling:eat_native_ticks';
export const EAT_PROFILE_KEY='kaleidoscope_grilling:eat_profile';
export const EAT_PROJECTION_KEY='kaleidoscope_grilling:eat_projection';
export const FAILED_SKEWER_SOURCE_KEY='kaleidoscope_grilling:failed_skewer_source';
export const GRILL_STATE_PREFIX='kaleidoscope_grilling:g_';
export const GUI_COLOR_PREFIX='kaleidoscope_grilling:gui_color_';
export const HEAVY_METAL_CLAIM_KEY='kaleidoscope_grilling:heavy_metal_claim';
export const HOT_UNTIL_KEY='kaleidoscope_grilling:hot_until';
export const INTEGRATION_OPERATION_PREFIX='kaleidoscope_grilling:integration_operation:';
export const INTEGRATION_REGISTRY_KEY='kaleidoscope_grilling:integration_registry_v1';
export const MODEL_VARIANTS_KEY='kaleidoscope_grilling:model_variants';
export const OIL_TRANSACTION_FAULT_PREFIX='kaleidoscope_grilling:oil_transaction_fault_';
export const OIL_TRANSFER_FAULT_PREFIX='kaleidoscope_grilling:oil_transfer_fault:';
export const OIL_TYPE_KEY='kaleidoscope_grilling:oil_type';
export const PEPPER_STING_UNTIL_KEY='kaleidoscope_grilling:pepper_sting_until';
export const PLANT_TRANSACTION_FAULT_PREFIX='kaleidoscope_grilling:plant_transaction_fault_';
export const PLATE_SKEWERS_KEY='kaleidoscope_grilling:plate_skewers';
export const PLAYER_ITEM_RECEIPT_PREFIX='kaleidoscope_grilling:player_item_receipt_';
export const PLAYER_TOUCHED_NETHER_PREFIX='kaleidoscope_grilling:player_touched_nether:';
export const RACK_BINDING_PREFIX='kaleidoscope_grilling:rack_binding_';
export const RACK_FILTERS_PREFIX='kaleidoscope_grilling:rack_filters_';
export const RACK_PAYLOAD_KEY='kaleidoscope_grilling:rack_payload';
export const RECIPE_RECORD_KEY='kaleidoscope_grilling:recipe_record';
export const SEASONING_BLOCK_PREFIX='kaleidoscope_grilling:sb_';
export const SEASONED_KEY='kaleidoscope_grilling:seasoned';
export const SEASONINGS_KEY='kaleidoscope_grilling:seasonings';
export const SECRET_PREFIX='kaleidoscope_grilling:secret_';
export const SECRET_COOKED_KEY='kaleidoscope_grilling:secret_cooked';
export const SECRET_COOKED_INGREDIENTS_KEY='kaleidoscope_grilling:secret_cooked_ingredients';
export const SECRET_CREATOR_KEY='kaleidoscope_grilling:secret_creator';
export const SERVER_CONFIG_KEY='kaleidoscope_grilling:server_config_v1';
export const SKEWER_INGREDIENTS_KEY='kaleidoscope_grilling:skewer_ingredients';
export const STORAGE_OWNER_KEY='kaleidoscope_grilling:storage_owner_v1';
export const STORAGE_PREFIX='kaleidoscope_grilling:storage_v1/';
export const SEASONING_USES_KEY='kaleidoscope_grilling:uses';
export const SEASONING_VARIANT_KEY='kaleidoscope_grilling:variant';
export const VAT_BUCKETS_KEY='kaleidoscope_grilling:vat_buckets';
export const VAT_TYPE_KEY='kaleidoscope_grilling:vat_type';
export const WEDDING_CANDY_STATE_KEY='kaleidoscope_grilling:wedding_candy_state';
export const COOKERY_OIL_COUNT_KEY='kc_oil_count';
export const COOKERY_OIL_BLOCK_PREFIX='kc_oilpot:';
export const CUISINE_CARRIER_PREFIX='senluo:cuisine_carrier:';
export const CUISINE_CONFIG_KEY='senluo:cuisine_heat_and_seasoning_v1';
export const CUISINE_METADATA_PREFIX='senluo:cuisine_metadata:';
export const CUISINE_OUTPUT_PREFIX='senluo:cuisine_output:';
export const CUISINE_RECOVERY_PREFIX='senluo:cuisine_recovery:';
export const GRILLING_ITEM_METADATA_PREFIX='senluo:grilling_item_';
export const JAVA_POT_OPERATION_PREFIX='senluo:java_pot_operation:';
export const OIL_API_PLACED_PREFIX='senluo:oil_api_placed:';
export const OIL_API_RECOVERY_PREFIX='senluo:oil_api_recovery:';
export const OIL_API_REVISION_KEY='senluo:oil_api_revision';
export const OIL_HAND_FAULT_PREFIX='senluo:oil_hand_fault:';
export const OIL_STATION_FAULT_PREFIX='senluo:oil_station_fault:';
export const LOCKED_DRAGON_HEALTH_EVENT_PREFIX='kaleidoscope_grilling:dragon_health_';
export const LOCKED_SEASONING_BOTTLE_ID_PREFIX='kaleidoscope_grilling:seasoning_bottle_';
export const LOCKED_SPECIAL_SEASONING_ID_PREFIX='kaleidoscope_grilling:special_seasoning_r';
export const PERSISTED_KEY=Object.freeze({
 CONTROLS:CONTROLS_KEY,
 GRILLING_NAMESPACE:GRILLING_NAMESPACE_KEY,
 A21_FX:A21_FX_KEY,
 A23_OIL_SOURCE_PREFIX:A23_OIL_SOURCE_PREFIX,
 A25_PLATE_PREFIX:A25_PLATE_PREFIX,
 A25_RECIPE_PREFIX:A25_RECIPE_PREFIX,
 A26_PRESS_PREFIX:A26_PRESS_PREFIX,
 A26_PRESS_INSTANCE_PREFIX:A26_PRESS_INSTANCE_PREFIX,
 A26_PRESS_REGISTRY:A26_PRESS_REGISTRY_KEY,
 A26_PRESS_REGISTRY_ENTRY_PREFIX:A26_PRESS_REGISTRY_ENTRY_PREFIX,
 A26_VAT_PREFIX:A26_VAT_PREFIX,
 A26_VAT_INSTANCE_PREFIX:A26_VAT_INSTANCE_PREFIX,
 A2736_OILPOT_TYPE_PREFIX:A2736_OILPOT_TYPE_PREFIX,
 ADVANCEMENT_PREFIX:ADVANCEMENT_PREFIX,
 BOTTLE_PREFIX:BOTTLE_PREFIX,
 CUISINE_PREFIX:CUISINE_PREFIX,
 DRAGON_NATIVE_LEVEL:DRAGON_NATIVE_LEVEL_KEY,
 DRAGON_POOL:DRAGON_POOL_KEY,
 EAT_ELAPSED_TICKS:EAT_ELAPSED_TICKS_KEY,
 EAT_HAND:EAT_HAND_KEY,
 EAT_NATIVE_TICKS:EAT_NATIVE_TICKS_KEY,
 EAT_PROFILE:EAT_PROFILE_KEY,
 EAT_PROJECTION:EAT_PROJECTION_KEY,
 FAILED_SKEWER_SOURCE:FAILED_SKEWER_SOURCE_KEY,
 GRILL_STATE_PREFIX:GRILL_STATE_PREFIX,
 GUI_COLOR_PREFIX:GUI_COLOR_PREFIX,
 HEAVY_METAL_CLAIM:HEAVY_METAL_CLAIM_KEY,
 HOT_UNTIL:HOT_UNTIL_KEY,
 INTEGRATION_OPERATION_PREFIX:INTEGRATION_OPERATION_PREFIX,
 INTEGRATION_REGISTRY:INTEGRATION_REGISTRY_KEY,
 MODEL_VARIANTS:MODEL_VARIANTS_KEY,
 OIL_TRANSACTION_FAULT_PREFIX:OIL_TRANSACTION_FAULT_PREFIX,
 OIL_TRANSFER_FAULT_PREFIX:OIL_TRANSFER_FAULT_PREFIX,
 OIL_TYPE:OIL_TYPE_KEY,
 PEPPER_STING_UNTIL:PEPPER_STING_UNTIL_KEY,
 PLANT_TRANSACTION_FAULT_PREFIX:PLANT_TRANSACTION_FAULT_PREFIX,
 PLATE_SKEWERS:PLATE_SKEWERS_KEY,
 PLAYER_ITEM_RECEIPT_PREFIX:PLAYER_ITEM_RECEIPT_PREFIX,
 PLAYER_TOUCHED_NETHER_PREFIX:PLAYER_TOUCHED_NETHER_PREFIX,
 RACK_BINDING_PREFIX:RACK_BINDING_PREFIX,
 RACK_FILTERS_PREFIX:RACK_FILTERS_PREFIX,
 RACK_PAYLOAD:RACK_PAYLOAD_KEY,
 RECIPE_RECORD:RECIPE_RECORD_KEY,
 SEASONING_BLOCK_PREFIX:SEASONING_BLOCK_PREFIX,
 SEASONED:SEASONED_KEY,
 SEASONINGS:SEASONINGS_KEY,
 SECRET_PREFIX:SECRET_PREFIX,
 SECRET_COOKED:SECRET_COOKED_KEY,
 SECRET_COOKED_INGREDIENTS:SECRET_COOKED_INGREDIENTS_KEY,
 SECRET_CREATOR:SECRET_CREATOR_KEY,
 SERVER_CONFIG:SERVER_CONFIG_KEY,
 SKEWER_INGREDIENTS:SKEWER_INGREDIENTS_KEY,
 STORAGE_OWNER:STORAGE_OWNER_KEY,
 STORAGE_PREFIX:STORAGE_PREFIX,
 SEASONING_USES:SEASONING_USES_KEY,
 SEASONING_VARIANT:SEASONING_VARIANT_KEY,
 VAT_BUCKETS:VAT_BUCKETS_KEY,
 VAT_TYPE:VAT_TYPE_KEY,
 WEDDING_CANDY_STATE:WEDDING_CANDY_STATE_KEY,
 COOKERY_OIL_COUNT:COOKERY_OIL_COUNT_KEY,
 COOKERY_OIL_BLOCK_PREFIX:COOKERY_OIL_BLOCK_PREFIX,
 CUISINE_CARRIER_PREFIX:CUISINE_CARRIER_PREFIX,
 CUISINE_CONFIG:CUISINE_CONFIG_KEY,
 CUISINE_METADATA_PREFIX:CUISINE_METADATA_PREFIX,
 CUISINE_OUTPUT_PREFIX:CUISINE_OUTPUT_PREFIX,
 CUISINE_RECOVERY_PREFIX:CUISINE_RECOVERY_PREFIX,
 GRILLING_ITEM_METADATA_PREFIX:GRILLING_ITEM_METADATA_PREFIX,
 JAVA_POT_OPERATION_PREFIX:JAVA_POT_OPERATION_PREFIX,
 OIL_API_PLACED_PREFIX:OIL_API_PLACED_PREFIX,
 OIL_API_RECOVERY_PREFIX:OIL_API_RECOVERY_PREFIX,
 OIL_API_REVISION:OIL_API_REVISION_KEY,
 OIL_HAND_FAULT_PREFIX:OIL_HAND_FAULT_PREFIX,
 OIL_STATION_FAULT_PREFIX:OIL_STATION_FAULT_PREFIX,
});
export const SAVE_COMPAT_NON_KEY_LITERALS=Object.freeze([
 LOCKED_DRAGON_HEALTH_EVENT_PREFIX,
 LOCKED_SEASONING_BOTTLE_ID_PREFIX,
 LOCKED_SPECIAL_SEASONING_ID_PREFIX,
]);
export const PERSISTED_KEY_LITERALS=Object.freeze([...Object.values(PERSISTED_KEY),...SAVE_COMPAT_NON_KEY_LITERALS].sort());
