"""Receipt-only execution capability for registered synchronous verifiers.

The parent owns the immutable before/after source boundary. Historical scripts
still run directly; only explicit run_checked_once calls can reuse successes.
"""
import argparse
import os
from pathlib import Path
import runpy
import sys

from verification_session import SESSION_ENV, current_source_validation_session


def run_registered_verifier(target, *, directory, registered, arguments=()):
    directory = Path(directory).resolve()
    path = Path(target)
    names = set(registered.values())
    if (not path.is_absolute() or path.parent != directory
            or path.name not in names or not path.is_file()
            or path.resolve() != path):
        raise ValueError("receipt session requires an exact registered verifier path")
    # Older capable entrypoints consume this selector themselves. The common
    # runner owns this context now, so neither they nor child processes see it.
    os.environ.pop(SESSION_ENV, None)
    previous_argv, previous_path = sys.argv, sys.path[:]
    try:
        sys.argv = [str(path), *arguments]
        sys.path[0:1] = [str(directory)]
        with current_source_validation_session():
            runpy.run_path(str(path), run_name="__main__")
    finally:
        sys.argv = previous_argv
        sys.path[:] = previous_path


def main():
    from verify_current import DEV, VERIFIERS
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("verifier", type=Path)
    parser.add_argument("--compiled", action="store_true")
    args = parser.parse_args()
    run_registered_verifier(
        args.verifier, directory=DEV, registered=VERIFIERS,
        arguments=["--compiled"] if args.compiled else [],
    )


if __name__ == "__main__":
    main()
