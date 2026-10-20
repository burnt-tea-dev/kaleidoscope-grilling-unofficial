"""Bounded external-source extraction. Never imports or executes upstream Java."""
from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import re
import struct
import subprocess
import zipfile

from PIL import Image

GRILLING = '9a1acdab27698457bec16c9362678e574895a28c'
COOKERY = {'forge1.20.1': '2f4e386ce23f49a385ddf003c67fc6415c55417a',
           'neoforge1.21.1': '4d39e36cfa749939ba5f9d6d3b715ef9a984cb9c'}
MINECRAFT = '30c73b1c5da787909b2f73340419fdf13b9def88'
# Immutable archive link target only; never read as a generation input.
FIXTURE_COMMIT = '2a3fecc2fd7a419a331e34129d5c0592075bf4d0'
PROVIDER = 'neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/SeasoningColorProvider.java'
COOKERY_ROOT = 'src/main/java/com/github/ysbbbbbb/kaleidoscopecookery/'


def _git(repo: Path, *args: str) -> bytes:
    return subprocess.check_output(['git', '-C', str(repo), *args])


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _match(pattern: str, text: str) -> re.Match:
    match = re.search(pattern, text, re.S)
    if match is None:
        raise ValueError(f'Expected pinned source syntax absent: {pattern}')
    return match


class _IntegerMergeMap:
    """JDK HashMap<Integer,Integer>.merge list bins, including resize timing.

    merge inserts at the head (unlike put); resize preserves split-bin order.
    Tree bins are deliberately rejected rather than approximated: none occurs
    in the eight pinned sprites. This makes a changed input fail closed.
    """
    def __init__(self):
        self.bins = []
        self.size = 0
        self.threshold = 0

    def _resize(self):
        old = self.bins
        self.bins = [[] for _ in range(2 * len(old) if old else 16)]
        self.threshold = len(self.bins) * 3 // 4
        for bucket in old:
            for key, count in bucket:
                self.bins[(key ^ (key >> 16)) & (len(self.bins) - 1)].append([key, count])

    def merge(self, key):
        if self.size > self.threshold or not self.bins:
            self._resize()
        bucket = self.bins[(key ^ (key >> 16)) & (len(self.bins) - 1)]
        for node in bucket:
            if node[0] == key:
                node[1] += 1
                return
        old_length = len(bucket)
        bucket.insert(0, [key, 1])
        if old_length >= 7:
            if len(self.bins) >= 64:
                raise ValueError('Pinned palette unexpectedly requires Java tree bins')
            self._resize()
        self.size += 1

    def ranked(self):
        # Python's stable sort preserves Java stream encounter order on ties.
        return sorted((node for bucket in self.bins for node in bucket), key=lambda node: -node[1])


