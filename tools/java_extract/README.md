# Java data extraction

T2.3 reorganizes upstream data without changing BP/RP. The generated JSON in
`data/java/` is reference data for later work, not a new runtime input or a claim
that existing Bedrock behavior matches Java.

## Reproduce

Requires Python 3.10+, Git and Pillow. No Minecraft instance, Java execution,
Gradle build, existing `development/` fixtures or historical port Git objects are
needed. The extractor never imports or executes upstream code.

```sh
python3 tools/java_extract/extract.py
python3 tools/java_extract/extract.py --check
python3 tools/test_java_custom_skewer_gui.py
```

The first command clones the official Grilling and Cookery repositories into
`/tmp/kaleidoscope-java-extract` and checks out Grilling
`9a1acdab27698457bec16c9362678e574895a28c`. Cookery sources are read at their exact
Forge/NeoForge 1.6.0 commits. Additional publisher inputs are the official Minecraft 1.20.1/1.21.1 client
JARs and the pinned 1.21.1 asset-index/sounds JSON. The 1.21.1 client SHA-1 is
`30c73b1c5da787909b2f73340419fdf13b9def88`, for redstone/gunpowder and particle PNGs plus dimension JSON. The 1.20.1
client SHA-1 is `0c3ec587af28e5a785c0b4a7b8a30f9a8f78f838`; only its three
dimension-type JSON entries are read. These
item textures are in the client JAR, not the external sound asset index. Both JARs
stay outside the repository and are not redistributed. No OGG samples are
downloaded; sounds metadata references their publisher hashes.

For an offline run with existing inputs:

```sh
python3 tools/java_extract/extract.py \
  --upstream /path/to/pinned/grilling \
  --cookery /path/to/cookery/repository \
  --minecraft-jar /path/to/minecraft-1.21.1-client.jar \
  --minecraft-1201-jar /path/to/minecraft-1.20.1-client.jar \
  --asset-index /path/to/minecraft-1.21.1-assets.json \
  --sounds-json /path/to/minecraft-1.21.1-sounds.json \
  --check
```

`--output /tmp/java-data` generates a separate tree. `--check` regenerates all
files in memory and compares content and file set. Source checkout modifications
or untracked files in scanned source roots are rejected. No credentials,
network write, runtime modification, deployment or version bump is involved.

## Tables and canonical-runtime consumers

Runtime paths below are relative to
`projects/grilling/gameplay_core/behavior_pack/scripts/`.

