# Offline world ID census

## T1.8 restart persistence spotcheck (manual observations)

`persistence_spotcheck.py` is a small, standard-library-only comparison entry
point. It **does not collect from Minecraft**, open LevelDB, connect to a server,
start BDS, or change packs/worlds. It compares two private JSON observation files:

```sh
python3 tools/ops/persistence_spotcheck.py <private-before.json> <private-after.json>
python3 tools/guards/test_guards.py PersistenceSpotcheck
```

Exit **0** means only that the supplied observations match, **1** reports changes,
and **2** means invalid/incomplete inputs. Stdout contains sample labels, differing
field categories and slot numbers, never raw state, lore, names, item IDs, property
keys/values, coordinates, file paths, player IDs or opaque evidence references.
Every result keeps `client=false`, `production_ready=false` and
`staging_acceptance=not_established`. An operator declaration is not independently
verified evidence. There is no ignore list or automatic acceptance of timer drift.

### Smallest human procedure for plan §9.5 item 10

1. The staging owner first verifies the existing T1.8 gates: LKG-derived staging
   world, approved identical pack combination and version, and real player join.
   Record the existing private world/backup identity, ordered pack inventory and
   version, normal gameplay time, and evidence privately. Do not use a production
   world. Do not change credentials, networking, authentication or packs to run this
   comparator. This task does not authorize a server restart; its owner handles it.
2. In normal survival gameplay, prepare the six samples below. Use real recipes,
   transfers and machine actions; no injected dynamic properties, commands that
   fabricate station contents, or DB edits. Keep their exact private dimension,
   coordinates and inventory mapping in a local worksheet. Assign each a stable
   random `locator_ref` and `sample_id`; never use a player name as an identifier.

   | Sample | Minimum before state and normal-gameplay observation |
   | --- | --- |
   | `grill-01` | One placed grill, three occupied slots with distinguishable skewers; record orientation, unlit state, oil/seasoning and each slot's identity, quantity and lore. Extinguish and let cooking stop before baseline. |
   | `plate-01` | One placed plate with distinguishable contents (at least two skewers); record facing, ordered contents and lore/quantity. |
   | `rack-01` | One rack with at least two occupied slots holding different stacks, plus a nondefault filter; record all nine slots, filters and quick-pick mapping. |
   | `bottle-01` | One placed bottle with a normally mixed SPECIAL seasoning after at least one use; record remaining uses, bottle position/stage, all four slots and item lore. Finish shaking before baseline. |
   | `vat-01` | One nonempty settled vat; record fluid type, exact bucket quantity and visible level. `items: []` is valid for this station. |
   | `oil-01` | One completed, idle oil press plus a normally used oil brush in a fixed test inventory slot; record press residue/progress, brush oil type/remaining amount and lore. Record Cookery oil pot only when available, separately in this state, without changing private dependencies. |

3. Capture **before** screenshots/worksheet immediately before the staging owner
   performs the approved normal stop. Do not retrieve, eat, shake, filter or move
   these samples in between. Record all empty slots explicitly in `state`; `items`
   lists occupied slots only. Inventory slots can use a privately documented fixed
   numbering for combined machine/tool samples. Do not record unrelated inventory,
   chat, credentials, account identifiers or other players. Retain evidence locally
   outside Git. Active hot-food expiry/effects are separate timed tests: settle
   them or record actual changes; never erase differences to obtain equality.
4. After the owner completes normal stop/start of **the same world without restore,
   reset or pack replacement**, rejoin and inspect the same six locators before
   changing their contents. Record **after** independently with new evidence IDs
   and later time; do not copy the before observations as evidence. Compare first,
   then test normal retrieval/use/filter behavior as a separate human check. If an
   inspection must remove a stack to see lore, document the move, put it back in
   the same slot before the next baseline, and recheck the final slot/quantity.
5. Run the command against the two private inputs. Investigate every difference;
   missing data is not an empty value. If a field cannot be inspected, report that
   field **未跑／未能觀察**, and do not present the pair as complete. A client UI
   observation alone does not read hidden persisted metadata: do not fill
   `properties: {}` to mean unknown. An empty map means verified absent. If no
   approved read-only metadata capture already exists, retain the visible checks
   separately and report hidden-property coverage pending; do not add a runtime
   probe or query a live DB for this task.