def _palette(upstream: Path, minecraft_jar: Path) -> dict:
    source = (upstream / PROVIDER).read_text()
    fallback = [int(x, 16) for x in _match(r'FALLBACK\s*=\s*\{([^}]+)\}', source)[1].split(',')]
    alpha = int(_match(r'\(abgr >>> 24\) < (\d+)', source)[1])
    shade = float(_match(r'shade\(result\[0\], ([\d.]+)F\)', source)[1])
    limit = int(_match(r'\.limit\((\d+)\)', source)[1])
    for axis in ('width', 'height'):
        _match(rf'{axis} / 4; [xy] < {axis} \* 3 / 4;', source)
    _match(r'counts\.merge\(rgb, 1, Integer::sum\)', source)
    _match(r'comparingByValue\(\)\.reversed\(\)', source)
    if hashlib.sha1(minecraft_jar.read_bytes()).hexdigest() != MINECRAFT:
        raise ValueError('Minecraft client archive SHA-1 differs from the pinned publisher archive')
    ingredients = {}
    names = ['dragon_egg_powder', 'green_chili_powder', 'houttuynia_powder',
             'onion_powder', 'sichuan_pepper', 'totem_powder']
    with zipfile.ZipFile(minecraft_jar) as archive:
        for namespace, name in [('minecraft', 'redstone'), ('minecraft', 'gunpowder')] + [('kaleidoscope_grilling', n) for n in names]:
            path = f'assets/{namespace}/textures/item/{name}.png'
            model_path = f'assets/{namespace}/models/item/{name}.json'
            if namespace == 'minecraft':
                data = archive.read(path)
                model = json.loads(archive.read(model_path))
                origin = {'publisher_archive_sha1': MINECRAFT, 'license': 'Mojang Minecraft assets; not covered by Grilling asset license'}
            else:
                data = (upstream / 'common/src/main/resources' / path).read_bytes()
                model = json.loads((upstream / 'common/src/main/resources' / model_path).read_text())
                origin = {'source_commit': GRILLING, 'license': 'CC-BY-NC-SA-4.0; LICENSE-ASSETS'}
            if model != {'parent': 'minecraft:item/generated', 'textures': {'layer0': f'{namespace}:item/{name}'}}:
                raise ValueError(f'Unexpected model/particle texture resolution: {model_path}')
            image = Image.open(io.BytesIO(data)).convert('RGBA')
            counts = _IntegerMergeMap()
            width, height = image.size
            for y in range(height // 4, height * 3 // 4):
                for x in range(width // 4, width * 3 // 4):
                    r, g, b, a = image.getpixel((x, y))
                    if a >= alpha:
                        counts.merge((r << 16) | (g << 8) | b)
            colors = [key for key, _ in counts.ranked()[:limit]]
            if not colors:
                colors = fallback[:]
            elif len(colors) == 1:
                f32 = lambda n: struct.unpack('f', struct.pack('f', n))[0]
                colors.append(sum(int(f32(((colors[0] >> shift) & 255) * f32(shade))) << shift for shift in (16, 8, 0)))
            ingredients[f'{namespace}:{name}'] = {**origin, 'rgb': colors, 'sprite_path': path,
                'sprite_sha256': _sha(data), 'model_path': model_path, 'tint': -1,
                'tint_scope': 'These eight generated-item sprites have no registered ingredient tint.'}
    return {'source_commit': GRILLING, 'source_color_provider': PROVIDER,
            'publisher_archive_sha1': MINECRAFT,
            'extraction_method': 'Pinned sprite center-half RGBA pixels; JDK Integer HashMap.merge list-bin encounter order and stable count sort. No fixture color input.',
            'licenses': ['LICENSE-CODE (BSD-3-Clause)', 'LICENSE-ASSETS (CC-BY-NC-SA-4.0)', 'Mojang assets retain their separate rights'],
            'parameters': {'alpha_minimum': alpha, 'sample_rectangle': '[width/4,width*3/4) x [height/4,height*3/4)', 'fallback': fallback, 'single_color_shade': shade, 'color_count': limit},
            'ingredients': ingredients}


def _method(source: str, name: str) -> dict:
    # Pinned methods contain no brace-bearing strings. Strip comments only for
    # brace matching while returning the original, source-attributed excerpt.
    masked = re.sub(r'/\*.*?\*/|//[^\n]*', lambda m: ' ' * len(m[0]), source, flags=re.S)
    match = _match(r'(?:public|private|protected)\s+(?:static\s+)?[^;{}]*?\b' + re.escape(name) + r'\([^;{}]*\)\s*\{', masked)
    start = match.start()
    depth = 1
    end = match.end()
    while depth:
        if end >= len(masked):
            raise ValueError(f'Unclosed method {name}')
        depth += (masked[end] == '{') - (masked[end] == '}')
        end += 1
    return {'line_start': source[:start].count('\n') + 1, 'java_expression': source[start:end]}


def _cookery(cookery: Path) -> dict:
    selected = {
        'event/effect/ProjectileDodgeEvent.java': ['onProjectileHit', 'randomTeleport'],
        'event/effect/HinderEvent.java': ['onLivingDamage'],
        'network/message/SimpleC2SModMessage.java': ['handleFlatulenceEffect'],
        'item/quality/QualityEvaluator.java': ['evaluate', 'oneInputQuality', 'randomVector', 'evalQuality', 'getFinalScore'],
        'item/quality/Quality.java': [],
        'item/quality/QualityUtils.java': ['modifyEffects', 'modifyFoodProperties'],
    }
    loaders = {}
    for loader, revision in COOKERY.items():
        files = {}
        for suffix, methods in selected.items():
            path = COOKERY_ROOT + suffix
            raw = _git(cookery, 'show', f'{revision}:{path}')
            source = raw.decode()
            # NeoForge renamed event callback, so select its declaration by
            # source evidence instead of assuming the Forge method name.
            if suffix.endswith('HinderEvent.java'):
                methods = re.findall(r'public static void (\w+)\(', source)
            fields = [{'name': m[1], 'expression': m[2].strip()} for m in re.finditer(
                r'(?:public|private|protected)\s+static\s+final\s+(?:int|long|float|double)\s+(\w+)\s*=\s*([^;]+);', source)]
            row = {'source_path': path, 'source_commit': revision, 'sha256': _sha(raw),
                   'numeric_fields': fields, 'methods': {name: _method(source, name) for name in methods}}
            if suffix.endswith('/Quality.java'):
                row['tiers'] = [{'name': m[1], 'id': int(m[2]), 'score': float(m[3]), 'ratio': float(m[4])} for m in re.finditer(
                    r'(SUPERB|EXCELLENT|STANDARD|POOR)\((\d+),\s*"\w+",\s*ChatFormatting\.\w+,\s*([\d.]+),\s*([\d.]+)\)', source)]
                if len(row['tiers']) != 4:
                    raise ValueError('Expected four Cookery quality tiers')
            files[path] = row
        loaders[loader] = {'source_commit': revision, 'sources': files,
                           'license_text': _git(cookery, 'show', f'{revision}:LICENSE-CODE').decode()}
    return {'source_commit': COOKERY, 'source_repository': 'KaleidoscopeMods/KaleidoscopeCookery',
            'extraction_method': 'Read six bounded Java files with git show at each exact revision; extract numeric fields, quality tiers and selected method expressions without execution.',
            'licenses': ['BSD-3-Clause; upstream LICENSE-CODE retained per loader'], 'loaders': loaders}


def _fixtures() -> dict:
    """Small archival index, with no dependency on historical port Git objects.

    The fixture payloads include old experimental receipts and Bedrock ABI
    observations. Their immutable links preserve provenance without promoting
    those observations into regenerated Java semantics.
    """
    # name, original provenance categories, independent semantic extraction
    # targets, and the boundary that those targets intentionally do not cover.
    specs = [
        ('cookery-effect-feedback-160', ['cookery', 'mojang', 'tavern', 'port'], ['cookery.json'], 'Hinder and flatulence source methods regenerated; historical host audio/particle adaptations remain archived.'),
        ('cuisine-quality-160', ['cookery', 'grilling', 'port'], ['cookery.json'], 'Quality fields, tiers and evaluation methods regenerated; historical executed case vectors not replayed.'),
        ('eating-curves-1.1.1', ['grilling', 'port'], ['animation_curves.json'], 'Authored curve arrays regenerated; client acceptance not asserted.'),
        ('eating-piece-1.1.1', ['grilling'], ['eating_profiles.json', 'gameplay_rules.json'], 'Pinned source data regenerated; old embedded full Java copy remains archived.'),
        ('feedback-audio-1.21.1', ['mojang', 'port'], ['minecraft_assets.json'], 'All six original publisher event entries and sample identities independently regenerated; old port output paths remain archived.'),
        ('flatulence-sound-160', ['cookery', 'port'], ['cookery.json'], 'Sound call volume/pitch expressions regenerated; old release-bytecode receipt not replayed.'),
        ('flatulence-world-160', ['cookery', 'port'], ['cookery.json'], 'Original server-level source method regenerated; historical before-source comparison not reproduced.'),
        ('heat-deadlines', ['grilling', 'port'], ['heat.json'], 'Heat declarations and bucket rules regenerated; historical Java execution receipt not replayed.'),
        ('hud-1.1.1', ['grilling', 'port'], ['hud.json'], 'Source HUD dimensions regenerated; historical packaged-JAR receipts not reproduced.'),
        ('ordinary-particles-1.21.1', ['mojang', 'port'], ['minecraft_assets.json'], 'All nine publisher PNG identities/dimensions independently regenerated; particle equations and Bedrock integrator adaptations remain outside this extraction.'),
        ('projectile-dodge-audio-160', ['cookery', 'mojang', 'port'], ['cookery.json', 'minecraft_assets.json'], 'Cookery teleport sound calls and Minecraft 1.21.1 event/sample identities regenerated; 1.20.1 publisher metadata and historical binary receipts remain archived.'),
        ('projectile-dodge-ground-160', ['mojang', 'port'], [], 'Historical vanilla registry blocksMotion observations remain archived; no publisher runtime execution.'),
        ('projectile-dodge-liquid-160', ['cookery', 'mojang', 'port'], ['cookery.json'], 'Cookery randomTeleport caller regenerated; native fluid registry/API observations remain archived.'),
        ('projectile-dodge-liquid-forge-proof', ['mojang', 'port'], [], 'Historical selected bytecode/delegate analysis remains archived; not a fresh binary verification.'),
        ('projectile-dodge-movement-160', ['cookery', 'mojang', 'port'], ['cookery.json', 'minecraft_dimensions.json'], 'Sampling range, attempts, coordinate expressions and both publisher versions’ dimension logical bounds regenerated; registry/native observations remain archived.'),
        ('projectile-dodge-native-alias-abi', ['port'], [], 'Bedrock API observations only; not Java upstream data and not regenerated.'),
        ('projectile-dodge-owned-ground', ['grilling', 'cookery', 'mojang', 'port'], ['collision_shapes.json', 'gameplay_rules.json'], 'Grilling authored shape expressions regenerated; native ID mapping and engine predicate observations remain archived.'),
        ('seasoning-animation-1.1.1', ['grilling'], ['animation_curves.json', 'gameplay_rules.json'], 'Pinned authored animation parameters regenerated; old embedded source copies remain archived.'),
        ('seasoning-colors-1.1.1', ['grilling', 'mojang'], ['seasoning_colors.json'], 'All eight RGB pairs independently regenerated from pinned sprites and Java sampler.'),
        ('seasoning-motion-1.1.1', ['grilling', 'port'], ['animation_curves.json', 'gameplay_rules.json'], 'Authored parameters regenerated; Bedrock idle-hand anchoring remains a port adaptation.'),
        ('secret-framing-1.1.1', ['grilling', 'port'], ['model_frames.json'], 'Model display and element data regenerated; old renderer/parity statements remain archived.'),
    ]
    prefix = 'development/gameplay_core/fixtures/'
    repository = 'https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial'
    records = []
    for name, sources, targets, boundary in specs:
        path = prefix + 'java-' + name + '.json'
        records.append({'fixture': 'java-' + name + '.json', 'source_path': path,
            'archive_url': f'{repository}/blob/{FIXTURE_COMMIT}/{path}',
            'archive_commit': FIXTURE_COMMIT, 'source_categories': sources,
            'reproduction_status': 'archived_reference_only',
            'independent_extraction_status': ('source_semantics_extracted_separately' if targets else 'archived_reference_only'),
            'independent_extraction_targets': targets, 'scope': boundary})
    return {'source_commit': FIXTURE_COMMIT, 'source_repository': repository,
            'extraction_method': 'Static provenance index of the original 21 fixtures. Archive links only; no old port Git objects or fixture payloads read during generation. Independent source extraction targets do not reproduce archived experiments.',
            'licenses': ['Grilling and Cookery code: BSD-3-Clause; their assets: CC-BY-NC-SA-4.0', 'Mojang and Tavern sources retain their own rights; archive links do not relicense content'],
            'sources': {
                'grilling': {'repository': 'breezeth-CN/KaleidoscopeGrilling', 'source_commit': GRILLING},
                'cookery': {'repository': 'KaleidoscopeMods/KaleidoscopeCookery', 'source_commit': COOKERY},
                'mojang': {'publisher': 'Mojang', 'minecraft_versions': ['1.20.1', '1.21.1'], 'client_archive_sha1': {'1.20.1': '0c3ec587af28e5a785c0b4a7b8a30f9a8f78f838', '1.21.1': MINECRAFT}},
                'tavern': {'repository': 'casama233/kaleidoscope-tavern-unofficial', 'source_commit': 'a11a0eea4971373d2be71d5bcd4900e641fb015d'},
                'port': {'repository': 'burnt-tea-dev/kaleidoscope-grilling-unofficial', 'archive_commit': FIXTURE_COMMIT, 'category': 'Port adaptations, historical experiments and Bedrock API observations; not upstream Java semantics'}},
            'source_paths': [r['source_path'] for r in records], 'fixtures': records}


def extract_external(upstream: Path, cookery: Path, minecraft_jar: Path, repo: Path) -> dict:
    """Return deterministic data-only tables; the caller serializes them."""
    return {'seasoning_colors.json': _palette(upstream, minecraft_jar),
            'cookery.json': _cookery(cookery), 'external_sources.json': _fixtures()}


def extract_minecraft_assets(minecraft_jar: Path, asset_index: Path, sounds_json: Path) -> dict:
    """Extract selected publisher metadata only; never download/copy OGG assets."""
    index_sha1 = '9b16298b1dc0697878cec88bb2d96168f5239e4f'
    index_bytes = asset_index.read_bytes()
    if hashlib.sha1(index_bytes).hexdigest() != index_sha1:
        raise ValueError('Minecraft asset index differs from pinned 1.21.1 index 17')
    objects = json.loads(index_bytes)['objects']
    sounds_bytes = sounds_json.read_bytes()
    sounds_ref = objects['minecraft/sounds.json']
    if hashlib.sha1(sounds_bytes).hexdigest() != sounds_ref['hash'] or len(sounds_bytes) != sounds_ref['size']:
        raise ValueError('Minecraft sounds.json differs from its pinned asset index entry')
    sounds = json.loads(sounds_bytes)
    if hashlib.sha1(minecraft_jar.read_bytes()).hexdigest() != MINECRAFT:
        raise ValueError('Minecraft client archive differs from pinned 1.21.1 release')
    # The existing feedback importer defines the first six selections. The
    # seventh is the original event used by Cookery ProjectileDodgeEvent.
    selections = {'shield': 'item.shield.block', 'chime': 'block.amethyst_block.chime',
                  'golden': 'block.beacon.power_select', 'ordinary_break': 'entity.item.break',
                  'ordinary_impact': 'entity.lightning_bolt.impact', 'heavy_metal': 'item.totem.use',
                  'projectile_dodge': 'entity.enderman.teleport'}
    events = {}
    for alias, name in selections.items():
        original = sounds[name]
        samples = []
        for entry in original['sounds']:
            attributes = {'name': entry} if isinstance(entry, str) else entry
            if attributes.get('type', 'file') != 'file':
                raise ValueError(f'Unexpected nested event requires explicit extraction: {name}')
            asset = 'minecraft/sounds/' + attributes['name'] + '.ogg'
            reference = objects[asset]
            sha1 = reference['hash']
            samples.append({'author_asset': asset, 'publisher_sha1': sha1, 'size': reference['size'],
                            'url': f'https://resources.download.minecraft.net/{sha1[:2]}/{sha1}',
                            'declared_attributes': attributes})
        events[alias] = {'event': name, 'source_path': f'minecraft/sounds.json#{name}',
                         'original': original, 'samples': samples}
    particles = []
    with zipfile.ZipFile(minecraft_jar) as archive:
        for name in ['damage'] + [f'generic_{i}' for i in range(7, -1, -1)]:
            path = f'assets/minecraft/textures/particle/{name}.png'
            raw = archive.read(path)
            with Image.open(io.BytesIO(raw)) as sprite:
                width, height = sprite.size
            particles.append({'asset': name, 'source_path': path, 'sha256': _sha(raw),
                              'width': width, 'height': height})
    document = {
        'source_commit': None,
        'source_commit_note': 'Mojang publisher assets have release hashes, not a Git source commit.',
        'minecraft': '1.21.1',
        'extraction_method': 'Verify publisher client/index/sounds hashes, parse seven selected original sound entries and sample references, and read nine PNG identities/dimensions directly from the client ZIP. No OGG downloads and no fixture values used.',
        'licenses': ['Minecraft assets copyright Mojang; separate from Grilling/Cookery code and asset licenses. Only metadata and hashes reproduced.'],
        'publisher_inputs': {
            'client': {'sha1': MINECRAFT, 'url': f'https://piston-data.mojang.com/v1/objects/{MINECRAFT}/client.jar'},
            'asset_index': {'id': '17', 'sha1': index_sha1, 'url': f'https://piston-meta.mojang.com/v1/packages/{index_sha1}/17.json'},
            'sounds_manifest': {'sha1': sounds_ref['hash'], 'size': sounds_ref['size'],
                                'url': f"https://resources.download.minecraft.net/{sounds_ref['hash'][:2]}/{sounds_ref['hash']}"}},
        'source_paths': ['minecraft/sounds.json'] + [p['source_path'] for p in particles],
        'events': events, 'particle_sprites': particles,
        'scope': 'Sound entries retain exact publisher volume/pitch/weight declarations where present; absent attributes are not fabricated. Sprite metadata does not reproduce particle equations, collision, engine jitter, sound mixing or client playback. Minecraft 1.20.1 is outside this extraction.',
    }
    return {'minecraft_assets.json': document}


def extract_dimensions(jars: dict[str, Path]) -> dict:
    """Read only dimension-type JSON; no Minecraft classes are executed."""
    pins = {'1.20.1': '0c3ec587af28e5a785c0b4a7b8a30f9a8f78f838', '1.21.1': MINECRAFT}
    if set(jars) != set(pins):
        raise ValueError('Dimension extraction requires exactly the pinned 1.20.1 and 1.21.1 clients')
    versions = {}
    for version, sha1 in pins.items():
        jar = jars[version]
        if hashlib.sha1(jar.read_bytes()).hexdigest() != sha1:
            raise ValueError(f'Minecraft {version} client differs from pinned publisher archive')
        dimensions = {}
        with zipfile.ZipFile(jar) as archive:
            for name in ('overworld', 'the_nether', 'the_end'):
                path = f'data/minecraft/dimension_type/{name}.json'
                raw = archive.read(path)
                original = json.loads(raw)
                values = {key: original[key] for key in ('min_y', 'height', 'logical_height')}
                if not all(type(value) is int for value in values.values()):
                    raise ValueError(f'Unexpected noninteger dimension bounds: {version}/{name}')
                dimensions[name] = {'source_path': path, 'sha256': _sha(raw), 'original': original,
                                    **values, 'logical_max_y': values['min_y'] + values['logical_height'] - 1}
        versions[version] = {'publisher_archive_sha1': sha1,
                             'publisher_url': f'https://piston-data.mojang.com/v1/objects/{sha1}/client.jar',
                             'dimensions': dimensions}
    return {'minecraft_dimensions.json': {
        'source_commit': None,
        'source_commit_note': 'Mojang publisher data have release hashes, not a Git source commit.',
        'extraction_method': 'Verify both pinned client SHA-1 hashes and parse only three dimension_type JSON entries in each archive; derive logical_max_y = min_y + logical_height - 1.',
        'licenses': ['Minecraft data copyright Mojang; separate from Grilling/Cookery licenses.'],
        'source_paths': [f'data/minecraft/dimension_type/{name}.json' for name in ('overworld', 'the_nether', 'the_end')],
        'versions': versions,
        'scope': 'Cookery candidate Y clamp uses logical_height, not build height. These bounds do not establish blocksMotion, collision, liquid detection or native teleport acceptance.',
    }}
