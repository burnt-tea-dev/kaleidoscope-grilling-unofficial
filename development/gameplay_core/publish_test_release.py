"""Publish exact tested main archives through an explicit draft/readback gate."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
REPO = 'casama233/kaleidoscope-grilling-unofficial'
REPO_ID = 1377218440
G66 = 'A2.8.66'
REQUEST = '.github/g66-test-release-request.json'
CURRENT_REQUEST = '.github/release-request.json'
CURRENT_NOTES = 'docs/PUBLICATION.md'
CANONICAL_WORKFLOW = '.github/workflows/gameplay-core.yml'
REVIEW_ARTIFACT = 'Kaleidoscope-Grilling-Canonical-Review'
EVIDENCE = (
    'docs/STATUS-A2.8.66.md',
    'docs/NATIVE-SECRET-6504-20261004.json',
    'docs/G66-SOURCE-PROVENANCE-20261004.json',
    'docs/BDS-G66-T98-L63-20261004.json',
    '.github/local-test-release-2.8.66.json',
)
# Reviewed public BP/RP identities: legacy compat/family/cookery-host.json and
# the Cookery 1.6.0 adapter baseline. A new author pair requires review here;
# the release label itself always comes from the canonical dependencies.
REVIEWED_COOKERY_HOSTS = {
    ('d322809c-a51e-4742-bfc4-16d3c1491c9d', '8e2c6318-2f5f-4907-aad0-31d10610e405'): (1, 0, 8),
    ('5df753c9-3436-4fba-87f1-a2da3651cfcf', 'f1d333ca-2d6b-4566-8005-e6c309816324'): (1, 6, 0),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def call(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


def api(endpoint, *, method='GET', payload=None, allow_missing=False):
    args = ['gh', 'api', endpoint, '--method', method]
    if payload is not None:
        args += ['--input', '-']
    result = subprocess.run(args, cwd=ROOT, input=None if payload is None else json.dumps(payload),
                            text=True, capture_output=True)
    if result.returncode:
        # Only a genuine 404 means absence; permissions/network errors fail closed.
        if allow_missing and re.search(r'\bHTTP 404\b', result.stderr):
            return None
        raise RuntimeError(f'GitHub API failed for {endpoint}: {result.stderr.strip()}')
    return json.loads(result.stdout)


def download_asset(asset_id):
    return subprocess.check_output(
        ['gh', 'api', f'repos/{REPO}/releases/assets/{asset_id}',
         '-H', 'Accept: application/octet-stream'], cwd=ROOT)


def release_by_tag(tag):
    release = api(f'repos/{REPO}/releases/tags/{tag}', allow_missing=True)
    if release is not None:
        return release
    # GitHub's by-tag endpoint omits drafts, including drafts with an existing
    # Git tag. Locate one exact draft in the authenticated inventory, then read
    # it by ID. All callers still verify its metadata, assets and tag target.
    matches = []
    page = 1
    while True:
        releases = api(f'repos/{REPO}/releases?per_page=100&page={page}')
        require(isinstance(releases, list) and len(releases) <= 100,
                'Unexpected release inventory')
        matches.extend(item for item in releases if item.get('tag_name') == tag)
        if len(releases) < 100:
            break
        page += 1
    if not matches:
        return None
    require(len(matches) == 1, 'Ambiguous release tag inventory')
    draft = matches[0]
    require(draft.get('draft') is True and type(draft.get('id')) is int,
            'Tag lookup omitted a non-draft or unidentified release')
    release = api(f"repos/{REPO}/releases/{draft['id']}")
    require(release.get('id') == draft['id'] and release.get('tag_name') == tag
            and release.get('draft') is True, 'Draft release changed during ID readback')
    return release


def tag_target(tag):
    ref = api(f'repos/{REPO}/git/ref/tags/{tag}', allow_missing=True)
    if ref is None:
        return None
    require(ref.get('ref') == f'refs/tags/{tag}', 'Unexpected remote tag ref')
    obj = ref['object']
    seen = set()
    while obj.get('type') == 'tag':
        oid = obj['sha']
        require(oid not in seen and len(seen) < 5, 'Cyclic/deep annotated remote tag')
        seen.add(oid)
        obj = api(f'repos/{REPO}/git/tags/{oid}')['object']
    require(obj.get('type') == 'commit', 'Remote tag does not resolve to a commit')
    return obj['sha']


def validate_request(version, report, assets, root=ROOT):
    require(version == G66, 'G66 request cannot authorize another version')
    path = root / REQUEST
    require(path.is_file(), 'G66 needs an explicit root publication request')
    request = json.loads(path.read_text(encoding='utf-8-sig'))
    require(type(request.get('schema')) is int and request['schema'] == 1, 'Unsupported G66 request schema')
    require(request.get('repository') == REPO and request.get('repository_id') == REPO_ID,
            'Wrong G66 publication repository')
    require(request.get('version') == version and request.get('tag') == 'A2.8.66-test', 'Wrong G66 version/tag')
    require(request.get('mode') == 'exact-g66-only-prerelease', 'G66 publication is not explicitly requested')
    require(request.get('prerelease') is True and request.get('make_latest') == 'false', 'G66 must stay prerelease/non-latest')
    require(request.get('require_functional_source_receipt') is True, 'G66 requires a functional source receipt')
    for key in ('complete_client_acceptance', 'java_all_view_parity', 'production_ready', 'saved_world_migration'):
        require(request.get(key) is False, f'G66 cannot promote {key}')
    require(report.get('source_tree_sha256') == request.get('expected_source_tree_sha256')
            and re.fullmatch(r'[0-9a-f]{64}', request.get('expected_source_tree_sha256', '')),
            'Frozen G66 source tree mismatch')
    for key in ('minecraft_tested', 'bds_tested', 'client_visuals_tested'):
        require(report.get(key) is False, f'G66 packaging report cannot promote {key}')
    require(set(request.get('expected_artifacts', {})) == {'mcaddon', 'brproject'}, 'Missing exact G66 artifact expectations')
    for key, asset in zip(('mcaddon', 'brproject'), assets[:2]):
        expected = request['expected_artifacts'][key]
        require(expected.get('name') == f'Kaleidoscope_Grilling_{G66}_Review.{key}', 'Unexpected G66 artifact name')
        require(asset.name == expected['name'] and sha256(asset) == expected.get('sha256')
                and report[key]['sha256'] == expected['sha256'], f'Frozen G66 {key} hash mismatch')
    sums = ''.join(f"{request['expected_artifacts'][key]['sha256']}  {request['expected_artifacts'][key]['name']}\n"
                   for key in ('mcaddon', 'brproject'))
    require((assets[0].parent / 'SHA256SUMS.txt').read_bytes() == sums.encode('utf-8'), 'G66 archive checksum manifest mismatch')
    require(set(request.get('evidence_sha256', {})) == set(EVIDENCE), 'G66 evidence must use the exact bounded allowlist')
    for relative in EVIDENCE:
        require(sha256(root / relative) == request['evidence_sha256'][relative], f'G66 evidence changed: {relative}')
    return request


def g66_notes(sha, status):
    return (
        f'# Kaleidoscope Grilling {G66} test prerelease\n\n'
        f'Built and functionally checked from exact GitHub main commit `{sha}`. '
        'Only Grilling G66 is published; no Tavern/World Liquor (T/L) release and no live deployment. '
        'This remains a test prerelease, never latest or production-ready. Back up the test world before installation.\n\n'
        'Install the `.mcaddon` with public Cookery 1.0.8. The guide is in the existing Cookery guide; '
        'no separate guide pack is needed, and private Cookery UUIDs cannot be substituted.\n\n'
        'Frozen G66 archives retain the exact reviewed hashes. All assets, including the functional source receipt '
        'and bounded evidence, are downloaded from the staged draft and SHA256-checked before publication. '
        'The release tag must resolve to the actual tested GitHub commit. Private images, worlds and raw logs are excluded.\n\n'
        'Bounded native 6504 witnesses: survival threading, Apple/Carrot artwork in main/offhand, '
        'oil/four flips/seasoning/cook-extract, preserved ordered lore and cooked owner properties 174/180/184, '
        'and a reported 500 ms short-use cancellation with return-to-idle/3-of-3 retention. '
        'These are not continuous active-use, bite timing, or full-use acceptance.\n\n'
        'Limits: lower ingredient remains cropped at FOV 60; third-person edge-on view is inconclusive; '
        'ALT is static-only, with no native ALT active-use witness. Continuous/full-use, broader posture/player/device, '
        'full Java/model/palette/GUI parity and full-family acceptance remain pending. '
        'The cooked world was saved/backed up but that cooked save was not reloaded; saved-world migration is unaccepted. '
        'BDS evidence covers only an isolated 8-pack G66/T98/L63 plus public Cookery 1.0.8 stack, '
        'two successful load/save/restart cycles and marker persistence. It does not certify the 16-pack family, '
        'client gameplay, or rendered parity. Complete client acceptance and production readiness remain false.\n\n'
        '## Frozen pre-publication status snapshot\n\n'
        'The attached status below records the earlier local-only preparation stage. '
        'Its historical no-publication statement is not a claim about the release currently being staged.\n\n'
        + status + '\n'
    )


def prepare_g66_assets(sha, report, assets, source_validation):
    request = validate_request(G66, report, assets)
    require(source_validation is not None and source_validation.is_file(), 'G66 functional source receipt is missing')
    from verify_current import require_source_validation
    receipt = require_source_validation(source_validation)
    require(receipt.get('version') == [2, 8, 66] and receipt['source']['head'] == sha, 'G66 functional receipt version/HEAD mismatch')
    out = assets[0].parent
    copied = out / 'grilling-source-validation.json'
    copied.write_bytes(source_validation.read_bytes())
    notes = out / 'release-notes.md'
    notes.write_text(g66_notes(sha, (ROOT / EVIDENCE[0]).read_text(encoding='utf-8')), encoding='utf-8', newline='\n')
    assets = assets + [ROOT / p for p in EVIDENCE] + [ROOT / REQUEST, copied, notes]
    require(len({p.name for p in assets}) == len(assets), 'Duplicate G66 asset names')
    manifest = out / 'RELEASE-ASSET-SHA256SUMS.txt'
    manifest.write_text(''.join(f'{sha256(p)}  {p.name}\n' for p in sorted(assets, key=lambda p: p.name)), encoding='utf-8', newline='\n')
    return request, assets + [manifest], notes


def verify_release_metadata(release, tag, sha, title, notes, *, draft):
    require(release.get('draft') is draft, 'Refusing to overwrite a published release or unexpected draft state')
    require(release.get('tag_name') == tag and release.get('target_commitish') == sha, 'Differing release tag/target')
    require(release.get('name') == title and release.get('body') == notes, 'Differing release title/notes')
    require(release.get('prerelease') is True, 'Release is not a prerelease')
    require(type(release.get('id')) is int, 'Missing release ID')


def asset_snapshot(assets):
    return {p.name: {'sha256': sha256(p), 'size': p.stat().st_size} for p in assets}


def require_asset_snapshot(assets, snapshot):
    require(asset_snapshot(assets) == snapshot, 'Local staged release assets changed')


def verify_release_assets(release, assets, *, complete, snapshot=None):
    expected = {p.name: p for p in assets}
    snapshot = asset_snapshot(assets) if snapshot is None else snapshot
    remote = api(f"repos/{REPO}/releases/{release['id']}/assets?per_page=100")
    require(isinstance(remote, list) and len(remote) < 100, 'Unexpected/paginated release asset inventory')
    names = [p['name'] for p in remote]
    require(len(set(names)) == len(names) and set(names) <= set(expected), 'Differing or duplicate draft assets')
    if complete:
        require(set(names) == set(expected), 'Staged release has missing assets')
    for asset in remote:
        local = expected[asset['name']]
        pinned = snapshot[local.name]
        require(asset.get('state') == 'uploaded' and asset.get('size') == pinned['size'], 'Remote asset size/state mismatch')
        digest = pinned['sha256']
        if asset.get('digest') is not None:
            require(asset['digest'] == 'sha256:' + digest, 'Remote reported asset digest mismatch')
        require(hashlib.sha256(download_asset(asset['id'])).hexdigest() == digest,
                f"Remote asset readback SHA256 mismatch: {asset['name']}")
    return set(expected) - set(names)


def publish_g66(sha, report, assets, source_validation):
    request, assets, notes_path = prepare_g66_assets(sha, report, assets, source_validation)

    def final_validation(snapshot):
        from verify_current import require_source_validation
        final_receipt = require_source_validation(source_validation)
        require(final_receipt.get('version') == [2, 8, 66] and final_receipt['source']['head'] == sha,
                'G66 final functional receipt version/HEAD mismatch')
        require(sha256(source_validation) == snapshot['grilling-source-validation.json']['sha256'],
                'G66 functional receipt bytes changed during staging')

    publish_exact(sha, request['tag'], f'Kaleidoscope Grilling {G66} Integrated Test',
                  notes_path, assets, final_validation)


def publish_exact(sha, tag, title, notes_path, assets, final_validation):
    """Share the existing immutable draft/upload/readback path, including G66."""
    snapshot = asset_snapshot(assets)
    notes = notes_path.read_text(encoding='utf-8')
    target = json.loads((ROOT / '.repo-target.json').read_text(encoding='utf-8-sig'))
    require(target.get('repository') == REPO and target.get('repository_id') == REPO_ID, 'Checkout repository identity mismatch')
    identity = api(f'repos/{REPO}')
    require(identity.get('full_name') == REPO and identity.get('id') == REPO_ID, 'Authenticated GitHub repository identity mismatch')
    require(api(f'repos/{REPO}/commits/{sha}').get('sha') == sha, 'Tested SHA is absent from actual GitHub')
    require(api(f'repos/{REPO}/git/ref/heads/main')['object']['sha'] == sha, 'Actual GitHub main is not the tested SHA')
    actual_tag = tag_target(tag)
    require(actual_tag is None or actual_tag == sha, 'Refusing to overwrite a differing remote tag')
    release = release_by_tag(tag)
    if release is not None:
        # Published releases are immutable here, even if their bytes happen to match.
        verify_release_metadata(release, tag, sha, title, notes, draft=True)
        missing = verify_release_assets(release, assets, complete=False, snapshot=snapshot)
        if missing:
            require_asset_snapshot(assets, snapshot)
            run('gh', 'release', 'upload', tag, *[str(p) for p in assets if p.name in missing], '--repo', REPO)
    else:
        require_asset_snapshot(assets, snapshot)
        run('gh', 'release', 'create', tag, *map(str, assets), '--repo', REPO, '--target', sha,
            '--title', title, '--notes-file', str(notes_path), '--draft', '--prerelease', '--latest=false')
    # Always fetch/download the staged assets, rather than trusting upload success.
    release = release_by_tag(tag)
    require(release is not None, 'Created draft is missing on readback')
    verify_release_metadata(release, tag, sha, title, notes, draft=True)
    verify_release_assets(release, assets, complete=True, snapshot=snapshot)
    actual_tag = tag_target(tag)
    if actual_tag is None:
        require_asset_snapshot(assets, snapshot)
        # GitHub may defer a draft's tag creation until publish. Create this one exact
        # ref only after asset validation, so its actual remote target can be checked.
        api(f'repos/{REPO}/git/refs', method='POST', payload={'ref': f'refs/tags/{tag}', 'sha': sha})
    require(tag_target(tag) == sha, 'Actual remote tag target does not match tested GitHub SHA')
    require(api(f'repos/{REPO}/git/ref/heads/main')['object']['sha'] == sha, 'GitHub main changed before publication')
    # Refuse raced edits and revalidate the selected evidence before publishing.
    release = release_by_tag(tag)
    verify_release_metadata(release, tag, sha, title, notes, draft=True)
    verify_release_assets(release, assets, complete=True, snapshot=snapshot)
    final_validation(snapshot)
    require_asset_snapshot(assets, snapshot)
    require(tag_target(tag) == sha, 'Remote tag changed before publication')
    api(f"repos/{REPO}/releases/{release['id']}", method='PATCH',
        payload={'draft': False, 'prerelease': True, 'make_latest': 'false'})
    published = release_by_tag(tag)
    verify_release_metadata(published, tag, sha, title, notes, draft=False)
    verify_release_assets(published, assets, complete=True, snapshot=snapshot)
    require(tag_target(tag) == sha, 'Published remote tag target mismatch')
    latest = api(f'repos/{REPO}/releases/latest', allow_missing=True)
    require(latest is None or latest.get('id') != published['id'], 'Prerelease was unexpectedly made latest')
    print('Published exact non-latest prerelease', tag, 'from tested GitHub main', sha)


def reviewed_cookery_requirement(version, root=ROOT):
    """Read the current host lock; never infer host identities from Grilling's version."""
    baseline = json.loads((root / 'baseline.json').read_text(encoding='utf-8-sig'))
    require(type(baseline.get('schema')) is int and baseline['schema'] == 1,
            'Unsupported release baseline schema')
    require(baseline.get('repository') == REPO and baseline.get('repository_id') == REPO_ID,
            'Release baseline repository mismatch')
    own_version = baseline['version']
    require(isinstance(own_version, list) and len(own_version) == 3
            and all(type(part) is int and part >= 0 for part in own_version),
            'Invalid release baseline version')
    require(version == 'A' + '.'.join(map(str, own_version)), 'Release version/baseline mismatch')
    packs = baseline['packs']
    owned_ids = {packs[side]['uuid'] for side in ('BP', 'RP')}
    hosts = {}
    for side in ('BP', 'RP'):
        manifest = json.loads((root / baseline['runtime'][side] / 'manifest.json').read_text(encoding='utf-8-sig'))
        require(manifest['header']['uuid'] == packs[side]['uuid']
                and manifest['header']['version'] == own_version
                and manifest.get('dependencies') == packs[side].get('dependencies'),
                f'{side} release manifest/baseline mismatch')
        external = [dep for dep in packs[side]['dependencies']
                    if 'uuid' in dep and dep['uuid'] not in owned_ids]
        require(len(external) == 1, f'Expected exactly one reviewed Cookery {side} dependency')
        hosts[side] = external[0]
        host_version = hosts[side].get('version')
        require(isinstance(host_version, list) and len(host_version) == 3
                and all(type(part) is int and part >= 0 for part in host_version),
                f'Invalid Cookery {side} dependency version')
    pair = (hosts['BP']['uuid'], hosts['RP']['uuid'])
    require(pair in REVIEWED_COOKERY_HOSTS, 'Unreviewed Cookery BP/RP dependency pair')
    require(tuple(hosts['BP']['version']) == tuple(hosts['RP']['version']) == REVIEWED_COOKERY_HOSTS[pair],
            'Cookery dependency version does not match the reviewed BP/RP pair')
    return 'Cookery ' + '.'.join(map(str, hosts['BP']['version']))