This is the minimum restart subset, **not** completion of §9.5 items 1–11. It does
not establish hunger, sound, rendering, family compatibility or T1.8 acceptance.
The 2026-10-21 restart with no player join cannot substitute for these samples.

### Private input contract and safe difference format

Both files have exactly these top-level fields:

| Field | Value |
| --- | --- |
| `schema` | Integer `1` |
| `evidence_kind` | `manual_staging` for real observations; `synthetic_fixture` for tool tests, never mix |
| `world_ref`, `run_ref` | Same random canonical lowercase UUIDs in both files; privately map to world lineage and restart run |
| `capture_ref` | Distinct random UUID for each capture |
| `phase`, `captured_at` | `before` / `after`, and actual ISO UTC time ending `Z`, strictly increasing |
| `pack_set_sha256` | Same actual SHA256 of the private ordered pack inventory file; a declared binding, not proof of the active server |
| `checks` | Boolean `joined: true`, `normal_gameplay: true`, `normal_restart_completed: false` before / `true` after; attest only what actually happened |
| `samples` | Array of six or more samples, covering all six kinds; same unique IDs and locators in both captures |

Each sample has exactly `sample_id` (`<kind>-<two digits>`), `kind` (`grill`,
`plate`, `rack`, `bottle`, `vat`, `oil`), `locator_ref`, `evidence_ref` (random
UUID mapping to independent private screenshot/worksheet; distinct across the
pair), `state` (nonempty object of observed station state), and `items` (occupied
slots). Each occupied slot has exactly `slot` (integer 0–255), `type_id` (actual
namespaced ID), `amount` (integer 1–255), `lore` (ordered strings preserving all
formatting), `properties` (observed item metadata object), `name` (actual custom
name or verified empty string). No extra fields. State keys are the operator's
stable recorded measurements, not automatically discovered persisted keys.
Keep the same capture scope across the pair; record block disappearance as actual
air/missing state and absent items, not by deleting its sample record.

For G155, the public sources `family_station_storage.js` and
`world_properties.mjs` distinguish the 3/9/4-slot native storage helpers from
visual entities, plate serialized contents, rack filters, bottle state, oil press
and vat state. Do not count a visual helper or registry reference as a second
inventory. Existing `world_ids.py` output is aggregate and cannot supply these
per-slot lore observations; its stopped-copy manifest/cloning safeguards remain
necessary for any separately approved offline census. Backup rules remain plan
§5.3; this tool creates no backup and never opens a DB binding.

Object key order is ignored; JSON value types, array order, item slots and all
text formatting are compared exactly. Duplicate JSON keys, nonfinite numbers,
inputs over 1 MiB, reused evidence, omitted domains, mismatched context or missing
required fields fail closed. The tool cannot detect fabricated observations or
two files that omit the same unrecorded state; human evidence review is required.
No real before/after inputs ship in this repository. Test-generated fixtures use
`synthetic_fixture` and `fixture:example`, never real world data.

Example **result shape only**, not an executed staging result:

```json
{"sample_id":"rack-01","equal":false,"differences":[{"field":"amount","slot":1},{"field":"lore","slot":1},{"field":"state"}]}
```

Invalid input returns `invalid_or_incomplete_input` and exit 2 without echoing
parser exception text or input values. Full screenshots/worksheets and both input
files remain private. The safe diff still needs review before public sharing.

`world_ids.py` implements rebuild task T1.6 using `leveldb-zlib` 1.2.0 and
`prismarine-nbt` 2.8.0. It has no rewrite mode. Run it only against a restored,
stopped backup copy outside every server installation, with the original
private file manifest and the public save-compatibility lock.

The binding writes LevelDB housekeeping files when opening a database. The
Python entry point hashes the supplied copy, checks its exact DB file set and
contents against the backup manifest, and creates a separate temporary DB.
Only that temporary DB is opened by the binding. The entry point removes its
temporary files and checks the supplied copy again, including on failure.
It needs the DB size plus 2 GiB free space. It never requests database repair.
Iterator errors propagate; detection of every arbitrary bit corruption is not
proven by this binding.

