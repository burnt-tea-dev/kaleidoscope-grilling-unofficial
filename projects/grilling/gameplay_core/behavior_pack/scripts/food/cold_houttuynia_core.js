export const COLD_ID='kaleidoscope_grilling:cold_houttuynia';
export const HOUTTUYNIA_ID='kaleidoscope_grilling:houttuynia';
export const CRAFTING_TABLE_ID='minecraft:crafting_table';
export const COOKERY_EMPTY_ID='kaleidoscope_cookery:oil_pot';
export const COOKERY_FILLED_ID='kaleidoscope_cookery:oil_pot_filled';
export const REQUIRED_OIL_TYPE='premium_chili';
export const OIL_TYPE_KEY='kaleidoscope_grilling:oil_type';
export const OIL_COUNT_KEY='kc_oil_count';
export const REQUIRED_HOUTTUYNIA=3;
export const REQUIRED_OIL=2;
export const OIL_CAPACITY=64;
export const FIRE_RESISTANCE_TICKS=1200;
export const NUTRITION=6;
export const SATURATION_MODIFIER=1.0;

export function planColdHouttuynia(input={}){
 const blockId=String(input.blockId??''),mainId=String(input.mainId??''),offId=String(input.offId??'');
 const mainCount=Math.max(0,Number(input.mainCount)||0)|0;
 const oilCount=Math.max(0,Math.min(OIL_CAPACITY,Number(input.oilCount)||0))|0;
 const oilType=String(input.oilType??'');
 if(blockId!==CRAFTING_TABLE_ID)return {ok:false,reason:'not_crafting_table'};
 if(!input.sneaking)return {ok:false,reason:'not_sneaking'};
 if(mainId!==HOUTTUYNIA_ID)return {ok:false,reason:'wrong_ingredient'};
 if(mainCount<REQUIRED_HOUTTUYNIA)return {ok:false,reason:'need_houttuynia'};
 if(offId!==COOKERY_FILLED_ID)return {ok:false,reason:'need_oil_pot'};
 if(oilType!==REQUIRED_OIL_TYPE)return {ok:false,reason:'wrong_oil'};
 if(oilCount<REQUIRED_OIL)return {ok:false,reason:'need_oil'};
 return {
  ok:true,
  output:COLD_ID,
  houttuyniaUsed:REQUIRED_HOUTTUYNIA,
  oilUsed:REQUIRED_OIL,
  nextHouttuyniaCount:mainCount-REQUIRED_HOUTTUYNIA,
  nextOilCount:oilCount-REQUIRED_OIL
 };
}

export function nextOilPotId(nextOilCount){
 return Math.max(0,Number(nextOilCount)||0)>0?COOKERY_FILLED_ID:COOKERY_EMPTY_ID;
}
