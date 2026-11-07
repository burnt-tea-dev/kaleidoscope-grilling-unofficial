"""Exercise the actual installer boundary without allowing a rejected write."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import types
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('trace_installer', HERE/'prepare_ordinary_damage_trace.py')
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)


class StopBeforeWrite(Exception):
    pass


class InstallerCheckoutBoundary(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.storage = tempfile.TemporaryDirectory(prefix='grilling-trace-boundary-')
        cls.root = Path(cls.storage.name)
        origin, cls.checkout = cls.root/'origin', cls.root/'other-checkout'
        subprocess.run(['git','init','--quiet',str(origin)],check=True)
        hooks = cls.root/'empty-hooks';hooks.mkdir()
        subprocess.run(['git','-C',str(origin),'-c','user.name=QA Fixture',
                        '-c','user.email=qa@example.invalid','-c','commit.gpgsign=false',
                        '-c','core.hooksPath='+str(hooks),'commit','--quiet','--allow-empty',
                        '-m','Disposable installer boundary fixture'],check=True)
        subprocess.run(['git','-C',str(origin),'worktree','add','--quiet','--detach',
                        str(cls.checkout),'HEAD'],check=True)
        cls.canonical = cls.checkout/'projects/grilling/gameplay_core/behavior_pack/scripts'
        cls.original = (installer.SCRIPTS/'effect/runtime.js').read_bytes()
        cls.prepare_copy(cls.canonical)

    @classmethod
    def tearDownClass(cls):
        cls.storage.cleanup()

    @classmethod
    def prepare_copy(cls, scripts):
        (scripts/'effect').mkdir(parents=True)
        (scripts/'effect/runtime.js').write_bytes(cls.original)

    def assert_rejected_before_write(self, scripts):
        attempts = []
        def stop(path, data):
            attempts.append(path)
            raise StopBeforeWrite()
        with patch.object(Path, 'write_bytes', autospec=True, side_effect=stop):
            try:
                installer.install(scripts)
            except ValueError as error:
                self.assertIn('Git checkout', str(error))
            except StopBeforeWrite:
                self.fail('Installer reached the mutation boundary for '+str(scripts))
            else:
                self.fail('Installer did not reject the source checkout')
        self.assertEqual(attempts, [])
        self.assertEqual((self.canonical/'effect/runtime.js').read_bytes(), self.original)

    def test_another_real_linked_checkout_is_rejected_before_any_write(self):
        self.assertTrue((self.checkout/'.git').is_file())
        self.assert_rejected_before_write(self.canonical)

    def test_outside_qa_path_resolving_into_checkout_is_rejected_before_any_write(self):
        scripts = self.root/'qa-alias/scripts';scripts.mkdir(parents=True)
        (scripts/'effect').symlink_to(self.canonical/'effect', target_is_directory=True)
        self.assert_rejected_before_write(scripts)

    def test_normal_non_git_copy_keeps_the_exact_original_installation_output(self):
        old = types.ModuleType('fixed_0feb_installer')
        old.__file__ = str(HERE/'prepare_ordinary_damage_trace.py')
        source = subprocess.check_output(['git','show',
            '0febd0e47caa2300976b95b5986002056384a8e6:tests/native/heavy-metal/prepare_ordinary_damage_trace.py'],cwd=installer.ROOT)
        exec(compile(source, old.__file__, 'exec'), old.__dict__)
        before, after = self.root/'qa-original/scripts', self.root/'qa-fixed/scripts'
        self.prepare_copy(before);self.prepare_copy(after)
        original_report, fixed_report = old.install(before), installer.install(after)
        self.assertEqual(fixed_report, original_report)
        for name in ['effect/runtime.js', *fixed_report['added_files']]:
            self.assertEqual((after/name).read_bytes(), (before/name).read_bytes(), name)


if __name__ == '__main__':
    unittest.main()
