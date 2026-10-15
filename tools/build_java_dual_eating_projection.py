"""ONE/THREE representative runtime renderer; native pixels remain unaccepted.

The owned attachable renders a second mesh bound to the helper socket. No
entity, ItemStack replacement, metadata conversion or offhand write is used.
"""
import importlib.util
import json
import hashlib
import tempfile
from pathlib import Path
import java_dual_eating_frames as dual
from java_eating_piece_resolver import available_fixed_piece
from held_pose_frames import (point, bedrock_rotation, chain, translate,
                              bone_matrix, native_skewer_calibration)
from native_eating_clock import SECONDS, OFF_HAND_SECONDS
from secret_active_calibration import position_expression as active_position_expression

REPRESENTATIVES = {'kaleidoscope_grilling:grilled_fish_skewer': 'ONE',
                   'kaleidoscope_grilling:grilled_ender_pearl_skewer': 'THREE'}
PIECE_CONTROLLER = 'controller.render.kg_java_eating.piece'
PIECE_BINDING = "q.item_slot_to_bone_name(context.item_slot == 'main_hand' ? 'off_hand' : 'main_hand')"

def empty_helper(hand):
    return "q.is_item_equipped('"+('off_hand' if hand == 'right' else 'main_hand')+"') == 0"


def one_right_vertical_alignment(g):
    """Data-derived view-plane placement adaptation; never source camera parity.

    The native-visible6503 frame supplies the prior vertical repair. Restore
    authored X, retain source depth and all curves/rotations/gestures. The
    original constant X alignment becomes magnified at authored mouth entry.
    """
    fixture = json.loads((g.ROOT/'development/gameplay_core/fixtures/fish-one-vertical-alignment-g66-private.json').read_text())
    source = g.ROOT/fixture['held_source']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == fixture['held_source_sha256'], 'Idle anchor requires fresh native evidence'
    held = json.loads(source.read_text())['animations']['animation.kg_a287.skewer_fp_right']['bones']['skewer_pose']
    assert held == fixture['held_bone']
    base, camera = native_skewer_calibration('right')
    idle = chain(base,translate([0,24,0]),bone_matrix(held),translate([0,-24,0]))
    initial = chain(dual.native_arm_target('ONE',0,1,True),dual.REFLECT,
                    dual.java_item_child('ONE',0,1,True),translate([0,-32,0]))
    pivot = fixture['geometry_root_pivot']
    actual, authored = point(idle,pivot), point(initial,pivot)
    # Do not pull the source toward the near plane to match idle display depth.
    return [0.0,actual[1]-authored[1],0.0]

def animations(g, items):
    item = {}; player = {}
    one_right_alignment = one_right_vertical_alignment(g)
    times = sorted(set(g.sample_times()) | {round(i/60,6) for i in range(301)} |
                   {float(v) for k, rows in dual.ARRAYS.items() if k.endswith('_TIMES')
                    for v in rows if 0 <= v <= 5})
    for profile in dual.PROFILES:
        for hand, sign in [('right',1), ('left',-1)]:
            length = 4.5 if profile == 'ONE' else 5.0
            mesh = {'skewer_pose': {'position': {}, 'rotation': {}, 'scale': [1,1,1]},
                    'skewer_model': {'position': [0,0,0], 'rotation': [0,0,0], 'scale': [1,1,1]},
                    'dual_piece': {'position': {}, 'rotation': {}, 'scale': {}}}
            bones = {}; previous = {}
            for name, side, active in [(hand, sign, True), ('left' if hand == 'right' else 'right', -sign, False)]:
                arm = name+'arm'; socket = name+'item'
                bones[arm] = {'position': {}, 'rotation': {}}
                bones[socket] = {'position': {}, 'rotation': [0,0,0], 'scale': [1,1,1]}
                slim = "math.abs(q.get_default_bone_pivot('"+arm+"', 1) - 21.5) < 0.01"
                for t in times:
                    if t > length: continue
                    key = g.number(t)
                    fn = dual.child_bone if active else dual.helper_socket_bone
                    wide = fn(profile,t,sign,slim=False)
                    narrow = fn(profile,t,sign,slim=True)
                    child = mesh['skewer_pose' if active else 'dual_piece']
                    child['position'][key] = [g.rounded_channel(x) for x in wide['position']]
                    rotation = g.unwrap(wide['rotation'], previous.get(name+'child'))
                    previous[name+'child'] = rotation
                    child['rotation'][key] = [g.rounded_channel(x) for x in rotation]
                    if not active: child['scale'][key] = [g.rounded_channel(x) for x in wide['scale']]
                    base = ['0', "q.get_default_bone_pivot('"+arm+"',1) - q.get_default_bone_pivot('"+socket+"',1) - 7",
                            "-q.get_default_bone_pivot('"+socket+"',2)"]
                    bones[socket]['position'][key] = [b+' + ('+slim+' ? '+g.number(n-w)+' : 0)'
                                                       for b,w,n in zip(base,wide['position'],narrow['position'])]
                    target = dual.native_arm_target(profile,t,side,active)
                    location = point(target,[0,0,0])
                    if profile == 'ONE' and hand == 'right':
                        location = [value+delta for value,delta in zip(location,one_right_alignment)]
                    location[0] *= -1
                    bones[arm]['position'][key] = [active_position_expression(profile,hand,target,i,g.number(location[i])+" - q.get_default_bone_pivot('"+arm+"', "+str(i)+")",g.number)for i in range(3)]
                    rotation = g.unwrap(bedrock_rotation(target),previous.get(name+'arm'))
                    previous[name+'arm'] = rotation
                    bones[arm]['rotation'][key] = [g.rounded_channel(x) for x in rotation]
            if profile == 'ONE':
                # Exact Java threshold, never a scale interpolation before it.
                mesh['dual_piece']['scale'] = ['v.kg_eat_seconds >= 1.16667 ? 1 : 0']*3
            common = {'loop': 'hold_on_last_frame', 'animation_length': length, 'anim_time_update': OFF_HAND_SECONDS if hand=='left' else SECONDS}
            item[g.item_animation_id(profile,hand)] = {**common,'bones':mesh}
            player[g.player_animation_id(profile,hand)] = {**common,'override_previous_animation':True,
                'blend_weight':'variable.is_first_person && '+g.CONTEXT+' && '+g.held_profile_condition(profile,hand,items), 'bones':bones}
    return item,player

