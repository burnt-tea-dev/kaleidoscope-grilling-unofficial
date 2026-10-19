#!/usr/bin/env python3
"""Census a stopped backup copy without opening its LevelDB in place.

The plan-approved Node LevelDB + prismarine-nbt backend opens only a fresh,
verified temporary clone. LevelDB housekeeping can change that clone. The
supplied offline copy is read/hashed only and checked again even on failure.
Never pass a running server world. No rewrite mode is implemented.

Install build-requirements.txt with pip --require-hashes, then run npm ci
--ignore-scripts --omit=dev and npm run build:native in this directory. The
reviewed binding is compiled from the exact locked registry source. Source manifest is the private stopped-backup
file manifest; public output contains aggregate counts and hashes only.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tempfile

OPS = Path(__file__).resolve().parent


def read_file(path: Path):
    flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NOATIME', 0)
    try:
        fd = os.open(path, flags)
    except PermissionError:
        fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    return os.fdopen(fd, 'rb')


def snapshot(db: Path) -> dict:
    files = {}
    for path in sorted(db.rglob('*')):
        meta = path.lstat()
        if stat.S_ISLNK(meta.st_mode):
            raise ValueError('SYMLINK_IN_INPUT_DB')
        if stat.S_ISDIR(meta.st_mode):
            continue
        if not stat.S_ISREG(meta.st_mode):
            raise ValueError('NON_REGULAR_INPUT_DB_FILE')
        digest = hashlib.sha256()
        with read_file(path) as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(block)
        after = path.lstat()
        fields = ('st_size', 'st_mtime_ns', 'st_mode', 'st_uid', 'st_gid', 'st_ino', 'st_dev')
        if any(getattr(meta, field) != getattr(after, field) for field in fields):
            raise ValueError('INPUT_DB_CHANGED_DURING_READ')
        files[path.relative_to(db).as_posix()] = {
            'sha256': digest.hexdigest(), 'bytes': meta.st_size,
            'mode': stat.S_IMODE(meta.st_mode), 'uid': meta.st_uid,
            'gid': meta.st_gid, 'mtime_ns': meta.st_mtime_ns,
        }
    if not files or 'CURRENT' not in files:
        raise ValueError('INPUT_IS_NOT_A_COMPLETE_LEVELDB_COPY')
    return files


def content(files):
    return {name: {'sha256': row['sha256'], 'bytes': row['bytes']} for name, row in files.items()}


def digest_content(files):
    return hashlib.sha256(json.dumps(content(files), sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def verify_manifest(files, manifest, prefix):
    expected = {name[len(prefix):]: row for name, row in manifest.items() if name.startswith(prefix)}
    if not expected or set(expected) != set(files):
        raise ValueError('DB_FILE_SET_DIFFERS_FROM_STOPPED_BACKUP_MANIFEST')
    if any(files[name]['sha256'] != expected[name]['sha256'] or files[name]['bytes'] != expected[name]['bytes'] for name in files):
        raise ValueError('DB_CONTENT_DIFFERS_FROM_STOPPED_BACKUP_MANIFEST')


def clone(db, files, target):
    target.mkdir()
    for name in files:
        dest = target / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        with read_file(db / name) as source, dest.open('xb') as output:
            shutil.copyfileobj(source, output, 1024 * 1024)
    if content(snapshot(target)) != content(files):
        raise ValueError('TEMPORARY_DB_COPY_MISMATCH')


def build_native():
    try:
        import cmake
    except ImportError as exc:
        raise ValueError('INSTALL_PINNED_BUILD_REQUIREMENTS') from exc
    if cmake.__version__ != '3.31.6':
        raise ValueError('PINNED_CMAKE_REQUIRED')
    executable = Path(shutil.which('node') or '').resolve()
    include = executable.parent.parent / 'include/node'
    if not (include / 'node_api.h').is_file():
        raise ValueError('NODE_NAPI_HEADERS_REQUIRED_NEXT_TO_NODE_INSTALLATION')
    source = OPS / 'node_modules/leveldb-zlib'
    addon = OPS / 'node_modules/node-addon-api'
    if not (source / 'leveldb-mcpe/CMakeLists.txt').is_file() or not (addon / 'napi.h').is_file():
        raise ValueError('INSTALL_LOCKED_NPM_DEPENDENCIES_WITH_SCRIPTS_DISABLED')
    command = str(Path(cmake.CMAKE_BIN_DIR) / 'cmake')
    subprocess.run([command, '-S', str(source), '-B', str(source / 'build'), '-DCMAKE_BUILD_TYPE=Release',
                    '-DCMAKE_JS_INC=' + str(include) + ';' + str(addon)], check=True)
    subprocess.run([command, '--build', str(source / 'build'), '--config', 'Release', '--parallel', '2'], check=True)
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--world-copy', type=Path, required=True)
    parser.add_argument('--source-manifest', type=Path, required=True)
    parser.add_argument('--manifest-db-prefix', required=True, help='Relative db prefix in the stopped-backup manifest, including final slash')
    parser.add_argument('--snapshot-archive-sha256', required=True)
    parser.add_argument('--key-lock', type=Path, default=OPS.parent / 'guards/save-compat.lock.json')
    parser.add_argument('--scratch-root', type=Path, default=Path(tempfile.gettempdir()))
    args = parser.parse_args(argv)
    if not re.fullmatch('[a-f0-9]{64}', args.snapshot_archive_sha256):
        parser.error('snapshot archive SHA256 must be 64 lowercase hexadecimal characters')
    prefix = args.manifest_db_prefix
    if not prefix.endswith('/') or PurePosixPath(prefix).is_absolute() or '..' in PurePosixPath(prefix).parts:
        parser.error('manifest db prefix must be a relative path ending with a slash')
    world = args.world_copy.resolve(strict=True)
    if not world.is_dir() or not (world / 'level.dat').is_file() or not (world / 'db').is_dir():
        parser.error('world-copy must contain level.dat and db')
    if any((parent / engine).exists() for parent in (world, *world.parents) for engine in ('bedrock_server', 'bedrock_server.exe')):
        parser.error('copy the world away from the server engine before census')
    db = world / 'db'
    if db.is_symlink():
        parser.error('db must be a real directory in the offline copy')
    original = snapshot(db)
    manifest_bytes = args.source_manifest.read_bytes()
    verify_manifest(original, json.loads(manifest_bytes), prefix)
    lock_bytes = args.key_lock.read_bytes()
    lock = json.loads(lock_bytes)
    if not isinstance(lock.get('persisted_key_literals'), list):
        parser.error('key-lock must contain persisted_key_literals')
    scratch = args.scratch_root.resolve()
    if scratch.is_relative_to(world) or any((parent / engine).exists() for parent in (scratch, *scratch.parents) for engine in ('bedrock_server', 'bedrock_server.exe')):
        parser.error('scratch must be outside the input world and any server engine tree')
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(args.scratch_root).free < sum(row['bytes'] for row in original.values()) + 2 * 1024**3:
        parser.error('scratch requires the complete db clone plus 2 GiB operating margin')
    result = {'schema': 1, 'task': 'T1.6', 'complete': False}
    unchanged = False
    try:
        with tempfile.TemporaryDirectory(prefix='grilling-world-census-', dir=args.scratch_root) as temp:
            target = Path(temp) / 'db'
            clone(db, original, target)
            config = {'db': str(target), 'persistedKeys': lock['persisted_key_literals'],
                      'knownItems': lock['items'], 'knownEntities': lock['entities'], 'knownBlocks': lock['blocks']}
            run = subprocess.run(['node', '--max-old-space-size=512', str(OPS / 'world_ids.mjs')], input=json.dumps(config),
                                 text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=OPS)
            if run.stderr:
                print(run.stderr, file=sys.stderr, end='')
            try:
                result.update(json.loads(run.stdout))
            except (ValueError, TypeError):
                result['errors'] = [{'code': 'BACKEND_DID_NOT_RETURN_A_CENSUS'}]
            if run.returncode:
                result['complete'] = False
            result['storage'] = {'input_database_opened_by_engine': False,
                                 'verified_temporary_clone': True,
                                 'temporary_engine_files_changed': content(snapshot(target)) != content(original),
                                 'binding_physical_read_only': False,
                                 'repair_requested': False,
                                 'iterator_errors_propagated': True,
                                 'all_arbitrary_bit_corruption_detection_proven': False}
    finally:
        unchanged = snapshot(db) == original
        result['input_unchanged'] = unchanged
        if not unchanged:
            result['complete'] = False
            result.setdefault('errors', []).append({'code': 'INPUT_DB_CHANGED'})
    result['source'] = {'snapshot_archive_sha256': args.snapshot_archive_sha256,
                        'source_file_manifest_sha256': hashlib.sha256(manifest_bytes).hexdigest(),
                        'key_lock_sha256': hashlib.sha256(lock_bytes).hexdigest(),
                        'db_content_sha256': digest_content(original), 'db_files': len(original),
                        'db_bytes': sum(row['bytes'] for row in original.values())}
    result['tool_sources_sha256'] = {name: hashlib.sha256((OPS / name).read_bytes()).hexdigest() for name in ('world_ids.py', 'world_ids.mjs', 'world_nbt.mjs', 'world_properties.mjs', 'package.json', 'package-lock.json', 'build-requirements.txt')}
    result.update(client=False, production_ready=False)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get('complete') and unchanged else 1


if __name__ == '__main__':
    try:
        raise SystemExit(build_native() if sys.argv[1:] == ['--build-native'] else main())
    except (OSError, ValueError, KeyError) as exc:
        print(json.dumps({'schema': 1, 'task': 'T1.6', 'complete': False, 'error': str(exc) if isinstance(exc, ValueError) else type(exc).__name__}))
        raise SystemExit(1)
