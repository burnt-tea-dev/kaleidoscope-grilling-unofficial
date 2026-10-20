#!/usr/bin/env python3
"""Reproduce the T2.3 Java data tables from immutable public upstream inputs."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from java_extract.common import COMMIT, REPOSITORY
from java_extract.domains import extract_domains, extract_model_frames, enrich_named_parameters
from java_extract.external import extract_external, extract_minecraft_assets, extract_dimensions
from java_extract.foods import extract_foods

ROOT = Path(__file__).resolve().parents[2]
MINECRAFT_SHA1 = '30c73b1c5da787909b2f73340419fdf13b9def88'
MINECRAFT_URL = f'https://piston-data.mojang.com/v1/objects/{MINECRAFT_SHA1}/client.jar'
MINECRAFT_1201_SHA1 = '0c3ec587af28e5a785c0b4a7b8a30f9a8f78f838'
ASSET_INDEX_SHA1 = '9b16298b1dc0697878cec88bb2d96168f5239e4f'
ASSET_INDEX_URL = f'https://piston-meta.mojang.com/v1/packages/{ASSET_INDEX_SHA1}/17.json'
COOKERY_COMMITS = ('2f4e386ce23f49a385ddf003c67fc6415c55417a', '4d39e36cfa749939ba5f9d6d3b715ef9a984cb9c')


def git(path, *args):
    return subprocess.check_output(['git', '-C', str(path), *args], text=True).strip()


def verify_grilling(path):
    if git(path, 'rev-parse', 'HEAD') != COMMIT:
        raise ValueError(f'Grilling source must be checked out at {COMMIT}')
    if git(path, 'status', '--porcelain', '--untracked-files=all', '--', 'common', 'forge-1.20.1/src', 'neoforge-1.21.1/src', 'LICENSE-CODE', 'LICENSE-ASSETS', 'NOTICE'):
        raise ValueError('Grilling scanned source has modified or untracked files; use a clean pinned checkout')


def inputs(args):
    cache = args.cache
    cache.mkdir(parents=True, exist_ok=True)
    upstream = args.upstream or cache / 'grilling'
    if not upstream.exists():
        if args.upstream: raise ValueError(f'Missing source directory: {upstream}')
        subprocess.run(['git', 'clone', '--no-checkout', REPOSITORY, str(upstream)], check=True)
        subprocess.run(['git', '-C', str(upstream), 'checkout', '--detach', COMMIT], check=True)
    verify_grilling(upstream)
    cookery = args.cookery or cache / 'cookery'
    if not cookery.exists():
        if args.cookery: raise ValueError(f'Missing Cookery directory: {cookery}')
        subprocess.run(['git', 'clone', '--no-checkout', 'https://github.com/KaleidoscopeMods/KaleidoscopeCookery', str(cookery)], check=True)
    for commit in COOKERY_COMMITS:
        if git(cookery, 'cat-file', '-t', commit) != 'commit': raise ValueError('Missing pinned Cookery commit')
    jar = args.minecraft_jar or cache / 'minecraft-1.21.1-client.jar'
    if not jar.exists():
        if args.minecraft_jar: raise ValueError(f'Missing pinned Minecraft client: {jar}')
        # The two item textures live in the official client jar, not the sound
        # asset index. Keep this input outside the repository; never redistribute.
        with urllib.request.urlopen(MINECRAFT_URL) as response, jar.open('wb') as output:
            while chunk := response.read(1024 * 1024): output.write(chunk)
    if hashlib.sha1(jar.read_bytes()).hexdigest() != MINECRAFT_SHA1:
        raise ValueError('Minecraft client does not match the pinned SHA-1')
    def asset(supplied, filename, url, sha1):
        path = supplied or cache / filename
        if not path.exists():
            if supplied: raise ValueError(f'Missing supplied publisher asset: {path}')
            with urllib.request.urlopen(url) as response, path.open('wb') as target:
                while chunk := response.read(1024 * 1024): target.write(chunk)
        if hashlib.sha1(path.read_bytes()).hexdigest() != sha1:
            raise ValueError(f'Publisher SHA-1 mismatch: {path.name}')
        return path
    jar1201 = asset(args.minecraft_1201_jar, 'minecraft-1.20.1-client.jar',
                    f'https://piston-data.mojang.com/v1/objects/{MINECRAFT_1201_SHA1}/client.jar', MINECRAFT_1201_SHA1)
    index = asset(args.asset_index, 'minecraft-1.21.1-assets.json', ASSET_INDEX_URL, ASSET_INDEX_SHA1)
    sounds_hash = json.loads(index.read_text())['objects']['minecraft/sounds.json']['hash']
    sounds = asset(args.sounds_json, 'minecraft-1.21.1-sounds.json',
                   f'https://resources.download.minecraft.net/{sounds_hash[:2]}/{sounds_hash}', sounds_hash)
    return upstream, cookery, jar, jar1201, index, sounds


def generate(upstream, cookery, minecraft_jar, minecraft_1201_jar, asset_index, sounds_json, repo=ROOT):
    verify_grilling(upstream)
    documents = {}
    for extraction in (enrich_named_parameters(extract_domains(upstream), upstream), extract_model_frames(upstream),
                       extract_foods(upstream), extract_external(upstream, cookery, minecraft_jar, repo),
                       extract_minecraft_assets(minecraft_jar, asset_index, sounds_json),
                       extract_dimensions({'1.20.1': minecraft_1201_jar, '1.21.1': minecraft_jar})):
        duplicate = documents.keys() & extraction.keys()
        if duplicate: raise ValueError(f'Duplicate data tables: {duplicate}')
        documents.update(extraction)
    files = {name: (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode()
             for name, value in sorted(documents.items())}
    for name in ('LICENSE-CODE', 'LICENSE-ASSETS', 'NOTICE'):
        files[name] = (upstream / name).read_bytes()
    return files


def write_or_check(files, output, check=False):
    if check:
        actual = {p.name for p in output.iterdir() if p.is_file()} if output.exists() else set()
        if actual != set(files):
            raise ValueError(f'Output file set differs: missing={sorted(set(files)-actual)}, extra={sorted(actual-set(files))}')
        changed = [name for name, data in files.items() if (output/name).read_bytes() != data]
        if changed: raise ValueError(f'Extracted tables differ: {", ".join(changed)}')
        return
    output.mkdir(parents=True, exist_ok=True)
    extra = {p.name for p in output.iterdir() if p.is_file()} - set(files)
    if extra: raise ValueError(f'Refusing to remove unrelated output files: {sorted(extra)}')
    for name, data in files.items(): (output/name).write_bytes(data)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--upstream', type=Path, help='Clean Grilling checkout at the pinned commit; skips cloning')
    parser.add_argument('--cookery', type=Path, help='Cookery repository with both pinned commits; read via git show')
    parser.add_argument('--minecraft-jar', type=Path, help='Official pinned Minecraft 1.21.1 client, used only to read two PNGs')
    parser.add_argument('--minecraft-1201-jar', type=Path, help='Pinned official 1.20.1 client; read three dimension JSON files only')
    parser.add_argument('--asset-index', type=Path, help='Pinned official 1.21.1 asset index JSON')
    parser.add_argument('--sounds-json', type=Path, help='Official sounds.json referenced by the pinned asset index')
    parser.add_argument('--cache', type=Path, default=Path(tempfile.gettempdir())/'kaleidoscope-java-extract')
    parser.add_argument('--output', type=Path, default=ROOT/'data/java')
    parser.add_argument('--check', action='store_true', help='Regenerate in memory and compare all output bytes; no writes')
    args = parser.parse_args(argv)
    try:
        sources = inputs(args)
        files = generate(*sources)
        write_or_check(files, args.output, args.check)
    except (ValueError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f'Java extraction failed: {exc}\n')
    print(f'{"Verified" if args.check else "Generated"} {len(files)} files ({sum(map(len, files.values())):,} bytes) from pinned original sources')


if __name__ == '__main__': main()
