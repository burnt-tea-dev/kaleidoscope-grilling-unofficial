# Startup work: projectile ground aliases

## Scope and dependency

This change was prepared against low-memory PR [#389](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/389), exact head `bb8dd615ef3e8f613e325b93b2f24a62fb6e8d1b` (2.8.256). That PR merged during the audit. The new main `5d31951d47a3ac567d0a2322c3e23c26a57f5036` has exactly the same tree, `146aed0aa02a29f820b9c1278bba6545b6861f0a`, as the tested predecessor, so this PR targets main directly. It adds a fresh 2.8.257 paired identity without modifying the predecessor branch. The earlier main inventory is pinned to `1baca4ce2375b9134ed52c88f758992be6b5fd68` (2.8.254); its projectile ground classifier and catalogs are identical to the predecessor.

This delta preserves #389's Cookery description correction, immutable item-record work and retired textures. Its startup benefit is measured against the merged predecessor and does not include that predecessor's removed textures. No merge, Release, world update or deployment is part of this change.

| Existing work checked | Owned paths relevant to this change | Handling |
| --- | --- | --- |
| #389, `bb8dd615…` (now merged) | `core/persist.js`, 16 old PNGs, paired identity and package text | Exact immutable predecessor; new main has the same tree; no edits to its runtime or texture changes |
| #390, `fbefbefb…` | `seasoning/special_seasoning_visual_runtime.js`, pending seasoning scenario | Unchanged |
| #329, `a0e8b3b…` | Oil machine core/runtime, older identity and tooling | Unchanged |
| #344, `2972eb7…` | Legacy oil transaction test | Unchanged |
| #331, `392fff9…` | Held-status observer and QA | Unchanged |

The relevant existing `test_projectile_dodge_native_alias.mjs` is included in the normal smoke runner so its new cold-start case executes in PR CI. No workflow or new test suite was introduced. Latest main and every open PR's release history were checked before claiming 2.8.257; none contained that identity. Existing historical hashes remain unchanged.

## Proven avoidable work

The static import path from `main.js` reaches the projectile movement ground classifier. Before this change, `projectile_dodge_ground_core.js` builds every native alias lookup during module evaluation, even if no entity uses projectile dodge:

- 954 vanilla rows and 20 owned rows are placed in the same last-write-wins type map.
- 461 vanilla rows have native aliases.
- Those rows eagerly construct 461 Sets and stringify 3,942 accepted tuples, containing 148,373 string characters in total.
- The generated catalog is deeply frozen. Its accepted tuples cannot change between startup and first lookup.

The classifier now retains the frozen tuple-array reference in the existing alias map and replaces that entry with a Set only when that exact block first reaches alias validation. Ordinary type/state rejection runs first. The alias source is still vanilla-only; owned rows still overwrite the type map in the original order. No new event, timer, persisted key or registry is added.

| Production module operation | Predecessor | 2.8.257 |
| --- | ---: | ---: |
| Alias Sets at cold import | 461 | 0 |
| Accepted tuple strings at cold import | 3,942 | 0 |
| Accepted tuple characters produced at cold import | 148,373 | 0 |
| First stone lookup: new Set / accepted tuple entries | 0 / 0 | 1 / 1 |
| Repeated stone lookup: new Set / accepted tuple entries | 0 / 0 | 0 / 0 |
| First acacia-door lookup: new Set / accepted tuple entries | 0 / 0 | 1 / 32 |

Each lookup still encodes its observed tuple once, just as before. The table distinguishes this lookup encoding from the accepted-tuple cache. The current largest single alias domain has 162 tuples. If every supported alias type is eventually used, the steady-state cache reaches the same 461 Sets / 3,942 entries as the predecessor. This defers avoidable startup allocation; it does not promise a permanent reduction for an all-types workload.

Streaming insertion into the type map also avoids the temporary concatenated row array and 974 `[typeId, row]` pairs. It preserves source order and overwrite semantics. The 354,022-byte generated ground catalog still loads and parses; this change does not claim to eliminate that source cost.

## Validation and reproduction

The actual production functions were compared at the pinned baseline and the candidate. The comparison exercised every supported primary-state combination or native alias tuple, repeated calls, missing keys, wrong values, injected keys, unavailable states and throwing state enumeration. All 172,253 invocations agreed: 15,861 valid cases, 15,861 repeats, 59,413 missing-key cases, 59,413 wrong-value cases, 15,861 extra-key cases and 5,844 unavailable-state cases. The catalogs were confirmed deeply frozen, with 954 unique vanilla and 20 unique owned IDs and no overlap.

The new cold-start test failed against the predecessor production module with `3942 !== 0`; the candidate passes. Existing ground, native-alias, owned-ground, movement, liquid and composition tests pass (64 cases). These retain exact identity/state guards, movement-column behavior, RNG and teleport observations in the existing API adapters. The final candidate also passes the normal smoke entry point: 25 files, 689 tests, zero failures or skips.

Run from this checkout:

```sh
node tools/probe_projectile_ground_startup.mjs
node --import ./tests/helpers/register-minecraft-loader.mjs --test tests/legacy/test_projectile_dodge_*.mjs
python tools/run_tests.py --smoke
```

For the same counter against the immutable predecessor, create a separate checkout, then point the same probe at it:

```sh
git worktree add --detach ../grilling-startup-before bb8dd615ef3e8f613e325b93b2f24a62fb6e8d1b
node tools/probe_projectile_ground_startup.mjs ../grilling-startup-before
```

The probe records the production classifier SHA256 and runs in a fresh Node process. It counts actual Set construction and JSON serialization, not a reimplemented classifier. It does not measure Bedrock allocator behavior, native scheduling, resident memory, texture residency or iPhone loading.

## Remaining startup risks

This narrow change leaves the larger existing startup costs intact. The original main source inventory at 1baca4ce has 801 BP files and 3,547 RP files, 42,293,728 uncompressed source bytes in total. After #389 merged, current main at 5d31951d has 801 BP files and 3,531 RP files, 42,152,721 uncompressed source bytes; this candidate adds 318 bytes without changing the file count. Its 38 animation JSON files alone contain 17,042,790 bytes; geometry files contain 5,919,376 bytes. These are source sizes, not RAM estimates. #389 removes 16 old PNGs separately; 2.8.257 inherits that work.

The unchanged production `main.js` also triggers four full dynamic-property-ID enumerations during the first two ticks of the offline fixture, followed by the recipe-delivery recovery scan at tick 200. This is **Grilling's own BP dynamic-property namespace**, including its immutable saved item records, not other add-ons' namespaces. Two visual jobs retain full returned ID arrays while their per-key generator work is pending. In a synthetic 100,000-key Grilling namespace, those five calls return 500,000 array entries in aggregate. Native generator pacing, simultaneous residency and engine bytes remain unmeasured.

Combining recovery traversals or changing storage indexes needs separate read/write/restart and rollback evidence. Removing animation states, reducing visual quality, deleting unknown metadata or capping valid saved entries is outside this performance-only change.

No BDS, Minecraft client, user computer or LIVE world was used. No native memory, frame rate, gameplay/visual acceptance, or low-memory-device world-loading success is claimed.
