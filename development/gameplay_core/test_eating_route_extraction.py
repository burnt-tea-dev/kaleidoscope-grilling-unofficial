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
  c=bridge.contract();allow={'projects/grilling/gameplay_core/behavior_pack/scripts/main.js',c['resolver_path']};bridge.validate_resolver()
  for line in subprocess.check_output(['git','ls-tree','-r',c['baseline_commit'],'projects/grilling/gameplay_core/behavior_pack','projects/grilling/gameplay_core/resource_pack'],cwd=ROOT,text=True).splitlines():
   meta,path=line.split('\t');data=(ROOT/path).read_bytes()
   if path.endswith('/scripts/main.js'):data=bridge.restore_main(data.decode()).encode()
   self.assertEqual(hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest(),meta.split()[2],path)
  changed=set(subprocess.check_output(['git','diff','--name-only',c['baseline_commit']],cwd=ROOT,text=True).splitlines())|set(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=ROOT,text=True).splitlines())
  self.assertLessEqual({p for p in changed if '/resource_pack/'in p or '/behavior_pack/'in p},allow)
if __name__=='__main__':unittest.main()
