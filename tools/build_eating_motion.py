"""Reproducible held-item motion from reviewed Java Catmull-Rom curves.

Uses a local first-person motion bone atop the reviewed hand frames. Native
Bedrock arm animation and Java's detached second-piece rendering differ; this
conversion does not certify the client presentation.
"""
from pathlib import Path
import json,math,re,argparse,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'development/gameplay_core'))
from held_pose_frames import chain,translate,rotate,zyx,scale,mul,rigid_inverse,bedrock_rotation,bone_matrix
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'projects/grilling/gameplay_core';RP=P/'resource_pack';BP=P/'behavior_pack'
FIX=ROOT/'development/gameplay_core/fixtures/java-eating-curves-1.1.1.json'
ACTIVE_HAND="(q.is_using_item && ((c.item_slot == 'main_hand' && q.property('kaleidoscope_grilling:eat_hand') == 1) || (c.item_slot == 'off_hand' && q.property('kaleidoscope_grilling:eat_hand') == 2)))"
def sample(times,values,t):
 if t<=times[0]:return values[0]
 if t>=times[-1]:return values[-1]
 right=next(i for i,x in enumerate(times) if x>=t);left=right-1;u=(t-times[left])/(times[right]-times[left]);p0,p1,p2,p3=[values[i] for i in [max(0,left-1),left,right,min(len(times)-1,right+1)]]
 return .5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u)
def curves(profile):
 source=json.loads(FIX.read_text())['files'];sk=source['SkewerEatingAnimation.java']['arrays'];pearl=source['EnderPearlEatingAnimation.java']['arrays']
 if profile=='ONE':return pearl,'ONE_RIGHT_TIMES','ONE_RIGHT_', 'ONE_RIGHT_TIMES','ONE_RIGHT_ROT_'
 if profile=='THREE':return pearl,'RIGHT_POSITION_TIMES','RIGHT_POSITION_','RIGHT_ROTATION_TIMES','RIGHT_ROTATION_'
 prefix={'TWO':'TWO_','THREE_ALT':'SQUID_','FOUR':''}[profile]
 return sk,prefix+'POSITION_TIMES',prefix+'POSITION_',prefix+'ROTATION_TIMES',prefix+'ROTATION_'
def animation_id(profile,hand):return 'animation.kg_eating.item.'+profile.lower()+'.'+hand
def item_frame(profile,hand,t):
 # Java ModelPart transforms compose Z/Y/X; item transforms compose X/Z,
 # or X/Y/Z for the dual-arm profiles. These cannot be added as Euler deltas.
 a,pt,prefix,rt,rprefix=curves(profile);m=1 if hand=='right' else -1
 pos=[sample(a[pt],a[prefix+c],t) for c in 'XYZ'];r=[sample(a[rt],a[rprefix+c],t) for c in 'XYZ']
 rotation=[-r[0],(-m if profile=='TWO' else m)*r[1],m*r[2]]
 y=math.radians(rotation[1]);z=math.radians(rotation[2]);correction=[-m*math.cos(z)*math.cos(y),-m*math.sin(z)*math.cos(y),m*math.sin(y)]
 arm=[-m*(4+pos[0])+correction[0],2-pos[1]+correction[1]+(2 if profile=='TWO' else 0),pos[2]+correction[2]]
 parent=chain(translate(arm),zyx(rotation))
 if profile=='ONE':
  arm[1]+=3.8;rotation[2]-=m*7.5
  parent=chain(translate(arm),zyx(rotation),translate([0,1,0]))
  itemY=sample([0,.45833,1.29167],[0,0,-3],t);itemX=sample([.20833,.45833,1.29167],[12.5,0,29.5],t)
 elif profile=='THREE':itemY=sample(a['MAIN_ITEM_POSITION_TIMES'],a['MAIN_ITEM_POSITION_Y'],t);itemX=sample(a['MAIN_ITEM_ROTATION_TIMES'],a['MAIN_ITEM_ROTATION_X'],t)
 elif profile=='THREE_ALT':itemY=sample(a['SQUID_ITEM_POSITION_TIMES'],a['SQUID_ITEM_POSITION_Y'],t);itemX=sample(a['SQUID_ITEM_ROTATION_TIMES'],a['SQUID_ITEM_ROTATION_X'],t)
 elif profile=='TWO':itemY=0;itemX=sample([.45833,.95833,1.20833],[0,12.5,0],t)
 else:itemY=0;itemX=sample(a['ITEM_ROTATION_TIMES'],a['ITEM_ROTATION_X'],t)
 itemZ=sample(a['TWO_ITEM_ROTATION_Z_TIMES'],a['TWO_ITEM_ROTATION_Z'],t) if profile=='TWO' else 0
 if profile in ['ONE','THREE']:
  local=chain(translate([-m*1.975+m,-8.925-itemY,-7.575]),rotate('x',180+itemX),translate([0,7,2]))
 else:local=chain(translate([-m,9-itemY,-6]),rotate('x',180+itemX),rotate('z',m*itemZ),translate([0,7,2]))
 # Convert authored Java frame into the existing Bedrock handed coordinate frame.
 conversion=scale([-1,-1,1])
 return chain(conversion,parent,local,conversion)
