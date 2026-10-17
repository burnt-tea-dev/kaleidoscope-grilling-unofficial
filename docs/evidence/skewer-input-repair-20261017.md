# Skewer input selection and saved ingredient repair

Reviewed against Grilling main `aa091a1e91035d1510b579af11254a9bc9f86e6b` and the clean author Cookery 1.6.1 archive, CurseForge file 9123386, SHA256 `5b01865d4dd9a455cd80dae4ddc94dc45964e074025f7d24c6f0c5e35f0fbe52` (5,289,086 bytes). This is source and storage-adapter evidence. It is not a Minecraft player run or a rendered-client acceptance result.

## Confirmed producer selection failure

The current author `scripts/data/stationRecipes.js` declares these actual board recipes. The file's SHA256 is `53123aeccf439588b0f9a7a46dcce27fae342e1184b8e5fe0fd18a9de554b2ab`.

| Input | Author 1.6.1 declaration | Previous Grilling registration | Consequence |
| --- | --- | --- | --- |
| `minecraft:beef` | `raw_cow_offal`, count 3, four cuts | Expected `raw_cow_offal`, count 2, four cuts | Registration was accepted, but strict selection rejected it. The two-beef-chunks replacement could not start. |
| `minecraft:chicken` | `outputs`: three `raw_cut_small_meats` and one `minecraft:bone`, four cuts | Expected a single `raw_cut_small_meats`, count 2, four cuts | Strict selection rejected both the changed count and the output shape. The chicken-skin supplement could not start. |

The host insertion passes the real `BOARD_RECIPES` object to `boardApiHost().builtin`; `handleBoardV2` passes that declaration into `createBoardRegistry().select`. The old `a279_beef_board_runtime.js` hook returns false and supplies no alternate repair. Inspecting every reference in the clean host found the table definition and reads in `directStation.js`, with no later table rewrite that changes these inputs to the obsolete declarations.

The defect is in the producer contract before hand threading. It can leave the player with offal instead of the beef chunks required by the configured beef skewer. A successful recipe-registration log did not establish that the author board could select it.

### Repair and retained contracts

`a2727_cookery_host_recipes_core.js` now binds the two current author declarations exactly. The owned `host_api/board_api_core.js` accepts either the existing single-output declaration or a bounded list of deterministic author outputs. Selection still checks output identity, count, order and cuts; a missing bone, a changed count, an added chance rule or a reordered list does not match.

The beef replacement still produces **two Grilling beef chunks**. Chicken supplementation preserves **three Cookery cut meats and one bone**, then adds the already-supported one-to-three Grilling chicken skins. Runtime registration checks the existence of every output, including the bone.

The operation and receipt schema remains `0.1.0`. Old saved single-output operations keep their recorded two-meat contract; new multi-output operations save their complete deterministic output list. Four cuts, the separate release gesture, knife damage, sampling the skin count once, rollback, cancellation and committed-receipt behavior are unchanged. The family extension/version and exported pack freeze are integrated separately.

## Hand threading and extraction

The maintained Java [SkewerRecipes](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/SkewerRecipes.java) uses ordered selectors and exact ingredient counts. All 20 configured rows, their alternatives and their cooked results match the pinned recipe data. Fish and caterpillar complete after one ingredient; chicken skin, fried egg and gluten complete after two. Wrong-order ingredients are not silently reordered.

Three separate defects were repaired around that contract:

- `expectedSize` incorrectly seeded its maximum with three, so one- and two-ingredient recipes always reported three. `writeSkewerRows` also hardcoded the denominator. It now uses the matching Java prefix's expected count. This is a progress-display repair, not a replacement of the ordered recipe matcher.
- `threadCurrent` verified reconstruction of only the newly added ingredient. A damaged existing native envelope could therefore accept and debit another ingredient even though the completed stack could never be disassembled. Every saved and new ingredient is now preflighted before either input is debited.
- Block/entity threading could reach an empty or incomplete secret skewer through a path other than the item-use admission callback. `threadOutcome` now shares `canUseSecretSkewer` for a secret used as an ingredient. Complete three-ingredient zero-nutrition data remains accepted; rendering support does not decide food admission.

The saved row format, creator identity and model-variant payload are unchanged. Existing tag-selected ingredients retain their original IDs and native metadata when the raw skewer is disassembled. Full-flow regression uses the actual secret item's zero-nutrition native food component; a mock that omitted that component incorrectly hid the incomplete-secret threading route.

## Current Cookery ingredient identities

All **ten** Cookery IDs referenced by the configured skewer table exist in the clean 1.6.1 item definitions. None uses Grilling's `_native_plain` or `_java_three_alt` aliases. Tags are the native `minecraft:is_food` where present; the configured Cookery slots match exact IDs and do not depend on a Grilling tag being added to the author item.

| Ingredients | Producer checked in the clean author pack |
| --- | --- |
| Red and green chili | `scripts/events/sickleHarvest.js` and `loot_tables/kaleidoscope_cookery/blocks/crops/chili_crop_mature.json` |
| Caterpillar | Lettuce harvesting in `sickleHarvest.js` and `lettuce_crop_mature.json` |
| Raw pork belly, raw lamb chops, raw cut small meats | Actual `BOARD_RECIPES` in `scripts/data/stationRecipes.js` |
| Raw meatball | `recipes/crafting/food/raw_meatball*.json`: five meat variants produce the same ID |
| Fried egg | Actual `POT_RECIPES` in `scripts/data/stationRecipes.js` |
| Raw dough | Flour-to-dough spawning in `scripts/events/ingredientBehaviors.js` |
| Oil | `scripts/custom_components/blocks/millstone.js` deterministic output IDs |

Only the two relevant board declarations and ten item identity/tag/food declarations are retained in [the bounded fixture](../../development/gameplay_core/fixtures/cookery161-skewer-input-contract.json), with original paths and SHA256 values. No complete author script or archive is included.

## Discriminating checks

Before the repairs, the new Java-prefix assertion returned three instead of two for the first chicken-skin ingredient. The full-flow checks also demonstrated that both an identity-mismatched and an unsupported-version existing ingredient accepted a new ingredient. With the actual zero-nutrition secret native component in the adapter, zero-, one- and two-ingredient secrets all incorrectly passed the threading route. The clean author's recipe declarations independently failed the old producer selector despite successful registration.

After the repairs:

- `node development/gameplay_core/test_a24_core.mjs`: **16 passed**, including all configured Java selector alternatives, order and prefix counts.
- `node development/gameplay_core/test_full_skewer_flow.mjs`: **39 passed**, including tag-selected two-ingredient completion and exact metadata disassembly, mushroom alternatives/wrong order, damaged saved rows, incomplete nested secret admission, and the existing cooking/extraction/settlement cases.
- `COOKERY_161_BP='<clean author BP>' node development/gameplay_core/test_board_api.mjs`: **29 passed**, zero skipped. The fixture was compared to the real source/item bytes. Tests cover exact author selection, every installed output, the resulting ingredients entering fixed skewer matching, failure at either the second or third product, the once-sampled skin count and old single-output operations.
- `COOKERY_161_ARCHIVE='<clean author mcaddon>' python tools/check_cookery161_host.py`: reviewed original/patched source bindings, syntax and the existing scoped author oil/guide checks passed.
- The existing `test_a2752_host_core.mjs` and `test_java_survival_parity.mjs` passed.

These results establish the diagnosed source faults and bounded repair behavior. They do not establish which version was running in the user's screenshot, its precise input sequence, current real-player survival acquisition, input timing, save/reload behavior of the final integrated candidate, or first/third-person appearance. Those remain part of the integrated candidate's separate native and human acceptance records.
