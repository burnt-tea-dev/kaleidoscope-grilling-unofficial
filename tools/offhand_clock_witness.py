"""Invert only the reviewed offhand presentation delta for historical witnesses.

Old hashes retain their original evidence scope. This does not certify the new
clock or terminal behavior; independent expression/session tests cover those.
"""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'development/gameplay_core'))
from native_eating_clock import ASSIGNMENT, SECONDS, OBSERVER_SECONDS

OLD_ASSIGNMENT = 'v.kg_eat_seconds = (c.is_first_person == 1 ? '+SECONDS+' : '+OBSERVER_SECONDS+');'
NEW_WAIT = '(q.is_using_item == 0 || v.kg_bite_stage < 3 || (v.kg_secret_terminal_wait ?? 0) == 1)'
OLD_WAIT = '(q.is_using_item == 0 || v.kg_bite_stage < 3)'

def historical_attachable_bytes(data):
    """Exact scalar substitutions only; preserve formatting and every other byte."""
    for new, old in ((ASSIGNMENT, OLD_ASSIGNMENT), (NEW_WAIT, OLD_WAIT)):
        data = data.replace(json.dumps(new)[1:-1].encode(), json.dumps(old)[1:-1].encode())
    return data

def historical_animation_bytes(data):
    """Only left-hand animation clocks may be reversed; never reserialize JSON."""
    from native_eating_clock import OFF_HAND_SECONDS
    document = json.loads(data)
    for name, clip in document.get('animations', {}).items():
        if clip.get('anim_time_update') == OFF_HAND_SECONDS:
            assert name.endswith('.left'), 'Offhand clock on a non-left clip is outside reviewed scope'
    return data.replace(json.dumps(OFF_HAND_SECONDS)[1:-1].encode(),
                        json.dumps(SECONDS)[1:-1].encode())
