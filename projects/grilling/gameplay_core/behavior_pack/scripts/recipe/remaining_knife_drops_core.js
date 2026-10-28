export const COW_ID='minecraft:cow';
export const SQUID_ID='minecraft:squid';
export const RAW_COW_OFFAL_ID='kaleidoscope_cookery:raw_cow_offal';
export const SQUID_TENTACLE_ID='kaleidoscope_grilling:squid_tentacle';
export const SQUID_DROP_CHANCE=0.5;

function sampleIndex(random01,size){
 const r=Math.max(0,Math.min(0.999999999999,Number(random01)||0));
 return Math.floor(r*Math.max(1,Math.floor(Number(size)||1)));
}
function lootingBonus(random01,level){
 const n=Math.max(0,Math.floor(Number(level)||0));
 return n>0?sampleIndex(random01,n+1):0;
}

export function cowOffalDropCount(baseRandom01,lootingRandom01,lootingLevel){
 return 1+sampleIndex(baseRandom01,2)+lootingBonus(lootingRandom01,lootingLevel);
}
export function squidTentacleDropCount(baseRandom01,lootingRandom01,lootingLevel){
 return 2+sampleIndex(baseRandom01,2)+lootingBonus(lootingRandom01,lootingLevel);
}
export function squidTentacleShouldDrop(chanceRandom01){
 const r=Math.max(0,Math.min(0.999999999999,Number(chanceRandom01)||0));
 return r<SQUID_DROP_CHANCE;
}