def current_request(sha, confirmed_tag):
    request = json.loads((ROOT / CURRENT_REQUEST).read_text(encoding='utf-8'))
    require(type(request.get('schema')) is int and request['schema'] == 1, 'Unsupported publication request')
    require(request.get('repository') == REPO and request.get('repository_id') == REPO_ID,
            'Wrong publication repository')
    require(request.get('publication_request') is True, 'Publication is not requested')
    require(request.get('prerelease') is True and request.get('make_latest') == 'false',
            'Current publication must remain a non-latest prerelease')
    version = request.get('version', '')
    tag = request.get('tag', '')
    require(re.fullmatch(r'A\d+\.\d+\.\d+', version) is not None
            and re.fullmatch(re.escape(version) + r'-beta\.[1-9]\d*', tag) is not None,
            'Invalid current release version/tag')
    require(confirmed_tag == tag, 'Manual tag confirmation does not match the request')
    require(request.get('client') is False and request.get('production_ready') is False,
            'Publication cannot promote client acceptance')
    require(re.fullmatch(r'[0-9a-f]{64}', request.get('expected_source_tree_sha256', '')) is not None,
            'Missing exact canonical runtime digest')
    expected = request.get('expected_artifacts', {})
    require(set(expected) == {'mcaddon', 'brproject'}, 'Missing exact artifact expectations')
    for kind, artifact in expected.items():
        require(artifact.get('name') == f'Kaleidoscope_Grilling_{version}_Review.{kind}'
                and re.fullmatch(r'[0-9a-f]{64}', artifact.get('sha256', '')) is not None,
                'Invalid requested artifact')
    source = request.get('integrated_source', {})
    commit = source.get('commit', '')
    require(re.fullmatch(r'[0-9a-f]{40}', commit) is not None, 'Missing integrated source commit')
    require(call('git', 'merge-base', commit, sha) == commit, 'Integrated source is not an ancestor of main')
    require(call('git', 'rev-parse', commit + '^{tree}') == source.get('tree'), 'Integrated source tree changed')
    reviewed_cookery_requirement(version, ROOT)
    return request


