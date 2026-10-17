"""Stable render-only oilpot/brush route using pinned Java generated sprites.

Always associate the pot; select geometry/texture with the existing per-hand
presentation bus. No conditional association, inventory swap or RP player file.
Native Bedrock's previous icon pose is intentionally replaced by Java display.
"""
import argparse,json,hashlib,math,sys
from pathlib import Path
from PIL import Image
from native_skewer_icons import geometry,encode
from held_pose_frames import xyz,bedrock_rotation,native_skewer_calibration,chain,translate,scale,rotate,mul,rigid_inverse,point,identity,bone_matrix
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
from held_visual_channels import OIL_BRUSH,OIL_POT_IDLE,verify_owner_marker_allocation
RP=Path('projects/grilling/gameplay_core/resource_pack')
TYPES=('canola','secret_chili','premium_chili')
IDLE=('pot_no_oil','pot_has_oil')+tuple('oil_pot_'+t for t in TYPES)
NS='kaleidoscope_grilling:'
SOURCE=ROOT/'development/gameplay_core/fixtures/java-oil-pot-visual'

def generated_pose(pose,view,side):
    # Same verified player/socket-to-Java inverse used by native skewer poses.
    # Generated sprite coordinates are Java + [-8,+16,-8]. No bottle-specific
    # bounded camera adjustment or old single-model calibration is added.
    r=pose['rotation'];r=[r[0],side*r[1],side*r[2]]
    tr=pose['translation'];tr=[side*tr[0],tr[1],tr[2]];size=pose['scale'];offset=[8,-16,8]
    if view=='fp':
        base,camera=native_skewer_calibration('right' if side==1 else 'left')
        java=chain(translate([9.039*side,15.682,20.8]),translate(tr),xyz(r),scale(size),translate([-8,-8,-8]))
        target=chain(camera,translate([0,-24,-32.4]),java,translate(offset))
    else:
        arm=rotate('x',15)
        base=chain(translate([5*side,22,0]),arm,translate([side,-31,1]))
        target=chain(translate([6*side,22,0]),arm,translate([0,-10,-2]),rotate('x',-90),translate(tr),xyz(r),scale(size),translate([-8,-8,-8]),translate(offset))
    local=mul(rigid_inverse(base),target);position=point(local,[0,24,0]);position[1]-=24;position[0]*=-1
    rotation=mul(local,scale([1/x for x in size]))
    return {'position':[round(x,8) for x in position],'rotation':[round(x,8) for x in bedrock_rotation(rotation)],'scale':size}

def packet_sine(word):
    return f'math.sin(math.mod(math.clamp(({word}) - 1, 0, 59), 20) * 18)'

def channels(matrix,size=(1,1,1)):
    return {'position':[round(-matrix[0][3],8),round(matrix[1][3],8),round(matrix[2][3],8)],
            'rotation':[round(x,8) for x in bedrock_rotation(mul(matrix,scale([1/x for x in size])))], 'scale':list(size)}

def source_motion(pose,view,side):
    tr=pose['translation'];tr=[side*tr[0],tr[1],tr[2]]
    r=pose['rotation'];r=[r[0],side*r[1],side*r[2]]
    display=chain(translate(tr),xyz(r),scale(pose['scale']),translate([-8,-8,-8]),translate([8,-16,8]))
    if view=='fp':
        base,camera=native_skewer_calibration('right' if side==1 else 'left')
        frame=mul(rigid_inverse(base),camera)
        move={'position':[f'-({side} * 8.32 + v.kg_oil_brush_sine * 4)',-7.68,-12.48]}
        x={'rotation':[24,0,0]};y={'rotation':[0,-180,0]}
        z={'rotation':[0,0,f'{side} * (32 + v.kg_oil_brush_sine * 34)']}
    else:
        # Same calibrated Java hand prefix as held_pose_frames, with the source
        # item-local Z sweep inserted BEFORE the generated display transform.
        arm=rotate('x',15)
        base=chain(translate([5*side,22,0]),arm,translate([side,-31,1]))
        prefix=chain(translate([6*side,22,0]),arm,translate([0,-10,-2]),rotate('x',-90))
        frame=mul(rigid_inverse(base),prefix)
        move={};x={};y={};z={'rotation':[0,0,f'{side} * v.kg_oil_brush_sine * 16']}
    frame_channels=channels(frame)
    if view=='tp':
        # Cancel the live arm, not its idle 15-degree pose, for the one-unit
        # Java/Bedrock shoulder offset. R^-1 * [side,0,0] is row0(R)*side.
        ax=-1.32*180/math.pi
        ay=f'(({side} * 0.18 + v.kg_oil_brush_sine * 0.70) * {180/math.pi})'
        az=f'({side} * (0.10 + v.kg_oil_brush_sine * 0.42) * {180/math.pi})'
        frame_channels['position']=[f'{side} * (1 - math.cos({az}) * math.cos({ay}))',
          f'21 + {side} * (math.cos({az}) * math.sin({ay}) * math.sin({ax}) - math.sin({az}) * math.cos({ax}))',
          f'-3 + {side} * (-math.cos({az}) * math.sin({ay}) * math.cos({ax}) - math.sin({az}) * math.sin({ax}))']
    return {'frame':frame_channels,'source_move':move,'source_x':x,'source_y':y,'source_z':z,'brush':channels(display,pose['scale'])}

