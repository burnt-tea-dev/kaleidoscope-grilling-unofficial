# Cookery seasoning Uses lore repair

Source base: G127 `4524942dbc88c04eff02f05989b37fe0abb2fe6b`. This follow-on draft source commit preserves that commit and its historical evidence. Its runtime changes are limited to `bottle_lore_core.js` and `a2750_cookery_cuisine_runtime.js`; release identity is finalized separately before candidate packaging.

G125 native Survival testing observed the actual count decrease correctly from 16 through exhaustion, returning exactly one empty bottle. Intermediate tooltips accumulated stale Uses rows. The Cookery filter only removed strings while localized/engine-returned lore contained RawMessage objects. This was a display failure, not demonstrated item duplication.

The repair replaces only owned translated Uses entries and exact legacy `§7Uses: N/16` forms (including single-node wrappers), prepends one localized current count, and preserves ingredients and unrelated/custom lore. Uses storage, variant selection, station settlement and empty-bottle replacement are unchanged. The focused pure-value regression covers replacement, wrapped stale rows, preservation and repeated consumption-shaped serialization; it does not simulate Minecraft.

## Narrow native diagnostic evidence

The two exact patched scripts were temporarily cold-staged in an isolated G125 public-family client, in both root and world-embedded BP copies. A fresh bottle containing the three base seasonings was naturally shaken, then used twice on a Cookery pot. Three independently reviewed tooltips showed exactly one Uses row at **16/16 → 15/16 → 14/16**, with **Ingredients 3/8** retained. This crosses the second-use item-variant retarget boundary. The pre-existing dirty bottle had already exhausted; native cleanup of a pre-existing stale bottle was not tested. Audio was unavailable.

All four physical scripts were restored cold at 2026-10-11 07:46 UTC. The complete pack map and references matched the baseline. Rollback receipt SHA256: `58ca9a8936ec9379d3427a20c27198dbc3fa849c8f2e4d1d24e7aeac4d00f654`. Independent original-image review archive SHA256: `285e79415b4ebac0a6b33f8f8bd84568d39f2542f2f91acfa9de131dd416048f`. No original media, worlds or machine-specific logs are published here.

These are G125 DIAG1 observations for the two exact source postimages, not combined G127/G128 package acceptance. Full-family/BDS, combined-package native and saved-world acceptance remain pending; `client=false`, `production_ready=false`. No merge, release or deployment is included.
