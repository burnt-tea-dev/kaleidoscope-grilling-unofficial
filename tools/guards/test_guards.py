"""The two guards must fail on the exact damage they exist to stop."""
import json
import sys
import unittest
import tempfile
import importlib.util
import hashlib
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import save_compat as sc  # noqa: E402


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



if __name__ == "__main__":
    unittest.main()
