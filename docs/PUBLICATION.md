# G129 publication staging

Grilling **2.8.129**, guide **0.3.59**, is a new candidate for the shared HUD
catalog repair. The intended non-latest prerelease is **A2.8.129-beta.1**.
[`.github/release-request.json`](../.github/release-request.json) currently has
`publication_request=false`. Exact archive digests, integrated source and
successful CI references will be populated from this candidate's actual
evidence after required validation. None are inherited from G128.

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
