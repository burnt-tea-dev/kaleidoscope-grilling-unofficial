"""Grill storage-derived display; rendering acceptance requires a real client."""
from pathlib import Path
import json,subprocess,sys
from verify_a2828 import main as baseline
ROOT=Path(__file__).resolve().parents[2]
def main():
    baseline()
    subprocess.run(['node','--test','development/gameplay_core/test_grill_visual.mjs','development/gameplay_core/test_grill_initial_orientation.mjs'],cwd=ROOT,check=True)
    subprocess.run([sys.executable,'tools/build_grill_display.py','--check'],cwd=ROOT,check=True)
    p=ROOT/'projects/grilling/gameplay_core'
    entity=json.loads((p/'behavior_pack/entities/grill_food_visual.json').read_text())['minecraft:entity']
    assert 'minecraft:transient' in entity['components'] and 'minecraft:inventory' not in entity['components']
    assert all(v['client_sync'] for v in entity['description']['properties'].values())
    # The generator check above verifies every current display output, including
    # the four Cookery 1.6.1 foods. Keep the old cardinality oracle on its exact
    # G150 source only after validating the complete sealed current postimage.
    from skewer_content_source import historical_bytes
    client=json.loads(historical_bytes(p/'resource_pack/entity/grill_food_visual.entity.json'))['minecraft:client_entity']['description']
    version=tuple(json.loads((p/'behavior_pack/manifest.json').read_text())['header']['version'])
    if version>=(2,8,68):assert (len(client['textures']),len(client['geometry']))==(1613,199)
    else:assert len(client['textures'])==len(client['geometry'])==115
    geo=json.loads((p/'resource_pack/models/entity/grill_display.geo.json').read_text())['minecraft:geometry']
    expected_geometries=104 if version>=(2,8,68) else 20
    assert len(geo)==expected_geometries
    assert not any('binding' in b for g in geo for b in g['bones'])
    assert len({g['description']['identifier'] for g in geo})==expected_geometries
    runtime=(p/'behavior_pack/scripts/grill_visual_runtime.js').read_text()
    assert 'peekStationContainer(block)' in runtime and 'stationContainer(block)' not in runtime
    assert 'setItem(' not in runtime and 'setDynamicProperty(' not in runtime
    assert 'tickGrill(e.block);tickGrillDisplay(e.block)' in (p/'behavior_pack/scripts/main.js').read_text()
    print('A2.8.29 grill slots/stages/flip source PASS; client and full saved-world migration remain separate')
if __name__=='__main__':main()
