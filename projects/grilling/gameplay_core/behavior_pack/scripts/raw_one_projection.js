// Exact raw ONE scope; inherited generic basis, no camera parity claim.
export const RAW_ONE_IDS=Object.freeze(["kaleidoscope_grilling:raw_fish_skewer", "kaleidoscope_grilling:raw_caterpillar_skewer"]);
export function supportsRawOne(id,profile,hand){return profile==='ONE'&&(hand==='main'||hand==='off')&&RAW_ONE_IDS.includes(id);}
export function rawOneAnimation(id,profile,hand){return supportsRawOne(id,profile,hand)?'animation.kg_raw_one.player.one.'+(hand==='off'?'left':'right'):null;}
