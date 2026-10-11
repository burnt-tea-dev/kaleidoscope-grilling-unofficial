# G126 draft: scoped cooked-caterpillar camera adaptation and bounded HUD hold

This draft starts from G125 main `d10d3b12b6cbbf922b0e940fbf174c7b24edf223` and retains its scene, interaction, ownership, guide and JSON-validation repairs. It is not a Release or LIVE deployment. Pack/module/own-pair identity is 2.8.126; guide identity alone becomes 0.3.56. UUIDs, Cookery 1.6.0 and family API remain unchanged.

## Implemented scope

Only `kaleidoscope_grilling:grilled_caterpillar_skewer`, ONE, right/main hand, first person, standing without sneaking/swimming/gliding/riding and with an empty offhand receives the dedicated projection. Raw, native_plain, alternative foods, offhand use and other views retain their previous routing. The original shared ONE/THREE projection and global player entity definition are unchanged.

The eight-file animation runtime closure includes the two exact BP admission/dispatch expressions, the canonical attachable's mutually exclusive held/eating route, dedicated player/item clips, detached-piece geometry/atlas/controller and the exact first-person arm visibility condition. Keeping the native-tested `kg_probe_caterpillar` internal IDs avoids an untested alias migration.

The old native arm conversion assumed model-camera origin Y=24. Under the standing wide reference model, scale S=0.9375 and eye height E=25.92 pixels imply E/S=27.648. The new mapping applies the complete inverse outer scale and eye origin, including inherited arm/socket scale. Java angles, keyframe timing, item/helper child curves, bite times and settlement are untouched. These parameters are a tested model hypothesis, not constants retrieved from the installed client.

## Bounded graphical HUD hold

The existing graphical HUD hold changes from 75ms to 100ms in the canonical UI and its authoring generator. The original instantaneous alpha 0→1 intro, 1ms owned fade, 102px original textures, 25-tick checkpoint, producer timing and absence of a terminal shared-actionbar clear stay unchanged. The BP runtime change in this component is comment-only. Existing HUD tests retain their previous checks and now also guard the exact curve declaration and generator constant using a read-only AST inspection.

In one separate, controlled no-clear 60-packet client trial, original 30fps frames 9–97 were continuously visible (89 frames), with one icon and the yellow-to-green transition; frame 98 onward disappeared naturally without a black actionbar box or reappearance through frame 449. Recording SHA256: `8a9f47ab46ba509f8415f2f86095a88e5668c1712c366a1a0fed718decc6a206`. The actual cold/reference closure is retained separately. This does not establish every packet-arrival gap, exact client expiration timing, natural eating cancellation/completion, repeated eating, slot changes or full-family/LIVE behavior. The combined production animation-plus-HUD pack has not yet been client-validated, and LIVE’s completely missing HUD remains only partly diagnosed.

## Recorded animation client result and open issue

An isolated Bedrock 1.26.52.3 test used the same Makena classic-wide skin, FOV70, no armor and empty offhand. A 15-second continuous full-use recording showed coherent right/main and left/helper hands, count 1→0 and normal empty-hand restoration. A separate 350ms requested use/release retained one item and returned to the prior held pose. The original and corrected clips were not evaluated by item counts alone.

The main skewer still grows very large near the camera around authored 2.8–3.08 seconds. This is **not accepted as complete visual parity**. The pinned Java main-item render path continues to draw the main stack while the helper is rendered separately. Java NONE display, fixed model centering, wide-hand transform, FOV70 and near plane 0.05m were checked against the Forge/Mojang 1.20.1 renderer. All 32 stage-1 model corners, including the rotated cube, match the current centered geometry. No omitted generic scale or centering transform was found. Direct source geometry also crosses the eye plane in this interval, but an actual matching Java client recording is still required before calling the magnification correct or changing the original curve.

Other foods, slim/custom skins, armor, other FOV, third-person visual regression and the actual LIVE player owner remain unverified. The production pack has not inherited full client acceptance from this narrow isolated trial.

## Reproducibility and conservation

`tools/build_caterpillar_eating_projection.py` is called after all existing `build_eating_motion.py` augmentation. It handles its own route/visibility wrappers idempotently and refuses missing or duplicate modern BP dispatch expressions. Historical A2.0 `build.py`, `runtime.js` and `augment_a*` are not current regeneration tools and are not modified.

Focused checks compare all seven RP runtime files byte-for-byte to the recorded candidate, retain every non-target generated output, regenerate twice, exercise rejection/restore routing and require the modern BP main to differ only in the two reviewed expressions. The existing source, identity, historical witness, baseline and compiled-export gates remain active. Source/CI checks are not Java or client visual acceptance.

Recorded source evidence is summarized in `development/gameplay_core/fixtures/caterpillar-camera-native-20261009.json`. Original recordings and machine logs are retained separately and are not published in this repository.

## Upstream status

The selected animation source remains author revision `9a1acdab27698457bec16c9362678e574895a28c`. A read-only BSM metadata check at 2026-10-09 22:35 UTC read the unchanged status file last checked at 22:23:04 UTC (SHA256 `f796b46ddcb09f11856c7e7c5d4cb31f3cd36f8cabb5fc45f826b9b360170860`). It lists Grilling author 1.1.1 for Forge1.20.1/CF8726006 and NeoForge1.21.1/CF8726014, with newest author and stable files equal. Its status is `reference_metadata_current_parity_pending` and `parity_verified=false`; it is not G126 deployment, error-free execution or complete adaptation evidence.

The matching public family registry was read at Git blob `6837a24050fcc4c95cad72de528eea9374ba8755` (`kaleidoscope-tavern-unofficial/family/java-upstream.json`); its Grilling Forge/NeoForge reference file IDs agree with the BSM metadata and retain explicit parity-pending scope.
