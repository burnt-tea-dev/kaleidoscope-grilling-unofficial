# G128 public beta

The fixed download entry is [**A2.8.128-beta.1**](https://github.com/casama233/kaleidoscope-grilling-unofficial/releases/tag/A2.8.128-beta.1), with Grilling **2.8.128** and its built-in guide **0.3.58**: [download the mcaddon](https://github.com/casama233/kaleidoscope-grilling-unofficial/releases/download/A2.8.128-beta.1/Kaleidoscope_Grilling_A2.8.128_Review.mcaddon). It becomes available after the family/save/LIVE sequence below succeeds. Use this fixed beta link; latest/stable can still resolve to older G125. The authoritative publication request is [`.github/release-request.json`](../.github/release-request.json). This remains a non-latest prerelease, with `client=false` and `production_ready=false`.

The `.mcaddon` contains the maintained canonical Grilling BP and RP. These are the same owned files used by the family assembler and installed in luosen; packaging does not add server-only gameplay patches. Install it with official [**Cookery 1.6.0, file 9054164**](https://www.curseforge.com/minecraft-bedrock/addons/kaleidoscope-cookery-unofficial/files/9054164), whose author archive SHA256 is `da12fe6d39d7514aff1de3c963d69899324d771be5ca0fc3da1ccb759c7ad458`. Cookery 1.6.1 changes pack UUIDs and APIs and needs separate adaptation; it is not supported by this release.

The Grilling guide data ships inside Grilling. Clean Cookery does not include family API 0.2.10 or the locale, cutting-board, oil-pot and stockpot hooks. These public adapters can be reproduced through the existing `family_bundle.py` without a private `--extension`, following the [public family assembly instructions](https://github.com/casama233/kaleidoscope-tavern-unofficial/blob/main/docs/PUBLICATION-T147-G128-W124.md). Independent private cooking integration, additional AMW capabilities and third-party packages are not included in the Grilling download.

## Exact archive identity

| Artifact | SHA256 |
| --- | --- |
| `Kaleidoscope_Grilling_A2.8.128_Review.mcaddon` | `c9d1ce3b22474389218994a40cf6a4c8beaa28fef2e1e3b5d33dc25757843ca8` |
| `Kaleidoscope_Grilling_A2.8.128_Review.brproject` | `5a8462d89ddcf7f6974a84600426d5db30a3a4f918ab2cff8a30c6e5df707c75` |

Normal `development/gameplay_core/package_current.py` packaging reproduced both hashes from integrated G128 main `ff452251cf62632d88b17237b6ea9e4fa49c4c83`. The canonical runtime digest is `39eed2083acce34aabc8ec3458849ddfc4766e5cbcd031658cca64632d8f5bb2`.

Original G128 source and Dash evidence remains [run 38123426665](https://github.com/casama233/kaleidoscope-grilling-unofficial/actions/runs/38123426665), head `ef9df743d9d7fce8895e8997423f8ffa11d1cc86`, actual CI checkout `57c26eeb76e4e94450a4914e764131fedef0d80a`. That checkout and the integrated source have Git tree `12f60ff11e420f826dda71d9b07845e66dcc7d52`. This historical receipt is not rewritten for later metadata commits. The new publisher/workflow changes require their own successful source and Windows canonical validation. For publication, the selected run head, original archive report commit and frozen main commit must share the same **complete Git tree**, including tools and workflows. Equal runtime bytes alone do not qualify.

The package report's `compiled_export_verified=false` describes direct canonical packaging. The selected CI run separately supplies the actual Dash compilation and compiled/source comparison. Source, BDS, saved-world and human client evidence retain their separate scopes.

## Explicit publication

Ordinary PRs and main pushes validate source and produce review artifacts; they do not publish. Keep the existing family static, fresh stopped-save rehearsal, admission and LIVE readback sequence. After that sequence succeeds, dispatch **Grilling Gameplay Core — Canonical** on `main` with:

- `mode`: `publish`
- `validated_run_id`: the completed canonical validation run whose complete Git tree matches current main
- `confirm_tag`: `A2.8.128-beta.1`

The default mode is `validate`. Publication rejects another repository, a different complete Git tree or workflow, pending or failed runs, skipped source/Windows jobs, expired artifacts, another tag or changed archive hashes. It reuses only that exact run's review archives; it does not rebuild from a historical package or edit a source receipt. The original report keeps its actual CI commit; a separate `publication-binding.json` records the checked commits, publication commit, shared tree, run/attempt and exact artifact hashes. A publication dispatch has a separate concurrency group so it cannot cancel an in-progress validation run.

The existing draft/upload/readback gate checks uploaded bytes and the exact tag target before publishing a non-latest beta. An already published release is immutable. The GitHub release body records the actual source commit and selected validation run.

## Remaining client scope

G126/G127 recordings cover limited right-hand, standing, empty-offhand, Makena/wide and FOV70 scenes. Uses was observed on an isolated G125 diagnostic with two exact script postimages: one Uses row at 16→15→14, retaining Ingredients 3/8. Numb native verification, the combined G128 client matrix, near-mouth enlargement, broader inputs/viewpoints and full Java visuals/audio remain pending. These bounded observations do not become complete acceptance through publication. See the unchanged [G128 status](STATUS-A2.8.128.md) and [Uses evidence](evidence/cookery-uses-lore-native-20261011.md).
