# A2.8.149 stable publication scope

## Release identity and requirements

Requested stable-channel tag: **A2.8.149**; artifact suffix: **baseline1**; `prerelease=false`, `make_latest="false"`. Non-latest publication is requested; the actual GitHub latest state requires separate release readback. This is a publication-metadata change over the unchanged **2.8.149** runtime: no new runtime version, UUID, dependency, asset, gameplay or release-history change. Current main's reviewed authoring-tool cleanup is preserved.

Install the `.mcaddon` with the reviewed public **Cookery 1.6.0** dependency. Cookery 1.6.1 and private-edition UUIDs are not interchangeable with this lock. The `.brproject` is the corresponding authoring archive. Grilling's guide is included; private family adapters and other family packs are separate dependencies.

## Included source changes

- G149 removes the extra first-person pending-bottle shake from nine offhand attachables, preserving static hold and the separate sprinkle precedence. Main-hand, TP/player curves, geometry, UVs, textures and BP gameplay are unchanged by that correction. See the [G149 source proof and limits](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/82a396721103ae3dc7962e6ed57e10837cb5ba6d/docs/evidence/pending-offhand-none-route-g149.md).
- G148 restores the source-owned active third-person SPECIAL seasoning item contributor with exclusive active/idle selection. See [G148 scope](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/82a396721103ae3dc7962e6ed57e10837cb5ba6d/docs/evidence/seasoning-tp-item-inversion-g148.md).
- G147 retains individually guarded owning-entity eating properties, and G146 retains the plate-use arm correction, on the complete G145/G144 composition. Earlier source evidence and release identities remain historical records with their original scope.

## Evidence and publication boundary

The integrated runtime is the public G149 source commit `82a396721103ae3dc7962e6ed57e10837cb5ba6d`, tree `0f6c8c9960dc2f6b5e225018df24f39738f8a4dc`. Its existing [canonical run 38902713982](https://github.com/casama233/kaleidoscope-grilling-unofficial/actions/runs/38902713982) and [bridge run 38902713958](https://github.com/casama233/kaleidoscope-grilling-unofficial/actions/runs/38902713958) are historical source/compiler evidence. The canonical run checked synthetic merge `b7524aff7676381353d163909460bbccda1e744a`; that checkout is not relabeled as the later publication commit. Recovery compared all 4,501 runtime files to the downloaded canonical archive. Deterministic baseline1 packaging must retain those exact runtime bytes.

The prior native Blockbench observations are carried from the public [PR #228 evidence record](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/228), not newly executed or reverified after workspace recovery. Its two representative pending-bottle cases recorded 18 live snapshots using explicit owner/lifecycle preview adapters. Main-hand motion remained; the offhand item remained pixel-identical through the recorded states. Native overlay SHA256: `45c2570f6c3c64aa036195f8c46d44a05251d08b2c57d396a1b4b75b20cc1493`; independent native seal: `5322598df5391ba8d51b3b881e40d41e93c138398d9ef5269a3da3a2c44df600`. These are live-resource/editor observations, not disk-save/reopen or game-engine tests. Editor clocks, owner-query stand-ins and explicit manual completion do not execute actual item admission, cancellation, replacement or Bedrock timing. They do not establish full Java/Bedrock host-frame equivalence.

The owner's 2026-10-16 decision permits this stable channel on source, bounded editor, bridge, full CI and exact-package evidence without requiring real-client acceptance first. The waiver does not convert untested behavior into a pass. `client=false`, `production_ready=false`, `live=false` and `live_deployment=false` remain explicit. Full final rendering/materials, real use-hand admission, timing, multiplayer, family install/save migration and long-term runtime stability remain unverified for this publication. No live deployment is included.

Publication still requires a final successful Linux source and Windows canonical run for the **complete publication Git tree**, exact archive hashes, manual tag confirmation, draft upload/readback, and final tag/main identity checks. Prior runtime-equivalent CI cannot replace that final full-tree gate. The publisher and its gates are unchanged. Archive reports keep their original identity and `compiled_export_verified` value; standalone Dash comparison is separate evidence.

## Known deferred family risk

When combined with World Liquor **0.1.148**, Treasure Guide's mob bonus can copy unrelated newly dropped items; overlapping death callbacks can multiply bonus drops. The owner chose to retain this feature and defer its repair. The unchanged World Liquor behavior is **not fixed or disabled** by this Grilling release. The issue was reproduced against W148 source in an isolated mocked scheduler, not a native-server reproduction. This is a companion-pack risk, not a new Grilling feature. Back up worlds and treat item-economy results with care.

Other open host/socket/camera, left-dominant and mirrored-extension differences remain as recorded in the source evidence. Stable is the requested distribution channel; it does not certify complete Java parity, real-client acceptance or production readiness.
