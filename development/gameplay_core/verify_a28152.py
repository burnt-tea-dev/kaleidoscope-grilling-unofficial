"""G152 Cookery board guide correction, retaining every G151 gameplay gate."""
from verify_a28151 import main as previous


def main(expected_version=(2, 8, 152)):
    # Existing guide generation, historical source and complete inventory
    # checks own this correction; do not repeat their successful leaf commands.
    previous(expected_version=expected_version)
    print('G152 board guide source checks PASS; native/client acceptance remains separate')


if __name__ == '__main__':
    main()
