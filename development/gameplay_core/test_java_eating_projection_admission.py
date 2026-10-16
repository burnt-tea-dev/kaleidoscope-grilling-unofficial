"""Exact native item/profile/renderer admission; no rendered-client claim."""
import copy
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
import build_java_eating_projection as generator
from public_source_witness import public_json,assert_public_bytes
from test_eating_observer_projection import node
from eating_owner_context import expression
from eating_owner_properties import predecessor_document as owner_property_predecessor


class ProjectionAdmission(unittest.TestCase):
    def test_canonical_random_stays_legacy_and_owned_secret_has_exact_profiles(self):
        items=generator.projection_items()
        self.assertTrue(items['THREE_ALT'])
        self.assertTrue(all(identifier.endswith(generator.ALT_SUFFIX) for identifier in items['THREE_ALT']))
        self.assertEqual(items['ONE'],['kaleidoscope_grilling:grilled_fish_skewer'])
        self.assertEqual(items['THREE'],['kaleidoscope_grilling:grilled_ender_pearl_skewer',generator.SECRET])
        self.assertIn(generator.SECRET+generator.ALT_SUFFIX,items['THREE_ALT'])
        admitted={identifier for rows in items.values() for identifier in rows}
        for identifier in ('kaleidoscope_grilling:grilled_gluten_skewer',
                           'kaleidoscope_grilling:secret_skewer_native_plain'):
            self.assertNotIn(identifier,admitted)

    def test_an_actual_alt_with_another_food_geometry_is_rejected(self):
        path=generator.RP/'attachables/grilled_gluten_skewer_java_three_alt.attachable.json'
        wrong=json.loads(path.read_text())
        desc=wrong['minecraft:attachable']['description']
        self.assertTrue(generator.fixed_geometry(desc))
        desc['geometry']['stage0']='geometry.kg_a287.kg_a22.raw_gluten_skewer.stage0'
        self.assertFalse(generator.fixed_geometry(desc))
        self.assertNotIn(desc['identifier'],generator.projection_items({path:wrong})['THREE_ALT'])
        wrong=copy.deepcopy(wrong);wrong['minecraft:attachable']['description']['geometry']={}
        self.assertNotIn(desc['identifier'],generator.projection_items({path:wrong})['THREE_ALT'])

    def test_wrong_native_duration_fails_closed_for_actual_alt(self):
        identifier=generator.projection_items()['THREE_ALT'][0]
        path=generator.BP/'items'/(identifier.split(':')[1]+'.json')
        wrong=json.loads(path.read_text())
        wrong['minecraft:item']['components']['minecraft:use_modifiers']['use_duration']=5.0
        self.assertNotIn(identifier,generator.projection_items({path:wrong})['THREE_ALT'])
        for identifier,profile in generator.SECRET_PROFILES.items():
            path=generator.BP/'items'/(identifier.split(':')[1]+'.json')
            wrong=json.loads(path.read_text())
            wrong['minecraft:item']['components']['minecraft:use_modifiers']['use_duration']=4.5 if profile=='THREE' else 5.0
            self.assertNotIn(identifier,generator.projection_items({path:wrong})[profile])

    def test_generated_script_player_and_attachable_admit_the_same_actual_identity(self):
        items=generator.projection_items()
        descriptions=[]
        for profile,identifiers in items.items():
            for identifier in identifiers:
                path=generator.RP/'attachables'/(identifier.split(':')[1]+'.attachable.json')
                desc=json.loads(path.read_text())['minecraft:attachable']['description']
                descriptions.append({'id':identifier,'profile':profile,'description':desc})
        players=json.loads((generator.RP/'animations/java_eating_player.animation.json').read_text())['animations']
        module=generator.BP/'scripts/java_eating_projection_items.js'
        node('import {supportsJavaEatingProjection} from '+json.dumps(module.as_uri())+';'+'''
const rows='''+json.dumps(descriptions)+''',players='''+json.dumps(players)+''';
for(const {id,profile,description:d} of rows)for(const hand of ['right','left']){
 let held=id,p={eat_projection:1,eat_profile:{ONE:1,TWO:2,THREE:3,THREE_ALT:4,FOUR:5}[profile],eat_hand:hand==='right'?1:2};
 const slot=hand==='right'?'slot.weapon.mainhand':'slot.weapon.offhand';
 const q={is_using_item:true,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,is_item_equipped:()=>0,
 has_property:name=>Object.hasOwn(p,name.split(':')[1]),property:name=>p[name.split(':')[1]],is_item_name_any:(s,...ids)=>s===slot&&ids.includes(held)};
 const c={is_first_person:1,item_slot:hand==='right'?'main_hand':'off_hand',owning_entity:q},variable={is_first_person:1};
 const item=d.scripts.animate.find(row=>row['fp_eat_'+hand])['fp_eat_'+hand];
 const player=players['animation.kg_java_eating.player.'+profile.toLowerCase()+'.'+hand].blend_weight;
 const v={},math={clamp:(n,lo,hi)=>Math.max(lo,Math.min(hi,n))};
 const active=expression=>{evaluatePreAnimation(d.scripts.pre_animation,q,c,math,v);return Boolean(new Function('q','c','variable','v','return '+expression.replaceAll('c.owning_entity->q.','c.owning_entity.'))(q,c,variable,v));};
 if(!supportsJavaEatingProjection(id,profile)||!active(item)||!active(player))throw Error('Actual renderer missing '+id);
 for(const other of ['minecraft:apple','kaleidoscope_grilling:secret_skewer_native_plain',id.replace('_java_three_alt','')]){
  if(other===id)continue;held=other;
  if(active(item)||active(player))throw Error('Actual identity gate leaked '+id+' -> '+other);
 }
 const peer=rows.find(row=>row.profile===profile&&row.id!==id);
 if(peer){held=peer.id;if(active(item))throw Error('Attachable borrowed another actual item');if(!active(player))throw Error('Player lost another admitted same-profile item');}
 held=id;p.eat_profile=0;if(active(item)||active(player))throw Error('Stale profile leaked');
}
for(const id of ['kaleidoscope_grilling:grilled_gluten_skewer','kaleidoscope_grilling:secret_skewer_native_plain'])
 for(const profile of ['ONE','TWO','THREE','THREE_ALT','FOUR'])if(supportsJavaEatingProjection(id,profile))throw Error('Missing exact renderer admitted');
''')

    def test_secret_requires_exact_owned_meshes_and_never_fixed_piece_geometry(self):
        path=generator.RP/'attachables/secret_skewer.attachable.json'
        doc=json.loads(path.read_text());desc=doc['minecraft:attachable']['description']
        self.assertTrue(generator.secret_geometry(desc))
        for mutate in (lambda d:d['geometry'].update(stick='geometry.kg_a287.kg_a22.grilled_fish_skewer.stage0'),
                       lambda d:d['geometry'].update(java_piece='geometry.kg_java_dual.piece.grilled_ender_pearl_skewer')):
            wrong=copy.deepcopy(doc);mutate(wrong['minecraft:attachable']['description'])
            self.assertNotIn(generator.SECRET,generator.projection_items({path:wrong})['THREE'])
        geometry_path=generator.RP/'models/entity/secret_held.geo.json'
        for mutate in (lambda d:d['minecraft:geometry'][0]['bones'][2]['cubes'].extend(copy.deepcopy(d['minecraft:geometry'][0]['bones'][2]['cubes'])),
                       lambda d:d['minecraft:geometry'][0]['bones'][0].update(binding='wrong_helper_socket'),
                       lambda d:d['minecraft:geometry'][0]['bones'][1].update(binding='wrong_helper_socket'),
                       lambda d:d['minecraft:geometry'][0]['bones'][0].update(rotation=[0,30,0]),
                       lambda d:d['minecraft:geometry'].append(copy.deepcopy(d['minecraft:geometry'][0]))):
            wrong=json.loads(geometry_path.read_text());mutate(wrong)
            self.assertNotIn(generator.SECRET,generator.projection_items({geometry_path:wrong})['THREE'])

    def test_secret_main_and_helper_reuse_source_channels_with_only_owned_origin_calibration(self):
        animation_path=generator.RP/'animations/java_eating_projection.animation.json'
        animations=json.loads(animation_path.read_text())['animations']
        player_path=generator.RP/'animations/java_eating_player.animation.json'
        players=json.loads(player_path.read_text())['animations']
        repaired_source=public_json(player_path.relative_to(ROOT))['animations']
        assert_public_bytes(self,animation_path)
        assert_public_bytes(self,player_path)
        for identifier,profile in generator.SECRET_PROFILES.items():
            desc=json.loads((generator.RP/'attachables'/(identifier.split(':')[1]+'.attachable.json')).read_text())['minecraft:attachable']['description']
            self.assertNotIn('java_piece',desc['geometry']);self.assertNotIn('java_piece',desc['textures'])
            self.assertNotIn('controller.render.kg_java_eating.piece',desc['render_controllers'])
            self.assertEqual(len(desc['render_controllers']),5)
            self.assertEqual(desc['geometry']['java_secret_piece'],'geometry.kg_secret_held.piece')
            for hand in ('right','left'):
                key=generator.secret_item_animation_id(profile,hand)
                expected=copy.deepcopy(animations[generator.item_animation_id(profile,hand)])
                self.assertEqual(animations[key],expected)
                self.assertEqual(desc['animations']['fp_eat_'+hand],key)
                player=generator.player_animation_id(profile,hand)
                expected_bones=copy.deepcopy(repaired_source[player]['bones'])
                slot='slot.weapon.mainhand' if hand=='right' else 'slot.weapon.offhand'
                suffix=" + (q.is_item_name_any('"+slot+"','"+identifier+"') ? 3.41 : 0)"
                arms=('rightarm','leftarm') if profile=='THREE' else (hand+'arm',)
                # The immutable public witness already carries the calibration.
                # Verify and strip only its exact owned suffix, then reapply it
                # to the reconstructed uncalibrated channels. No older private
                # source is available for a historical-delta assertion.
                for arm in arms:
                    for position in expected_bones[arm]['position'].values():
                        self.assertTrue(position[1].endswith(suffix),(player,arm))
                        self.assertEqual(position[1].count(suffix),1)
                        position[1]=position[1][:-len(suffix)]
                self.assertNotIn('? 3.41 : 0',json.dumps(expected_bones))
                for arm in arms:
                    for position in expected_bones[arm]['position'].values():position[1]+=suffix
                self.assertEqual(players[player]['bones'],expected_bones)

    def test_secret_projection_and_legacy_motion_are_exclusive_and_helper_fails_closed(self):
        rows=[]
        for identifier,profile in generator.SECRET_PROFILES.items():
            desc=json.loads((generator.RP/'attachables'/(identifier.split(':')[1]+'.attachable.json')).read_text())['minecraft:attachable']['description']
            rows.append({'id':identifier,'code':generator.CODES[profile],'d':desc})
        node('const rows='+json.dumps(rows)+r''';
for(const {id,code,d} of rows)for(const hand of ['right','left']){
 let held=id,using=true,helper=0,projection=1,posture=0;
 const slot=hand==='right'?'slot.weapon.mainhand':'slot.weapon.offhand';
 const q={get is_using_item(){return using},get is_sneaking(){return posture},is_swimming:0,is_gliding:0,is_riding:0,
 has_property:n=>['eat_projection','eat_profile','eat_hand'].includes(n.split(':')[1]),
 property:n=>({eat_projection:projection,eat_profile:code,eat_hand:hand==='right'?1:2})[n.split(':')[1]],
 is_item_name_any:(s,...ids)=>s===slot&&ids.includes(held),is_item_equipped:()=>helper};
 const c={is_first_person:1,item_slot:hand==='right'?'main_hand':'off_hand',owning_entity:q};
 const v={},math={clamp:(n,lo,hi)=>Math.max(lo,Math.min(hi,n))};
 const evaluate=alias=>{evaluatePreAnimation(d.scripts.pre_animation,q,c,math,v);return Boolean(new Function('q','c','v','return '+d.scripts.animate.find(r=>alias in r)[alias].replaceAll('c.owning_entity->q.','c.owning_entity.'))(q,c,v));};
 const active=()=>evaluate('fp_eat_'+hand),idle=()=>evaluate('fp_'+hand),legacy=()=>evaluate((code===4?'eat_alt_':'eat_')+hand);
 if(!active()||idle()||legacy())throw Error('Secret active/idle/legacy layered');
 helper=1;if(active()||!idle()||!legacy())throw Error('Secret suppressed occupied helper or lost fallback');helper=0;
 for(const change of [()=>using=false,()=>held='minecraft:apple',()=>projection=0,()=>posture=1]){
  change();if(active())throw Error('Secret projection leaked after cancel/swap/posture');
  held=id;using=true;helper=0;projection=1;posture=0;
 }
 c.is_first_person=0;if(active()||legacy()||!evaluate('tp_'+hand))throw Error('Secret FP leaked into observer view');
}
''')

    def test_canonical_random_legacy_hold_and_hidden_alt_clock_are_both_preserved(self):
        from native_eating_clock import ASSIGNMENT
        for name in ('grilled_gluten_skewer','ordinary_skewer'):
            from build_review_three_eating_projection import predecessor_document
            path=generator.RP/'attachables'/(name+'.attachable.json')
            canonical=predecessor_document(path,json.loads(path.read_text()))['minecraft:attachable']['description']
            alt=owner_property_predecessor(json.loads((generator.RP/'attachables'/(name+generator.ALT_SUFFIX+'.attachable.json')).read_text()))['minecraft:attachable']['description']
            self.assertFalse(any(key.startswith('fp_eat_') for key in canonical['animations']))
            self.assertEqual(canonical['geometry'],alt['geometry'])
            self.assertEqual(canonical['textures'],alt['textures'])
            self.assertEqual(alt['scripts']['pre_animation'][0],expression(ASSIGNMENT,attachable=True))
            self.assertNotIn('q.item_in_use_duration',' '.join(alt['scripts']['pre_animation']))
            for hand,slot in [('right','main_hand'),('left','off_hand')]:
                row=next(row for row in canonical['scripts']['animate'] if 'fp_'+hand in row)
                self.assertEqual(row['fp_'+hand],"c.is_first_person == 1 && c.item_slot == '"+slot+"'")
                self.assertEqual(alt['animations']['fp_eat_'+hand],generator.item_animation_id('THREE_ALT',hand))


if __name__=='__main__':unittest.main()
