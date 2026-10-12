# G130 publication staging

The intended non-latest prerelease is **A2.8.130-beta.1**, Grilling **2.8.130**,
guide **0.3.60**. The request is reset for this new immutable candidate. Exact
runtime/archive digests and the frozen source ancestor are recorded after
canonical direct packaging. No G129 artifact or successful CI is reused.

Canonical frozen ancestor `10d4fc387724c6b60d1dc0af579a318a664bdc04` / tree
`12001602f1429dd3a9aa7b8e709584ec39740148` produced runtime digest
`cd11c20b6f28b28963b30b6d5cd4b4539a32bb10052ef799592ba111e543fd85`. These are local direct packaging checks, not
CI, BDS, gameplay or rendered-client acceptance.

| Artifact | SHA256 |
| --- | --- |
| `Kaleidoscope_Grilling_A2.8.130_Review.mcaddon` | `acdeef990da652898cd9c3d50932820243a68efa2283fd8cb7946504d7247855` |
| `Kaleidoscope_Grilling_A2.8.130_Review.brproject` | `32f33d81c458952eb8947f2f4f3a3a906a45b581caa6b398e58504f124448ec5` |


Publication remains an explicit `publish` workflow dispatch after this source's
successful canonical CI, full family/save/admission and LIVE readback. Ordinary
PR/main runs only produce review artifacts. The publisher consumes that run's
original archive/report and binds its complete checked Git tree; no historical
builder, receipt rewrite or client acceptance shortcut is used.

The public `.mcaddon` contains only the direct canonical Grilling BP/RP.
[Cookery 1.6.0](https://www.curseforge.com/minecraft-bedrock/addons/kaleidoscope-cookery-unofficial/files/9054164)
and the registered family API adapters remain dependencies. AMW, Java Saturation
and UI Queue repairs are separately reviewed private family variants and are not
included here. The previously published release is
[G129 beta.1](https://github.com/casama233/kaleidoscope-grilling-unofficial/releases/tag/A2.8.129-beta.1).

The [G130 source scope](STATUS-A2.8.130.md) preserves food timing, atlas and
settlement. Actual client rendering remains pending: `client=false`,
`production_ready=false`.
