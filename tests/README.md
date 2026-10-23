# Transitional behavior tests

Run `python3 tools/run_legacy_tests.py`. Each retained file runs in an isolated Node
test process; all 93 existing entrypoints are discovered with no skip list.
These tests characterize canonical source behavior during P2. They do not prove
BDS compatibility, visual parity, staging success, or player acceptance.

- `legacy/` contains directly imported gameplay rules and native-ESM scenarios.
  Replace these with domain tests during P3 rather than preserving version names.
- `legacy/fixtures/` holds only the existing Java/reference vectors used by these
  tests. JSON fixture and block/item definition reads are permitted. Tests must
  not read, splice, rewrite, evaluate, or append exports to runtime JavaScript.
- `helpers/minecraft-loader.mjs` resolves `@minecraft/server` to the test boundary
  and propagates a fixture identity through ordinary ESM imports. It has no source
  transformation hook. Canonical modules and their registered handlers execute
  unchanged, including transitive imports.
- Create isolated worlds with `createFixture()` and import their modules through
  `await fixture.load('module.js')`. World-aware item-data and snapshot helpers
  must use the same fixture graph. Do not mix another world's metadata helpers.
- Trigger actual registered events, startup components, commands, and scheduled
  ticks for private runtime operations. Use public exports for pure logic and
  existing automation APIs. Do not make production functions public for tests.
- Faults belong at native API boundaries: inventory/equipment writes, dynamic
  properties, permutations, drops, and readback. Assert ownership, saved contents,
  metadata, rollback/quarantine, and retry results, not only thrown exceptions.
  Event handlers may intentionally catch failures.
- Fake item limits and owned-block state domains come from canonical pack JSON.
  Explicit external item definitions may model supported tagged extension items;
  they must not silently redefine this pack's native item or block constraints.

The fake server is deliberately limited. New behavior tests must extend its
observable native boundary honestly, without replacing production domain logic.
The helper regression suite covers state-domain rejection, world isolation,
metadata persistence, fault injection, and scheduling.

## T3.4 preparation: eating timelines

The eating scenarios are appended to the existing `legacy/test_food_finish.mjs`
entrypoint, so the existing runner and CI discover them without adding a test
entrypoint or raising the growth ceiling. `helpers/eating-lab.mjs` imports the
unchanged `main.js` graph through the existing fixture loader. It supplies only
Minecraft API inputs and records published player properties, held stacks,
effect calls, crumb checkpoints and requested animation clip names.

Run only these scenarios (Node 22+):

```sh
node --test --test-name-pattern='^(every|each route|beef terminal|a stale fixed|a brief inventory|logging out)' tests/legacy/test_food_finish.mjs
```

Set `EATING_TIMELINE_DIR` to an output directory to write `normal.json`,
`release.json`, `last-serving.json`, `switch-reconnect.json` and
`beef-terminal.json`. Do not commit these generated outputs. Each row includes
the route, hand, elapsed tick, profile, projection flag, replicated clock,
inventory counts, hunger/saturation, effect count and requested clips.

The 106 routes comprise 42 base identities (41 fixed/failure foods plus secret
skewer), 22 ALT identities, and 42 animation-disabled plain identities. Each is
exercised in both hands. The matrix covers normal completion, duplicate events,
23/24/25-tick release, final serving, stop-before-complete, consecutive meals,
switching selected slots, moving hands, replacing metadata, leave/spawn and
reholding. An offhand meal correctly survives a change of selected main slot.
Idle random route preparation may select a different shadow ID after cancellation;
the ownership assertions compare canonical food, quantity and saved metadata.

Java expectations come from `data/java/eating_profiles.json`, pinned to
`breezeth-CN/KaleidoscopeGrilling@9a1acdab27698457bec16c9362678e574895a28c`:
[MultiBiteSkewerItem](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/MultiBiteSkewerItem.java).
The relevant methods are `AnimationProfile` (L36), `animationProfile` (L72),
`visualBiteStage` (L98), `use` (L127), `onPlayerLoggedOut` (L232), and
`settleIfEligible` (L250). Java uses a stack component for THREE/ALT; Bedrock
currently uses shadow item IDs. Java's stage is zero when use stops or the use
stack differs. That makes such a reset possible, not proof of a particular
client rendering bug.

Executed on G155 `cccc9689a86f0e724c229208ab9cae26ff7999f1` and G156
`00fc8453d6d36602cc14b64a0d70de39ccf8b035`: five scenario groups passed and
three desired safety properties failed as explicit `todo` tests. Node exits
successfully for TODO failures; this must not be reported as eight passing tests.
The retained gameplay run on G155 recorded 776 passes, zero ordinary failures
and these three TODO failures (779 tests). These are logic results only.

| Minimal reproduction | Executed result | T3.4 follow-up |
| --- | --- | --- |
| Start beef with two servings; at elapsed 70 supply an inventory view with one fewer; tick; restore original view; tick | Profile remains 0 instead of 5; the elapsed clock resumes but presentation profile/hand/native-duration do not | Resolve session identity/debit ordering and presentation lifecycle together |
| Start beef; elapsed 88; select a stone slot; tick; deliver the old complete event with zero remaining | One strength-effect call is still awarded | Apply current-hand/slot ownership checks consistently to fixed food completion |
| Start beef; elapsed 25; leave without a stop event | Two servings remain; Java logout would settle one | Verify real Bedrock stop/leave ordering before choosing a safe logout adapter |

The beef terminal experiment also distinguishes two candidate reset paths:

| Driver input | Elapsed | Published profile | Held count |
| --- | --- | --- | --- |
| Inventory unchanged; no terminal callback yet | 87 | 5 | 2 |
| Supply debit before terminal callback; run one tick | 87 | 0 | 1 |
| Supply changed item metadata before terminal callback | 87 | 0 | 2 |
| Deliver completion while the API still exposes original held stack | 89 | 0 | 2 |

The native debit, completion timing and inventory views above are **driver
assumptions**, not observations from Minecraft. The lab does not emulate native
food nutrition, actual engine consumption, network packets, animation evaluation,
render controllers, or displayed geometry. Requested clip names are not rendered
animation evidence. Java sources were inspected; a Java game/JVM oracle was not
run. `client=false`, `production_ready=false`.

The reported G155 final-bite full-model flash remains unlocated. The experiment
does not reproduce its three displayed frames or replace the existing 89
Blockbench comparisons. The normal scripted path does not reset early while
the held identity remains unchanged. Both an early inventory-view mismatch and
a completion property reset preceding the visible hand update remain candidates.
Next work belongs to T3.4 after its phase gate: first measure native stop/complete/
debit/property order in isolated staging and perform the plan's script-debit
spike; then fix settlement ownership and presentation lifetime. No production
runtime, model, manifest, credentials, networking or authentication was changed.

Cross-reference: [draft PR #259](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/259)
reports a separate Secret-skewer immediate-disassembly scenario: idle route
preparation selects ALT on the next tick at random input .75, invalidating the
captured hand snapshot; input .25 succeeds. This is a fake-boundary runtime
report, pending independent review and native reproduction. Its 105 recipe
scenarios are not duplicated here. Shared exposure to hand-route identity
changes does not establish a common cause with the final-model flash.
