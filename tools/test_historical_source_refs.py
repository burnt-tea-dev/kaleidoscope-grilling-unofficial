from pathlib import Path
import copy,hashlib,io,json,tempfile,unittest
from unittest.mock import patch
from historical_source_refs import ROOT,encoded_listing,inventory,literal_refs,verify
import public_source_witness as public

class HistoricalSourceRefsTests(unittest.TestCase):
 def fixture(self,text,rows):
  t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);r=Path(t.name)
  (r/'development/gameplay_core').mkdir(parents=True);(r/'tools/fixtures').mkdir(parents=True)
  (r/'development/gameplay_core/gate.py').write_text(text)
  (r/'tools/fixtures/g66-historical-source-refs.json').write_text(json.dumps({'schema':1,'refs':rows}))
  return r
 def test_complete_active_source_refs_resolve_exactly(self):
  self.assertEqual(verify(),{'refs':32,'commits':32})
  self.assertEqual(set(inventory()),literal_refs())
 def test_public_witness_rejects_tree_digest_and_current_source_byte_mutations(self):
  meta=public.witness();path=ROOT/'projects/grilling/gameplay_core/resource_pack/animations/java_eating_player.animation.json'
  self.assertIn(meta['commit'],inventory());self.assertEqual(meta['tree'],public.PUBLIC_SOURCE_TREE)
  source=public.public_bytes(path);self.assertEqual(path.read_bytes(),source)
  with patch.object(Path,'read_bytes',return_value=source+b'\n'):
   with self.assertRaises(AssertionError):public.assert_public_bytes(self,path)
  wrong=dict(meta,files=dict(meta['files']));wrong['files'][path.relative_to(ROOT).as_posix()]='0'*64
  with patch.object(public,'witness',return_value=wrong):
   with self.assertRaisesRegex(AssertionError,'bytes mismatch'):public.public_bytes(path)
  public.witness.cache_clear()
  try:
   with patch.object(public.subprocess,'check_output',return_value='0'*40):
    with self.assertRaisesRegex(AssertionError,'tree mismatch'):public.witness()
  finally:public.witness.cache_clear()
  with self.assertRaises(AssertionError):public.public_bytes('../outside.json')
 def test_archived_private_builders_retain_bytes_and_are_not_active_python(self):
  import subprocess
  for name in ('build_threaded_idle_private.py','build_threaded_secret_private.py'):
   path=ROOT/'docs/archive/private-builders'/(name+'.txt')
   source=subprocess.check_output(['git','show',public.PUBLIC_SOURCE_BASE+':tools/'+name],cwd=ROOT)
   self.assertEqual(path.read_bytes(),source);self.assertFalse((ROOT/'tools'/name).exists())
 def test_g73_plate_alias_delta_is_single_line_and_rejects_unrelated_mutations(self):
  path=ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/main.js'
  delta=json.loads((ROOT/'tools/fixtures/g73-plate-alias-main-delta.json').read_text())
  before=' const id=eaten.typeId;dangerousPreservation(player,id);\n'
  after=' const id=canonicalFoodId(eaten.typeId);dangerousPreservation(player,id);\n'
  self.assertEqual(delta['release'],[2,8,73]);self.assertEqual(len(delta['edits']),1)
  edit=delta['edits'][0];self.assertEqual(edit['end']-edit['start'],1)
  self.assertEqual(edit['before'],before);self.assertEqual(edit['after'],after)
  public.assert_public_bytes_with_g71_bottles(self,path)
  source=path.read_bytes()
  for changed in (source.replace(after.encode(),before.encode()),source.replace(b'MINIMUM_EAT_TICKS=25',b'MINIMUM_EAT_TICKS=1'),source+b'\n'):
   self.assertNotEqual(changed,source)
   with patch.object(Path,'read_bytes',return_value=changed):
    with self.assertRaisesRegex(AssertionError,'Source differs outside'):
     public.assert_public_bytes_with_g71_bottles(self,path)
 def test_g110_completion_and_material_lore_are_exactly_reviewed(self):
  path=ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/main.js'
  delta=json.loads((ROOT/'tools/fixtures/g110-main-reviewed-delta.json').read_text())
  self.assertEqual(delta['release'],[2,8,110]);self.assertEqual(len(delta['operations']),2)
  self.assertEqual(delta['operations'][0]['before'],'seasoningLore(16-nextUses)')
  self.assertEqual(delta['operations'][0]['after'],'seasoningLore(16-nextUses,ingredients.length)')
  self.assertIn("if(!hasSeasoningBase(list))",delta['operations'][1]['before'])
  self.assertNotIn("if(!hasSeasoningBase(list))",delta['operations'][1]['after'])
  source=path.read_bytes()
  public.assert_public_bytes_with_g71_bottles(self,path)
  for op in delta['operations']:
   changed=source.replace(op['after'].encode(),op['before'].encode())
   self.assertNotEqual(changed,source)
   with patch.object(Path,'read_bytes',return_value=changed):
    with self.assertRaisesRegex(AssertionError,'Source differs outside'):
     public.assert_public_bytes_with_g71_bottles(self,path)
  before=public.expected_main_bytes((2,8,114))
  repaired=public.expected_main_bytes((2,8,115))
  self.assertEqual(repaired,before.replace(public.NUTRITION_G114,public.NUTRITION_G115,1))
  self.assertIn(public.REVIEWED_NUTRITION_BASE,inventory())
  for changed in (repaired.replace(public.NUTRITION_G115,public.NUTRITION_G114,1),repaired.replace(b'currentSat.effectiveMax,',b'',1)):
   self.assertNotEqual(changed,repaired)
   with patch.object(Path,'read_bytes',return_value=changed):
    with self.assertRaisesRegex(AssertionError,'Source differs outside'):
     public.assert_public_bytes_with_g71_bottles(self,path)
 def test_g117_conservation_repairs_retain_preimages_and_reject_widened_delta(self):
  path=ROOT/public.MAIN_PATH;load=public._main_delta
  delta=load('g117-main-reviewed-delta.json')
  before=public.expected_main_bytes((2,8,116));repaired=public.expected_main_bytes((2,8,117))
  self.assertEqual(before,public.expected_main_bytes((2,8,115)))
  self.assertEqual(delta['reviewed_commit'],public.REVIEWED_CONSERVATION_BASE)
  self.assertIn(public.REVIEWED_CONSERVATION_BASE,inventory())
  self.assertEqual(len(delta['operations']),2)
  self.assertIn('if(e.cancel!==false)return',delta['operations'][0]['after'])
  self.assertIn("const currentSat=player.getComponent('minecraft:player.saturation')",delta['operations'][1]['after'])
  self.assertEqual(public._apply_main_operations(before,delta),repaired)
  self.assertEqual(repaired,public._reviewed_conservation_source())
  source=path.read_bytes();current=json.loads((ROOT/'baseline.json').read_text())['version']
  self.assertEqual(source,public.expected_main_bytes(current))
  if tuple(current)>=(2,8,124):
   seasoning=load('g124-main-reviewed-delta.json')
   self.assertEqual(len(seasoning['operations']),3)
   self.assertIn(public.REVIEWED_SEASONING_DATA_BASE,inventory())
   for op in seasoning['operations']:
    changed=source.replace(op['after'].encode(),op['before'].encode(),1)
    self.assertNotEqual(changed,source)
    with patch.object(Path,'read_bytes',return_value=changed):
     with self.assertRaisesRegex(AssertionError,'Source differs outside'):
      public.assert_public_bytes_with_g71_bottles(self,path)
  for op in delta['operations']:
   changed=source.replace(op['after'].encode(),op['before'].encode(),1)
   self.assertNotEqual(changed,source)
   with patch.object(Path,'read_bytes',return_value=changed):
    with self.assertRaisesRegex(AssertionError,'Source differs outside'):
     public.assert_public_bytes_with_g71_bottles(self,path)
  # Updating a fixture's operation and matching hash still cannot widen public scope.
  changed=copy.deepcopy(delta);op=changed['operations'][-1];original=op['after'];op['after']+='\n'
  changed['after_sha256']=hashlib.sha256(repaired.replace(original.encode(),op['after'].encode(),1)).hexdigest()
  with patch.object(public,'_main_delta',side_effect=lambda name:changed if name=='g117-main-reviewed-delta.json' else load(name)):
   with self.assertRaisesRegex(AssertionError,'Reviewed G117 source differs outside'):
    public.expected_main_bytes((2,8,117))
 def test_g118_parity_delta_starts_from_exact_g117_and_retains_the_reviewed_commit(self):
  delta=public._main_delta('g118-main-reviewed-delta.json')
  before=public.expected_main_bytes((2,8,117));repaired=public.expected_main_bytes((2,8,118))
  self.assertEqual(before,public._reviewed_conservation_source())
  self.assertEqual(delta['reviewed_commit'],public.REVIEWED_PARITY_BASE)
  self.assertIn(public.REVIEWED_PARITY_BASE,inventory())
  self.assertEqual(len(delta['operations']),7)
  self.assertEqual(public._apply_main_operations(before,delta),repaired)
  self.assertEqual(repaired,public._reviewed_parity_source())
  with self.assertRaisesRegex(AssertionError,'wrong public preimage'):
   public._g118_parity_bytes(before+b'\n')
  pepper=public._pepper_delta();pepper_before=hashlib.sha256(public._pepper_preimage()).hexdigest()
  self.assertEqual(pepper['source_commit'],public.REVIEWED_PEPPER_BASE)
  self.assertIn(public.REVIEWED_PEPPER_BASE,inventory())
  self.assertEqual(public.reviewed_pepper_bytes(pepper_before),public._reviewed_pepper_source())
  with self.assertRaisesRegex(AssertionError,'wrong public preimage'):
   public.reviewed_pepper_bytes('0'*64)
 def test_g118_parity_witness_rejects_extra_bytes_even_with_a_matching_fixture_hash(self):
  load=public._main_delta;delta=load('g118-main-reviewed-delta.json')
  repaired=public.expected_main_bytes((2,8,118))
  changed=copy.deepcopy(delta);op=changed['operations'][-1];original=op['after'];op['after']+='\n'
  changed['after_sha256']=hashlib.sha256(repaired.replace(original.encode(),op['after'].encode(),1)).hexdigest()
  with patch.object(public,'_main_delta',side_effect=lambda name:changed if name=='g118-main-reviewed-delta.json' else load(name)):
   with self.assertRaisesRegex(AssertionError,'Reviewed G118 source differs outside'):
    public.expected_main_bytes((2,8,118))
  # A matching edited hash also cannot widen the separate whole-file pepper pin.
  pepper=public._pepper_delta();pepper_before=hashlib.sha256(public._pepper_preimage()).hexdigest()
  repaired=public.reviewed_pepper_bytes(pepper_before);changed=copy.deepcopy(pepper)
  changed['changes'][public.PEPPER_PATH]['after_sha256']=hashlib.sha256(repaired+b'\n').hexdigest()
  with patch.object(public,'_pepper_delta',return_value=changed):
   with self.assertRaisesRegex(AssertionError,'Reviewed G118 pepper source bytes mismatch'):
    public.reviewed_pepper_bytes(pepper_before)
 def test_g119_remaining_delta_keeps_g118_and_the_public_main_witness(self):
  load=public._main_delta;delta=load('g119-main-reviewed-delta.json')
  before=public.expected_main_bytes((2,8,118));repaired=public.expected_main_bytes((2,8,119))
  self.assertEqual(before,public._reviewed_parity_source())
  self.assertEqual(delta['reviewed_commit'],public.REVIEWED_REMAINING_BASE)
  self.assertIn(public.REVIEWED_REMAINING_BASE,inventory())
  self.assertEqual(len(delta['operations']),5)
  self.assertEqual(public._apply_main_operations(before,delta),repaired)
  self.assertEqual(repaired,public._reviewed_remaining_source())
  with self.assertRaisesRegex(AssertionError,'wrong public preimage'):
   public._g119_remaining_bytes(before+b'\n')
  changed=copy.deepcopy(delta);op=changed['operations'][-1];original=op['after'];op['after']+='\n'
  changed['after_sha256']=hashlib.sha256(repaired.replace(original.encode(),op['after'].encode(),1)).hexdigest()
  with patch.object(public,'_main_delta',side_effect=lambda name:changed if name=='g119-main-reviewed-delta.json' else load(name)):
   with self.assertRaisesRegex(AssertionError,'Reviewed G119 source differs outside'):
    public.expected_main_bytes((2,8,119))
 def test_g119_held_witness_preserves_g69_and_rejects_widened_scope_or_hashes(self):
  delta=public._held_channel_delta()
  self.assertEqual(len(public.HELD_CHANNEL_PATHS),5)
  self.assertIn(public.REVIEWED_HELD_CHANNEL_BASE,inventory())
  for relative in sorted(public.HELD_CHANNEL_PATHS):
   with self.subTest(path=relative):
    original=public.public_bytes(relative);repaired=public.reviewed_held_bytes(relative)
    self.assertNotEqual(original,repaired)
    self.assertEqual(hashlib.sha256(original).hexdigest(),public.witness()['files'][relative])
    self.assertEqual((ROOT/relative).read_bytes(),repaired)
    public.assert_public_bytes(self,ROOT/relative)
    with patch.object(Path,'read_bytes',return_value=repaired+b'\n'):
     with self.assertRaisesRegex(AssertionError,'outside reviewed scope'):
      public.assert_public_bytes(self,ROOT/relative)
  relative=sorted(public.HELD_CHANNEL_PATHS)[0]
  wrong=copy.deepcopy(delta);wrong['changes'][relative]['before_sha256']='0'*64
  with patch.object(public,'_held_channel_delta',return_value=wrong):
   with self.assertRaisesRegex(AssertionError,'wrong public preimage'):public.reviewed_held_bytes(relative)
  wrong=copy.deepcopy(delta);wrong['changes'][relative]['after_sha256']=hashlib.sha256(public.reviewed_held_bytes(relative)+b'\n').hexdigest()
  with patch.object(public,'_held_channel_delta',return_value=wrong):
   with self.assertRaisesRegex(AssertionError,'source bytes mismatch'):public.reviewed_held_bytes(relative)
  wrong=copy.deepcopy(delta);wrong['changes'][public.MAIN_PATH]=wrong['changes'][relative]
  with patch.object(public,'_held_channel_delta',return_value=wrong):
   with self.assertRaisesRegex(AssertionError,'scope changed'):public.reviewed_held_bytes(relative)
  with self.assertRaisesRegex(AssertionError,'outside scope'):public.reviewed_held_bytes(public.MAIN_PATH)
 def test_g122_cuisine_preserves_released_g121_and_exact_unmerged_candidate(self):
  load=public._main_delta;delta=load('g121-main-reviewed-delta.json')
  before=public.expected_main_bytes((2,8,121));repaired=public.expected_main_bytes((2,8,122))
  self.assertEqual(before,public.expected_main_bytes((2,8,120)))
  self.assertEqual(before,public.expected_main_bytes((2,8,119)))
  self.assertEqual(delta['previous_public_commit'],public.REVIEWED_REMAINING_BASE)
  self.assertEqual(delta['reviewed_commit'],public.CUISINE_CANDIDATE_BASE)
  self.assertIn(public.CUISINE_CANDIDATE_BASE,inventory())
  self.assertIn(public.REVIEWED_CUISINE_BASE,inventory())
  self.assertEqual(len(delta['operations']),7)
  self.assertEqual(public._apply_main_operations(before,delta),repaired)
  self.assertEqual(repaired,public._cuisine_candidate_source())
  self.assertEqual(repaired,public._reviewed_cuisine_source())
  with self.assertRaisesRegex(AssertionError,'wrong public preimage'):
   public._g122_cuisine_bytes(before+b'\n')
  # A matching edited hash cannot admit an eighth change to native-use logic.
  changed=copy.deepcopy(delta);op=changed['operations'][-1];original=op['after'];op['after']+='\n'
  changed['after_sha256']=hashlib.sha256(repaired.replace(original.encode(),op['after'].encode(),1)).hexdigest()
  with patch.object(public,'_main_delta',side_effect=lambda name:changed if name=='g121-main-reviewed-delta.json' else load(name)):
   with self.assertRaisesRegex(AssertionError,'Reviewed cuisine candidate differs outside'):
    public.expected_main_bytes((2,8,122))
  with patch.object(public,'_reviewed_cuisine_source',return_value=repaired+b'\n'):
   with self.assertRaisesRegex(AssertionError,'G122 public source differs'):
    public.expected_main_bytes((2,8,122))
 def test_g126_caterpillar_keeps_g125_and_rejects_unreviewed_main_changes(self):
  load=public._main_delta;delta=load('g126-main-reviewed-delta.json')
  before=public.expected_main_bytes((2,8,125));repaired=public.expected_main_bytes((2,8,126))
  self.assertEqual(delta['previous_public_commit'],public.REVIEWED_SCENE_INTERACTION_BASE)
  self.assertEqual(delta['reviewed_commit'],public.REVIEWED_CATERPILLAR_CAMERA_BASE)
  self.assertIn(public.REVIEWED_CATERPILLAR_CAMERA_BASE,inventory())
  self.assertEqual(len(delta['operations']),2)
  self.assertEqual(public._apply_main_operations(before,delta),repaired)
  self.assertEqual((ROOT/public.MAIN_PATH).read_bytes(),repaired)
  with self.assertRaisesRegex(AssertionError,'wrong public preimage'):
   public._g126_caterpillar_camera_bytes(before+b'\n')
  changed=copy.deepcopy(delta);op=changed['operations'][-1];original=op['after'];op['after']+='\n'
  changed['after_sha256']=hashlib.sha256(repaired.replace(original.encode(),op['after'].encode(),1)).hexdigest()
  with patch.object(public,'_main_delta',side_effect=lambda name:changed if name=='g126-main-reviewed-delta.json' else load(name)):
   with self.assertRaisesRegex(AssertionError,'G126 public source differs outside'):
    public.expected_main_bytes((2,8,126))
 def test_short_literal_and_full_named_base_are_audited(self):
  full='1'*40;r=self.fixture("SOURCE_BASE='"+full+"'\nx=['git','show','abcdef12:code.json']",{full:full,'abcdef12':'a'*40})
  self.assertEqual(literal_refs(r),{full,'abcdef12'});inventory(r)
 def test_missing_short_ref_fails_closed(self):
  r=self.fixture("x=['git','show',f'abcdef12:{path}']",{'1'*40:'1'*40})
  with self.assertRaisesRegex(AssertionError,'absent'):inventory(r)
 def test_listing_has_exact_lf_bytes_through_windows_text_stdout(self):
  full='1'*40;r=self.fixture("BASE='"+full+"'",{full:full})
  raw=io.BytesIO();stdout=io.TextIOWrapper(raw,encoding='utf-8',newline='\r\n')
  stdout.buffer.write(encoded_listing(r));stdout.flush()
  self.assertEqual(raw.getvalue(),full.encode()+b'\n');self.assertNotIn(b'\r',raw.getvalue())
  stdout.detach()
 def test_invalid_full_sha_fails_closed(self):
  r=self.fixture("BASE='abcdef12'",{'abcdef12':'a'*39})
  with self.assertRaises(AssertionError):inventory(r)

if __name__=='__main__':unittest.main()
