"""Rebuild the existing attachable pose clips from pinned Java motion.

No new runtime layer or player.json. The established item-slot binding is kept
explicit at one conversion boundary; its camera/skin fit still needs Blockbench
and a Bedrock client. Sampled JSON is a build output, never the motion source.
"""
from __future__ import annotations
import argparse
import copy
import json
import math
from pathlib import Path
try: from .motion import *
except ImportError: from motion import *

RP=ROOT/'projects/grilling/gameplay_core/resource_pack'
AXIS_Y=scale(1,-1,1)
AXIS_X=scale(-1,1,1)

def bedrock_item_matrix(profile, side, value, helper=False):
    sign=1 if side=='right' else -1
    java=item_matrix(profile,side,value,helper)
    # Java ItemRenderer centres ordinary item vertices by (-8,-8,-8).
    # Fixed helper geometries use the same vertical centring; their source
    # scale also scales this offset, including invisible zero-scale samples.
    centre=translate(0,-8,0)
    return compose(translate(sign,7,0),AXIS_Y,java,centre,AXIS_X)

def euler_zyx(matrix, previous=None):
    """Bedrock Z*Y*X Euler decomposition, continuous across +/-180 degrees."""
    sy=max(-1,min(1,-matrix[2][0])); y=math.asin(sy)
    if abs(math.cos(y))>1e-8:
        x=math.atan2(matrix[2][1],matrix[2][2]);z=math.atan2(matrix[1][0],matrix[0][0])
    else:
        x=math.atan2(-matrix[1][2],matrix[1][1]);z=0
    # Retain the established Bedrock item-slot local basis, not a camera basis.
    result=[-math.degrees(x),math.degrees(y),-math.degrees(z)]
    if previous is not None:
        result=[a+360*round((p-a)/360) for a,p in zip(result,previous)]
    return result

def channels(profile, side, seconds, helper=False, previous=None):
    pose=sample(profile,seconds)
    physical=('left'if side=='right'else'right')if helper else side
    value=pose['piece'if helper else'main']
    # Decompose orientation before scale: a zero-scale helper still needs its
    # authored orientation when it becomes visible, never an arbitrary reset.
    unscaled=[*value[:6],1]
    matrix=bedrock_item_matrix(profile,physical,unscaled,helper)
    positioned=bedrock_item_matrix(profile,physical,value,helper)
    return {'position':[positioned[i][3]for i in range(3)],'rotation':euler_zyx(matrix,previous),'scale':[value[6]]*3}

def rounded(values):return [round(v,8)for v in values]

def piece_scale_expression(profile):
    if profile=='ONE':return '(v.kg_eat_seconds >= 1.16667 ? 1 : 0)'
    if profile!='THREE':return '0'
    # Java clamped Catmull-Rom for [0,1,1,0] at these source keys.
    # The middle segment overshoots one and is clamped to one.
    t='((v.kg_eat_seconds - 3.5) / (3.54167 - 3.5))'
    u='((v.kg_eat_seconds - 4.16667) / (4.20833 - 4.16667))'
    ramp=lambda q:'(0.5 * ('+q+' + 3 * '+q+' * '+q+' - 2 * '+q+' * '+q+' * '+q+'))'
    return '(v.kg_eat_seconds <= 3.5 ? 0 : (v.kg_eat_seconds < 3.54167 ? '+ramp(t)+' : (v.kg_eat_seconds <= 4.16667 ? 1 : (v.kg_eat_seconds < 4.20833 ? 1 - '+ramp(u)+' : 0))))'

