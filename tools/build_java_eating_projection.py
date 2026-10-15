"""Source-derived standing first-person branch; native clips are a separate gate.

TWO/THREE_ALT/FOUR, two fixed ONE/THREE representatives and owned secret meshes. Native pixels,
non-standing views and helper hands holding other items remain separate gates.
"""
from pathlib import Path
import json
import re
import sys
from types import SimpleNamespace
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'development/gameplay_core'))
from java_active_eating_frames import (PROFILES,ARRAYS,active_child_bone,
    native_arm_target)
from held_pose_frames import bedrock_rotation,point
from native_eating_clock import SECONDS, OFF_HAND_SECONDS
import build_java_dual_eating_projection as dual_renderer
from secret_active_calibration import position_expression as active_position_expression

P=ROOT/'projects/grilling/gameplay_core';RP=P/'resource_pack';BP=P/'behavior_pack'
PROPERTY='kaleidoscope_grilling:eat_projection'
CODES={'ONE':1,'TWO':2,'THREE':3,'THREE_ALT':4,'FOUR':5}
ALL_PROFILES=PROFILES+('ONE','THREE')
# Eye height/camera calibration is deliberately bounded to upright normal use.
CONTEXT=("q.is_using_item && q.property('"+PROPERTY+"') == 1 && "
         "q.is_sneaking == 0 && q.is_swimming == 0 && q.is_gliding == 0 && q.is_riding == 0")

def number(n):
    if abs(n)<1e-8:n=0
    return format(n,'.8f').rstrip('0').rstrip('.') or '0'

def rounded_channel(value):
    # libm cancellation may produce either zero sign on different platforms.
    value=round(value,8)
    return 0.0 if value==0 else value

def initial_euler(value):
    # Choose one representative only at the first key. Wrapping every key
    # would turn a continuous curve into a spurious full-spin interpolation.
    value=(value+180.0)%360.0-180.0
    if abs(abs(value)-180.0)<1e-8:return -180.0
    return value

def unwrap(values,previous):
    if previous is None:return [initial_euler(v) for v in values]
    return [v+360*round((old-v)/360)for v,old in zip(values,previous)]

def sample_times():
    times={round(i/60,6)for i in range(271)}
    for key,rows in ARRAYS.items():
        if key.endswith('_TIMES'):times.update(float(v)for v in rows if 0<=v<=4.5)
    times.update([.45833,.95833,1.20833,2.25,2.33333,4.5])
    return sorted(times)

def item_animation_id(profile,hand):return 'animation.kg_java_eating.item.'+profile.lower()+'.'+hand
def player_animation_id(profile,hand):return 'animation.kg_java_eating.player.'+profile.lower()+'.'+hand
def secret_item_animation_id(profile,hand):
    return item_animation_id(profile,hand)

ALT_SUFFIX='_java_three_alt'
SECRET='kaleidoscope_grilling:secret_skewer'
SECRET_PROFILES={SECRET:'THREE',SECRET+ALT_SUFFIX:'THREE_ALT'}

def actual_profile(identifier,table):
    if identifier in SECRET_PROFILES:return SECRET_PROFILES[identifier]
    if identifier.endswith(ALT_SUFFIX):
        base=identifier[:-len(ALT_SUFFIX)]
        return 'THREE_ALT' if table.get(base)=='THREE_RANDOM' else None
    if identifier in dual_renderer.REPRESENTATIVES:return dual_renderer.REPRESENTATIVES[identifier]
    profile=table.get(identifier)
    return profile if profile in PROFILES else None

def fixed_geometry(description):
    # A geometry prefix alone admits another food's mesh. Require this food's
    # existing five bite aliases and actual owned geometry files instead.
    identifier=description['identifier']
    base=identifier[:-len(ALT_SUFFIX)] if identifier.endswith(ALT_SUFFIX) else identifier
    name=base.split(':')[-1]
    folder=RP/'models/entity/a287_hand'
    stages=[]
    for i in range(5):
        path=folder/f'kg_a22.{name}.stage{i}.geo.json'
        if not path.is_file():continue
        geometries=json.loads(path.read_text()).get('minecraft:geometry',[])
        if not any(geometry.get('description',{}).get('identifier')==f'geometry.kg_a287.kg_a22.{name}.stage{i}' for geometry in geometries):return False
        stages.append(i)
    if not stages or stages!=list(range(max(stages)+1)):return False
    expected={f'stage{i}':f'geometry.kg_a287.kg_a22.{name}.stage{min(i,max(stages))}' for i in range(5)}
    return {key:value for key,value in description['geometry'].items() if key!='java_piece'}==expected

