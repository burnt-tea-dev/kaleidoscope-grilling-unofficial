"""Extract food registrations and eating curves, without executing Java code."""
from __future__ import annotations

import json
import re
from pathlib import Path

from .common import JAVA, LOADERS, balanced, calls, envelope, number, source_info, split_args, strip_comments


def _method(text, name, parameter=None):
    for pos, args in calls(text, name):
        if parameter and not any(parameter in arg for arg in args):
            continue
        opening = text.index('(', pos)
        _, end = balanced(text, opening)
        tail = text[end:]
        if re.match(r'\s*\{', tail):
            start = text.index('{', end)
            body, finish = balanced(text, start, '{', '}')
            return pos, body, text[pos:finish]
    raise ValueError(f'Missing Java method {name}')


def _effect(expr):
    expr = expr.strip()
    if expr == 'null':
        return None
    match = re.fullmatch(r'(cookeryEffect|grillingEffect)\("([^"]+)"\)', expr)
    if match:
        return ('kaleidoscope_cookery:' if match[1] == 'cookeryEffect' else 'kaleidoscope_grilling:') + match[2]
    vanilla = re.fullmatch(r'ResourceLocation.withDefaultNamespace\("([^"]+)"\)', expr)
    if vanilla:
        return 'minecraft:' + vanilla[1]
    match = re.fullmatch(r'(?:new ResourceLocation|ResourceLocation.fromNamespaceAndPath)\((.*)\)', expr, re.S)
    if match:
        args = split_args(match[1])
        namespace = 'kaleidoscope_grilling' if args[0] == 'KaleidoscopeGrilling.MOD_ID' else json.loads(args[0])
        return namespace + ':' + json.loads(args[1])
    raise ValueError(f'Unsupported effect identifier {expr}')


def _evidence(upstream, path, text, pos, method, expression):
    return {**source_info(upstream, path, text.count('\n', 0, pos) + 1, method),
            'expression': expression}


def _call_expression(text, pos):
    _, end = balanced(text, text.index('(', pos))
    return text[pos:end]


def _constant(text, name):
    match = re.search(r'\b' + name + r'\s*=\s*([^;]+);', text)
    if not match:
        raise ValueError(f'Missing constant {name}')
    return number(match[1]), match


def _profile_name(expr):
    match = re.fullmatch(r'(?:MultiBiteSkewerItem\.)?AnimationProfile\.([A-Z_]+)', expr)
    if not match:
        raise ValueError(f'Unsupported animation profile {expr}')
    return match[1]


