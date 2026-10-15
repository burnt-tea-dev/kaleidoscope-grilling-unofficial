# Exact fixed-mesh THREE route candidate

Local candidate integrated on PR215 head e8da20b1f4f135543c16a604c92c60cfe3093eca (G143). No release identity allocated; manifests and LIVE remain unchanged. PR215 head e8da20b1f4f135543c16a604c92c60cfe3093eca now integrates G143 context/clock and raw-lore work. The isolated local integration preserves its final owning-player conversion and exact witness inversion.

## Cause and narrow change

Canonical cooked lamb and 19 other fixed-mesh IDs did not enter a Java NONE-context player route on their THREE branch. They composed native held pose with item-only motion, so the official Blockbench Player/attachable preview showed the item moving away from an unchanged arm. The separate cooked-lamb candidate joins item and player curves using the existing G127 THREE basis. Editor/source comparison supports this route correction, not a new global scale or camera offset.

The generator adds 20 exact mainhand routes: 19 canonical THREE_RANDOM IDs when resolved to THREE, plus raw ender pearl. It leaves the shared profile registry, shared curves, immutable G127 dedicated clips, existing pearl/secret routes, and all offhand/third-person paths unchanged. Every new helper uses the original Java fixed piece_3 model, its resolved parent JSON and textures pinned by hash. A single new player clip shares the unchanged G127 channels and differs only in its exact route blend gate.

A live gate common to player blend, item motion, legacy suppression, helper visibility, and both arms/sleeves requires first-person, active use, matching projection/profile/hand properties, exact item in mainhand, upright posture, and empty offhand. Existing terminal-only stopExpression is retained so temporarily crouching or equipping the helper does not permanently stop a controller that is later unmasked. Admission still requires valid captured native duration and empty helper. An initially rejected use is not silently restarted.

## Coverage boundaries

- Covered: exact 20 IDs in review-three-route-contract.json, resolved THREE (100 ticks), mainhand, standing, helper empty.
- Each of the 19 random items' THREE_ALT branch remains its pre-existing 90-tick ALT-clone route. No random-ALT improvement or acceptance is claimed.
- ONE, other active profiles, offhand, helper occupied, sneak/swim/glide/ride and third-person retain prior behavior.
- Java refuses a sneaking start before selecting a profile (MultiBiteSkewerItem.use). The existing Bedrock afterEvents use subscriber does not enforce that rule. This initiation mismatch remains separate from standing-start then crouching during use.
- Official Blockbench representative cooked-lamb stage1 at 1.0s, stage2 at 2.35s and stage3 at 3.55s were captured with corresponding remaining-food meshes. Stage3 shows the bare stick and helper-hand piece. Together with the seven stage0 captures, these close the representative editor/source check, without claiming native-game acceptance or all 20 models visually tested.
- Official editor camera and native game camera are not interchangeable. Native equip/bob/FOV, transitions, renderer replacement, skins and all-state parity remain unaccepted.

## Local tests

- New exact-route suite: nine tests, 640 actual generated Molang state contexts; generated registry branch rejection; exact main inverse; unchanged G127 channels; all old modified document fields reversible; missing/model drift rejection.
- Actual production event/settlement harness: 379 passing cases, including all 20 IDs x both hands x helper occupied/empty; no food or helper writes introduced.
- Existing G127 source suite: five passing tests; G126 source suite: four passing tests. Historical witnesses remain immutable and compare after exact new-route inversion.
- Full generation followed by --check passes; full canonical source run is pending. Only exact owner-qualified new route fields are inverted; unrelated existing property/clock strings remain untouched and mutation-rejected.

No pack build or screenshot is evidence of native Minecraft acceptance, and no release/version bypass is part of this candidate.
