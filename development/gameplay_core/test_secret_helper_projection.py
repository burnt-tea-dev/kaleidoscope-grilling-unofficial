"""Owned raw helper/occupancy regressions; never native-render acceptance."""
import json
from pathlib import Path
import sys
import unittest
from test_eating_observer_projection import node

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
import build_java_eating_projection as projection
import java_dual_eating_frames as dual
from build_java_dual_eating_projection import PIECE_BINDING
from generated_food_sprite import helper_assets,main_faces


class SecretHelperProjection(unittest.TestCase):
    def test_pass_masks_only_admit_their_own_mesh_bone(self):
        controllers=json.loads((projection.RP/'render_controllers/secret_held.render_controllers.json').read_text())['render_controllers']
        for name,row in controllers.items():
            self.assertEqual(row['part_visibility'][0],{'*':0})
            self.assertEqual(len(row['part_visibility']),2)
            expected='dual_piece' if name.endswith('.piece') else 'skewer_model'
            self.assertEqual(set(row['part_visibility'][1]),{expected})
        node('const controllers='+json.dumps(controllers)+r''';
const bones=['grip','skewer_pose','skewer_model','dual_piece'];
for(const occupied of [0,1])for(const stage of [0,1,2,3])for(const piece of [0,1]){
 const v={kg_secret_owner_occupied:occupied,kg_bite_stage:stage,kg_secret_piece_visible:piece};
 for(const [name,row] of Object.entries(controllers))for(const bone of bones){
  let visible=true;
  for(const entry of row.part_visibility)for(const [target,expression] of Object.entries(entry))
   if(target==='*'||target===bone)visible=Boolean(typeof expression==='number'?expression:new Function('v','return '+expression)(v));
  const own=name.endsWith('.piece')?'dual_piece':'skewer_model';
  if(bone!==own&&visible)throw Error('Cross-pass mesh admitted');
  if(bone===own){
   const gate=row.part_visibility[1][own],expected=Boolean(new Function('v','return '+gate)(v));
   if(visible!==expected)throw Error('Owned mesh guard changed');
  }
 }
}
''')

    def test_only_one_main_shaft_and_one_selected_centered_none_helper_sprite(self):
        path=projection.RP/'models/entity/secret_held.geo.json'
        geos=json.loads(path.read_text())['minecraft:geometry']
        helper_geometries,selected=helper_assets()
        self.assertEqual(len(geos),107)
        variants=json.loads((projection.RP/'models/entity/secret_helper_sprites.geo.json').read_text())['minecraft:geometry']
        self.assertEqual(len(variants),len(helper_geometries)-1)
        piece=next(g for g in geos if g['description']['identifier']=='geometry.kg_secret_held.piece')
        self.assertEqual(piece['bones'][0],{'name':'grip','pivot':[0,24,0],'binding':PIECE_BINDING})
        self.assertEqual(piece['bones'][1]['parent'],'grip')
        self.assertEqual(piece['bones'][1]['cubes'],[main_faces()])
        for helper in helper_geometries:
            self.assertEqual(helper['bones'][1]['cubes'][0],main_faces())
        shafts=[c for g in geos for b in g['bones'] for c in b.get('cubes',[]) if c['size']==[0.5,0.5,12.5]]
        self.assertEqual(len(shafts),1)
        # Pinned helper scale; no early helper and no source-arm/camera adjustment.
        self.assertEqual(dual.ARRAYS['SECOND_ITEM_SCALE_TIMES'],[3.5,3.54167,4.16667,4.20833])
        for t,scale in [(0,0),(3.4,0),(3.54167,1),(4,1),(4.20833,0),(5,0)]:
            self.assertAlmostEqual(dual.authored_pose('THREE',t)[3][2],scale)

    def test_owning_hand_occupancy_and_raw_piece_fail_closed_without_hiding_retained_food(self):
        descs=[json.loads((projection.RP/'attachables'/(identifier.split(':')[1]+'.attachable.json')).read_text())['minecraft:attachable']['description'] for identifier in projection.SECRET_PROFILES]
        controllers=json.loads((projection.RP/'render_controllers/secret_held.render_controllers.json').read_text())['render_controllers']
        node('const descriptions='+json.dumps(descs)+';const controllers='+json.dumps(controllers)+r''';
for(const d of descriptions)for(const hand of ['main_hand','off_hand']){
 let ownerHeld=d.identifier,using=true;
 const alternate=d.identifier.endsWith('_java_three_alt'),code=alternate?4:3,ticks=alternate?90:100;
 const owner={has_property:()=>true,property:n=>n.endsWith('_piece')?15:n.endsWith('_0')?4:n.endsWith('_1')?5:6,
  is_item_name_any:(slot,...names)=>slot===(hand==='main_hand'?'slot.weapon.mainhand':'slot.weapon.offhand')&&names.includes(ownerHeld)};
 const q={get is_using_item(){return using},main_hand_item_use_duration:ticks-75,frame_alpha:1,
  is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,is_item_equipped:()=>0,
  property:n=>({eat_native_ticks:ticks,eat_elapsed_ticks:75,eat_profile:code,eat_hand:hand==='main_hand'?1:2,eat_projection:1})[n.split(':')[1]],
  is_item_name_any:(slot,...names)=>slot===(hand==='main_hand'?'slot.weapon.mainhand':'slot.weapon.offhand')&&names.includes(d.identifier)};
 const secretProperty=owner.property;owner.property=n=>n.startsWith('kaleidoscope_grilling:eat_')?q.property(n):secretProperty(n);
 const c={is_first_person:1,item_slot:hand,owning_entity:owner},v={},math={clamp:(n,a,b)=>Math.max(a,Math.min(b,n))};
 const update=()=>evaluatePreAnimation(d.scripts.pre_animation,q,c,math,v);
 const visible=(controller,bone)=>Boolean(new Function('v','return '+controllers[controller].part_visibility.find(row=>bone in row)[bone])(v));
 update();if(v.kg_secret_piece_index!==15||v.kg_secret_ingredient_2!==6)throw Error('Raw helper borrowed cooked slot');
 if(Boolean(v.kg_secret_piece_visible)===alternate)throw Error('THREE helper missing or ALT helper invented');
 ownerHeld='minecraft:apple';update();if(v.kg_secret_owner_occupied||v.kg_secret_piece_visible)throw Error('Old attachable survived changed owner item');
 for(const slot of [0,1,2])if(visible('controller.render.kg_secret_held.'+slot,'skewer_model'))throw Error('Old ingredient visible after owner swap');
 if(visible('controller.render.kg_secret_held.stick','skewer_model'))throw Error('Old shaft visible after owner swap');
 ownerHeld=d.identifier;using=false;update();
 if(v.kg_bite_stage!==0||!v.kg_secret_owner_occupied||v.kg_secret_piece_visible)throw Error('Stopped retained serving was hidden/frozen');
 for(const slot of [0,1,2])if(!visible('controller.render.kg_secret_held.'+slot,'skewer_model'))throw Error('Retained/new serving lost idle food');
 // Completion zeroes the owned snapshot before an old client item disappears.
 // Even when the stopped clock resets stage zero, no shaft or food may return.
 const retained=owner.property;owner.property=()=>0;update();
 if(v.kg_bite_stage!==0||v.kg_secret_owner_occupied||v.kg_secret_piece_visible)throw Error('Completed snapshot regained occupancy');
 for(const controller of ['stick','0','1','2'])if(visible('controller.render.kg_secret_held.'+controller,'skewer_model'))throw Error('Completed stage-zero flash');
 owner.property=retained;update();if(!v.kg_secret_owner_occupied)throw Error('Fresh authoritative serving remained hidden');
 ownerHeld='';update();if(v.kg_secret_owner_occupied||visible('controller.render.kg_secret_held.stick','skewer_model'))throw Error('Consumed empty hand retained shaft');
}
''')

    def test_new_helper_schema_uses_exact_remaining_two_client_properties(self):
        path=projection.BP/'entities/player.json'
        properties=json.loads(path.read_text())['minecraft:entity']['description']['properties']
        self.assertEqual(len(properties),32)
        for hand in ('main','off'):
            self.assertEqual(properties['kaleidoscope_grilling:secret_'+hand+'_piece'],{'type':'int','range':[0,255],'default':0,'client_sync':True})


if __name__=='__main__':unittest.main()
