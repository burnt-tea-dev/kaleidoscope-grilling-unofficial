# Grilling parity consolidation — 2026-10-15

## Scope and evidence boundary

This is a **source-only repair candidate**, not a release or a declaration of Java parity. The reviewed base is `ce340a7d7f13cd5be0c0ff95e6556ed3187c81a8` (G142 / 2.8.142). The Java `main` ref was independently read as `9a1acdab27698457bec16c9362678e574895a28c` in `breezeth-CN/KaleidoscopeGrilling`.

No real subordinate agents, Blockbench/bridge preview, Minecraft client or BDS instance were available in this session. The workspace bridge returned a connection error; connector discovery did not expose a multi-agent launcher or Blockbench MCP. Workstream separation below is a review index, **not evidence of parallel agents**.

Current BP/RP were recovered from the existing successful canonical-review artifact (run `38570580331`, artifact `11897344465`). Its ZIP SHA256 was verified as `0445d7b632352113207cbff92835ca4d024dbd7b3aba297124dab6d142867288`. Every exported file was then fingerprinted with the repository's `baseline_gate.py` algorithm and matched the current `baseline.json`:

- BP: 775 files, `7653f31d3b26e4b8ab616f998240003e539acedaef8829d93fc5462af1586559`.
- RP: 3624 files, `803f30db4654b5b8838e3ca6e3b8a77c2a361d48bdb5916f7abbf5e003a520c3`.

This verifies the source identity used for the review, not all behaviours in those files. Only two runtime files change in this candidate; no RP, player rendering, recipes, UUIDs, dependencies, manifest versions or historical witnesses are changed.

## Confirmed and repaired in this candidate

### Plate/recipe rollback ownership and conservation

`plate_transaction_core.js` is used by the canonical plate/recipe runtime for saved properties, captured hand slots and delivery journals. The old rollback always wrote its captured preimage after an attempted apply. A failed write that exposed foreign full metadata could therefore be overwritten. `commitSteps` also continued undoing earlier sources after a later delivery cleanup failed.

The repair reads the full existing signature before undoing a write. An already restored preimage is a no-op; a foreign value is not overwritten. A setter that completes restoration before throwing is judged by exact readback. After an unresolved reverse step, earlier reverse steps are blocked and the existing plate/recipe quarantine path is used. This intentionally retains the earlier debit for recovery rather than minting a refund while delivery ownership is unknown.

The repair does not change plate capacity, recipes, slot order, placement facing, successful transfer output, or stored-data formats. These are Bedrock port integrity defects demonstrated with controlled failures, not newly reported observations from a live player.

### Pepper harvesting settlement

The existing leaf interaction called a drop helper that swallowed `spawnItem` failures, then awarded the advancement and attempted to clear fruit without checking success. A rejected fruit write could leave a repeatable harvest source; a failed spawn could still consume fruit and announce success.

The repair uses the existing `createOwnedPlantWrite`, `plantFertilizerSteps` and `commitPlantSteps` primitives. It verifies the fruit-state write before delivery, acknowledges the spawned entity and full stack equivalence, and emits advancement/sound only after successful settlement. Unknown delivery outcomes retain the fruit debit and persist the existing plant quarantine so a script reload cannot reopen the source. A replaced block is not overwritten. Missing game-rule information fails closed; `doTileDrops=false` suppresses the drop without suppressing successful harvesting feedback.

The checked Java source is `neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/world/PepperLeavesBlock.java`, specifically `useWithoutItem`: fruit-bearing leaves produce one or two peppers, award `pepperPicked`, clear `HAS_PEPPER`, and play the berry-picking sound. This candidate preserves the existing empty-main-hand gate, one/two output count and sound parameters. It does not claim to have executed the Java class, checked both loaders, matched native drop physics, or fixed leaf rendering/tree generation.

## Focused regression evidence

One regression file exercises the two confirmed failure paths rather than adding another broad parity matrix:

`node --experimental-vm-modules --test development/tests/runtime/plate_pepper_conservation.test.mjs`