def display_bones(pose,view,side):
    old=generated_pose(pose,view,side)
    # Existing idle uses pivot24; new transform nodes all use pivot0.
    idle=chain(translate([-old['position'][0],old['position'][1],old['position'][2]]),translate([0,24,0]),bone_matrix({'rotation':old['rotation'],'scale':old['scale']}),translate([0,-24,0]))
    active=source_motion(pose,view,side);result={}
    for name,values in active.items():
        inactive=channels(idle,pose['scale']) if name=='frame' else {}
        result[name]={}
        for channel,default in [('position',[0,0,0]),('rotation',[0,0,0]),('scale',[1,1,1])]:
            result[name][channel]=[f'v.kg_oil_brush_active ? ({a}) : ({b})' for a,b in zip(values.get(channel,default),inactive.get(channel,default))]
    return result

def outputs():
    verify_owner_marker_allocation()
    out={};witness=json.loads((SOURCE/'source.json').read_text())
    for name,expected in witness['sha256'].items():assert hashlib.sha256((SOURCE/name).read_bytes()).hexdigest()==expected,name
    for name in IDLE:
        assert json.loads((SOURCE/(name+'.json')).read_text())['parent']=='minecraft:item/generated'
    for name in tuple(t+'_oil_brush' for t in TYPES)+IDLE:
        brush=name.endswith('_oil_brush');folder='textures/items' if brush else 'textures/held'
        texture=name if brush else 'java_'+name
        data=(ROOT/RP/folder/(texture+'.png')).read_bytes()
        reference=ROOT/'development/gameplay_core/fixtures/java-item-icons-1.1.1' if brush else SOURCE
        expected=json.loads((reference/'source.json').read_text())['sha256'][name+'.png']
        assert hashlib.sha256(data).hexdigest()==expected
        mesh=geometry(name,[Image.open(ROOT/RP/folder/(texture+'.png')).convert('RGBA')])
        g=mesh['minecraft:geometry'][0];g.pop('item_display_transforms');g['description']['identifier']='geometry.kg_oil_brush.'+name
        cubes=g['bones'][0]['cubes']
        for cube in cubes:cube['origin'][1]+=16
        g['bones']=[{'name':'grip','pivot':[0,24,0],'binding':'q.item_slot_to_bone_name(context.item_slot)'},
                    *({'name':n,'parent':parent,'pivot':[0,0,0]} for n,parent in [('frame','grip'),('source_move','frame'),('source_x','source_move'),('source_y','source_x'),('source_z','source_y')]),
                    {'name':'brush','parent':'source_z','pivot':[0,0,0],'cubes':cubes}]
        out[RP/'models/entity'/('oil_brush_'+name+'.geo.json')]=mesh
    marker="(c.item_slot == 'off_hand' ? (c.owning_entity->q.has_property('"+NS+"secret_off_piece') ? c.owning_entity->q.property('"+NS+"secret_off_piece') : 0) : (c.owning_entity->q.has_property('"+NS+"secret_main_piece') ? c.owning_entity->q.property('"+NS+"secret_main_piece') : 0))"
    word="(c.item_slot == 'off_hand' ? (c.owning_entity->q.has_property('"+NS+"bottle_off_0') ? c.owning_entity->q.property('"+NS+"bottle_off_0') : 0) : (c.owning_entity->q.has_property('"+NS+"bottle_main_0') ? c.owning_entity->q.property('"+NS+"bottle_main_0') : 0))"
    names=IDLE+tuple(t+'_oil_brush' for t in TYPES)
    for pot in ('oil_pot','oil_pot_filled'):
        identifier='kaleidoscope_cookery:'+pot;fallback=0 if pot=='oil_pot' else 1
        out[RP/'attachables'/f'grilling_{pot}_brush.attachable.json']={'format_version':'1.20.30','minecraft:attachable':{'description':{
          'identifier':identifier,'item':{identifier:"q.is_owner_identifier_any('minecraft:player')"},
          'materials':{'default':'entity_alphatest'},
          'textures':{n:('textures/items/'+n if n.endswith('_oil_brush') else 'textures/held/java_'+n) for n in names},
          'geometry':{n:'geometry.kg_oil_brush.'+n for n in names},
          'scripts':{'pre_animation':['v.kg_oil_brush_owner = '+marker+';','v.kg_oil_brush_word = '+word+';',
              f'v.kg_oil_brush_model = (v.kg_oil_brush_owner == {OIL_BRUSH} && v.kg_oil_brush_word >= 1 && v.kg_oil_brush_word <= 60) ? 5 + math.floor((v.kg_oil_brush_word - 1) / 20) : ((v.kg_oil_brush_owner == {OIL_POT_IDLE} && v.kg_oil_brush_word >= 0 && v.kg_oil_brush_word <= 4) ? v.kg_oil_brush_word : '+str(fallback)+');',
              f'v.kg_oil_brush_active = v.kg_oil_brush_owner == {OIL_BRUSH} && v.kg_oil_brush_word >= 1 && v.kg_oil_brush_word <= 60;',
              'v.kg_oil_brush_stale = (v.kg_oil_brush_word == (v.kg_oil_brush_previous_word ?? -1) && v.kg_oil_brush_owner == (v.kg_oil_brush_previous_owner ?? -1)) ? math.min((v.kg_oil_brush_stale ?? 0) + q.delta_time, 2) : 0;',
              'v.kg_oil_brush_previous_word = v.kg_oil_brush_word;',
              'v.kg_oil_brush_previous_owner = v.kg_oil_brush_owner;',
              'v.kg_oil_brush_active = v.kg_oil_brush_active && v.kg_oil_brush_stale < 2;',
              f'v.kg_oil_brush_model = (v.kg_oil_brush_owner == {OIL_BRUSH} && !v.kg_oil_brush_active) ? '+str(fallback)+' : v.kg_oil_brush_model;',
              'v.kg_oil_brush_sine = '+packet_sine('v.kg_oil_brush_word')+';'],
            'animate':[{view+'_'+hand:"c.is_first_person == "+str(view=='fp' and 1 or 0)+" && c.item_slot == '"+slot+"'"} for view in ('fp','tp') for hand,slot in [('right','main_hand'),('left','off_hand')]]},
          'animations':{view+'_'+hand:'animation.kg_oil_brush.display.'+view+'.'+hand for view in ('fp','tp') for hand in ('right','left')},
          'render_controllers':['controller.render.kg_oil_brush']}}}
    out[RP/'render_controllers/oil_brush.render_controllers.json']={'format_version':'1.8.0','render_controllers':{'controller.render.kg_oil_brush':{
      'arrays':{'geometries':{'Array.models':["Geometry."+n for n in names]},'textures':{'Array.models':["Texture."+n for n in names]}},
      'geometry':'Array.models[v.kg_oil_brush_model]','materials':[{'*':'Material.default'}],'textures':['Array.models[v.kg_oil_brush_model]']}}}
    anim={};display=json.loads((SOURCE/'generated.json').read_text())['display']
    for view,context in [('fp','firstperson_righthand'),('tp','thirdperson_righthand')]:
        pose=display[context]
        for hand,side in [('right',1),('left',-1)]:
            anim['animation.kg_oil_brush.display.'+view+'.'+hand]={'loop':True,'bones':display_bones(pose,view,side)}
    out[RP/'animations/oil_brush.animation.json']={'format_version':'1.8.0','animations':anim}
    # Source HumanoidModel channels: Java model X-left/Y-down to Bedrock X-right/Y-up gives
    # Rz(z) Ry(-y) Rx(-x), then Bedrock channel signs recover [x,y,z].
    # Marker stops the normal20-tick session;2s is only a finite stale-packet
    # safety ceiling. Both visible components read exactly the same20Hz word.
    motion={};deg=180/math.pi
    for hand,side in [('main',1),('off',-1)]:
        word=f"(q.has_property('{NS}bottle_{hand}_0') ? q.property('{NS}bottle_{hand}_0') : 0)"
        sine=packet_sine(word)
        arm='rightarm' if side==1 else 'leftarm';item='rightitem' if side==1 else 'leftitem'
        fp_pos=[13.5,-10,12] if side==1 else [0,0,0]
        fp_rot=[95,-45,115] if side==1 else [0,0,0]
        tp_rot=[-1.32*deg,f'({side} * 0.18 + {sine} * 0.70) * {deg}',f'{side} * (0.10 + {sine} * 0.42) * {deg}']
        motion['animation.kg_oil_brush.player.'+hand]={'animation_length':2.0,'loop':False,'override_previous_animation':True,'bones':{
            arm:{'position':[f'v.is_first_person ? {v} : 0' for v in fp_pos],
                 'rotation':[f'v.is_first_person ? {a} : ({b})' for a,b in zip(fp_rot,tp_rot)]},
            item:{'position':[0,0,'v.is_first_person ? -1 : 0'],'rotation':[0,0,0]}}}
    out[RP/'animations/oil_brush_player.animation.json']={'format_version':'1.8.0','animations':motion}
    return out
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');args=parser.parse_args()
    for path,value in outputs().items():
        path=ROOT/path;data=encode(value)
        if args.write:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
        else:assert path.read_bytes()==data,str(path)
    print('Stable oil brush source assets '+('written' if args.write else 'verified')+'; engine rendering separately unverified')
