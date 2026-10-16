"""Convert Java item display frames into Bedrock attachment frames.

Never copy Java XYZ Euler angles into Bedrock ZYX bone channels. This module
uses Java display transforms and pinned Mojang player attachment offsets for
skewer and bottle first person. Unused rack poses retain their editor calibration. Neither
mathematical projection nor editor calibration is Minecraft client acceptance.
"""
import json
import math
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
REPORTS = ROOT / 'projects/grilling/reports/java_display_transforms'

def mul(a, b):
    return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def chain(*args):
    result = identity()
    for value in args: result = mul(result, value)
    return result
def identity(): return [[float(i == j) for j in range(4)] for i in range(4)]
def translate(v):
    m=identity()
    for i in range(3): m[i][3]=v[i]
    return m
def scale(v):
    m=identity()
    for i in range(3): m[i][i]=v[i]
    return m
def rotate(axis, degrees):
    a=math.radians(degrees);c=math.cos(a);s=math.sin(a);m=identity()
    i,j={'x':(1,2),'y':(2,0),'z':(0,1)}[axis]
    m[i][i]=m[j][j]=c;m[i][j]=-s;m[j][i]=s
    return m
def xyz(v): return chain(rotate('x',v[0]),rotate('y',v[1]),rotate('z',v[2]))
def zyx(v): return chain(rotate('z',v[2]),rotate('y',v[1]),rotate('x',v[0]))
def rigid_inverse(m):
    out=identity()
    for i in range(3):
        for j in range(3): out[i][j]=m[j][i]
        out[i][3]=-sum(m[j][i]*m[j][3] for j in range(3))
    return out
def point(m,p): return [sum(m[i][j]*p[j] for j in range(3))+m[i][3] for i in range(3)]
def bedrock_rotation(m):
    y=math.asin(max(-1,min(1,-m[2][0])))
    if abs(math.cos(y))<1e-8: raise ValueError('Unreviewed Euler singularity')
    x=math.atan2(m[2][1],m[2][2]);z=math.atan2(m[1][0],m[0][0])
    return [-math.degrees(x),-math.degrees(y),math.degrees(z)]
def bone_matrix(b):
    s=b.get('scale',1);s=[s]*3 if isinstance(s,(int,float)) else s
    p=b.get('position',[0,0,0]);r=b.get('rotation',[0,0,0])
    return chain(translate([-p[0],p[1],p[2]]),zyx([-r[0],-r[1],r[2]]),scale(s))
def calibration(hand):
    sign=1 if hand=='right' else -1
    base=chain(translate([-20*sign,21,0]),zyx([-95,45*sign,115*sign]))
    camera=chain(translate([0,19,-40]),xyz([-175.71084667,0,180]))
    return base,camera

def native_skewer_calibration(hand):
    """Mojang empty_hand arm/item basis, with the bound mesh pivot removed.

    Right arm pivot [-5,22,0], position [13.5,-10,12], rotation
    [95,-45,115]; rightItem pivot [-6,15,1]. empty_hand cancels the
    item's Z offset and places its Y seven units below the arm pivot.
    Native empty_hand does not mirror its right-arm pose onto the left arm.
    The left branch uses the actual settled wide left socket. Native equip
    lowering, bob and the slim shoulder offset remain inherited, not canceled.
    This is a head-centered projection model, not a renderer emulation.
    """
    if hand=='left':
        return chain(translate([-6,15,0]),translate([0,-24,0])), chain(translate([0,24,0]),rotate('y',180))
    sign=1 if hand=='right' else -1
    arm=chain(translate([-8.5*sign,12,12]),zyx([-95,45*sign,115*sign]))
    base=chain(arm,translate([sign,-7,0]),translate([0,-24,0]))
    camera=chain(translate([0,24,0]),rotate('y',180))
    return base,camera

