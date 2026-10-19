# Offline world ID census

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