def secret_geometry(description,overrides=None):
    """Admit exact pinned cells/shaft and verified raw-last sprite outlines."""
    from secret_skewer_assets import held_geometries,partial_geometries
    if description['identifier'] not in SECRET_PROFILES:return False
    expected=held_geometries()
    refs={g['description']['identifier'].rsplit('.',1)[1]:g['description']['identifier']for g in expected}
    refs['java_secret_piece']=refs.pop('piece')
    if description.get('geometry')!=refs:return False
    controllers=['controller.render.kg_secret_held.stick']+[f'controller.render.kg_secret_held.{slot}'for slot in range(3)]+['controller.render.kg_secret_held.piece']
    if description.get('render_controllers')!=controllers:return False
    path=RP/'models/entity/secret_held.geo.json';overrides={}if overrides is None else overrides
    if path not in overrides and not path.is_file():return False
    actual=overrides.get(path)or json.loads(path.read_text())
    variants=[g for g in expected if g['description']['identifier'].startswith('geometry.kg_secret_held.piece_')]
    main=[g for g in expected if g not in variants]
    if actual!={'format_version':'1.21.0','minecraft:geometry':main+partial_geometries()}:return False
    helper_path=RP/'models/entity/secret_helper_sprites.geo.json'
    if helper_path not in overrides and not helper_path.is_file():return False
    helper=overrides.get(helper_path)or json.loads(helper_path.read_text())
    if isinstance(helper,str):helper=json.loads(helper)
    return helper=={'format_version':'1.21.0','minecraft:geometry':variants}

def projection_items(overrides=None):
    table=json.loads(re.search(r'PROFILE_BY_ITEM=Object.freeze\((\{.*?\})\)',(BP/'scripts/data.js').read_text()).group(1))
    items={profile:[] for profile in ALL_PROFILES}
    overrides={} if overrides is None else overrides
    paths=set((RP/'attachables').glob('*.json'))|{path for path in overrides if path.parent==RP/'attachables'}
    for path in sorted(paths):
        d=overrides.get(path) or json.loads(path.read_text())
        d=d['minecraft:attachable']['description'];identifier=d['identifier']
        profile=actual_profile(identifier,table)
        owned_geometry=secret_geometry(d,overrides) if identifier in SECRET_PROFILES else fixed_geometry(d)
        if profile not in ALL_PROFILES or not owned_geometry:continue
        item_path=BP/'items'/(identifier.split(':')[1]+'.json')
        item=overrides.get(item_path) or (json.loads(item_path.read_text()) if item_path.is_file() else {})
        duration=item.get('minecraft:item',{}).get('components',{}).get('minecraft:use_modifiers',{}).get('use_duration')
        if duration!=(5 if profile=='THREE' else 4.5):continue
        items[profile].append(identifier)
    return items

def held_profile_condition(profile,hand,items=None):
    # Exact identities close the packet-order window where a previous eat
    # property is still true after selecting a shaker or a different profile.
    items=projection_items() if items is None else items
    if not items[profile]:return '0'
    names=','.join("'"+ident+"'" for ident in items[profile])
    slot='slot.weapon.mainhand' if hand=='right' else 'slot.weapon.offhand'
    code=1 if hand=='right' else 2
    condition=("q.property('kaleidoscope_grilling:eat_profile') == "+str(CODES[profile])+
            " && q.property('kaleidoscope_grilling:eat_hand') == "+str(code)+
            " && q.is_item_name_any('"+slot+"',"+names+")")
    if profile in ('ONE','THREE'):condition+=' && '+dual_renderer.empty_helper(hand)
    elif SECRET+ALT_SUFFIX in items[profile]:
        # Secret ALT shares the authored active-arm clip, but never suppresses
        # an equipped helper item. Other fixed ALT foods retain their guards.
        condition+=" && (q.is_item_name_any('"+slot+"','"+SECRET+ALT_SUFFIX+"') == 0 || "+dual_renderer.empty_helper(hand)+')'
    return condition

