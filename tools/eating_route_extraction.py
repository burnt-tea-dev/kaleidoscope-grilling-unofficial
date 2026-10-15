"""One bounded main extraction bridge at the frozen 2e05439c boundary.

Historical layers recover their unchanged preimage. Current routing is tested by
semantic trace equivalence; future routes must not add inverse wrappers here.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
FIX=ROOT/'development/gameplay_core/fixtures/eating-route-extraction.json'
_CONTRACT=json.loads(FIX.read_text())
def contract():return _CONTRACT
def restore_main(text):
 c=contract()
 if not any(x in text for x in ['admitEatingProjection','selectEatingProjection','eating_projection_routes']):return text
 if text.count(c['import'])!=1:raise ValueError('Unknown route resolver import')
 text=text.replace(c['import'],'',1)
 for old,new in reversed(c['replacements']):
  if text.count(new)!=1:raise ValueError('Partial or altered route resolver boundary')
  text=text.replace(new,old,1)
 if 'admitEatingProjection' in text or 'selectEatingProjection' in text or 'eating_projection_routes' in text:raise ValueError('Unexpected resolver ownership')
 return text

def extract_main(text):
 c=contract();text=restore_main(text)
 for old,new in c['replacements']:
  if text.count(old)!=1:raise ValueError('Unknown frozen projection preimage')
  text=text.replace(old,new,1)
 return c['import']+text

def validate_resolver():
 import hashlib
 c=contract();p=ROOT/c['resolver_path']
 if hashlib.sha256(p.read_bytes()).hexdigest()!=c['resolver_sha256']:raise ValueError('Unreviewed resolver bytes')
 return c['resolver_path']