FAMILIES = {
    'skewer': ('beef_raw.json',[8,-24,8],'skewer_pose','skewer_model',[0,-1,6]),
    'bottle': ('seasoning_bottles_1.json',[8,-18,8],'grip',None,[0,0,0]),
    'rack': ('advanced_rack_0.json',[8,-6.5,13.375],'rack_pose','rack_model',[0,7.5,-1.625]),
}
def make_pose(family, view, hand, *, tp_item_inversion=False):
    if tp_item_inversion and (family!='bottle' or view!='tp' or hand not in ('right','left')):
        raise ValueError('TP item inversion is defined only for bottle TP hand frames')
    ref,source_offset,bone,model,correction=FAMILIES[family]
    display=json.loads((REPORTS/ref).read_text())['java_display']
    key=('firstperson_' if view=='fp' else 'thirdperson_')+hand+'hand'
    # Java's rack has no authored FP-left slot: explicitly use mirrored right
    # as a Bedrock accessibility fallback, without claiming authored parity.
    pose=display.get(key,display[key.replace('lefthand','righthand')])
    sign=1 if hand=='right' else -1
    r=pose.get('rotation',[0,0,0]);r=[r[0],r[1]*sign,r[2]*sign]
    tr=pose.get('translation',[0,0,0]);tr=[tr[0]*sign,tr[1],tr[2]]
    size=pose.get('scale',[1,1,1]);rotation=xyz(r)
    if view=='tp':
        rotation=mul(rotate('x',-90),rotation)
        arm=rotate('x',15)
        base=chain(translate([5*sign,22,0]),arm,translate([sign,-31,1]))
        target=chain(translate([6*sign,22,0]),arm,translate([0,-10,-2]),rotate('x',-90),translate(tr),xyz(r),scale(size),translate([-8,-8,-8]),translate(source_offset))
        if tp_item_inversion:
            # Java ItemInHandLayerAnvilPressMixin inserts Z180 before renderItem:
            # after the hand prefix, before display translation/rotation/scale.
            # Retain this adapted prefix and mesh offset; never add an Euler
            # channel to the finished pose or rotate the player's arm again.
            rotation=chain(rotate('x',-90),rotate('z',180),xyz(r))
            target=chain(translate([6*sign,22,0]),arm,translate([0,-10,-2]),rotate('x',-90),rotate('z',180),translate(tr),xyz(r),scale(size),translate([-8,-8,-8]),translate(source_offset))
        local=mul(rigid_inverse(base),target)
        shifted=point(local,[0,24,0])
        correction_transformed=[sum(local[i][j]*correction[j] for j in range(3))for i in range(3)]
        position=[shifted[i]-[0,24,0][i]-correction_transformed[i] for i in range(3)]
        position[0]*=-1
    else:
        base,camera=(native_skewer_calibration(hand) if family in ('skewer','bottle') else calibration(hand))
        # Rack's untranslated Java FP slot lies outside this Bedrock camera.
        # Keep Java orientation/scale; adapt the placement into the visible hand
        # region. This explicit exception is covered by the viewport regression.
        if family=='rack': tr=[-3*sign,4.5,-2]
        java=chain(translate([9.039*sign,15.682,20.8]),translate(tr),xyz(r),scale(size),translate([-8,-8,-8]))
        # Keep Java bottle rotation/.72 scale. The G105 bounded grip candidate
        # reduces G61's inward/upward/depth retreat by [2*sign,-2,+3]. Normal
        # lower/right edge cropping is allowed; source frusta are diagnostics.
        # Native idle/use/return and supported-hand acceptance remain separate.
        camera_offset=[-1*sign,3,-3] if family=='bottle' else [0,0,0]
        target=chain(camera,translate(camera_offset),translate([0,-24,-32.4]),java,translate(source_offset))
        local=mul(rigid_inverse(base),target)
        position=point(local,[0,24,0]);position[1]-=24;position[0]*=-1
        rotation=mul(local,scale([1/x for x in size]))
    result={bone:{'position':[round(x,8)for x in position], 'rotation':[round(x,8)for x in bedrock_rotation(rotation)],'scale':size}}
    if model: result[model]={'position':correction if view=='tp' else [0,0,0]}
    return result

def expected_animations():
    out={}
    for family in FAMILIES:
        prefix='kg_a287.skewer' if family=='skewer' else 'kg_a286.'+family
        for view in ('fp','tp'):
            for hand in ('right','left'):
                out['animation.'+prefix+'_'+view+'_'+hand]={'loop':True,'bones':make_pose(family,view,hand)}
    return out

def write_runtime():
    expected=expected_animations()
    for filename in ('a287_skewer_held.animation.json','a286_held.animation.json'):
        path=RP/'animations'/filename;data=json.loads(path.read_text())
        for name in data['animations']: data['animations'][name]=expected[name]
        path.write_text(json.dumps(data,indent=2)+'\n')
if __name__=='__main__': write_runtime()