def projection_condition(items=None):
    items=projection_items() if items is None else items
    branches=['('+held_profile_condition(profile,hand,items)+')'
              for profile in ALL_PROFILES for hand in ('right','left')]
    return CONTEXT+' && ('+' || '.join(branches)+')'

def animations(items=None):
    item_animations={};player_animations={};items=projection_items() if items is None else items
    for profile in PROFILES:
        for hand,sign in [('right',1),('left',-1)]:
            arm=hand+'arm';socket=hand+'item';other=('left'if hand=='right'else'right')+'item'
            slim=("math.abs(q.get_default_bone_pivot('"+arm+"', 1) - 21.5) < 0.01")
            positions={};rotations={};arm_positions={};arm_rotations={};socket_positions={}
            last_item=None;last_arm=None
            for t in sample_times():
                key=number(t)
                wide=active_child_bone(profile,t,sign,False)
                narrow=active_child_bone(profile,t,sign,True)
                # Resolve rig shape in the player animation component, never
                # through an attachable owning_entity geometry assumption.
                # O is translation-only, so a child-origin delta can be moved
                # unchanged into the normalized player item socket.
                positions[key]=[rounded_channel(a) for a in wide['position']]
                socket_base=['0',"q.get_default_bone_pivot('"+arm+"',1) - q.get_default_bone_pivot('"+socket+"',1) - 7",
                             "-q.get_default_bone_pivot('"+socket+"',2)"]
                socket_positions[key]=[base+' + ('+slim+' ? '+number(b-a)+' : 0)'
                                       for base,a,b in zip(socket_base,wide['position'],narrow['position'])]
                rotation=unwrap(wide['rotation'],last_item);last_item=rotation
                rotations[key]=[rounded_channel(v)for v in rotation]
                target=native_arm_target(profile,t,sign)
                at=point(target,[0,0,0]);at[0]*=-1
                arm_positions[key]=[active_position_expression(profile,hand,target,i,number(at[i])+" - q.get_default_bone_pivot('"+arm+"', "+str(i)+")",number)for i in range(3)]
                rotation=unwrap(bedrock_rotation(target),last_arm);last_arm=rotation
                arm_rotations[key]=[rounded_channel(v)for v in rotation]
            common={'loop':'hold_on_last_frame','animation_length':4.5,'anim_time_update':OFF_HAND_SECONDS if hand=='left' else SECONDS}
            item_animations[item_animation_id(profile,hand)]={**common,'bones':{
                'skewer_pose':{'position':positions,'rotation':rotations,'scale':[1,1,1]},
                'skewer_model':{'position':[0,0,0],'rotation':[0,0,0],'scale':[1,1,1]}}}
            player_animations[player_animation_id(profile,hand)]={**common,'override_previous_animation':True,
                'blend_weight':'variable.is_first_person && '+CONTEXT+' && '+held_profile_condition(profile,hand,items),
                'bones':{
                    arm:{'position':arm_positions,'rotation':arm_rotations},
                    socket:{'position':socket_positions,
                            'rotation':[0,0,0]},
                    other:{'scale':0}}}
    dual_items,dual_players=dual_renderer.animations(SimpleNamespace(**globals()),items)
    item_animations.update(dual_items);player_animations.update(dual_players)
    return item_animations,player_animations

