import sys,pathlib,subprocess,unittest,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
import eating_route_extraction as bridge
class Extraction(unittest.TestCase):
 def test_exact_preimage_and_idempotence(self):
  c=bridge.contract();rel='projects/grilling/gameplay_core/behavior_pack/scripts/main.js';old=subprocess.check_output(['git','show',c['baseline_commit']+':'+rel],cwd=ROOT).decode();new=(ROOT/rel).read_text()
  self.assertEqual(bridge.restore_main(new),old);self.assertEqual(bridge.extract_main(old),new);self.assertEqual(bridge.extract_main(new),new);bridge.validate_resolver()
 def test_partial_and_unrelated_mutations(self):
  c=bridge.contract();new=(ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/main.js').read_text()
  for old,token in c['replacements']:
   for bad in [new.replace(token,'',1),new.replace(token,token+token,1),new.replace(token,token.replace('heldByHand','undefined'),1)]:
    with self.assertRaises(ValueError):bridge.restore_main(bad)
  for bad in [new.replace(c['import'],''),new+c['import']]:
   with self.assertRaises(ValueError):bridge.restore_main(bad)
  self.assertIn('// unrelated drift',bridge.restore_main(new+'// unrelated drift'))
 def test_all_other_runtime_bytes_and_owned_inventory(self):
  from current_runtime_ownership import verify_current_inventory,frozen_runtime_bytes,BASE as frozen
  verify_current_inventory()
  c=bridge.contract();allow={'projects/grilling/gameplay_core/behavior_pack/scripts/main.js',c['resolver_path']};bridge.validate_resolver()
  for line in subprocess.check_output(['git','ls-tree','-r',c['baseline_commit'],'projects/grilling/gameplay_core/behavior_pack','projects/grilling/gameplay_core/resource_pack'],cwd=ROOT,text=True).splitlines():
   meta,path=line.split('\t');data=frozen_runtime_bytes(path)
   if path.endswith('/scripts/main.js'):data=bridge.restore_main(data.decode()).encode()
   self.assertEqual(hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest(),meta.split()[2],path)
  changed=set(subprocess.check_output(['git','diff','--name-only',c['baseline_commit'],frozen],cwd=ROOT,text=True).splitlines())
  self.assertLessEqual({p for p in changed if '/resource_pack/'in p or '/behavior_pack/'in p},allow)
 def test_failure_current_boundary_and_legacy_supplied_input(self):
  import build_failure_skewer_held as failure
  from unittest.mock import patch
  main=ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/main.js';current=main.read_text()
  old_source=subprocess.check_output(['git','show','c7c0bfb047af06a5d1c42d6e31c873dc9ca6992f:tools/build_failure_skewer_held.py'],cwd=ROOT,text=True)
  legacy={'__file__':failure.__file__,'__name__':'failure_pre_extraction_boundary_test'}
  exec(compile(old_source,failure.__file__,'exec'),legacy)
  historical=subprocess.check_output(['git','show','b938359b:'+main.relative_to(ROOT).as_posix()],cwd=ROOT,text=True)
  inputs=[historical,bridge.restore_main(current)]
  expected=[legacy['patch_main'](text) for text in inputs]
  original_read=pathlib.Path.read_text
  def supplied_only(path,*args,**kwargs):
   if path==main:raise AssertionError('Supplied main input must not read main from disk')
   return original_read(path,*args,**kwargs)
  with patch.object(pathlib.Path,'read_text',supplied_only):
   self.assertEqual(failure.patch_main(current),current)
   with self.assertRaises(ValueError):failure.patch_main(current+'\n// unrelated supplied suffix')
   for text,want in zip(inputs,expected):self.assertEqual(failure.patch_main(text),want)
 def test_failure_boundary_rejects_owned_mutations(self):
  import build_failure_skewer_held as failure
  current=(ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/main.js').read_text();c=bridge.contract()
  bad=[current.replace(c['import'],''),current+c['import'],current.replace('if(!out)return failedStack(raw,MYSTERIOUS_ID);','if(!out)return failedStack(raw,DARK_ID);')]
  bad += [current.replace(new,new+new,1) for old,new in c['replacements']]
  for text in bad:
   with self.assertRaises(ValueError):failure.patch_main(text)
if __name__=='__main__':unittest.main()
