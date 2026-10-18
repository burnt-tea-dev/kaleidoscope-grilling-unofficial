# A2.8.154 plate ownership repair candidate

Frozen candidate based on reviewed G153 commit `686cde5578ae5ddc66632b8e0d24fa9d6d89b656`. No new public Release, deployment or client acceptance is claimed. Public-host integration delivery remains a separate unresolved scope.

## Narrow repair

The current plate transaction rollback overwrote an unrelated postimage after a setter changed the slot and threw. It could also refund an earlier debit after a later credit could not be recovered. This candidate carries only the verified plate fragment from owned PR214 (`be4990b544e532a5817a822c53ce026489bec7df`), not that historical branch's version, pepper code or other changes.

Rollback now performs no write when the captured preimage is already intact; restores only the complete owned postimage; and rejects foreign or unreadable state. A setter that restores successfully before throwing is acknowledged by exact readback. An unresolved later rollback retains earlier debits within the existing persistent quarantine/recovery boundary instead of risking duplicate credit. Quarantine is not automatic recovery and may require operator inspection; ambiguous outcomes are not described as successful conservation or ordinary gameplay completion.

Runtime changes are limited to `plate_transaction_core.js`, the bounded plate/recipe transaction routes in `a25_plate_recipe_runtime.js`, and paired BP/RP manifests at 2.8.154. The guide0.3.64, textures, geometry, animation, recipes, data schemas, UUIDs and Cookery1.6.1 dependency are unchanged. Frozen G153 and earlier ledgers/history remain intact.

## Verification

Production-function tests cover foreign identity/count/name/lore/property postimages, unchanged rejected writes, owned rollback with void/false/throwing setters, unreadable credit, captured-slot movement, persistent quarantine and prevention of earlier refunds. Existing quarantine tests now inject genuinely unconfirmed postimages; exact restored postimages retain a separate positive control. Unconfirmed provisional-drop cleanup keeps both its prepared journal and quarantine, so its first rejection remains the delivery-recovery guard.

The expanded plate suite passes 99/99; seven directly related suites pass 668/668 together. Independent counterfactuals run all 99 current assertions against unchanged G153 (70 pass, 29 fail), the original core-only repair (83 pass, 16 fail), and this complete repair (99 pass). Fourteen additional independent production-fixture probes pass; the same probes pass 2/14 against G153 and 7/14 against the core-only repair. These are controlled production-module/API-boundary tests, not native-player, saved-world or visual acceptance. Independent bounded semantic review and exact source-admission preflight are complete. The four-path inverse reconstructs all 4,552 G153 runtime files exactly; compiler parity preserves 165 generated outputs and 320 stage/flag traces. The full local canonical aggregate passed on 2026-10-18, binding 10,700 pre-freeze inputs (SHA256 `3ebc10bc01c86d889f01f9260e86f8f6f0692e6a1301fa766049df356ce14de6`). The subsequent controlled freeze changes baseline/history metadata only; public-download documentation is retained from canonical main. Canonical CI must still validate the exact final published commit.

The custom-route audit also found and repaired unknown provisional-drop validity/removal, foreign block permutations during plate/recipe placement and removal, foreign count/facing changes, foreign delivery receipts, selected-slot movement during recipe recording, and Cookery recipe conversion debit loss/output duplication. Block changes now bind to the captured dimension/location and compare type plus all states. Count rollback precedes stored-row rollback. Recipe recording and conversion use captured slots and existing persistent player receipts; conversion uses planned, ownership-checked inventory/drop delivery instead of retrying `addItem` after an uncertain credit. Foreign or unreadable outcomes remain quarantined without blind refunds or automated retry.

## Separate public delivery limitation

An ordinary import of Grilling plus untouched Cookery does not apply the declared Cookery host modifications. Board V2, reviewed millstone admission and shared host API behavior must be delivered through a supported, verified public installation route before claiming complete standalone progression. This transaction repair does not resolve that packaging gap.

## Actual published-archive regression

The production JavaScript from published TEST A2.8.138-beta.1 and stable A2.8.149 was replayed under fault-injected API models. Both reproduced duplicate drops after an unconfirmed first delivery, foreign-slot overwrite during recipe recording, conversion input loss after a debit exception, and duplicate conversion output after a credited inventory write threw. Stable passed 70 of 99 assertions; TEST passed 69, failed the same 29 overlapping assertions, and explicitly excluded one unrelated newer failure-discriminator fixture absent from that archive. Both passed 2 of 14 independent probes. These counts do not represent distinct bugs or native-gameplay occurrence rates. G154 source passed 99/99 and 14/14; exact newly packaged G154 replay is required before publication.
