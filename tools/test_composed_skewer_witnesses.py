"""Exact combined-source inverses. Runtime/native acceptance is separate."""
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from eating_owner_context import ROOT, reference_bytes
import build_failure_skewer_held as failure
import build_raw_one_eating_projection as raw
import build_review_three_eating_projection as three
import slime_frame_source_witness as slime

class ComposedWitnessTests(unittest.TestCase):
 def reject_change(self,path,before,after):
  original=path.read_bytes();self.assertEqual(original.count(before),1)
  expected=reference_bytes(path);changed=original.replace(before,after,1)
  read=Path.read_bytes
  def injected(p):return changed if p==path else read(p)
  with patch.object(Path,'read_bytes',injected):
   with self.assertRaises((AssertionError,ValueError)):
    self.assertEqual(reference_bytes(path),expected)
 def test_each_dispatch_layer_and_unrelated_bytes_fail_closed(self):
  p=three.MAIN
  for before,after in [(raw.IMPORT.encode(),b''),(three.IMPORT.encode(),b''),
   (failure.PROJECTION_IMPORT.encode(),b''),(failure.STATE_IMPORT.encode(),b''),
   (b' const slimeFrame=readSlimeWorldFrame(world);',b' const slimeFrame=0;'),
   (b'  syncSlimeHeld(p,slimeFrame);',b'  syncSlimeHeld(p,0);'),
   (b'if(!out)return failedStack(raw,MYSTERIOUS_ID);',b'if(!out)return failedStack(raw,DARK_ID);')]:
   with self.subTest(before=before):self.reject_change(p,before,after)
  self.reject_change(p,b'function tundraFactor(',b'// unreviewed\nfunction tundraFactor(')
 def test_both_transport_owners_and_unrelated_bytes_fail_closed(self):
  p=ROOT/slime.TRANSPORT_PATH
  for before,after in [(b"if(typeId===SLIME_ID)return 'slime';",b"if(typeId===SLIME_ID)return 'empty';"),
   (b"if(isFailureSkewer(id))return 'failure';",b"if(isFailureSkewer(id))return 'secret';"),
   (b"kind==='failure'&&marker===FAILURE_VISUAL_MARKER",b"kind==='failure'&&marker===219"),
   (b"if(kind==='slime'&&previous?.kind==='slime')",b"if(kind==='slime')")]:
   with self.subTest(before=before):self.reject_change(p,before,after)
 def test_original_slime_pins_remain_exact(self):
  for relative in slime.PATHS:
   path=ROOT/relative;current=path.read_bytes()
   if relative==slime.TRANSPORT_PATH:current=failure.predecessor_script(path,current.decode()).encode()
   self.assertEqual(slime.reference_bytes(path,current),slime.pinned_bytes(slime.PREVIOUS_SLIME_BASE,relative))
 def test_all_visibility_layers_are_independently_reversible(self):
  p=raw.CONTROLLER;current=json.loads(p.read_text())
  after_failure=failure.predecessor_document(p,current)
  after_raw=raw.historical_document(p,after_failure)
  self.assertNotEqual(current,after_failure);self.assertNotEqual(after_failure,after_raw)
  self.assertEqual(three.historical_document(p,current),three.historical_document(p,after_raw))
  for bone in ['rightArm','rightSleeve','leftArm','leftSleeve']:
   changed=json.loads(p.read_text())
   next(row for row in changed['render_controllers']['controller.render.player.first_person']['part_visibility'] if bone in row)[bone]='1'
   with self.assertRaises(ValueError):three.historical_document(p,changed)

if __name__=='__main__':unittest.main()
