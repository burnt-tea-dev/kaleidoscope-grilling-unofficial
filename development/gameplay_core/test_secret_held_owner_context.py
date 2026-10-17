"""Pinned public mesh and owner dispatch guards, separate from engine acceptance."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
BP = ROOT / 'projects/grilling/gameplay_core/behavior_pack'
sys.path.insert(0, str(ROOT / 'tools'))
from public_source_witness import assert_public_bytes, public_json
from secret_skewer_assets import held_geometries, partial_geometries, slot_cubes, shaft_cubes
from held_visual_channels import WORD_A_MAX, WORD_B_MAX
from test_eating_observer_projection import node
from eating_owner_context import document
from eating_owner_properties import predecessor_document
from skewer_content_source import historical_bytes


def load(path):
    return json.loads(path.read_text())


class SecretHeldOwnerContextTests(unittest.TestCase):
    def test_exact_nine_source_volumes_and_shaft_are_preserved(self):
        path = RP / 'models/entity/secret_held.geo.json'
        assert_public_bytes(self, path)
        doc = load(path)
        geometries = held_geometries()
        helper_variants = [geo for geo in geometries if geo['description']['identifier'].startswith('geometry.kg_secret_held.piece_')]
        primary = [geo for geo in geometries if geo not in helper_variants]
        self.assertEqual(doc, {'format_version': '1.21.0', 'minecraft:geometry': primary + partial_geometries()})
        helper_path = RP / 'models/entity/secret_helper_sprites.geo.json'
        assert_public_bytes(self, helper_path)
        self.assertEqual(load(helper_path), {'format_version': '1.21.0', 'minecraft:geometry': helper_variants})
        self.assertEqual(len(helper_variants), 169)
        self.assertEqual([[len(slot_cubes(slot, shape)) for slot in range(3)] for shape in range(1, 4)],
                         [[12, 18, 18], [18, 18, 18], [12, 24, 26]])
        self.assertEqual(shaft_cubes(True)[0]['size'], [.5, .5, 12.5])
        self.assertEqual(len(doc['minecraft:geometry']), 107)

    def test_owner_properties_decode_locally_and_player_count_does_not_expand(self):
        player = BP / 'entities/player.json'
        assert_public_bytes(self, player)
        props = load(player)['minecraft:entity']['description']['properties']
        self.assertEqual(len(props), 32)
        for name in ('secret_skewer', 'secret_skewer_java_three_alt'):
            description = load(RP / f'attachables/{name}.attachable.json')['minecraft:attachable']['description']
            reads = [row for row in description['scripts']['pre_animation'] if row.startswith('v.kg_secret_')]
            self.assertEqual(reads[0], "v.kg_secret_off_hand = c.item_slot == 'off_hand';")
            self.assertEqual(len(reads), 34)
            for i in range(3):
                statement = next(row for row in reads if row.startswith(f'v.kg_secret_ingredient_{i} = '))
                self.assertIn('c.owning_entity->q.has_property', statement)
                self.assertIn(', 0, 5337)', statement)
                for hand in ('main', 'off'):
                    self.assertEqual(props[f'kaleidoscope_grilling:secret_{hand}_{i}']['range'], [0, (WORD_A_MAX, WORD_B_MAX, 5337)[i]])
            for hand in ('main', 'off'):
                self.assertEqual(props[f'kaleidoscope_grilling:secret_{hand}_piece']['range'], [0, 255])

    def test_passes_are_owned_and_slots_choose_real_shapes_and_palette_stages(self):
        path = RP / 'render_controllers/secret_held.render_controllers.json'
        assert_public_bytes(self, path)
        controllers = load(path)['render_controllers']
        self.assertNotIn('q.property', json.dumps(controllers))
        self.assertNotIn('c.item_slot', json.dumps(controllers))
        for i in range(3):
            row = controllers[f'controller.render.kg_secret_held.{i}']
            self.assertEqual(row['geometry'], f'Array.states[v.kg_secret_food_{i} == 0 ? 0 : v.kg_secret_state]')
            self.assertEqual(len(row['arrays']['geometries']['Array.states']), 64)
            self.assertEqual(len(row['arrays']['textures']['Array.food']), 218 * 7)
            self.assertEqual(row['part_visibility'], [{'*': 0}, {'skewer_model': f'v.kg_secret_owner_occupied == 1 && v.kg_bite_stage < {3-i}'}])
        self.assertEqual(controllers['controller.render.kg_secret_held.piece']['textures'], ['Array.food[v.kg_secret_piece_index]'])

    def test_owned_attachables_and_current_generator_conserve_public_repaired_source(self):
        # Public PR134 already contains idle, owned dispatch and terminal repairs.
        # Its exact bytes are the witness; inaccessible private-before objects
        # are not reconstructed or used as evidence of an earlier delta.
        for name in ('secret_skewer', 'secret_skewer_java_three_alt', 'unfinished_skewer'):
            path = RP / f'attachables/{name}.attachable.json'
            assert_public_bytes(self, path)
            actual = predecessor_document(json.loads(historical_bytes(path)))['minecraft:attachable']['description']
            source = document(public_json(path),attachable=True)['minecraft:attachable']['description']
            self.assertEqual(actual['animations'], source['animations'])
            self.assertEqual(actual['scripts']['animate'], source['scripts']['animate'])
            self.assertEqual(actual['textures']['stick'], 'textures/secret_skewer_stick')
        # --check compares every generated output byte without writing files.
        subprocess.run([sys.executable, str(ROOT / 'tools/build_secret_held.py'), '--check'], cwd=ROOT, check=True)

    def test_actual_owner_queries_isolate_both_hands_identity_and_terminal_mask(self):
        descriptions = [load(RP / f'attachables/{name}.attachable.json')['minecraft:attachable']['description']
                        for name in ('secret_skewer', 'secret_skewer_java_three_alt', 'unfinished_skewer')]
        node('const descriptions = ' + json.dumps(descriptions) + r''';
const props = {
 'kaleidoscope_grilling:secret_main_0': 174,
 'kaleidoscope_grilling:secret_main_1': 436,
 'kaleidoscope_grilling:secret_main_2': 5304,
 'kaleidoscope_grilling:secret_main_piece': 176,
 'kaleidoscope_grilling:secret_off_0': -7,
 'kaleidoscope_grilling:secret_off_1': 218,
 'kaleidoscope_grilling:secret_off_2': 180.9,
 'kaleidoscope_grilling:secret_off_piece': 999,
};
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const scenarios = [props, {...props,
 'kaleidoscope_grilling:secret_main_0': 9999.5,
 'kaleidoscope_grilling:secret_main_piece': -9,
 'kaleidoscope_grilling:secret_off_2': 5337.9,
}];
for (const d of descriptions) for (const hand of ['main', 'off']) for (const values of scenarios)
for (const ownerPresent of [false, true]) for (const exactItem of [false, true])
for (const selectedWeapon of ['slot.weapon.mainhand', 'slot.weapon.offhand'])
for (const terminalWait of [0, 1]) for (const empty of [false, true]) {
 const weapon = hand === 'main' ? 'slot.weapon.mainhand' : 'slot.weapon.offhand';
 // Execute the actual decoding/identity rows independently of the terminal
 // clock: the retained terminal gate is an explicit input to this owner guard.
 const rows = d.scripts.pre_animation.filter(row => row.startsWith('v.kg_secret_') &&
  !row.startsWith('v.kg_secret_terminal_') && !row.startsWith('v.kg_secret_piece_visible = '));
 const owner = {has_property: name => Object.hasOwn(values, name), property: name => empty ? 0 : values[name],
  is_item_name_any: (slot, ...ids) => slot === selectedWeapon && ids.includes(exactItem ? d.identifier : 'minecraft:apple')};
 const c = {item_slot: hand + '_hand', ...(ownerPresent ? {owning_entity: owner} : {})};
 // Conflicting attachable-local queries must never supply owner values.
 const q = {property: () => 99, has_property: () => true, is_item_name_any: () => true};
 const v = {kg_secret_terminal_wait: terminalWait};
 evaluatePreAnimation(rows, q, c, {clamp, max: Math.max}, v);
 const expected = [0, 1, 2].map(i => Math.floor(clamp(ownerPresent && !empty ? values['kaleidoscope_grilling:secret_' + hand + '_' + i] : 0, 0, 5337)));
 for (let i = 0; i < 3; i++) {
  if (v['kg_secret_ingredient_' + i] !== expected[i]) throw Error('Owner ingredient query borrowed another context');
  const food = expected[i] % 256;
  if (v['kg_secret_food_' + i] !== (food <= 217 ? food : 0)) throw Error('Invalid catalog byte borrowed food');
  if (v['kg_secret_shape_' + i] !== Math.floor(expected[i] / 256) % 3 + 1) throw Error('Wrong owner shape');
  if (v['kg_secret_style_' + i] !== Math.floor(expected[i] / 768)) throw Error('Wrong owner stage');
 }
 const complete = !d.identifier.endsWith(':unfinished_skewer');
 const marker = ownerPresent && !empty ? values['kaleidoscope_grilling:secret_' + hand + '_piece'] : 0;
 const occupied = ownerPresent && exactItem && selectedWeapon === weapon &&
  ((marker >= 0 && marker <= 213) || (marker >= 221 && marker <= 224)) &&
  (!complete || (expected.some(value => value > 0) && terminalWait === 0));
 if (Boolean(v.kg_secret_owner_occupied) !== occupied) throw Error('Owner identity/hand/empty/terminal guard escaped');
 if (complete) {
  const expectedPiece = Math.floor(marker >= 221 && marker <= 224 ? marker - 7 : marker >= 0 && marker <= 213 ? marker : 0);
  if (v.kg_secret_piece_index !== expectedPiece) throw Error('Helper borrowed another owner hand');
  if (v.kg_secret_state !== v.kg_secret_shape_0 * 16 + v.kg_secret_shape_1 * 4 + v.kg_secret_shape_2) throw Error('Wrong owner geometry state');
 }
}
''')


if __name__ == '__main__':
    unittest.main()
