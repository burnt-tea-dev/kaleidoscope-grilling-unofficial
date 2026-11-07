"""Install one callsite trace into a stopped diagnostic scripts copy only.

The canonical runtime and old fixture stay unchanged. Exact source matching is
an installation boundary, not a behavioral test; fidelity tests execute both
real module implementations against the same Minecraft API model.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts'
FIXTURES = Path(__file__).resolve().parent
ORIGINAL = " system.run(()=>{try{player.applyDamage(3.4028234663852886e38,{cause:'selfDestruct'})}catch(error){console.warn('[Grilling ordinary damage] '+error)}});"
TRACED = """ system.run(()=>{let qaEnterRecorded=false;try{
  qaEnterRecorded=recordOrdinaryDamageTrace('enter',player);
  const qaReturn=player.applyDamage(3.4028234663852886e38,{cause:'selfDestruct'});
  recordOrdinaryDamageTrace('return',player,qaReturn,qaEnterRecorded);
 }catch(error){
  recordOrdinaryDamageTrace('exception',player,error,qaEnterRecorded);
  console.warn('[Grilling ordinary damage] '+error)
 }});"""


def instrument_source(source):
    if source.count(ORIGINAL) != 1:
        raise ValueError('Selected original callsite must occur exactly once')
    return "import {recordOrdinaryDamageTrace} from '../ordinary_damage_trace.js';\n"+source.replace(ORIGINAL, TRACED, 1)


def install(scripts):
    scripts = scripts.resolve()
    if scripts == SCRIPTS.resolve() or SCRIPTS.resolve() in scripts.parents:
        raise ValueError('Use a stopped diagnostic copy, never canonical scripts')
    target = scripts/'effect/runtime.js'
    if target.is_symlink() or target.resolve() == (SCRIPTS/'effect/runtime.js').resolve():
        raise ValueError('Diagnostic effect runtime must be its own regular copy')
    original = (SCRIPTS/'effect/runtime.js').read_bytes()
    if target.read_bytes() != original:
        raise ValueError('Diagnostic effect runtime differs from the fixed original')
    additions = {name:(FIXTURES/name).read_bytes() for name in [
        'ordinary_network_food_probe.js','ordinary_damage_trace.js','ordinary_damage_trace_probe.js']}
    for name, data in additions.items():
        p = scripts/name
        if p.exists() and p.read_bytes() != data:
            raise ValueError('Preserve different diagnostic file: '+name)
    traced = instrument_source(original.decode()).encode()
    target.write_bytes(traced)
    for name, data in additions.items():
        if not (scripts/name).exists():
            (scripts/name).write_bytes(data)
    # These identities let the runner disclose the actual changed diagnostic
    # bytes alongside its existing inputs, not silently label them G247 bytes.
    return {'installed':True,'mode':'QA-only single-callsite trace',
            'target':'effect/runtime.js',
            'original_sha256':hashlib.sha256(original).hexdigest(),
            'instrumented_sha256':hashlib.sha256(traced).hexdigest(),
            'entry':'scripts/ordinary_damage_trace_probe.js',
            'added_files':list(additions),'original_schedule':'system.run once',
            'native_call_count':1,'canonical_runtime_modified':False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('scripts',type=Path)
    args = parser.parse_args()
    print(json.dumps(install(args.scripts),indent=2))


if __name__ == '__main__':
    main()
