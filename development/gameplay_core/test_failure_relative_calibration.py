"""Failure-owned arm calibration: independent cross-item relative invariants.

The established secret calibration is conserved, not recertified as absolute
Bedrock-client parity. These checks execute the emitted expression subset in
Node and compare equal profile, elapsed time, hand, and player-rig inputs.
"""
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
import json
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
ANIMATIONS = RP / 'animations'
FROZEN_BASE = 'f36e333cb629237495479fafdb8a8ac1f2edb459'
NS = 'kaleidoscope_grilling:'
PROFILES = ('THREE', 'THREE_ALT')
HANDS = ('right', 'left')


def read(path):
    return json.loads(path.read_text())


@lru_cache(maxsize=None)
def frozen_bytes(path):
    return subprocess.check_output(
        ['git', 'show', FROZEN_BASE + ':' + path.relative_to(ROOT).as_posix()], cwd=ROOT)


def clips(filename, frozen=False):
    path = ANIMATIONS / filename
    return (json.loads(frozen_bytes(path)) if frozen else read(path))['animations']


def clip_id(profile, hand, failure=False):
    return ('animation.kg_failure_held.player.' if failure else
            'animation.kg_java_eating.player.') + profile.lower() + '.' + hand


def identities(profile):
    suffix = '' if profile == 'THREE' else '_java_three_alt'
    return [NS + name + suffix for name in ('mysterious_skewer', 'dark_grilling')]


def secret_identity(profile):
    return NS + 'secret_skewer' + ('' if profile == 'THREE' else '_java_three_alt')


def slot(hand):
    return 'slot.weapon.mainhand' if hand == 'right' else 'slot.weapon.offhand'


def arms(profile, hand):
    return ('rightarm', 'leftarm') if profile == 'THREE' else (hand + 'arm',)


def predicate(profile, hand, failure=False):
    ids = identities(profile) if failure else [secret_identity(profile)]
    return "q.is_item_name_any(" + ','.join("'" + x + "'" for x in [slot(hand), *ids]) + ')'


def expected_owned(row):
    """Independent, bounded oracle; do not call the production transformer."""
    expected = deepcopy(row['donor'])
    old = ' + (' + predicate(row['profile'], row['hand']) + ' ? 3.41 : 0)'
    new = ' + (' + predicate(row['profile'], row['hand'], True) + ' ? 3.41 : 0)'
    count = 0
    for arm in arms(row['profile'], row['hand']):
        for xyz in expected['bones'][arm]['position'].values():
            assert xyz[1].endswith(old) and xyz[1].count(old) == 1
            xyz[1] = xyz[1][:-len(old)] + new
            count += 1
    assert count == (698 if row['profile'] == 'THREE' else 304)
    original = clips('failure_skewer_player.animation.json', frozen=True)
    expected['blend_weight'] = original[clip_id(row['profile'], row['hand'], True)]['blend_weight']
    return expected


def assert_owned(row, actual):
    # Python considers True == 1; JSON types are part of the owned contract.
    canonical = lambda value: json.dumps(value, sort_keys=True, separators=(',', ':'))
    assert canonical(actual) == canonical(expected_owned(row)), (row['profile'], row['hand'], 'non-owned payload change')


def routes():
    donors = clips('java_eating_player.animation.json', frozen=True)
    actual = clips('failure_skewer_player.animation.json')
    return [dict(profile=profile, hand=hand, slot=slot(hand),
                 secret=secret_identity(profile), ids=identities(profile),
                 arms=arms(profile, hand),
                 donor=donors[clip_id(profile, hand)],
                 actual=actual[clip_id(profile, hand, True)])
            for profile in PROFILES for hand in HANDS]


def node(source, data):
    result = subprocess.run(['node', '--input-type=module'],
                            input='const rows=' + json.dumps(data) + ';\n' + source,
                            text=True, capture_output=True)
    if result.returncode:
        raise AssertionError(result.stderr.strip())
    return result.stdout.strip()


