"""G154 plate-transfer ownership over the exact preserved G153 source layer."""
from verify_a28153 import main as previous


def main(expected_version=(2, 8, 154)):
    previous(expected_version=expected_version)
    from pathlib import Path
    import sys
    from verification_session import run_checked_once
    root = Path(__file__).resolve().parents[2]
    for command in ([sys.executable, '-B', 'tools/test_g154_plate_source.py'],
                    [sys.executable, '-B', 'tools/test_g154_composition.py']):
        run_checked_once(command, cwd=root)
    print('G154 exact plate ownership source checks PASS; BDS/client acceptance separate')


if __name__ == '__main__':
    main()