## Install and run

Use Linux x86_64, Node 22, Python 3.12, a C++ compiler, zlib development headers and Node N-API
headers alongside the Node installation. Keep dependencies and native build
outputs outside the source checkout, so the existing source guards continue to
measure project files. Copy these seven files to a dedicated tool directory:
`world_ids.py`, `world_ids.mjs`, `world_nbt.mjs`, `world_properties.mjs`,
`package.json`, `package-lock.json`, `build-requirements.txt`.

In that directory:

```sh
python3 -m pip install --only-binary=:all: --require-hashes -r build-requirements.txt
npm ci --ignore-scripts --omit=dev --no-fund --no-audit
npm run build:native
python3 world_ids.py \
  --world-copy <restored-world-copy> \
  --source-manifest <private-stopped-backup-file-manifest> \
  --manifest-db-prefix 'worlds/<world-name>/db/' \
  --snapshot-archive-sha256 <verified-backup-archive-sha256> \
  --key-lock <checkout>/tools/guards/save-compat.lock.json \
  --scratch-root <private-temporary-directory> > <private-result.json> 2> <private-error.log>
```

Keep the manifest, full stderr, input paths and any diagnostic records private.
Review the aggregate result before publishing it. `complete=false` or a nonzero
exit means the census is incomplete, including unknown target schemas or IDs;
it must not be used as evidence that an item is absent.

## Counts and limits

The output separates physical NBT stacks, nested inventories, hidden storage
entities, visual copies, actual placed block quantities, palette entries,
serialized contents and references. Item counts use unsigned byte quantities.
All subchunk storage layers and their actual palette indices are scanned;
unused palette entries remain separate. Block states preserve their NBT types.
Scheduled block ticks are references, not additional placed blocks. Recovery
journals, recipe references and immutable item-metadata caches do not add active
inventory; active carriers resolve their own serialized contents.

Malformed non-null rack slots and non-compound block-entity roots make the census incomplete. An empty (zero-count) carrier never contributes active nested inventory. Any physical or serialized contents found beneath it, including nested empty carriers, are contradictory and make the result incomplete; owned identifiers remain references for review. No contents are repaired or removed.

Actor records are scanned once. The `digp` index is used for diagnostics and
never adds another entity count. Noncanonical actor keys retain their complete
opaque bytes and are scanned with a warning. A duplicate identity involving any
owned data or a member that could not be parsed makes the result incomplete.
Only duplicate groups whose every member parsed successfully and contributed
zero owned physical, serialized or referenced objects are reported as unrelated
warnings. No key normalization, inventory conversion or orphan
cleanup is performed. An air/wrong-block station is distinguished from a
station whose chunk cannot be inspected.

`actor_identity.duplicate_records` counts the extra `n-1` records in each
duplicate group; it does not count every member of those groups.

Unknown target-bearing saved structures or other unclassified records are
rejected rather than guessed. The output describes the supplied snapshot;
it does not establish future migration safety or rendered/client behavior.

## Synthetic behavior tests

The dedicated `world-census.yml` job installs pinned dependencies and compiles
the native binding from the locked package source, with lifecycle scripts
disabled. It runs the existing guard test file's `WorldIds` class against small,
independently encoded NBT/subchunk fixtures and disposable synthetic databases.
The default fast guard job needs only the standard library and skips that class.
To run it locally from a checkout with a prepared isolated tool directory:

```sh
WORLD_IDS_TESTS=1 OPS_BASE=<isolated-tool-directory> python3 tools/guards/test_guards.py WorldIds
```

Format and dependency sources:

- [Node Bedrock LevelDB binding](https://github.com/extremeheat/node-leveldb-zlib/tree/7862c1652a5d8c124e6264f1256b11e52b1a2279)
- [Prismarine NBT](https://github.com/PrismarineJS/prismarine-nbt/tree/38e111a950f32eead3df481feadeece0cf097297)
- [Bedrock chunk storage](https://github.com/PrismarineJS/prismarine-chunk/blob/master/src/bedrock/common/PalettedStorage.js)
- [Bedrock pending tick schema](https://github.com/8Crafter-Studios/mcbe-leveldb/blob/main/nbtSchemas.ts)
