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