def remote_git_tree(sha):
    require(isinstance(sha, str) and re.fullmatch(r'[0-9a-f]{40}', sha) is not None,
            'Invalid checked Git commit')
    commit = api(f'repos/{REPO}/git/commits/{sha}')
    tree = commit.get('tree', {}).get('sha', '')
    require(commit.get('sha') == sha and re.fullmatch(r'[0-9a-f]{40}', tree) is not None,
            'Checked Git commit/tree is absent from the publication repository')
    return tree


def require_publication_run(run_id, sha):
    """Reuse successful CI only when its complete Git tree matches frozen main."""
    require(type(run_id) is int and run_id > 0, 'A successful validation run ID is required')
    base = f'repos/{REPO}/actions/runs/{run_id}'
    selected = api(base)
    repository = selected.get('repository', {})
    require(repository.get('full_name') == REPO and repository.get('id') == REPO_ID,
            'Validation run repository mismatch')
    require(selected.get('id') == run_id and selected.get('path') == CANONICAL_WORKFLOW,
            'Validation run workflow mismatch')
    run_head = selected.get('head_sha')
    tree = remote_git_tree(sha)
    require(remote_git_tree(run_head) == tree, 'Validation run full Git tree differs from main')
    require(selected.get('status') == 'completed' and selected.get('conclusion') == 'success',
            'Validation run has not succeeded')
    attempt = selected.get('run_attempt')
    require(type(attempt) is int and attempt > 0, 'Validation run attempt is missing')
    jobs = api(f'{base}/attempts/{attempt}/jobs?per_page=100')
    require(jobs.get('total_count', 101) < 100, 'Unexpected validation job inventory')
    for name in ('source', 'canonical'):
        matches = [job for job in jobs.get('jobs', []) if job.get('name') == name]
        require(len(matches) == 1 and matches[0].get('status') == 'completed'
                and matches[0].get('conclusion') == 'success',
                f'Validation {name} job did not actually pass')
    artifacts = api(f'{base}/artifacts?name={REVIEW_ARTIFACT}&per_page=100')
    require(artifacts.get('total_count') == 1 and len(artifacts.get('artifacts', [])) == 1,
            'Expected one canonical review artifact')
    artifact = artifacts['artifacts'][0]
    require(artifact.get('name') == REVIEW_ARTIFACT and artifact.get('expired') is False
            and artifact.get('workflow_run', {}).get('head_sha') == run_head
            and artifact.get('workflow_run', {}).get('id') == run_id,
            'Canonical review artifact is expired or belongs to another HEAD')
    require(type(artifact.get('id')) is int, 'Canonical review artifact ID is missing')
    return {'run_id': run_id, 'attempt': attempt, 'artifact_id': artifact['id'],
            'publication_head': sha, 'run_head': run_head, 'git_tree': tree}