def piece_assets(g, identifier, profile):
    model_id = available_fixed_piece(g.ROOT,identifier,profile)
    if model_id is None: raise ValueError('Missing pinned Java piece: '+identifier)
    spec = importlib.util.spec_from_file_location('java_asset_export',g.ROOT/'projects/grilling/tools/build_assets.py')
    exporter = importlib.util.module_from_spec(spec);spec.loader.exec_module(exporter)
    model = exporter.resolve_model(model_id)
    name = identifier.split(':')[1]
    texture = g.RP/'textures/java_eating_piece'/ (name+'.png')
    # --check must not write into the pack.
    with tempfile.TemporaryDirectory() as temporary:
        atlas = Path(temporary)/'piece.png'
        placement = exporter.build_atlas(model,atlas)
        png = atlas.read_bytes()
    document = exporter.geometry(model,name,placement,[[0,0]],allow_native_uv_rotation=True)
    geometry = document['minecraft:geometry'][0]
    geometry['description']['identifier'] = 'geometry.kg_java_dual.piece.'+name
    geometry['description']['visible_bounds_width'] = 8
    geometry['description']['visible_bounds_height'] = 8
    cubes = []
    for bone in geometry['bones']:
        for cube in bone.get('cubes',[]):
            cube['origin'][1] += 24
            if 'pivot' in cube: cube['pivot'][1] += 24
            cubes.append(cube)
    geometry['bones'] = [{'name':'grip','pivot':[0,24,0],'binding':PIECE_BINDING},
                         {'name':'dual_piece','parent':'grip','pivot':[0,24,0],'cubes':cubes}]
    return {g.RP/'models/entity/java_eating_piece'/(name+'.geo.json'):document, texture:png}, geometry['description']['identifier'], texture.relative_to(g.RP).with_suffix('').as_posix()

def attach_piece(output, g, description, profile, active_conditions):
    assets, geometry, texture = piece_assets(g,description['identifier'],profile)
    output.update(assets)
    description['geometry']['java_piece'] = geometry
    description['textures']['java_piece'] = texture
    description['render_controllers'].append(PIECE_CONTROLLER)
    guard = '('+' || '.join('('+c+')' for c in active_conditions)+')'
    # Local visibility variable belongs to this exact attachable and is reset
    # each frame, including release, TP, changed hand, item or profile.
    description['scripts']['pre_animation'].append('v.kg_java_piece_visible = '+guard+';')

def controller():
    return {'format_version':'1.8.0','render_controllers':{PIECE_CONTROLLER:{
        'geometry':'Geometry.java_piece','materials':[{'*':'Material.default'}],
        'textures':['Texture.java_piece'],
        'part_visibility':[{'*':'v.kg_java_piece_visible == 1'}]}}}