def augment(output,profile_table):
    items=projection_items(output)
    item,player=animations(items)
    output[RP/'animations/java_eating_projection.animation.json']={'format_version':'1.8.0','animations':item}
    output[RP/'animations/java_eating_player.animation.json']={'format_version':'1.8.0','animations':player}
    ids=[]
    for path,doc in list(output.items()):
        if path.parent!=RP/'attachables':continue
        d=doc['minecraft:attachable']['description']
        profile=actual_profile(d['identifier'],profile_table)
        if profile not in ALL_PROFILES or d['identifier'] not in items[profile]:continue
        ids.append(d['identifier'])
        d['scripts']['animate']=[row for row in d['scripts']['animate']if not any(k.startswith('fp_eat_')for k in row)]
        conditions=[]
        for hand,slot,code in [('right','main_hand',1),('left','off_hand',2)]:
            active=("c.is_first_person == 1 && "+CONTEXT+" && q.property('kaleidoscope_grilling:eat_profile') == "+str(CODES[profile])+
                    " && q.property('kaleidoscope_grilling:eat_hand') == "+str(code)+" && c.item_slot == '"+slot+"'")
            active+=' && '+held_profile_condition(profile,hand,{profile:[d['identifier']]})
            conditions.append(active)
            for row in d['scripts']['animate']:
                if 'fp_'+hand in row:
                    row['fp_'+hand]="c.is_first_person == 1 && c.item_slot == '"+slot+"' && ("+active+") == 0"
                for key in ('eat_'+hand,'eat_alt_'+hand):
                    if key in row:row[key]='('+row[key]+') && ('+active+') == 0'
            alias='fp_eat_'+hand
            d['animations'][alias]=secret_item_animation_id(profile,hand) if d['identifier'] in SECRET_PROFILES else item_animation_id(profile,hand)
            d['scripts']['animate'].append({alias:active})
        if profile in ('ONE','THREE') and d['identifier'] in dual_renderer.REPRESENTATIVES:
            # Rebuilding an already generated document is idempotent.
            d['render_controllers']=[ref for ref in d['render_controllers'] if ref!=dual_renderer.PIECE_CONTROLLER]
            d['scripts']['pre_animation']=[row for row in d['scripts']['pre_animation'] if not row.startswith('v.kg_java_piece_visible = ')]
            dual_renderer.attach_piece(output,SimpleNamespace(**globals()),d,profile,conditions)
        if d['identifier'] in SECRET_PROFILES:
            from build_secret_held import owner_occupancy
            rows=d['scripts']['pre_animation']
            rows=[row for row in rows if not row.startswith(('v.kg_secret_piece_visible = ','v.kg_secret_owner_occupied = '))]
            rows.append(owner_occupancy(d['identifier']))
            visible='v.kg_secret_owner_occupied == 1 && v.kg_secret_piece_index > 0 && ('+' || '.join('('+c+')' for c in conditions)+')' if profile=='THREE' else '0'
            rows.append('v.kg_secret_piece_visible = '+visible+';')
            d['scripts']['pre_animation']=rows
    output[RP/'render_controllers/java_eating_piece.render_controllers.json']=dual_renderer.controller()
    native=json.loads((ROOT/'development/gameplay_core/fixtures/native-first-person-controller-1.26.50.4.json').read_text())['controller']
    controller=json.loads(json.dumps(native))
    owned="q.has_property('"+PROPERTY+"') && "+projection_condition(items)
    for row in controller['part_visibility']:
        for bone,expression in list(row.items()):
            if bone in ('rightArm','rightSleeve','leftArm','leftSleeve'):
                hand=1 if bone.startswith('right')else 2
                row[bone]='('+owned+") ? (q.property('kaleidoscope_grilling:eat_profile') == 1 || q.property('kaleidoscope_grilling:eat_profile') == 3 || q.property('kaleidoscope_grilling:eat_hand') == "+str(hand)+') : ('+expression+')'
    output[RP/'render_controllers/java_eating_player.render_controllers.json']={'format_version':'1.8.0','render_controllers':{'controller.render.player.first_person':controller}}
    # Data-only eligibility: exact owned secret meshes use the same main-item
    # frame without borrowing fixed food/helper geometry. Failed meshes stay legacy.
    output[BP/'scripts/java_eating_projection_items.js']=(
        '// Exact owned geometry eligibility for the scoped Java first-person projection.\n'
        'export const JAVA_FP_EATING_ITEMS=Object.freeze('+json.dumps(sorted(ids))+');\n'
        'export const JAVA_FP_EATING_ITEMS_BY_PROFILE=Object.freeze(Object.fromEntries(Object.entries('
        +json.dumps(items)+').map(([profile,items])=>[profile,Object.freeze(items)])));\n'
        'export function supportsJavaEatingProjection(id,profile){return Object.hasOwn(JAVA_FP_EATING_ITEMS_BY_PROFILE,profile)&&JAVA_FP_EATING_ITEMS_BY_PROFILE[profile].includes(id);}\n')
    return output
