# Fortress acquisition audit, 2026-10-17

## Existing chest route verified; no duplicate implementation

G150 already includes the fortress chest route introduced in A2.7.55. Java also has this route, independently of its newer wart replacement handler. Calling this a new non-Java fallback or claiming no initial survival acquisition would be incorrect.

Source: both loader trees at [Java commit 9a1acdab27698457bec16c9362678e574895a28c](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/world/FortressHouttuyniaHandler.java) add a separate pool to `minecraft:chests/nether_bridge`: 65% pool chance, 1–2 rolls, 1–3 houttuynia per roll. This gives 1–6 items when awarded. The existing Bedrock bonus has exactly those parameters. The item plants houttuynia on farmland or soul sand.

Bedrock implements the additive Java event with a wrapper at `loot_tables/chests/nether_bridge.json`. It evaluates the unmodified vanilla table once, then the bonus once. The vanilla snapshot is byte-identical to [Mojang's official table](https://github.com/Mojang/bedrock-samples/blob/46ba6ea985fb5a92d79a9419198f10dda14c199d/behavior_pack/loot_tables/chests/nether_bridge.json), Git blob `071c1feeaccec0f2e9ee39074d76c5862681aa3c`. That pinned commit remained official main at this audit. All original pools, including the armor-trim pool, remain intact.

The table applies when chest loot is generated using that table. It does not inject items into already materialized inventories or refill opened chests. This is a source-level contract, not a new client/BDS loot-generation observation.

Pack precedence remains relevant: another higher-priority pack replacing the same vanilla table can shadow this wrapper; Bedrock does not merge independent pack overrides. The parallel family audit found no exact `loot_tables/chests/nether_bridge.json` override in the complete private BP or the supplied Cookery 1.6.1, Nether, Saturation, ImmersiveEating, ChineseFood and End archives. This finding is scoped to those audited inputs, not all possible third-party packs. No unrelated family registration or loot table is rewritten.

`python tools/test_fortress_loot_current.py` passes three current-contract tests: exact official vanilla blob; unconditional independent single wrapper evaluations; exact bounded Java bonus and plantable species. Unlike historical A2.7.55 release verification, it does not require an obsolete manifest version.

## Remaining wart-replacement limitation

[Java's replacement handler](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/world/FortressWartReplacementHandler.java) uses authoritative `ChunkEvent.Load.isNewChunk` and real vanilla fortress bounds. Inside those bounds it deterministically replaces 25% of wart, maps age 0→0, 1→3, 2/3→7 and sets red=true. G150 contains the validated `fresh_fortress` consumer and hash logic but no authoritative vanilla producer (`vanillaFortressCallbackInstalled:false`).

Official stable API review:

- [WorldAfterEvents](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable) documents no newly-generated-chunk or vanilla-fortress-generation event.
- [StructureManager](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/structuremanager?view=minecraft-bedrock-stable) operates on saved/templates and explicit placements. Its jigsaw placement methods return bounds for structures that the caller places; they do not notify an add-on of native fortress generation or expose its existing structure-start bounds.
- [Features and feature rules](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/featuresintroduction?view=minecraft-bedrock-stable) provide biome attachment and ordered generation passes. These do not supply the required authoritative fortress bounds/new-chunk event. Structure-template features place supplied `.mcstructure` content rather than intercept the native fortress generator.

Therefore no documented stable equivalent satisfying both safety conditions was established. Biome-wide scans, first-seen loaded chunks, proximity to nether bricks and wart-on-soul-sand heuristics cannot prove newly generated vanilla fortress ownership and could affect existing/player crops. None is introduced. Full parity remains gated on a verified native generation hook or an explicitly controlled new-structure producer; the existing chest route remains available without that feature.
