# G130 publication staging

The intended non-latest prerelease is **A2.8.130-beta.1**, Grilling **2.8.130**,
guide **0.3.60**. The request is reset for this new immutable candidate. Exact
runtime/archive digests and the frozen source ancestor are recorded after
canonical direct packaging. No G129 artifact or successful CI is reused.

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
