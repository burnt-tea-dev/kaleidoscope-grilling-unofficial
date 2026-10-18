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
def current_source(path):
    """Keep the G153 assertions on an exactly admitted G154 predecessor view."""
    import g154_plate_source as plate
    data=(ROOT/path).read_bytes()
    version=json.loads((ROOT/plate.BP/'manifest.json').read_bytes())['header']['version']
    if version != plate.VERSION:
        return data
    plate.predecessor_version(version)
    if path.startswith((plate.BP+'/',plate.RP+'/')):
        return plate.historical_bytes(path,data)
    if path in ('config.json','projects/grilling/gameplay_core/config.json'):
        historical=data.replace(b'Kaleidoscope Grilling 2.8.154 Canonical Baseline',b'Kaleidoscope Grilling 2.8.153 Canonical Baseline').replace(b'Kaleidoscope_Grilling_2_8_154_Canonical',b'Kaleidoscope_Grilling_2_8_153_Canonical')
        if historical != source(path,plate.PREVIOUS):
            raise ValueError('Unreviewed G154 packaging metadata: '+path)
        return historical
    if path=='baseline.json':
        current=json.loads(data)
        if current['version']!=plate.VERSION:
            raise ValueError('Wrong G154 baseline identity')
        current['version']=plate.PREVIOUS_VERSION
        return json.dumps(current).encode()
    if path=='release-history.json':
        current=json.loads(data)
        previous=json.loads(source(path,plate.PREVIOUS))
        if {key:current.get(key) for key in previous}!=previous or set(current)-set(previous)-{'2.8.154'}:
            raise ValueError('Immutable G153 release history changed')
        return json.dumps(previous).encode()
    return data
class Composition(unittest.TestCase):
    def test_remote_only_runtime_repairs_retained(self):
        changed=subprocess.check_output(['git','diff','--name-only',BASE,REMOTE],cwd=ROOT,text=True).splitlines()
        retained=[p for p in changed if '/gameplay_core/behavior_pack/' in p or '/gameplay_core/resource_pack/' in p]
        self.assertGreater(len(retained),50)
        for path in retained:
            if path not in PATHS:
                self.assertEqual(current_source(path),source(path),path)
    def test_remote_history_and_ledgers_are_immutable(self):
        for path in ('tools/fixtures/g151-skewer-content-reviewed-delta.json','tools/fixtures/g152-guide-recipe-reviewed-delta.json','docs/RELEASE-NOTES-A2.8.151.md','docs/RELEASE-NOTES-A2.8.152.md'):
            self.assertEqual(current_source(path),source(path),path)
        history=json.loads(current_source('release-history.json'))
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
            text=current_source(path).decode()
            self.assertIn('Kaleidoscope_Grilling_2_8_153_Canonical',text)
            self.assertIn('Kaleidoscope Grilling 2.8.153 Canonical Baseline',text)
            self.assertNotIn('2_8_152',text)
        self.assertEqual(json.loads(current_source('baseline.json'))['version'],[2,8,153])
        for pack in ('behavior_pack','resource_pack'):
            data=json.loads(current_source('projects/grilling/gameplay_core/'+pack+'/manifest.json'))
            self.assertEqual(data['header']['version'],[2,8,153])
            self.assertTrue(all(x['version']==[2,8,153] for x in data['modules']))
    def test_main_keeps_skewer_and_oil_routes(self):
        text=(ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/main.js').read_text()
        for anchor in ('for(const row of nextRows)restoreIngredient(row);','completedEatingStillCurrent(a.use,e.itemStack','function secretEatingData(stack)','String(expectedSize(clean))','beginOilBrushVisual(player,hand,oil.type)','syncOilBrushVisual(p,{idle:false});'):
            self.assertIn(anchor,text)
if __name__=='__main__':unittest.main()
