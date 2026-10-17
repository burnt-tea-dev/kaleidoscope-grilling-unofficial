"""Exact inverse of the reviewed bottle-clearing guide clarification only."""
from functools import lru_cache
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[1]
BOTTLE_GUIDE_BASE='a092a9971ada91f16a973b01db4a3c9488f7ec1c'
PREVIOUS_BOTTLE_GUIDE_BASE='b66f9655ccdedbb78f0fa306973501299f3578a7'
LANG_PREFIX='projects/grilling/gameplay_core/resource_pack/texts/'
PATHS=frozenset([LANG_PREFIX+locale+'.lang' for locale in ('en_US','zh_CN','zh_TW')]+[
 'projects/grilling/guide/catalog.a3.json',
 'projects/grilling/gameplay_core/behavior_pack/scripts/guide/payload.js'])
KEY='guide.kg.body.kaleidoscope_grilling:special_seasoning.6='
@lru_cache(maxsize=None)
def pinned_bytes(commit,relative):
 assert relative in PATHS
 return subprocess.check_output(['git','show',commit+':'+relative],cwd=ROOT)
def reference_bytes(path,current):
 path=Path(path);relative=path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
 if relative not in PATHS:return current
 from guide_recipe_source import historical_bytes as guide_history
 try:current=guide_history(path,current)
 except ValueError as error:raise AssertionError('Bottle guide differs from complete G152 source: '+relative) from error
 reviewed=pinned_bytes(BOTTLE_GUIDE_BASE,relative)
 if relative=='projects/grilling/guide/catalog.a3.json' and current!=reviewed:
  from stable_host_source import reference_bytes as previous_stable_bytes
  try:current=previous_stable_bytes(relative,current)
  except ValueError as error:raise AssertionError('Bottle guide differs from complete reviewed bytes: '+relative) from error
 assert current==reviewed,'Bottle guide differs from complete reviewed bytes: '+relative
 before=pinned_bytes(PREVIOUS_BOTTLE_GUIDE_BASE,relative)
 if relative.startswith(LANG_PREFIX):
  old=[line for line in before.splitlines(keepends=True) if line.startswith(KEY.encode())]
  new=[line for line in reviewed.splitlines(keepends=True) if line.startswith(KEY.encode())]
  assert len(old)==len(new)==1 and old!=new,'Bottle guide translation scope changed'
  assert reviewed.replace(new[0],old[0],1)==before,'Bottle guide changed unrelated language bytes'
 return before
