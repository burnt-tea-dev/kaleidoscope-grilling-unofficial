"""Fail-closed source receipt and export checks; no game/client simulation."""
from contextlib import redirect_stdout, redirect_stderr
import io
import json
import os
import runpy
import re
from pathlib import Path, PurePosixPath, PureWindowsPath
import shutil
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import verify_current as gate
import verification_session as session
import verification_session_runner as runner


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


class CurrentRunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        # TEMP can contain a Windows short-name/junction or a POSIX symlink.
        # Positive fixtures must meet the runner's exact resolved-path contract.
        self.root = Path(self.temp.name).resolve()
        self.directory = self.root / "verifiers"
        self.directory.mkdir()
        self.target = self.directory / "verify_a28144.py"
        self.registered = {(2, 8, 144): self.target.name}
        self.log = self.root / "commands.jsonl"
        self.capture = self.root / "context.json"
        child = (
            "import json,os,sys; from pathlib import Path; "
            f"p=Path({str(self.log)!r}); "
            "row={'kind':sys.argv[1], 'cwd':os.getcwd(), "
            f"'selector':os.environ.get({session.SESSION_ENV!r}), "
            "'input':os.environ.get('FIXTURE_INPUT')}; "
            "p.open('a').write(json.dumps(row)+'\\n')"
        )
        self.target.write_text(
            "import json,os,subprocess,sys\nfrom pathlib import Path\n"
            "from verification_session import SESSION_ENV,run_checked_once,session_active,current_source_validation_session\n"
            "def main():\n"
            f" Path({str(self.capture)!r}).write_text(json.dumps({{'argv':sys.argv,'name':__name__,'active':session_active()}}))\n"
            f" command=[sys.executable,'-c',{child!r},'reused']\n"
            " run_checked_once(command)\n run_checked_once(command)\n"
            f" subprocess.run([sys.executable,'-c',{child!r},'unrelated'],check=True)\n"
            "if __name__=='__main__':\n"
            " if os.environ.pop(SESSION_ENV,None)==Path(__file__).name:\n"
            "  with current_source_validation_session():main()\n"
            " else:main()\n"
        )

    def run_target(self, target=None, arguments=()):
        runner.run_registered_verifier(
            target or self.target, directory=self.directory,
            registered=self.registered, arguments=arguments,
        )

    def rows(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def test_future_registered_verifier_reuses_only_exact_success_and_sanitizes_selector(self):
        original_argv, original_path = sys.argv, sys.path[:]
        with patch.dict(os.environ, {session.SESSION_ENV:self.target.name, "FIXTURE_INPUT":"retained"}):
            self.run_target(arguments=["--compiled"])
            self.assertNotIn(session.SESSION_ENV, os.environ)
        self.assertEqual(json.loads(self.capture.read_text()), {
            "argv":[str(self.target),"--compiled"], "name":"__main__", "active":True,
        })
        self.assertEqual([row["kind"] for row in self.rows()], ["reused","unrelated"])
        for row in self.rows():
            self.assertEqual(row, {"kind":row["kind"], "cwd":str(Path.cwd()),
                                   "selector":None, "input":"retained"})
        self.assertIs(sys.argv, original_argv)
        self.assertEqual(sys.path, original_path)
        self.assertFalse(session.session_active())

    def test_standalone_historical_execution_retains_every_command(self):
        with patch.dict(os.environ):
            os.environ.pop(session.SESSION_ENV, None)
            runpy.run_path(str(self.target), run_name="__main__")
        self.assertEqual([row["kind"] for row in self.rows()], ["reused","reused","unrelated"])
        self.assertFalse(json.loads(self.capture.read_text())["active"])

    def test_only_exact_existing_registered_in_directory_target_is_allowed(self):
        outside = self.root / self.target.name
        outside.write_text("raise AssertionError('must not execute')")
        unknown = self.directory / "unknown.py"
        unknown.write_text(outside.read_text())
        for target in (outside, unknown, Path(self.target.name), self.directory / "missing.py"):
            with self.subTest(target=target), self.assertRaisesRegex(ValueError, "exact registered"):
                self.run_target(target)
        self.assertFalse(self.log.exists())

    def test_posix_and_windows_aliases_require_canonical_target_spelling(self):
        cases = (
            (PurePosixPath, "/tmp/real/verifiers/check.py", "/tmp/alias/verifiers/check.py"),
            (PureWindowsPath, r"C:\Users\runneradmin\Temp\verifiers\check.py",
             r"C:\Users\RUNNER~1\Temp\verifiers\check.py"),
            (PureWindowsPath, r"D:\temp\verifiers\check.py", r"C:\temp-link\verifiers\check.py"),
        )
        for flavor, canonical, alias in cases:
            resolved = {flavor(alias): flavor(canonical),
                        flavor(alias).parent: flavor(canonical).parent}

            # Model only OS resolution/existence so both path flavors exercise
            # the real admission guard on every platform, without link privileges.
            class CandidatePath(flavor):
                def resolve(self):
                    return type(self)(resolved.get(self, self))

                def is_file(self):
                    return True

            with self.subTest(path=alias), patch.object(runner, "Path", CandidatePath), \
                    patch.object(runner.runpy, "run_path") as execute, patch.dict(os.environ):
                options = {"directory": flavor(alias).parent, "registered": {(1, 0, 0): "check.py"}}
                runner.run_registered_verifier(canonical, **options)
                execute.assert_called_once_with(str(flavor(canonical)), run_name="__main__")
                execute.reset_mock()
                with self.assertRaisesRegex(ValueError, "exact registered"):
                    runner.run_registered_verifier(alias, **options)
                execute.assert_not_called()

    @unittest.skipIf(os.name == "nt", "symlink creation requires Windows privileges")
    def test_registered_symlink_cannot_escape_verifier_directory(self):
        outside = self.root / self.target.name
        outside.write_text("raise AssertionError('must not execute')")
        self.target.unlink()
        self.target.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, "exact registered"):
            self.run_target()
        self.assertFalse(self.log.exists())

    def test_failure_propagates_and_always_clears_session_and_process_arguments(self):
        self.target.write_text("from verification_session import run_checked_once\nimport sys\nrun_checked_once([sys.executable,'-c','raise SystemExit(7)'])\n")
        original_argv, original_path = sys.argv, sys.path[:]
        with self.assertRaises(subprocess.CalledProcessError) as error:
            self.run_target()
        self.assertEqual(error.exception.returncode, 7)
        self.assertFalse(session.session_active())
        self.assertIs(sys.argv, original_argv)
        self.assertEqual(sys.path, original_path)

    def test_nested_context_rejected_before_verifier_executes(self):
        with session.current_source_validation_session():
            with self.assertRaisesRegex(RuntimeError, "already active"):
                self.run_target()
        self.assertFalse(self.capture.exists())
        self.assertFalse(session.session_active())


