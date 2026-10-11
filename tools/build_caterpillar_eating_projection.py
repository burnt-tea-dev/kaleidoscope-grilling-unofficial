"""Exact cooked-caterpillar ONE native camera adaptation.

The isolated Makena/wide/FOV70 full-use and cancel trials show coherent hands
and restoration. Near-mouth magnification and Java/client renderer parity remain
unaccepted. This module never admits other foods or changes shared Java curves.
"""
from pathlib import Path
from decimal import Decimal
import argparse, copy, hashlib, json, sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'development/gameplay_core'))
import java_dual_eating_frames as dual
from held_pose_frames import point,bedrock_rotation
from native_eating_clock import SECONDS
ITEM='kaleidoscope_grilling:grilled_caterpillar_skewer'
PLAYER='animation.kg_probe_caterpillar.player.one.right'
ANIMATION='animation.kg_probe_caterpillar.item.one.right'
PIECE='controller.render.kg_probe_caterpillar.piece'
P=ROOT/'projects/grilling/gameplay_core'
BP=P/'behavior_pack';RP=P/'resource_pack'
GATE=("q.has_property('kaleidoscope_grilling:eat_projection') && q.is_using_item && "
      "q.property('kaleidoscope_grilling:eat_projection') == 1 && q.property('kaleidoscope_grilling:eat_profile') == 1 && "
      "q.property('kaleidoscope_grilling:eat_hand') == 1 && q.is_sneaking == 0 && q.is_swimming == 0 && "
      "q.is_gliding == 0 && q.is_riding == 0 && q.is_item_equipped('off_hand') == 0 && "
      "q.is_item_name_any('slot.weapon.mainhand','"+ITEM+"')")
ACTIVE="c.is_first_person == 1 && c.item_slot == 'main_hand' && "+GATE

def dump(doc):return (json.dumps(doc,ensure_ascii=False,indent=2)+'\n').encode()
def number(n):return format(0 if abs(n)<1e-8 else n,'.8f').rstrip('0').rstrip('.') or '0'
def outer_model_position(value, axis):
    # The exact canonical probe uses the standing wide-rig native outer inverse.
    # Keep Java authored curves/rotations intact. Parameters remain a native-tested
    # model hypothesis, not recovered installed-client constants.
    literal = Decimal(number(value))
    corrected = (literal + (Decimal('1.92') if axis == 1 else 0)) / Decimal('.9375')
    return format(corrected.quantize(Decimal('0.000000000001')), 'f').rstrip('0').rstrip('.') or '0'

def unwrap(values,previous):
    if previous is None:return [(v+180)%360-180 for v in values]
    return [v+360*round((old-v)/360) for v,old in zip(values,previous)]
def times():
    return sorted({round(i/60,6) for i in range(271)}|{float(v) for k,rows in dual.ARRAYS.items() if k.endswith('_TIMES') for v in rows if 0<=v<=4.5}|{1.16667,3.08333})

