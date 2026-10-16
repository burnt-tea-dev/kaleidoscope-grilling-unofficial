# G148: active third-person seasoning item contributor

## Confirmed source gap and bounded correction

G147 had the player-arm seasoning wave but no active item-local half-turn on its SPECIAL third-person main-hand route. Both maintained Java branches insert that separate contribution immediately before the item renderer; the operation therefore precedes the model display transform. G148 adds one generated absolute grip pose and selects it exclusively with the existing idle hold on 65 SPECIAL attachables.

The correction preserves existing FP curves, idle poses, player-arm equations, offhand, pending/empty/partial bottles, geometry, UVs, PNGs, materials, transaction code, property synchronization and timing. Only 65 attachable dispatch descriptions, one new animation document and paired version identities change in exported runtime (68 paths; 4,501 runtime files). UUIDs, Cookery 1.6.0 dependencies and engine/API requirements remain unchanged.

## Author version and provenance

Read-only published-file checks on **2026-10-16 10:25–10:29 UTC** found the maintained releases still at **1.1.1**:

- [Forge 1.20.1, CurseForge 8726006](https://www.curseforge.com/minecraft/mc-mods/kaleidoscope-grilling/files/8726006), [Modrinth dwwwzjdV](https://modrinth.com/mod/kaleidoscope-grilling/version/dwwwzjdV). Published JAR SHA256 `8f13c33b0982e6d61344888b663e3ff7c949c0b7af3bc63af9257220f23a0d38`.
- [NeoForge 1.21.1, CurseForge 8726014](https://www.curseforge.com/minecraft/mc-mods/kaleidoscope-grilling/files/8726014), [Modrinth ao5iN7Jb](https://modrinth.com/mod/kaleidoscope-grilling/version/ao5iN7Jb). Published JAR SHA256 `cf31071e4ba790bcd5c1d3f6005439bc512acba084e70b8ab6a767e8c8f99dd6`.

Both version listings and exact archives were checked; archive size/SHA512 matched the publisher metadata. Modrinth's version-list response was cache-served; its complete version IDs matched the freshly revalidated project metadata. No package was installed or executed. The BSM `addon_quality` status file was unavailable in this environment, so no such check is claimed.

The retained source revision is [9a1acdab27698457bec16c9362678e574895a28c](https://github.com/breezeth-CN/KaleidoscopeGrilling/tree/9a1acdab27698457bec16c9362678e574895a28c), tree `4267a56f86afdf566923d5fff96d2cc9aed33d93`. In both source branches, `ItemInHandLayerAnvilPressMixin` admits a Player's dominant main arm, SPECIAL stack and nonnegative seasoning progress, pushes the pose, applies Z180 before `ItemInHandRenderer.renderItem`, and pops afterward. `PlayerAnvilPressMixin` makes elapsed tick values outside `[0,10)` inactive. The exact published JAR class bytes and injection annotations independently retain these selected operations. This does not assert whole-JAR/source equality, successful Mixin application or game execution.

Exact official Mojang 1.20.1/1.21.1 class/mapping artifacts and Forge 47.4.0/NeoForge 21.1.228 source patches were inspected. The downstream selected/default author asset path is handed display translation, XYZ rotation, scale, optional platform rightRotation, then model centering. The 65 selected fixed-state model definitions have no custom loader, parent, override or right_rotation; the platform default contributes identity. Generated-skewer substitution does not select these bundled seasoning IDs. Custom resource/data/script/model overrides remain outside this proof.

## Matrix order and implementation

With column vectors, write the existing local hold as `L0 = inverse(B) A D`, where B is the existing Bedrock socket basis, A the existing adapted pre-display prefix, and D the complete handed display suffix (translation, rotation, scale, centering and converted mesh offset). The source insertion J is Z180 **before D**:

`L1 = inverse(B) A J D = L0 inverse(D) J D`.

This relative identity cancels the unchanged upstream prefix. It does not prove the existing absolute player/socket adaptation is exact. Adding 180 to the final Euler Z is wrong: it omits the conjugated translation and misses an asymmetric test marker by about 20.49 model units.

`held_pose_frames.make_pose(..., tp_item_inversion=True)` performs the pre-display insertion only for bottle/TP. Its default path is unchanged. The new `animation.kg_seasoning.item.sprinkle.tp.right` is a constant looped absolute pose:

- position `[0, -0.74242356, -0.87035570]`
- rotation `[-111.80446033, 20.37701641, -138.96513311]`
- scale `[0.5, 0.5, 0.5]`

It is admitted only for SPECIAL, TP, `main_hand`, captured `season_hand == 1` and nonzero `season_phase`. `tp_right` receives the exact complementary gate. Both use the existing initialized owner-property cache. Inactive/unknown state returns to the old hold; the correction adds no new timer or automatic completion logic. A source success must leave a SPECIAL stack held (for example r2→r1); the last-dose replacement has a different item category.

This follows the official [Bedrock animation alias/dispatch and cumulative-channel model](https://learn.microsoft.com/en-us/minecraft/creator/documents/animations/animationsoverview?view=minecraft-bedrock-stable): two absolute poses must not contribute simultaneously. Existing owner-property guards follow [the official property/has_property guidance](https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontoentityproperties?view=minecraft-bedrock-stable). The coordinate converter, static class parser, matrix reconstruction and editor placeholder controllers are project/community tooling, not Mojang-certified equivalence tests.

## Verification and historical conservation

- The focused generator, selector and matrix checks exercise all 65 descriptions, exclusive activation and unchanged default frame generation. The independent matrix check uses NumPy/SciPy and a diagonal half-turn rather than the converter's trigonometric code.
- Both handed mathematical references reconstruct the existing idle channels. Eighty-six basis/asymmetric/cube markers per reference bound the eight-decimal active-channel reconstruction error below `4.32e-9` model units. This is a local double-precision encoding residual, not a cross-engine acceptance tolerance or bit-exact Java/JOML float proof.
- `tools/seasoning_tp_source.py` validates exact generator output against an immutable reviewed pre/postimage ledger, then reconstructs the exact G147 runtime for the retained G147/G146 conservation chain. Only exact changed SPECIAL postimages may be mapped to historical witness bytes; hostile edits, additions, deletions or forged ledgers fail.
- The existing static render audit reports zero errors. Its bound-bone heuristic adds 65 high-priority warnings for this intentionally transformed `grip`; source consistency and native binding acceptance are separate, so the warnings are retained rather than suppressed or counted as proven defects.
- Prior release history and historical motion fixtures remain unchanged. Full canonical/compiled CI and new native editor evidence are separate gates; this document does not declare them complete.

## Remaining parity work

The item contributor is only one source correction. Absolute Java/Bedrock player/socket composition, native binding and cumulative animation behavior, actual 10-tick endpoint and cancel/restart, full renderer/materials, client frame timing and other actions' priority remain open. Java's global player animation timer and Bedrock's captured hand/item/slot cancellation are different contracts. Java dominant-left main arm is not Bedrock offhand; the left mathematical reference is not assigned to the custom offhand route. The pre-existing generic SPECIAL geometry choice (Bedrock r8/v0 versus Java default remaining0 with property overrides) remains separate. Existing FP camera-clearance/mirroring adapters, arbitrary ingredient palette sampling and native offhand framing remain unresolved. No client, full Java parity, release, family installation, saved-world or deployment acceptance is implied.
