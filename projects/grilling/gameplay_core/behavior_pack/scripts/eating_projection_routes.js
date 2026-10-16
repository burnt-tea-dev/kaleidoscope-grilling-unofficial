/** Ordered FP routing. Read the event lazily: getter/helper order is observable.
 * Admission runs before projection properties; selection runs inside the original
 * playAnimation argument evaluation. Asset IDs and calibration policies are opaque.
 */
import {supportsJavaEatingProjection} from './java_eating_projection_items.js';
import {supportsFailureEating,failureEatingAnimation} from './failure_skewer_projection.js';
import {supportsRawOne,rawOneAnimation} from './raw_one_projection.js';
import {supportsReviewedThree,reviewedThreeAnimation} from './review_three_projection.js';
const OFFHAND_ONE = Object.freeze([
  "kaleidoscope_grilling:grilled_caterpillar_skewer"
]);
const OFFHAND_THREE = Object.freeze([
  "kaleidoscope_grilling:grilled_gluten_skewer",
  "kaleidoscope_grilling:grilled_golden_skewer",
  "kaleidoscope_grilling:grilled_lamb_skewer",
  "kaleidoscope_grilling:grilled_meat_and_bone_skewer",
  "kaleidoscope_grilling:grilled_meatball_skewer",
  "kaleidoscope_grilling:grilled_mid_wing_skewer",
  "kaleidoscope_grilling:grilled_mushroom_skewer",
  "kaleidoscope_grilling:grilled_potato_slice_skewer",
  "kaleidoscope_grilling:grilled_squid_tentacle_skewer",
  "kaleidoscope_grilling:ordinary_skewer",
  "kaleidoscope_grilling:raw_ender_pearl_skewer",
  "kaleidoscope_grilling:raw_gluten_skewer",
  "kaleidoscope_grilling:raw_golden_skewer",
  "kaleidoscope_grilling:raw_lamb_skewer",
  "kaleidoscope_grilling:raw_meat_and_bone_skewer",
  "kaleidoscope_grilling:raw_meatball_skewer",
  "kaleidoscope_grilling:raw_mid_wing_skewer",
  "kaleidoscope_grilling:raw_mushroom_skewer",
  "kaleidoscope_grilling:raw_potato_slice_skewer",
  "kaleidoscope_grilling:raw_squid_tentacle_skewer"
]);
const ORDINARY_ALT = Object.freeze([
  "kaleidoscope_grilling:grilled_gluten_skewer_java_three_alt",
  "kaleidoscope_grilling:grilled_golden_skewer_java_three_alt",
  "kaleidoscope_grilling:grilled_lamb_skewer_java_three_alt",
  "kaleidoscope_grilling:grilled_meat_and_bone_skewer_java_three_alt",
  "kaleidoscope_grilling:grilled_meatball_skewer_java_three_alt",
  "kaleidoscope_grilling:grilled_mid_wing_skewer_java_three_alt",
  "kaleidoscope_grilling:grilled_mushroom_skewer_java_three_alt",
  "kaleidoscope_grilling:grilled_potato_slice_skewer_java_three_alt",
  "kaleidoscope_grilling:grilled_squid_tentacle_skewer_java_three_alt",
  "kaleidoscope_grilling:ordinary_skewer_java_three_alt",
  "kaleidoscope_grilling:raw_gluten_skewer_java_three_alt",
  "kaleidoscope_grilling:raw_golden_skewer_java_three_alt",
  "kaleidoscope_grilling:raw_lamb_skewer_java_three_alt",
  "kaleidoscope_grilling:raw_meat_and_bone_skewer_java_three_alt",
  "kaleidoscope_grilling:raw_meatball_skewer_java_three_alt",
  "kaleidoscope_grilling:raw_mid_wing_skewer_java_three_alt",
  "kaleidoscope_grilling:raw_mushroom_skewer_java_three_alt",
  "kaleidoscope_grilling:raw_potato_slice_skewer_java_three_alt",
  "kaleidoscope_grilling:raw_squid_tentacle_skewer_java_three_alt"
]);

function offhandRoute(e, profile, hand) {
 return hand === 'off' && ((profile === 'ONE' && OFFHAND_ONE.includes(e.itemStack.typeId)) ||
  (profile === 'THREE' && OFFHAND_THREE.includes(e.itemStack.typeId)));
}
// Ordered predicates retain the legacy short-circuit and repeated ID reads.
const ADMISSION = Object.freeze([
 (e,p,h) => supportsJavaEatingProjection(e.itemStack.typeId,p),
 offhandRoute,
 (e,p,h) => supportsFailureEating(e.itemStack.typeId,p),
 (e,p,h) => supportsRawOne(e.itemStack.typeId,p,h),
 (e,p,h) => supportsReviewedThree(e.itemStack.typeId,p,h),
 (e,p,h) => e.itemStack.typeId === 'kaleidoscope_grilling:grilled_caterpillar_skewer' && p === 'ONE' && h !== 'off',
]);
export function admitEatingProjection(e, profile, hand, heldByHand) {
 return ADMISSION.some(test => test(e,profile,hand)) &&
  (!['ONE','THREE'].includes(profile) || !heldByHand(e.source,hand === 'off' ? 'main' : 'off'));
}
const profileClip = (prefix,p,h) => prefix + p.toLowerCase() + '.' + (h === 'off' ? 'left' : 'right');
const SELECTION = Object.freeze([
 {name:'source-left-extension', select:(e,p,h) => offhandRoute(e,p,h) && 'animation.kg_offhand_projection.player.' + p.toLowerCase() + '.left'},
 {name:'failure', select:(e,p,h) => failureEatingAnimation(e.itemStack.typeId,p,h)},
 {name:'raw-one', select:(e,p,h) => rawOneAnimation(e.itemStack.typeId,p,h)},
 {name:'reviewed-three', select:(e,p,h) => reviewedThreeAnimation(e.itemStack.typeId,p,h)},
 {name:'g127-bun', select:(e,p,h,held) => e.itemStack.typeId === 'kaleidoscope_grilling:grilled_bun_slice_skewer' && p === 'TWO' && h === 'main' && !held(e.source,'off') && 'animation.kg_isolated_two_route_v1.player.bun_two.right'},
 {name:'g127-pearl', select:(e,p,h,held) => e.itemStack.typeId === 'kaleidoscope_grilling:grilled_ender_pearl_skewer' && p === 'THREE' && h === 'main' && !held(e.source,'off') && 'animation.kg_isolated_two_route_v1.player.pearl_three.right'},
 {name:'g126-caterpillar', select:(e,p,h) => e.itemStack.typeId === 'kaleidoscope_grilling:grilled_caterpillar_skewer' && p === 'ONE' && h !== 'off' && 'animation.kg_probe_caterpillar.player.one.right'},
 {name:'ordinary-relative', select:(e,p,h) => ((p === 'THREE_ALT' && ORDINARY_ALT.includes(e.itemStack.typeId)) || (p === 'THREE' && h === 'off' && e.itemStack.typeId === 'kaleidoscope_grilling:grilled_ender_pearl_skewer')) && profileClip('animation.kg_ordinary_relative.player.',p,h)},
]);
export function selectEatingProjection(e, profile, hand, heldByHand) {
 for (const route of SELECTION) {
  const clip = route.select(e,profile,hand,heldByHand);
  if (clip) return clip;
 }
 return profileClip('animation.kg_java_eating.player.',profile,hand);
}
