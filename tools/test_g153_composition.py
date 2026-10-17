"""Retain both reviewed repair branches without replacing either history."""
import json
from pathlib import Path
import subprocess
import unittest
from g153_repair_source import PATHS
ROOT=Path(__file__).resolve().parents[1]
BASE='aa091a1e91035d1510b579af11254a9bc9f86e6b'
REMOTE='5bc8f43f45a6cd0d287b5557db24e2da4dd2c207'
def source(path,rev=REMOTE):
    return subprocess.check_output(['git','show',rev+':'+path],cwd=ROOT)
class Composition(unittest.TestCase):
    def test_remote_only_runtime_repairs_retained(self):
        changed=subprocess.check_output(['git','diff','--name-only',BASE,REMOTE],cwd=ROOT,text=True).splitlines()
        retained=[p for p in changed if '/gameplay_core/behavior_pack/' in p or '/gameplay_core/resource_pack/' in p]
        self.assertGreater(len(retained),50)
        for path in retained:
            if path not in PATHS:
                self.assertEqual((ROOT/path).read_bytes(),source(path),path)
    def test_remote_history_and_ledgers_are_immutable(self):
        for path in ('tools/fixtures/g151-skewer-content-reviewed-delta.json','tools/fixtures/g152-guide-recipe-reviewed-delta.json','docs/RELEASE-NOTES-A2.8.151.md','docs/RELEASE-NOTES-A2.8.152.md'):
            self.assertEqual((ROOT/path).read_bytes(),source(path),path)
        history=json.loads((ROOT/'release-history.json').read_text())
        preceding=json.loads(source('release-history.json'))
        self.assertEqual({k:history[k] for k in preceding},preceding)
        self.assertLessEqual(set(history)-set(preceding),{'2.8.153'})
    def test_both_guide_branches_and_fresh_transfer_identity(self):
        path='projects/grilling/guide/catalog.a3.json'
        old=json.loads(source(path));new=json.loads((ROOT/path).read_text())
        entries={x['id']:x for x in new['entries']}
        for entry in old['entries']:
            if entry['id'] in {'kaleidoscope_grilling:beef_chunks','kaleidoscope_grilling:chicken_skin','kg_a1:guide_recipe_beef','kg_a1:guide_recipe_chicken_skin'}:
                self.assertEqual(entries[entry['id']],entry)
        self.assertEqual(new['version'],'0.3.64')
        self.assertEqual(new['revision'],'kg-guide-a3-28153')
        self.assertEqual(len(new['entries']),77)
        self.assertIn(new['revision'],(ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/guide/publisher.js').read_text())
    def test_paired_candidate_packaging_identity(self):
        for path in ('config.json','projects/grilling/gameplay_core/config.json'):
            text=(ROOT/path).read_text()
            self.assertIn('Kaleidoscope_Grilling_2_8_153_Canonical',text)
            self.assertIn('Kaleidoscope Grilling 2.8.153 Canonical Baseline',text)
            self.assertNotIn('2_8_152',text)
        self.assertEqual(json.loads((ROOT/'baseline.json').read_text())['version'],[2,8,153])
        for pack in ('behavior_pack','resource_pack'):
            data=json.loads((ROOT/'projects/grilling/gameplay_core'/pack/'manifest.json').read_text())
            self.assertEqual(data['header']['version'],[2,8,153])
            self.assertTrue(all(x['version']==[2,8,153] for x in data['modules']))
    def test_main_keeps_skewer_and_oil_routes(self):
        text=(ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/main.js').read_text()
        for anchor in ('for(const row of nextRows)restoreIngredient(row);','completedEatingStillCurrent(a.use,e.itemStack','function secretEatingData(stack)','String(expectedSize(clean))','beginOilBrushVisual(player,hand,oil.type)','syncOilBrushVisual(p,{idle:false});'):
            self.assertIn(anchor,text)
if __name__=='__main__':unittest.main()
