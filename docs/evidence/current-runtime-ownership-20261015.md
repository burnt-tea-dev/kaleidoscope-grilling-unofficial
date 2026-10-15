# Current runtime ownership and frozen cleanup evidence

This tooling boundary admits the independently reviewed plate special-visual delta without adding another historical inverse. It does not change runtime bytes or expand native visual acceptance.

## Current contract
`tools/current_runtime_ownership.py` compares every file physically present under the two runtime pack roots with the immutable c7 resolver runtime (4,496 files), including untracked and ignored additions. Symlinks fail. `tools/fixtures/current-runtime-ownership.json` declares exactly fourteen plate paths: ten modifications and four additions, no deletions. The current inventory has 4,500 files.

The manifest identifies each operation, owner, prior hash or explicit absence, and new hash. Its entire reviewed byte representation is pinned in the module. Arbitrary manifest paths, owner imports, commands, baseline changes or new hashes cannot grant admission. Unknown modifications, additions, deletions, missing declared changes and mismatched old/new bytes fail. No wildcard exemption is used. Deletions are unsupported by this tranche.

The explicit plate owner additionally runs both complete plate generators with `--check`, the independent `PlateSpecialContracts` source geometry/texture/order tests, and recipe/cache/transaction Node tests. The source tests retain lifecycle, state, world-clock and ownership assertions. Those fixed leaf commands do not call the global runtime guard. Hash identity alone is not source acceptance. Runtime bytes are checked again after the validators, so a validator cannot modify the candidate unnoticed. Existing verification-session exact-command reuse is used when the caller already owns a session; no new skip/cache capability or subprocess monkeypatch is introduced.

## Frozen versus current
The resolver, offhand and ordinary historical whole-pack conservation checks now use the immutable accepted c7 runtime as their after-state, retaining their original preimage transforms and scope assertions. The compiler's frozen proof compares its actual accepted after-commit 3bcb1639fad515f12e119c83b915d452a655a4ed runtime trees with c7. That is the only newly required Git reference; the audited inventory has exactly 51 refs. Compiler current output equality, ordering, supplied-input, source-pin and mutation tests still run on current source.

The composed effect witness likewise retains exact frozen effect postimages and compares current main only after the existing later-layer restoration; its current reference and mutation checks remain active. No new inverse or pin is needed for that caller.

Each of the four standalone suites and the composed-effect caller uses the explicit inventory-only API, checking the full physical runtime inventory and immutable manifest without spawning plate leaf commands. These standalone historical proofs do not claim complete current source acceptance. The mandatory current ownership gate still checks inventory before and after all source leaf commands. The inventory-only API has no generic skip flag. Each standalone suite calls the shared current inventory guard, so moving their historical proof off the mutable checkout does not remove unrelated-current-file protection. The current verification entrypoint also registers the dedicated mutation suite, and its receipt tests require that command and reject a receipt when it fails. Existing canonical/historical source and lifecycle checks remain enabled.

## Future updates
A future delta requires review of an exact new operation/path set, predecessor and generated/source-semantic validation, and a deliberate update of the code-owned manifest fingerprint. Editing a manifest hash to match a mutated runtime file is insufficient. A new owner requires an explicit reviewed validator dispatch; the manifest cannot name executable code. Future deletion support needs a separate reference/absence contract and is not implied here. An eventual anchor consolidation must preserve these frozen receipts rather than reinterpreting every past source through additional inverse layers.

This is local source/conservation validation. No full canonical receipt, native game rendering acceptance, release or publication is claimed.
