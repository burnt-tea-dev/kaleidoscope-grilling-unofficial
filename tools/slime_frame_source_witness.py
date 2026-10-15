"""Recover the exact prior bytes after validating the reviewed slime layer.

This conserves historical witnesses; it conveys no native clock acceptance.
"""
from copy import deepcopy
from functools import lru_cache
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REVIEWED_SLIME_BASE = '5c088cd1d5025c395b30d7a7f05268b9b7c2de70'
PREVIOUS_SLIME_BASE = '23031fc67ac96542d47d4a99295427e3a69af5c5'
MAIN_PATH = 'projects/grilling/gameplay_core/behavior_pack/scripts/main.js'
ATTACHABLE_PATH = 'projects/grilling/gameplay_core/resource_pack/attachables/grilled_slime_skewer.attachable.json'
TRANSPORT_PATH = 'projects/grilling/gameplay_core/behavior_pack/scripts/held_visual_transport.js'
PATHS = frozenset((MAIN_PATH, ATTACHABLE_PATH, TRANSPORT_PATH))

@lru_cache(maxsize=None)
def pinned_bytes(commit, relative):
    assert relative in PATHS
    return subprocess.check_output(['git', 'show', commit+':'+relative], cwd=ROOT)

def reference_bytes(path, current):
    path = Path(path)
    relative = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    if relative not in PATHS:
        return current
    if relative == MAIN_PATH:
        from build_review_three_eating_projection import restore_main
        try:
            current = restore_main(current.decode()).encode()
        except ValueError as error:
            raise AssertionError('Current slime continuation differs from reviewed complete bytes: '+relative) from error
    reviewed = pinned_bytes(REVIEWED_SLIME_BASE, relative)
    assert current == reviewed, 'Current slime continuation differs from reviewed complete bytes: '+relative
    before = pinned_bytes(PREVIOUS_SLIME_BASE, relative)
    if relative == MAIN_PATH:
        from build_slime_frame_selector import strip_main
        restored = strip_main(current.decode()).encode()
    elif relative == TRANSPORT_PATH:
        # Full postimage equality above admits only the immutable reviewed layer.
        restored = before
    else:
        from build_slime_frame_selector import frame_aliases, CONTROLLER
        document = deepcopy(json.loads(current))
        d = document['minecraft:attachable']['description']
        for alias in frame_aliases():
            del d['geometry'][alias]
            del d['textures'][alias]
        d['scripts']['pre_animation'] = [row for row in d['scripts']['pre_animation'] if not row.startswith('v.kg_slime_')]
        d['render_controllers'] = ['controller.render.kg_a22.bite' if row == CONTROLLER else row for row in d['render_controllers']]
        restored = (json.dumps(document, ensure_ascii=False, indent=2)+'\n').encode()
    assert restored == before, 'Slime layer changes prior complete source bytes: '+relative
    return before