class WorkflowCoverageTests(unittest.TestCase):
    def test_current_baseline_has_existing_registered_verifier(self):
        version = tuple(gate.load(gate.ROOT / "baseline.json")["version"])
        self.assertIn(version, gate.VERIFIERS)
        self.assertTrue((gate.DEV / gate.VERIFIERS[version]).is_file())

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

    def test_unregistered_version_fails_without_receipt_or_release_verifier(self):
        version = (max(v[0] for v in gate.VERIFIERS) + 1, 0, 0)
        self.issue()
        with patch.object(gate, "generic_gate", return_value=(*version, 1)), self.mock_functional_commands() as commands:
            with self.assertRaisesRegex(SystemExit, "No release verifier registered"):
                self.main("--write-source-validation", self.receipt)
        self.assertFalse(self.receipt.exists())
        self.assertEqual([Path(call.args[0][-1]).name for call in commands.run.call_args_list],
                         ["verify_visual_refs.py", "verify_slime_frames.py"])

    def test_current_slime_checks_are_required_before_receipt(self):
        for patch_version in (145, 146, 147):
            with patch.object(gate, "generic_gate", return_value=(2, 8, patch_version, 1)), self.mock_functional_commands() as commands:
                self.main("--write-source-validation", self.receipt)
            self.assertEqual([Path(call.args[0][-1]).name for call in commands.run.call_args_list], [
                "verify_visual_refs.py", "verify_slime_frames.py", f"verify_a28{patch_version}.py",
                "verify_failure_skewer.py", "test_ordinary_relative_calibration.py",
                "test_tp_java_item_fallback.py", "test_offhand_eating_projection.py",
                "test_eating_route_resolver.mjs", "test_eating_route_extraction.py",
                "test_eating_compiler_pipeline.py",
                "test_current_runtime_ownership.py", "test_composed_skewer_witnesses.py", "test_all_skewer_integration.mjs",
            ])
            gate.require_source_validation(self.receipt)

    def test_receipt_runner_capability_and_standalone_command_keep_original_arguments(self):
        for receipt, compiled in ((False,False), (False,True), (True,False), (True,True)):
            with self.subTest(receipt=receipt, compiled=compiled):
                args = (["--write-source-validation",self.receipt] if receipt else []) + (["--compiled"] if compiled else [])
                with patch.dict(os.environ, {session.SESSION_ENV:"injected"}), patch.object(gate, "generic_gate", return_value=(2,8,143,1)), patch.object(gate,"verify_compiled_exact"), self.mock_functional_commands() as commands:
                    self.main(*args)
                call = next(c for c in commands.run.call_args_list if "env" in c.kwargs)
                expected = [sys.executable]
                if receipt:
                    expected.append(str(gate.DEV / "verification_session_runner.py"))
                expected.append(str(gate.DEV / "verify_a28143.py"))
                if compiled:
                    expected.append("--compiled")
                self.assertEqual(call.args[0], expected)
                self.assertNotIn(session.SESSION_ENV, call.kwargs["env"])

    def test_full_success_writes_receipt_after_all_functional_commands(self):
        with patch.object(gate, "generic_gate", return_value=(2, 8, 47, 1)), self.mock_functional_commands() as commands:
            self.main("--write-source-validation", self.receipt)
        self.assertEqual([Path(call.args[0][-1]).name for call in commands.run.call_args_list], [
            "verify_visual_refs.py", "verify_a2847.py", "verify_failure_skewer.py",
            "test_ordinary_relative_calibration.py", "test_tp_java_item_fallback.py",
            "test_offhand_eating_projection.py", "test_eating_route_resolver.mjs",
            "test_eating_route_extraction.py", "test_eating_compiler_pipeline.py",
            "test_current_runtime_ownership.py", "test_composed_skewer_witnesses.py",
            "test_all_skewer_integration.mjs",
        ])
        gate.require_source_validation(self.receipt)

    def test_every_combined_command_failure_prevents_receipt(self):
        for target in ["verify_visual_refs.py", "verify_slime_frames.py", "verify_a28143.py",
                       "verify_failure_skewer.py", "test_ordinary_relative_calibration.py",
                       "test_tp_java_item_fallback.py", "test_offhand_eating_projection.py",
                       "test_eating_route_resolver.mjs", "test_eating_route_extraction.py",
                       "test_eating_compiler_pipeline.py",
                       "test_current_runtime_ownership.py", "test_composed_skewer_witnesses.py", "test_all_skewer_integration.mjs"]:
            with self.subTest(target=target):
                self.issue()
                def fail_selected(command, **kwargs):
                    if Path(command[-1]).name == target:
                        raise RuntimeError("injected functional failure: " + target)
                with patch.object(gate, "generic_gate", return_value=(2, 8, 143, 1)), self.mock_functional_commands(side_effect=fail_selected):
                    with self.assertRaisesRegex(RuntimeError, "injected functional failure"):
                        self.main("--write-source-validation", self.receipt)
                self.assertFalse(self.receipt.exists())


if __name__ == "__main__":
    unittest.main()
