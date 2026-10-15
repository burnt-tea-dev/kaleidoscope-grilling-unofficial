# Plate failure models and cooked-slime frames

Source candidate based on `4e5ca54d67a331959d125961bd70eba8901020e8`.
No new release identity, native/client acceptance or deployment is claimed.

## Reproduced source gaps

- Plates accept `mysterious_skewer` and `dark_grilling`. The held-row planner
  returned an empty model for both; placed plates fell back to equipped-item
  helpers without the failure metadata channel. The new path selects the actual
  saved source/shape, including source-over-variant precedence, at bite stage 0.
- Cooked slime on either kind of plate used the static raw-slime grill mesh.
  Java renders the actual saved stack and selects five models from world time.
  Its held-item and wall-icon repairs did not reach the plate paths.

Authority: Java `9a1acdab27698457bec16c9362678e574895a28c`, NeoForge 1.21.1
`SkewerPlateItemRenderer.renderByItem`, `SkewerPlateRenderer.render`, and
`ClientSetup`'s `SLIME_SKEWER_FRAME` registration. Existing exact-source failure
fixtures and the five canonical cooked-slime model/texture inputs are reused.
The plate transform's three source SHA256 pins remain checked by
`tools/build_plate_held.py --check --java-source <pinned-checkout>`.

## Bounded implementation

- A shared plate-only catalog has 112 uneaten failure selections and five slime
  selections. Source identity, shape order and texture selection remain distinct.
  Exact texture-size/cube/rotation/UV equality deduplicates geometry only.
- Held models reuse six existing fixed shapes; 55 new distinct shapes need five
  slot-named copies, adding 275 geometry definitions (516 → 791). Placed models
  reuse four byte-exact current shapes and add 57 definitions. No new PNGs.
- Existing plate layout, transforms, 12-channel ownership protocol, ready gates,
  authoritative saved envelopes, transactions and helper budgets are retained.
  Held controller count stays 26, with at most 21 visible passes; placed plates
  retain one helper per skewer and four render routes. More model definitions
  still need native load/memory/frame-time review; source counts do not prove it.
- The five-tick/event provider remains the only full held-row decoder. The
  existing one-tick slime loop passes its world-frame sample to a cached plate
  payload. Unchanged frames do nothing; changed frames check exact saved-content
  identity and update only the cooked-slime row words through the existing
  owner-last writer. No new player scan, timer, property or eating clock.
  Placed updates retain the existing bounded queue; under load they may skip
  intermediate frames, as the existing wall display can.

## Checks and remaining limits

New independent source geometry/ordered-selector/mutation checks are in the
already active `test_held_render_contracts.py`. Runtime, exact-owner gating,
changed-content/cache failure, no-per-tick-decode and no-item-mutation checks
extend `test_all_skewer_integration.mjs` and `test_plate_recipe_visual.mjs`.
Existing plate transaction/food-cache checks and both exact generators are used.
No historical assertion is removed and no broad source exception is added.

The retained general render gate currently stops in the independent pre-existing
`test_failure_skewer_assets.py` current-main recomposition assertion after the
resolver extraction. That blocker is reported separately; it is not waived.

Editor fixtures freeze five saved slots and selected slime frames for inspection;
they do not execute native controllers, property delivery, world clocks or item
use. Native/client rendering, lighting, culling, left/right views and performance
remain unverified. `client=false`, `production_ready=false`.
