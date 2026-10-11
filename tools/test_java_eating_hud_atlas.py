"""Offline exact-pixel and generated-control gates; not a client rendering test."""
import ast,copy,hashlib,io,json,struct,unittest,zlib
from pathlib import Path
from PIL import Image
from java_eating_hud_atlas import ATLAS_REL,SOURCE_PINS,build_progress_atlas,atlas_metadata
ROOT=Path(__file__).resolve().parents[1]
RP=ROOT/'projects/grilling/gameplay_core/resource_pack'
class AtlasTests(unittest.TestCase):
 def setUp(self):
  self.src={c:(RP/f'textures/ui/kg_java/skewer_eating_progress_{c}.png').read_bytes() for c in SOURCE_PINS}
  self.png=(RP/ATLAS_REL).read_bytes();self.atlas=Image.open(io.BytesIO(self.png)).convert('RGBA')
  self.ui=json.loads((RP/'ui/hud_screen.json').read_text());self.controls={k:v for row in self.ui['kg_eating_packet']['controls'] for k,v in row.items()}
 def test_pinned_sources_and_dimensions(self):
  for c,b in self.src.items():
   self.assertEqual(hashlib.sha256(b).hexdigest(),SOURCE_PINS[c]);im=Image.open(io.BytesIO(b));self.assertEqual(im.mode,'RGBA');self.assertEqual(im.size,(102,5))
  self.assertEqual(self.atlas.size,(204,5))
 def test_rebuild_is_byte_exact(self):
  self.assertEqual(build_progress_atlas(self.src['yellow'],self.src['green']),self.png)
  self.assertEqual(build_progress_atlas(self.src['yellow'],self.src['green']),self.png)
 def test_full_halves_preserve_all_rgba_including_transparency(self):
  for color,x in [('yellow',0),('green',102)]:
   im=Image.open(io.BytesIO(self.src[color])).convert('RGBA');crop=self.atlas.crop((x,0,x+102,5));self.assertEqual(crop.tobytes(),im.tobytes());self.assertEqual(crop.getchannel('A').tobytes(),im.getchannel('A').tobytes())
 def test_every_fill_width_crop_is_identical(self):
  for ready,color,x in [(0,'yellow',0),(1,'green',102)]:
   original=Image.open(io.BytesIO(self.src[color])).convert('RGBA')
   for width in range(1,103):
    q=self.controls[f'fill_{ready}_{width}'];u,v=q['uv'];self.assertEqual(q['uv_size'],[width,5]);self.assertEqual(self.atlas.crop((u,v,u+width,v+5)).tobytes(),original.crop((0,0,width,5)).tobytes(),(ready,width))
 def test_all_204_controls_share_image_and_integer_uv(self):
  fills={k:v for k,v in self.controls.items() if k.startswith('fill_')};self.assertEqual(len(fills),204)
  for ready in [0,1]:
   for width in range(1,103):
    c=fills[f'fill_{ready}_{width}'];self.assertEqual(c['texture'],ATLAS_REL.removesuffix('.png'));self.assertEqual(c['uv'],[102*ready,0]);self.assertEqual(c['size'],[width,5]);self.assertIs(c['bilinear'],False)
    code=lambda n:''.join('§'+x for x in f'{n:02x}');fragment='§r§0§r§0'+code(width)+code(ready);self.assertEqual(c['visible'],f"(not (($kg_text - '{fragment}') = $kg_text))")
  self.assertNotIn('fill_0_0',fills);self.assertNotIn('fill_1_0',fills)
 def test_actual_generator_fill_loop_matches_committed_controls(self):
  tree=ast.parse((ROOT/'tools/build_java_eating_hud.py').read_text());main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main');loop=[n for n in main.body if isinstance(n,ast.For) and isinstance(n.target,ast.Name) and n.target.id=='ready'];self.assertEqual(len(loop),1)
  defs=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['code','contains']]
  ns={'controls':[],'base':copy.deepcopy(self.controls['base']),'PREFIX':'§r§0§r§0','ATLAS_REL':ATLAS_REL};module=ast.Module(body=defs+loop,type_ignores=[]);exec(compile(ast.fix_missing_locations(module),'<actual generator fill loop>','exec'),ns)
  self.assertEqual(ns['controls'],[r for r in self.ui['kg_eating_packet']['controls'] if next(iter(r)).startswith('fill_')])
 def test_complete_generator_ui_bytes_match_committed(self):
  tree=ast.parse((ROOT/'tools/build_java_eating_hud.py').read_text());main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
  start=next(i for i,n in enumerate(main.body) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='controls' for t in n.targets))
  end=next(i for i,n in enumerate(main.body) if isinstance(n,ast.For) and isinstance(n.target,ast.Name) and n.target.id=='key')
  defs=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['code','contains']]
  source=(ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_hud_data.js').read_text();index=json.loads(source.split('Object.freeze(',1)[1].split(');',1)[0])
  ns={'PREFIX':'§r§0§r§0','ATLAS_REL':ATLAS_REL,'icon_index':index};exec(compile(ast.fix_missing_locations(ast.Module(body=defs+main.body[start:end+1],type_ignores=[])),'<actual UI constructor>','exec'),ns)
  self.assertEqual((json.dumps(ns['ui'],ensure_ascii=False,indent=2)+'\n').encode(),(RP/'ui/hud_screen.json').read_bytes())
 def test_generator_fixture_shape_and_order_match_committed(self):
  # Metadata-shape test only: use the already declared JAR digest, never a fake archive/hash bypass.
  tree=ast.parse((ROOT/'tools/build_java_eating_hud.py').read_text());fixtures=[n for n in ast.walk(tree) if isinstance(n,ast.Dict) and any(isinstance(k,ast.Constant) and k.value=='jar_sha256' for k in n.keys)];self.assertEqual(len(fixtures),1)
  fixture_path=ROOT/'development/gameplay_core/fixtures/java-hud-1.1.1.json';f=json.loads(fixture_path.read_text());expr=copy.deepcopy(fixtures[0])
  idx=next(i for i,k in enumerate(expr.keys) if isinstance(k,ast.Constant) and k.value=='jar_sha256');expr.values[idx]=ast.Constant(f['jar_sha256'])
  actual=eval(compile(ast.fix_missing_locations(ast.Expression(expr)),'<fixture shape with existing declared JAR digest>','eval'),{'assets':f['assets'],'derived_assets':{ATLAS_REL:atlas_metadata(self.png)}})
  self.assertEqual((json.dumps(actual,indent=2)+'\n').encode(),fixture_path.read_bytes())
 def test_derived_fixture_does_not_relabel_original_assets(self):
  f=json.loads((ROOT/'development/gameplay_core/fixtures/java-hud-1.1.1.json').read_text());self.assertNotIn(ATLAS_REL,f['assets']);self.assertEqual(f['derived_assets'],{ATLAS_REL:atlas_metadata(self.png)})
  for color,h in SOURCE_PINS.items():self.assertEqual(f['assets'][f'textures/ui/kg_java/skewer_eating_progress_{color}.png']['sha256'],h)
 def test_original_lifecycle_and_control_count(self):
  self.assertEqual(len(self.controls),405);self.assertEqual(self.ui['kg_eating_hold']['duration'],.1);self.assertEqual(self.ui['kg_eating_start']['from'],0);self.assertEqual(self.ui['kg_eating_start']['to'],1);self.assertEqual(self.ui['kg_eating_expire']['duration'],.001);self.assertEqual(self.ui['kg_eating_expire']['destroy_at_end'],'kg_eating_packet')
 def test_bad_source_rejected(self):
  with self.assertRaises(ValueError):build_progress_atlas(self.src['yellow']+b'x',self.src['green'])
  with self.assertRaises(ValueError):build_progress_atlas(self.src['green'],self.src['yellow'])
 def test_png_chunks_and_crc_have_no_color_profile_change(self):
  p=8;names=[]
  while p<len(self.png):
   n=struct.unpack('>I',self.png[p:p+4])[0];kind=self.png[p+4:p+8];data=self.png[p+8:p+8+n];crc=struct.unpack('>I',self.png[p+8+n:p+12+n])[0];self.assertEqual(crc,zlib.crc32(kind+data)&0xffffffff);names.append(kind);p+=n+12
  self.assertEqual(names,[b'IHDR',b'IDAT',b'IEND']);self.assertEqual(p,len(self.png))
if __name__=='__main__':unittest.main()
