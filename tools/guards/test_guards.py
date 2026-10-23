"""The two guards must fail on the exact damage they exist to stop."""
import json
import sys
import unittest
import tempfile
import importlib.util
import hashlib
import subprocess
from copy import deepcopy
from pathlib import Path
from uuid import uuid4
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import save_compat as sc  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ops"))
import persistence_spotcheck as spot  # noqa: E402


class SaveCompat(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.now = sc.collect()
        cls.lock = json.loads(sc.LOCK.read_text(encoding="utf-8"))

    def test_current_runtime_matches_lock(self):
        errors, additions = sc.check(self.lock, self.now)
        self.assertEqual(errors, [])
        self.assertEqual(additions, [])

    def test_removed_item_entity_state_and_uuid_fail(self):
        now = json.loads(json.dumps(self.now))
        now["items"].remove("kaleidoscope_grilling:grilled_beef_skewer_native_plain")
        now["entities"].remove("kaleidoscope_grilling:inventory_grill_v1")
        now["persisted_key_literals"].remove("kaleidoscope_grilling:storage_v1/")
        now["blocks"]["kaleidoscope_grilling:canola_crop"]["kaleidoscope_grilling:age"].remove("7")
        now["packs"]["BP"]["header_uuid"] = "00000000-0000-0000-0000-000000000000"
        with mock.patch.object(sc, "load_retirements", return_value={}):
            errors, _ = sc.check(self.lock, now)
        text = "\n".join(errors)
        for needle in ("grilled_beef_skewer_native_plain", "inventory_grill_v1", "storage_v1/",
                       "#state:kaleidoscope_grilling:age=7", "header UUID changed"):
            self.assertIn(needle, text)

    def test_retirement_needs_receipt_and_living_runtime_migration(self):
        now = json.loads(json.dumps(self.now))
        gone = "kaleidoscope_grilling:grilled_beef_skewer_native_plain"
        now["items"].remove(gone)
        incomplete = {gone: {"id": gone, "replacement": "kaleidoscope_grilling:grilled_beef_skewer",
                             "migration": "runtime", "reason": "shadow route item"}}
        with mock.patch.object(sc, "load_retirements", return_value=incomplete):
            errors, _ = sc.check(self.lock, now)
        self.assertTrue(any("world_rewrite_receipt" in e for e in errors), errors)
        complete = {gone: dict(incomplete[gone], world_rewrite_receipt="ops/receipts/example.json")}
        with mock.patch.object(sc, "load_retirements", return_value=complete):
            errors, _ = sc.check(self.lock, now)
        self.assertTrue(any("invalid migration evidence" in e for e in errors), errors)

    def test_storage_capacity_and_ownership_cannot_change_silently(self):
        for edit in (lambda row: row.update(inventory_size=1),
                     lambda row: row.update(restrict_to_owner=False)):
            now = json.loads(json.dumps(self.now))
            edit(now["storage_components"]["kaleidoscope_grilling:inventory_grill_v1"]["components"])
            errors, _ = sc.check(self.lock, now)
            self.assertTrue(any("storage component" in e for e in errors), errors)
        now = json.loads(json.dumps(self.now))
        del now["storage_components"]["kaleidoscope_grilling:inventory_grill_v1"]
        errors, _ = sc.check(self.lock, now)
        self.assertTrue(any("storage component" in e for e in errors), errors)

    def test_added_state_values_must_enter_the_lock(self):
        now = json.loads(json.dumps(self.now))
        now["blocks"]["kaleidoscope_grilling:canola_crop"]["kaleidoscope_grilling:age"].append("8")
        errors, additions = sc.check(self.lock, now)
        self.assertFalse(errors)
        self.assertTrue(any("value added: 8" in line for line in additions))

    def test_receipt_requires_valid_mode_binding_and_preserved_counts(self):
        gone = "guard:old"
        base = {"items": [gone]}
        now = {"items": [], "entities": [], "persisted_key_literals": [], "blocks": {}, "packs": {}}
        row = {"id": gone, "replacement": "guard:new", "migration": "offline-rewrite",
               "reason": "synthetic fixture", "world_rewrite_receipt": "proof.json"}
        proof = {"id": gone, "replacement": "guard:new", "migration": "offline-rewrite",
                 "staging_first_load": True, "staging_restart": True,
                 "counts_before": {gone: 3, "guard:new": 2}, "counts_after": {gone: 0, "guard:new": 5}}
        with tempfile.TemporaryDirectory() as temp, mock.patch.object(sc, "ROOT", Path(temp)):
            data = json.dumps(proof).encode()
            (Path(temp) / "proof.json").write_bytes(data)
            row["receipt_sha256"] = hashlib.sha256(data).hexdigest()
            with mock.patch.object(sc, "load_retirements", return_value={gone: row}):
                self.assertEqual(sc.check(base, now)[0], [])
                for changes in ({"migration": "anything"}, {"receipt_sha256": "fake"},
                                {"world_rewrite_receipt": "missing.json"},
                                {"world_rewrite_receipt": "../proof.json"}):
                    with mock.patch.dict(row, changes):
                        self.assertTrue(sc.check(base, now)[0], changes)
                proof["counts_after"]["guard:new"] = 4
                data = json.dumps(proof).encode()
                (Path(temp) / "proof.json").write_bytes(data)
                row["receipt_sha256"] = hashlib.sha256(data).hexdigest()
                self.assertTrue(sc.check(base, now)[0])

    def test_state_retirement_uses_the_evidence_path(self):
        now = json.loads(json.dumps(self.now))
        ident = "kaleidoscope_grilling:canola_crop#state:kaleidoscope_grilling:age=7"
        now["blocks"]["kaleidoscope_grilling:canola_crop"]["kaleidoscope_grilling:age"].remove("7")
        row = {"id": ident, "replacement": "fixture:new", "migration": "invalid",
               "reason": "fixture", "world_rewrite_receipt": "fake.json"}
        with mock.patch.object(sc, "load_retirements", return_value={ident: row}):
            self.assertTrue(any("unsupported migration" in e for e in sc.check(self.lock, now)[0]))


class LexicalGuards(unittest.TestCase):
    def test_persisted_keys_ignore_variable_case_and_follow_helpers(self):
        from js_tokens import persisted_literals
        source = """
        const stateTag='senluo:grilling_item_', alias=stateTag;
        function lookup(entity, tag) { return entity.getDynamicProperty(tag); }
        lookup(world, alias);
        const journal = block => 'other:journal:' + block.x;
        world.setDynamicProperty(journal(block), 1);
        // world.setDynamicProperty('ignored:comment', 1);
        const unused='ignored:unused';
        getItemProperty(stack, 'other:metadata');
        """
        found = persisted_literals(source)
        self.assertIn('senluo:grilling_item_', found)
        self.assertIn('other:metadata', found)
        self.assertIn('other:journal:', found)
        self.assertNotIn('ignored:comment', found)
        self.assertNotIn('ignored:unused', found)

    def test_whitespace_listeners_count_without_comments_or_string_payloads(self):
        from js_tokens import code
        import re
        source = """
        world ?. beforeEvents . playerInteractWithBlock . subscribe (handler);
        system ["runInterval"] (tick);
        // system.runInterval(fake);
        const label='system.runInterval(fake)';
        """
        normalized = code(source)
        self.assertEqual(len(re.findall(r'beforeEvents\.playerInteractWithBlock\.subscribe', normalized)), 1)
        self.assertEqual(len(re.findall(r'system\.runInterval\(', normalized)), 1)

    def test_missing_metric_fails_check_and_tighten(self):
        import growth_ratchet as gr
        with tempfile.TemporaryDirectory() as temp:
            ceiling = Path(temp) / "ceilings.json"
            ceiling.write_text(json.dumps({"ceilings": {"kept": 1, "lost": 1}}))
            with mock.patch.object(gr, "CEILINGS", ceiling), mock.patch.object(gr, "measure", return_value={"kept": 1}):
                self.assertEqual(gr.main(["check"]), 1)
                self.assertEqual(gr.main(["tighten"]), 1)
            self.assertIn("lost", json.loads(ceiling.read_text())["ceilings"])

    def test_nested_tools_and_only_tracked_artifacts_are_measured(self):
        import growth_ratchet as gr
        with tempfile.TemporaryDirectory() as temp, mock.patch.object(gr, "ROOT", Path(temp)):
            root = Path(temp)
            (root / "tools/nested").mkdir(parents=True)
            (root / "tools/nested/g999_hidden.py").write_text("")
            (root / "artifacts").mkdir()
            (root / "artifacts/ignored.mcaddon").write_text("ignored")
            self.assertEqual(gr.METRICS["version_layer_tools"](), 1)
            with mock.patch.object(gr.subprocess, "check_output", return_value=b""):
                self.assertEqual(gr.committed_artifacts(), 0)


class ServerInventory(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = Path(sc.__file__).resolve().parents[1] / "ops/server_inventory.py"
        spec = importlib.util.spec_from_file_location("server_inventory", path)
        cls.ops = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.ops)

    def test_jsonc_preserves_urls_and_comma_braces_in_strings(self):
        source = '{"url":"https://example.invalid/x", // inline\n"label":",}","items":[1,],}'
        self.assertEqual(json.loads(self.ops.strip_jsonc(source)),
                         {"url": "https://example.invalid/x", "label": ",}", "items": [1]})

    def test_missing_root_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(SystemExit) as error:
                self.ops.main(["--server-root", temp])
            self.assertNotEqual(error.exception.code, 0)

    def test_bad_stack_and_entity_inputs_are_reported(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); world = root / "worlds/fixture"; world.mkdir(parents=True)
            (world / "world_behavior_packs.json").write_text('{}')
            (world / "world_resource_packs.json").write_text('[42]')
            pack = root / "behavior_packs/fixture"; (pack / "entities").mkdir(parents=True)
            (pack / "manifest.json").write_text(json.dumps({"header": {"uuid": "fixture", "version": [1, 0, 0]}}))
            (pack / "entities/bad.json").write_text('[]')
            (pack / "entities/valid-overlay.json").write_text('{"minecraft:entity":{"components":{}}}')
            report = self.ops.world_report(root, world)
            self.assertEqual(len(report["problems"]), 3, report)
            installed = self.ops.installed_packs(root, world)
            self.assertEqual(installed["fixture"][0]["entity_fragments_without_identifier"],
                             ["entities/valid-overlay.json"])



# This fragment belongs in the existing tools/guards/test_guards.py.
# The default guard job uses only the standard library and skips this class.
import os


@unittest.skipUnless(os.environ.get('WORLD_IDS_TESTS') == '1',
                     'offline world census has its own pinned native dependency job')
class WorldIds(unittest.TestCase):
    """Exercise actual binary NBT, packed subchunks and disposable native DBs."""

    KG = 'kaleidoscope_grilling:'
    FOOD = KG + 'grilled_beef_skewer'
    SECRET = KG + 'secret_skewer'
    OWNER = '11111111-1111-4111-8111-111111111111'
    OWNER2 = '22222222-2222-4222-8222-222222222222'
    PREFIXES = [KG, KG + 'g_', KG + 'storage_v1/', KG + 'sb_', KG + 'rack_filters_',
                KG + 'a25_plate_', KG + 'a25_recipe_', KG + 'a26_press_',
                KG + 'a26_press_instance_', KG + 'a26_vat_', KG + 'a26_vat_instance_',
                KG + 'a2736_oilpot_type_', KG + 'a23_oil_source_', KG + 'cuisine_',
                KG + 'plate_skewers', KG + 'rack_payload', KG + 'recipe_record',
                'senluo:grilling_item_', 'kc_oilpot:', 'senluo:oil_api_placed:']
    NODE_RUNNER = r'''
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const request = JSON.parse(fs.readFileSync(0, 'utf8'));
const base = process.env.OPS_BASE;
const {parseOneNbt, parseRoots, parseSubchunk} = await import(pathToFileURL(base + '/world_nbt.mjs'));
const {census} = await import(pathToFileURL(base + '/world_ids.mjs'));
const bytes = text => Buffer.from(text, 'base64');
const records = (request.records ?? []).map(([key, value]) => [bytes(key), bytes(value)]);
let output;
try {
  switch (request.action) {
    case 'probe': {
      const {default: binding} = await import(pathToFileURL(base + '/node_modules/leveldb-zlib/index.js'));
      output = {ok: typeof binding?.LevelDB === 'function'}; break;
    }
    case 'nbt': {
      const roots = await parseRoots(bytes(request.data), request.multiple ?? false);
      output = {ok: true, roots}; break;
    }
    case 'one': {
      const parsed = await parseOneNbt(bytes(request.data), request.offset ?? 0);
      output = {ok: true, ...parsed}; break;
    }
    case 'subchunk': {
      const parsed = await parseSubchunk(bytes(request.data), request.y);
      output = {ok: true, ...parsed, storages: parsed.storages.map(row => ({palette: row.palette, indices: Array.from(row.indices)}))}; break;
    }
    case 'census': output = await census(records, request.options ?? {}); break;
    case 'create_db': {
      const {default: binding} = await import(pathToFileURL(base + '/node_modules/leveldb-zlib/index.js'));
      const db = new binding.LevelDB(request.db, {createIfMissing: true});
      try { await db.open(); for (const [key, value] of records) await db.put(key, value); }
      finally { await db.close(); }
      output = {ok: true}; break;
    }
    default: throw Error('TEST_ACTION');
  }
} catch (error) { output = {ok: false, code: error.code ?? 'UNEXPECTED_TEST_ERROR', message: error.message}; }
process.stdout.write(JSON.stringify(output, (key, value) => typeof value === 'bigint' ? String(value) : value));
'''

    @classmethod
    def setUpClass(cls):
        import shutil
        cls.ops = Path(os.environ.get('OPS_BASE', Path(__file__).resolve().parents[1] / 'ops')).resolve()
        if not shutil.which('node'):
            raise AssertionError('WORLD_IDS_TESTS requires Node and the locked native dependencies')
        for filename in ('world_ids.py', 'world_ids.mjs', 'world_nbt.mjs', 'world_properties.mjs'):
            if not (cls.ops / filename).is_file():
                raise AssertionError('Missing required census source: ' + filename)
        probe = cls.run_node({'action': 'probe'})
        if probe != {'ok': True}:
            raise AssertionError('Pinned census native dependencies are unavailable: ' + repr(probe))

    @staticmethod
    def b64(value):
        import base64
        return base64.b64encode(value).decode('ascii')

    @classmethod
    def run_node(cls, request):
        import subprocess
        env = dict(os.environ, OPS_BASE=str(cls.ops))
        run = subprocess.run(['node', '--input-type=module', '-e', cls.NODE_RUNNER],
                             input=json.dumps(request), text=True, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, env=env, timeout=30)
        if run.returncode:
            raise AssertionError('Census test process failed: ' + run.stderr[-3000:])
        try:
            return json.loads(run.stdout)
        except ValueError as exc:
            raise AssertionError('Census test returned no JSON: ' + run.stdout[-1000:]) from exc

    @staticmethod
    def payload(tag):
        """Small independent little-endian NBT writer; no production codec used."""
        import struct
        kind, value = tag
        if kind in (1, 2, 3, 4, 5, 6):
            return struct.pack({1: '<b', 2: '<h', 3: '<i', 4: '<q', 5: '<f', 6: '<d'}[kind], value)
        if kind == 8:
            encoded = value if isinstance(value, bytes) else value.encode('utf-8')
            return struct.pack('<H', len(encoded)) + encoded
        if kind == 7:
            return struct.pack('<i', len(value)) + value
        if kind == 9:
            child_kind, children = value
            return bytes([child_kind]) + struct.pack('<i', len(children)) + b''.join(WorldIds.payload((child_kind, child)) for child in children)
        if kind == 10:
            entries = value.items() if isinstance(value, dict) else value
            return b''.join(bytes([child[0]]) + WorldIds.payload((8, name)) + WorldIds.payload(child)
                            for name, child in entries) + b'\0'
        if kind in (11, 12):
            return struct.pack('<i', len(value)) + b''.join(struct.pack('<i' if kind == 11 else '<q', child) for child in value)
        raise AssertionError('Unsupported fixture NBT type ' + str(kind))

    @classmethod
    def root(cls, fields, name=''):
        return b'\x0a' + cls.payload((8, name)) + cls.payload((10, fields))

    @classmethod
    def stack(cls, ident=None, amount=1, extra=None):
        return dict({'Name': (8, ident or cls.FOOD), 'Count': (1, amount)}, **(extra or {}))

    @classmethod
    def actor(cls, ident, identity, **fields):
        return cls.root(dict({'identifier': (8, ident), 'UniqueID': (4, identity)}, **fields))

    @staticmethod
    def actor_key(identity):
        import struct
        return b'actorprefix' + struct.pack('<q', identity)

    @staticmethod
    def chunk_key(x=0, z=0, tag=0x2f, y=0, dimension=None):
        import struct
        out = struct.pack('<ii', x, z)
        if dimension is not None:
            out += struct.pack('<i', dimension)
        out += bytes([tag])
        return out + bytes([y & 255]) if tag == 0x2f else out

    @classmethod
    def palette(cls, ident, states=None):
        return cls.root({'name': (8, ident), 'states': (10, states or {}), 'version': (3, 18168865)})

    @classmethod
    def storage(cls, bits, palette, indices=None):
        import struct
        if bits == 0:
            if len(palette) != 1:
                raise AssertionError('Uniform fixture palette must contain exactly one entry')
            return b'\0' + palette[0]
        indices = indices if indices is not None else [0] * 4096
        if len(indices) != 4096:
            raise AssertionError('Fixture subchunk requires 4096 indices')
        stride = 32 // bits
        words = []
        for start in range(0, 4096, stride):
            word = 0
            for slot, index in enumerate(indices[start:start + stride]):
                word |= index << (slot * bits)
            words.append(struct.pack('<I', word))
        return bytes([bits * 2]) + b''.join(words) + struct.pack('<I', len(palette)) + b''.join(palette)

    @classmethod
    def subchunk(cls, storages, y=0, version=9):
        return bytes([version, len(storages)]) + (bytes([y & 255]) if version == 9 else b'') + b''.join(storages)

    @classmethod
    def properties(cls, scopes):
        return cls.root({owner: (10, props) for owner, props in scopes.items()}, 'DynamicProperties')

    @classmethod
    def options(cls, **overrides):
        blocks = [cls.KG + name for name in ('grill', 'oil_press', 'big_vat', 'advanced_rack_block',
                  'skewer_plate_block', 'skewer_recipe', 'canola_oil', 'seasoning_bottle_1',
                  'seasoning_bottle_2', 'seasoning_bottle_3', 'seasoning_bottle_4')]
        result = {'persistedKeys': cls.PREFIXES,
                  'knownItems': [cls.FOOD, cls.SECRET, cls.KG + 'advanced_rack', cls.KG + 'skewer_plate', cls.KG + 'skewer_recipe_book'],
                  'knownEntities': [cls.KG + value for value in ('inventory_grill_v1', 'inventory_rack_v1', 'inventory_seasoning_v1', 'equipment_visual')],
                  'knownBlocks': {ident: ({cls.KG + 'lit': ['true', 'false']} if ident == cls.KG + 'grill' else {}) for ident in blocks}}
        result.update(overrides)
        return result

    @classmethod
    def census(cls, records, **options):
        return cls.run_node({'action': 'census', 'records': [[cls.b64(key), cls.b64(value)] for key, value in records],
                             'options': cls.options(**options)})

    @staticmethod
    def counts(result, category='items'):
        return {(row['id'], row['location_type']): (row['quantity'], row['stacks']) for row in result[category]}

    def assert_error(self, result, code):
        self.assertFalse(result.get('complete', result.get('ok', True)), result)
        self.assertIn(code, [row['code'] for row in result.get('errors', [])] or [result.get('code')], result)

    def test_nbt_little_endian_concatenation_and_offsets(self):
        first = self.root({'x': (3, -513), 'value': (6, 1.25), 'signed': (1, -1)})
        second = self.root({'Items': (9, (10, [self.stack(amount=7)]))})
        decoded = self.run_node({'action': 'nbt', 'data': self.b64(first + second), 'multiple': True})
        self.assertTrue(decoded['ok'], decoded)
        self.assertEqual(len(decoded['roots']), 2)
        self.assertEqual(decoded['roots'][0]['value']['x']['value'], -513)
        self.assertEqual(decoded['roots'][0]['value']['value']['value'], 1.25)
        self.assertEqual(decoded['roots'][1]['value']['Items']['value']['value'][0]['Count']['value'], 7)
        parsed = self.run_node({'action': 'one', 'data': self.b64(first + second), 'offset': len(first)})
        self.assertEqual(parsed['nextOffset'], len(first + second))
        self.assert_error(self.run_node({'action': 'nbt', 'data': self.b64(first + second)}), 'NBT_TRAILING_BYTES')

    def test_nbt_malformed_boundaries_rejected_without_private_text(self):
        import struct
        private = 'PRIVATE_PLAYER_SECRET_61357'
        duplicate = self.root([('Name', (8, private)), ('Name', (8, self.FOOD))])
        malformed = [
            (self.root({'Name': (8, private)})[:-1], 'NBT_TRUNCATED'),
            (duplicate, 'NBT_DUPLICATE_NAME'),
            (self.root({'Name': (8, b'\xff')}), 'NBT_INVALID_UTF8'),
            (b'\x0a\0\0\x09\x01\0x\x0a' + struct.pack('<i', -1) + b'\0', 'NBT_NEGATIVE_LENGTH'),
            (b'\x0a\0\0\x09\x01\0x\0' + struct.pack('<i', 1) + b'\0', 'NBT_NONEMPTY_END_LIST'),
            (b'\x0a\0\0\x07\x01\0x' + struct.pack('<i', 1000001) + b'\0', 'NBT_ARRAY_BUDGET'),
            (b'\x0a\0\0\x0d\x01\0x\0', 'NBT_UNKNOWN_TAG'),
            (self.root({'__proto__': (8, private)}), 'NBT_UNREPRESENTABLE_NAME'),
            (self.root({'Name': (8, private)}) + b'\0', 'NBT_TRAILING_BYTES'),
        ]
        nested = {'Name': (8, private)}
        for _ in range(131):
            nested = {'child': (10, nested)}
        malformed.append((self.root(nested), 'NBT_DEPTH_BUDGET'))
        for data, code in malformed:
            with self.subTest(code=code):
                result = self.run_node({'action': 'nbt', 'data': self.b64(data)})
                self.assert_error(result, code)
                self.assertNotIn(private, json.dumps(result))
        opaque = self.run_node({'action': 'nbt', 'data': self.b64(self.root({'StorageKey': (8, b'\xff\0\x80')}))})
        self.assertTrue(opaque['ok'], opaque)
        self.assertEqual([ord(c) for c in opaque['roots'][0]['value']['StorageKey']['value']], [255, 0, 128])

    def test_subchunk_packing_all_disk_widths_and_two_layers(self):
        for bits in (0, 1, 2, 3, 4, 5, 6, 8, 16):
            size = 1 if bits == 0 else min(7, 1 << bits)
            indices = [(index * 11 + index // 13) % size for index in range(4096)]
            palette = [self.palette('minecraft:air' if index == 0 else self.KG + 'grill', {'fixture:variant': (3, index)}) for index in range(size)]
            blob = self.subchunk([self.storage(bits, palette, indices), self.storage(0, [self.palette('minecraft:water')])], y=-4)
            with self.subTest(bits=bits):
                result = self.run_node({'action': 'subchunk', 'data': self.b64(blob), 'y': -4})
                self.assertTrue(result['ok'], result)
                self.assertEqual(result['y'], -4)
                self.assertEqual(result['storages'][0]['indices'], indices)
                self.assertEqual(result['storages'][1]['indices'], [0] * 4096)
                self.assertEqual(result['storages'][0]['palette'][-1]['states']['fixture:variant'], size - 1)
        v8 = self.subchunk([self.storage(0, [self.palette(self.KG + 'grill')])], y=-2, version=8)
        result = self.run_node({'action': 'subchunk', 'data': self.b64(v8), 'y': -2})
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['version'], 8)

    def test_subchunk_invalid_versions_bounds_and_palette_indices_fail(self):
        import struct
        palette = self.palette(self.KG + 'grill')
        valid = self.subchunk([self.storage(0, [palette])], y=-2)
        invalid_indices = [0] * 4096
        invalid_indices[27] = 1
        cases = [
            (bytes([10, 0]), -2, 'SUBCHUNK_VERSION'),
            (valid, -1, 'SUBCHUNK_Y_MISMATCH'),
            (valid[:-1], -2, 'NBT_TRUNCATED'),
            (valid + b'\0', -2, 'SUBCHUNK_TRAILING_BYTES'),
            (bytes([9, 1, 0, 1]), 0, 'SUBCHUNK_RUNTIME_PALETTE'),
            (bytes([9, 1, 0, 14]), 0, 'SUBCHUNK_BITS'),
            (self.subchunk([self.storage(1, [palette], invalid_indices)]), 0, 'SUBCHUNK_PALETTE_INDEX'),
            (self.subchunk([bytes([2]) + b'\0' * 512 + struct.pack('<I', 0)]), 0, 'SUBCHUNK_PALETTE_COUNT'),
            (self.subchunk([b'\0' + self.root({'name': (8, self.KG + 'grill'), 'states': (8, 'invalid')})]), 0, 'SUBCHUNK_PALETTE_STATES'),
        ]
        for data, y, code in cases:
            with self.subTest(code=code):
                self.assert_error(self.run_node({'action': 'subchunk', 'data': self.b64(data), 'y': y}), code)

    def test_inventory_counts_nested_containers_equipment_and_actor_indexes(self):
        import struct
        shulker = self.stack('minecraft:shulker_box', 1, {'tag': (10, {'Items': (9, (10, [self.stack(amount=3)]))})})
        player = self.root({'Inventory': (9, (10, [self.stack(amount=7), shulker])),
                            'Offhand': (9, (10, [self.stack(amount=1)])),
                            'Armor': (9, (10, [self.stack(amount=2)])),
                            'EnderChestInventory': (9, (10, [self.stack(amount=4)])),
                            'SelectedInventorySlot': (3, 0)})
        container = self.root({'id': (8, 'Chest'), 'Items': (9, (10, [self.stack(amount=6)]))})
        records = [(b'player_server_SYNTHETIC_SECRET', player),
                   (self.chunk_key(tag=0x31), container + self.root({'id': (8, 'Barrel'), 'Items': (9, (10, [self.stack(amount=5)]))})),
                   (self.actor_key(11), self.actor(self.KG + 'inventory_grill_v1', 11, Inventory=(9, (10, [self.stack(amount=8)])))),
                   (self.actor_key(12), self.actor(self.KG + 'equipment_visual', 12, Inventory=(9, (10, [self.stack(amount=9)])))),
                   (self.actor_key(13), self.actor('minecraft:item', 13, Item=(10, self.stack(amount=10)))),
                   (self.actor_key(14), self.actor('minecraft:zombie', 14, Mainhand=(9, (10, [self.stack(amount=12)])))),
                   (b'digp' + struct.pack('<ii', 0, 0), struct.pack('<qqqqq', 11, 11, 12, 13, 999)),
                   (self.chunk_key(tag=0x32, x=1), self.actor(self.KG + 'inventory_rack_v1', 21, Inventory=(9, (10, [self.stack(amount=13)]))) + self.actor('minecraft:item', 22, Item=(10, self.stack(amount=14))))]
        # Some persisted actors use a binary storage key longer than eight
        # bytes. Prove the full suffix against their internal StorageKey;
        # truncating it would drop or merge inventory-bearing entities.
        for identity, suffix, amount in ((15, b'\xff\0', 16), (16, b'\x80\xff\0\x01', 17)):
            storage_key = struct.pack('<q', identity) + suffix
            internal = (10, {'EntityStorageKeyComponent': (10, {'StorageKey': (8, storage_key)})})
            records.append((b'actorprefix' + storage_key,
                            self.actor(self.KG + 'inventory_seasoning_v1', identity,
                                       Inventory=(9, (10, [self.stack(amount=amount)])), internalComponents=internal)))
        records.append((self.actor_key(17), self.actor('minecraft:chest_boat', 17,
                                                      ChestItems=(9, (10, [self.stack(amount=19)])))))
        result = self.census(records)
        self.assertTrue(result['complete'], result['errors'])
        self.assertEqual(self.counts(result), {(self.FOOD, location): count for location, count in {
            'player_inventory': (7, 1), 'player_inventory/nested_container': (3, 1),
            'player_offhand': (1, 1), 'player_armor': (2, 1), 'player_ender_chest': (4, 1),
            'container': (11, 2), 'hidden_inventory': (54, 4), 'visual_inventory': (9, 1),
            'dropped_item': (24, 2), 'entity_mainhand': (12, 1), 'entity_chest_inventory': (19, 1)}.items()})
        self.assertEqual(result['actor_index'], {'indexed_ids': 4, 'missing_actor_records': 1,
                         'unindexed_actor_records': 4, 'duplicate_index_references': 1})
        warnings = {row['code']: row['records'] for row in result['warnings']}
        self.assertEqual(warnings['NONCANONICAL_ACTOR_KEY_SCANNED'], 2)
        self.assertEqual(result['coverage']['legacy_entities'], 2)
        self.assertEqual(result['coverage']['player_data_records'], 1)
        self.assertNotIn('SYNTHETIC_SECRET', json.dumps(result))

    def test_unsigned_item_count_empty_slots_and_name_only_references(self):
        player = self.root({'Inventory': (9, (10, [self.stack(amount=-1), self.stack(amount=0)])), 'Metadata': (10, {'Name': (8, self.FOOD)})})
        server_players = [
            (b'player_server_OFFHAND', self.root({'ServerId': (8, 'private-server-id'), 'Offhand': (9, (10, [self.stack(amount=3)]))})),
            (b'player_server_ENDERCHEST', self.root({'ServerId': (8, 'private-server-id'), 'EnderChestInventory': (9, (10, [self.stack(amount=5)]))})),
            (b'player_server_ARMOR', self.root({'ServerId': (8, 'private-server-id'), 'Armor': (9, (10, [self.stack(amount=7)]))})),
            (b'player_MAPPING', self.root({'ServerId': (8, 'private-mapping-id'), 'Metadata': (10, {'Name': (8, self.SECRET)})})),
        ]
        result = self.census([(b'~local_player', player)] + server_players)
        self.assertTrue(result['complete'], result['errors'])
        self.assertEqual(self.counts(result), {(self.FOOD, 'player_inventory'): (255, 1),
                         (self.FOOD, 'player_offhand'): (3, 1), (self.FOOD, 'player_ender_chest'): (5, 1),
                         (self.FOOD, 'player_armor'): (7, 1)})
        references = {(row['id'], row['location_type']): row['occurrences'] for row in result['references']}
        self.assertEqual(references[(self.FOOD, 'player_inventory/empty_stack')], 1)
        self.assertEqual(references[(self.FOOD, 'player_other/named_reference')], 1)
        self.assertEqual(references[(self.SECRET, 'player_other/named_reference')], 1)
        self.assertEqual(result['coverage']['player_mapping_records'], 1)
        self.assertEqual(result['coverage']['player_data_records'], 4)
        self.assertNotIn('private-server-id', json.dumps(result))
        self.assertNotIn('private-mapping-id', json.dumps(result))
        bad = self.root({'Inventory': (9, (10, [self.stack(extra={'Count': (8, 'private-count')})]))})
        self.assert_error(self.census([(b'~local_player', bad)]), 'ITEM_COUNT_TYPE')

    def test_malformed_serialized_rack_slots_make_census_incomplete(self):
        for bad in ('damaged', 123, [], False):
            with self.subTest(slot=bad):
                rack = json.dumps({'version': 1, 'items': [bad] + [None] * 8})
                item = self.stack(self.KG + 'advanced_rack', 1, {'tag': (10, {
                    'DynamicProperties': (10, {self.OWNER: (10, {self.KG + 'rack_payload': (8, rack)})})})})
                result = self.census([(b'~local_player', self.root({'Inventory': (9, (10, [item]))}))])
                self.assert_error(result, 'RACK_PAYLOAD_SCHEMA')
                self.assertEqual(result['serialized_items'], [])

    def test_empty_carriers_do_not_create_active_nested_inventory(self):
        item = self.stack('minecraft:shulker_box', 0, {'tag': (10, {
            'Items': (9, (10, [self.stack(amount=3)]))})})
        result = self.census([(b'~local_player', self.root({'Inventory': (9, (10, [item]))}))])
        self.assert_error(result, 'EMPTY_CARRIER_CONTENTS')
        self.assertEqual(result['items'], [])
        self.assertEqual(result['serialized_items'], [])
        self.assertTrue(any(row['id'] == self.FOOD for row in result['references']))

    def test_empty_carriers_cannot_hide_serialized_contents(self):
        rack = json.dumps({'version': 1, 'items': [{'typeId': self.FOOD, 'amount': 3}] + [None] * 8})
        item = self.stack(self.KG + 'advanced_rack', 0, {'tag': (10, {
            'DynamicProperties': (10, {self.OWNER: (10, {self.KG + 'rack_payload': (8, rack)})})})})
        result = self.census([(b'~local_player', self.root({'Inventory': (9, (10, [item]))}))])
        self.assert_error(result, 'EMPTY_CARRIER_CONTENTS')
        self.assertEqual(result['items'], [])
        self.assertEqual(result['serialized_items'], [])

    def test_nested_empty_carriers_cannot_hide_serialized_contents(self):
        rack = json.dumps({'version': 1, 'items': [{'typeId': self.FOOD, 'amount': 3}] + [None] * 8})
        inner = self.stack(self.KG + 'advanced_rack', 0, {'tag': (10, {
            'DynamicProperties': (10, {self.OWNER: (10, {self.KG + 'rack_payload': (8, rack)})})})})
        outer = self.stack('minecraft:shulker_box', 0, {'tag': (10, {'Items': (9, (10, [inner]))})})
        result = self.census([(b'~local_player', self.root({'Inventory': (9, (10, [outer]))}))])
        self.assert_error(result, 'EMPTY_CARRIER_CONTENTS')
        self.assertEqual(result['items'], [])
        self.assertEqual(result['serialized_items'], [])

    def test_block_entity_roots_must_be_compounds(self):
        for kind, value in ((8, self.FOOD), (9, (8, [self.FOOD]))):
            with self.subTest(root_type=kind):
                raw = bytes([kind]) + self.payload((8, '')) + self.payload((kind, value))
                result = self.census([(self.chunk_key(tag=0x31), raw)])
                self.assert_error(result, 'BLOCK_ENTITY_ROOT_SCHEMA')

    def test_palette_counts_are_used_voxels_not_palette_entries(self):
        indices = [0] * 4096
        indices[0] = 1
        indices[1] = 2
        indices[31] = 2
        palette = [self.palette('minecraft:air'), self.palette(self.KG + 'grill', {'kaleidoscope_grilling:lit': (1, 0)}),
                   self.palette(self.KG + 'grill', {'kaleidoscope_grilling:lit': (1, 1)}), self.palette(self.KG + 'oil_press')]
        second = [0] * 4096
        second[4095] = 1
        result = self.census([(self.chunk_key(x=-1, z=-2, y=-4), self.subchunk([
            self.storage(2, palette, indices), self.storage(1, [self.palette('minecraft:air'), self.palette(self.KG + 'canola_oil')], second)], y=-4))])
        self.assertTrue(result['complete'], result['errors'])
        self.assertEqual(self.counts(result, 'blocks'), {(self.KG + 'grill', 'placed_block_layer_0'): (3, 2),
                                                        (self.KG + 'canola_oil', 'placed_block_layer_1'): (1, 1)})
        self.assertEqual(self.counts(result, 'palette_entries'), {(self.KG + 'grill', 'block_palette_layer_0'): (2, 2),
                                                                 (self.KG + 'oil_press', 'block_palette_layer_0'): (1, 1),
                                                                 (self.KG + 'canola_oil', 'block_palette_layer_1'): (1, 1)})

        states = {(row['id'], row['states'].get(self.KG + 'lit')): row for row in result['block_states']}
        for lit, amount in ((0, 1), (1, 2)):
            row = states[(self.KG + 'grill', lit)]
            self.assertEqual(row['quantity'], amount)
            self.assertEqual(row['state_types'], {self.KG + 'lit': 'byte'})
            self.assertEqual(row['palette_entries'], 1)
        self.assertEqual(states[(self.KG + 'oil_press', None)]['quantity'], 0)
        self.assertEqual(states[(self.KG + 'oil_press', None)]['palette_entries'], 1)

    def test_invalid_block_state_types_names_and_values_fail_without_leaking(self):
        kg = self.KG
        def record(fields):
            return [(self.chunk_key(), self.subchunk([self.storage(0, [self.palette(kg + 'grill', fields)])]))]
        result = self.census(record({'private:coordinate_567': (3, 921)}))
        self.assert_error(result, 'UNKNOWN_BLOCK_STATE')
        self.assertNotIn('private:coordinate_567', json.dumps(result))
        result = self.census(record({kg + 'lit': (3, 921)}))
        self.assert_error(result, 'UNKNOWN_BLOCK_STATE_VALUE')
        self.assertEqual(result['block_states'], [])
        result = self.census(record({kg + 'lit': (6, 1.0)}))
        self.assert_error(result, 'SUBCHUNK_STATE_TYPE')
        # The engine-provided cardinal-direction trait is legal without a custom declaration.
        result = self.census(record({'minecraft:cardinal_direction': (8, 'west')}))
        self.assertTrue(result['complete'], result['errors'])
        self.assertEqual(result['block_states'][0]['states'], {'minecraft:cardinal_direction': 'west'})

    def test_station_key_formats_and_seasoning_storage_block_alias(self):
        kg = self.KG
        storage_key = kg + 'storage_v1/minecraft:overworld/1/0/1'
        props = {
            kg + 'sb_minecraft_overworld_p1_p0_p1': (8, '[]'),
            storage_key: (8, json.dumps({'v': 1, 'key': storage_key, 'block': kg + 'seasoning_bottle',
                                        'entity': 'Private_Entity', 'token': 'Private_Token'})),
            kg + 'a23_oil_source_minecraft_overworld_hash_p17_p0_p1': (8, json.dumps({'d': 'minecraft:overworld', 'x': 17, 'y': 0, 'z': 1, 'type': 'canola', 'cells': []})),
            kg + 'cuisine_minecraft_overworld_33_0_1': (8, '{}'),
            'kc_oilpot:minecraft:overworld:49,0,1': (3, 256),
            kg + 'a2736_oilpot_type_minecraft_overworld_p49_p0_p1': (8, 'canola'),
            'senluo:oil_api_placed:minecraft:overworld:49,0,1': (8, '{}'),
            kg + 'rack_filters_minecraft_overworld_p49_p0_p1_transaction_fault': (8, 'Private_fault_reason'),
        }
        records = [(b'DynamicProperties', self.properties({self.OWNER: props}))]
        for x, ident in ((0, kg + 'seasoning_bottle_3'), (1, kg + 'canola_oil'),
                         (2, 'kaleidoscope_cookery:pot'), (3, 'kaleidoscope_cookery:oil_pot')):
            records.append((self.chunk_key(x=x), self.subchunk([self.storage(0, [self.palette(ident)])])))
        result = self.census(records)
        self.assertTrue(result['complete'], result['errors'])
        self.assertEqual(sum(row['present'] for row in result['station_keys'].values()), 7)
        self.assertEqual(result['station_orphan_keys'], 0)
        self.assertEqual(result['station_unavailable_keys'], 0)
        self.assertNotIn(kg + 'rack_filters_', result['station_keys'])
        for private in ('Private_Entity', 'Private_Token', 'Private_fault_reason', '49,0,1'):
            self.assertNotIn(private, json.dumps(result))

    def test_station_lookup_negative_coordinates_longest_prefix_and_unavailable(self):
        kg = self.KG
        properties = {
            kg + 'g_minecraft_overworld_m1_m64_m1': (8, '{}'),
            kg + 'g_minecraft_overworld_m2_m64_m1': (8, '{}'),
            kg + 'g_minecraft_overworld_m3_m64_m1': (8, '{}'),
            kg + 'g_minecraft_overworld_m1_p64_m1': (8, '{}'),
            kg + 'g_minecraft_overworld_p999_p64_p999': (8, '{}'),
            kg + 'a26_press_instance_minecraft_overworld_m1_m64_m1': (8, 'identity-token'),
            kg + 'a26_press_registry': (8, '[]'),
        }
        cells = [0] * 4096
        cells[(15 << 8) | (15 << 4)] = 1
        cells[(14 << 8) | (15 << 4)] = 2
        blob = self.subchunk([self.storage(2, [self.palette('minecraft:air'), self.palette(kg + 'grill'), self.palette(kg + 'oil_press')], cells)], y=-4)
        result = self.census([(b'DynamicProperties', self.properties({self.OWNER: properties, self.OWNER2: {kg + 'g_minecraft_overworld_m1_m64_m1': (8, '{}')}})),
                             (self.chunk_key(x=-1, z=-1, y=-4), blob)])
        self.assertTrue(result['complete'], result['errors'])
        self.assertEqual(result['station_keys'][kg + 'g_'], {'present': 2, 'air': 2, 'wrong_block': 1,
                                                            'chunk_unavailable': 1, 'unavailable': 0})
        self.assertEqual(result['station_keys'][kg + 'a26_press_instance_']['wrong_block'], 1)
        self.assertEqual(result['station_orphan_keys'], 4)
        self.assertEqual(result['station_unavailable_keys'], 1)
        self.assertEqual(result['dynamic_property_prefix_counts'][kg + 'g_'], 6)
        self.assertEqual(result['dynamic_property_prefix_counts'][kg + 'a26_press_'], 1)
        self.assertEqual(result['dynamic_property_prefix_counts'][kg + 'a26_press_instance_'], 1)
        self.assertEqual(result['dynamic_property_prefix_counts'][kg], 0)
        public = json.dumps(result)
        self.assertNotIn('m1_m64_m1', public)
        self.assertNotIn(self.OWNER, public)
        self.assertNotIn('identity-token', public)

    def test_serialized_contents_metadata_references_and_journals_are_separate(self):
        kg = self.KG
        rack = json.dumps({'version': 1, 'items': [{'typeId': self.FOOD, 'amount': 5, 'dynamic': {}, 'rawLore': []}] + [None] * 8,
                           'filters': [{'kind': 'seasoning', 'category': 'exact', 'typeId': self.FOOD}]})
        plate = json.dumps([{'id': self.SECRET, 'native': {'version': 1, 'id': self.SECRET, 'props': {}}}])
        token = '0123456789abcdef'
        lore = '§r§0§r§1§r§2' + ''.join('§' + char for char in token) + '§r'
        meta = {kg + 'plate_skewers': plate, kg + 'secret_creator': 'Private_Player_7', kg + 'recipe_record': json.dumps({'id': self.FOOD})}
        dp = {kg + 'a25_plate_minecraft_overworld_p0_p0_p0': (8, plate),
              kg + 'a25_recipe_minecraft_overworld_p1_p0_p0': (8, json.dumps({'id': kg + 'skewer_recipe_book', 'native': {'version': 1, 'id': kg + 'skewer_recipe_book', 'props': {}}})),
              kg + 'a25_plate_minecraft_overworld_p0_p0_p0_delivery': (8, json.dumps({'phase': 'delivered', 'saved': plate})),
              kg + 'storage_v1/minecraft:overworld/2/0/0': (8, json.dumps({'v': 1, 'key': kg + 'storage_v1/minecraft:overworld/2/0/0', 'block': kg + 'grill', 'entity': 'Private_Entity_9', 'token': 'Private_Token'})),
              'senluo:grilling_item_' + token: (8, json.dumps(meta))}
        rack_item = self.stack(kg + 'advanced_rack', 1, {'tag': (10, {'DynamicProperties': (10, {self.OWNER: (10, {kg + 'rack_payload': (8, rack)})})})})
        plate_item = self.stack(kg + 'skewer_plate', 2, {'tag': (10, {'display': (10, {'Lore': (9, (8, [lore]))})})})
        player = self.root({'Inventory': (9, (10, [rack_item, plate_item]))})
        result = self.census([(b'DynamicProperties', self.properties({self.OWNER: dp})), (b'~local_player', player)])
        self.assertTrue(result['complete'], result['errors'])
        self.assertEqual(self.counts(result), {(kg + 'advanced_rack', 'player_inventory'): (1, 1), (kg + 'skewer_plate', 'player_inventory'): (2, 1)})
        self.assertEqual(self.counts(result, 'serialized_items'), {
            (self.FOOD, 'carried_serialized/rack_payload'): (5, 1),
            (self.SECRET, 'carried_serialized/plate_skewers'): (2, 1),
            (self.SECRET, 'world_plate_serialized'): (1, 1),
            (kg + 'skewer_recipe_book', 'world_recipe_serialized'): (1, 1)})
        self.assertEqual(sum(row['quantity'] for row in result['serialized_items']), 9)
        self.assertTrue(any(row['location_type'] == 'recovery_reference' for row in result['references']))
        self.assertTrue(any(row['location_type'] == 'immutable_item_metadata_reference' for row in result['references']))
        public = json.dumps(result)
        for private in ('Private_Player_7', 'Private_Entity_9', 'Private_Token', token, self.OWNER):
            self.assertNotIn(private, public)
        self.assertEqual(result['station_unavailable_keys'], 3)

        # Historical locator arrays are references, not new station contents.
        registry_keys = [kg + 'a2_grills', kg + 'a23_oil_sources']
        for grill_rows, oil_rows, expected_ids in (
            ([], [], set()),
            ([{'k': 'minecraft:overworld|1|2|3', 'd': 'minecraft:overworld', 'x': 1, 'y': 2, 'z': 3}],
             [{'d': 'minecraft:overworld', 'x': 1, 'y': 2, 'z': 3, 'type': 'canola'}],
             {kg + 'grill', kg + 'canola_oil'}),
        ):
            legacy = self.census([(b'DynamicProperties', self.properties({self.OWNER: {
                registry_keys[0]: (8, json.dumps(grill_rows)), registry_keys[1]: (8, json.dumps(oil_rows))}}))])
            self.assertTrue(legacy['complete'], legacy['errors'])
            self.assertEqual(legacy['station_keys'], {})
            self.assertEqual(legacy['serialized_items'], [])
            self.assertEqual({(row['id'], row['location_type'], row['occurrences']) for row in legacy['references']},
                             {(ident, 'legacy_registry_reference', 1) for ident in expected_ids})
        malformed_registries = [
            (registry_keys[0], {}, 'LEGACY_GRILL_REGISTRY_SCHEMA'),
            (registry_keys[0], [{'d': 'minecraft:overworld', 'x': 1, 'y': 2, 'z': 3}], 'LEGACY_GRILL_REGISTRY_SCHEMA'),
            (registry_keys[1], {}, 'LEGACY_OIL_REGISTRY_SCHEMA'),
            (registry_keys[1], [{'d': 'minecraft:overworld', 'x': 1, 'y': 2, 'z': 3, 'type': 'private_invalid_oil'}], 'LEGACY_OIL_REGISTRY_SCHEMA'),
        ]
        for key, payload, code in malformed_registries:
            malformed = self.census([(b'DynamicProperties', self.properties({self.OWNER: {key: (8, json.dumps(payload))}}))])
            self.assert_error(malformed, code)
            self.assertNotIn('private_invalid_oil', json.dumps(malformed))

    def test_scheduled_ticks_are_references_not_placed_blocks_or_inventory(self):
        kg = self.KG
        def entry(lit=1, **overrides):
            value = {'blockState': (10, {'name': (8, kg + 'grill'), 'states': (10, {kg + 'lit': (1, lit)}),
                                        'version': (3, 18168865)}),
                     'time': (4, 987654321), 'x': (3, -31337), 'y': (3, -64), 'z': (3, 20193)}
            value.update(overrides)
            return value
        def record(entries, child_type=10):
            return (self.chunk_key(x=-1959, z=1262, tag=0x33),
                    self.root({'currentTick': (3, 123456), 'tickList': (9, (child_type, entries))}))
        rows = [entry(0), entry(1), entry(1)]
        result = self.census([record(rows)])
        self.assertTrue(result['complete'], result['errors'])
        self.assertEqual(result['items'], [])
        self.assertEqual(result['blocks'], [])
        self.assertEqual(result['block_states'], [])
        self.assertEqual(result['palette_entries'], [])
        self.assertEqual(result['references'], [{'id': kg + 'grill', 'location_type': 'scheduled_tick', 'occurrences': 3}])
        states = {row['states'][kg + 'lit']: row for row in result['scheduled_tick_states']}
        self.assertEqual({value: row['occurrences'] for value, row in states.items()}, {0: 1, 1: 2})
        self.assertEqual(states[1]['state_types'], {kg + 'lit': 'byte'})
        self.assertNotIn('-31337', json.dumps(result))
        empty = self.census([record([], child_type=0)])
        self.assertTrue(empty['complete'], empty['errors'])
        self.assertEqual(empty['references'], [])
        malformed = [
            (record([entry(time=(3, 123))]), 'TICKS_TIME_TYPE'),
            (record([entry(x=(6, -31337.0))]), 'TICKS_COORD_TYPE'),
            (record([entry(blockState=(10, {'name': (8, kg + 'grill'), 'states': (8, 'private_invalid_state'), 'version': (3, 18168865)}))]), 'TICKS_BLOCK_STATES_TYPE'),
            (record([self.FOOD], child_type=8), 'TICKS_LIST_TYPE'),
            (record([entry(blockState=(10, {'name': (8, kg + 'grill'), 'states': (10, {kg + 'lit': (6, 1.0)}), 'version': (3, 18168865)}))]), 'TICKS_BLOCK_STATE_VALUE_TYPE'),
        ]
        for item, code in malformed:
            with self.subTest(code=code):
                result = self.census([item])
                self.assert_error(result, code)
                self.assertNotIn('private_invalid_state', json.dumps(result))

    def test_unknown_target_data_and_ambiguous_or_corrupt_metadata_fail_closed(self):
        kg = self.KG
        hidden = kg + 'PRIVATE_SECRET_ITEM_947'
        result = self.census([(b'~local_player', self.root({'Inventory': (9, (10, [self.stack(hidden)]))}))])
        self.assert_error(result, 'UNKNOWN_TARGET_IDENTIFIER')
        self.assertNotIn(hidden, json.dumps(result))
        arbitrary = self.census([(b'custom_unhandled_player_secret', self.root({'Items': (9, (10, [self.stack()]))}))])
        self.assert_error(arbitrary, 'UNCLASSIFIED_TARGET_NBT_SCHEMA')
        self.assertEqual(arbitrary['items'], [])
        self.assertEqual(arbitrary['serialized_items'], [])
        self.assertNotIn('custom_unhandled_player_secret', json.dumps(arbitrary))
        unknown_dp = self.census([(b'DynamicProperties', self.properties({self.OWNER: {kg + 'new_persisted_secret': (8, 'PRIVATE_VALUE')}}))])
        self.assert_error(unknown_dp, 'UNRECOGNIZED_WORLD_PROPERTY')
        self.assertNotIn('PRIVATE_VALUE', json.dumps(unknown_dp))
        token = '0123456789abcdef'
        lore = '§r§0§r§1§r§2' + ''.join('§' + char for char in token) + '§r'
        player = self.root({'Inventory': (9, (10, [self.stack(extra={'tag': (10, {'display': (10, {'Lore': (9, (8, [lore]))})})})]))})
        self.assert_error(self.census([(b'~local_player', player)]), 'ITEM_METADATA_MISSING')
        metadata_key = 'senluo:grilling_item_' + token
        scopes = {self.OWNER: {metadata_key: (8, '{}')}, self.OWNER2: {metadata_key: (8, json.dumps({kg + 'recipe_record': json.dumps({'id': self.FOOD})}))}}
        self.assert_error(self.census([(b'DynamicProperties', self.properties(scopes)), (b'~local_player', player)]), 'ITEM_METADATA_OWNER_AMBIGUOUS')
        rack = json.dumps({'version': 999, 'items': [None] * 9})
        invalid = self.stack(kg + 'advanced_rack', extra={'tag': (10, {'DynamicProperties': (10, {self.OWNER: (10, {kg + 'rack_payload': (8, rack)})})})})
        self.assert_error(self.census([(b'~local_player', self.root({'Inventory': (9, (10, [invalid]))}))]), 'RACK_PAYLOAD_SCHEMA')
        # Valid NBT syntax with an unsupported item/inventory schema must not
        # turn a damaged or future inventory representation into a silent zero.
        missing_count = self.root({'Inventory': (9, (10, [{'Name': (8, self.FOOD)}]))})
        self.assert_error(self.census([(b'~local_player', missing_count)]), 'INVENTORY_SCHEMA')
        # A stack's ordinary metadata child must not inherit the slot contract.
        descriptive_name = self.stack(extra={'tag': (10, {'Name': (8, self.SECRET)})})
        metadata_ok = self.census([(b'~local_player', self.root({'Inventory': (9, (10, [descriptive_name]))}))])
        self.assertTrue(metadata_ok['complete'], metadata_ok['errors'])
        self.assertEqual(self.counts(metadata_ok), {(self.FOOD, 'player_inventory'): (1, 1)})
        wrong_tag = self.stack(extra={'tag': (8, kg + 'rack_payload')})
        self.assert_error(self.census([(b'~local_player', self.root({'Inventory': (9, (10, [wrong_tag]))}))]), 'ITEM_TAG_SCHEMA')
        for unsupported in ((8, self.FOOD), (9, (8, [self.FOOD]))):
            result = self.census([(b'~local_player', self.root({'Inventory': unsupported}))])
            self.assert_error(result, 'INVENTORY_SCHEMA')
        wrong_drop = [(self.actor_key(77), self.actor('minecraft:item', 77, Item=(8, self.FOOD)))]
        result = self.census(wrong_drop)
        self.assert_error(result, 'INVENTORY_SCHEMA')
        malformed_carriers = [
            (self.chunk_key(tag=0x31), self.root({'Items': (8, self.FOOD)})),
            (self.actor_key(78), self.actor('minecraft:zombie', 78, Mainhand=(9, (8, [self.FOOD])))),
            (self.actor_key(79), self.actor('minecraft:chest_boat', 79, ChestItems=(8, self.FOOD))),
            (b'~local_player', self.root({'Inventory': (9, (10, [self.stack('minecraft:shulker_box', extra={'tag': (10, {'Items': (8, self.FOOD)})})]))})),
        ]
        for record in malformed_carriers:
            self.assert_error(self.census([record]), 'INVENTORY_SCHEMA')
        # TAG_End empty lists are valid, and an unrelated nested metadata field
        # called Items is not automatically an inventory carrier.
        ordinary = self.census([(b'~local_player', self.root({
            'Inventory': (9, (0, [])), 'Offhand': (10, self.stack(amount=1)),
            'Settings': (10, {'Items': (8, 'ordinary opaque metadata')})}))])
        self.assertTrue(ordinary['complete'], ordinary['errors'])
        self.assertEqual(self.counts(ordinary), {(self.FOOD, 'player_offhand'): (1, 1)})
        duplicate = [(self.actor_key(1), self.actor(kg + 'inventory_grill_v1', 1)),
                     (self.chunk_key(tag=0x32), self.actor(kg + 'inventory_grill_v1', 1))]
        self.assert_error(self.census(duplicate), 'DUPLICATE_ENTITY_IDENTITY')
        # A saved blueprint may contain only vanilla IDs and a lore token.
        # Resolving that token proves owned data without a raw KG byte string.
        # Unknown record schemas must not contribute active inventory counts.
        opaque_token = 'abcdef0123456789'
        opaque_lore = '§r§0§r§1§r§2' + ''.join('§' + char for char in opaque_token) + '§r'
        opaque_paper = self.stack('minecraft:paper', extra={'tag': (10, {'display': (10, {'Lore': (9, (8, [opaque_lore]))})})})
        opaque_nbt = self.root({'Inventory': (9, (10, [opaque_paper]))})
        self.assertNotIn(kg.encode(), opaque_nbt)
        rack_json = json.dumps({'version': 1, 'items': [{'typeId': self.FOOD, 'amount': 3, 'dynamic': {}, 'rawLore': []}] + [None] * 8, 'filters': []})
        for props in ({kg + 'plate_skewers': json.dumps([{'id': self.FOOD}])}, {kg + 'rack_payload': rack_json}):
            source = (b'DynamicProperties', self.properties({self.OWNER: {'senluo:grilling_item_' + opaque_token: (8, json.dumps(props))}}))
            result = self.census([source, (b'structuretemplate_test', opaque_nbt)])
            self.assert_error(result, 'UNCLASSIFIED_TARGET_NBT_SCHEMA')
            self.assertEqual(result['items'], [])
            self.assertEqual(result['serialized_items'], [])
            self.assertEqual(result['blocks'], [])
            self.assertTrue(result['references'])
            self.assertTrue(all(row['location_type'] == 'immutable_item_metadata_reference' for row in result['references']))
        # Defer duplicate identity decisions until every counterpart has been
        # walked. Neither record order nor a vanilla carrier may hide KG data.
        def animal(fields):
            return self.actor('minecraft:cow', 555, **fields)
        def group(rows, prefix_records=()):
            return list(prefix_records) + [(self.actor_key(100 + index), animal(fields)) for index, fields in enumerate(rows)]
        unrelated = {'Inventory': (9, (10, [self.stack('minecraft:wheat', amount=2)]))}
        # An unrelated global metadata table must not taint an otherwise clean
        # identity group. Conversely a matching lore token binds its contents.
        token = 'fedcba9876543210'
        lore = '§r§0§r§1§r§2' + ''.join('§' + char for char in token) + '§r'
        table_key = 'senluo:grilling_item_' + token
        table = (b'DynamicProperties', self.properties({self.OWNER: {table_key: (8, json.dumps({
            kg + 'plate_skewers': json.dumps([{'id': self.FOOD, 'native': {'version': 1, 'id': self.FOOD, 'props': {}}}])}))}}))
        clean_group = self.census(group([unrelated, unrelated], [table]))
        self.assertTrue(clean_group['complete'], clean_group['errors'])
        self.assertEqual(clean_group['items'], [])
        self.assertEqual(clean_group['serialized_items'], [])
        warnings = {row['code']: row['records'] for row in clean_group['warnings']}
        self.assertEqual(warnings['DUPLICATE_NON_TARGET_ENTITY_IDENTITY'], 1)
        self.assertEqual(clean_group['actor_identity'], {'unique_identities': 1, 'duplicate_groups': 1,
                         'duplicate_records': 1, 'target_ambiguous_groups': 0, 'unrelated_duplicate_groups': 1})
        owned_inventory = {'Inventory': (9, (10, [self.stack(amount=2)]))}
        for rows in ([owned_inventory, unrelated], [unrelated, owned_inventory], [unrelated, owned_inventory, unrelated]):
            result = self.census(group(rows))
            self.assert_error(result, 'DUPLICATE_ENTITY_IDENTITY')
            self.assertEqual(self.counts(result), {(self.FOOD, 'entity_inventory'): (2, 1)})
            self.assertEqual(result['actor_identity']['duplicate_records'], len(rows) - 1)
            self.assertEqual(result['actor_identity']['target_ambiguous_groups'], 1)
        vanilla_carrier = {'Inventory': (9, (10, [self.stack('minecraft:paper', extra={
            'tag': (10, {'display': (10, {'Lore': (9, (8, [lore]))})})})]))}
        for rows in ([vanilla_carrier, unrelated], [unrelated, vanilla_carrier]):
            result = self.census(group(rows, [table]))
            self.assert_error(result, 'DUPLICATE_ENTITY_IDENTITY')
            self.assertEqual(result['items'], [])
            self.assertEqual(self.counts(result, 'serialized_items'), {(self.FOOD, 'carried_serialized/plate_skewers'): (1, 1)})
        reference_table = (b'DynamicProperties', self.properties({self.OWNER: {table_key: (8, json.dumps({
            kg + 'recipe_record': json.dumps({'id': self.FOOD})}))}}))
        result = self.census(group([unrelated, vanilla_carrier], [reference_table]))
        self.assert_error(result, 'DUPLICATE_ENTITY_IDENTITY')
        self.assertEqual(result['items'], [])
        self.assertEqual(result['serialized_items'], [])
        self.assertTrue(any(row['location_type'] == 'item_property_reference' for row in result['references']))
        for rows in ([unrelated, {'Inventory': (8, 'malformed opaque inventory')}],
                     [vanilla_carrier, unrelated]):
            result = self.census(group(rows))
            self.assertFalse(result['complete'], result)
            self.assert_error(result, 'DUPLICATE_ENTITY_IDENTITY')

    @staticmethod
    def fingerprint(db):
        return {path.relative_to(db).as_posix(): (hashlib.sha256(path.read_bytes()).hexdigest(), path.stat().st_size,
                path.stat().st_mode, path.stat().st_uid, path.stat().st_gid, path.stat().st_mtime_ns)
                for path in sorted(db.rglob('*')) if path.is_file()}

    def wrapper_fixture(self, root, records):
        world = root / 'offline-world'
        world.mkdir()
        (world / 'level.dat').write_bytes(b'Synthetic offline test; never a live world')
        db = world / 'db'
        self.assertTrue(self.run_node({'action': 'create_db', 'db': str(db),
                         'records': [[self.b64(key), self.b64(value)] for key, value in records]})['ok'])
        before = self.fingerprint(db)
        manifest = root / 'source.json'
        manifest.write_text(json.dumps({'fixture/db/' + name: {'sha256': row[0], 'bytes': row[1]} for name, row in before.items()}))
        lock = root / 'lock.json'
        options = self.options()
        lock.write_text(json.dumps({'persisted_key_literals': options['persistedKeys'], 'items': options['knownItems'],
                                    'entities': options['knownEntities'], 'blocks': options['knownBlocks']}))
        scratch = root / 'temporary-clones'
        scratch.mkdir()
        return world, db, before, manifest, lock, scratch

    def run_wrapper(self, world, manifest, lock, scratch):
        import subprocess
        run = subprocess.run([sys.executable, str(self.ops / 'world_ids.py'), '--world-copy', str(world),
                             '--source-manifest', str(manifest), '--manifest-db-prefix', 'fixture/db/',
                             '--snapshot-archive-sha256', '0' * 64, '--key-lock', str(lock),
                             '--scratch-root', str(scratch)], text=True, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, timeout=45)
        try:
            return run.returncode, json.loads(run.stdout)
        except ValueError as exc:
            raise AssertionError('Wrapper did not return JSON: ' + run.stdout[-1000:] + run.stderr[-1000:]) from exc

    def test_native_db_wrapper_success_preserves_input_and_cleans_clone(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            setup = self.wrapper_fixture(root, [(b'~local_player', self.root({'Inventory': (9, (10, [self.stack(amount=17)]))})),
                                                (b'DynamicProperties', self.properties({self.OWNER: {}}))])
            world, db, before, manifest, lock, scratch = setup
            status, result = self.run_wrapper(world, manifest, lock, scratch)
            self.assertEqual(status, 0, result)
            self.assertTrue(result['complete'], result)
            self.assertEqual(self.counts(result), {(self.FOOD, 'player_inventory'): (17, 1)})
            self.assertTrue(result['input_unchanged'])
            self.assertEqual(self.fingerprint(db), before)
            self.assertEqual(list(scratch.iterdir()), [])
            self.assertFalse(result['storage']['input_database_opened_by_engine'])
            self.assertTrue(result['storage']['verified_temporary_clone'])
            self.assertFalse(result['storage']['repair_requested'])
            for private in (str(world), str(db), str(scratch), self.OWNER):
                self.assertNotIn(private, json.dumps(result))

    def test_native_db_parse_failure_still_preserves_input_and_cleans_clone(self):
        with tempfile.TemporaryDirectory() as temp:
            setup = self.wrapper_fixture(Path(temp), [(b'~local_player', self.root({'Inventory': (9, (10, [self.stack(amount=17)]))})[:-1]),
                                                      (b'DynamicProperties', self.properties({self.OWNER: {}}))])
            world, db, before, manifest, lock, scratch = setup
            status, result = self.run_wrapper(world, manifest, lock, scratch)
            self.assertNotEqual(status, 0, result)
            self.assert_error(result, 'NBT_TRUNCATED')
            self.assertTrue(result['input_unchanged'])
            self.assertEqual(self.fingerprint(db), before)
            self.assertEqual(list(scratch.iterdir()), [])
            self.assertFalse(result['storage']['input_database_opened_by_engine'])

    def test_manifest_damage_and_db_symlink_are_rejected_without_changes(self):
        with tempfile.TemporaryDirectory() as temp:
            setup = self.wrapper_fixture(Path(temp), [(b'~local_player', self.root({'Inventory': (9, (10, [self.stack(amount=1)]))}))])
            world, db, before, manifest, lock, scratch = setup
            proof = json.loads(manifest.read_text())
            proof['fixture/db/CURRENT']['sha256'] = 'f' * 64
            manifest.write_text(json.dumps(proof))
            status, result = self.run_wrapper(world, manifest, lock, scratch)
            self.assertNotEqual(status, 0)
            self.assertFalse(result['complete'])
            self.assertIn('DB_CONTENT_DIFFERS_FROM_STOPPED_BACKUP_MANIFEST', result['error'])
            self.assertEqual(self.fingerprint(db), before)
            self.assertEqual(list(scratch.iterdir()), [])
            # A linked DB can point back into LIVE even from an offline-looking folder.
            replacement = Path(temp) / 'real-synthetic-db'
            db.rename(replacement)
            db.symlink_to(replacement, target_is_directory=True)
            import subprocess
            run = subprocess.run([sys.executable, str(self.ops / 'world_ids.py'), '--world-copy', str(world),
                                  '--source-manifest', str(manifest), '--manifest-db-prefix', 'fixture/db/',
                                  '--snapshot-archive-sha256', '0' * 64, '--key-lock', str(lock),
                                  '--scratch-root', str(scratch)], text=True, capture_output=True, timeout=30)
            self.assertNotEqual(run.returncode, 0)
            self.assertIn('db must be a real directory', run.stderr)
            self.assertEqual(self.fingerprint(replacement), before)
            self.assertEqual(list(scratch.iterdir()), [])


def persistence_fixture_pair():
    """Deliberately synthetic values, unrelated to any player or saved world."""
    before = {"schema": 1, "evidence_kind": "synthetic_fixture",
              "world_ref": str(uuid4()), "run_ref": str(uuid4()),
              "capture_ref": str(uuid4()), "phase": "before",
              "captured_at": "2026-01-01T00:00:00Z", "pack_set_sha256": "0" * 64,
              "checks": {"joined": True, "normal_gameplay": True, "normal_restart_completed": False},
              "samples": []}
    for kind in sorted(spot.KINDS):
        before["samples"].append({"sample_id": kind + "-01", "kind": kind,
                                  "locator_ref": str(uuid4()), "evidence_ref": str(uuid4()),
                                  "state": {"synthetic_level": 2, "nested": {"a": [1, False]}},
                                  "items": [{"slot": 0, "type_id": "fixture:example", "amount": 3,
                                             "lore": ["synthetic lore", "§rformatting"],
                                             "properties": {"fixture:contents": ["a", "b"]}, "name": ""}]})
    after = deepcopy(before)
    after.update(phase="after", captured_at="2026-01-01T00:05:00Z", capture_ref=str(uuid4()))
    after["checks"]["normal_restart_completed"] = True
    for row in after["samples"]:
        row["evidence_ref"] = str(uuid4())
    return before, after


class PersistenceSpotcheck(unittest.TestCase):
    def test_before_evidence_cannot_be_borrowed_by_a_different_after_sample(self):
        before, fresh = persistence_fixture_pair()
        refs = [row["evidence_ref"] for row in before["samples"]]
        for shift in range(1, len(refs)):
            after = deepcopy(fresh)
            for index, row in enumerate(after["samples"]):
                row["evidence_ref"] = refs[(index + shift) % len(refs)]
            with self.subTest(rotation=shift), self.assertRaisesRegex(spot.InputError, "CAPTURE_EVIDENCE_REUSED"):
                spot.compare(before, after)
        after = deepcopy(fresh)
        after["samples"][0]["evidence_ref"] = refs[1]
        with self.assertRaisesRegex(spot.InputError, "CAPTURE_EVIDENCE_REUSED"):
            spot.compare(before, after)
        with tempfile.TemporaryDirectory() as temp:
            paths = [Path(temp) / name for name in ("before.json", "after.json")]
            for path, doc in zip(paths, (before, after)):
                path.write_text(json.dumps(doc), encoding="utf-8")
            run = subprocess.run([sys.executable, str(Path(spot.__file__)), *map(str, paths)],
                                 capture_output=True, text=True, check=False)
            self.assertEqual(run.returncode, 2)
            self.assertEqual(json.loads(run.stdout)["result"], "invalid_or_incomplete_input")
            self.assertEqual(run.stderr, "")
            for ref in refs:
                self.assertNotIn(ref, run.stdout)

    def test_independent_captures_can_each_share_one_photo_between_samples(self):
        before, after = persistence_fixture_pair()
        for shared in (False, True):
            if shared:
                for doc in (before, after):
                    ref = doc["samples"][0]["evidence_ref"]
                    for row in doc["samples"]:
                        row["evidence_ref"] = ref
            with self.subTest(shared_within_capture=shared):
                self.assertEqual(spot.compare(before, after)["result"], "equal_supplied_observations")
                with tempfile.TemporaryDirectory() as temp:
                    paths = [Path(temp) / name for name in ("before.json", "after.json")]
                    for path, doc in zip(paths, (before, after)):
                        path.write_text(json.dumps(doc), encoding="utf-8")
                    run = subprocess.run([sys.executable, str(Path(spot.__file__)), *map(str, paths)],
                                         capture_output=True, text=True, check=False)
                    self.assertEqual(run.returncode, 0)
                    self.assertEqual(json.loads(run.stdout)["result"], "equal_supplied_observations")
                    self.assertEqual(run.stderr, "")
                    for doc in (before, after):
                        for row in doc["samples"]:
                            self.assertNotIn(row["evidence_ref"], run.stdout)

    def test_equal_samples_are_only_equal_supplied_observations(self):
        a, b = persistence_fixture_pair()
        b["samples"].reverse()
        result = spot.compare(a, b)
        self.assertEqual(result["result"], "equal_supplied_observations")
        self.assertEqual(result["sample_count"], 6)
        self.assertEqual(result["evidence_kind"], "synthetic_fixture")
        self.assertEqual(result["staging_acceptance"], "not_established")
        self.assertFalse(result["client"] or result["production_ready"])

    def test_every_station_reports_lost_state(self):
        for kind in spot.KINDS:
            with self.subTest(kind=kind):
                a, b = persistence_fixture_pair()
                row = next(s for s in b["samples"] if s["kind"] == kind)
                row["state"]["nested"]["a"][1] = 0  # Distinguish bool from int.
                result = spot.compare(a, b)
                changed = [r for r in result["samples"] if not r["equal"]]
                self.assertEqual(changed, [{"sample_id": kind + "-01", "equal": False,
                                           "differences": [{"field": "state"}]}])

    def test_item_loss_slot_move_quantity_lore_properties_and_name(self):
        changes = {"type_id": "fixture:different", "amount": 2, "lore": ["changed"],
                   "properties": {"fixture:contents": ["b", "a"]}, "name": "private-name"}
        for field, value in changes.items():
            with self.subTest(field=field):
                a, b = persistence_fixture_pair()
                b["samples"][0]["items"][0][field] = value
                changed = spot.compare(a, b)["samples"][0]
                self.assertEqual(changed["differences"], [{"field": field, "slot": 0}])
        a, b = persistence_fixture_pair()
        b["samples"][0]["items"][0]["slot"] = 1
        self.assertEqual(spot.compare(a, b)["samples"][0]["differences"],
                         [{"field": "item_presence", "slot": 0}, {"field": "item_presence", "slot": 1}])
        b["samples"][0]["items"] = []
        self.assertEqual(spot.compare(a, b)["samples"][0]["differences"],
                         [{"field": "item_presence", "slot": 0}])

    def test_incomplete_or_unrelated_pairs_cannot_succeed(self):
        edits = [lambda d: d.update(world_ref=str(uuid4())),
                 lambda d: d.update(run_ref=str(uuid4())),
                 lambda d: d.update(pack_set_sha256="1" * 64),
                 lambda d: d.update(evidence_kind="manual_staging"),
                 lambda d: d.update(captured_at="2025-12-31T23:00:00Z"),
                 lambda d: d["checks"].update(joined=False),
                 lambda d: d["checks"].update(normal_gameplay=False),
                 lambda d: d["checks"].update(normal_restart_completed=False),
                 lambda d: d["samples"].pop(),
                 lambda d: d["samples"][0].update(state={}),
                 lambda d: d["samples"][0].update(locator_ref=str(uuid4())),
                 lambda d: d["samples"][0]["items"][0].pop("lore"),
                 lambda d: d["samples"][0]["items"][0].update(amount=True),
                 lambda d: d["samples"].append(deepcopy(d["samples"][0]))]
        for index, edit in enumerate(edits):
            with self.subTest(edit=index):
                a, b = persistence_fixture_pair()
                edit(b)
                with self.assertRaises(spot.InputError):
                    spot.compare(a, b)
        a, b = persistence_fixture_pair()
        b["capture_ref"] = a["capture_ref"]
        with self.assertRaises(spot.InputError):
            spot.compare(a, b)
        b["capture_ref"] = str(uuid4())
        b["samples"][0]["evidence_ref"] = a["samples"][0]["evidence_ref"]
        with self.assertRaises(spot.InputError):
            spot.compare(a, b)

    def test_cli_exit_codes_privacy_and_inputs_unchanged(self):
        with tempfile.TemporaryDirectory() as temp:
            paths = [Path(temp) / name for name in ("before.json", "after.json")]
            command = [sys.executable, str(Path(spot.__file__)), *map(str, paths)]
            a, b = persistence_fixture_pair()
            sentinel = "SYNTHETIC-PRIVATE-SENTINEL"
            for d in (a, b):
                d["samples"][0]["state"] = {sentinel: sentinel}
                d["samples"][0]["items"][0]["lore"] = [sentinel]
            for expected in (0, 1, 2):
                if expected == 1:
                    b["samples"][0]["items"][0]["lore"].append("changed")
                for path, doc in zip(paths, (a, b)):
                    path.write_text(json.dumps(doc), encoding="utf-8")
                if expected == 2:
                    paths[1].write_text('{"secret": "' + sentinel, encoding="utf-8")
                hashes = [hashlib.sha256(p.read_bytes()).digest() for p in paths]
                run = subprocess.run(command, capture_output=True, text=True, check=False)
                self.assertEqual(run.returncode, expected, run.stdout + run.stderr)
                self.assertNotIn(sentinel, run.stdout + run.stderr)
                self.assertNotIn(str(paths[0]), run.stdout + run.stderr)
                self.assertEqual(run.stderr, "")
                self.assertEqual(hashes, [hashlib.sha256(p.read_bytes()).digest() for p in paths])
                json.loads(run.stdout)

    def test_bad_json_duplicate_keys_nonfinite_and_size_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "input.json"
            for text in ('{"a":1,"a":2}', '{"a":NaN}', '{"a":1e999}', ' ' * (spot.MAX_BYTES + 1)):
                path.write_text(text, encoding="utf-8")
                with self.assertRaises(ValueError):
                    spot.read_sample(path)



if __name__ == "__main__":
    unittest.main()
