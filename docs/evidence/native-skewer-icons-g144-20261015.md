# G144 — native animated inventory icons and visible shape integration

## Actual source changes

Java reference: `breezeth-CN/KaleidoscopeGrilling@9a1acdab27698457bec16c9362678e574895a28c`. Reused native rendering design: Tavern `tools/animated_item_render_contract.py`, blob `6abe52081363b5f6964a4d3e20ef0e7092a89ea1`; BSD notice retained in `docs/licenses/tavern-native-item-rendering.txt`.

- Grilled slime and mysterious skewers use original five 16x16 GUI frames at four ticks per frame. Raw slime remains static, matching SkewerGuiIconCache.fixedIcon/failedIcon.
- Existing food IDs route through a placement-disabled block_placer, render-only item_visual and terrain flipbook, not an inventory-swapping timer or fake HUD icon. All five canonical/native_plain/java_three_alt food aliases are covered.
- Food durations, nutrition, tags, stack size and input flags are unchanged. Existing scripts, attachables, player/eating clips and item_texture.json are unchanged from G143. This preservation is a source fact, not proof that the engine prioritizes every renderer identically.
- Reuses #217's exact two shape blobs and checker: grill collision/selection height 4; wall rack origin [-7,5,3], size [14,9,5]. No rewrite of the original PR's work; plate selection remains 7.

## Evidence obtained

G143 review artifact BP/RP fingerprints independently matched the maintained baseline. The same icon contract check fails on that unmodified runtime and passes after authoring. Four focused icon tests and six reused shape tests passed. Original PNG blob hashes and all five output-frame pixels are checked, including the intentionally repeated slime frame. These tests are source/pixel/shape calculations, not Minecraft observations.

Owner-only staging #221 produced canonical commit `03e0267d878bd1a1f8616f98391d000b885472ba` and ran the existing version-claim/freeze and clean release-baseline checks. This final candidate removes both temporary authoring tools; packaging does not execute a gameplay transform. Normal canonical CI validates committed outputs separately. No full-CI success is inferred from the authoring job.

Frozen version 2.8.144:
- BP: 778 files; SHA256 `8982ec548dd11809ea87ba69faeef2516061ecc379b6d293b9e3e4b3fd407abd`.
- RP: 3628 files; SHA256 `996c7c785f745f743a81047854b08dceb5d5653c772e43f45d8fbe55a333e2eb`.

The downloaded authored source was independently fingerprinted against those exact values. Historical release entries were not rewritten. UUIDs and reviewed external dependencies are retained.

## Not completed / priority remains open

1. Per-stack unfinished/secret-skewer ingredient order, count, colors, cookedness and variant composition is NOT implemented by a time flipbook. Current fixed fallbacks remain open under #166. Reuse the native route, but connect actual stack data rather than pretending a generic animation is a dynamic recipe icon.
2. P0 eating/holding fixes remain separate. Existing #220 contains scoped 20-ID THREE projection work; it was not created or executed by this task, and must not be overwritten. First/third person, both hands, cancellations, repeat eating and near-camera/terminal planes still require exact integrated source and client validation. In particular mysterious/dark 3D held models are not repaired by this GUI sprite.
3. P0 seasoning full use/removal/shake/sprinkle and HUD latency; P1 other item models/UV, leaves and remaining shapes; P2 special mechanics; P3 optional compatibility remain prioritized in that order, with item loss/duplication always a release blocker.

Actual subagents were unavailable (workspace connection failed; no dispatcher); this batch was authored directly. No Blockbench, BDS, Minecraft client or live-server acceptance was performed. Required client checks include inventory/hotbar/container/creative visuals; first/third/main/offhand use, canceled/continuous eating, use-on-block not placing hidden proxies, falling items, particles and full-family resource order. Keep draft and client=false until the relevant gates are met.