def _loader(upstream, loader, overrides):
    path = f'{loader}/{JAVA}registry/ModItems.java'
    text = strip_comments((upstream / path).read_text())
    ppath = f'{loader}/{JAVA}skewer/MultiBiteSkewerItem.java'
    ptext = strip_comments((upstream / ppath).read_text())
    rulepos, rulebody, ruleexpr = _method(text, 'animationProfile')
    rules = []
    for match in re.finditer(r'if\s*\((.*?)\)\s*return\s+MultiBiteSkewerItem.AnimationProfile\.([A-Z_]+);', rulebody, re.S):
        rules.append({'names': re.findall(r'name.equals\("([^"]+)"\)', match[1]),
                      'profile': match[2], 'expression': match[0]})
    replacements = re.findall(r'\.replace\("([^"]*)",\s*"([^"]*)"\)', rulebody)
    defaults = re.findall(r'return\s+MultiBiteSkewerItem.AnimationProfile\.([A-Z_]+);', rulebody)
    if not rules or not defaults:
        raise ValueError(f'Cannot parse animationProfile rules in {path}')
    def named_profile(item):
        name = item
        for old, new in replacements:
            name = name.replace(old, new)
        return next((r['profile'] for r in rules if name in r['names']), defaults[-1])

    profiles = {}
    enum_start = ptext.index('{', ptext.index('enum AnimationProfile')) + 1
    enum_end = ptext.index(';', enum_start)
    for match in re.finditer(r'([A-Z_]+)\s*\(([^()]*)\)', ptext[enum_start:enum_end]):
        values = split_args(match[2])
        profiles[match[1]] = {'duration_ticks': number(values[0]),
                             'bite_seconds': [number(v) for v in values[1:]],
                             'source': _evidence(upstream, ppath, ptext, enum_start + match.start(), 'AnimationProfile', match[0])}
    minimum, minimum_match = _constant(ptext, 'MINIMUM_EAT_TICKS')
    grace, grace_match = _constant(ptext, 'RELEASE_CHECKPOINT_GRACE_TICKS')
    helpers = {}
    for helper in ('dish', 'skewer', 'multiBiteSkewer', 'rawSkewer', 'animatedRawSkewer'):
        pos, body, expr = _method(text, helper)
        helpers[helper] = {'body': body, 'source': _evidence(upstream, path, text, pos, helper, expr)}
    raw_duration = {}
    cooked_multiplier = {}
    for name in ('rawSkewer', 'animatedRawSkewer'):
        match = re.search(r'nausea\s*\?\s*(\d+)\s*:\s*0', helpers[name]['body'])
        if not match:
            raise ValueError(f'Missing raw nausea duration in {name}')
        raw_duration[name] = number(match[1])
    for name in ('skewer', 'multiBiteSkewer'):
        match = re.search(r'effectSeconds\s*\*\s*(\d+)', helpers[name]['body'])
        if not match:
            raise ValueError(f'Missing cooked duration conversion in {name}')
        cooked_multiplier[name] = number(match[1])

    foods = {}
    for name in ('dish', 'skewer', 'multiBiteSkewer', 'rawSkewer', 'animatedRawSkewer', 'ingredient', 'ITEMS.register'):
        for pos, args in calls(text, name):
            if not args or not re.fullmatch(r'"[a-z0-9_]+"', args[0]):
                continue  # Helper definitions and registrations using variable ids.
            item = json.loads(args[0])
            record = {'nutrition': None, 'saturation_modifier': None, 'always_eat': False,
                      'authored_effects': [], 'animation_profile': None,
                      'source': _evidence(upstream, path, text, pos, name, _call_expression(text, pos))}
            if name in helpers:
                record.update(nutrition=number(args[1]), saturation_modifier=number(args[2]))
                record['helper_source'] = helpers[name]['source']
                if name == 'dish':
                    record['item_class'] = 'FlavorFoodItem'
                else:
                    record['item_class'] = 'MultiBiteSkewerItem'
                    record['animation_profile'] = _profile_name(args[-1]) if name in ('multiBiteSkewer', 'animatedRawSkewer') else named_profile(item)
                    if name in raw_duration:
                        if args[3] not in ('true', 'false'):
                            raise ValueError('Non-literal nausea flag')
                        record['raw_nausea'] = args[3] == 'true'
                        effect = 'minecraft:nausea' if record['raw_nausea'] else None
                        duration = raw_duration[name] if effect else 0
                        record['effect_input_unit'] = 'ticks'
                    else:
                        effect = _effect(args[3])
                        duration = number(args[4]) * cooked_multiplier[name]
                        record['effect_input_unit'] = 'seconds'
                    if effect:
                        record['authored_effects'] = [{'id': effect, 'duration_ticks': duration}]
            else:
                if len(args) < 2 or 'FoodProperties.Builder' not in args[1]:
                    continue
                body = args[1]
                constructor = re.search(r'new\s+(\w+)\s*\(', body)
                if not constructor:
                    raise ValueError(f'Missing constructor for {item}')
                record['item_class'] = constructor[1]
                constructor_body, _ = balanced(body, body.index('(', constructor.start()))
                constructor_args = split_args(constructor_body)
                nutrition = list(calls(body, 'nutrition'))
                saturation = list(calls(body, 'saturationMod')) + list(calls(body, 'saturationModifier'))
                if len(nutrition) != 1 or len(saturation) != 1:
                    raise ValueError(f'Ambiguous food builder for {item}')
                record['nutrition'] = number(nutrition[0][1][0])
                record['saturation_modifier'] = number(saturation[0][1][0])
                record['always_eat'] = bool(list(calls(body, 'alwaysEat')) or list(calls(body, 'alwaysEdible')))
                cls = record['item_class']
                effect_pairs = []
                if cls == 'MultiBiteSkewerItem':
                    record['animation_profile'] = _profile_name(constructor_args[4])
                    effect_pairs = [(constructor_args[2], constructor_args[3])]
                elif cls in ('GoldenSkewerItem', 'CursedSkewerItem'):
                    cpath = f'{loader}/{JAVA}skewer/{cls}.java'
                    ctext = strip_comments((upstream / cpath).read_text())
                    superpos, superargs = next(calls(ctext, 'super'))
                    record['constructor_source'] = _evidence(upstream, cpath, ctext, superpos, cls, _call_expression(ctext, superpos))
                    record['animation_profile'] = _profile_name(superargs[4])
                    effect_pairs = [(superargs[2], superargs[3])]
                elif cls in ('EffectFoodItem', 'DualEffectFoodItem'):
                    effect_pairs = [(constructor_args[1], constructor_args[2])]
                    if cls == 'DualEffectFoodItem':
                        effect_pairs.append((constructor_args[3], constructor_args[4]))
                elif cls == 'WeddingCandyItem':
                    cpath = f'{loader}/{JAVA}food/{cls}.java'
                    ctext = strip_comments((upstream / cpath).read_text())
                    duration, match = _constant(ctext, 'EFFECT_DURATION')
                    record['constructor_source'] = _evidence(upstream, cpath, ctext, match.start(), 'EFFECT_DURATION', match[0])
                    effect_pairs = [(constructor_args[1], str(duration))]
                for expr, duration in effect_pairs:
                    effect = _effect(expr)
                    if effect:
                        record['authored_effects'].append({'id': effect, 'duration_ticks': number(duration)})
                record['effect_input_unit'] = 'ticks'
            key = 'kaleidoscope_grilling:' + item
            if key in foods:
                raise ValueError(f'Duplicate food registration: {key}')
            record['effective_effects'] = record['authored_effects']
            if record['animation_profile'] and key in overrides:
                override = overrides[key]
                record['data_override'] = override
                record['effective_effects'] = ([{'id': override['effect'], 'duration_ticks': override['effect_seconds'] * 20}]
                                                if override['effect'] else [])
            foods[key] = record

    skpath = f'{loader}/{JAVA}skewer/SkewerItem.java'
    sktext = strip_comments((upstream / skpath).read_text())
    effect_pos, _, effect_expr = _method(sktext, 'finishFoodAndEffect')
    dpath = f'{loader}/{JAVA}data/GrillingDataManager.java'
    dtext = strip_comments((upstream / dpath).read_text())
    dpos, _, dexpr = _method(dtext, 'readRoot')
    _, visual_body, _ = _method(ptext, 'visualBiteStage')
    visual_step = re.search(r'return completedBites \* ([^;]+);', visual_body)
    tick_divisor = re.search(r'getUseItemRemainingTicks\(\)\) / ([^;]+);', visual_body)
    if not visual_step or not tick_divisor:
        raise ValueError('Unsupported visual bite calculation')
    _, use_body, _ = _method(ptext, 'use')
    random_choices = re.search(r'nextBoolean\(\)\s*\? AnimationProfile\.([A-Z_]+) : AnimationProfile\.([A-Z_]+)', use_body)
    if not random_choices:
        raise ValueError('Unsupported random animation selection')
    profile_items = {item: {'profile': value['animation_profile'], 'source': value['source'],
                            **({'constructor_source': value['constructor_source']} if 'constructor_source' in value else {})}
                     for item, value in sorted(foods.items()) if value['animation_profile']}
    profile_output = {'profiles': profiles, 'profile_by_item': profile_items,
                      'minimum_eat_ticks': minimum, 'release_checkpoint_grace_ticks': grace,
                      'visual_stage_per_bite': number(visual_step[1]),
                      'ticks_per_second': number(tick_divisor[1]),
                      'random_profile_choices': list(random_choices.groups()),
                      'random_selection': 'nextBoolean, equal probability at use start',
                      'minimum_source': _evidence(upstream, ppath, ptext, minimum_match.start(), 'MINIMUM_EAT_TICKS', minimum_match[0]),
                      'grace_source': _evidence(upstream, ppath, ptext, grace_match.start(), 'RELEASE_CHECKPOINT_GRACE_TICKS', grace_match[0]),
                      'name_rules': rules, 'name_replacements': replacements, 'name_rule_default': defaults[-1],
                      'name_rules_source': _evidence(upstream, path, text, rulepos, 'animationProfile', ruleexpr)}
    for method in ('animationProfile', 'visualBiteStage', 'use', 'settleIfEligible'):
        pos, _, expr = _method(ptext, method, 'ItemStack' if method == 'animationProfile' else None)
        profile_output[method + '_source'] = _evidence(upstream, ppath, ptext, pos, method, expr)
    return {'items': dict(sorted(foods.items())),
            'data_defaults_source': _evidence(upstream, dpath, dtext, dpos, 'readRoot', dexpr),
            'effect_resolution_source': _evidence(upstream, skpath, sktext, effect_pos, 'finishFoodAndEffect', effect_expr)}, profile_output


