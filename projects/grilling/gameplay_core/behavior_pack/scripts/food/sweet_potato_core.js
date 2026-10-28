export const POWDER_ID='kaleidoscope_grilling:sweet_potato_powder';
export const SHEET_ID='kaleidoscope_grilling:raw_sweet_potato_sheet';
export const KNEAD_TICKS=30;
export const KNEAD_SECONDS=1.5;
export const CHOPPING_BOARD_CUTS=4;

export function normalizedStackAmount(value){
 const n=Math.floor(Number(value)||0);
 return Math.max(1,Math.min(64,n||1));
}

export function kneadResult(typeId,amount,heldTicks){
 if(typeId!==POWDER_ID)return null;
 if((Number(heldTicks)||0)<KNEAD_TICKS)return null;
 return {id:SHEET_ID,amount:normalizedStackAmount(amount)};
}
