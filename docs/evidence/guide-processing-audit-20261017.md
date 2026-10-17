# Guide process audit — 2026-10-17

Scope: every current catalog entry and its source references, the seven released Java millstone recipes, canonical Grilling recipe registration, native crafting/cooking recipes, board and hand-use operations, oil and seasoning flow. This is a source audit, not client acceptance.

## Actual powder failure

Cookery Bedrock 1.6.1 `scripts/custom_components/blocks/millstone.js` SHA256 `56a991ed57479f12d9700f9bcdb7811b072bf205f5851c7c5cbb7428188f598c` accepts extension recipes inside `tryLoad`, but its hand, worker-inventory and dropped-item admission gates check only built-in `RECIPES`. Registering Grilling recipes does not make these inputs usable. A family host compatibility repair is required for all three gates. Guide changes must ship together with that repair; they do not fix host gameplay themselves.

The audited host component defines an intact 3×3 footprint, maximum eight identical inputs, an adult unridden worker (equines must be tamed), normalized 100-tick processing, front-side output ejection and sneak-empty-hand worker release. The crafting recipe is ` F /SG /TTT`, wooden fence / stick / vanilla grindstone / three smooth stone. No drying, roasting, furnace, fuel or manual crank precedes powder processing.

## Recipe witnesses and ownership

Released Java 1.1.1 NeoForge 1.21.1 fixtures and original JAR hash are in `development/gameplay_core/fixtures/java-1.1.1-recipes/SOURCE.json`. All seven millstone inputs/results/counts are independently compared with the canonical registered recipes and the guide's process contracts by `tools/check_grilling_guide.py`. Java recipe evidence does not certify Bedrock host interaction or Java-wide parity.

| Process | Canonical evidence | Guide treatment |
|---|---|---|
| Seven powder recipes | `a2727_cookery_host_recipes_core.js` and released `millstone/*.json` | Exact input, output, count, worker, insertion and collection on every powder page; dedicated existing-guide workstation entry |
| Chopping | Same recipe registry; board API | Four cuts plus release interaction, input/output counts on every plain board page |
| Sweet potato kneading | `a271_sweet_potato_core.js`, runtime | Entire held stack converts after 30 ticks, also on sheet page |
| Cold houttuynia | `a2722_cold_houttuynia_runtime.js` | Sneak-use the crafting table, not merely stand beside it |
| Chili acquisition | Cookery 1.6.1 `events/strawHatDrops.js`, `blocks/crops/chili_crop_mature.json`, `events/sickleHarvest.js` | Straw hat/short grass seed route, farmland, mature red harvest and 20% green bonus; colors not interchangeable |
| Bottle | `main.js`, seasoning contract and empty bottle recipes | Base ingredients and powder process navigation precede fill/shake/use instructions |
| Oil | `a26_oil_machine_*`, native chili-oil recipes and host oil API | Retain exact cake, pressure, vat, bucket and pot contracts; no invented drying |
| Fixed skewers | `a24_skewering_core.js` | Existing exhaustive recipe-order/card checks retained |
| Wok / stockpot | Host recipe registry and cuisine cores | Existing exact/flexible recipe, timing, stirring, carrier and optional Tavern checks retained |
| Rack / crops | Canonical corresponding cores | Visual repairs do not change acquisition/slot contracts |

Every entry remains inside the existing six-category Grilling chapter. No parallel guide, physical book, host renderer replacement or translation gameplay patch is introduced. Existing effect, nutrition, acquisition and recovery notes are retained unless the audit identifies a specific inaccurate instruction. Generic recipe-only placeholders are replaced with concrete instructions where found.

## Houttuynia acquisition: existing Java chest reward, separate generation gap

Correction after inspecting the actual loot tables: G150 already contains the A2.7.55 Nether-fortress chest fallback. `loot_tables/chests/nether_bridge.json` includes the preserved vanilla loot table and `kaleidoscope_grilling/fortress_houttuynia_bonus.json`. Current Java `FortressHouttuyniaHandler.java` at commit `9a1acdab27698457bec16c9362678e574895a28c` has this same chest reward; only its additive loot-event mechanism differs from the Bedrock table wrapper. The bonus pool has a 65% gate, one to two rolls, each giving one to three plants: 1–6 if awarded. Existing generated inventories are not modified. This source-supported route is now described first on all seven dependent pages; cultivation works on farmland or soul sand. No additional loot bonus is added by this guide change.

The canonical integration API still reports `vanillaFortressCallbackInstalled:false`, and no authoritative producer is installed. Therefore Java's approximately 25% wart replacement during new fortress generation remains unimplemented. The guide separates this parity gap from the working chest acquisition adaptation; lack of a generation callback alone must not be reported as no survival source.

## Release boundary

This change requires a paired exported-pack version and regenerated payload/languages in the combined release. Millstone host fix, canonical PR checks, exact family export, BDS/saved-world gates and human navigation/gameplay acceptance remain separate. No LIVE deployment or human/client success is claimed here.
