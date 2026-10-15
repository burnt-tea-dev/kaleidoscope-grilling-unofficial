"""Owned native 90-tick variants for Java's random eating profile.

No install-time transformation, foreign override or timer debit. Canonical food
IDs/recipes remain public; variants use the same assets, metadata and tags.
"""
from pathlib import Path
import json,re,argparse,copy
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'projects/grilling/gameplay_core';BP=P/'behavior_pack';RP=P/'resource_pack';SUFFIX='_java_three_alt'
def build():
 profiles=json.loads(re.search(r'PROFILE_BY_ITEM=Object.freeze\((\{.*?\})\)',(BP/'scripts/data.js').read_text()).group(1))
 ids={id for id,p in profiles.items() if p=='THREE_RANDOM'}|{'kaleidoscope_grilling:secret_skewer'}
 outputs={}
 for id in sorted(ids):
  name=id.split(':')[1];src=BP/'items'/f'{name}.json';doc=json.loads(src.read_text());item=doc['minecraft:item'];tag='kaleidoscope_grilling:food_'+name
  item['components']['minecraft:use_modifiers']['use_duration']=5.0
  tags=item['components'].setdefault('minecraft:tags',{'tags':[]})['tags']
  if tag not in tags:tags.append(tag)
  outputs[src]=doc
  alt=copy.deepcopy(doc);alt['minecraft:item']['description']['identifier']=id+SUFFIX;alt['minecraft:item']['description'].pop('menu_category',None);alt['minecraft:item']['components']['minecraft:use_modifiers']['use_duration']=4.5
  outputs[BP/'items'/f'{name}{SUFFIX}.json']=alt
  src=RP/'attachables'/f'{name}.attachable.json'
  if src.exists():
   from build_review_three_eating_projection import predecessor_document
   alt=predecessor_document(src,json.loads(src.read_text()));alt['minecraft:attachable']['description']['identifier']=id+SUFFIX
   outputs[RP/'attachables'/f'{name}{SUFFIX}.attachable.json']=alt
 # Native crafting must accept a held/dropped alternate-profile item too.
 def ingredients(v):
  if isinstance(v,dict):
   if v.get('item') in ids:v['tag']='kaleidoscope_grilling:food_'+v.pop('item').split(':')[1]
   for key,row in v.items():
    if key!='result':ingredients(row)
  elif isinstance(v,list):
   for row in v:ingredients(row)
 for src in (BP/'recipes').rglob('*.json'):
  doc=json.loads(src.read_text());before=copy.deepcopy(doc);ingredients(doc)
  if doc!=before:outputs[src]=doc
 # Alternate attachables use the same authored clock and exact renderer gates
 # as the motion generator. Neither command may overwrite them with a raw
 # canonical clone and make the other command's --check fail.
 from build_eating_motion import build as eating_motion
 authored=eating_motion(outputs)
 for src in list(outputs):
  if src.parent==RP/'attachables':outputs[src]=authored[src]
 return outputs
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');a=ap.parse_args()
 outputs=build()
 for p,d in outputs.items():
  value=json.dumps(d,ensure_ascii=False,indent=2)+'\n'
  if a.check:assert p.read_text()==value,p
  else:p.write_text(value)
 print('Native alternate-profile items and preserved recipe tags:',len(outputs))
