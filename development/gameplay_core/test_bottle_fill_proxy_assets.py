"""Exact proxy authoring and source-derived amount sprites; not client evidence."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import unittest
from PIL import Image
import build_bottle_fill_proxies as build
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from held_visual_channels import bottle_bank_ready

class BottleFillProxyAssets(unittest.TestCase):
    def test_reviewed_bottle_guide_complete_bytes_and_rejected_mutations(self):
        import bottle_clear_guide_source_witness as guide
        for relative in guide.PATHS:
            path=guide.ROOT/relative
            current=path.read_bytes()
            self.assertEqual(guide.reference_bytes(path,current),guide.pinned_bytes(guide.PREVIOUS_BOTTLE_GUIDE_BASE,relative))
            for changed in (current+b'\n',current.replace(b'=',b':',1),current[1:]):
                if changed==current:continue
                with self.subTest(path=relative),self.assertRaises(AssertionError):
                    guide.reference_bytes(path,changed)

    def test_exact_hidden_item_and_clear_recipe_contract_for_all_16(self):
        docs=build.documents()
        self.assertEqual(len(docs),32)
        for path,expected in docs.items():
            self.assertEqual(build.load(path),expected,path)
        for kind,fill in build.STATES:
            name=build.name_for(kind,fill)
            item=build.load(build.BP/'items'/f'{name}.json')['minecraft:item']
            self.assertEqual(item['description'],{'identifier':build.NS+name,'menu_category':{'category':'none'}})
            c=item['components']
            self.assertEqual(c['minecraft:max_stack_size'],1)
            self.assertIs(c['minecraft:allow_off_hand'],True)
            self.assertEqual(c['minecraft:block_placer'],{'block':build.NS+'seasoning_bottle_1','replace_block_item':False})
            if kind=='pending':self.assertEqual(c['minecraft:use_modifiers'],{'start_using':'always','use_duration':4.0,'movement_modifier':0.35})
            else:self.assertNotIn('minecraft:use_modifiers',c)
            recipe=build.load(build.BP/'recipes'/f'clear_{name}.json')['minecraft:recipe_shapeless']
            self.assertEqual(recipe['result'],{'item':build.NS+'empty_seasoning_bottle','count':1})
            self.assertEqual(recipe['ingredients'],[{'item':build.NS+name}])

    def test_every_materialized_bottle_has_single_input_discard_recipe(self):
        # User-reported wrong-ingredient recovery: exercise the actual registered
        # IDs/recipes, not just the 16 fill proxies or a copied craft simulator.
        # This proves source coverage, not engine unlock/crafting-grid behavior.
        items = {}
        for path in (build.BP/'items').glob('*.json'):
            item = build.load(path)['minecraft:item']
            identifier = item['description']['identifier']
            if identifier.startswith(build.NS) and (
                path.stem in ('empty_seasoning_bottle', 'pending_seasoning', 'special_seasoning')
                or path.stem.startswith(('partial_seasoning_f', 'pending_seasoning_f', 'special_seasoning_r'))
            ):
                items[identifier] = item
        self.assertEqual(len(items), 83)
        inputs = []
        for path in (build.BP/'recipes').glob('clear_*seasoning*.json'):
            recipe = build.load(path)['minecraft:recipe_shapeless']
            self.assertEqual(len(recipe['ingredients']), 1, path)
            ingredient = recipe['ingredients'][0]
            self.assertEqual(set(ingredient), {'item'}, path)
            inputs.append(ingredient['item'])
            self.assertEqual(recipe['tags'], ['crafting_table'], path)
            self.assertEqual(recipe['unlock'], [ingredient], path)
            self.assertEqual(recipe['result'], {'item': build.NS+'empty_seasoning_bottle', 'count': 1}, path)
            # No refund, data-copy recipe, secondary ingredient or output.
            self.assertEqual(set(recipe), {'description', 'tags', 'ingredients', 'result', 'unlock'}, path)
        self.assertEqual(set(inputs), set(items))
        self.assertEqual(len(inputs), len(set(inputs)))
        # JSON cannot predicate on dynamic ingredient data. Keep the documented
        # base-ID self recipe so pre-proxy legacy filled EMPTY bottles can clear.
        self.assertIn(build.NS+'empty_seasoning_bottle', inputs)

    def test_source_shell_and_exact_first_fill_layers_are_retained(self):
        source=build.load(build.SOURCE)
        self.assertEqual(hashlib.sha256(build.SOURCE.read_bytes()).hexdigest(),build.SOURCE_SHA256)
        shell=[e for e in source['elements'] if not any('tintindex' in f for f in e['faces'].values())]
        self.assertEqual(len(shell),9)
        for fill in range(1,9):
            doc=build.fill_model(fill)
            expected=deepcopy(source)
            expected['elements']=[e for e in source['elements'] if not any(f.get('tintindex',-1)>=fill*2 for f in e['faces'].values())]
            self.assertEqual(doc,expected)
            self.assertEqual(len(doc['elements']),9+2*fill)
            self.assertEqual(doc['display'],source['display'])
            self.assertEqual({f['tintindex'] for e in doc['elements'] for f in e['faces'].values() if 'tintindex' in f},set(range(fill*2)))

    def test_inventory_amounts_have_unique_alpha_sprites_and_explicit_generic_palette(self):
        self.assertEqual(build.GENERIC_PALETTE,(0xB86B45,0xE0A56A))
        images=build.images();atlas=build.load(build.RP/'textures/item_texture.json')['texture_data'];hashes=[]
        for kind,fill in build.STATES:
            name=build.name_for(kind,fill);image=images[name]
            with Image.open(build.RP/'textures/items'/f'{name}.png') as actual:
                self.assertEqual(actual.size,(64,64));self.assertEqual(actual.convert('RGBA').tobytes(),image.tobytes())
            self.assertEqual(atlas[name],{'textures':'textures/items/'+name})
            self.assertEqual(image.getextrema()[3],(0,255))
            if kind=='partial':hashes.append(hashlib.sha256(image.tobytes()).hexdigest())
            else:self.assertEqual(image.tobytes(),images[build.name_for('partial',fill)].tobytes())
        self.assertEqual(len(set(hashes)),8)

    def test_all_proxy_held_routes_equal_their_canonical_dynamic_route(self):
        for kind,fill in build.STATES:
            name=build.name_for(kind,fill);base='empty_seasoning_bottle' if kind=='partial' else 'pending_seasoning'
            expected=build.load(build.RP/'attachables'/f'{base}.attachable.json')
            expected['minecraft:attachable']['description']['identifier']=build.NS+name
            # G119 keeps the complete dynamic route but checks this proxy's
            # exact held identity. Admit only that one owner-ready row change.
            rows=expected['minecraft:attachable']['description']['scripts']['pre_animation']
            prefix='v.kg_bottle_owner_ready = '
            owners=[i for i,row in enumerate(rows) if row.startswith(prefix)]
            self.assertEqual(len(owners),1,name)
            self.assertEqual(rows[owners[0]],prefix+bottle_bank_ready(build.NS+base)+';',name)
            rows[owners[0]]=prefix+bottle_bank_ready(build.NS+name)+';'
            actual=build.load(build.RP/'attachables'/f'{name}.attachable.json')
            self.assertEqual(actual,expected,name)
            d=actual['minecraft:attachable']['description']
            self.assertEqual(d['render_controllers'],['controller.render.kg_bottle_held.dynamic'])
            self.assertEqual(d['geometry'],{'default':'geometry.kg_bottle_held.combined'})
            if kind=='pending':self.assertIn('shake_right',d['animations']);self.assertIn('shake_left',d['animations'])
            else:self.assertNotIn('shake_right',d['animations']);self.assertNotIn('shake_left',d['animations'])

if __name__=='__main__':unittest.main()