EVALUATOR = r'''
const math={abs:Math.abs,clamp:(n,a,b)=>Math.min(b,Math.max(a,n))};
const cache=new Map();
function evaluate(value,q,variable={is_first_person:1}) {
 if(typeof value!=='string') return value;
 if(!cache.has(value)) cache.set(value,new Function('q','math','variable','return ('+value+')'));
 return cache.get(value)(q,math,variable);
}
function query(row,id,slim,time=0) {
 const hand=row.hand==='right'?1:2;
 const native=row.profile==='THREE'?100:90;
 const props={eat_projection:1,eat_profile:row.profile==='THREE'?3:4,
              eat_hand:hand,eat_native_ticks:native,eat_elapsed_ticks:time*20};
 return {is_using_item:1,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,
  property:n=>props[n.split(':')[1]]??0,has_property:n=>Object.hasOwn(props,n.split(':')[1]),
  main_hand_item_use_duration:native-time*20,frame_alpha:1,
  is_item_name_any:(s,...ids)=>s===row.slot&&ids.includes(id),
  is_item_equipped:()=>0,
  get_default_bone_pivot:(bone,axis)=>({rightarm:[-5,slim?21.5:22,0],
      leftarm:[5,slim?21.5:22,0],rightitem:[-6,15,1],leftitem:[6,15,1]})[bone][axis]};
}
function equalNumber(a,b,label) {
 if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>1e-9)
   throw Error(label+': '+a+' != '+b);
}
function compare(a,b,qa,qb,label) {
 if(Array.isArray(a)) {
  if(!Array.isArray(b)||a.length!==b.length) throw Error(label+' vector shape');
  a.forEach((v,i)=>compare(v,b[i],qa,qb,label+'/'+i));
 } else if(a!==null&&typeof a==='object') {
  if(!b||JSON.stringify(Object.keys(a).sort())!==JSON.stringify(Object.keys(b).sort()))
    throw Error(label+' channel/key inventory');
  for(const key of Object.keys(a)) compare(a[key],b[key],qa,qb,label+'/'+key);
 } else equalNumber(evaluate(a,qa),evaluate(b,qb),label);
}
'''


