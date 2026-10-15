# Canonical bridge. workflow

Animation, item-display and held-render repairs first follow the [official-source-first workflow](ANIMATION-ITEM-REPAIR-WORKFLOW.md). It defines native Blockbench scoped preview, repeatable camera/playback setup, and separate editor/runtime/client evidence before canonical export.

Open the repository root `config.json` with **bridge. 2.7.54**. It points directly to the BP/RP paths in `baseline.json`; generated builds and historical asset workspaces are not release input.

## Before editing

In Settings → Projects, turn **Increment Version** and **Add generated_with** off. The desktop defaults can otherwise rewrite manifests even during a review export. A trial Tavern export reproduced an unrequested header/dependency bump from 0.6.74 to 0.6.75 without updating module versions. The export guard rejected it. That trial was isolated and never published.

The project uses `bridge.formatVersion: 1` to prevent automatic insertion of `formatVersionCorrection`. Only `simpleRewrite` is enabled. No custom components, gameplay generators, TypeScript transforms or format-version rewrites are used for these already canonical packs. Do not add a second runtime source tree.

## Checks and portable editor project

```sh
python tools/bridge_project.py
python tools/test_bridge_project.py
python tools/bridge_project.py --build artifacts/Canonical.brproject
```

The archive contains the current project config and canonical runtime only. It contains no worlds, credentials, private host patches, caches or generated builds. Import the `.brproject` in bridge. or copy the project into bridge.'s `projects` directory.

After a native bridge. `.mcaddon` export, or a standalone Dash compilation:

```sh
python tools/bridge_project.py --verify-export path/to/export.mcaddon
python tools/bridge_project.py --verify-export builds/dist
```

The guard matches both packs by their existing UUIDs, checks every file, rejects added/omitted files, binary changes, JSON semantic changes, automatic version increments and extra manifest metadata. JSON formatting alone is permitted. Run the repository's regular functional and baseline checks as well.

CI repeats the canonical BP/RP build using official, checksum-pinned standalone Dash v1.2.0. This is separate from the native desktop editor test; both must be reported accurately. Gameplay/version changes still follow `BASELINE-MAINTENANCE.md` and need a new release identity.

## Schema diagnostics are evidence, not blanket migration instructions

The 2.7.54 data package lists 1.21.130 as currentStable and contains formats through 1.26.0. Our engine target remains **1.26.50**. Do not downgrade the target merely to remove an editor warning.

A static scan of the shipped schema package needs project-specific caches and generated schemas. Raw vanilla-only enums incorrectly reject addon identifiers; unresolved/dynamic references are not proof of broken content. Do not report such a scan as a clean full-schema pass. In particular, official Bedrock documentation supports:

- Particle event `expression`: https://learn.microsoft.com/en-us/minecraft/creator/reference/content/particlesreference/examples/particlecomponents/particle_event_node?view=minecraft-bedrock-stable
- Damage sensor `deals_damage: "no"`: https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_damage_sensor?view=minecraft-bedrock-stable
- Projectile `anchor: "eye_height"`: https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_projectile?view=minecraft-bedrock-stable

These valid constructs were retained. Engine loading, rendering, gameplay and saved-world migration are separate acceptance tests. Editor compilation alone certifies none of those.

## Official references

- https://bridge-core.app/guide/download/
- https://bridge-core.app/guide/misc/project-config.html
- https://bridge-core.app/guide/misc/import-project.html
- https://github.com/bridge-core/editor/releases/tag/v2.7.54
- https://github.com/bridge-core/deno-dash-compiler/releases/tag/v1.2.0

The existing `projects/grilling/gameplay_core/config.json` remains a supported direct runtime entry. The higher-level `projects/grilling/config.json` is the historical assets-only project, retained for provenance. Prefer the repository root for current development.

2.8.16 removes six Java-only top-level `type: "minecraft:chest"` fields from Bedrock loot tables. Reward pools are unchanged; before/after hashes and pool hashes are in `BRIDGE-LOOT-NORMALIZATION-20261001.json`.
