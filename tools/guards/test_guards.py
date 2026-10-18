"""The two guards must fail on the exact damage they exist to stop."""
import json
import sys
import unittest
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
                       "lost values 7", "header UUID changed"):
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
        with mock.patch.object(sc, "load_retirements", return_value=complete), \
                mock.patch.object(sc, "script_text", return_value="no mention"):
            errors, _ = sc.check(self.lock, now)
        self.assertTrue(any("no script still mentions it" in e for e in errors), errors)


if __name__ == "__main__":
    unittest.main()
