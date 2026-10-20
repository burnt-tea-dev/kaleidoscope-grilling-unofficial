"""Strict JSON validation without rewriting source files."""
from pathlib import Path
import json
import sys


def load_json(path):
    raw = Path(path).read_bytes()
    return json.loads(raw.decode('utf-8-sig'))


def main(names):
    errors = []
    for name in names:
        try:
            load_json(name)
        except (ValueError, OSError) as error:
            errors.append(f'{name}: {error}')
    if errors:
        raise SystemExit('\n'.join(errors))
    print(f'Validated {len(names)} JSON files; no files rewritten')


if __name__ == '__main__':
    main(sys.argv[1:])
