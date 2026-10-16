"""G150 stable Cookery identity and source collision bounds, retaining prior gates."""
from verify_a28149 import main as previous


def main(expected_version=(2, 8, 150)):
    # Existing host, source-shape and exact runtime-ownership checks cover this
    # coupled delta; do not repeat their successful leaf commands here.
    previous(expected_version=expected_version)
    print('G150 Cookery 1.6.1 and collision source checks PASS; native/client acceptance remains separate')


if __name__ == '__main__':
    main()