def motion_frame(profile,hand,t):
 held=json.loads((RP/'animations/a287_skewer_held.animation.json').read_text())['animations']['animation.kg_a287.skewer_fp_'+hand]['bones']['skewer_pose']
 # The authored hold has uniform 0.8 scale. Remove it to invert a rigid basis;
 # include its size in the translation when returning to the child frame.
 basis=bone_matrix({**held,'scale':1});delta=chain(item_frame(profile,hand,t),rigid_inverse(item_frame(profile,hand,0)))
 local=chain(rigid_inverse(basis),delta,basis);r=bedrock_rotation(local)
 return [-local[0][3]/.8,local[1][3]/.8,local[2][3]/.8],r
def build(attachable_overrides=None):
 overrides={} if attachable_overrides is None else attachable_overrides
 modern=tuple(json.loads((BP/'manifest.json').read_text())['header']['version']) >= (2,8,58)
 sys.path.insert(0,str(ROOT/'development/gameplay_core'))
 from native_eating_clock import SECONDS,VARIABLE,ASSIGNMENT
 animations={};profiles=['ONE','TWO','THREE','THREE_ALT','FOUR']
 for profile in profiles:
  a,pt,prefix,rt,rprefix=curves(profile);duration=5 if profile=='THREE' else 4.5
  for hand in ['right','left']:
   sign=1 if hand=='right' else -1;position={};rotation={}
   for n in range(round(duration*20)+1):
    t=n/20;pos,rot=motion_frame(profile,hand,t)
    if n:
     previous=list(rotation.values())[-1]
     rot=[x+360*round((previous[i]-x)/360) for i,x in enumerate(rot)]
    position[f'{t:.2f}']=[round(x,6) for x in pos]
    rotation[f'{t:.2f}']=[round(x,6) for x in rot]
   animations[animation_id(profile,hand)]={'loop':'hold_on_last_frame','animation_length':duration,'anim_time_update':SECONDS if modern else 'q.item_in_use_duration','bones':{'skewer_model':{'position':position,'rotation':rotation}}}
 output={**overrides,RP/'animations/eating_motion.animation.json':{'format_version':'1.8.0','animations':animations}}
 table=json.loads(re.search(r'PROFILE_BY_ITEM=Object.freeze\((\{.*?\})\)',(BP/'scripts/data.js').read_text()).group(1))
 paths=set((RP/'attachables').glob('*.json'))|{p for p in overrides if p.parent==RP/'attachables'}
 for p in sorted(paths):
  doc=json.loads(json.dumps(overrides[p])) if p in overrides else json.loads(p.read_text())
  d=doc['minecraft:attachable']['description'];identifier=d['identifier'];suffix='_java_three_alt'
  base=identifier[:-len(suffix)] if identifier.endswith(suffix) else identifier
  profile=table.get(base)
  if base=='kaleidoscope_grilling:secret_skewer':profile='THREE_RANDOM'
  if not profile or (identifier!=base and profile!='THREE_RANDOM'):continue
  # Reconstruct generated guards each pass. Ineligible canonical random items
  # regain their legacy hold instead of retaining yesterday's ALT override.
  d['animations']={k:v for k,v in d['animations'].items() if not k.startswith('fp_eat_')}
  d['geometry'].pop('java_piece',None);d['textures'].pop('java_piece',None)
  d['render_controllers']=[r for r in d['render_controllers'] if r!='controller.render.kg_java_eating.piece']
  d['scripts']['pre_animation']=[row.replace(VARIABLE,'q.item_in_use_duration') for row in d['scripts']['pre_animation'] if not row.startswith((VARIABLE+' =','v.kg_java_piece_visible = '))]
  for hand in ['right','left']:
   alias='eat_'+hand;d['animations'][alias]=animation_id('THREE' if profile=='THREE_RANDOM' else profile,hand)
   if profile=='THREE_RANDOM':d['animations']['eat_alt_'+hand]=animation_id('THREE_ALT',hand)
  animate=[row for row in d['scripts']['animate'] if not any(str(k).startswith(('eat_','fp_eat_')) for k in row)]
  for row in animate:
   for hand,slot in [('right','main_hand'),('left','off_hand')]:
    if 'fp_'+hand in row:row['fp_'+hand]="c.is_first_person == 1 && c.item_slot == '"+slot+"'"
  for hand in ['right','left']:
   # ItemInHandSkewerEatingMixin replaces renderArmWithItem, an FP renderer.
   # Its camera-space arm displacements are not TP item-local transforms.
   using="c.is_first_person == 1 && q.is_using_item && q.property('kaleidoscope_grilling:eat_hand') == "+str(1 if hand=='right' else 2)+" && c.item_slot == '"+('main_hand' if hand=='right' else 'off_hand')+"'"
   if profile=='THREE_RANDOM':
    alternate="q.property('kaleidoscope_grilling:eat_profile') == 4"
    animate += [{'eat_'+hand:using+" && q.property('kaleidoscope_grilling:eat_profile') != 4"},{'eat_alt_'+hand:using+' && '+alternate}]
   else:animate.append({'eat_'+hand:using})
  if profile=='THREE_RANDOM':
   first="q.item_in_use_duration >= 0.95833 ? 1 : 0"
   normal="q.item_in_use_duration >= 3.54167 ? 3 : (q.item_in_use_duration >= 2.33333 ? 2 : ("+first+"))"
   alt="q.item_in_use_duration >= 3.5 ? 3 : (q.item_in_use_duration >= 2.16667 ? 2 : ("+first+"))"
   # Secret ingredient owner reads are an independent held-render contract.
   # Keep them when rebuilding the shared random-profile bite clock, including
   # the native ALT clone. Otherwise a generator run silently hides the food.
   secret_reads=[row for row in d['scripts']['pre_animation'] if row.startswith('v.kg_secret_')]
   d['scripts']['pre_animation']=["v.kg_bite_stage = q.is_using_item ? (q.property('kaleidoscope_grilling:eat_profile') == 4 ? ("+alt+") : ("+normal+")) : 0;"]+secret_reads
  d['scripts']['pre_animation']=[row.replace(ACTIVE_HAND,'q.is_using_item').replace('q.is_using_item',ACTIVE_HAND) for row in d['scripts']['pre_animation']]
  if modern:d['scripts']['pre_animation']=[ASSIGNMENT]+[row.replace('q.item_in_use_duration',VARIABLE) for row in d['scripts']['pre_animation']]
  d['scripts']['animate']=animate;output[p]=doc
 if tuple(json.loads((BP/'manifest.json').read_text())['header']['version']) >= (2,8,58):
  sys.path.insert(0,str(ROOT/'tools'))
  from build_java_eating_projection import augment
  output=augment(output,table)
 from secret_idle_calibration import augment as augment_idle
 from secret_terminal_visibility import augment as augment_terminal
 output=augment_terminal(augment_idle(output))
 if tuple(json.loads((BP/'manifest.json').read_text())['header']['version']) >= (2,8,126):
  from build_caterpillar_eating_projection import augment as augment_caterpillar
  output=augment_caterpillar(output)
 return output
