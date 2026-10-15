# G144 bounded scheduling and player effects

Baseline: canonical Grilling `23031fc67ac96542d47d4a99295427e3a69af5c5`, repository `casama233/kaleidoscope-grilling-unofficial` (1377218440). Java references remain author 1.1.1, Forge 1.20.1 CF8726006 and NeoForge 1.21.1 CF8726014. The family upstream check on 2026-10-15 still identifies these maintained releases; complete Java/client parity remains unverified. No Bedrock API, author package or preview-only feature is introduced.

`scripts/timed_work_queue.js` serves hot-tooltip and oil-source work. Previously replacement/cancellation left obsolete heap nodes, while `take` counted only emitted keys against its budget. A cancelled key with 20,000 future replacements therefore caused 20,000 heap pops in a subsequent empty `take(now=2,budget=64)`. An indexed heap now holds one node per live key and repairs replacement/removal in logarithmic work. A dequeue visits only emitted due nodes. Deadlines, same-deadline no-op, serial ties and cancellation semantics remain; a late clock does not expand the work budget or simulate extra gameplay ticks. This queue stores absolute due ticks; it does not replace `system.runTimeout`/`system.clearRun` or change their delays.

The synchronous player effect pass in `scripts/main.js` previously requested many copies of the same tick's state; the shared adapter still re-parsed the projectile-dodge descriptor on these cached reads. It now uses one local active-effects snapshot and fetches hunger/saturation components only for vigor. The snapshot ends with that pass. Event, damage, projectile reservation and transaction functions retain their own existing read/acknowledgement paths; effect expiry is checked every pass. Effect-write failure does not become a successful acknowledgement or erase the local active snapshot.

[Sanitized operation receipt](performance-operation-counts-20261015.json) binds the baseline and changed source hashes. It executes the actual effect pass and state adapter with deterministic doubles:

| Scene | Before | After |
| --- | ---: | ---: |
| 20,000 same-key future replacements: heap nodes | 20,000 | 1 |
| Cancel then empty dequeue: heap pops | 20,000 | 0 |
| One idle player, 100 ticks: effect reads | 555 | 100 |
| Same scene: hunger / saturation component reads | 100 / 100 | 0 / 0 |
| Active effect sample, 100 ticks: JSON parses | 955 | 500 |

Active-sample feedback/native-health call traces are identical before/after; active vigor retains its component reads. These are source operation counts, with no claimed wall-clock multiplier, BDS TPS, packet latency, client RTT or FPS improvement. The changes remove avoidable server work under event pressure and leave the transport/eating cadence in place for high-latency players. They cannot shorten physical network delay.

Targeted validation: `test_parity_review.mjs` exercises the 20,000-replacement burst, stable due/serial order, zero/negative budget, undefined deadline no-op, mixed-key removal, late-clock budget, idle effect work, sprint protection, exact expiry and new state on the next pass. Existing `test_world_oil_transfers.mjs`, `test_oil_registry_rollback.mjs`, `test_java_heat_deadlines.mjs`, `test_projectile_dodge_reservations.mjs` and `test_heavy_metal_deferred.mjs` pass. Heat deadlines require the repository's `--experimental-vm-modules` flag; the first local invocation omitted it and failed on unavailable VM constructors, then passed with the correct flag. No runtime was changed to bypass that invocation error. The two historical source verifiers retain their warmth/numb gates with the reviewed local snapshot spelling.

The required full source/Windows/export checks run in PR CI. Current-candidate family BDS/saved-world checks, deployment and human acceptance are separate later gates. No local full suite, test world, simulated player or LIVE change was used. `client=false`, `production_ready=false`.
