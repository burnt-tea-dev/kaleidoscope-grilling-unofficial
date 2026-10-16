"""Review the exact Cookery 1.6.1 hooks through the existing host contract checks."""
from check_cookery160_host import check as check_reviewed_host


def check():
    check_reviewed_host(author161=True)


if __name__ == '__main__':
    check()