def item_clip(profile,side,clock):
    tracks={'skewer_pose':{'position':{},'rotation':{},'scale':[1,1,1]},
            'skewer_model':{'position':[0,0,0],'rotation':[0,0,0],'scale':[1,1,1]}}
    if profile in ('ONE','THREE'):tracks['dual_piece']={'position':{},'rotation':{},'scale':{}}
    for name,helper in [('skewer_pose',False)]+([('dual_piece',True)]if profile in ('ONE','THREE')else[]):
        previous=None
        times=set(sample_times(profile))
        if helper and profile=='THREE':
            for begin,end in zip(DUAL['SECOND_ITEM_SCALE_TIMES'][::2],DUAL['SECOND_ITEM_SCALE_TIMES'][1::2]):
                divisions=math.ceil((end-begin)*480)
                times.update(begin+(end-begin)*i/divisions for i in range(divisions+1))
        for t in sorted(times):
            row=channels(profile,side,t,helper,previous);previous=row['rotation'];key=f'{t:.8f}'.rstrip('0').rstrip('.') or '0'
            for channel in ('position','rotation'):
                tracks[name][channel][key]=rounded(row[channel])
            if helper:tracks[name]['scale'][key]=rounded(row['scale'])
        if helper:
            # Preserve source step/clamped curve; linear scale keys would move
            # the first visible helper frame and the >.001 render threshold.
            tracks[name]['scale']=[piece_scale_expression(profile)]*3
    return {'loop':'hold_on_last_frame','animation_length':PROFILE_DATA['profiles'][profile]['duration_ticks']/20,'anim_time_update':clock,'bones':tracks}

def rebuild_items():
    current=json.loads((RP/'animations/java_eating_projection.animation.json').read_text())
    clocks={name:clip['anim_time_update']for name,clip in current['animations'].items()}
    return {'format_version':'1.8.0','animations':{
        name:item_clip(profile,side,clocks[name])
        for profile in PROFILES for side in ('right','left')
        for name in ['animation.kg_java_eating.item.'+profile.lower()+'.'+side]}}


PROFILE_CODES={p:i+1 for i,p in enumerate(PROFILES)}
# The three composited/custom surfaces retain their existing ownership and
# ingredient selectors; do not pretend their large baked models are rebuilt.
COMPOSITED={'kaleidoscope_grilling:secret_skewer','kaleidoscope_grilling:mysterious_skewer','kaleidoscope_grilling:dark_grilling'}

def fixed_routes():
    rows={}
    for ident,row in PROFILE_DATA['profile_by_item'].items():
        if ident in COMPOSITED:continue
        profile=row['profile']
        rows[ident]='THREE'if profile=='THREE_RANDOM'else profile
        if profile=='THREE_RANDOM':rows[ident+'_java_three_alt']='THREE_ALT'
    return rows

def tick_bite_expression(profile):
    expr='0'
    for index,second in enumerate(PROFILE_DATA['profiles'][profile]['bite_seconds'],1):
        # Java visualBiteStage intentionally has no partialTick. Every authored
        # checkpoint falls strictly between ticks or exactly at an integer tick.
        tick=math.ceil(second*20)
        expr=f'(v.kg_bite_ticks >= {tick} ? {index} : {expr})'
    return expr

