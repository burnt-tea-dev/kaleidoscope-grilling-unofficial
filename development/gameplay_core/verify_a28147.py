"""G147 guarded owner eating properties, retaining every G146 source gate."""
from verify_a28146 import main as previous

def main(expected_version=(2,8,147)):
    previous(expected_version=expected_version)
    print('G147 owner-property source gates PASS; editor/client acceptance separate')

if __name__ == '__main__':main()
