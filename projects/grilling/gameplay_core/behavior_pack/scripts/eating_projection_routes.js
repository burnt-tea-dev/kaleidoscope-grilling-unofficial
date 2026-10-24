/** Source-profile selection for fixed families; no per-family pose overlays.
 * The existing native duration/hand session owns the chosen profile. This does
 * not change item identities, player properties, settlement or third-person use.
 */
import {PROFILE_BY_ITEM} from './data.js';
import {canonicalFoodId,isPlainEatingId,isAlternateEatingId} from './eating_profile_ids.js';
import {supportsFailureEating,failureEatingAnimation} from './failure_skewer_projection.js';
const COMPOSITED = new Set(['kaleidoscope_grilling:secret_skewer','kaleidoscope_grilling:mysterious_skewer','kaleidoscope_grilling:dark_grilling']);
export function supportsSourceFixedProjection(id, profile, hand) {
 const base=canonicalFoodId(id),configured=PROFILE_BY_ITEM[base];
 if((hand!=='main'&&hand!=='off')||!configured||COMPOSITED.has(base)||isPlainEatingId(id))return false;
 const selected=configured==='THREE_RANDOM'?(isAlternateEatingId(id)?'THREE_ALT':'THREE'):configured;
 return profile===selected;
}
function secretRoute(id,profile) {
 return id==='kaleidoscope_grilling:secret_skewer'&&profile==='THREE'||
  id==='kaleidoscope_grilling:secret_skewer_java_three_alt'&&profile==='THREE_ALT';
}
export function admitEatingProjection(e, profile, hand, heldByHand) {
 if(supportsSourceFixedProjection(e.itemStack.typeId,profile,hand))return !['ONE','THREE'].includes(profile)||!heldByHand(e.source,hand==='off'?'main':'off');
 // Composited models retain their existing helper/ingredient ownership policy.
 return (secretRoute(e.itemStack.typeId,profile)||supportsFailureEating(e.itemStack.typeId,profile))&&
  (!['ONE','THREE'].includes(profile)||!heldByHand(e.source,hand==='off'?'main':'off'));
}
export function selectEatingProjection(e, profile, hand) {
 const failure=failureEatingAnimation(e.itemStack.typeId,profile,hand);
 if(failure)return failure;
 return 'animation.kg_java_eating.player.'+profile.toLowerCase()+'.'+(hand==='off'?'left':'right');
}
