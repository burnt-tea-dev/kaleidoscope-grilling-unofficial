"""Guard bridge. projects against stale pack roots and silent export changes.

This is a project/export contract, not a full Bedrock schema or client test.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {'type', 'name', 'description', 'authors', 'targetVersion', 'experimentalGameplay', 'namespace', 'packs', 'worlds', 'packDefinitions', 'bdsProject'}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'duplicate JSON key: {key}')
        result[key] = value
    return result


def parse(data):
    return json.loads(data, object_pairs_hook=unique_object)


def load(path):
    return parse(path.read_text(encoding='utf-8-sig'))


def inventory(folder):
    return {p.relative_to(folder).as_posix(): p.read_bytes() for p in sorted(folder.rglob('*')) if p.is_file()}


def numeric_version(value):
    assert isinstance(value, list) and len(value) == 3 and all(type(part) is int and part >= 0 for part in value), 'invalid numeric manifest version'
    return tuple(value)


def check_pack_structure(folder, manifest, pack, version):
    """Validate executable pack declarations without a historical verifier chain."""
    assert numeric_version(manifest['header']['version']) == tuple(version), f'{pack}: header version drift'
    modules = manifest['modules']
    assert isinstance(modules, list) and modules, f'{pack}: modules missing'
    uuids = [module['uuid'] for module in modules]
    assert len(uuids) == len(set(uuids)), f'{pack}: duplicate module UUID'
    assert all(numeric_version(module['version']) == tuple(version) for module in modules), f'{pack}: module version drift'
    for kind in (('data', 'script') if pack == 'BP' else ('resources',)):
        matches = [module for module in modules if module.get('type') == kind]
        assert len(matches) == 1, f'{pack}: expected one {kind} module'
        if kind == 'script':
            script = matches[0]
            assert script.get('language') == 'javascript', 'unsupported script language'
            entry = PurePosixPath(script['entry'])
            assert not entry.is_absolute() and '..' not in entry.parts and not any(char in script['entry'] for char in ('\\', ':')), 'unsafe script entry'
            resolved_entry = (folder / entry).resolve()
            assert resolved_entry.is_relative_to(folder.resolve()), 'unsafe script entry'
            assert resolved_entry.is_file(), 'missing script entry'
    engine = numeric_version(manifest['header']['min_engine_version'])
    if pack == 'RP':
        capabilities = manifest.get('capabilities', [])
        assert isinstance(capabilities, list) and 'pbr' in capabilities, 'Grilling RP lost the required pbr capability'
        assert engine >= (1, 21, 120), 'pbr requires min_engine_version >= 1.21.120'
    else:
        pattern = re.compile(r"(?:from\s+|import\s*)['\"](\.[^'\"]+)['\"]")
        for path in (folder / 'scripts').rglob('*.js'):
            for specifier in pattern.findall(path.read_text(encoding='utf-8')):
                target = (path.parent / specifier).resolve()
                assert target.is_relative_to(folder.resolve()) and target.is_file(), f'missing or unsafe relative import: {path.name} -> {specifier}'


def check(root=ROOT):
    config, baseline = load(root / 'config.json'), load(root / 'baseline.json')
    assert REQUIRED <= config.keys(), f'missing project fields: {REQUIRED - config.keys()}'
    assert config['type'] == 'minecraftBedrock'
    assert config['worlds'] == [], 'release project must not include private worlds'
    # Bridge uses its own editor keys. World flags are separately declared in
    # the canonical baseline and must be adopted by the family deployment.
    beta = any(dep.get('module_name') == '@minecraft/server' and '-beta' in dep.get('version', '')
               for dep in baseline['packs']['BP']['dependencies'])
    expected_experiments = {'enableGameTestFramework': True} if beta else {}
    assert config['experimentalGameplay'] == expected_experiments, 'bridge experiment/API mismatch'
    assert baseline.get('required_experiments', {}) == ({'gametest': True} if beta else {}), 'world experiment/API mismatch'
    assert config['bridge']['formatVersion'] == 1, 'prevent automatic formatVersionCorrection insertion'
    plugins = config['compiler']['plugins']
    assert len(plugins) == 1 and plugins[0][0] == 'simpleRewrite', 'canonical packs must not use gameplay or format transforms'
    expected_name = 'Kaleidoscope_Grilling_' + '_'.join(map(str, baseline['version'])) + '_Canonical'
    assert plugins[0][1]['packName'] == expected_name, 'bridge build name drifted from canonical version'
    nested = load(root / 'projects/grilling/gameplay_core/config.json')
    assert nested['compiler']['plugins'] == plugins, 'nested bridge compiler differs from canonical export'
    assert nested['experimentalGameplay'] == config['experimentalGameplay'], 'nested bridge experiment mismatch'
    assert nested['targetVersion'] == config['targetVersion'], 'nested bridge target mismatch'
    report = {'project': config['name'], 'target_version': config['targetVersion'], 'packs': {}}
    for kind, pack in [('behaviorPack', 'BP'), ('resourcePack', 'RP')]:
        relative = Path(config['packs'][kind])
        assert not relative.is_absolute() and '..' not in relative.parts
        assert relative.as_posix() == baseline['runtime'][pack], f'{pack}: stale bridge. runtime root'
        folder = root / relative
        files = inventory(folder)
        manifest = load(folder / 'manifest.json')
        check_pack_structure(folder, manifest, pack, baseline['version'])
        assert manifest['header']['uuid'] == baseline['packs'][pack]['uuid']
        assert manifest['header']['version'] == baseline['version'], 'bridge. export changed the locked version'
        assert manifest['header']['name'] == 'Kaleidoscope Grilling ' + pack, 'stale version-labelled pack name'
        own_uuids = {row['uuid'] for row in baseline['packs'].values()}
        host_dependencies = [dep for dep in baseline['packs'][pack]['dependencies']
                             if 'uuid' in dep and dep['uuid'] not in own_uuids]
        assert len(host_dependencies) == 1, 'Grilling requires one reviewed Cookery pack per side'
        cookery = '.'.join(map(str, host_dependencies[0]['version']))
        assert 'Cookery '+cookery in manifest['header']['description'], 'stale displayed Cookery requirement'
        assert all(m['version'] == baseline['version'] for m in manifest['modules'])
        assert tuple(map(int, config['targetVersion'].split('.'))) >= tuple(manifest['header']['min_engine_version'])
        json_count = 0
        for name, data in files.items():
            if name.endswith(('.json', '.material')):
                parsed = parse(data.decode('utf-8-sig'))
                if pack == 'BP' and name.startswith('loot_tables/'):
                    assert 'type' not in parsed, f'{name}: Java-only top-level loot type'
                json_count += 1
        report['packs'][pack] = {'files': len(files), 'json_files': json_count, 'uuid': manifest['header']['uuid']}
    return report


def compare_pack(source, actual, label):
    assert source.keys() == actual.keys(), f'{label}: missing={sorted(source.keys()-actual.keys())[:8]}, extra={sorted(actual.keys()-source.keys())[:8]}'
    formatting = []
    for name, original in source.items():
        exported = actual[name]
        if original == exported:
            continue
        # bridge. may serialize JSON differently; never waive semantic changes,
        # especially header/module versions, dependencies, UUIDs or metadata.
        assert name.endswith(('.json', '.material')), f'{label}/{name}: byte drift'
        assert parse(original.decode('utf-8-sig')) == parse(exported.decode('utf-8-sig')), f'{label}/{name}: JSON semantic drift'
        formatting.append(name)
    return {'files': len(source), 'json_formatting_only': formatting, 'content_matches': True}


def verify_export(target, root=ROOT):
    baseline = load(root / 'baseline.json')
    if target.is_dir():
        exported = inventory(target)
    else:
        with zipfile.ZipFile(target) as z:
            names = [i.filename for i in z.infolist() if not i.is_dir()]
            assert len(names) == len(set(names)), 'duplicate archive paths'
            assert not z.testzip(), 'corrupt export'
            assert all(not PurePosixPath(n).is_absolute() and '..' not in PurePosixPath(n).parts for n in names)
            exported = {n: z.read(n) for n in names}
    report, consumed = {}, set()
    for pack, rel in baseline['runtime'].items():
        uuid = baseline['packs'][pack]['uuid']
        matches = [name for name, data in exported.items() if name.endswith('/manifest.json') and parse(data.decode('utf-8-sig')).get('header', {}).get('uuid') == uuid]
        assert len(matches) == 1, f'{pack}: missing or duplicate pack UUID'
        prefix = matches[0].removesuffix('manifest.json')
        actual = {name[len(prefix):]: data for name, data in exported.items() if name.startswith(prefix)}
        consumed.update(name for name in exported if name.startswith(prefix))
        report[pack] = compare_pack(inventory(root / rel), actual, pack)
    assert consumed == exported.keys(), f'unexpected exported pack/files: {sorted(exported.keys()-consumed)[:8]}'
    return report


def build_project(destination, root=ROOT):
    check(root)
    config, baseline = load(root / 'config.json'), load(root / 'baseline.json')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('config.json', json.dumps(config, ensure_ascii=False, indent=2) + '\n')
        for rel in baseline['runtime'].values():
            for name, data in inventory(root / rel).items():
                z.writestr(rel + '/' + name, data)
    return {'file': destination.name, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', type=Path)
    parser.add_argument('--verify-export', type=Path)
    args = parser.parse_args()
    report = check()
    if args.build:
        report['archive'] = build_project(args.build)
    if args.verify_export:
        report['export'] = verify_export(args.verify_export)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