def fixed_attachable(document,profile):
    """One held/custom/fallback route for one actual fixed family geometry."""
    out=copy.deepcopy(document);d=out['minecraft:attachable']['description'];ident=d['identifier']
    if fixed_routes().get(ident)!=profile:raise ValueError('outside fixed source scope')
    old=d['scripts']['pre_animation']
    # Retain property transport and the calibrated native clock boundary only.
    owner=old[:5]
    motion=next(s for s in old if s.startswith('v.kg_eat_seconds ='))
    pre=owner+[motion,
      "v.kg_active_slot = (c.item_slot == 'main_hand' && v.kg_owner_eat_hand == 1) || (c.item_slot == 'off_hand' && v.kg_owner_eat_hand == 2);",
      "v.kg_same_item = c.item_slot == 'main_hand' ? q.is_item_name_any('slot.weapon.mainhand','"+ident+"') : q.is_item_name_any('slot.weapon.offhand','"+ident+"');",
      "v.kg_using_owned = q.is_using_item && v.kg_active_slot && v.kg_same_item && v.kg_owner_eat_profile == "+str(PROFILE_CODES[profile])+";",
      # Native completion includes its start tick (D-1); Entity.setProperty
      # publishes next tick, so the last readable elapsed is D-2. This is
      # one documented property boundary, not a network-delay margin.
      # It can transiently mask an indistinguishable near-terminal replacement.
      "v.kg_terminal_wait = c.is_first_person == 1 && !q.is_using_item && v.kg_owner_eat_native_ticks > 0 && v.kg_owner_eat_elapsed_ticks >= v.kg_owner_eat_native_ticks - 2 && v.kg_active_slot && v.kg_same_item && v.kg_owner_eat_profile == "+str(PROFILE_CODES[profile])+" && v.kg_owner_eat_projection == 1;",
      # Match the pre-existing main-hand countdown origin but remove alpha;
      # the offhand/observer path already uses a replicated integer tick.
      "v.kg_bite_ticks = c.is_first_person == 1 && c.item_slot == 'main_hand' ? math.clamp(v.kg_owner_eat_native_ticks - q.main_hand_item_use_duration - 1, 0, v.kg_owner_eat_native_ticks) : v.kg_owner_eat_elapsed_ticks;",
      'v.kg_bite_stage = v.kg_using_owned ? '+tick_bite_expression(profile)+' : 0;',
      "v.kg_source_projection = c.is_first_person == 1 && v.kg_using_owned && v.kg_owner_eat_projection == 1 && q.is_sneaking == 0 && q.is_swimming == 0 && q.is_gliding == 0 && q.is_riding == 0;",
      'v.kg_source_piece_scale = '+piece_scale_expression(profile)+';',
      "v.kg_java_piece_visible = v.kg_source_projection && v.kg_source_piece_scale > 0.001;"]
    if profile in ('ONE','THREE'):
        pre=[line[:-1]+" && (c.item_slot == 'main_hand' ? q.is_item_equipped('off_hand') : q.is_item_equipped('main_hand')) == 0;"if line.startswith('v.kg_source_projection =')else line for line in pre]
    if ident=='kaleidoscope_grilling:grilled_slime_skewer':
        # Texture/geometry frame transport is independent of eating motion.
        # Preserve all five authored frames and all three bite geometries.
        pre += [
          "v.kg_slime_marker = (c.item_slot == 'off_hand' ? (c.owning_entity->q.has_property('kaleidoscope_grilling:secret_off_piece') ? c.owning_entity->q.property('kaleidoscope_grilling:secret_off_piece') : 0) : (c.owning_entity->q.has_property('kaleidoscope_grilling:secret_main_piece') ? c.owning_entity->q.property('kaleidoscope_grilling:secret_main_piece') : 0));",
          "v.kg_slime_frame = (((c.item_slot == 'main_hand' && c.owning_entity->q.is_item_name_any('slot.weapon.mainhand','kaleidoscope_grilling:grilled_slime_skewer')) || (c.item_slot == 'off_hand' && c.owning_entity->q.is_item_name_any('slot.weapon.offhand','kaleidoscope_grilling:grilled_slime_skewer'))) && v.kg_slime_marker >= 215 && v.kg_slime_marker <= 219) ? v.kg_slime_marker - 215 : 0;",
          "v.kg_slime_index = math.clamp(math.floor(v.kg_bite_stage), 0, 2) * 5 + v.kg_slime_frame;"]
    if ident=='kaleidoscope_grilling:grilled_caterpillar_skewer':
        # The source ONE helper replaces, rather than stacks with, the old probe.
        d['geometry'].pop('probe_piece',None);d['textures'].pop('probe_piece',None)
        d['render_controllers']=[ref for ref in d['render_controllers']if ref!='controller.render.kg_probe_caterpillar.piece']
    anim={k:d['animations'][k]for k in ('fp_right','fp_left','tp_right','tp_left')}
    for side in ('right','left'):
        anim['eat_'+side]='animation.kg_eating.item.'+profile.lower()+'.'+side
        anim['source_'+side]='animation.kg_java_eating.item.'+profile.lower()+'.'+side
    d['animations']=anim
    d['scripts']={'pre_animation':pre,'animate':[
        {'fp_right':"c.is_first_person == 1 && c.item_slot == 'main_hand' && !v.kg_source_projection"},
        {'fp_left':"c.is_first_person == 1 && c.item_slot == 'off_hand' && !v.kg_source_projection"},
        {'tp_right':"c.is_first_person == 0 && c.item_slot == 'main_hand'"},
        {'tp_left':"c.is_first_person == 0 && c.item_slot == 'off_hand'"},
        {'eat_right':"c.is_first_person == 1 && c.item_slot == 'main_hand' && v.kg_using_owned && !v.kg_source_projection"},
        {'eat_left':"c.is_first_person == 1 && c.item_slot == 'off_hand' && v.kg_using_owned && !v.kg_source_projection"},
        {'source_right':"c.item_slot == 'main_hand' && v.kg_source_projection"},
        {'source_left':"c.item_slot == 'off_hand' && v.kg_source_projection"}]}
    return out

