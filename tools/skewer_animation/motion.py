"""Java-authored skewer motion, independent of Minecraft/Blockbench bindings.

The input arrays are the pinned Java extractor's output, not old Bedrock clips.
Transforms preserve PoseStack call order. Matrices use column vectors, pixels,
right-handed Java axes; no display transform is applied during custom eating.
This module does not emulate a client, inventory or native use clocks.
"""
from __future__ import annotations
import bisect
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROFILES = ('ONE', 'TWO', 'THREE', 'THREE_ALT', 'FOUR')
DATA = json.loads((ROOT/'data/java/animation_curves.json').read_text())
PROFILE_DATA = json.loads((ROOT/'data/java/eating_profiles.json').read_text())['loaders']['forge-1.20.1']

def arrays(class_name):
    path = 'forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/' + class_name + '.java'
    return {d['name']: d['value'] for d in DATA['classes'][path]['declarations'] if 'value' in d}

SINGLE = arrays('SkewerEatingAnimation')
DUAL = arrays('EnderPearlEatingAnimation')

def catmull(time, times, values):
    """Java's segment-local *uniform* Catmull–Rom, repeated end controls.

    This is deliberately not timestamp-weighted cubic interpolation, shortest
    angle interpolation, or Blockbench's inferred spline tangents.
    """
    if len(times) != len(values) or not times or any(b <= a for a,b in zip(times,times[1:])):
        raise ValueError('invalid source curve')
    if not math.isfinite(time): raise ValueError('non-finite time')
    if time <= times[0]: return values[0]
    if time >= times[-1]: return values[-1]
    r = bisect.bisect_left(times, time); l = r-1
    t = (time-times[l])/(times[r]-times[l])
    p0,p1,p2,p3 = (values[max(0,l-1)], values[l], values[r], values[min(len(times)-1,r+1)])
    return .5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)

def curve(data, time, times, values): return catmull(time, data[times], data[values])

def vector(data, time, stem, times=None):
    return [curve(data,time,times or stem+'_TIMES',stem+'_'+axis) for axis in 'XYZ']

def sample(profile, seconds):
    if profile not in PROFILES: raise ValueError('resolve THREE_RANDOM before sampling')
    if not math.isfinite(seconds): raise ValueError('non-finite time')
    t = min(max(seconds,0),5 if profile=='THREE' else 4.5)
    if profile in ('TWO','THREE_ALT','FOUR'):
        pre = {'TWO':'TWO_', 'THREE_ALT':'SQUID_', 'FOUR':''}[profile]
        arm = vector(SINGLE,t,pre+'POSITION')+vector(SINGLE,t,pre+'ROTATION')
        if profile=='TWO':
            item = [0,0,0,catmull(t,[.45833,.95833,1.20833],[0,12.5,0]),0,curve(SINGLE,t,'TWO_ITEM_ROTATION_Z_TIMES','TWO_ITEM_ROTATION_Z'),1]
        else:
            iy = curve(SINGLE,t,'SQUID_ITEM_POSITION_TIMES','SQUID_ITEM_POSITION_Y') if profile=='THREE_ALT' else 0
            item = [0,iy,0,curve(SINGLE,t,pre+'ITEM_ROTATION_TIMES',pre+'ITEM_ROTATION_X'),0,0,1]
        return {'active':arm,'main':item,'helper':None,'piece':None}
    if profile=='ONE':
        active = vector(DUAL,t,'ONE_RIGHT','ONE_RIGHT_TIMES')+vector(DUAL,t,'ONE_RIGHT_ROT','ONE_RIGHT_TIMES')
        helper = vector(DUAL,t,'ONE_LEFT','ONE_LEFT_TIMES')+vector(DUAL,t,'ONE_LEFT_ROT','ONE_LEFT_TIMES')
        item = [0,catmull(t,[0,.45833,1.29167],[0,0,-3]),0,catmull(t,[.20833,.45833,1.29167],[12.5,0,29.5]),0,0,1]
        piece = [-9,-2,5,75,0,-275,1 if t>=1.16667 else 0]
    else:
        active = vector(DUAL,t,'RIGHT_POSITION')+vector(DUAL,t,'RIGHT_ROTATION')
        helper = vector(DUAL,t,'LEFT_POSITION')+vector(DUAL,t,'LEFT_ROTATION')
        item = [0,curve(DUAL,t,'MAIN_ITEM_POSITION_TIMES','MAIN_ITEM_POSITION_Y'),0,curve(DUAL,t,'MAIN_ITEM_ROTATION_TIMES','MAIN_ITEM_ROTATION_X'),0,0,1]
        piece = vector(DUAL,t,'SECOND_ITEM_POSITION','SECOND_ITEM_TRANSFORM_TIMES')+vector(DUAL,t,'SECOND_ITEM_ROTATION','SECOND_ITEM_TRANSFORM_TIMES')+[min(1,max(0,curve(DUAL,t,'SECOND_ITEM_SCALE_TIMES','SECOND_ITEM_SCALE')))]
    return {'active':active,'helper':helper,'main':item,'piece':piece}

