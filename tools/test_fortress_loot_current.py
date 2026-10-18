"""Current fortress acquisition contract, independent of old release manifest versions."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT / 'projects/grilling/gameplay_core/behavior_pack'
VANILLA = 'loot_tables/kaleidoscope_grilling/vanilla/chests/nether_bridge.json'
BONUS = 'loot_tables/kaleidoscope_grilling/fortress_houttuynia_bonus.json'


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


class FortressLoot(unittest.TestCase):
    def test_vanilla_exact_official_blob_preserves_all_pools(self):
        # Mojang/bedrock-samples@46ba6ea985fb5a92d79a9419198f10dda14c199d
        # behavior_pack/loot_tables/chests/nether_bridge.json; includes armor trim.
        raw = (BP / VANILLA).read_bytes()
        digest = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        self.assertEqual(digest, '071c1feeaccec0f2e9ee39074d76c5862681aa3c')

    def test_wrapper_runs_vanilla_once_and_bonus_independently(self):
        # No condition, changed weight, competing entry, or recursive self-reference
        # can suppress the original table or grant the bonus more than once.
        self.assertEqual(load(BP / 'loot_tables/chests/nether_bridge.json'), {
            'pools': [{'rolls': 1, 'entries': [{'type': 'loot_table', 'name': name}]}
                      for name in (VANILLA, BONUS)]})

    def test_bonus_matches_java_and_yields_plantable_species(self):
        self.assertEqual(load(BP / BONUS), {'pools': [{
            'rolls': {'min': 1, 'max': 2},
            'conditions': [{'condition': 'random_chance', 'chance': 0.65}],
            'entries': [{'type': 'item', 'name': 'kaleidoscope_grilling:houttuynia',
                         'weight': 1, 'functions': [{'function': 'set_count',
                         'count': {'min': 1, 'max': 3}}]}]}]})
        item = load(BP / 'items/houttuynia.json')['minecraft:item']
        self.assertEqual(item['description']['identifier'], 'kaleidoscope_grilling:houttuynia')
        placer = item['components']['minecraft:block_placer']
        self.assertEqual(placer['block'], 'kaleidoscope_grilling:houttuynia_crop')
        self.assertEqual(set(placer['use_on']), {'minecraft:farmland', 'minecraft:soul_sand'})
        crop = load(BP / 'blocks/houttuynia_crop.json')['minecraft:block']
        self.assertEqual(crop['description']['identifier'], placer['block'])


if __name__ == '__main__':
    unittest.main()
