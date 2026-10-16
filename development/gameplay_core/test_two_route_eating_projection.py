"""Regress scoped dispatch, native clip equivalence and repeated composition.

Functional source checks only. Immutable G126 identity gates remain untouched.
"""
from pathlib import Path
import copy
import hashlib
import json
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import build_caterpillar_eating_projection as caterpillar
import build_eating_motion as motion
import build_two_route_eating_projection as scoped
import build_review_three_eating_projection as review
from eating_owner_context import reference_bytes
from eating_owner_properties import predecessor_document as owner_property_predecessor


class TwoRouteProjectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.current = review.restore_main(scoped.MAIN.read_text())
        cls.original = scoped.restore_main(cls.current)
        cls.shared = json.loads(reference_bytes(scoped.SHARED))
        cls.clips = scoped.animations(scoped.SHARED.read_bytes())

    def test_exact_selector_delta_preserves_admission_and_every_other_main_byte(self):
        from verify_a284 import eating_dispatch_source
        version = tuple(json.loads((scoped.BP / 'manifest.json').read_text())['header']['version'])
        self.assertIn(version, ((2, 8, 127), (2, 8, 128), (2, 8, 129), (2, 8, 130), (2, 8, 131), (2, 8, 132), (2, 8, 133), (2, 8, 134), (2, 8, 135), (2, 8, 136), (2, 8, 137), (2, 8, 138), (2, 8, 139), (2, 8, 140), (2, 8, 141), (2, 8, 142), (2, 8, 143), (2, 8, 144), (2, 8, 145), (2, 8, 146), (2, 8, 147), (2, 8, 148), (2, 8, 149), (2, 8, 150)))
        self.assertEqual(eating_dispatch_source(self.current, version), self.original)
        self.assertEqual(eating_dispatch_source(self.current, (2, 8, 126)), self.original)
        with self.assertRaisesRegex(AssertionError, 'exact dispatcher'):
            eating_dispatch_source(self.original, version)
        self.assertEqual(scoped.patch_main(self.original), self.current)
        self.assertEqual(scoped.patch_main(self.current), self.current)
        self.assertEqual(caterpillar.patch_main(self.current), self.current)
        old_call = 'e.source.playAnimation(' + scoped.OLD_SELECTOR + ',{'
        new_call = 'e.source.playAnimation(' + scoped.new_selector() + ',{'
        self.assertEqual(self.current.count(new_call), 1)
        self.assertEqual(self.current.replace(new_call, old_call, 1), self.original)
        admission = next(row for row in self.original.splitlines() if 'if(eatingNativeTicks(a.nativeDuration)>0&&' in row)
        self.assertEqual(self.current.count(admission), 1)
        third = "e.source.playAnimation('animation.kg_eating.player.native_'"
        self.assertEqual(self.current[self.current.index(third):], self.original[self.original.index(third):])
        for token in ('.playAnimation(', '.subscribe(', 'itemStartUse.subscribe(', 'controller:', 'stopExpression:', 'import '):
            self.assertEqual(self.current.count(token), self.original.count(token), token)
        for bad in ('', self.original + self.original, self.current + self.current,
                    self.current + '\n', self.current.replace("hand==='main'&&!heldByHand", "hand!=='off'&&!heldByHand", 1),
                    self.current.replace("controller:'kg_java_eating_first_person'", "controller:'changed'", 1),
                    self.current.replace("'animation.kg_probe_caterpillar.player.one.right'", "'animation.kg_probe_caterpillar.player.changed'", 1),
                    self.current.replace(third, "e.source.playAnimation('animation.changed.native_'", 1)):
            with self.assertRaises(ValueError):
                scoped.patch_main(bad)
            with self.assertRaises(ValueError):
                eating_dispatch_source(bad, version)
        with patch.object(Path, 'read_bytes', return_value=b'changed dedicated clips'):
            with self.assertRaisesRegex(AssertionError, 'clip bytes drifted'):
                eating_dispatch_source(self.current, version)

    def test_complete_native_clip_bytes_and_only_arm_position_scale_changes(self):
        self.assertEqual(reference_bytes(scoped.DEDICATED), scoped.encoded(self.clips))
        self.assertEqual(hashlib.sha256(reference_bytes(scoped.DEDICATED)).hexdigest(), scoped.NATIVE_CLIPS_SHA256)
        self.assertEqual(hashlib.sha256(reference_bytes(scoped.SHARED)).hexdigest(), scoped.SHARED_SHA256)
        for route in scoped.ROUTES:
            old = self.shared['animations'][route['original_clip']]
            new = self.clips['animations'][route['dedicated_clip']]
            restored = copy.deepcopy(new)
            restored['blend_weight'] = old['blend_weight']
            for arm in route['arms']:
                self.assertEqual(new['bones'][arm]['rotation'], old['bones'][arm]['rotation'])
                self.assertEqual(list(new['bones'][arm]['position']), list(old['bones'][arm]['position']))
                self.assertEqual(new['bones'][arm]['scale'], ['1.0 / 0.9375'] * 3)
                restored['bones'][arm]['position'] = old['bones'][arm]['position']
                del restored['bones'][arm]['scale']
            self.assertEqual(restored, old, route['item_id'])
        ids = {route['dedicated_clip'] for route in scoped.ROUTES}
        found = {name: [] for name in ids}
        for path in (scoped.RP / 'animations').glob('*.json'):
            for name in json.loads(path.read_bytes()).get('animations', {}):
                if name in found:
                    found[name].append(path)
        self.assertEqual(found, {name: [scoped.DEDICATED] for name in ids})
        drift = copy.deepcopy(self.shared)
        drift['animations'][scoped.ROUTES[0]['original_clip']]['animation_length'] += 1
        with self.assertRaisesRegex(ValueError, 'source drift'):
            scoped.animations(drift)

    def test_two_full_generations_preserve_every_non_target_output_and_caterpillar(self):
        first = motion.build(two_route_camera=True, review_three_routes=False, failure_skewers=False)
        second = motion.build(first, two_route_camera=True, review_three_routes=False, failure_skewers=False)
        # Remove only the newly registered layer to compare the full G126 output.
        with patch.object(scoped, 'augment', side_effect=lambda output: output):
            before = motion.build({scoped.MAIN: self.original}, review_three_routes=False, failure_skewers=False)
        self.assertEqual(set(first), set(second))
        for path in first:
            self.assertEqual(scoped.encoded(first[path]), scoped.encoded(second[path]), str(path))
        delta = {path for path in set(before) | set(first)
                 if path not in before or path not in first or scoped.encoded(before[path]) != scoped.encoded(first[path])}
        self.assertEqual(delta, {scoped.MAIN, scoped.DEDICATED})
        import build_failure_skewer_held as failure
        final = motion.build()
        failure_paths = set(failure.base_assets()) | {failure.PLAYER_FILE, failure.PLAYER_CONTROLLER}
        for path, value in first.items():
            if path in failure_paths:
                self.assertEqual(path.read_bytes(), scoped.encoded(final[path]), str(path))
            elif path == scoped.MAIN:
                self.assertEqual(review.restore_main(path.read_text()).encode(),scoped.encoded(value),str(path))
            elif path.suffix == '.json':
                self.assertEqual(scoped.encoded(review.predecessor_document(path,owner_property_predecessor(json.loads(path.read_bytes())))),scoped.encoded(value),str(path))
            else:self.assertEqual(path.read_bytes(), scoped.encoded(value), str(path))
        fixtures = json.loads((ROOT / 'development/gameplay_core/fixtures/caterpillar-camera-native-20261009.json').read_text())
        for relative, digest in fixtures['runtime_file_sha256'].items():
            self.assertEqual(hashlib.sha256(reference_bytes(scoped.P / relative)).hexdigest(), digest, relative)
        # Existing generation must not strip the scoped selector on a later run.
        self.assertEqual(review.restore_main(motion.build()[scoped.MAIN]), self.current)

    def test_supplied_generated_sources_do_not_require_disk_fallbacks(self):
        # Immutable continuation metadata is required even for supplied source;
        # MAIN/SHARED and every other source fallback must remain unavailable.
        read_text = Path.read_text
        witness = ROOT / 'tools/fixtures/g144-main-reviewed-delta.json'
        def metadata_only(path, *args, **kwargs):
            if path == witness:
                return read_text(path, *args, **kwargs)
            raise AssertionError('Unexpected source disk fallback: ' + str(path))
        with patch.object(Path, 'read_bytes', side_effect=AssertionError('Unexpected disk read')), \
             patch.object(Path, 'read_text', autospec=True, side_effect=metadata_only):
            result = scoped.augment({scoped.SHARED: self.shared, scoped.MAIN: self.original})
            with self.assertRaisesRegex(AssertionError, 'Unexpected disk read'):
                scoped.augment({})
        self.assertEqual(result[scoped.MAIN], self.current)
        self.assertEqual(scoped.encoded(result[scoped.DEDICATED]), scoped.encoded(self.clips))

    def test_exact_dispatch_and_each_client_guard_reject_unsupported_scope(self):
        payload = {'old': scoped.OLD_SELECTOR, 'new': scoped.new_selector(),
                   'routes': [dict(route, gate=self.clips['animations'][route['dedicated_clip']]['blend_weight']) for route in scoped.ROUTES]}
        # Evaluate actual generated selector/blend expressions, not a duplicated
        # transform formula. Dedicated native bytes cover every sampled frame.
        javascript = r'''
import assert from 'node:assert/strict';
import {supportsJavaEatingProjection} from './projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_projection_items.js';
let text='';for await(const chunk of process.stdin)text+=chunk;const data=JSON.parse(text);
const compile=s=>new Function('e','profile','hand','heldByHand','return '+s);
const before=compile(data.old),after=compile(data.new);
const controls=['kaleidoscope_grilling:grilled_caterpillar_skewer','kaleidoscope_grilling:grilled_fried_egg_skewer','kaleidoscope_grilling:grilled_fish_skewer','kaleidoscope_grilling:secret_skewer','kaleidoscope_grilling:grilled_beef_skewer','minecraft:apple'];
const ids=[...controls,...data.routes.flatMap(r=>[r.item_id,r.item_id.replace(':grilled_',':raw_'),r.item_id+'_native_plain',r.item_id+'_java_three_alt'])];
for(const id of ids)for(const profile of ['ONE','TWO','THREE','THREE_ALT','FOUR','THREE_RANDOM','unknown'])for(const hand of ['main','off','right'])for(const off of [undefined,{typeId:'minecraft:torch'}]){
 const e={itemStack:{typeId:id},source:{}};let reads=0;const held=(who,slot)=>{assert.equal(who,e.source);assert.equal(slot,'off');reads++;return off};
 const route=data.routes.find(r=>r.item_id===id&&r.profile===profile&&hand==='main'&&!off);
 assert.equal(after(e,profile,hand,held),route?.dedicated_clip??before(e,profile,hand,held));
 if(!data.routes.some(r=>r.item_id===id&&r.profile===profile&&hand==='main'))assert.equal(reads,0);
}
for(const r of data.routes){
 assert.equal(supportsJavaEatingProjection(r.item_id,r.profile),true,'Existing admission must suffice');
 const initial={id:r.item_id,profile:r.code,hand:1,projection:1,use:1,fp:1,off:0,sneak:0,swim:0,glide:0,ride:0};let s={...initial};let missing='';
 const q={has_property:n=>n!==missing,property:n=>s[n.split(':')[1].replace('eat_','')],is_item_name_any:(slot,...ids)=>slot==='slot.weapon.mainhand'&&ids.includes(s.id),is_item_equipped:()=>s.off};
 for(const [query,key]of [['is_using_item','use'],['is_sneaking','sneak'],['is_swimming','swim'],['is_gliding','glide'],['is_riding','ride']])Object.defineProperty(q,query,{get:()=>s[key]});
 const variable={get is_first_person(){return s.fp}};const gate=new Function('q','variable','return '+r.gate);assert.ok(gate(q,variable));
 for(const [key,value]of [['id',r.item_id+'_native_plain'],['id',r.item_id.replace(':grilled_',':raw_')],['id','kaleidoscope_grilling:grilled_fried_egg_skewer'],['id','kaleidoscope_grilling:secret_skewer'],['profile',4],['hand',2],['projection',0],['use',0],['fp',0],['off',1],['sneak',1],['swim',1],['glide',1],['ride',1]]){s={...initial,[key]:value};assert.equal(Boolean(gate(q,variable)),false,key)}
 s={...initial};for(const prop of ['eat_projection','eat_profile','eat_hand']){missing='kaleidoscope_grilling:'+prop;assert.equal(Boolean(gate(q,variable)),false,prop)}
}
console.log('Exact selector and bounded client guards PASS; expression evaluation is not native engine acceptance');
'''
        subprocess.run(['node', '--input-type=module', '-e', javascript], cwd=ROOT,
                       input=json.dumps(payload).encode(), check=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