def animations():
    mesh={'skewer_pose':{'position':{},'rotation':{},'scale':[1,1,1]},
          'skewer_model':{'position':[0,0,0],'rotation':[0,0,0],'scale':[1,1,1]},
          'dual_piece':{'position':{},'rotation':{},'scale':['v.kg_eat_seconds >= 1.16667 ? 1 : 0']*3}}
    bones={};previous={}
    for name,side,active in [('right',1,True),('left',-1,False)]:
        arm=name+'arm';socket=name+'item'
        bones[arm]={'position':{},'rotation':{},'scale':['1.0 / 0.9375']*3}
        bones[socket]={'position':{},'rotation':[0,0,0],'scale':[1,1,1]}
        slim="math.abs(q.get_default_bone_pivot('"+arm+"', 1) - 21.5) < 0.01"
        for t in times():
            key=number(t);fn=dual.child_bone if active else dual.helper_socket_bone
            wide=fn('ONE',t,1,False);narrow=fn('ONE',t,1,slim=True)
            child=mesh['skewer_pose' if active else 'dual_piece']
            child['position'][key]=[round(v,8) for v in wide['position']]
            angles=unwrap(wide['rotation'],previous.get(name+'child'));previous[name+'child']=angles
            child['rotation'][key]=[round(v,8) for v in angles]
            base=['0',"q.get_default_bone_pivot('"+arm+"',1) - q.get_default_bone_pivot('"+socket+"',1) - 7","-q.get_default_bone_pivot('"+socket+"',2)"]
            bones[socket]['position'][key]=[b+' + ('+slim+' ? '+number(n-w)+' : 0)' for b,w,n in zip(base,wide['position'],narrow['position'])]
            target=dual.native_arm_target('ONE',t,side,active);location=point(target,[0,0,0]);location[0]*=-1
            bones[arm]['position'][key]=[outer_model_position(location[i],i)+" - q.get_default_bone_pivot('"+arm+"', "+str(i)+")" for i in range(3)]
            angles=unwrap(bedrock_rotation(target),previous.get(name+'arm'));previous[name+'arm']=angles
            bones[arm]['rotation'][key]=[round(v,8) for v in angles]
    common={'loop':'hold_on_last_frame','animation_length':4.5,'anim_time_update':SECONDS}
    return ({'format_version':'1.8.0','animations':{ANIMATION:{**common,'bones':mesh}}},
            {'format_version':'1.8.0','animations':{PLAYER:{**common,'override_previous_animation':True,
             'blend_weight':'variable.is_first_person && '+GATE,'bones':bones}}})

def piece_assets():
    base=ROOT/'projects/grilling/resource_pack'
    geo=json.loads((base/'models/entity/kg_a1/caterpillar_cooked_piece_1.geo.json').read_text())
    g=geo['minecraft:geometry'][0];g['description']['identifier']='geometry.kg_probe_caterpillar.piece'
    g['description'].update(visible_bounds_width=8,visible_bounds_height=8)
    cubes=[]
    for bone in g['bones']:
        for cube in bone.get('cubes',[]):
            cube['origin'][1]+=24
            if 'pivot' in cube:cube['pivot'][1]+=24
            cubes.append(cube)
    assert len(cubes)==1,'Exact caterpillar detached cube required'
    g['bones']=[{'name':'grip','pivot':[0,24,0],'binding':"q.item_slot_to_bone_name('off_hand')"},
                {'name':'dual_piece','parent':'grip','pivot':[0,24,0],'cubes':cubes}]
    png=(base/'textures/kg_a1/caterpillar_cooked_piece_1.png').read_bytes()
    assert hashlib.sha1(b'blob '+str(len(png)).encode()+b'\0'+png).hexdigest()=='7d9e3d75015c5674a383ebd0592009978f31a590'
    return geo,png

def patch_main(text):
    # The modern canonical script is authoritative. Historical A2.0 seed
    # scripts are intentionally unsupported, rather than partially upgraded.
    probe="(e.itemStack.typeId==='"+ITEM+"'&&profile==='ONE'&&hand!=='off')"
    substitutions=[
        ('supportsJavaEatingProjection(e.itemStack.typeId,profile)',
         '(supportsJavaEatingProjection(e.itemStack.typeId,profile)||'+probe+')'),
        ("'animation.kg_java_eating.player.'+profile.toLowerCase()+'.'+(hand==='off'?'left':'right')",
         '('+probe+"?'"+PLAYER+"':('animation.kg_java_eating.player.'+profile.toLowerCase()+'.'+(hand==='off'?'left':'right')))"),
    ]
    for old,new in substitutions:
        if text.count(new)==1:
            # The old expression must occur only inside its own new wrapper.
            if text.count(old)!=1: raise ValueError('Duplicate modern eating dispatch')
            continue
        if new in text or text.count(old)!=1:
            raise ValueError('Unsupported or ambiguous canonical eating dispatch')
        text=text.replace(old,new,1)
    return text