It imports the real plate module and evaluates the actual registered pepper leaf handler plus the real plant transaction helpers. The native Minecraft API boundary, player IO and advancement sink are test doubles. Production source is not rewritten or replaced with a second implementation of the algorithm.

With `GRILLING_TEST_SCRIPTS` pointing to the verified G142 scripts, the same 11 named tests yielded 3 passing / 8 failing. With the changed candidate scripts, 11 passed / 0 failed. This is **not eight independently observed game bugs**, and test totals are not a parity percentage.

Covered material cases include successful single settlement, failed/no-op/throw-after-write clearing, foreign metadata/block preservation, failed delivery cleanup, exact restoration after an exception, unknown spawn outcomes, persisted quarantine after module reload, the empty-hand gate and `doTileDrops`. Both changed JS files also passed `node --check`.

These results are local source-level fault injection only. The new file has not been wired into or accepted by the complete canonical verifier. Full PR CI, compiled bridge export, native BDS and human visual/interaction acceptance remain separate and unclaimed.

## Existing work reconciled, not overwritten

### Eating animation and presentation — highest visible priority

PR #213 (`fix/skewer-animation-contract-20261015`, inspected head `2397052f9a0b5939a111d824a27b1de7230cca11`) already isolates offhand eating clocks and terminal ownership. It must not be duplicated or blindly merged. The four PR workflows were failing at inspection.

The canonical source job `116259200800` in run `38685472364` fails in `tools/test_historical_source_refs.py`, before full functional verification: two failures in `test_g119_held_witness_preserves_g69_and_rejects_widened_scope_or_hashes` (the two secret-skewer attachables) and one in `test_public_witness_rejects_tree_digest_and_current_source_byte_mutations`. These compare newly changed current expressions against the prior witness reconstruction. The log does not establish three new gameplay failures. Preserve immutable witnesses and adapt only the narrowly reviewed current-source reconstruction for the clock change; do not delete assertions or rewrite historical hashes.

First-person admission/helper visibility, camera/hand pose, third-person Java ITEM transforms, continuous bites, cancellation and hand switching still require actual native/rendered evidence. This candidate changes none of those resources and does not relabel them as fixed.

### Ingredient metadata and bottle retyping

PR #200 already addresses equivalent RawMessage lore in `retargetBottleFillStack` / snapshot restoration. Keep that work separate from #213 and this candidate. Review and rebase it against the eventual integration head without relaxing native metadata comparisons. Its existing regression should be reused, not recreated here.

### Secret-skewer inventory art

`docs/BUGS.md` and issue #166 still track arbitrary-ingredient GUI icon limitations. A helper-generated reference image is not native inventory acceptance. No generic blade icon or arbitrary replacement texture is declared equivalent to Java in this review.

### Racks, grill flow, recipes and world generation

The existing `docs/PARITY-MATRIX.md` and `docs/BUGS.md` remain the canonical historical index. Previously repaired grill timing, flip/seasoning costs, rack direct interactions and source tree-generation logic are not rewritten without a fresh contradictory reproduction. Pepper harvest settlement is not proof that the previously reported missing-leaves visual problem is closed. No new full-family or loaded-world result was obtained here.

## Integration boundary

This branch intentionally has no new release identity and is **not merge/publish/deploy ready**. Changed exported bytes must never be distributed as G142 / 2.8.142. Before integration, allocate an unused advancing version, update paired metadata and append-only baseline/history through the normal release claim, wire the focused regression into the current verifier, and run the full canonical checks on the exact combined tree. Do not use existing G142 compiled/BDS/live receipts to certify changed bytes.

The integration order is dependency-driven: resolve #213's source-witness compatibility without weakening guards; reconcile #200's full metadata comparisons; integrate the two bounded conservation repairs; then freeze one coherent candidate. Reuse unchanged evidence only where its exact source/receipt remains valid. Native family/export/world checks and actual human visual acceptance are still required at their existing gates. No main-branch update, release publication or server deployment is claimed by this document.
