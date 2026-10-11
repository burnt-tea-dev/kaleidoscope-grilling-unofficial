"""Retain G122 cuisine and guide content while admitting localized host rows."""
from pathlib import Path
import json
import os
import subprocess
from verify_a28122 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session

ROOT = Path(__file__).resolve().parents[2]
GUIDE_LOCALE_BASE = '8002da0086544cd18c9854e7fe79e8ccb2f9f982'


def main(expected_version=(2, 8, 123)):
    previous(expected_version=expected_version)
    catalog = 'projects/grilling/guide/catalog.a3.json'
    original = json.loads(subprocess.check_output(['git', 'show', GUIDE_LOCALE_BASE + ':' + catalog], cwd=ROOT))
    current = json.loads((ROOT / catalog).read_text(encoding='utf-8'))
    guide_version = '0.3.56' if tuple(expected_version) >= (2, 8, 126) else '0.3.55' if tuple(expected_version) >= (2, 8, 125) else '0.3.54' if tuple(expected_version) >= (2, 8, 124) else '0.3.53'
    assert original.pop('version') == '0.3.52' and current.pop('version') == guide_version, 'Maintained guide identity differs'
    assert current == original, 'G123 changed the released G122 guide content'
    for locale in ('zh_CN', 'zh_TW', 'en_US'):
        path = f'projects/grilling/gameplay_core/resource_pack/texts/{locale}.lang'
        original_bytes = subprocess.check_output(['git', 'show', GUIDE_LOCALE_BASE + ':' + path], cwd=ROOT)
        assert (ROOT / path).read_bytes() == original_bytes, 'G123 changed released language content: ' + locale
    print('G123 retains G122 cuisine and three-language guide content; host locale acceptance is source-only, native/client gates remain separate')


if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
