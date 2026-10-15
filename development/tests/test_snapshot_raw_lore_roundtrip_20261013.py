"""Run the focused RawMessage snapshot regression against canonical JS modules."""
from pathlib import Path
import shutil
import subprocess
import unittest


class SnapshotRawLoreRoundtripTests(unittest.TestCase):
    def test_raw_message_roundtrip_and_corruption_guards(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "Node.js with node:test is required for this regression")
        root = Path(__file__).resolve().parents[2]
        suite = root / "development/tests/runtime/snapshot_raw_lore.test.mjs"
        result = subprocess.run(
            [node, "--test", "--test-reporter=tap", str(suite)],
            cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            encoding="utf-8", errors="replace", timeout=30, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertRegex(result.stdout, r"(?m)^# pass [1-9][0-9]*$", result.stdout)
        self.assertIn("# fail 0", result.stdout)
        self.assertIn("# skipped 0", result.stdout)


if __name__ == "__main__":
    unittest.main()