def augment(output):
    output=dict(output)
    def document(path):
        value=output.get(path)
        return copy.deepcopy(value) if value is not None else json.loads(path.read_text())
    path=RP/'attachables/grilled_caterpillar_skewer.attachable.json'
    doc=document(path);d=doc['minecraft:attachable']['description']
    if d['identifier']!=ITEM: raise ValueError('Wrong canonical caterpillar identifier')
    item=json.loads((BP/'items/grilled_caterpillar_skewer.json').read_text())['minecraft:item']
    if item['description']['identifier']!=ITEM or item['components']['minecraft:use_modifiers']['use_duration']!=4.5:
        raise ValueError('Canonical caterpillar duration/identity drift')
    d['scripts']['animate']=[row for row in d['scripts']['animate'] if 'probe_one_right' not in row]
    for alias in ('fp_right','eat_right'):
        rows=[row for row in d['scripts']['animate'] if alias in row]
        if len(rows)!=1: raise ValueError('Missing or duplicate caterpillar legacy route: '+alias)
        expression=rows[0][alias];suffix=') && ('+ACTIVE+') == 0'
        if expression.startswith('(') and expression.endswith(suffix):
            expression=expression[1:-len(suffix)]
        rows[0][alias]='('+expression+') && ('+ACTIVE+') == 0'
    d['animations']['probe_one_right']=ANIMATION
    d['scripts']['animate'].append({'probe_one_right':ACTIVE})
    d['scripts']['pre_animation']=[row for row in d['scripts']['pre_animation'] if not row.startswith('v.kg_probe_piece_visible = ')]
    d['scripts']['pre_animation'].append('v.kg_probe_piece_visible = '+ACTIVE+';')
    d['geometry']['probe_piece']='geometry.kg_probe_caterpillar.piece'
    d['textures']['probe_piece']='textures/kg_probe_caterpillar/piece'
    d['render_controllers']=[ref for ref in d['render_controllers'] if ref!=PIECE]+[PIECE]
    output[path]=doc
    item_animation,player_animation=animations()
    output[RP/'animations/kg_probe_caterpillar_item.animation.json']=item_animation
    output[RP/'animations/kg_probe_caterpillar_player.animation.json']=player_animation
    geo,png=piece_assets()
    output[RP/'models/entity/kg_probe_caterpillar_piece.geo.json']=geo
    output[RP/'textures/kg_probe_caterpillar/piece.png']=png
    output[RP/'render_controllers/kg_probe_caterpillar_piece.render_controllers.json']={
        'format_version':'1.8.0','render_controllers':{PIECE:{'geometry':'Geometry.probe_piece',
        'materials':[{'*':'Material.default'}],'textures':['Texture.probe_piece'],
        'part_visibility':[{'*':'v.kg_probe_piece_visible == 1'}]}}}
    path=RP/'render_controllers/java_eating_player.render_controllers.json';doc=document(path)
    rows=doc['render_controllers']['controller.render.player.first_person']['part_visibility']
    changed=[];prefix='('+GATE+') ? 1 : ('
    for row in rows:
        for bone in ('rightArm','rightSleeve','leftArm','leftSleeve'):
            if bone not in row:continue
            expression=row[bone]
            if expression.startswith(prefix) and expression.endswith(')'):
                expression=expression[len(prefix):-1]
            row[bone]=prefix+expression+')';changed.append(bone)
    if len(changed)!=4:raise ValueError('Native FP arm visibility contract changed')
    output[path]=doc
    path=BP/'scripts/main.js';text=output.get(path)
    if text is None:text=path.read_text()
    if not isinstance(text,str):raise ValueError('Canonical main must be text')
    output[path]=patch_main(text)
    return output


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    for path,value in augment({}).items():
        data=value if isinstance(value,bytes) else (value.encode() if isinstance(value,str) else dump(value))
        if args.check:
            if path.read_bytes()!=data:raise AssertionError(path)
        else:
            path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print('Scoped cooked-caterpillar camera adaptation verified; near-mouth/client parity remains separate')

if __name__=='__main__':main()
