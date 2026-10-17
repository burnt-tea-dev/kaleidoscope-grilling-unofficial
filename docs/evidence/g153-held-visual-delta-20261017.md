# G153 held-visual delta: native Blockbench evidence

Reviewed against G150 `aa091a1e91035d1510b579af11254a9bc9f86e6b`, with composed G153 based on `5bc8f43f45a6cd0d287b5557db24e2da4dd2c207`.

**Result:** New ingredient visibility, palette colors, and sprite geometry/UV are supported by native Blockbench 5.2.2 evidence. Hand-contact, offhand pose, Minecraft client acceptance, and production readiness remain unaccepted. No runtime source or pose was changed by this review.

## Source scope

Paths are relative to `projects/grilling/gameplay_core/resource_pack/`:

- New `attachables/secret_skewer_native_plain.attachable.json` and `textures/secret_food_palette/food_{214..217}_{0..6}.png`: four new foods across seven styles. Static ingredient display uses the existing 85 primary secret geometry references and unchanged right/left calibrated idle clips from `animations/secret_idle_fp_calibration.animation.json`.
- `models/entity/secret_helper_sprites.geo.json`: tea egg, butter tea, clay-pot milk tea, and mystery tea sprite routes. Three geometries are appended; butter tea reuses existing geometry. All 24 food mappings across six secret/dark/mysterious primary/alternate aliases agree.
- Updated secret/unfinished/plate and dark/mysterious alias routes and selector bounds in the corresponding `attachables/` files and `render_controllers/{secret_held,failure_skewer_held,plate_held}.render_controllers.json`.
- Separate oil 225/226 and crop repairs retain their separate review evidence. Placed/station visuals are outside this held-delta scope.

## Checks and results

- **38/38 delta jobs plus 2/2 bounded reference controls** completed in the actual native application. **156/156** 1280×720 captures passed decode/dimension checks; no importer/Validator errors or warnings, texture-load errors, or non-finite mesh/recorded-pose errors.
- Pixels reviewed: all **28** food/style reference views, **12** sprite front/45°/side views, **6** scoped player controls, and **2** socket-reference controls. This is not a claim that all 156 captures were individually visually accepted.
- Main-hand native-plain samples show three ingredients; unfinished shows two; plate shows five populated rows. Palette colors and sprite silhouettes/side faces are coherent.
- **346/346 native Molang checks passed:** 168 ingredient decode combinations, 112 secret-owner boundary cases, 32 failure-helper indices, and 34 plate cases. Both hands accept secret markers221–224 and reject oil225/226 and plate255 on secret routes; plate accepts255 and rejects secret/oil markers. These use scalar owner/query fixtures, not a running game engine.
- Exact comparison supports reuse of 2,755 unchanged geometry/animation identifiers and the prior full G150 evidence within its original limits. All 42 recorded G153 source files and four dependency texture files retained their recorded hashes.

## Pose and camera limits

Palette views use the prior single-attachable editor reference, not a hand-contact reference. Scoped player controls use the native Player-Wide reference, player/item animation scopes1/2, camera [0,27.41,0] toward [0,27.41,10], FOV70.25, 16:9.

The original old/new main samples both show a gap above the hand. A bounded fixture-only control removed Blockbench's documented extra socket -7Y using its official player rest/pivot values. Parent/socket matrix error was at most 3.55e-15; grip/socket error and arm-matrix change were zero. The gap disappeared in both samples, but the lower stick lies near/beyond the frame edge. This supports an editor-reference explanation; it does not establish exact hand contact or equivalence to the Minecraft player animation stack.

Left-binding diagnostics are clipped and use an editor-only binding substitution because the built-in reference is right-hand-biased. **Offhand pose is not accepted.** No runtime pose was adjusted from these previews; no eating-transition or live-client acceptance is claimed.

## Cookery dependency texture pins

These are the exact Cookery resource-pack textures used for the sprite review. A different dependency bundle must establish byte equality before inheriting this evidence.

| Cookery RP-relative path | SHA-256 |
|---|---|
| `textures/items/kc_tea_egg.png` | `e3852c17398d79a3b5812eb4ed7aa96ed68c5f994ad5a8f33483cf436d54e949` |
| `textures/items/kc_butter_tea.png` | `b47d9de3bec044406c0560c2be9022262ca03b3efe4eac8ac395a72af47cde3e` |
| `textures/items/kc_clay_pot_milk_tea.png` | `493ccbbcd8a7a7c71a5c578cd3c375a429225de3e0fa1f2c703f60cc46869d3c` |
| `textures/items/kc_mystery_tea.png` | `ba3ee47dd6ce50ed5983796f0e98672534b215f9ffffad93f72226ced4cd9d72` |
