#!/usr/bin/env python3
"""Build the finite ground lookup and separate source diagnostics, entirely offline."""
import argparse,itertools,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FIXTURE=ROOT/'development/gameplay_core/fixtures/java-projectile-dodge-ground-160.json'
NATIVE_ALIAS_FIXTURE=ROOT/'development/gameplay_core/fixtures/java-projectile-dodge-native-alias-abi.json'
OUTPUT=ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_ground_catalog.js'
DIAGNOSTICS=ROOT/'development/gameplay_core/fixtures/projectile-dodge-ground-diagnostics.json'
VERSIONS=['1.20.1','1.21.1']

def build():
 data=json.loads(FIXTURE.read_text())
 if data['schema']!=2 or data['limitations']['runtime_admitted'] is not False:
  raise ValueError('Prepared source scope required; this producer cannot grant runtime admission')
 domains={}
 for key,entry in data['native_domains'].items():
  values=entry['values'];kind=entry['type']
  if not values or kind not in ['bool','int','string']:raise ValueError('Unknown Native domain')
  expected={'bool':bool,'int':int,'string':str}[kind]
  if any(type(x) is not expected for x in values):raise ValueError('Native domain loses exact value type')
  domains[key]=values
 abi=json.loads(NATIVE_ALIAS_FIXTURE.read_text())
 if abi['schema']!=1:raise ValueError('Unknown Native alias witness schema')
 alias_rows=abi['rows'];alias_ids=[r['id'] for r in alias_rows]
 if alias_ids!=sorted(set(alias_ids)):raise ValueError('Native alias identities must be unique and sorted')
 aliases={r['id']:r for r in alias_rows};used_aliases=set()
 rows=data['facts'];identities=[r['id'] for r in rows]
 if identities!=sorted(set(identities)):raise ValueError('Source fact identities must be unique and sorted')
 unknown={r['id'] for r in data['unknown_native']}
 if unknown&set(identities):raise ValueError('Unknown identity cannot acquire source permission')
 original=data['originals'];proofs=data['identity_proofs'];overlays=data['lookup_source_unions']
 facts=[];lookup=[];identity_held=[];branch_held=[]
 for row in rows:
  native_states={key:domains[key] for key in row['keys']}
  sources={}
  for version in VERSIONS:
   ids=row['sources'][version];actual=[original[version].get(id) for id in ids]
   available=bool(ids) and all(r is not None for r in actual)
   if available!=row['available'][version]:raise ValueError('Source availability disagrees with actual registered identities')
   source_rows=[]
   if available:
    if any(type(r['motion']) is not bool or r['states']<1 for r in actual):raise ValueError('Actual source states/scalar missing')
    if {r['motion'] for r in actual}!={row['motion']}:raise ValueError('Original source scalar disagreement')
    source_rows=[{'id':id,'states':r['states'],'motion':r['motion']} for id,r in zip(ids,actual,strict=True)]
   sources[version]={'available':available,'ids':ids,'rows':source_rows}
  proof=proofs.get(row['id'])
  accepted_proof_kinds={'bounded_registered_id_exact_english','prior_independent_two_original_registration_inheritance_and_native_domain_review','independently_reviewed_finite_identity_or_predicate_congruence','independently_reviewed_whole_original_vanilla_identity_union'}
  if proof and proof.get('kind') not in accepted_proof_kinds:raise ValueError('Unreviewed proof kind cannot grant source permission')
  if proof and proof['kind']=='bounded_registered_id_exact_english':
   if not proof['both_original_registered_id_equal']:raise ValueError('Identity gate requires actual exact IDs')
   if proof['native_label_key']!=row['serialization']+'.name':raise ValueError('Pinned Native label key lost serialization provenance')
   for version in VERSIONS:
    if sources[version]['ids']!=[row['id']] or original[version][row['id']].get('label')!=proof['native_label']:
     raise ValueError('Exact primary English/actual registered identity gate failed')
  fact={'typeId':row['id'],'motion':row['motion'],'states':native_states,'sources':sources,'mapping':row['mapping'],'identity':row['identity'],'proofKind':proof['kind'] if proof else None,'eligible':False}
  # Diagnostic R4 facts retain their original refs, even where a whole-ID union
  # qualifies the prospective consumer. No default/hidden color/segment is used.
  prospective_ids=overlays.get(row['id'],{}).get('source_ids',row['sources'])
  if row['id'] in data['additional_held_composites']:proof=None
  eligible_sources={}
  both=True
  for version in VERSIONS:
   ids=prospective_ids[version];actual=[original[version].get(id) for id in ids]
   if not ids or any(r is None for r in actual):both=False;continue
   if {r['motion'] for r in actual}!={row['motion']}:raise ValueError('Whole-ID predicate union must be congruent')
   eligible_sources[version]={'ids':ids,'states':sum(r['states'] for r in actual),'motion':row['motion']}
  if not proof:identity_held.append(row['id'])
  elif not both:branch_held.append(row['id'])
  else:
   fact['eligible']=True
   entry={'typeId':row['id'],'blocksMotion':row['motion'],'states':native_states,'sourceSets':eligible_sources,'identityKind':proof['kind']}
   alias=aliases.get(row['id'])
   if alias:
    primary=alias['primary_keys'];extra=alias['extra_keys']
    if primary!=sorted(native_states) or not extra or set(primary)&set(extra):raise ValueError('Alias loses complete declared primary keys')
    if alias['full_keys']!=sorted(primary+extra):raise ValueError('Alias loses exact full Native key set')
    expected={json.dumps(list(v),separators=(',',':')) for v in itertools.product(*(native_states[k] for k in primary))}
    observed=set();tuples=[]
    for witness in alias['witnesses']:
     values=witness['primary'];extras=witness['extra']
     if len(values)!=len(primary) or len(extras)!=len(extra):raise ValueError('Alias tuple width changes')
     if any(type(v) not in [bool,int,str] for v in values+extras):raise ValueError('Alias tuple loses primitive type')
     key=json.dumps(values,separators=(',',':'))
     if key not in expected or key in observed:raise ValueError('Alias primary product is invalid or duplicated')
     observed.add(key);tuples.append(values+extras)
    if observed!=expected:raise ValueError('Alias primary product is incomplete')
    entry['nativeAliases']={'primaryKeys':primary,'extraKeys':extra,'tuples':tuples}
    used_aliases.add(row['id'])
   lookup.append(entry)
  facts.append(fact)
 if used_aliases!=set(aliases):raise ValueError('Native field facts cannot grant held identities source permission')
 if abi['counts']['rows']!=len(aliases) or abi['counts']['complete_primary_tuples']!=sum(len(r['witnesses']) for r in alias_rows):raise ValueError('Alias witness counts disagree')
 all_branch_unavailable=[r['typeId'] for r in facts if not all(r['sources'][v]['available'] for v in VERSIONS)]
 summary={'original21OnlyFacts':sum(not r['sources']['1.20.1']['available'] and r['sources']['1.21.1']['available'] for r in facts),'diagnosticFacts':len(facts),'prospectiveLookupRows':len(lookup),'unknownNative':len(unknown),'identityHeld':len(identity_held),'identityEligibleBranchHeld':len(branch_held),'allBranchUnavailableFacts':len(all_branch_unavailable),'runtimeAdmitted':False,'movementIntegrated':False,'nativeOrClientAccepted':False}
 summary.update(nativeAliasRows=len(aliases),nativeAliasPrimaryTuples=abi['counts']['complete_primary_tuples'])
 summary['movementIntegrated']=data['limitations']['movement_integrated']
 header='// Generated owned source facts; no default native solidity or gameplay admission.\n// Source: development/gameplay_core/fixtures/java-projectile-dodge-ground-160.json\n'
 freeze="function freeze(v){if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v)}return v}\n"
 # Source-only audit facts are not loaded or recursively frozen by Bedrock.
 # Keep them generated beside the source fixtures for the existing audit checks.
 diagnostics={'PROJECTILE_DODGE_GROUND_SCOPE':summary,'PROJECTILE_DODGE_GROUND_FACTS':facts,'PROJECTILE_DODGE_GROUND_HELD_IDENTITIES':identity_held,'PROJECTILE_DODGE_GROUND_HELD_BRANCHES':all_branch_unavailable,'PROJECTILE_DODGE_GROUND_UNKNOWN_IDS':sorted(unknown)}
 # Encode the same JSON text as a string to avoid compiling thousands of
 # object-literal expressions. Values, key order and recursive freeze stay exact.
 raw=json.dumps(lookup,separators=(',',':'))
 text=header+freeze+'export const PROJECTILE_DODGE_GROUND_ROWS=freeze(JSON.parse('+json.dumps(raw)+'));\n'
 return text,summary,json.dumps(diagnostics,separators=(',',':'))+'\n'

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args()
 output,summary,diagnostics=build()
 if args.check:
  if not OUTPUT.exists() or OUTPUT.read_text()!=output:raise SystemExit('Owned ground catalog differs from the source fixture')
  if not DIAGNOSTICS.exists() or DIAGNOSTICS.read_text()!=diagnostics:raise SystemExit('Owned ground diagnostics differ from the source fixture')
 else:
  OUTPUT.write_text(output)
  DIAGNOSTICS.write_text(diagnostics)
 print(json.dumps(summary))
if __name__=='__main__':main()
