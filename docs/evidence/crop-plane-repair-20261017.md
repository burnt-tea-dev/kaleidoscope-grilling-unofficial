# Crop plane and UV repair, 2026-10-17

Base: G150 main `aa091a1e91035d1510b579af11254a9bc9f86e6b`.
Source: current [Java main](https://github.com/breezeth-CN/KaleidoscopeGrilling/tree/9a1acdab27698457bec16c9362678e574895a28c), rechecked on 2026-10-17. Both supported loader trees retain the same age-7 crop contracts.

## Diagnosed and repaired

The reported farm image shows houttuynia, sweet potato, onion and canola (near to far). Their 35 stage textures are byte-exact copies of current Java assets, with strictly binary alpha. This is not a missing-transparency texture defect.

- Houttuynia and sweet potato shared two diagonal planes using box UV `[0,0]`. For a 16×16×0 cube the reverse face extends to U32 on a 16-wide texture. That out-of-bounds sampling explains the edge-color strips seen by the Bedrock client. Both now use Java `minecraft:block/crop`'s four axis-aligned planes at offsets 4/12, Y−1..15, with explicit bounded two-sided face UV and the source's mirrored reverse faces.
- Onion's Java models use `minecraft:block/cross`, unlike the two crops above. It now has a dedicated geometry and block route. Its two planes preserve vanilla 14.4-pixel width, 45-degree rotation and `rescale=true` by baking the √2 horizontal scale; vertical extent remains Y0..16. Both faces map to the complete source texture.
- Canola uses Java [`tall_crop`](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/assets/kaleidoscope_grilling/models/block/tall_crop.json). Its old two-plane geometry compressed 28 texture pixels into 16 model pixels. It now uses four planes, Y−1..27, and uncompressed 16×28 face UV. This remains within the documented [30-pixel custom block limits](https://learn.microsoft.com/en-us/minecraft/creator/documents/customblockoversized?view=minecraft-bedrock-stable).

All existing block IDs, age/red states, single-sided alpha-test material permutations, texture bytes, selection boxes, placement filters and loot tables are preserved. No runtime scripts change in this patch. Onion's geometry identifier is an internal RP reference, not a saved-world block/state identity.

## Verification

- `python tools/test_crop_geometry.py`: three focused tests pass, covering source plane topology, cross rescale and all 35 stage material/UV/alpha combinations. On unchanged G150 this same test fails on four concrete assertions (UV representation, both four-plane layouts, onion route); there are no harness errors.
- Existing `test_a2714_core.mjs`, `test_a2715_core.mjs`, `test_a2717_core.mjs`, `test_a2719_core.mjs`, `test_a2731_core.mjs`: pass. These check growth, placement, mature drop formulas and host IDs; no new claims of gameplay execution.
- `node --experimental-vm-modules --test development/gameplay_core/test_plant_fertilizer_runtime.mjs development/gameplay_core/test_plant_fertilizer_storage.mjs`: 37 pass, zero failures. These load current production modules against controlled API doubles.
- Actual native Blockbench 5.2.2: 70 before/after geometry imports (all 35 stages), then 40 explicitly front-sided texture fixtures (35 corrected stages and five mature before references), three views each. No import/validator errors or nonfinite meshes. Corrected stages were visually reviewed together; all retain complete plant silhouettes without opaque filler planes. The second batch records material side=0 for every fixture and uses the original binary-alpha PNGs. Native Blockbench still uses its own transparent shader, not the Bedrock renderer.
- The front/side editor screenshots do **not** establish reproduction of the client's reverse-face clamp behavior. The UV defect is independently demonstrated by source mapping; complete Minecraft client acceptance remains outstanding. No BDS, saved-world or client test is claimed here.

The historical standalone `test_a2714_runtime.mjs` harness cannot load current production imports because its server mock lacks `BlockPermutation`. The maintained fertilizer harness above is used instead. Historical tests are not rewritten to conceal that mismatch.

This is a source patch for a new integrated release. It does not reuse G150 as a release identity; paired version/baseline/history, canonical CI, packaging and family gates belong to the integrating candidate.

## Separate acquisition gap

The current Java [fortress handler](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/world/FortressWartReplacementHandler.java) replaces a deterministic 25% of wart inside real fortress bounds in newly generated Nether chunks, preserving age 0→0, 1→3, 2/3→7 and forcing the red variant. Grilling's API contains the validated `fresh_fortress` consumer but explicitly reports `vanillaFortressCallbackInstalled:false`. A consumer is not a generation producer. This gap is specific to wart replacement: initial survival acquisition already exists through Java-matching fortress chest loot, introduced in A2.7.55 and preserved by this patch. See [the acquisition audit](fortress-acquisition-20261017.md). No existing-wart scan is introduced.
