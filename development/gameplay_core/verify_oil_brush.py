"""Exact source admission for the two authored oil-pot attachable routes."""
from pathlib import Path
import json,subprocess,sys
from functools import lru_cache
ROOT=Path(__file__).resolve().parents[2]
NAMES=frozenset(('grilling_oil_pot_brush.attachable.json','grilling_oil_pot_filled_brush.attachable.json'))
@lru_cache(maxsize=1)
def verify_once():
    from verification_session import run_checked_once
    for command in ([sys.executable,'-B','development/gameplay_core/test_oil_brush_assets.py'],
                    ['node','--test','development/gameplay_core/test_oil_brush_visual.mjs']):
        run_checked_once(command,cwd=ROOT)
def admit_attachable(path):
    if path.parent!=ROOT/'projects/grilling/gameplay_core/resource_pack/attachables' or path.name not in NAMES:
        return False
    sys.path.insert(0,str(ROOT/'tools'))
    from g153_repair_source import expected_files,sha,ledger
    relative=path.relative_to(ROOT).as_posix()
    admitted=expected_files()
    assert path.read_bytes()==admitted[relative]
    assert sha(path.read_bytes())==ledger()['changes'][relative]['after_sha256']
    verify_once()
    return True

if __name__=='__main__':
    for name in sorted(NAMES):
        assert admit_attachable(ROOT/'projects/grilling/gameplay_core/resource_pack/attachables'/name)
    print('Two exact oil-pot routes: source geometry, matrices, selectors and runtime checks passed')
