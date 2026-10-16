"""PR125 bound-bottle motion ported onto the G62 combined static-UV mesh.

Derived from final PR125 head 769f8b2e08233e521536e93803045174baa751a5,
tools/build_seasoning_held.py (blob f724de7b94d4af9d26e94d6651e8f4779dbc7a2c).
Keep the established Bedrock idle anchor; no player socket compensation.
Java main-hand curves are mirrored only as an explicit offhand fallback.
This is a native-unaccepted candidate, not a camera-space parity claim.
"""
from pathlib import Path
import argparse,json,math,sys
from copy import deepcopy
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'development/gameplay_core'))
from held_pose_frames import chain,translate,xyz,scale,rigid_inverse,bedrock_rotation,bone_matrix,point,native_skewer_calibration,make_pose
P=ROOT/'projects/grilling/gameplay_core';RP=P/'resource_pack';BP=P/'behavior_pack'
NS='kaleidoscope_grilling:'
def load(p):return json.loads(p.read_text())
def motion(hand,t,shaking):
 sign=1 if hand=='right' else -1
 p=t/.5;wave=math.sin(t*20*1.8) if shaking else math.sin(p*math.pi*4)
 arc=1 if shaking else math.sin(math.pi*min(1,max(0,p)))
 angles=[-28+arc*42,180+sign*wave*18,sign*(22+wave*25)+(0 if shaking else 180)]
 initial=[14 if shaking else -28,180,sign*22]
 # Convert Java XYZ rotations, then rotate about the bottle center, not the
 # player's shoulder. Centered item motion cannot displace the native arm.
 held=load(RP/'animations/a286_held.animation.json')['animations']['animation.kg_a286.bottle_fp_'+hand]['bones']['grip']
 conversion=scale([-1,-1,1]);delta=chain(conversion,xyz(angles),rigid_inverse(xyz(initial)),conversion)
 center=[0,21.25-24,0]
 local=chain(bone_matrix(held),translate(center),delta,translate([-v for v in center]))
 # Java translates +/- .08 m laterally and .10 m vertically during sprinkling.
 # Adapt those relative movements to the established visible Bedrock anchor.
 local[0][3]-=sign*wave*.08*16
 local[1][3]+=(arc-(1 if shaking else 0))*.10*16
 if not shaking and hand=='right':
  # Sprinkle-only camera-relative clearance. The active player clip supplies
  # the exact settled Mojang basis, so a native click cannot swing this anchor.
  # Keep authored scale/rotation/duration; move the inverted model away from HUD.
  base,camera=native_skewer_calibration(hand)
  frame=chain(rigid_inverse(base),camera)
  origin=point(frame,[0,0,0]);shift=point(frame,[-1,3,-2])
  for axis in range(3):local[axis][3]+=shift[axis]-origin[axis]
 rot=bedrock_rotation(chain(local,scale([1/.72]*3)))
 return {'position':[-local[0][3],local[1][3],local[2][3]],'rotation':rot,'scale':[.72]*3}

def dispatch(desc):
 identifier=desc['identifier']
 if identifier==NS+'empty_seasoning_bottle' or identifier.startswith(NS+'partial_seasoning_f'):return
 if identifier!=NS+'pending_seasoning' and not identifier.startswith(NS+'pending_seasoning_f') and not identifier.startswith(NS+'special_seasoning'):return
 pending=identifier==NS+'pending_seasoning' or identifier.startswith(NS+'pending_seasoning_f')
 scripts=desc.setdefault('scripts',{})
 for phase in ['initialize','pre_animation']:
  scripts[phase]=[s for s in scripts.get(phase,[]) if not s.startswith('v.kg_season_')]
 for name in ['season_hand','season_phase','pending_hand']:
  variable='v.kg_season_'+name
  prop=NS+name
  scripts['initialize'].append(variable+' = 0;')
  scripts['pre_animation'].append(variable+" = (c.owning_entity->q.has_property('"+prop+"') ? c.owning_entity->q.property('"+prop+"') : 0);")
 ids={};selectors={}
 for hand,slot,code in [('right','main_hand',1),('left','off_hand',2)]:
  fp=f"c.is_first_person == 1 && c.item_slot == '{slot}'"
  season=f"(v.kg_season_season_hand == {code} && v.kg_season_season_phase != 0)"
  shake=f"(c.owning_entity->q.is_using_item && v.kg_season_pending_hand == {code})" if pending else '0'
  ids['fp_'+hand]='animation.kg_a286.bottle_fp_'+hand
  ids['tp_'+hand]='animation.kg_a286.bottle_tp_'+hand
  ids['season_'+hand]='animation.kg_seasoning.item.sprinkle.'+hand
  selectors['fp_'+hand]=fp+' && ('+season+') == 0'+(' && ('+shake+') == 0' if pending else '')
  if pending:
   ids['shake_'+hand]='animation.kg_seasoning.item.shake.'+hand
   selectors['shake_'+hand]=fp+' && '+shake+' && ('+season+') == 0'
  selectors['season_'+hand]=fp+' && '+season
  selectors['tp_'+hand]=f"c.is_first_person == 0 && c.item_slot == '{slot}'"
  if not pending and hand=='right':
   # SPECIAL main-hand TP replaces the static hold while the source owner is
   # active. Offhand is not Java's left-dominant main arm; do not conflate them.
   ids['tp_season_right']='animation.kg_seasoning.item.sprinkle.tp.right'
   selectors['tp_season_right']=selectors['tp_'+hand]+' && '+season
   selectors['tp_'+hand]+=' && ('+season+') == 0'
 desc['animations']=ids
 scripts['animate']=[{k:v}for k,v in selectors.items()]

