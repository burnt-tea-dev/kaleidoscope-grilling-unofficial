"""Pipeline extraction parity, ordering and declared-input contracts."""
from pathlib import Path
import copy,dataclasses,hashlib,importlib,json,subprocess,sys,types,unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
import eating_compiler_pipeline as pipeline
import build_eating_motion as motion
import build_offhand_eating_projection as offhand
BASE='c7c0bfb047af06a5d1c42d6e31c873dc9ca6992f'
def encoded(v):return v if isinstance(v,bytes)else v.encode()if isinstance(v,str)else(json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode()
def predecessor():
 source=subprocess.check_output(['git','show',BASE+':tools/build_eating_motion.py'],cwd=ROOT,text=True)
 module=types.ModuleType('frozen_motion');module.__file__=str(ROOT/'tools/build_eating_motion.py');exec(compile(source,module.__file__,'exec'),module.__dict__);return module,source
class PipelineTests(unittest.TestCase):
 def test_full_output_bytes_match_frozen_orchestrator_and_runtime(self):
  old,_=predecessor();before=old.build();after=motion.build();self.assertEqual(set(before),set(after))
  for p in before:self.assertEqual(encoded(before[p]),encoded(after[p]),str(p));self.assertEqual(p.read_bytes(),encoded(after[p]),str(p))
  print('Exact generated outputs:',len(after),flush=True)
 def test_flag_version_stage_traces_match_original_tail(self):
  _,source=predecessor();start=source.index(" if tuple(json.loads((BP/'manifest.json')");end=source.index('\n return output',start)+len('\n return output')
  text='def original(output,table,main_path,two_route_camera,review_three_routes,slime_frames,failure_skewers):\n'+source[start:end]+'\n'
  ns={'BP':motion.BP,'RP':motion.RP,'ROOT':ROOT,'sys':sys,'json':json};exec(text,ns)
  modules={s.name:importlib.import_module(s.module)for s in pipeline.STAGES if s.module};real=Path.read_text;partial=motion.RP/'attachables/unfinished_skewer.attachable.json'
  for version in [(2,8,57),(2,8,58),(2,8,126),(2,8,127)]:
   for flags in range(16):
    opts=[bool(flags&(1<<n))for n in range(4)]
    for effects in [False,True]:
     trace=[]
     def read(p,*a,**kw):
      if p==motion.BP/'manifest.json':return json.dumps({'header':{'version':version}})
      if p==motion.BP/'scripts/main.js':trace.append('effects_owner_read');return 'mergeEffectApplication' if effects else ''
      return real(p,*a,**kw)
     from contextlib import ExitStack
     with ExitStack()as stack:
      stack.enter_context(patch.object(Path,'read_text',read))
      for name,module in modules.items():
       if name=='effects':stack.enter_context(patch.object(module,'reapply_main',lambda v:trace.append('effects')or v))
       else:stack.enter_context(patch.object(module,'augment',lambda out,*a,n=name:trace.append(n)or out))
      supplied={partial:{},motion.BP/'scripts/main.js':'main'}
      ns['original'](dict(supplied),{},motion.BP/'scripts/main.js',*opts);expected=list(trace);trace.clear()
      pipeline.run(dict(supplied),pipeline.Context(version,{},motion.RP,motion.BP/'scripts/main.js',*opts));self.assertEqual(trace,expected,(version,flags,effects))
  print('Version/flag/effects traces:128',flush=True)
 def test_order_checkpoints_and_mutations(self):
  names=[s.name for s in pipeline.STAGES]
  self.assertEqual(names,['java_projection','secret_idle','secret_terminal','g126','g127','reviewed_three','raw_one','failure','partial_attachable','owner_context','slime','effects','ordinary_relative','offhand'])
  for bad in [pipeline.STAGES[::-1],pipeline.STAGES+(pipeline.STAGES[-1],),pipeline.STAGES[:4]+pipeline.STAGES[5:],(dataclasses.replace(pipeline.STAGES[0],gate='unowned'),)+pipeline.STAGES[1:]]:
   with self.assertRaises(ValueError):pipeline.validate_stages(bad)
  c=pipeline.Context((2,8,127),{},motion.RP,motion.BP/'scripts/main.js');trace=[]
  with patch.object(pipeline,'apply_stage',side_effect=lambda stage,out,ctx:trace.append(stage.name)or out):pipeline.run({},c,resume_after='g126')
  self.assertEqual(trace,names[4:])
  with self.assertRaises(ValueError):pipeline.run({},c,resume_after='unknown')
  with self.assertRaises(ValueError):pipeline.run({},dataclasses.replace(c,version=(2,8,58)),resume_after='g126')
 def test_offhand_supplied_documents_are_not_disk_fallbacks(self):
  supplied={ROOT/p:copy.deepcopy(v)for p,v in offhand.contract()['predecessors'].items()};supplied[offhand.MAIN]=offhand.MAIN.read_text();expected=offhand.augment(supplied)
  # Only output-document fallback reads are forbidden. The 115 pinned source
  # inputs, donor animation, helper assets and immutable contracts remain inputs.
  real_text=Path.read_text;real_bytes=Path.read_bytes
  def text(p,*a,**kw):
   if p in supplied:raise AssertionError('Eager supplied-document fallback '+str(p))
   return real_text(p,*a,**kw)
  def data(p,*a,**kw):
   if p in supplied:raise AssertionError('Eager supplied-document fallback '+str(p))
   return real_bytes(p,*a,**kw)
  with patch.object(Path,'read_text',text),patch.object(Path,'read_bytes',data):actual=offhand.augment(supplied)
  self.assertEqual({p:encoded(v)for p,v in expected.items()},{p:encoded(v)for p,v in actual.items()})
  bad=copy.deepcopy(supplied);target=next(p for p in bad if p.suffix=='.json'and 'attachables'in p.parts);bad[target]['minecraft:attachable']['description']['materials']['default']='unrelated'
  with self.assertRaises(ValueError):offhand.augment(bad)
 def test_partial_insert_preserves_supplied_document_without_read(self):
  c=pipeline.Context((2,8,127),{},motion.RP,motion.BP/'scripts/main.js');p=c.rp/'attachables/unfinished_skewer.attachable.json';doc={'sentinel':'supplied'};stage=next(s for s in pipeline.STAGES if s.name=='partial_attachable')
  with patch.object(Path,'read_text',side_effect=AssertionError('unexpected read')):self.assertIs(pipeline.apply_stage(stage,{p:doc},c)[p],doc)
 def test_partial_fallback_inserts_only_missing_existing_file(self):
  from tempfile import TemporaryDirectory
  with TemporaryDirectory()as tmp:
   rp=Path(tmp);(rp/'attachables').mkdir();p=rp/'attachables/unfinished_skewer.attachable.json'
   c=pipeline.Context((2,8,127),{},rp,rp/'main.js');stage=next(s for s in pipeline.STAGES if s.name=='partial_attachable')
   self.assertEqual(pipeline.apply_stage(stage,{},c),{})
   p.write_text('{"sentinel": "fallback"}')
   self.assertEqual(pipeline.apply_stage(stage,{},c),{p:{'sentinel':'fallback'}})
 def test_every_runtime_blob_remains_baseline(self):
  for line in subprocess.check_output(['git','ls-tree','-r',BASE,'projects/grilling/gameplay_core/behavior_pack','projects/grilling/gameplay_core/resource_pack'],cwd=ROOT,text=True).splitlines():
   meta,p=line.split('\t');data=(ROOT/p).read_bytes();self.assertEqual(hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest(),meta.split()[2],p)
if __name__=='__main__':unittest.main()
