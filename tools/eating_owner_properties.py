"""Guard five owner eating properties once per attachable frame.

Missing owner properties already evaluate to zero in Bedrock, but also produce
content errors. Keep that fallback and cache each value for the existing item
clips. Do not change native queries, player clips, curves or item ownership.
"""
from copy import deepcopy
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PROPERTIES = ('eat_profile', 'eat_hand', 'eat_projection', 'eat_native_ticks', 'eat_elapsed_ticks')
PREFIX = 'kaleidoscope_grilling:'
VARIABLE_PREFIX = 'v.kg_owner_'
OWNER = 'c.owning_entity->q.'
READ = re.compile(r"c\.owning_entity->q\.property\('kaleidoscope_grilling:(eat_profile|eat_hand|eat_projection|eat_native_ticks|eat_elapsed_ticks)'\)")
CACHED = re.compile(r'\bv\.kg_owner_(eat_profile|eat_hand|eat_projection|eat_native_ticks|eat_elapsed_ticks)\b')

def initialization():
    return [VARIABLE_PREFIX + name + ' = (' + OWNER + "has_property('" + PREFIX + name + "') ? " + OWNER + "property('" + PREFIX + name + "') : 0);" for name in PROPERTIES]

def _map(value, function):
    if isinstance(value, str):
        return function(value)
    if isinstance(value, list):
        return [_map(item, function) for item in value]
    if isinstance(value, dict):
        return {key: _map(item, function) for key, item in value.items()}
    return value

def _contains(value, pattern):
    if isinstance(value, str):
        return bool(pattern.search(value))
    if isinstance(value, (list, dict)):
        return any(_contains(item, pattern) for item in (value.values() if isinstance(value, dict) else value))
    return False

def _forward(value):
    changed = _contains(value, READ)
    result = _map(value, lambda text: READ.sub(lambda match: VARIABLE_PREFIX + match[1], text))
    if changed and isinstance(result, dict) and 'minecraft:attachable' in result:
        scripts = result['minecraft:attachable']['description'].setdefault('scripts', {})
        scripts['pre_animation'] = initialization() + scripts.get('pre_animation', [])
    return result

def predecessor_document(value):
    """Reverse this exact layer; malformed initialization cannot be normalized."""
    if not _contains(value, CACHED):
        return value
    result = deepcopy(value)
    if isinstance(result, dict) and 'minecraft:attachable' in result:
        scripts = result['minecraft:attachable']['description'].get('scripts', {})
        pre = scripts.get('pre_animation', [])
        if pre[:len(PROPERTIES)] != initialization():
            raise ValueError('Owner eating property initialization is missing or changed')
        scripts['pre_animation'] = pre[len(PROPERTIES):]
    result = _map(result, lambda text: CACHED.sub(lambda match: OWNER + "property('" + PREFIX + match[1] + "')", text))
    if _forward(result) != value:
        raise ValueError('Owner eating property cache changes more than the exact guard layer')
    return result

def document(value):
    return _forward(predecessor_document(value))

def augment(output):
    return {path: document(value) if isinstance(value, dict) and path.parent.name in {'attachables', 'animations'} else value for path, value in output.items()}

def reference_bytes(path, current=None):
    """Expose the unchanged predecessor bytes to an existing historical check.

    Cached files must retain canonical serialization; whitespace/duplicate-key
    mutations cannot be hidden by a parse-and-reencode normalization.
    """
    import json
    path = Path(path)
    data = path.read_bytes() if current is None else current
    if path.suffix != '.json':
        return data
    value = json.loads(data)
    if not _contains(value, CACHED):
        return data
    encoded = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
    if data != encoded:
        raise ValueError('Owner eating property source serialization changed: ' + str(path))
    return (json.dumps(predecessor_document(value), ensure_ascii=False, indent=2) + '\n').encode()
