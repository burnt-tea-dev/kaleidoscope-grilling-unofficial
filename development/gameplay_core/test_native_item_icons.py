"""Exact source sprites and same-ID sapling routing; no client simulation."""
import hashlib,json,unittest,base64,gzip,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];PACK=ROOT/'projects/grilling/gameplay_core';BP=PACK/'behavior_pack';RP=PACK/'resource_pack';SOURCE=Path(__file__).parent/'fixtures/java-item-icons-1.1.1'
sys.path.insert(0,str(ROOT/'tools'))
from public_source_witness import reviewed_pepper_bytes, PEPPER_PATH
from g153_repair_source import reference_bytes as repair_reference
from unittest.mock import patch
def read(p):return json.loads(p.read_text())
def dimensions(p):
 with Image.open(p) as image:return image.size
class ItemIcons(unittest.TestCase):
 def test_all_reference_bytes_are_pinned(self):
  for name,expected in read(SOURCE/'source.json')['sha256'].items():self.assertEqual(expected,hashlib.sha256((SOURCE/name).read_bytes()).hexdigest())
 def test_brush_models_are_generated_sprites(self):
  for n in ['canola_oil_brush','premium_chili_oil_brush','secret_chili_oil_brush']:
   self.assertEqual('minecraft:item/generated',read(SOURCE/(n+'.json'))['parent'])
   self.assertEqual((SOURCE/(n+'.png')).read_bytes(),(RP/'textures/items'/(n+'.png')).read_bytes())
   item=read(BP/'items'/(n+'.json'))['minecraft:item'];key=item['components']['minecraft:icon']['textures']['default']
   self.assertEqual('textures/items/'+n,read(RP/'textures/item_texture.json')['texture_data'][key]['textures'])
   self.assertEqual((16,16),dimensions(RP/'textures/items'/(n+'.png')))
   for a in (RP/'attachables').glob('*.json'):self.assertNotEqual(item['description']['identifier'],read(a)['minecraft:attachable']['description']['identifier'])
 def test_variant_brushes_are_distinct(self):
  pixels=[Image.open(RP/'textures/items'/(n+'.png')).convert('RGBA').tobytes() for n in ['canola_oil_brush','premium_chili_oil_brush','secret_chili_oil_brush']]
  self.assertEqual(3,len(set(pixels)))
 def test_sapling_native_same_id_item(self):
  item=read(BP/'items/pepper_sapling.json')['minecraft:item'];block=read(BP/'blocks/pepper_sapling.json')['minecraft:block']
  self.assertEqual(block['description']['identifier'],item['description']['identifier']);self.assertEqual(block['description']['menu_category'],item['description']['menu_category'])
  source=read(SOURCE/'pepper_sapling.json');self.assertEqual('minecraft:item/generated',source['parent']);self.assertEqual('kaleidoscope_grilling:block/pepper_sapling',source['textures']['layer0'])
  self.assertEqual((16,16),dimensions(RP/'textures/blocks/pepper_sapling.png'))
  for a in (RP/'attachables').glob('*.json'):self.assertNotEqual(item['description']['identifier'],read(a)['minecraft:attachable']['description']['identifier'])
  c=item['components'];self.assertEqual({'block':'kaleidoscope_grilling:pepper_sapling','replace_block_item':True},c['minecraft:block_placer']);self.assertEqual(64,c['minecraft:max_stack_size'])
  key=c['minecraft:icon']['textures']['default'];texture=read(RP/'textures/item_texture.json')['texture_data'][key]['textures']
  self.assertEqual(Image.open(SOURCE/'pepper_sapling.png').convert('RGBA').tobytes(),Image.open(RP/(texture+'.png')).convert('RGBA').tobytes())
  self.assertFalse((RP/'attachables/pepper_sapling.attachable.json').exists())
 def test_placed_sapling_and_growth_hooks_unchanged(self):
  for name,expected in read(SOURCE/'source.json')['preserved_sha256'].items():
   data=(ROOT/name).read_bytes()
   if name==PEPPER_PATH:data=repair_reference(ROOT/name,data)
   if tuple(read(BP/'manifest.json')['header']['version']) >= (2,8,60):
    reviewed=read(Path(__file__).parent/'fixtures/pepper-growth-before-2.8.60.json')['changes']
    self.assertEqual(set(reviewed),{'projects/grilling/gameplay_core/behavior_pack/scripts/a2748_pepper_tree_runtime.js'})
    if name in reviewed:
     row=reviewed[name];self.assertEqual(expected,row['before_sha256'])
     after=row['after_sha256']
     if tuple(read(BP/'manifest.json')['header']['version']) >= (2,8,67):
      current=read(Path(__file__).parent/'fixtures/pepper-growth-2.8.67.json')['changes']
      self.assertEqual(set(current),set(reviewed))
      self.assertEqual(after,current[name]['before_sha256'])
      after=current[name]['after_sha256']
     if tuple(read(BP/'manifest.json')['header']['version']) >= (2,8,68):
      contact=read(Path(__file__).parent/'fixtures/pepper-growth-2.8.68.json')['changes']
      self.assertEqual(set(contact),set(reviewed))
      self.assertEqual(after,contact[name]['before_sha256'])
      after=contact[name]['after_sha256']
     if tuple(read(BP/'manifest.json')['header']['version']) >= (2,8,118):
      repaired=reviewed_pepper_bytes(after)
      self.assertEqual(repaired,data,name)
      after=hashlib.sha256(repaired).hexdigest()
     self.assertEqual(after,hashlib.sha256(data).hexdigest(),name)
     data=gzip.decompress(base64.b64decode(row['before_gzip_base64']))
   # Inventory attribution changes only this string. Keep the original hash
   # for every geometry, growth hook and remaining block definition byte.
   if name.endswith('/blocks/pepper_sapling.json'):
    data=data.replace(b'kaleidoscope_grilling.display.block.pepper_sapling',b'tile.kaleidoscope_grilling:pepper_sapling.name')
   self.assertEqual(expected,hashlib.sha256(data).hexdigest(),name)
 def test_unreviewed_pepper_successor_cannot_gain_historical_acceptance(self):
  pepper=ROOT/PEPPER_PATH;original=pepper.read_bytes();read_bytes=Path.read_bytes
  for corrupt in (original+b'\n// unreviewed pepper mutation\n',original.replace(b'harvestedPepperCount',b'unreviewedPepperCount',1)):
   def changed(path):return corrupt if path==pepper else read_bytes(path)
   with self.subTest(corrupt=hashlib.sha256(corrupt).hexdigest()),patch.object(Path,'read_bytes',changed):
    with self.assertRaises(ValueError):self.test_placed_sapling_and_growth_hooks_unchanged()
 def test_legacy_builder_uses_specific_sources(self):
  s=(Path(__file__).parent/'build.py').read_text();self.assertIn("shutil.copyfile(specific,rp/f'textures/items/{i}.png')",s);self.assertNotIn("shutil.copyfile(brush_src,rp/f'textures/items/{i}.png')",s)
if __name__=='__main__':unittest.main()