| Table | Original source and meaning | Runtime consumers / correspondence |
| --- | --- | --- |
| `recipes.json`, `tags.json` | Complete `recipe/`, `recipes/`, `grilling/`, `tags/item` and `tags/items`, preserving loader-specific paths and all Create integration recipes | `data.js` raw/cooked IDs and effects; `java_ingredient_tags.js`; `a24_skewering_core.js`; host recipe registries |
| `foods.json` | `ModItems` registrations and helper resolution; constructor effects versus bundled `SkewerItem` overrides; nutrition, saturation, explicit ticks/seconds | `data.js` FOOD_DATA, COOKED_EFFECTS, RAW_NAUSEA; `eating_data_lookup.js`; `a2732_standalone_food_effect_core.js` |
| `eating_profiles.json` | `MultiBiteSkewerItem` duration/checkpoints/minimum/grace and `ModItems.animationProfile` mappings | `data.js` PROFILE_BY_ITEM; eating clock, route and item modules |
| `animation_curves.json` | Authored float arrays and numerical expressions from both loaders' eating, seasoning, oil and press animation classes | Eating/motion and seasoning projection modules; curves remain source data, not a claim about Bedrock rendering |
| `heat.json` | `FoodState`, `HotFoodConfig`, grill and oil classes; named 100-tick bucket, 800/400 grill thresholds, oil-pot durations/capacities, config defaults | `a23_hot_merge.js`, `a23_hot_runtime.js`, grill core, `a2738_oil_contract_core.js`, food state adapters |
| `effects.json` | Seasoning/effect classes and secret/golden/cursed food rules, including formula operands and their containing methods | Seasoning registry/core, `a285_ingredient_effects.js`, `food_finish_core.js`, secret compatibility |
| `hud.json` | Java HUD sizes and expressions, with named eating bar size/offset/tint | `java_eating_hud_data.js`, `java_eating_hud_core.js`, `a2739_*` through `a2745_*` HUD modules |
| `seasoning_colors.json` | Actual source sampler parameters plus eight independently sampled PNG palettes; Java HashMap merge tie order | Seasoning visual/color tables; includes separately attributed Mojang inputs |
| `sounds.json` | Upstream event resources and sound call arguments, including volume/pitch expressions | Feedback and ambient sound modules; engine-specific aliases remain adaptations |
| `collision_shapes.json` | Shape primitives, fractional bounds, complete union/selection expressions and block registration properties | Grill/rack/bottle/plate collision definitions; these are Java shapes, not Bedrock acceptance |
| `model_frames.json` | Six secret-skewer reference models' displays, bounds/rotations and remaining tint slots | Secret framing reference; the existing licensed source snapshots remain authoritative geometry/assets |
| `world_data.json` | Authored loot/worldgen/advancement/damage JSON | Acquisition, crops and advancement modules |
| `gameplay_rules.json` | Remaining numerical declarations/expressions indexed by original class/method/line, including helpers, crop/drop and item formula rules | Traceability for Java-derived values outside the named tables; this is not evaluated game behavior |
| `cookery.json` | Selected actual effect/quality rules from both pinned Cookery branches | Projectile dodge, hinder, flatulence and cuisine quality consumers |
| `minecraft_assets.json` | Seven publisher sound events/sample references and nine particle sprite identities/dimensions from actual official inputs | Feedback sound aliases and ordinary-skewer particle resources; renderer equations remain separate |
| `minecraft_dimensions.json` | Three dimension-type JSON records per version; logical max = min_y + logical_height - 1 | `projectile_dodge_movement_core.js` Y bounds, including Nether logical max 127 rather than build max 255 |
| `external_sources.json` | Provenance and archive links for all 21 former JSON fixtures | Distinguishes regenerated semantic data from archived Mojang/Bedrock observations; does not copy historical proof/receipt payloads |

All Grilling tables identify the original commit and extraction method. Source
records include path, stable URL and SHA-256; rules also identify method/line.
Numeric arrays and literal arithmetic are structured values. Symbolic expressions
remain explicitly unevaluated. Authored decimal floats are not an assertion of
bit-exact Java float rounding; Java casts and unsupported expressions fail closed
or remain symbolic. This is source extraction, not a Java interpreter.

## Known distinctions, not repaired in T2.3

- Java's raw-skewer constructor nausea fallback is **60 ticks**, while bundled
  data records override the effect with an empty effect. Both are retained.
  Bedrock RAW_NAUSEA reflects the constructor fallback; matching that flag alone
  does not prove Java effective gameplay parity.
- Java oil brushes are unobtainable `DescriptionItem` placeholders. The
  1200/12000/24000-tick values come from **oil pot** `heatDuration`; applying them
  to Bedrock brushes is a port adaptation.
- The six original secret framing reference models are extracted; other model
  geometry/textures stay in `source_snapshots` rather than being duplicated here.
- Vanilla food nutrition/effect fallback tables are explicitly from Mojang
  bedrock-samples, not Java; their existing native provenance is unchanged.
- Vanilla blocksMotion identities and Bedrock ABI/state-domain observations are
  boolean/engine compatibility evidence, not new Grilling numerical constants.
  Their source/observation references remain in the external index. Archived
  engine experiments and vanilla particle equations are not newly reproduced or
  certified by this tool. The actual movement bounds, seven sound event records
  and nine sprite identities are independently extracted here.
- Source equations and collision selection rules establish provenance; they do
  not certify client visuals, native collision, deployment or player acceptance.

## License

`data/java/LICENSE-CODE`, `LICENSE-ASSETS` and `NOTICE` are copied byte-for-byte
from the pinned Grilling checkout. Code and derived source excerpts retain the
BSD-3-Clause notice; assets retain CC-BY-NC-SA-4.0 attribution. Cookery carries its
own original license notice in its table. Mojang inputs remain separate and the
client JAR is never committed.
