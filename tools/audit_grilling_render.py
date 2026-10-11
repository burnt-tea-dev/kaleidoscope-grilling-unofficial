from __future__ import annotations
import re

import argparse
import json
import struct
import sys
import zlib
from collections import Counter
from copy import deepcopy
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "projects" / "grilling" / "gameplay_core"
BP = PROJECT / "behavior_pack"
RP = PROJECT / "resource_pack"
JAVA_DISPLAY = ROOT / "projects" / "grilling" / "reports" / "java_display_transforms"
DEPENDENCY_TEXTURES={row['texture'] for row in json.loads((ROOT/'development/gameplay_core/fixtures/secret-visual-catalog.json').read_text())['items'] if not row['source'].startswith('canonical')}

SEVERITY_ORDER = {"error": 0, "high": 1, "medium": 2, "info": 3}
VANILLA_TEXTURE_PATHS = {
    "textures/blocks/water_still_grey",
    "textures/blocks/lava_still",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


@lru_cache(maxsize=1)
def held_plate_assets():
    # A named new subsystem with an exact generator contract, not a blanket
    # exception for other animation files or arbitrary attachables.
    sys.path.insert(0, str(ROOT / 'tools'))
    from build_plate_held import build
    return build()


def geometry_ref(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get("identifier")
    return None


def png_alpha(path: Path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    pos = 8
    ihdr = None
    idat = bytearray()
    trns = None
    palette = None
    while pos + 12 <= len(data):
        length = struct.unpack(">I", data[pos:pos+4])[0]
        kind = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+length]
        pos += 12 + length
        if kind == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", chunk)
        elif kind == b"IDAT":
            idat.extend(chunk)
        elif kind == b"tRNS":
            trns = bytes(chunk)
        elif kind == b"PLTE":
            palette = bytes(chunk)
        elif kind == b"IEND":
            break
    if not ihdr:
        return None
    width, height, bit_depth, color_type, compression, filtering, interlace = ihdr
    if bit_depth != 8 or interlace != 0 or compression != 0 or filtering != 0:
        return {"supported": False, "width": width, "height": height}
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(color_type)
    if not channels:
        return {"supported": False, "width": width, "height": height}
    raw = zlib.decompress(bytes(idat))
    stride = width * channels
    rows = []
    prev = bytearray(stride)
    p = 0
    for _ in range(height):
        f = raw[p]
        p += 1
        scan = bytearray(raw[p:p+stride])
        p += stride
        out = bytearray(stride)
        for i, x in enumerate(scan):
            a = out[i-channels] if i >= channels else 0
            b = prev[i]
            c = prev[i-channels] if i >= channels else 0
            if f == 0:
                val = x
            elif f == 1:
                val = (x + a) & 255
            elif f == 2:
                val = (x + b) & 255
            elif f == 3:
                val = (x + ((a + b) >> 1)) & 255
            elif f == 4:
                pr = a + b - c
                pa, pb, pc = abs(pr-a), abs(pr-b), abs(pr-c)
                pred = a if pa <= pb and pa <= pc else b if pb <= pc else c
                val = (x + pred) & 255
            else:
                return {"supported": False, "width": width, "height": height}
            out[i] = val
        rows.append(out)
        prev = out
    alphas = []
    if color_type == 6:
        for row in rows:
            alphas.extend(row[3::4])
    elif color_type == 4:
        for row in rows:
            alphas.extend(row[1::2])
    elif color_type == 3 and trns is not None:
        for row in rows:
            for idx in row:
                alphas.append(trns[idx] if idx < len(trns) else 255)
    else:
        alphas = [255] * (width * height)
    return {
        "supported": True,
        "width": width,
        "height": height,
        "min_alpha": min(alphas) if alphas else 255,
        "max_alpha": max(alphas) if alphas else 255,
        "transparent_pixels": sum(a == 0 for a in alphas),
        "partial_alpha_pixels": sum(0 < a < 255 for a in alphas),
        "opaque_pixels": sum(a == 255 for a in alphas),
    }


def add(findings, severity, code, subject, detail, evidence=None):
    row = {"severity": severity, "code": code, "subject": subject, "detail": detail}
    if evidence is not None:
        row["evidence"] = evidence
    findings.append(row)


def collect_geometries(findings):
    index = {}
    duplicates = {}
    for path in sorted(RP.rglob("*.geo.json")):
        doc = load_json(path)
        for geo in doc.get("minecraft:geometry", []):
            ident = geo.get("description", {}).get("identifier")
            if not ident:
                add(findings, "error", "geometry_missing_identifier", str(path.relative_to(ROOT)), "geometry has no identifier")
                continue
            if ident in index:
                duplicates.setdefault(ident, [index[ident]["path"]]).append(path)
            else:
                index[ident] = {"path": path, "geo": geo}
    for ident, paths in duplicates.items():
        add(findings, "error", "duplicate_geometry_identifier", ident, "geometry identifier is defined more than once",
            [str(p.relative_to(ROOT)) for p in paths])
    return index


def collect_animations():
    out = {}
    for path in sorted((RP / "animations").rglob("*.json")) if (RP / "animations").exists() else []:
        doc = load_json(path)
        for ident, body in doc.get("animations", {}).items():
            out[ident] = {"path": path, "body": body}
    return out


def collect_render_controllers():
    out = {}
    root = RP / "render_controllers"
    for path in sorted(root.rglob("*.json")) if root.exists() else []:
        doc = load_json(path)
        for ident, body in doc.get("render_controllers", {}).items():
            out[ident] = {"path": path, "body": body}
    return out


def collect_ids():
    ids = set()
    for folder, key in ((BP / "items", "minecraft:item"), (BP / "blocks", "minecraft:block")):
        if not folder.exists():
            continue
        for path in folder.rglob("*.json"):
            body = load_json(path).get(key, {})
            ident = body.get("description", {}).get("identifier")
            if ident:
                ids.add(ident)
    return ids


def terrain_textures():
    path = RP / "textures" / "terrain_texture.json"
    if not path.exists():
        return {}
    data = load_json(path).get("texture_data", {})
    out = {}
    for key, value in data.items():
        tex = value.get("textures") if isinstance(value, dict) else None
        if isinstance(tex, str):
            out[key] = tex
    return out


def check_geometry_structure(findings, geometry_index):
    stats = Counter()
    for ident, row in geometry_index.items():
        geo = row["geo"]
        path = row["path"]
        bones = geo.get("bones", [])
        names = [b.get("name") for b in bones if b.get("name")]
        name_set = set(names)
        for bone in bones:
            parent = bone.get("parent")
            if parent and parent not in name_set:
                add(findings, "error", "missing_bone_parent", ident,
                    f"bone {bone.get('name')} references missing parent {parent}", str(path.relative_to(ROOT)))
            if bone.get("binding"):
                stats["bound_bones"] += 1
            for cube in bone.get("cubes", []):
                size = cube.get("size")
                if not isinstance(size, list) or len(size) != 3:
                    continue
                neg = [v for v in size if isinstance(v, (int, float)) and v < 0]
                zeros = sum(isinstance(v, (int, float)) and abs(v) < 1e-9 for v in size)
                if neg:
                    add(findings, "error", "negative_cube_size", ident,
                        f"bone {bone.get('name')} contains negative cube size {size}", str(path.relative_to(ROOT)))
                elif zeros >= 2:
                    add(findings, "high", "degenerate_line_or_point", ident,
                        f"bone {bone.get('name')} contains a cube with {zeros} zero axes: {size}", str(path.relative_to(ROOT)))
                elif zeros == 1:
                    stats["single_plane_cubes"] += 1
    return dict(stats)


def check_blocks(findings, geometry_index):
    atlas = terrain_textures()
    texture_alpha_cache = {}
    stats = Counter()
    for path in sorted((BP / "blocks").rglob("*.json")):
        block = load_json(path).get("minecraft:block", {})
        ident = block.get("description", {}).get("identifier", str(path.relative_to(ROOT)))
        components = [block.get("components", {})] + [
            p.get("components", {}) for p in block.get("permutations", []) if isinstance(p, dict)
        ]
        refs = set()
        material_slots = set()
        material_rows = []
        for comp in components:
            ref = geometry_ref(comp.get("minecraft:geometry"))
            if ref:
                refs.add(ref)
            mats = comp.get("minecraft:material_instances")
            if isinstance(mats, dict):
                material_slots.update(mats.keys())
                material_rows.append(mats)
        for ref in refs:
            if ref not in geometry_index:
                add(findings, "error", "missing_block_geometry", ident, f"references missing geometry {ref}",
                    str(path.relative_to(ROOT)))
                continue
            geo = geometry_index[ref]["geo"]
            if any(b.get("binding") for b in geo.get("bones", [])):
                add(findings, "error", "world_geometry_has_binding", ident,
                    f"placed block geometry {ref} contains attachable bone binding",
                    str(geometry_index[ref]["path"].relative_to(ROOT)))
            used_slots = set()
            for bone in geo.get("bones", []):
                for cube in bone.get("cubes", []):
                    uv = cube.get("uv", {})
                    if isinstance(uv, dict):
                        for face in uv.values():
                            if isinstance(face, dict) and face.get("material_instance"):
                                used_slots.add(face["material_instance"])
            missing = sorted(x for x in used_slots if x not in material_slots)
            if missing:
                add(findings, "error", "missing_material_instance_slot", ident,
                    f"geometry {ref} uses material slots not defined by block: {missing}",
                    str(geometry_index[ref]["path"].relative_to(ROOT)))
        seen_material = set()
        for mats in material_rows:
            for slot, mat in mats.items():
                if not isinstance(mat, dict):
                    continue
                key = (slot, mat.get("texture"), mat.get("render_method"))
                if key in seen_material:
                    continue
                seen_material.add(key)
                texture_key = mat.get("texture")
                method = mat.get("render_method")
                if not texture_key or texture_key not in atlas:
                    if texture_key and texture_key not in {"still_water_grey", "still_lava"}:
                        add(findings, "error", "missing_terrain_texture_key", ident,
                            f"material {slot} references missing terrain texture key {texture_key}",
                            str(path.relative_to(ROOT)))
                    continue
                tex_rel = atlas[texture_key]
                tex_path = RP / (tex_rel + ".png")
                if not tex_path.is_file():
                    if tex_rel in VANILLA_TEXTURE_PATHS:
                        add(findings, "info", "vanilla_texture_reference", ident,
                            f"terrain key {texture_key} intentionally resolves through the vanilla base resource pack: {tex_rel}",
                            str(path.relative_to(ROOT)))
                    else:
                        add(findings, "error", "missing_block_texture_file", ident,
                            f"terrain key {texture_key} points to missing {tex_rel}.png", str(path.relative_to(ROOT)))
                    continue
                if tex_path not in texture_alpha_cache:
                    try:
                        texture_alpha_cache[tex_path] = png_alpha(tex_path)
                    except Exception:
                        texture_alpha_cache[tex_path] = None
                alpha = texture_alpha_cache[tex_path]
                if alpha and alpha.get("supported") and alpha.get("min_alpha") == 255 and method in {"alpha_test", "blend"}:
                    add(findings, "medium", "unnecessary_transparent_render_method", ident,
                        f"{slot} uses {method} but texture {tex_rel}.png is fully opaque",
                        {"texture": tex_rel, "method": method})
                if method == "blend":
                    stats["blend_materials"] += 1
                elif method == "alpha_test":
                    stats["alpha_test_materials"] += 1
                elif method == "opaque":
                    stats["opaque_materials"] += 1
        stats["blocks"] += 1
    return dict(stats)


def check_item_visuals(findings, geometry_index):
    """Item visuals use a distinct geometry/material chain from placed blocks."""
    atlas = terrain_textures()
    checked = 0
    for path in sorted((BP / "blocks").rglob("*.json")):
        block = load_json(path).get("minecraft:block", {})
        ident = block.get("description", {}).get("identifier", path.name)
        components = [block.get("components", {})] + [p.get("components", {}) for p in block.get("permutations", [])]
        for comp in components:
            if "minecraft:item_visual" not in comp:
                continue
            checked += 1
            visual = comp["minecraft:item_visual"]
            ref = geometry_ref(visual.get("geometry")) if isinstance(visual, dict) else None
            row = geometry_index.get(ref)
            if not row:
                add(findings, "error", "missing_item_visual_geometry", ident, f"missing item geometry {ref}")
                continue
            mats = visual.get("material_instances", {})
            if not isinstance(mats, dict) or not mats:
                add(findings, "error", "missing_item_visual_material", ident, "item visual has no material instances")
                continue
            for bone in row["geo"].get("bones", []):
                if bone.get("binding"):
                    add(findings, "error", "item_visual_has_binding", ident, "native block-item geometry must not use an attachable binding")
                for cube in bone.get("cubes", []):
                    uv = cube.get("uv", {})
                    if isinstance(uv, dict):
                        for face in uv.values():
                            slot = face.get("material_instance", "*") if isinstance(face, dict) else "*"
                            if slot not in mats and "*" not in mats:
                                add(findings, "error", "missing_item_visual_material", ident, f"missing item material slot {slot}")
            for name, mat in mats.items():
                texture = atlas.get(mat.get("texture")) if isinstance(mat, dict) else None
                if not texture or not (RP / (texture + ".png")).is_file():
                    add(findings, "error", "missing_item_visual_texture", ident, f"unresolved texture in item material {name}")
            transforms = row["geo"].get("item_display_transforms")
            if transforms is not None:
                version = tuple(int(x) for x in load_json(row["path"])["format_version"].split("."))
                if version < (1, 21, 0):
                    add(findings, "error", "item_display_format", ident, "item_display_transforms requires geometry format 1.21.0 or newer")
    return {"item_visuals": checked}


def animation_aliases(attachable):
    return attachable.get("animations", {}) if isinstance(attachable.get("animations"), dict) else {}


def check_attachables(findings, geometry_index, animations, controllers, known_ids):
    stats = Counter()
    attachable_ids = set()
    root = RP / "attachables"
    for path in sorted(root.rglob("*.json")) if root.exists() else []:
        desc = load_json(path).get("minecraft:attachable", {}).get("description", {})
        ident = desc.get("identifier")
        if not ident:
            add(findings, "error", "attachable_missing_identifier", str(path.relative_to(ROOT)), "attachable has no identifier")
            continue
        attachable_ids.add(ident)
        stats["attachables"] += 1
        if ident not in known_ids:
            add(findings, "medium", "attachable_identifier_not_in_bp", ident,
                "attachable identifier is not declared as a canonical BP item/block", str(path.relative_to(ROOT)))
        geo_refs = []
        for ref in (desc.get("geometry") or {}).values():
            if isinstance(ref, str):
                geo_refs.append(ref)
        bound_names = set()
        for ref in geo_refs:
            row = geometry_index.get(ref)
            if not row:
                add(findings, "error", "missing_attachable_geometry", ident, f"references missing geometry {ref}",
                    str(path.relative_to(ROOT)))
                continue
            for bone in row["geo"].get("bones", []):
                if bone.get("binding"):
                    bound_names.add(bone.get("name"))
        if geo_refs and not bound_names:
            add(findings, "high", "attachable_has_no_bound_bone", ident,
                "held geometry has no q.item_slot_to_bone_name binding; hand anchoring depends on fallback behavior",
                {"geometries": geo_refs})
        aliases = animation_aliases(desc)
        for alias, anim_id in aliases.items():
            if anim_id not in animations:
                add(findings, "error", "missing_attachable_animation", ident,
                    f"animation alias {alias} references missing {anim_id}", str(path.relative_to(ROOT)))
                continue
            targeted = set(animations[anim_id]["body"].get("bones", {}).keys())
            risky = sorted(targeted & bound_names)
            if risky:
                add(findings, "info" if anim_id.startswith("animation.kg_a286.bottle_") and risky == ["grip"] else "high", "animation_moves_bound_bone", ident,
                    f"animation {anim_id} directly transforms bound bone(s) {risky}",
                    str(animations[anim_id]["path"].relative_to(ROOT)))
        for rc in desc.get("render_controllers", []):
            rc_id = rc if isinstance(rc, str) else None
            if rc_id and rc_id not in controllers:
                add(findings, "error", "missing_render_controller", ident,
                    f"references missing render controller {rc_id}", str(path.relative_to(ROOT)))
        for tex_name, tex in (desc.get("textures") or {}).items():
            if not isinstance(tex, str) or not tex.startswith("textures/"):
                continue
            tex_path = RP / (tex + ".png")
            if not tex_path.is_file() and tex not in DEPENDENCY_TEXTURES:
                add(findings, "error", "missing_attachable_texture", ident,
                    f"texture alias {tex_name} points to missing {tex}.png", str(path.relative_to(ROOT)))

    # Java advanced_rack is item/generated. The placed block's display fields
    # must never be used to justify a custom held override.
    if "kaleidoscope_grilling:advanced_rack" in attachable_ids:
        add(findings, "error", "rack_wrong_world_model_override", "kaleidoscope_grilling:advanced_rack",
            "Java rack item is generated sprite; remove the placed-block held override")

    for ident in sorted(attachable_ids):
        short = ident.split(":", 1)[-1]
        report_name = None
        if short == "ordinary_skewer":
            report_name = "ordinary_full"
        elif short.startswith("raw_") and short.endswith("_skewer"):
            report_name = short[len("raw_"):-len("_skewer")] + "_raw"
        elif short.startswith("grilled_") and short.endswith("_skewer"):
            report_name = short[len("grilled_"):-len("_skewer")] + "_cooked"
        if report_name:
            report_path = JAVA_DISPLAY / (report_name + ".json")
            if report_path.is_file() and load_json(report_path).get("java_display"):
                path = root / (short + ".attachable.json")
                desc = load_json(path)["minecraft:attachable"]["description"]
                anim_values = set((desc.get("animations") or {}).values())
                if any("a2725.skewer_hold_" in x for x in anim_values if isinstance(x, str)):
                    add(findings, "high", "skewer_uses_generic_bound_root_offset", ident,
                        "Java has item-specific hand rotation/translation/scale, but canonical attachable still uses the generic A2.7.25 bound-root hold offset",
                        str(report_path.relative_to(ROOT)))

    seasoning = {"kaleidoscope_grilling:empty_seasoning_bottle",
                 "kaleidoscope_grilling:pending_seasoning",
                 "kaleidoscope_grilling:special_seasoning"}
    seasoning_report = JAVA_DISPLAY / "seasoning_bottles_1.json"
    if seasoning_report.is_file() and load_json(seasoning_report).get("java_display"):
        for ident in sorted(seasoning & attachable_ids):
            path = root / (ident.split(":", 1)[-1] + ".attachable.json")
            desc = load_json(path)["minecraft:attachable"]["description"]
            if not desc.get("animations"):
                add(findings, "high", "seasoning_java_display_not_applied", ident,
                    "held shell is anchored safely, but Java first/third-person rotation/translation/scale is still not applied",
                    str(seasoning_report.relative_to(ROOT)))

    return dict(stats)


def check_current_display_contracts(findings, geometry_index, animations):
    """Check the current bound rig and converted frames, never historic IDs."""
    sys.path.insert(0, str(ROOT / "development/gameplay_core"))
    from held_pose_frames import expected_animations
    sys.path.insert(0,str(ROOT/'tools'))
    from build_java_dual_eating_projection import REPRESENTATIVES,PIECE_BINDING
    import build_caterpillar_eating_projection as caterpillar
    from build_java_eating_projection import held_profile_condition, projection_items, SECRET_PROFILES, secret_item_animation_id
    version=tuple(load_json(BP/"manifest.json")["header"]["version"])
    from secret_idle_calibration import OWNED as CALIBRATED_ITEMS,animation_document,clip_id,owning_hand_using
    expected = expected_animations()
    if version>=(2,8,68):expected.update(animation_document()["animations"])
    for ident, body in expected.items():
        if animations.get(ident, {}).get("body") != body:
            add(findings, "error", "held_pose_frame_drift", ident,
                "runtime differs from reviewed Java-to-Bedrock frame conversion")
    counts = Counter()
    bottle_ids = set()
    skewer_refs = set()
    aliases = {"fp_right", "fp_left", "tp_right", "tp_left"}
    admitted = projection_items()
    for path in sorted((RP / "attachables").glob("*.json")):
        desc = load_json(path)["minecraft:attachable"]["description"]
        if desc['identifier']=='kaleidoscope_grilling:skewer_plate' and version>=(2,8,119):
            counts['plate']+=1
            for target,content in held_plate_assets().items():
                expected_plate=json.loads(content)
                matches=load_json(target)==expected_plate
                if target==path:
                    matches=matches and desc==expected_plate['minecraft:attachable']['description']
                elif target.name=='plate_held.geo.json':
                    matches=matches and all(geometry_index.get(g['description']['identifier'],{}).get('geo')==g
                                            for g in expected_plate['minecraft:geometry'])
                elif target.name=='plate_held.animation.json':
                    matches=matches and all(animations.get(name,{}).get('body')==body
                                            for name,body in expected_plate['animations'].items())
                if not matches:
                    add(findings,'error','held_plate_source_contract',str(target.relative_to(ROOT)),
                        'held plate differs from its current mesh/palette/owner and Java frame generator')
            continue
        scoped_caterpillar=version>=(2,8,126) and desc['identifier']==caterpillar.ITEM
        ids = desc.get("animations", {})
        canonical_id = desc["identifier"].removesuffix("_java_three_alt")
        family = "skewer" if canonical_id.endswith("_skewer") else "rack" if desc["identifier"] == "kaleidoscope_grilling:advanced_rack" else "bottle"
        partial=version>=(2,8,68) and desc["identifier"]=="kaleidoscope_grilling:unfinished_skewer"
        calibrated=version>=(2,8,68) and desc["identifier"] in CALIBRATED_ITEMS
        if canonical_id == desc["identifier"]: counts["partial" if partial else family] += 1
        if family == "bottle": bottle_ids.add(desc["identifier"])
        expected_ids = {alias: f"animation.{'kg_a287' if family == 'skewer' else 'kg_a286'}.{family}_{alias}" for alias in aliases}
        if family == "skewer" and not partial:
            table = json.loads(re.search(r'PROFILE_BY_ITEM=Object.freeze\((\{.*?\})\)', (BP / 'scripts/data.js').read_text()).group(1))
            requested=table.get(canonical_id,'THREE_RANDOM' if canonical_id=='kaleidoscope_grilling:secret_skewer' else 'THREE')
            profile = requested.replace('THREE_RANDOM', 'THREE').lower()
            expected_ids.update({f'eat_{hand}': f'animation.kg_eating.item.{profile}.{hand}' for hand in ['right','left']})
            if requested=='THREE_RANDOM':expected_ids.update({f'eat_alt_{hand}':f'animation.kg_eating.item.three_alt.{hand}' for hand in ['right','left']})
        projected = None
        if family == 'skewer' and not partial and version >= (2,8,58):
            candidate = ('THREE_ALT' if desc['identifier'].endswith('_java_three_alt') else 'THREE') if requested == 'THREE_RANDOM' else requested
            if candidate in ('TWO','THREE_ALT','FOUR') and desc['identifier'] in admitted[candidate]:
                projected = candidate
                expected_ids.update({f'fp_eat_{hand}':f'animation.kg_java_eating.item.{candidate.lower()}.{hand}' for hand in ('right','left')})
            if desc['identifier'] in REPRESENTATIVES:
                projected=REPRESENTATIVES[desc['identifier']]
                expected_ids.update({f'fp_eat_{hand}':f'animation.kg_java_eating.item.{projected.lower()}.{hand}' for hand in ('right','left')})
            if desc['identifier'] in SECRET_PROFILES and desc['identifier'] in admitted[SECRET_PROFILES[desc['identifier']]]:
                projected=SECRET_PROFILES[desc['identifier']]
                expected_ids.update({f'fp_eat_{hand}':secret_item_animation_id(projected,hand) for hand in ('right','left')})
        if scoped_caterpillar:
            expected_ids['probe_one_right']=caterpillar.ANIMATION
            expected_geometry=caterpillar.piece_assets()[0]['minecraft:geometry'][0]
            if geometry_index.get('geometry.kg_probe_caterpillar.piece',{}).get('geo')!=expected_geometry:
                add(findings,'error','held_caterpillar_piece_contract',desc['identifier'],'helper differs from the exact single offhand-bound source cube')
        seasoning_expected = None
        if family == 'bottle' and 'season_right' in ids:
            from build_seasoning_held import dispatch
            seasoning_expected = deepcopy(desc)
            dispatch(seasoning_expected)
            expected_ids = seasoning_expected['animations']
        if calibrated:expected_ids.update({"fp_idle_calibrated_"+hand:clip_id(hand) for hand in ("right","left")})
        if ids != expected_ids:
            add(findings, "error", "held_pose_selectors", desc["identifier"], "missing or unexpected hand/view animation aliases")
        selectors = desc.get("scripts", {}).get("animate", [])
        required_selectors = {
            alias: f"c.is_first_person == {1 if alias.startswith('fp') else 0} && c.item_slot == '{'main_hand' if alias.endswith('right') else 'off_hand'}'"
            for alias in aliases
        }
        if family == "skewer" and not partial:
            required_selectors.update({f'eat_{hand}': "c.is_first_person == 1 && q.is_using_item && q.property('kaleidoscope_grilling:eat_hand') == " + str(1 if hand == 'right' else 2) + " && c.item_slot == '" + ('main_hand' if hand == 'right' else 'off_hand') + "'" for hand in ['right','left']})
            if requested=='THREE_RANDOM':
                for hand in ['right','left']:
                    using="c.is_first_person == 1 && q.is_using_item && q.property('kaleidoscope_grilling:eat_hand') == "+str(1 if hand=='right' else 2)+" && c.item_slot == '"+('main_hand' if hand=='right' else 'off_hand')+"'"
                    required_selectors['eat_'+hand]=using+" && q.property('kaleidoscope_grilling:eat_profile') != 4"
                    required_selectors['eat_alt_'+hand]=using+" && q.property('kaleidoscope_grilling:eat_profile') == 4"
        if projected:
            context = ("q.is_using_item && q.property('kaleidoscope_grilling:eat_projection') == 1 && "
                       "q.is_sneaking == 0 && q.is_swimming == 0 && q.is_gliding == 0 && q.is_riding == 0")
            profile_code = {'ONE':1,'TWO':2,'THREE':3,'THREE_ALT':4,'FOUR':5}[projected]
            for hand,slot,hand_code in [('right','main_hand',1),('left','off_hand',2)]:
                active = ("c.is_first_person == 1 && "+context+" && q.property('kaleidoscope_grilling:eat_profile') == "+str(profile_code)+
                          " && q.property('kaleidoscope_grilling:eat_hand') == "+str(hand_code)+" && c.item_slot == '"+slot+"'")
                active+=' && '+held_profile_condition(projected,hand,{projected:[desc['identifier']]})
                required_selectors['fp_'+hand] = "c.is_first_person == 1 && c.item_slot == '"+slot+"' && ("+active+") == 0"
                for key in ('eat_'+hand,'eat_alt_'+hand):
                    if key in required_selectors:required_selectors[key]='('+required_selectors[key]+') && ('+active+') == 0'
                required_selectors['fp_eat_'+hand] = active
        if scoped_caterpillar:
            for alias in ('fp_right','eat_right'):
                required_selectors[alias]='('+required_selectors[alias]+') && ('+caterpillar.ACTIVE+') == 0'
            required_selectors['probe_one_right']=caterpillar.ACTIVE
        if seasoning_expected is not None:
            required_selectors = {k:v for row in seasoning_expected['scripts']['animate'] for k,v in row.items()}
        if calibrated:
            for hand,slot in (("right","main_hand"),("left","off_hand")):
                using=owning_hand_using(hand)
                required_selectors["fp_"+hand]+=" && ("+using+")"
                required_selectors["fp_idle_calibrated_"+hand]="c.is_first_person == 1 && c.item_slot == '"+slot+"' && ("+using+") == 0"
        if partial:
            from secret_skewer_assets import partial_geometries
            expected_geometry={"stick":"geometry.kg_secret_held.stick",**{f"part_{i}_0":f"geometry.kg_secret_held.part_{i}_0" for i in range(3)},**{g["description"]["identifier"].rsplit(".",1)[1]:g["description"]["identifier"] for g in partial_geometries()}}
            item=load_json(BP/"items/unfinished_skewer.json")["minecraft:item"]
            if desc.get("geometry")!=expected_geometry or "minecraft:food" in item.get("components",{}):
                add(findings,"error","held_partial_contract",desc["identifier"],"nonedible partial must retain exact partial-state references")
        actual_selectors = {}
        malformed = False
        for row in selectors:
            if not isinstance(row, dict) or len(row) != 1:
                malformed = True
                continue
            alias, expression = next(iter(row.items()))
            if alias in actual_selectors:
                malformed = True
            actual_selectors[alias] = expression
        if malformed or actual_selectors != required_selectors:
            add(findings, "error", "held_pose_selectors", desc["identifier"],
                "expected exactly one canonical selector for each first/third-person hand")
        available_bones={b.get('name') for ref in desc.get('geometry',{}).values() for b in geometry_index.get(ref,{}).get('geo',{}).get('bones',[])}
        for alias,ref in desc.get("geometry", {}).items():
            geo = geometry_index.get(ref, {}).get("geo", {})
            bound = [b for b in geo.get("bones", []) if b.get("binding")]
            scoped_piece=scoped_caterpillar and alias=='probe_piece' and ref=='geometry.kg_probe_caterpillar.piece'
            piece=scoped_piece or (alias=='java_piece' and desc['identifier'] in REPRESENTATIVES) or (alias=='java_secret_piece' and desc['identifier'] in SECRET_PROFILES)
            if version>=(2,8,68) and re.fullmatch(r'piece_[1-9][0-9]*',alias):
                piece=desc['identifier'] in SECRET_PROFILES and ref=='geometry.kg_secret_held.'+alias
                if not piece:add(findings,'error','held_binding_contract',ref,'helper variant requires exact complete secret owner and namespace')
            expected_binding="q.item_slot_to_bone_name('off_hand')" if scoped_piece else PIECE_BINDING if piece else "q.item_slot_to_bone_name(context.item_slot)"
            if len(bound) != 1 or bound[0].get("name") != "grip" or bound[0].get("pivot") != [0,24,0] or bound[0].get("binding") != expected_binding:
                add(findings, "error", "held_binding_contract", ref, "expected one item-slot grip at the canonical pivot")
            bones = {bone.get("name"): bone for bone in geo.get("bones", [])}
            if piece:
                if bones.get('dual_piece',{}).get('parent')!='grip' or bones.get('dual_piece',{}).get('pivot')!=[0,24,0] or set(bones)!={'grip','dual_piece'}:
                    add(findings,'error','held_hierarchy_contract',ref,'piece must inherit the mapped helper grip')
            elif family in {"rack", "skewer"}:
                for name, parent in ((family + "_pose", "grip"), (family + "_model", family + "_pose")):
                    bone = bones.get(name, {})
                    if bone.get("parent") != parent or bone.get("pivot") != [0, 24, 0]:
                        add(findings, "error", "held_hierarchy_contract", ref,
                            f"{name} must inherit {parent} at the hand pivot")
            for anim_id in ids.values():
                targets = set(animations.get(anim_id, {}).get("body", {}).get("bones", {}))
                # One attachable may render multiple geometries. The animation
                # component addresses their union, validated above individually.
                complementary={'skewer_pose','skewer_model'} if piece else {'dual_piece'} if desc['identifier'] in REPRESENTATIVES or desc['identifier'] in SECRET_PROFILES or scoped_caterpillar else set()
                missing = (targets - set(bones) - complementary) | (targets-available_bones)
                if missing:
                    add(findings, "error", "held_animation_missing_bone", ref,
                        f"{anim_id} targets absent bones: {sorted(missing)}")
            if family == "skewer" and canonical_id!='kaleidoscope_grilling:secret_skewer' and not piece and not partial: skewer_refs.add(ref)
    expected_bottles={'kaleidoscope_grilling:'+name for name in ('empty_seasoning_bottle','pending_seasoning','special_seasoning')}
    expected_bottles|={f'kaleidoscope_grilling:special_seasoning_r{remaining}_v{variant}' for remaining in range(1,9) for variant in range(8)}
    if version>=(2,8,71):
        expected_bottles|={f'kaleidoscope_grilling:{kind}_seasoning_f{fill}' for kind in ('partial','pending') for fill in range(1,9)}
    expected_counts={"skewer":40,"bottle":len(expected_bottles)}
    if version>=(2,8,68):expected_counts["partial"]=1
    if version>=(2,8,119):expected_counts['plate']=1
    if counts != expected_counts or bottle_ids != expected_bottles or len(skewer_refs) != 150:
        add(findings, "error", "held_inventory_contract", "attachables", "unexpected held family/bite-stage coverage", dict(counts))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", dest="json_path")
    parser.add_argument("--fail-on-error", action="store_true")
    args = parser.parse_args()

    findings = []
    geometries = collect_geometries(findings)
    animations = collect_animations()
    controllers = collect_render_controllers()
    known_ids = collect_ids()
    geometry_stats = check_geometry_structure(findings, geometries)
    block_stats = check_blocks(findings, geometries)
    item_visual_stats = check_item_visuals(findings, geometries)
    attachable_stats = check_attachables(findings, geometries, animations, controllers, known_ids)
    check_current_display_contracts(findings, geometries, animations)

    findings.sort(key=lambda x: (SEVERITY_ORDER.get(x["severity"], 99), x["code"], x["subject"]))
    counts = Counter(x["severity"] for x in findings)
    by_code = Counter(x["code"] for x in findings)
    subjects_by_code = {}
    for item in findings:
        subjects_by_code.setdefault(item["code"], set()).add(item["subject"])
    report = {
        "scope": "canonical Gameplay Core render audit",
        "project": str(PROJECT.relative_to(ROOT)).replace("\\", "/"),
        "summary": {
            "errors": counts["error"],
            "high": counts["high"],
            "medium": counts["medium"],
            "info": counts["info"],
            "by_code": dict(sorted(by_code.items())),
            "unique_subjects_by_code": {k: len(v) for k, v in sorted(subjects_by_code.items())},
            "geometries": len(geometries),
            "animations": len(animations),
            "render_controllers": len(controllers),
            **geometry_stats,
            **block_stats,
            **item_visual_stats,
            **attachable_stats,
        },
        "findings": findings,
        "validation_boundary": (
            "Static render-chain audit only. It can prove references, geometry/material contracts and known "
            "Java-transform drift, but it cannot certify final Minecraft client pixels, GPU alpha behavior, "
            "FOV, skin interaction, animation timing or Android rendering."
        ),
    }
    text = json.dumps(report, ensure_ascii=False, indent=2)
    print(text)
    if args.json_path:
        out = Path(args.json_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text + "\n", encoding="utf-8")
    if args.fail_on_error and counts["error"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
