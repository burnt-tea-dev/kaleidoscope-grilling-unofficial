"""G146 plate-use arm visibility with all retained G145 source gates."""
from verify_a28145 import main as previous

def main(expected_version=(2,8,146)):
    previous(expected_version=expected_version)
    print('G146 retained source gates PASS; native acceptance remains pending')

if __name__=='__main__':main()