def mismatch_details(expected, actual, limit=20):
 """Bounded diagnostics only; the full byte-for-byte check remains authoritative."""
 def walk(a,b,pointer=''):
  if type(a) is not type(b):
   yield pointer,a,b
  elif isinstance(a,dict):
   for key in dict.fromkeys([*a,*b]):
    escaped=str(key).replace('~','~0').replace('/','~1')
    if key not in a or key not in b:yield pointer+'/'+escaped,a.get(key),b.get(key)
    else:yield from walk(a[key],b[key],pointer+'/'+escaped)
  elif isinstance(a,list):
   if len(a)!=len(b):yield pointer+'/length',len(a),len(b)
   for i,(x,y) in enumerate(zip(a,b)):yield from walk(x,y,pointer+'/'+str(i))
  elif repr(a)!=repr(b):yield pointer,a,b
 try:
  from itertools import islice
  rows=list(islice(walk(json.loads(expected),json.loads(actual)),limit))
 except (ValueError,TypeError):rows=[]
 if not rows:return 'Serialized text differs (including whitespace); no structural difference found'
 lines=[]
 for pointer,a,b in rows:
  kind='value'
  if isinstance(a,(int,float)) and isinstance(b,(int,float)):
   if a==b==0:kind='signed zero'
   elif abs(a-b)==360:kind='360-degree representative'
  lines.append(f'{pointer}: committed={a!r}; generated={b!r} ({kind})')
 return '\n'.join(lines)
def main():
 p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');args=p.parse_args()
 for path,value in build().items():
  if isinstance(value,bytes):
   if args.check:assert path.read_bytes()==value,path
   else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(value)
   continue
  data=value if isinstance(value,str) else json.dumps(value,ensure_ascii=False,indent=2)+'\n'
  if args.check:
   existing=path.read_text()
   assert existing==data,f'{path}\n{mismatch_details(existing,data)}'
  else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data.encode('utf-8'))
 print('Authored eating item motion: five profiles, both hands; client acceptance false')
if __name__=='__main__':main()
