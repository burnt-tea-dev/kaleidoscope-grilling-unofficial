"""Immersion audio and truthful shared-guide regressions; client gate is separate."""
from pathlib import Path
import hashlib,json,subprocess,sys
from verify_a2827 import main as baseline
from verification_session import run_checked_once, session_active
ROOT=Path(__file__).resolve().parents[2]
RP=ROOT/'projects/grilling/gameplay_core/resource_pack'

def verify_host_reference(catalog,version):
    if tuple(version)>=(2,8,72):
        reference='cookery-162-reference.json' if tuple(version)>=(2,8,154) else 'cookery-161-reference.json' if tuple(version)>=(2,8,150) else 'cookery-160-reference.json'
        ref=json.loads((ROOT/'tools/fixtures'/reference).read_text())
        assert all(catalog['host_reference'][key]==value for key,value in ref.items()), 'Guide host differs from reviewed Cookery reference'
    else:
        assert catalog['host_reference']['version']=='1.0.8'
        assert catalog['host_reference']['guide_sha256']=='49ea47f9dc7511af210562118c7d2164ab5e185296a5a8c8d678e7d7ff8dc959'

def verify_sound_registry(defs,proof,version):
    expected_names={'kg_imm.'+name for name in proof['sound_events']}|{'kg_imm.four_skewer_eat_ch'+str(i) for i in range(8)}
    if tuple(version)>=(2,8,73):
        expected_names|={'kg_java21.'+name for name in ('shield','chime','golden','ordinary_break','ordinary_impact','heavy_metal')}
    if tuple(version)>=(2,8,85):
        sys.path.insert(0,str(ROOT/'tools'))
        from build_projectile_dodge_audio import event_definitions
        fixture=json.loads((ROOT/'development/gameplay_core/fixtures/java-projectile-dodge-audio-160.json').read_text())
        aliases=event_definitions(fixture)
        assert set(aliases)=={'kg_java21.teleport','kg_java21.teleport_neutral','kg_java21.teleport_hostile','kg_cookery.flatulence'}, 'Unreviewed G85 alias identity'
        expected_names|=set(aliases)
        for name,value in aliases.items():
            assert defs.get(name)==value, 'Reviewed G85 sound definition differs: '+name
    if tuple(version)>=(2,8,110):
        name='kg_java21.seasoning_finished'
        original=proof['sound_events']['action_success']['sounds']
        sounds=[]
        for sample in original:
            sample={'name':sample} if isinstance(sample,str) else dict(sample)
            sample['name']='sounds/kg_imm/'+sample['name'].split(':',1)[-1]
            sounds.append(sample)
        assert defs.get(name)=={'category':'player','sounds':sounds,'max_distance':16}, 'Reviewed pending finish alias differs'
        expected_names.add(name)
    assert set(defs)==expected_names, 'Missing or unreviewed sound event'

def main():
    baseline()
    subprocess.run(['node','--test','development/gameplay_core/test_immersion_audio.mjs','development/gameplay_core/test_localized_heat_lore.mjs','development/gameplay_core/test_pending_audio.mjs','development/gameplay_core/test_full_skewer_flow.mjs'],cwd=ROOT,check=True)
    if session_active():
        run_checked_once(['node','--experimental-vm-modules',str(ROOT/'development/gameplay_core/test_hot_food_manual_merge.mjs')],cwd=ROOT)
    else:
        subprocess.run(['node','--experimental-vm-modules','development/gameplay_core/test_hot_food_manual_merge.mjs'],cwd=ROOT,check=True)
    proof=json.loads((ROOT/'development/gameplay_core/fixtures/released-audio-1.1.1.json').read_text())
    assert len(proof['assets'])==17 and len(proof['sound_events'])==13
    assert proof['audio_transformations'] is False and proof['client_acceptance'] is False
    for row in proof['assets']:
        assert hashlib.sha256((ROOT/row['target']).read_bytes()).hexdigest()==row['sha256'],row['target']
    defs=json.loads((RP/'sounds/sound_definitions.json').read_text())['sound_definitions']
    verify_sound_registry(defs,proof,json.loads((ROOT/'baseline.json').read_text())['version'])
    for i in range(8):
        assert defs['kg_imm.four_skewer_eat_ch'+str(i)]==defs['kg_imm.four_skewer_eat'], 'Historical eating channel changed'
    for event,row in proof['sound_events'].items():
        expected=[]
        for sound in row['sounds']:
            sound={'name':sound} if isinstance(sound,str) else dict(sound)
            sound['name']='sounds/kg_imm/'+sound['name'].split(':',1)[-1]
            expected.append(sound)
        assert defs['kg_imm.'+event]['sounds']==expected,event
    catalog=json.loads((ROOT/'projects/grilling/guide/catalog.a3.json').read_text())
    verify_host_reference(catalog,json.loads((ROOT/'baseline.json').read_text())['version'])
    assert len(catalog['categories'])<=32
    if catalog.get('host_extension'):
        assert catalog['acquisition_gaps']==[] and catalog['host_extension']['capability']=='chopping_board_v2'
    else:
        assert {r['item'] for r in catalog['acquisition_gaps']}=={'kaleidoscope_grilling:beef_chunks','kaleidoscope_grilling:chicken_skin'}
    quick=next(e for e in catalog['entries'] if e['id']=='kg_a1:guide_quick_start')
    for locale in catalog['locales']:
        assert len(quick['body'][locale])==8
        assert '1.25' in '\n'.join(quick['body'][locale])
        assert 'Hold a stick or unfinished skewer' not in json.dumps(catalog,ensure_ascii=False)
        language=(RP/'texts'/f'{locale}.lang').read_text()
        assert language.count('tooltip.kaleidoscope_grilling.smoky_warmth=')==1
    subprocess.run([sys.executable,'tools/build_grilling_guide.py','--check'],cwd=ROOT,check=True)
    print('A2.8.28 original audio, scoped lifecycle and shared-guide regressions PASS; no client acceptance implied')
if __name__=='__main__':main()
