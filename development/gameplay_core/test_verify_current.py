"""Fail-closed source receipt and export checks; no game/client simulation."""
from contextlib import redirect_stdout, redirect_stderr
import io
import json
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import verify_current as gate
import verification_session as session


class CurrentSessionTests(unittest.TestCase):
    def test_success_reuse_requires_same_command_cwd_env_and_ends_with_session(self):
        command = [sys.executable, "source_check.py"]
        passed = subprocess.CompletedProcess(command, 0)
        with patch.object(session.subprocess, "run", return_value=passed) as run:
            with session.current_source_validation_session():
                session.run_checked_once(command, cwd=gate.ROOT, env={"CHECK_INPUT": "one"})
                session.run_checked_once(command, cwd=gate.ROOT, env={"CHECK_INPUT": "one"})
                self.assertEqual(run.call_count, 1)
                session.run_checked_once(command + ["--different"], cwd=gate.ROOT, env={"CHECK_INPUT": "one"})
                session.run_checked_once(command, cwd=gate.DEV, env={"CHECK_INPUT": "one"})
                session.run_checked_once(command, cwd=gate.ROOT, env={"CHECK_INPUT": "two"})
                self.assertEqual(run.call_count, 4)
            session.run_checked_once(command, cwd=gate.ROOT, env={"CHECK_INPUT": "one"})
            self.assertEqual(run.call_count, 5)

    def test_failed_check_is_not_reused(self):
        command = [sys.executable, "source_check.py"]
        failed = subprocess.CalledProcessError(1, command)
        passed = subprocess.CompletedProcess(command, 0)
        with patch.object(session.subprocess, "run", side_effect=[failed, passed]) as run:
            with session.current_source_validation_session():
                with self.assertRaises(subprocess.CalledProcessError):
                    session.run_checked_once(command)
                session.run_checked_once(command)
                session.run_checked_once(command)
                self.assertEqual(run.call_count, 2)


class WorkflowCoverageTests(unittest.TestCase):
    def test_family_candidate_changes_always_trigger_functional_workflow(self):
        workflows = gate.ROOT / ".github/workflows"
        family = (workflows / "family-candidate.yml").read_text(encoding="utf-8")
        canonical = (workflows / "gameplay-core.yml").read_text(encoding="utf-8")
        family_paths = set(re.findall(r"'([^']+)'", family.split("paths:", 1)[1].split("\n", 1)[0]))
        pr_block = canonical.split("  pull_request:\n", 1)[1].split("  workflow_dispatch:", 1)[0]
        canonical_paths = set(re.findall(r"- '([^']+)'", pr_block))
        self.assertTrue(family_paths)
        self.assertLessEqual(family_paths, canonical_paths)


class SourceReceiptTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "checkout"
        self.root.mkdir()
        self.receipt = Path(self.temp.name) / "source-validation.json"
        self.project = self.root / "projects/grilling/gameplay_core"
        self.bp = self.project / "behavior_pack"
        self.rp = self.project / "resource_pack"
        for folder, uuid in ((self.bp, "bp"), (self.rp, "rp")):
            folder.mkdir(parents=True)
            (folder / "manifest.json").write_text(json.dumps({"header": {"uuid": uuid, "version": [2, 8, 47]}}))
            (folder / "runtime.js").write_text("export const value = 1;\n")
        (self.root / "config.json").write_text('{"compiler": "pinned"}')
        self.git("init", "-q")
        self.git("config", "user.name", "Verifier regression")
        self.git("config", "user.email", "verifier@example.invalid")
        self.git("add", ".")
        self.git("commit", "-qm", "fixture")
        for name, value in (("ROOT", self.root), ("PROJECT", self.project), ("BP", self.bp), ("RP", self.rp)):
            self.enterContext(patch.object(gate, name, value))
        self.enterContext(redirect_stdout(io.StringIO()))
        self.enterContext(redirect_stderr(io.StringIO()))

    def git(self, *args):
        subprocess.run(["git", *args], cwd=self.root, check=True, capture_output=True)

    def issue(self):
        self.receipt.write_text(json.dumps({
            "schema_version": 1,
            "scope": "canonical-functional-source",
            "version": [2, 8, 47],
            "source": gate.source_snapshot(),
        }))

    def export(self):
        for folder in (self.bp, self.rp):
            shutil.copytree(folder, self.project / "builds/dist" / folder.name)

    def main(self, *args):
        with patch.object(sys, "argv", ["verify_current.py", *map(str, args)]):
            gate.main()

    def mock_functional_commands(self, side_effect=None):
        # Keep Git reads real: subprocess.check_output itself calls run().
        return patch.object(gate, "subprocess", SimpleNamespace(
            check_output=subprocess.check_output, run=Mock(side_effect=side_effect),
        ))

    def test_compiled_only_requires_receipt(self):
        with self.assertRaises(SystemExit):
            self.main("--compiled-only")

    def test_matching_receipt_compares_export_without_functional_subprocesses(self):
        self.issue()
        self.export()
        with patch.object(gate, "generic_gate", return_value=(2, 8, 47, 1)), self.mock_functional_commands() as commands:
            self.main("--compiled-only", "--source-validation", self.receipt)
        commands.run.assert_not_called()

    def test_changed_source_config_or_new_input_rejects_receipt(self):
        for relative in ("projects/grilling/gameplay_core/behavior_pack/runtime.js", "config.json", "new-fixture.json"):
            with self.subTest(relative=relative):
                self.issue()
                target = self.root / relative
                original = target.read_bytes() if target.exists() else None
                target.write_text("changed")
                with self.assertRaisesRegex(AssertionError, "source/HEAD changed"):
                    gate.require_source_validation(self.receipt)
                if original is None:
                    target.unlink()
                else:
                    target.write_bytes(original)

    def test_different_head_rejects_identical_content(self):
        self.issue()
        self.git("commit", "--allow-empty", "-qm", "new head")
        with self.assertRaisesRegex(AssertionError, "source/HEAD changed"):
            gate.require_source_validation(self.receipt)

    def test_missing_source_rejects_receipt(self):
        self.issue()
        (self.bp / "runtime.js").unlink()
        with self.assertRaises(FileNotFoundError):
            gate.require_source_validation(self.receipt)

    def test_output_changes_do_not_invalidate_source_receipt(self):
        self.issue()
        self.export()
        gate.require_source_validation(self.receipt)

    def test_dash_generated_caches_do_not_invalidate_source_receipt(self):
        self.issue()
        for project in (self.root, self.project):
            cache = project / ".bridge/.dash.production.json"
            cache.parent.mkdir(parents=True)
            cache.write_text('{"generated":true}')
        gate.require_source_validation(self.receipt)

    def test_bridge_extension_changes_still_invalidate_source_receipt(self):
        self.issue()
        extension = self.project / ".bridge/extensions/plugin.js"
        extension.parent.mkdir(parents=True)
        extension.write_text("new compiler input")
        with self.assertRaisesRegex(AssertionError, "source/HEAD changed"):
            gate.require_source_validation(self.receipt)

    def test_export_drift_is_rejected_even_with_valid_source_receipt(self):
        self.issue()
        self.export()
        target = self.project / "builds/dist/behavior_pack/runtime.js"
        target.write_text("changed")
        with patch.object(gate, "generic_gate", return_value=(2, 8, 47, 1)):
            with self.assertRaises(AssertionError):
                self.main("--compiled-only", "--source-validation", self.receipt)

    def test_export_missing_extra_or_changed_manifest_is_rejected(self):
        self.export()
        target = self.project / "builds/dist/behavior_pack"
        for change in ("missing", "extra", "manifest"):
            with self.subTest(change=change):
                shutil.rmtree(target)
                shutil.copytree(self.bp, target)
                if change == "missing":
                    (target / "runtime.js").unlink()
                elif change == "extra":
                    (target / "unexpected.js").write_text("extra")
                else:
                    (target / "manifest.json").write_text('{"header":{"uuid":"bp","version":[2,8,48]}}')
                with self.assertRaises(AssertionError):
                    gate.verify_compiled_exact()

    def test_failed_functional_run_removes_stale_receipt(self):
        self.issue()
        with patch.object(gate, "generic_gate", side_effect=AssertionError("functional failure")):
            with self.assertRaisesRegex(AssertionError, "functional failure"):
                self.main("--write-source-validation", self.receipt)
        self.assertFalse(self.receipt.exists())

    def test_source_mutated_during_successful_run_never_gets_receipt(self):
        def mutate(*args, **kwargs):
            (self.bp / "runtime.js").write_text("changed during verifier")

        with patch.object(gate, "generic_gate", return_value=(2, 8, 47, 1)), self.mock_functional_commands(side_effect=mutate):
            with self.assertRaisesRegex(AssertionError, "changed during functional"):
                self.main("--write-source-validation", self.receipt)
        self.assertFalse(self.receipt.exists())

    def test_current_slime_checks_are_required_before_receipt(self):
        with patch.object(gate, "generic_gate", return_value=(2, 8, 143, 1)), self.mock_functional_commands() as commands:
            self.main("--write-source-validation", self.receipt)
        self.assertEqual(commands.run.call_count, 3)
        self.assertTrue(str(commands.run.call_args_list[1].args[0][-1]).endswith("verify_slime_frames.py"))
        self.assertTrue(str(commands.run.call_args_list[2].args[0][-1]).endswith("verify_a28143.py"))
        gate.require_source_validation(self.receipt)

    def test_full_success_writes_receipt_after_both_functional_commands(self):
        with patch.object(gate, "generic_gate", return_value=(2, 8, 47, 1)), self.mock_functional_commands() as commands:
            self.main("--write-source-validation", self.receipt)
        self.assertEqual(commands.run.call_count, 2)
        self.assertTrue(str(commands.run.call_args_list[0].args[0][-1]).endswith("verify_visual_refs.py"))
        self.assertTrue(str(commands.run.call_args_list[1].args[0][-1]).endswith("verify_a2847.py"))
        gate.require_source_validation(self.receipt)


if __name__ == "__main__":
    unittest.main()