class FailureRelativeCalibration(unittest.TestCase):
    def test_all_eight_routes_every_authored_bone_key_are_relative_equal(self):
        self.assertEqual(node(EVALUATOR + r'''
let routes=0;
for(const row of rows) for(const id of row.ids) {
 routes++;
 for(const slim of [false,true]) {
  const secret=query(row,row.secret,slim),failure=query(row,id,slim);
  compare(row.donor.bones,row.actual.bones,secret,failure,
          row.profile+'/'+row.hand+'/'+id+'/'+(slim?'slim':'wide'));
 }
}
console.log(routes);
''', routes()), '8')

    def test_frozen_counterexample_is_exactly_341_hundredths_on_all_2004_arm_keys(self):
        rows = routes()
        before = clips('failure_skewer_player.animation.json', frozen=True)
        for row in rows:
            row['actual'] = before[clip_id(row['profile'], row['hand'], True)]
        self.assertEqual(node(EVALUATOR + r'''
let keys=0;
for(const row of rows) {
 for(const bone of row.arms) for(const [time,xyz] of Object.entries(row.donor.bones[bone].position)) {
  keys++;
  for(const id of row.ids) for(const slim of [false,true]) {
   const a=evaluate(xyz[1],query(row,row.secret,slim));
   const b=evaluate(row.actual.bones[bone].position[time][1],query(row,id,slim));
   equalNumber(a-b,3.41,row.profile+'/'+row.hand+'/'+bone+'/'+time);
  }
 }
}
console.log(keys);
''', rows), '2004')

    def test_exact_four_clip_inventory_and_reversible_donor_payload(self):
        sys.path.insert(0, str(ROOT / 'tools'))
        from build_failure_skewer_held import calibrate_player_clip
        from eating_owner_context import document, legacy_document
        actual = read(ANIMATIONS / 'failure_skewer_player.animation.json')
        self.assertEqual(actual['format_version'], '1.8.0')
        self.assertEqual(set(actual), {'format_version', 'animations'})
        self.assertEqual(set(actual['animations']),
                         {clip_id(p, h, True) for p in PROFILES for h in HANDS})
        for row in routes():
            with self.subTest(profile=row['profile'], hand=row['hand']):
                assert_owned(row, row['actual'])
                donor = deepcopy(row['donor'])
                donor['blend_weight'] = row['actual']['blend_weight']
                saved = deepcopy(donor)
                output = calibrate_player_clip(donor, row['profile'], row['hand'])
                self.assertEqual(output, row['actual'])
                self.assertEqual(donor, saved, 'forward must not mutate input')
                self.assertEqual(calibrate_player_clip(output, row['profile'], row['hand'], inverse=True), donor)
                self.assertEqual(output, row['actual'], 'inverse must not mutate input')
                # The transfer owns no blend changes, even when invoked separately.
                donor['blend_weight'] = 'test.preserved_blend'
                self.assertEqual(calibrate_player_clip(donor, row['profile'], row['hand'])['blend_weight'],
                                 'test.preserved_blend')
                legacy = legacy_document(saved)
                self.assertNotEqual(legacy['anim_time_update'], saved['anim_time_update'])
                converted = calibrate_player_clip(legacy, row['profile'], row['hand'])
                self.assertEqual(converted['anim_time_update'], legacy['anim_time_update'])
                self.assertEqual(calibrate_player_clip(converted, row['profile'], row['hand'], inverse=True), legacy)
                self.assertEqual(document(converted, attachable=False), row['actual'])
                self.assertEqual(legacy, legacy_document(saved), 'legacy input must remain untouched')

    def test_clock_and_interpolated_full_pose_match_at_source_breakpoints(self):
        fixture = read(Path(__file__).parent / 'fixtures/java-eating-curves-1.1.1.json')['files']
        rows = routes()
        for row in rows:
            dual = row['profile'] == 'THREE'
            arrays = fixture['EnderPearlEatingAnimation.java' if dual else 'SkewerEatingAnimation.java']['arrays']
            selected = [v for k, v in arrays.items() if k.endswith('TIMES') and
                        (not k.startswith('ONE_') if dual else k.startswith('SQUID_'))]
            row['times'] = sorted({1.0, 1.3, 2.1, 1.307, 2.113,
                                   *(t for times in selected for t in times)})
        node(EVALUATOR + r'''
function vector(value,q) {
 return Array.isArray(value)?value.map(x=>evaluate(x,q)):evaluate(value,q);
}
function sample(track,t,q) {
 if(typeof track!=='object'||Array.isArray(track)) return vector(track,q);
 const keys=Object.keys(track).map(Number).sort((a,b)=>a-b);
 const values=Object.fromEntries(Object.entries(track).map(([k,v])=>[Number(k),v]));
 if(t<=keys[0]) return vector(values[keys[0]],q);
 if(t>=keys.at(-1)) return vector(values[keys.at(-1)],q);
 const r=keys.findIndex(k=>k>=t),a=keys[r-1],b=keys[r],u=(t-a)/(b-a);
 const left=vector(values[a],q),right=vector(values[b],q);
 return Array.isArray(left)?left.map((v,i)=>v+(right[i]-v)*u):left+(right-left)*u;
}
for(const row of rows) for(const id of row.ids) for(const slim of [false,true]) for(const time of row.times) {
 const qa=query(row,row.secret,slim,time),qb=query(row,id,slim,time);
 const a=evaluate(row.donor.anim_time_update,qa),b=evaluate(row.actual.anim_time_update,qb);
 equalNumber(a,b,'clock');equalNumber(a,time,'elapsed time');
 if(row.donor.override_previous_animation!==row.actual.override_previous_animation)
   throw Error('override changed');
 for(const [bone,channels] of Object.entries(row.donor.bones)) for(const [channel,track] of Object.entries(channels)) {
  compare(sample(track,a,qa),sample(row.actual.bones[bone][channel],b,qb),qa,qb,
          row.profile+'/'+row.hand+'/'+bone+'/'+channel+'/'+time);
 }
}
''', rows)

    def test_calibration_identity_and_slot_negatives_at_every_arm_key(self):
        rows = routes()
        candidates = [*identities('THREE'), *identities('THREE_ALT'),
                      NS + 'mysterious_skewer_native_plain', NS + 'dark_grilling_native_plain',
                      secret_identity('THREE'), secret_identity('THREE_ALT'),
                      NS + 'grilled_fish_skewer', NS + 'raw_fish_skewer',
                      NS + 'grilled_ender_pearl_skewer', NS + 'ordinary_skewer',
                      NS + 'mysterious_skewer_extra', 'minecraft:apple']
        for row in rows:
            row['candidates'] = candidates
            row['tail'] = ' + (' + predicate(row['profile'], row['hand']) + ' ? 3.41 : 0)'
        node(EVALUATOR + r'''
for(const row of rows) for(const bone of row.arms) for(const [time,xyz] of Object.entries(row.donor.bones[bone].position)) {
 if(!xyz[1].endsWith(row.tail)) throw Error('Unknown donor suffix');
 const base=xyz[1].slice(0,-row.tail.length),actual=row.actual.bones[bone].position[time][1];
 for(const id of row.candidates) for(const heldSlot of ['slot.weapon.mainhand','slot.weapon.offhand']) {
  const q=query(row,id,false);
  q.is_item_name_any=(s,...ids)=>s===heldSlot&&ids.includes(id);
  const delta=evaluate(actual,q)-evaluate(base,q);
  equalNumber(delta,heldSlot===row.slot&&row.ids.includes(id)?3.41:0,
              row.profile+'/'+row.hand+'/'+bone+'/'+time+'/'+id+'/'+heldSlot);
 }
}
''', rows)

    def test_existing_gate_truth_table_is_unchanged_and_not_broadened(self):
        rows = routes()
        before = clips('failure_skewer_player.animation.json', frozen=True)
        for row in rows:
            self.assertEqual(row['actual']['blend_weight'], before[clip_id(row['profile'], row['hand'], True)]['blend_weight'])
            row['negatives'] = [i for p in PROFILES for i in identities(p) if i not in row['ids']]
            row['negatives'] += [NS + n for n in ('mysterious_skewer_native_plain', 'dark_grilling_native_plain',
                                                 'secret_skewer', 'secret_skewer_java_three_alt',
                                                 'grilled_fish_skewer', 'raw_fish_skewer', 'ordinary_skewer')]
        node(EVALUATOR + r'''
for(const row of rows) for(const id of [...row.ids,...row.negatives])
 for(const fp of [0,1]) for(const using of [0,1]) for(const projection of [0,1])
 for(const profile of [0,1,2,3,4,5]) for(const hand of [0,1,2]) for(const equipped of [0,1]) {
  const q=query(row,id,false),values={eat_projection:projection,eat_profile:profile,eat_hand:hand};
  q.property=n=>values[n.split(':')[1]]??0;q.is_using_item=using;
  q.is_item_equipped=()=>equipped;
  const expected=!!fp&&!!using&&projection===1&&profile===(row.profile==='THREE'?3:4)
     &&hand===(row.hand==='right'?1:2)&&!equipped&&row.ids.includes(id);
  if(Boolean(evaluate(row.actual.blend_weight,q,{is_first_person:fp}))!==expected)
    throw Error('Broadened profile/hand/identity/context gate');
 }
for(const row of rows) for(const id of row.ids) {
 for(const posture of ['is_sneaking','is_swimming','is_gliding','is_riding']) {
  const q=query(row,id,false);q[posture]=1;
  if(evaluate(row.actual.blend_weight,q)) throw Error('Posture admitted: '+posture);
 }
 for(const missing of ['eat_projection','eat_profile','eat_hand']) {
  const q=query(row,id,false),original=q.property;
  q.property=n=>n.endsWith(':'+missing)?0:original(n);
  q.has_property=n=>!n.endsWith(':'+missing);
  if(evaluate(row.actual.blend_weight,q)) throw Error('Missing required property admitted: '+missing);
 }
 const q=query(row,id,false),other=row.slot==='slot.weapon.mainhand'?'slot.weapon.offhand':'slot.weapon.mainhand';
 q.is_item_name_any=(s,...ids)=>s===other&&ids.includes(id);
 if(evaluate(row.actual.blend_weight,q)) throw Error('Opposite held slot admitted');
}
''', rows)

    def test_mutations_cannot_gain_exact_donor_acceptance(self):
        sys.path.insert(0, str(ROOT / 'tools'))
        from build_failure_skewer_held import calibrate_player_clip
        for row in routes():
            expected = expected_owned(row)
            arm = row['arms'][0]
            mutations = []
            def changed(label, mutate):
                candidate = deepcopy(expected)
                mutate(candidate)
                mutations.append((label, candidate))
            def arm_y(candidate):
                return candidate['bones'][arm]['position']['0']
            replacements = {
                'changed calibration': (' ? 3.41 : 0', ' ? 3.42 : 0'),
                'wrong slot': (row['slot'], slot('left' if row['hand'] == 'right' else 'right')),
                'missing second failure ID': (",'" + row['ids'][1] + "'", ''),
                'unrelated ID': (row['ids'][1], NS + 'grilled_fish_skewer'),
                'wildcard ID': (row['ids'][1], NS + '*'),
                'additional unrelated ID': ("'" + row['ids'][1] + "')", "'" + row['ids'][1] + "','minecraft:apple')"),
                'additional wildcard ID': ("'" + row['ids'][1] + "')", "'" + row['ids'][1] + "','" + NS + "*')"),
                'partial key replacement': (predicate(row['profile'], row['hand'], True), predicate(row['profile'], row['hand'])),
            }
            for label, (old, new) in replacements.items():
                changed(label, lambda c, a=old, b=new: arm_y(c).__setitem__(1, arm_y(c)[1].replace(a, b)))
            for field, value in [('override_previous_animation', False), ('override_previous_animation', 1), ('anim_time_update', '0'),
                                 ('animation_length', 99), ('loop', False)]:
                changed(field + '=' + repr(value), lambda c, k=field, v=value: c.__setitem__(k, v))
            changed('arm X', lambda c: arm_y(c).__setitem__(0, '0'))
            changed('arm Z', lambda c: arm_y(c).__setitem__(2, '0'))
            changed('rotation', lambda c: c['bones'][arm]['rotation']['0'].__setitem__(0, 0))
            changed('scale', lambda c: c['bones'][arm].__setitem__('scale', 2))
            changed('socket', lambda c: c['bones'][row['hand'] + 'item']['position']['0'].__setitem__(1, '0'))
            changed('key inventory', lambda c: c['bones'][arm]['position'].pop('0'))
            if row['profile'] == 'THREE':
                other = row['arms'][1]
                changed('helper arm left uncalibrated', lambda c: c['bones'][other].__setitem__('position', deepcopy(row['donor']['bones'][other]['position'])))
            changed('broadened blend', lambda c: c.__setitem__('blend_weight', '1'))
            for label, candidate in mutations:
                with self.subTest(profile=row['profile'], hand=row['hand'], mutation=label):
                    with self.assertRaises(AssertionError):
                        assert_owned(row, candidate)
                    # The transformer intentionally preserves arbitrary blend;
                    # the full owned-clip oracle above is what constrains it.
                    if label != 'broadened blend':
                        with self.assertRaises(ValueError):
                            calibrate_player_clip(candidate, row['profile'], row['hand'], inverse=True)
            for field, value in [('override_previous_animation', False), ('override_previous_animation', 1), ('anim_time_update', '0')]:
                donor = deepcopy(row['donor'])
                donor[field] = value
                with self.assertRaises(ValueError):
                    calibrate_player_clip(donor, row['profile'], row['hand'])
            for profile, hand in [('THREE_RANDOM', row['hand']), (row['profile'], 'off'),
                                  ('THREE_ALT' if row['profile'] == 'THREE' else 'THREE', row['hand']),
                                  (row['profile'], 'left' if row['hand'] == 'right' else 'right')]:
                with self.assertRaises(ValueError):
                    calibrate_player_clip(row['donor'], profile, hand)

    def test_shared_secret_g126_g127_raw_and_reviewed_animation_bytes_are_protected(self):
        for filename in ('java_eating_player.animation.json', 'java_eating_projection.animation.json',
                         'secret_idle_fp_calibration.animation.json', 'kg_probe_caterpillar_item.animation.json',
                         'kg_probe_caterpillar_player.animation.json', 'kg_isolated_two_route_player.animation.json',
                         'raw_one_player.animation.json', 'review_three_player.animation.json'):
            with self.subTest(file=filename):
                path = ANIMATIONS / filename
                self.assertEqual(path.read_bytes(), frozen_bytes(path))


if __name__ == '__main__':
    unittest.main()
