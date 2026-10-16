#!/usr/bin/env python3
"""Exact reversible exclusion of foreign TP eating startup on pinned Java ITEM routes."""
import pathlib,json,copy,argparse
ROOT=pathlib.Path(__file__).resolve().parents[1]
PLAYER=ROOT/'projects/grilling/gameplay_core/resource_pack/animations/eating_arms.animation.json'
CONTRACT=ROOT/'development/gameplay_core/fixtures/tp-java-item-fallback.json'
def contract():return json.loads(CONTRACT.read_text())
def encoded(d):return json.dumps(d,sort_keys=True,separators=(',',':'))
def predicate(hand):
 slot='slot.weapon.'+('mainhand'if hand=='right'else'offhand')
 return 'query.is_item_name_any('+','.join("'"+s+"'"for s in [slot]+contract()['owned_ids'])+')'
def expected():
 out=copy.deepcopy(contract()['predecessor'])
 for hand in ['right','left']:
  clip=out['animations']['animation.kg_eating.player.native_'+hand]
  clip['blend_weight']='('+clip['blend_weight']+') && !('+predicate(hand)+')'
 return out
def transform(doc,inverse=False):
 before,after=contract()['predecessor'],expected()
 if inverse:
  if encoded(doc)!=encoded(after):raise ValueError('TP exclusion inverse requires complete exact owned payload')
  return copy.deepcopy(before)
 if encoded(doc)==encoded(after):return copy.deepcopy(doc)
 if encoded(doc)!=encoded(before):raise ValueError('TP exclusion requires complete exact predecessor payload')
 return after
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args();doc=json.loads(PLAYER.read_text());out=transform(doc)
 if args.check:
  if encoded(doc)!=encoded(out):raise SystemExit('TP Java ITEM exclusion out of date')
 else:PLAYER.write_text(json.dumps(out,indent=2)+'\n')
 print('TP Java ITEM exclusion verified:62 identities,2 clips; partial TP correction only')
if __name__=='__main__':main()