def animations():
 out={}
 for hand in ['right','left']:
  for shaking in [False,True]:
   duration=2*math.pi/1.8/20 if shaking else .5
   samples=[duration*n/40 for n in range(41)] if shaking else [n/60 for n in range(31)]
   values={str(round(t,8)):motion(hand,t,shaking) for t in samples}
   # Keep equivalent Euler representatives continuous across the generated keys.
   previous=None
   for row in values.values():
    if previous is not None:row['rotation']=[v+360*round((old-v)/360)for old,v in zip(previous,row['rotation'])]
    previous=row['rotation']
   bone={key:{t:row[key]for t,row in values.items()}for key in ['position','rotation']}
   bone['scale']=[.72]*3
   out['animation.kg_seasoning.item.'+('shake'if shaking else 'sprinkle')+'.'+hand]={'loop':shaking,'animation_length':duration,'bones':{'grip':bone}}
 return {'format_version':'1.8.0','animations':out}

def sprinkle_anchor():
 source=load(ROOT/'development/gameplay_core/fixtures/seasoning-native-sprinkle-frame-1.26.50.4.json')['empty_hand']
 # Use exactly the already-validated idle socket basis, not a second camera
 # calibration. Only this active main-hand sprinkle may own these two bones.
 bones={key:deepcopy(source['bones'][key])for key in ['rightarm','rightitem']}
 names=','.join("'"+load(path)['minecraft:attachable']['description']['identifier']+"'"for path in sorted((RP/'attachables').glob('special_seasoning*.json')))
 gate=("variable.is_first_person && variable.is_using_vr == 0 && q.is_sneaking == 0 && q.is_swimming == 0 && "
       "q.is_gliding == 0 && q.is_riding == 0 && q.property('"+NS+"season_hand') == 1 && "
       "q.property('"+NS+"season_phase') > 0 && q.is_item_name_any('slot.weapon.mainhand',"+names+")")
 return {'format_version':'1.8.0','animations':{'animation.kg_seasoning.player.sprinkle_anchor.right':{
  'animation_length':.5,'override_previous_animation':True,'blend_weight':gate,'bones':bones}}}

def tp_sprinkle():
 # Separate document: preserve all existing FP curve bytes and idle clips.
 return {'format_version':'1.8.0','animations':{'animation.kg_seasoning.item.sprinkle.tp.right':{
  'loop':True,'bones':make_pose('bottle','tp','right',tp_item_inversion=True)}}}

def build():
 out={RP/'animations/seasoning_held.animation.json':animations()}
 out[RP/'animations/seasoning_sprinkle_anchor.animation.json']=sprinkle_anchor()
 out[RP/'animations/seasoning_tp.animation.json']=tp_sprinkle()
 for path in (RP/'attachables').glob('*seasoning*.json'):
  doc=load(path);dispatch(doc['minecraft:attachable']['description']);out[path]=doc
 return out

def compare_motion(actual,expected):
 # Final PR125 portability guard: libm's last bits may differ by platform.
 # Runtime export bytes and release receipts remain exact, never normalized.
 if isinstance(expected,dict):
  assert isinstance(actual,dict) and actual.keys()==expected.keys()
  for key,value in expected.items():compare_motion(actual[key],value)
 elif isinstance(expected,list):
  assert isinstance(actual,list) and len(actual)==len(expected)
  for first,second in zip(actual,expected):compare_motion(first,second)
 elif type(expected) in [float,int]:
  assert type(actual) in [float,int] and math.isclose(actual,expected,rel_tol=0,abs_tol=1e-10),(actual,expected)
 else:assert type(actual)==type(expected) and actual==expected

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
 for path,doc in build().items():
  if args.check:
   if path.name=='seasoning_held.animation.json':compare_motion(load(path),doc)
   else:assert load(path)==doc,path
  else:path.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
 print('PR125 motion-only port; G62 content/assets preserved; native acceptance pending')
if __name__=='__main__':main()
