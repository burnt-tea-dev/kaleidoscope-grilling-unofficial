// Exact failure-item projection admission; source-derived, client acceptance separate.
const profiles=Object.freeze({"kaleidoscope_grilling:mysterious_skewer":"THREE","kaleidoscope_grilling:mysterious_skewer_java_three_alt":"THREE_ALT","kaleidoscope_grilling:dark_grilling":"THREE","kaleidoscope_grilling:dark_grilling_java_three_alt":"THREE_ALT"});
export function supportsFailureEating(id,profile){return Object.hasOwn(profiles,id)&&profiles[id]===profile;}
export function failureEatingAnimation(id,profile,hand){return supportsFailureEating(id,profile)?'animation.kg_failure_held.player.'+profile.toLowerCase()+'.'+(hand==='off'?'left':'right'):null;}
