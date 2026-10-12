# G129 publication staging

Grilling **2.8.129**, guide **0.3.59**, is a new candidate for the shared HUD
catalog repair. The intended non-latest prerelease is **A2.8.129-beta.1**.
[`.github/release-request.json`](../.github/release-request.json) requests an
explicit manual publication after this candidate's exact source CI and
family/save/admission/LIVE readback succeed. Ordinary PR/main runs cannot
publish. No successful source CI reference is inherited from G128 or the first
failed G129 run.

Canonical direct packaging binds frozen runtime ancestor
`23d14fcc7c4d250151becc2ef4fd33048fba1794`, Git tree
`6e7da9727382b76efae7e92ec6b9e8d1d9790ffd`, with source runtime digest
`5aa81a21a211c5a89ec5ee408acd47be5ecf6919b74633eebdd9170bde0642fc`.

| Artifact | SHA256 |
| --- | --- |
| `Kaleidoscope_Grilling_A2.8.129_Review.mcaddon` | `aaff6df290c760a75507f8f7815c413a35c72d015d6e735e765cc2a177fa2ca6` |
| `Kaleidoscope_Grilling_A2.8.129_Review.brproject` | `0979970c3d509fd3682013997052aa7974b4e6e3a62b5c0804a58d575a9146a8` |

These are canonical packager digests, not Dash, BDS or client acceptance. The
verifier dispatch correction changes tools only and preserves these frozen
outputs. Publication must use the completed canonical run whose full Git tree
matches final main, with its original archive report and actual checkout; a
separate publication binding records that check without rewriting the report.

The `.mcaddon` will contain the direct canonical Grilling BP/RP. Family
installation must use those same owned bytes. Its dependency remains official
[Cookery 1.6.0, file 9054164](https://www.curseforge.com/minecraft-bedrock/addons/kaleidoscope-cookery-unofficial/files/9054164)
with the already registered public family API 0.2.10 adapters. Separate private
integration and third-party packs are not included in the Grilling download.

Ordinary PR/main validation produces review artifacts. Publishing requires
successful exact-source canonical CI, family/save/admission and LIVE readback,
then explicit `publish` workflow dispatch with that successful run ID and exact
confirmed tag. The publisher reuses the run's original archives and source
report, checks the complete Git tree, uploaded bytes and tag target, and records
a separate publication binding. It does not rebuild historical packages.

This candidate changes catalog registration and mounts while preserving the
original eating textures, dimensions, timing and producer. See
[G129 status](STATUS-A2.8.129.md) and the
[scope and verification record](evidence/hud-catalog-compatibility-20261012.md).
Human rendering and full Java parity remain pending: `client=false` and
`production_ready=false`. The last published release is
[G128 beta.2](https://github.com/casama233/kaleidoscope-grilling-unofficial/releases/tag/A2.8.128-beta.2);
its original source, diagnostics and receipts remain unchanged.