def fixed_player_clips():
    """Rebuild source arm targets; keep the current item-slot/skin adapter.

    Motion is independently reconstructed in motion.py and source-oracle tested.
    This step deliberately does not recalibrate camera/skin offsets without the
    mandatory visual review, nor project FP tracks into third person.
    """
    doc=json.loads((RP/'animations/java_eating_player.animation.json').read_text())
    for p in PROFILES:
        ids=[ident for ident,profile in fixed_routes().items()if profile==p]
        for side,hand,slot in [('right',1,'mainhand'),('left',2,'offhand')]:
            name='animation.kg_java_eating.player.'+p.lower()+'.'+side
            clip=doc['animations'][name]
            # Secret keeps its existing empty-opposite-hand admission. The
            # two failure surfaces still use their independent player clips.
            native="variable.is_first_person && q.is_using_item && q.property('kaleidoscope_grilling:eat_projection') == 1 && q.is_sneaking == 0 && q.is_swimming == 0 && q.is_gliding == 0 && q.is_riding == 0 && q.property('kaleidoscope_grilling:eat_profile') == "+str(PROFILE_CODES[p])+" && q.property('kaleidoscope_grilling:eat_hand') == "+str(hand)
            scope="q.is_item_name_any('slot.weapon."+slot+"',"+','.join("'"+i+"'"for i in ids)+')'
            if p in ('ONE','THREE'):native+=" && q.is_item_equipped('"+('main_hand'if side=='left'else'off_hand')+"') == 0"
            if p in ('THREE','THREE_ALT'):
                secret='kaleidoscope_grilling:secret_skewer'+('_java_three_alt'if p=='THREE_ALT'else'')
                opposite_slot='main_hand'if side=='left'else'off_hand'
                secret_scope="q.is_item_name_any('slot.weapon."+slot+"','"+secret+"')"
                if p=='THREE':secret_scope+=" && q.is_item_equipped('"+opposite_slot+"') == 0"
                scope='('+scope+' || ('+secret_scope+'))'
            clip['blend_weight']=native+' && '+scope
            for physical,helper in [(side,False)]+([('left'if side=='right'else'right',True)]if p in ('ONE','THREE')else[]):
                bone=physical+'arm';positions={};rotations={}
                for key in clip['bones'][bone]['position']:
                    pose=arm_pose(p,physical,sample(p,float(key))['helper'if helper else'active'],helper)
                    target=[-pose[0],22.096-pose[1],-pose[2]]
                    positions[key]=[f"{round(v,8)} - q.get_default_bone_pivot('{bone}', {axis})"for axis,v in enumerate(target)]
                for key in clip['bones'][bone]['rotation']:
                    pose=arm_pose(p,physical,sample(p,float(key))['helper'if helper else'active'],helper)
                    rotations[key]=rounded([180+pose[3],-pose[4],180-pose[5]])
                clip['bones'][bone]={'position':positions,'rotation':rotations}
            if p not in ('ONE','THREE'):
                # Java's cancellable ItemInHand mixin does not draw the other
                # arm/item for active-only profiles. This masks rendering only.
                opposite='left'if side=='right'else'right'
                clip['bones'][opposite+'arm']={'scale':0}
    return doc

