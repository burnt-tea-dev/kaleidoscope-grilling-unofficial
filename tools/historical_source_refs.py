"""Audit and resolve all literal historical code-comparison commit pins."""
from pathlib import Path
import json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]

# Only these local-repository commit fields are Git inputs. Other fixture hashes
# can identify upstream Java commits, blobs, trees or serialized bytes instead.
FIXTURE_GIT_REFS = {
 'development/gameplay_core/fixtures/tp-java-item-fallback.json': ('base_commit', 1),
 'development/gameplay_core/fixtures/offhand-projection-contract.json': ('base_commit', 1),
 'development/gameplay_core/fixtures/eating-route-extraction.json': ('baseline_commit', None),
}

def fixture_refs(root=ROOT):
 refs=set()
 for relative,(field,schema) in FIXTURE_GIT_REFS.items():
  document=json.loads((Path(root)/relative).read_text(encoding='utf-8'))
  if schema is not None:
   assert type(document.get('schema')) is int and document['schema']==schema, relative
  ref=document.get(field)
  assert isinstance(ref,str) and re.fullmatch(r'[0-9a-f]{40}',ref), 'Invalid fixture Git commit: '+relative+'#'+field
  refs.add(ref)
 return refs

def literal_refs(root=ROOT):
 refs=set()
 for folder in ('development/gameplay_core','tools'):
  for path in (Path(root)/folder).rglob('*.py'):
   if path.name in ('historical_source_refs.py','test_historical_source_refs.py'):continue
   text=path.read_text(encoding='utf-8')
   refs.update(re.findall(r"\b[A-Z_]*BASE[A-Z_]*\s*=\s*['\"]([0-9a-f]{7,40})['\"]",text))
   refs.update(re.findall(r"['\"]([0-9a-f]{7,40}):",text))
 return refs

def required_refs(root=ROOT):
 return literal_refs(root)|fixture_refs(root)

def inventory(root=ROOT):
 meta=json.loads((Path(root)/'tools/fixtures/g66-historical-source-refs.json').read_text())
 assert type(meta['schema']) is int and meta['schema']==1
 rows=meta['refs']
 assert rows and all(re.fullmatch(r'[0-9a-f]{7,40}',ref) and re.fullmatch(r'[0-9a-f]{40}',sha) for ref,sha in rows.items())
 assert required_refs(root)<=set(rows),'Historical source ref absent from audited inventory'
 return rows

def verify(root=ROOT):
 rows=inventory(root)
 for ref,expected in rows.items():
  actual=subprocess.check_output(['git','-C',str(root),'rev-parse','--verify',ref+'^{commit}'],text=True).strip()
  assert actual==expected,'Historical source ref changed: '+ref
 return {'refs':len(rows),'commits':len(set(rows.values()))}

def encoded_listing(root=ROOT):
 return ('\n'.join(sorted(set(inventory(root).values())))+'\n').encode('ascii')

if __name__=='__main__':
 # Binary stdout keeps exact SHA tokens under Windows Python's CRLF text mode.
 if sys.argv[1:]==['list']:sys.stdout.buffer.write(encoded_listing())
 elif sys.argv[1:]==['verify']:print(json.dumps(verify()))
 else:raise SystemExit('Use list or verify')