def require_current_artifacts(request, report, assets, sha):
    require(report.get('version') == request['version'], 'Current report version differs from the request')
    checked_tree = remote_git_tree(report.get('git_sha'))
    require(checked_tree == remote_git_tree(sha), 'Archive report full Git tree differs from main')
    require(report.get('source_tree_sha256') == request['expected_source_tree_sha256'],
            'Current report runtime digest differs from the request')
    for key in ('minecraft_tested', 'bds_tested', 'client_visuals_tested'):
        require(report.get(key) is False, 'Packaging cannot promote native/client acceptance')
    for kind, asset in zip(('mcaddon', 'brproject'), assets[:2]):
        expected = request['expected_artifacts'][kind]
        require(asset.name == expected['name'] and sha256(asset) == expected['sha256']
                and report[kind]['sha256'] == expected['sha256'], f'Current {kind} hash mismatch')
    sums = ''.join(f"{request['expected_artifacts'][kind]['sha256']}  {request['expected_artifacts'][kind]['name']}\n"
                   for kind in ('mcaddon', 'brproject'))
    require((assets[0].parent / 'SHA256SUMS.txt').read_bytes() == sums.encode(),
            'Current archive checksum manifest mismatch')
    return checked_tree


def publish_current(sha, report, assets, request, validation):
    checked_tree = require_current_artifacts(request, report, assets, sha)
    require(checked_tree == validation['git_tree'], 'Archive and validation Git trees differ')
    metadata = {path: sha256(ROOT / path) for path in (CURRENT_REQUEST, CURRENT_NOTES)}
    binding = assets[0].parent / 'publication-binding.json'
    binding.write_text(json.dumps({
        'schema': 1, 'repository': REPO, 'repository_id': REPO_ID,
        'publication_commit': sha, 'validation': validation,
        'archive_report_commit': report['git_sha'], 'git_tree': checked_tree,
        'archive_report_sha256': sha256(assets[0].parent / 'build-report.json'),
        'source_tree_sha256': report['source_tree_sha256'],
        'artifacts': request['expected_artifacts'], 'metadata_sha256': metadata,
        'client': False, 'production_ready': False,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    assets = assets + [binding]
    notes = assets[0].parent / 'release-notes.md'
    notes.write_text(
        f"# Kaleidoscope Grilling {request['version']} beta\n\n"
        f"Source and tag target: `{sha}`. Canonical validation and archive source: "
        f"https://github.com/{REPO}/actions/runs/{validation['run_id']} "
        f"(attempt {validation['attempt']}).\n\n"
        f"CI run head: `{validation['run_head']}`; actual archive report commit: `{report['git_sha']}`. "
        f"All three commits have the same complete Git tree `{checked_tree}`. "
        "The original build report is attached unchanged; publication-binding.json records this relationship.\n\n"
        + (ROOT / CURRENT_NOTES).read_text(encoding='utf-8'), encoding='utf-8', newline='\n')

    def final_validation(snapshot):
        require({path: sha256(ROOT / path) for path in metadata} == metadata,
                'Publication metadata changed during staging')
        require(require_publication_run(validation['run_id'], sha) == validation,
                'Selected validation run or artifact changed during staging')

    publish_exact(sha, request['tag'], f"Kaleidoscope Grilling {request['version']} Beta",
                  notes, assets, final_validation)


def publish_legacy(version, sha, assets):
    """Keep unique-per-attempt publication, with the current reviewed host requirement."""
    host_requirement = reviewed_cookery_requirement(version, ROOT)
    tag = f"{version}-test.{os.environ['GITHUB_RUN_NUMBER']}.{os.environ['GITHUB_RUN_ATTEMPT']}"
    out = assets[0].parent
    notes = out / 'release-notes.md'
    status = ROOT / 'docs' / f'STATUS-{version}.md'
    notes.write_text(f'# {version} 整合測試版\n\n此包直接由合併後 main 的 `{sha}` 建置並校驗。\n\n'
        'Minecraft 客戶端操作／畫面及正式存檔遷移：**尚未驗收**。隔離 BDS 測試範圍以本版狀態文件與證據為準。請先備份測試世界。\n\n'
        f'安裝 `.mcaddon`；需要公開版 {host_requirement}（私人版 UUID 不可直接替換），煙火指南已在本體內，不需另外安裝指南包。\n\n'
        + (status.read_text(encoding='utf-8') if status.exists() else '') + '\n', encoding='utf-8')
    run('gh', 'release', 'create', tag, *map(str, assets), '--repo', REPO, '--target', sha,
        '--title', f'Kaleidoscope Grilling {version} Integrated Test', '--notes-file', str(notes), '--prerelease')
    print('Published', tag, 'from tested main', sha)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-validation', type=Path)
    parser.add_argument('--publication', choices=('check-run', 'publish'))
    parser.add_argument('--validation-run', type=int)
    parser.add_argument('--confirm-tag', default='')
    args = parser.parse_args()
    require(os.environ.get('GITHUB_REPOSITORY') == REPO, 'Wrong GitHub repository')
    require(os.environ.get('GITHUB_REPOSITORY_ID') == str(REPO_ID), 'Wrong GitHub repository ID')
    require(os.environ.get('GITHUB_REF') == 'refs/heads/main', 'Only tested main can publish')
    sha = call('git', 'rev-parse', 'HEAD')
    require(sha == os.environ['GITHUB_SHA'] and re.fullmatch(r'[0-9a-f]{40}', sha), 'GitHub tested SHA mismatch')
    request = validation = None
    if args.publication:
        require(os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch',
                'Current publication requires explicit manual dispatch')
        require(args.source_validation is None, 'Current publication cannot relabel a source receipt')
        request = current_request(sha, args.confirm_tag)
        validation = require_publication_run(args.validation_run, sha)
        if args.publication == 'check-run':
            print(json.dumps(validation, sort_keys=True))
            return
    else:
        require(not (ROOT / CURRENT_REQUEST).exists(), 'Current release requires the manual publication mode')
    out = ROOT / 'artifacts/review'
    report = json.loads((out / 'build-report.json').read_text(encoding='utf-8-sig'))
    if not args.publication:
        require(report['git_sha'] == sha, 'Release tag and tested source must identify the same commit')
    version = report['version']
    require(re.fullmatch(r'A\d+\.\d+\.\d+', version), 'Invalid release version')
    assets = []
    for key, ext in [('mcaddon', '.mcaddon'), ('brproject', '.brproject')]:
        matches = list(out.glob('*' + ext))
        require(len(matches) == 1, 'Expected one exact current archive per format')
        asset = matches[0]
        require(sha256(asset) == report[key]['sha256'], 'Build report/archive SHA256 mismatch')
        assets.append(asset)
    assets += [out / 'SHA256SUMS.txt', out / 'build-report.json']
    require(all(p.is_file() for p in assets), 'Missing release asset')
    if args.publication == 'publish':
        publish_current(sha, report, assets, request, validation)
    elif version == G66:
        receipt = args.source_validation
        if receipt is None and os.environ.get('RUNNER_TEMP'):
            receipt = Path(os.environ['RUNNER_TEMP']) / 'grilling-source-validation.json'
        publish_g66(sha, report, assets, receipt)
    else:
        publish_legacy(version, sha, assets)


if __name__ == '__main__':
    main()