def review_bundle(output):
    """Copy actual held assets for operator-controlled Blockbench import.

    No desktop control, preview-variable rewrite, plugin loading or screenshots.
    Stage geometry and texture identities stay paired, including custom surfaces
    which are explicitly not reconstructed by this fixed-surface candidate.
    """
    import shutil
    output=Path(output).resolve()
    if output==ROOT or ROOT in output.parents:raise ValueError('review output must be outside the checkout')
    if output.exists() and any(output.iterdir()):raise ValueError('review output must be new/empty; preserve existing review')
    output.mkdir(parents=True,exist_ok=True)
    index={}
    for path in (RP/'models').rglob('*.json'):
        for geometry in json.loads(path.read_text()).get('minecraft:geometry',[]):
            index[geometry['description']['identifier']]=path
    copies=set();cases=[]
    routes=fixed_routes()
    for base in sorted(COMPOSITED):
        routes[base]='THREE';routes[base+'_java_three_alt']='THREE_ALT'
    for ident,p in sorted(routes.items()):
        path=RP/'attachables'/(ident.split(':')[1]+'.attachable.json')
        d=json.loads(path.read_text())['minecraft:attachable']['description'];copies.add(path)
        geometries={alias:index[ref]for alias,ref in d['geometry'].items()}
        textures={alias:RP/(ref+'.png')for alias,ref in d['textures'].items()}
        copies.update(geometries.values())
        missing=[alias for alias,path in textures.items()if not path.is_file()]
        if missing and ident in fixed_routes():raise ValueError('fixed texture missing: '+ident+': '+','.join(missing))
        copies.update(path for path in textures.values()if path.is_file())
        cases.append({'item':ident,'profile':p,'surface_rebuilt':ident in fixed_routes(),
            'geometry':{alias:str(p.relative_to(RP))for alias,p in geometries.items()},
            'geometry_identifiers':d['geometry'],
            'item_clips':d['animations'],
            'source_player_clips':['animation.kg_java_eating.player.'+p.lower()+'.'+side for side in ('right','left')],
            'profile_code':PROFILE_CODES[p],
            'helper_gate':'empty opposite hand at start and every frame; scale > 0.001'if p in ('ONE','THREE')else'active arm only',
            'preview_requirements':['Import actual geometry and matching texture; preserve binding until operator records a preview-only override.',
                'Native use/owner/identity queries are absent in editor: declare any clock, blend or query replacement; do not edit canonical source.',
                'Use physical right and left; do not label the built-in right-handed reference as native offhand acceptance.',
                'Import named item AND player clip; static item-only preview cannot establish mouth/hand alignment.'],
            'textures':{alias:str(p.relative_to(RP))for alias,p in textures.items()},
            'external_textures_not_copied':missing,
            'held_contexts':['fp_right','fp_left','tp_right','tp_left'],
            'bite_ticks':[math.ceil(t*20)for t in PROFILE_DATA['profiles'][p]['bite_seconds']],
            'motion_seconds':sorted(set([0,PROFILE_DATA['profiles'][p]['duration_ticks']/20]+PROFILE_DATA['profiles'][p]['bite_seconds'])),
            'required_flows':['normal','interrupt before/after each bite','switch slot/item/hand','continuous use','occupied opposite hand','standard and slim skin'],
            'blockbench_reviewed':False,'native_reviewed':False})
    copies.update((RP/'animations').glob('*.json'))
    copies.update((RP/'render_controllers').glob('*.json'))
    for path in sorted(copies):
        target=output/'RP'/path.relative_to(RP);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,target)
    manifest={'purpose':'operator-controlled actual-family Blockbench review; not a distributable pack',
        'source_commit':DATA['source_commit'],'candidate_version':json.loads((ROOT/'baseline.json').read_text())['version'],
        'fixed_routes_rebuilt':len(fixed_routes()),'composited_routes_not_rebuilt':6,'cases':cases,
        'limits':['No player.json changed; current item-slot/skin/camera binding remains unverified.',
                  'FP source curves are not Java third-person animations; native TP route is retained.',
                  'No native use-clock, settlement, final-full-model-flash or visual-parity result is asserted.',
                  'No state/clock variables were replaced for preview; operator must record any preview-only replacement.'],
        'client':False,'production_ready':False}
    (output/'review-plan.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--review-bundle',action='store_true')
    args=parser.parse_args()
    if args.review_bundle:
        result=review_bundle(args.output);print('Prepared',len(result['cases']),'actual-family review cases; none visually accepted.')
    else:
        output=args.output.resolve()
        if output==RP or RP in output.parents:raise ValueError('emit to a review directory; canonical promotion is explicit')
        output.mkdir(parents=True,exist_ok=True)
        for name,document in [('java_eating_projection.animation.json',rebuild_items()),('java_eating_player.animation.json',fixed_player_clips())]:
            (output/name).write_text(json.dumps(document,indent=2)+'\n')
        (output/'attachables').mkdir(exist_ok=True)
        for ident,profile in fixed_routes().items():
            source=RP/'attachables'/(ident.split(':')[1]+'.attachable.json')
            (output/'attachables'/source.name).write_text(json.dumps(fixed_attachable(json.loads(source.read_text()),profile),indent=2)+'\n')