def arm_pose(profile, side, value, helper=False):
    """applyToArm/applyActiveArm/applyHelperArm, degrees in output."""
    if side not in ('right','left'): raise ValueError('invalid physical arm')
    sign=1 if side=='right' else -1
    px,py,pz,rx,ry,rz=value
    x=-rx
    y=(-sign if profile=='TWO' else sign)*ry
    z=(sign if profile in ('TWO','THREE_ALT','FOUR') else 1)*rz
    cy,sy=math.cos(math.radians(y)),math.sin(math.radians(y))
    cz,sz=math.cos(math.radians(z)),math.sin(math.radians(z))
    authored=-1 if helper else 1
    p=[-sign*(4+authored*px)-sign*cz*cy,2-py-sign*sz*cy,pz+sign*sy]
    if profile=='TWO':p[1]+=2
    if profile=='ONE':
        p[1]+=3.8
        if not helper:
            z-=sign*7.5
            sx,cx=math.sin(math.radians(x)),math.cos(math.radians(x))
            cz,sz=math.cos(math.radians(z)),math.sin(math.radians(z))
            p=[p[0]+cz*sy*sx-sz*cx,p[1]+sz*sy*sx+cz*cx,p[2]+cy*sx]
    return p+[x,y,z]

def identity():return [[1 if i==j else 0 for j in range(4)]for i in range(4)]

def multiply(a,b):return [[sum(a[i][k]*b[k][j]for k in range(4))for j in range(4)]for i in range(4)]

def translate(x,y,z):
    m=identity()
    for i,v in enumerate((x,y,z)):m[i][3]=v
    return m

def scale(x,y,z):
    m=identity()
    for i,v in enumerate((x,y,z)):m[i][i]=v
    return m

def rotate(axis,angle):
    m=identity();c=math.cos(math.radians(angle));s=math.sin(math.radians(angle))
    i,j={'x':(1,2),'y':(2,0),'z':(0,1)}[axis]
    m[i][i]=m[j][j]=c;m[i][j]=-s;m[j][i]=s
    return m

def compose(*matrices):
    m=identity()
    for other in matrices:m=multiply(m,other)
    return m

def point(matrix, xyz):return [sum(matrix[i][j]*v for j,v in enumerate([*xyz,1]))for i in range(3)]

def item_operations(profile, side, value, helper=False):
    """PoseStack operations in authored order; translations converted to pixels."""
    sign=1 if side=='right' else -1
    x,y,z,rx,ry,rz,s=value
    if profile in ('TWO','THREE_ALT','FOUR'):
        return [('translate',[-sign,9-y,-6]),('x',180+rx),('z',sign*rz),('translate',[0,7,2])]
    authored=-1 if helper else 1
    ax,ay,az=(10,-8.875,-5.75) if helper else (1.975,-8.925,-7.575)
    ops=[('translate',[-sign*authored*(ax+x)+sign,-ay-y,az+z])]
    if not helper:return ops+[('x',180+rx),('y',sign*ry),('z',sign*rz),('translate',[0,7,2])]
    return ops+[('z',rz),('y',sign*ry),('x',-rx)]+([('x',180)]if profile=='ONE' else [])+[('z',95),('scale',[s,s,s])]

def operations_matrix(ops):
    return compose(*[(translate(*v)if k=='translate' else scale(*v)if k=='scale' else rotate(k,v))for k,v in ops])

def item_matrix(profile,side,value,helper=False):return operations_matrix(item_operations(profile,side,value,helper))

def bite_stage(profile, seconds, using=True, same_stack=True):
    if profile not in PROFILES:raise ValueError('unresolved profile')
    return sum(seconds>=t for t in PROFILE_DATA['profiles'][profile]['bite_seconds']) if using and same_stack else 0

def sample_times(profile, rate=60):
    duration=PROFILE_DATA['profiles'][profile]['duration_ticks']/20
    times={round(i/rate,8) for i in range(round(duration*rate)+1)}
    times.update(PROFILE_DATA['profiles'][profile]['bite_seconds'])
    if profile=='ONE':times.update([.20833,1.29167])
    for data in (SINGLE,DUAL):
        for key,value in data.items():
            if key.endswith('_TIMES') and isinstance(value,list):times.update(t for t in value if 0<=t<=duration)
    return sorted(times)
