"""Exact reviewed custom-effect postimages, without refreshing older witnesses."""
from functools import lru_cache
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[1]
REVIEWED_EFFECT_BASE='b38e6be99e4d1aba474ce857f3db64aa4f2b7086'
PREVIOUS_EFFECT_BASE='fd47371e553219852689dd1323b96f3d659e5dd8'
PREFIX='projects/grilling/gameplay_core/behavior_pack/scripts/'
PATHS=frozenset(PREFIX+n for n in ('main.js','effect_lifecycle_core.js','effect_state_runtime.js'))
@lru_cache(maxsize=None)
def pinned(commit,relative):
    assert relative in PATHS
    return subprocess.check_output(['git','show',commit+':'+relative],cwd=ROOT)
def reference_bytes(path,current):
    path=Path(path);relative=path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    if relative not in PATHS:return current
    before=pinned(PREVIOUS_EFFECT_BASE,relative)
    if current==before:return current
    if current!=pinned(REVIEWED_EFFECT_BASE,relative):
        raise ValueError('Effect source differs from exact reviewed complete postimage: '+relative)
    return before
def restore_main(text):
    if 'mergeEffectApplication' not in text and 'fxApply(' not in text:return text
    return reference_bytes(PREFIX+'main.js',text.encode()).decode()
def reapply_main(text):
    relative=PREFIX+'main.js'
    if text!=pinned(PREVIOUS_EFFECT_BASE,relative).decode():
        raise ValueError('Effect reapplication requires exact complete predecessor main')
    return pinned(REVIEWED_EFFECT_BASE,relative).decode()
