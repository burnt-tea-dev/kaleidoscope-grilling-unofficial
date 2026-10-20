#!/usr/bin/env python3
"""Read-only station resource schemas, not a runtime container or player test."""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
BP=R/'projects/grilling/gameplay_core/behavior_pack';RP=R/'projects/grilling/gameplay_core/resource_pack'
def load(p):return json.loads(p.read_text())
for block,suffix,size in [('grill','grill',3),('advanced_rack_block','rack',9),('seasoning_bottle_1','seasoning',4)]:
 b=load(BP/f'blocks/{block}.json')['minecraft:block']
 assert 'minecraft:block_entity' not in b['components']
 e=load(BP/f'entities/family_inventory_{suffix}.json')['minecraft:entity']
 assert e['description']['identifier']==f'kaleidoscope_grilling:inventory_{suffix}_v1'
 c=e['components'];assert 'minecraft:persistent' in c
 assert c['minecraft:inventory']=={'inventory_size':size,'container_type':'inventory','private':True,'restrict_to_owner':True,'can_be_siphoned_from':False}
 assert c['minecraft:damage_sensor']['triggers'][0]['deals_damage']=='no'
 assert not c['minecraft:physics']['has_gravity'] and not c['minecraft:physics']['has_collision']
 rc=load(RP/f'entity/family_inventory_{suffix}.entity.json')['minecraft:client_entity']['description']
 assert rc['identifier']==e['description']['identifier']
for p in (BP/'blocks').glob('seasoning_bottle*.json'):
 c=load(p)['minecraft:block']['components']
 assert c['minecraft:tick']=={'interval_range':[1,1],'looping':True}
 assert c['minecraft:movable']=={'movement_type':'immovable'}
print('PASS: three station inventory resource schemas, ownership declarations and bottle tick/movement declarations; runtime transactions and client behavior are not exercised.')
