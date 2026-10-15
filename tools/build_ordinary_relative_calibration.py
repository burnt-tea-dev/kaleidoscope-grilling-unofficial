"""Exact 39-route transfer of the maintained secret-relative player arm frame."""
import copy,json,hashlib,argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'projects/grilling/gameplay_core';RP=P/'resource_pack';MAIN=P/'behavior_pack/scripts/main.js'
FIX=ROOT/'development/gameplay_core/fixtures/ordinary-relative-calibration.json'
PLAYER=RP/'animations/ordinary_relative_player.animation.json';DONOR=RP/'animations/java_eating_player.animation.json'
CONTEXTS=(('THREE_ALT','right'),('THREE_ALT','left'),('THREE','left'))
OLD="'animation.kg_java_eating.player.'+profile.toLowerCase()+'.'+(hand==='off'?'left':'right')"
def contract():
 value=json.loads(FIX.read_text())
 for relative,digest in value['source_pins'].items():
  if hashlib.sha256((ROOT/relative).read_bytes()).hexdigest()!=digest:raise ValueError('Ordinary Java source pin changed: '+relative)
 return value
def ids(profile,hand):
 if (profile,hand)not in CONTEXTS:raise ValueError('Unowned ordinary relative context')
 c=contract();return c['three_alt_ids']if profile=='THREE_ALT'else c['three_left_ids']
def player_id(profile,hand):return 'animation.kg_ordinary_relative.player.'+profile.lower()+'.'+hand
def selector():
 c=contract();alt=json.dumps(c['three_alt_ids'],separators=(',',':'))
 return "((profile==='THREE_ALT'&&"+alt+".includes(e.itemStack.typeId))||(profile==='THREE'&&hand==='off'&&e.itemStack.typeId==='kaleidoscope_grilling:grilled_ender_pearl_skewer')?'animation.kg_ordinary_relative.player.'+profile.toLowerCase()+'.'+(hand==='off'?'left':'right'):"+OLD+")"
def restore_main(text):
 from build_offhand_eating_projection import restore_main as restore_offhand
 text=restore_offhand(text)
 if 'kg_ordinary_relative' not in text:return text
 new=selector()
 if new in text:
  if text.count(new)!=1:raise ValueError('Duplicate ordinary relative selector')
  text=text.replace(new,OLD,1)
 if 'animation.kg_ordinary_relative.player.'in text:raise ValueError('Partial ordinary relative selector')
 return text
def patch_main(text):
 text=restore_main(text)
 if text.count(OLD)!=1:raise ValueError('Ambiguous generic player fallback')
 return text.replace(OLD,selector(),1)
def predicate(profile,hand,owned):
 names=ids(profile,hand)if owned else['kaleidoscope_grilling:secret_skewer'+('_java_three_alt'if profile=='THREE_ALT'else'')]
 return "q.is_item_name_any("+','.join("'"+x+"'"for x in ['slot.weapon.'+('mainhand'if hand=='right'else'offhand'),*names])+')'
def source_clip(profile,hand):
 data=DONOR.read_bytes()
 if hashlib.sha256(data).hexdigest()!=contract()['donor_sha256']:raise ValueError('Ordinary relative donor pin changed')
 return json.loads(data)['animations']['animation.kg_java_eating.player.'+profile.lower()+'.'+hand]
def transform(clip,profile,hand,inverse=False):
 from eating_owner_context import legacy_document
 source=source_clip(profile,hand);legacy=legacy_document(source)
 if clip.get('anim_time_update')==legacy.get('anim_time_update'):source=legacy
 owned=copy.deepcopy(source);old=' + ('+predicate(profile,hand,False)+' ? 3.41 : 0)';new=' + ('+predicate(profile,hand,True)+' ? 3.41 : 0)';count=0
 for name,bone in owned['bones'].items():
  if not name.endswith('arm'):continue
  for xyz in bone['position'].values():
   if not xyz[1].endswith(old):raise ValueError('Ordinary donor arm predicate changed')
   xyz[1]=xyz[1][:-len(old)]+new;count+=1
 if count!=(698 if profile=='THREE'else 304):raise ValueError('Ordinary arm key inventory changed')
 canonical=lambda d:json.dumps({k:v for k,v in d.items()if k!='blend_weight'},sort_keys=True,separators=(',',':'))
 if canonical(clip)!=canonical(owned if inverse else source):raise ValueError('Ordinary exact payload changed')
 out=copy.deepcopy(source if inverse else owned)
 if 'blend_weight'in clip:out['blend_weight']=clip['blend_weight']
 else:out.pop('blend_weight',None)
 return out
def animation(profile,hand,source=None):
 c=transform(source or source_clip(profile,hand),profile,hand)
 # Preserve the original eligibility expression, then narrow to owned identities.
 c['blend_weight']='('+c['blend_weight']+') && ('+predicate(profile,hand,True)+')'
 return c
def augment(output):
 out=dict(output);donor=out.get(DONOR,json.loads(DONOR.read_text()))['animations']
 out[PLAYER]={'format_version':'1.8.0','animations':{player_id(p,h):animation(p,h,donor['animation.kg_java_eating.player.'+p.lower()+'.'+h])for p,h in CONTEXTS}}
 out[MAIN]=patch_main(out.get(MAIN,MAIN.read_text()));return out
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');a=parser.parse_args()
 from build_eating_motion import build
 out=build()
 for p in [PLAYER,MAIN]:
  v=out[p];data=(v if isinstance(v,str)else json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode()
  if a.check:assert p.read_bytes()==data,p
  else:p.write_bytes(data)
 print('Ordinary relative arm calibration:39routes; absoluteclientbasis unresolved')