def extract_foods(upstream: Path) -> dict:
    """Return generated filename -> provenance-rich JSON document."""
    path = 'common/src/main/resources/data/kaleidoscope_grilling/grilling/skewers.json'
    text = (upstream / path).read_text()
    data = json.loads(text)
    overrides = {}
    for index, raw in enumerate(data['skewers']):
        match = re.search(r'\{\s*"id"\s*:\s*' + re.escape(json.dumps(raw['id'])), text)
        if not match:
            raise ValueError(f'Missing source location for {raw["id"]}')
        pos = match.start()
        overrides[raw['id']] = {'effect': raw.get('effect', ''),
                                'effect_seconds': raw.get('effect_seconds', 0),
                                'eating_animation': raw.get('eating_animation', 'default'),
                                'source': _evidence(upstream, path, text, pos, f'/skewers/{index}', text[pos:text.index('}', pos) + 1])}
    foods, profiles = {}, {}
    for loader in LOADERS:
        foods[loader], profiles[loader] = _loader(upstream, loader, overrides)
    return {'foods.json': envelope('Parse both loaders ModItems literal registrations and helper bodies; retain authored fallbacks and bundled JSON effect overrides separately. Numeric float literals preserve authored decimals.',
                                    loaders=foods, bundled_skewer_overrides=overrides,
                                    units={'nutrition': 'food points', 'saturation_modifier': 'vanilla food saturation multiplier',
                                           'duration_ticks': 'game ticks', 'effect_seconds': 'seconds'},
                                    runtime_tables=['FOOD_DATA', 'COOKED_EFFECTS', 'RAW_NAUSEA']),
            'eating_profiles.json': envelope('Parse both loaders MultiBiteSkewerItem enum, timing constants, constructor profiles and ModItems name-derived rules.',
                                             loaders=profiles, runtime_tables=['PROFILE_BY_ITEM'])}
