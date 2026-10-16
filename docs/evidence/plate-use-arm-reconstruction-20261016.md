# G146 plate-use left arm: local candidate, not published

## Scope and identity

This candidate reconstructs the narrow plate-use repair against PR224 head
`4ad25ebdf86551ac72b14f86af224e93435cd43a`, tree
`8324d74793e7354b231d1aa09f7240c1ee05fbf4`. This includes the subsequent
Windows test-fixture path normalization fix without changing the production runner. The rebase from the earlier
`dc4898dd14ad61fb92e6175036fc3b62da510808` base was conflict-free; all 15
subsequent CI/tool fixes were retained byte-for-byte at that rebase. G146 then
adds one verifier registration and extends its receipt-order regression to cover
both G145 and G146; the other 13 CI/tool files remain byte-identical. The
two-route exact-source regression now explicitly admits G146, and the existing
compiler trace matrix includes G146 while preserving all earlier version rows. The earlier isolated repair was
not available in this executor, so none of its review or test passes is inherited.
The parent G145 runtime identity remains frozen and unchanged in its history.
This continuation has a separate local G146 identity. Its publication request,
client acceptance and production-readiness flags remain false. Packaging and
functional checks are recorded against the exact final commit; identity freeze
alone is not completion or permission to publish.

Only one exported functional file changes:
`resource_pack/render_controllers/java_eating_player.render_controllers.json`.
Only the generic-use subexpression of `leftArm` and `leftSleeve` changes. The
exclusion requires first person, active use, main-hand
`kaleidoscope_grilling:skewer_plate`, and empty offhand. Maps, shields, occupied
offhands, owned skewer routes, all other controller fields, poses, offsets,
geometry, textures, scripts, and timing are unchanged. The exact item identifier
is verified against `behavior_pack/items/skewer_plate.json`. The only other
exported changes are the paired manifest version fields and internal pair
dependency advancing to 2.8.146; UUIDs and external dependencies are unchanged.

## Source basis and limits

The pinned source under
`development/gameplay_core/fixtures/java-failure-skewer-9a1acdab/forge-1.20.1/`
contains `SkewerPlateItem.java`: an ordinary Item with a 16-tick EAT action.
`SkewerRecipes.configuredAnimationProfile` admits configured skewer identities;
the plate receives the ordinary-item fallback rather than a custom helper-arm
route. The pinned `ItemInHandSkewerEatingMixin` returns when that profile is null.
The native Bedrock fixture
`development/gameplay_core/fixtures/native-first-person-controller-1.26.50.4.json`
contains the unconditional generic normalized-use branch that exposed the left
arm. Its bytes remain unchanged.

This is a bounded source correction. There is no new native Java or Minecraft
Bedrock capture, no absolute camera/scale claim, no all-perspective acceptance,
and no deployment or production-readiness claim.

## Strict proof boundaries

The current offhand producer constructs its complete controller then applies the
two-leaf repair. Its inverse accepts only the exact corrected full payload.
It rejects the historical controller rather than adding a dual-postimage bypass.
The historical conservation tests load the **complete original c7 producer and
its original contract** from immutable commit
`c7c0bfb047af06a5d1c42d6e31c873dc9ca6992f`. That producer rejects the corrected
controller. All 22 historical documents are checked against frozen runtime bytes;
unrelated changes are rejected. Current ownership is checked separately, before
and after the source validators. There are now 19 exact owned runtime paths
relative to c7. Compared with G145, the other functional owners are unchanged;
the two manifest postimages are assigned the exact G146 identity owner.

The existing compiler extraction test freezes the historical orchestrator while
using current stage implementations. Its 165-output comparison is regeneration
coverage, not a claim that the c7 runtime contained this repair. The separate
frozen producer/runtime tests provide that historical boundary.

## Validation

New tests execute the actual old and new exported Molang expressions across
8,400 state combinations. Exactly 42 left-part observations change, all in the
intended active-use plate/empty-offhand case. This count is source evaluation,
not rendered frames or gameplay cases. Dedicated tests also require exact
full-document inverses, cross-rejection, hostile mutations, and all 22 frozen
documents. Existing current inventory, five historical conservation proofs,
offhand projection, ordinary-relative calibration, observer/native fallback,
composed witnesses and compiler regeneration remain required.

The initial checks on the earlier dc4898dd base stopped at missing G145
registration and an outdated hand-anchor helper-set assertion. Both belong to
the separately reviewed CI fixes now retained from a575350a; those old failures
are not current results. The complete aggregate verifier must be run on this
composed local tree and its exact outcome recorded separately. The first G146
aggregate run rejected an omitted G146 entry in the two-route test version list;
that entry was added without altering any exact-source assertion. Later gates
are exercised individually before the final aggregate rerun. No passing result
from the unchanged G145 tree is transferred to the changed runtime.
`baseline_gate.py check --release` correctly rejected the earlier changed runtime
under the unchanged G145 hash. The supported local claim/freeze mechanism then
assigned G146, updating paired manifests/modules, the internal dependency, lock
and current config identity, while appending a new history entry. Every previous
history entry, including G145, remains unchanged. No exported script contains a
separate G145 guide/payload version requiring alteration.

## Next legal identity

`docs/BASELINE-MAINTENANCE.md` requires a new version for changed exported bytes;
`release_claim.py` checks committed local and remote-tracking histories and shared
Git claims before an append-only freeze. Read-only remote refs on October 16
showed main at G144 source `e6dea2fb2388c8d750fa309dc36dccaabff9a16c`, the
G145 draft branch at `a575350a16075f447ccf17d50195622e029c90a4`, and G143 as
the latest stable version tag. The unrelated icon branch still claims G144.
The relevant remote histories were refreshed before freezing and contain no G146
entry. All local heads and remote-tracking histories were checked by the supported
claim operation; the shared claim directory was absent beforehand. The freeze
created the append-only local G146 claim in this repository's shared Git common
directory. This is local coordination only: it does not claim inspection of other
executors' private claims or every unrelated historical remote branch. No remote
branch, tag, release, reservation or deployment was created. Later publication
still requires the appropriate clean-source, canonical, family, saved-world and
native-acceptance gates, each within its distinct evidence scope.
