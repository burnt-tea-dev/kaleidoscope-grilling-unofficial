"""Historical c7 producer and contract, never a production compatibility path."""
import copy
from functools import lru_cache
import json
from pathlib import Path
import subprocess
import types

ROOT = Path(__file__).resolve().parents[1]
BASE = 'c7c0bfb047af06a5d1c42d6e31c873dc9ca6992f'

@lru_cache(maxsize=1)
def producer():
    def read(path):
        return subprocess.check_output(['git', 'show', BASE + ':' + path], cwd=ROOT)
    path = 'tools/build_offhand_eating_projection.py'
    module = types.ModuleType('frozen_c7_offhand_source')
    module.__file__ = str(ROOT / path)
    exec(compile(read(path), module.__file__, 'exec'), module.__dict__)
    contract = json.loads(read('development/gameplay_core/fixtures/offhand-projection-contract.json'))
    module.contract = lambda: copy.deepcopy(contract)
    return module
