"""Exact successor preservation at the complete legacy compiler boundary."""
import unittest
from unittest.mock import patch
import eating_compiler_pipeline as pipeline
import current_runtime_ownership as ownership
import g153_repair_source as repair
from test_g153_repair_source import RepairAdmission

class RepairCompilerBoundary(RepairAdmission):
    def run_compiler(self, supplied=None, change=None):
        main=self.root/self.a
        context=pipeline.Context((2,8,153),{},self.root/repair.RP,main)
        seen=[]
        def stage(stage,output,context):
            seen.append(output[main])
            if change is not None:output[main]=change
            return output
        with patch.object(ownership,'verify_current_inventory',side_effect=lambda:repair.predecessor_runtime(self.after)) as verify, patch.object(pipeline,'apply_stage',side_effect=stage), patch('skewer_content_source.historical_bytes',side_effect=lambda path,actual:repair.reference_bytes(path,actual)):
            result=pipeline.run({} if supplied is None else {main:supplied},context)
        return result[main],seen,verify.call_count

    def test_complete_pipeline_recovers_then_preserves_exact_successor(self):
        for supplied in (None,'new a','old a'):
            with self.subTest(supplied=supplied):
                result,seen,calls=self.run_compiler(supplied)
                self.assertEqual(result,'new a')
                self.assertEqual(set(seen),{'old a'})
                self.assertEqual(calls,2)

    def test_complete_pipeline_rejects_changed_generated_preimage(self):
        with self.assertRaisesRegex(ValueError,'Legacy builder changed'):
            self.run_compiler(change='old a modified')
        with self.assertRaisesRegex(ValueError,'Legacy builder changed'):
            self.run_compiler(supplied='forged input')

    def test_complete_pipeline_rejects_mutated_live_successor(self):
        (self.root/self.a).write_bytes(b'new a forged')
        with self.assertRaises(ValueError):self.run_compiler()

class ComposedStageOrder(unittest.TestCase):
    def test_g153_keeps_remote_skewer_content_stage(self):
        context=pipeline.Context((2,8,153),{},repair.ROOT/repair.RP,repair.ROOT/repair.BP/'scripts/main.js')
        stage=next(stage for stage in pipeline.STAGES if stage.name=='skewer_content')
        self.assertTrue(pipeline.enabled(stage,context))
        self.assertEqual(pipeline.STAGES[-1].name,'skewer_content')

    def test_reapplication_requires_g152_not_older_g150_main(self):
        import skewer_content_source as skewer
        path=repair.BP+'/scripts/main.js'
        current=(repair.ROOT/path).read_bytes()
        g152=repair.reference_bytes(path,current)
        self.assertEqual(repair.reapply_bytes(path,g152),current)
        with self.assertRaises(ValueError):
            repair.reapply_bytes(path,skewer.preceding_files()[path])

if __name__=='__main__':unittest.main()
