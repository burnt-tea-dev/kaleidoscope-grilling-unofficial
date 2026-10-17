"""Conserve public repaired completion ownership without changing eating mechanics.

The immutable PR134 source already contains the completion repair. These gates
prove current source-byte conservation and explicit scope; they do not recreate
or claim the unavailable earlier private-before comparison.
"""
from pathlib import Path
import json
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = 'projects/grilling/gameplay_core/'
sys.path.insert(0, str(ROOT / 'tools'))
from public_source_witness import assert_public_bytes_with_g71_bottles as assert_public_bytes, public_json, reviewed_held_bytes
from secret_terminal_visibility import apply as apply_terminal_visibility
from eating_owner_context import document
from eating_owner_properties import predecessor_document
from skewer_content_source import historical_bytes


class SecretCompletionScope(unittest.TestCase):
    def test_repaired_visual_sync_files_and_owned_attachables_match_public_source(self):
        for name in ('main.js', 'secret_held_runtime.js'):
            assert_public_bytes(self, ROOT / RUNTIME / 'behavior_pack/scripts' / name)
        for name in ('secret_skewer', 'secret_skewer_java_three_alt'):
            path = ROOT / RUNTIME / 'resource_pack/attachables' / (name + '.attachable.json')
            assert_public_bytes(self, path)
            source, actual = public_json(path), predecessor_document(json.loads(historical_bytes(path)))
            description = source['minecraft:attachable']['description']
            rows = description['scripts']['pre_animation']
            reviewed_rows = json.loads(reviewed_held_bytes(path))['minecraft:attachable']['description']['scripts']['pre_animation']
            owner_rows = [row for row in reviewed_rows if row.startswith('v.kg_secret_owner_occupied = ')]
            self.assertEqual(len(owner_rows), 1)
            description['scripts']['pre_animation'] = [owner_rows[0] if row.startswith('v.kg_secret_owner_occupied = ') else row for row in rows]
            apply_terminal_visibility(description)
            self.assertEqual(actual, document(source,attachable=True))

    def test_native_debit_reward_checkpoint_cleanup_and_repaired_calls_are_conserved(self):
        path = ROOT / RUNTIME / 'behavior_pack/scripts/main.js'
        assert_public_bytes(self, path)
        from build_failure_skewer_held import restore_main as failure_predecessor
        current = failure_predecessor(historical_bytes(path).decode())
        begin = "  try{syncSecretHeld(e.source,{beginHand:hand})}catch(error){console.warn('[Grilling held ingredients] '+error)}"
        complete = "if(id===SECRET_ID)try{syncSecretHeld(e.source,{completedUse:a.use})}catch(error){console.warn('[Grilling held completion] '+error)}"
        self.assertEqual(current.count(begin), 1)
        self.assertEqual(current.count(complete), 1)
        requested = next(row for row in current.splitlines() if row.startswith('  const requested=PROFILE_BY_ITEM[id]'))
        self.assertIn(requested + '\n' + begin, current)
        self.assertNotIn("if(id===SECRET_ID)try{syncSecretHeld(e.source)}catch(error){console.warn('[Grilling held completion] '+error)}", current)
        # Byte conservation covers native debit, reward, checkpoint and cleanup,
        # while test_secret_held_runtime independently exercises their behavior.
        assert_public_bytes(self, ROOT / RUNTIME / 'behavior_pack/scripts/secret_held_runtime.js')


if __name__ == '__main__':
    unittest.main()
