#!/usr/bin/env python3
"""Build review-only Bedrock geometry and editable models from pinned Java sources.

No network access, game runtime, fallback artwork, or source mutation. Unknown parents,
textures, UV rotations and unsupported inverted cuboids stop that candidate instead of being repaired
silently. Coordinate/UV conventions are documented in docs/CONVERSION.zh-TW.md.
"""
from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import json
import math
import re
import shutil
import sys
import uuid
from pathlib import Path
from typing import Any

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "source_snapshots/common/src/main/resources/assets"
NS = "kaleidoscope_grilling"
FACES = ("north", "east", "south", "west", "up", "down")
UUID_NS = uuid.UUID("9633f1b6-13a6-4b96-b80b-66e3cfa0cd0a")
BOTTLE_OFFSETS = [
    [[0, 0]], [[4, 3], [-3, -1]],
    [[4, 4], [-3, 3], [3, -3.75]],
    [[4, 5], [-3, 4], [3.5, -3.25], [-4.25, -3.25]],
]

class AssetError(ValueError):
    """The input cannot be converted faithfully by this restricted exporter."""


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def checked_id(identifier: str) -> tuple[str, str]:
    if not isinstance(identifier, str) or not re.fullmatch(r"[a-z0-9_.-]+:[a-z0-9_./-]+", identifier):
        raise AssetError(f"Invalid resource id: {identifier!r}")
    ns, path = identifier.split(":", 1)
    if any(x in ("", ".", "..") for x in path.split("/")):
        raise AssetError(f"Unsafe resource path: {identifier}")
    return ns, path


def resource_path(identifier: str, kind: str, root: Path = ASSETS) -> Path:
    ns, path = checked_id(identifier)
    extension = ".png" if kind == "textures" else ".json"
    return root / ns / kind / (path + extension)


def resolve_model(identifier: str, root: Path = ASSETS, chain: tuple[str, ...] = ()) -> dict:
    if isinstance(identifier, str) and ":" not in identifier:
        identifier = "minecraft:" + identifier
    if identifier in chain or len(chain) >= 48:
        raise AssetError("Parent cycle/depth: " + " -> ".join((*chain, identifier)))
    path = resource_path(identifier, "models", root)
    if not path.is_file():
        raise AssetError(f"Missing parent/model: {identifier}")
    own = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(own, dict):
        raise AssetError(f"Model is not an object: {identifier}")
    merged: dict = {}
    if own.get("parent"):
        merged = resolve_model(own["parent"], root, (*chain, identifier))
    for key, value in own.items():
        if key == "parent":
            continue
        if key in ("textures", "display"):
            merged[key] = {**merged.get(key, {}), **copy.deepcopy(value)}
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def texture_id(ref: str, aliases: dict[str, str]) -> str:
    seen: set[str] = set()
    while ref.startswith("#"):
        if ref in seen:
            raise AssetError(f"Texture alias cycle: {ref}")
        seen.add(ref)
        key = ref[1:]
        if key not in aliases:
            raise AssetError(f"Missing texture alias: {ref}")
        ref = aliases[key]
    checked_id(ref)
    return ref


def check_vector(value: Any, n: int, label: str) -> list[float]:
    if not isinstance(value, list) or len(value) != n or any(
        isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in value
    ):
        raise AssetError(f"Invalid {label}: {value!r}")
    return value


def inspect_model(model: dict, allow_native_uv_rotation: bool = False) -> list[dict]:
    if not isinstance(model.get("elements"), list) or not model["elements"]:
        raise AssetError("No authored elements; procedural/vanilla templates are not substituted.")
    warnings = []
    for i, e in enumerate(model["elements"]):
        a = check_vector(e.get("from"), 3, f"element {i} from")
        b = check_vector(e.get("to"), 3, f"element {i} to")
        if any(y < x for x, y in zip(a, b)):
            raise AssetError(f"Inverted dimensions at element {i}; inward surfaces need separate review.")
        if any(x == y for x, y in zip(a, b)):
            warnings.append({"code": "PLANAR_ELEMENT_PRESERVED", "element": i})
        rotation = e.get("rotation", {})
        if rotation:
            if rotation.get("axis") not in ("x", "y", "z"):
                raise AssetError(f"Unsupported rotation axis at element {i}")
            check_vector(rotation.get("origin"), 3, "rotation pivot")
            check_vector([rotation.get("angle")], 1, "rotation angle")
            if rotation.get("rescale"):
                raise AssetError("Java rescale rotation requires a separate verified conversion.")
        for name, face in e.get("faces", {}).items():
            if name not in FACES:
                raise AssetError(f"Unknown cube face: {name}")
            check_vector(face.get("uv"), 4, "face UV")
            angle = face.get("rotation", 0)
            allowed = (0, 90, 180, 270) if allow_native_uv_rotation else (0,)
            if isinstance(angle, bool) or angle not in allowed:
                raise AssetError("Face UV rotation requires a valid, explicitly enabled native 1.21.0 path.")
            if "tintindex" in face:
                raise AssetError("Tinted faces need a colour source; not silently ignored.")
    return warnings


def lower_inward_surfaces(model: dict) -> tuple[dict, list[dict]]:
    """Preserve six-plane semantics of all-axis-reversed authored cuboids.

    Each original face stays at its own plane with its own outward normal and
    corner UVs. This is NOT abs(size), a filled replacement box, or extra thickness.
    Mixed-axis inversions remain blocked pending a dedicated verified mapping.
    """
    out = copy.deepcopy(model)
    out["elements"] = []
    changes = []
    for i, e in enumerate(model.get("elements", [])):
        a = check_vector(e.get("from"), 3, "from")
        b = check_vector(e.get("to"), 3, "to")
        inverted = [b[j] < a[j] for j in range(3)]
        if not any(inverted):
            out["elements"].append(copy.deepcopy(e))
            continue
        if not all(inverted):
            raise AssetError("Mixed-axis inverted dimensions still require separate review")
        planes = {"north": (2, a[2]), "south": (2, b[2]),
                  "west": (0, a[0]), "east": (0, b[0]),
                  "up": (1, b[1]), "down": (1, a[1])}
        for face, data in e.get("faces", {}).items():
            if data.get("rotation", 0):
                raise AssetError("Rotated UV on inward face is not yet supported")
            axis, value = planes[face]
            lo, hi = list(b), list(a)
            lo[axis] = hi[axis] = value
            uv = data["uv"]
            f = copy.deepcopy(data)
            f["uv"] = [uv[2], uv[3], uv[0], uv[1]]
            plane = {"name": f"source_{i}_inward_{face}", "from": lo, "to": hi,
                     "faces": {face: f}}
            if "rotation" in e:
                plane["rotation"] = copy.deepcopy(e["rotation"])
            if "shade" in e:
                plane["shade"] = e["shade"]
            out["elements"].append(plane)
        changes.append({"code": "INWARD_SURFACES_TO_ONE_SIDED_PLANES", "source_element": i,
                        "source_faces": list(e.get("faces", {})),
                        "planes_created": len(e.get("faces", {})),
                        "added_thickness": 0, "source_retained": True})
    inspect_model(out)
    return out, changes


def lower_mixed_axis_surfaces(model: dict) -> tuple[dict, list[dict]]:
    """Preserve signed-cuboid face winding via oriented, zero-thickness planes.

    This path is opt-in. It handles negative extents without filling inward walls,
    swapping a face's physical location, or modifying PNG pixels. Quarter-turn
    UVs and already-planar inverted cuboids remain explicitly unsupported.
    """
    def quad(a, b, face):
        x,y,z=a; X,Y,Z=b
        return {
            "north": [(X,Y,z),(x,Y,z),(x,y,z),(X,y,z)],
            "south": [(x,Y,Z),(X,Y,Z),(X,y,Z),(x,y,Z)],
            "east": [(X,Y,Z),(X,Y,z),(X,y,z),(X,y,Z)],
            "west": [(x,Y,z),(x,Y,Z),(x,y,Z),(x,y,z)],
            "up": [(x,Y,z),(X,Y,z),(X,Y,Z),(x,Y,Z)],
            "down": [(x,y,Z),(X,y,Z),(X,y,z),(x,y,z)],
        }[face]
    out=copy.deepcopy(model); out["elements"]=[]; changes=[]
    for i,element in enumerate(model.get("elements", [])):
        a=check_vector(element.get("from"),3,"from")
        b=check_vector(element.get("to"),3,"to")
        negative=[axis for axis in range(3) if b[axis]<a[axis]]
        if not negative:
            out["elements"].append(copy.deepcopy(element)); continue
        if any(a[j]==b[j] for j in range(3)):
            raise AssetError("Already-planar mixed inversion needs separate review")
        planes={"north":(2,a[2]),"south":(2,b[2]),"east":(0,b[0]),
                "west":(0,a[0]),"up":(1,b[1]),"down":(1,a[1])}
        created=[]
        for face,data in element.get("faces",{}).items():
            if data.get("rotation",0):
                raise AssetError("Rotated UV on mixed-axis surface is not enabled")
            axis,value=planes[face]
            lo=[min(a[j],b[j]) for j in range(3)]
            hi=[max(a[j],b[j]) for j in range(3)]
            lo[axis]=hi[axis]=value
            source=quad(a,b,face)
            u0,v0,u1,v1=check_vector(data.get("uv"),4,"mixed-axis face UV")
            original_uv=[(u0,v0),(u1,v0),(u1,v1),(u0,v1)]
            match=None
            for target in (("east","west"),("up","down"),("north","south"))[axis]:
                dest=quad(lo,hi,target)
                order=[source.index(vertex) for vertex in dest]
                if any(order==[(start+j)%4 for j in range(4)] for start in range(4)):
                    desired=[original_uv[j] for j in order]
                    uv=[desired[0][0],desired[0][1],desired[2][0],desired[2][1]]
                    if desired!=[(uv[0],uv[1]),(uv[2],uv[1]),(uv[2],uv[3]),(uv[0],uv[3])]:
                        raise AssetError("Mixed-axis UV requires an unverified quarter turn")
                    match=(target,uv); break
            if match is None:
                raise AssetError("No orientation-preserving mixed-axis plane mapping")
            target,uv=match
            plane={"name":f"source_{i}_mixed_{face}","from":lo,"to":hi,
                   "faces":{target:{**copy.deepcopy(data),"uv":uv}}}
            for key in ("rotation","shade"):
                if key in element: plane[key]=copy.deepcopy(element[key])
            out["elements"].append(plane);created.append({"from":face,"to":target})
        changes.append({"code":"SIGNED_CUBOID_TO_ORIENTED_PLANES","source_element":i,
                        "negative_axes":["xyz"[j] for j in negative],
                        "face_mapping":created,"planes_created":len(created),
                        "added_thickness":0,"source_retained":True})
    inspect_model(out)
    return out,changes


def lower_uv_half_turns(model: dict, allow_quarter_turns: bool = False) -> tuple[dict, list[dict]]:
    """Bake 180-degree per-face UV rotation to reversed endpoints, not new pixels.

    The source remains unchanged. Legacy callers still reject quarter turns.
    Explicitly enabled quarter turns stay native and require geometry 1.21.0.
    """
    out = copy.deepcopy(model)
    changes = []
    for i, e in enumerate(out.get("elements", [])):
        for name, face in e.get("faces", {}).items():
            angle = face.get("rotation", 0)
            allowed = (0, 90, 180, 270) if allow_quarter_turns else (0, 180)
            if isinstance(angle, bool) or angle not in allowed:
                raise AssetError(f"UV rotation {angle!r} is not verified by this exporter")
            if angle in (90, 270):
                changes.append({"code": "FACE_UV_QUARTER_TURN_NATIVE", "source_element": i,
                                "face": name, "degrees": angle, "geometry_format": "1.21.0",
                                "source_retained": True})
            if angle == 180:
                u0, v0, u1, v1 = check_vector(face["uv"], 4, "half-turn UV")
                face["uv"] = [u1, v1, u0, v0]
                del face["rotation"]
                changes.append({"code": "FACE_UV_HALF_TURN_BAKED", "source_element": i,
                                "face": name, "degrees": 180, "source_retained": True})
    return out, changes


def metadata_warnings(model: dict) -> list[dict]:
    """Record source requirements without silently claiming runtime support."""
    warnings = []
    ref = model.get("textures", {}).get("particle")
    if ref is not None:
        try:
            texture_id(ref, model["textures"])
        except (AssetError, TypeError, AttributeError) as exc:
            warnings.append({"code": "UNRESOLVED_SOURCE_PARTICLE_ALIAS", "source_value": ref,
                             "reason": str(exc), "affects_body_face_uv": False,
                             "particle_runtime_implemented": False})
    for i, e in enumerate(model.get("elements", [])):
        if "neoforge_data" in e:
            warnings.append({"code": "SOURCE_LIGHTING_METADATA_NOT_PORTED", "source_element": i,
                             "source_value": copy.deepcopy(e["neoforge_data"]),
                             "geometry_and_uv_preserved": True,
                             "bedrock_emissive_material_implemented": False,
                             "offline_fullbright_simulated": False})
    return warnings


def build_atlas(model: dict, destination: Path, root: Path = ASSETS) -> dict[str, dict]:
    refs = sorted({texture_id(f["texture"], model.get("textures", {}))
                   for e in model["elements"] for f in e.get("faces", {}).values()})
    images: dict[str, Image.Image] = {}
    for ref in refs:
        p = resource_path(ref, "textures", root)
        if not p.is_file():
            raise AssetError(f"Missing texture: {ref}")
        if p.with_suffix(".png.mcmeta").exists():
            raise AssetError(f"Animated texture requires explicit frame policy: {ref}")
        with Image.open(p) as im:
            if im.width > 4096 or im.height > 4096:
                raise AssetError("Texture exceeds atlas limit.")
            images[ref] = im.convert("RGBA")
    width, height = sum(im.width for im in images.values()), max(im.height for im in images.values())
    if width > 4096 or height > 4096:
        raise AssetError("Atlas exceeds 4096 pixels.")
    atlas = Image.new("RGBA", (width, height))
    placement = {}
    x = 0
    for ref, im in images.items():
        atlas.paste(im, (x, 0))  # No mask: preserve RGBA, including hidden RGB under alpha=0.
        placement[ref] = {"x": x, "y": 0, "width": im.width, "height": im.height}
        x += im.width
    destination.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(destination)
    return placement


def pixel_uv(face: dict, model: dict, placement: dict) -> list[float]:
    rect = placement[texture_id(face["texture"], model.get("textures", {}))]
    u0, v0, u1, v1 = face["uv"]
    # Java UV uses normalized 0..16 texture coordinates, even for 32/64px textures.
    return [rect["x"] + u0 * rect["width"] / 16,
            rect["y"] + v0 * rect["height"] / 16,
            rect["x"] + u1 * rect["width"] / 16,
            rect["y"] + v1 * rect["height"] / 16]


def point_to_bedrock(point: list[float]) -> list[float]:
    return [8 - point[0], point[1], point[2] - 8]


def compile_element(e: dict, model: dict, placement: dict, dx: float = 0, dz: float = 0) -> dict:
    a, b = e["from"], e["to"]
    uv = {}
    for name, face in e.get("faces", {}).items():
        x0, y0, x1, y1 = pixel_uv(face, model, placement)
        # Bedrock's up/down endpoints are reversed relative to Java/Blockbench editor UV.
        if name in ("up", "down"):
            x0, y0, x1, y1 = x1, y1, x0, y0
        uv[name] = {"uv": [x0, y0], "uv_size": [x1 - x0, y1 - y0]}
        if face.get("rotation", 0):
            uv[name]["uv_rotation"] = face["rotation"]
    result = {"origin": [8 - b[0] - dx, a[1], a[2] + dz - 8],
              "size": [b[j] - a[j] for j in range(3)], "uv": uv}
    r = e.get("rotation")
    if r and r["angle"]:
        p = list(r["origin"])
        p[0] += dx
        p[2] += dz
        result["pivot"] = point_to_bedrock(p)
        axis = "xyz".index(r["axis"])
        angles = [0, 0, 0]
        # This is an engine convention, not a generic right-handed matrix mirror.
        angles[axis] = r["angle"] * (-1 if axis < 2 else 1)
        result["rotation"] = angles
    return result


def geometry(model: dict, name: str, placement: dict, offsets: list[list[float]],
             allow_native_uv_rotation: bool = False) -> dict:
    inspect_model(model, allow_native_uv_rotation=allow_native_uv_rotation)
    native_uv = any(f.get("rotation", 0) for e in model["elements"] for f in e.get("faces", {}).values())
    bones = [{"name": "root", "pivot": [0, 0, 0]}]
    for i, (dx, dz) in enumerate(offsets):
        for j, e in enumerate(model["elements"]):
            label = re.sub(r"[^a-zA-Z0-9_]", "_", e.get("name", f"element_{j}"))
            bones.append({"name": f"instance_{i}_{label}_{j}", "parent": "root", "pivot": [0, 0, 0],
                          "cubes": [compile_element(e, model, placement, dx, dz)]})
    return {"format_version": "1.21.0" if native_uv else "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.kg_a1.{name}",
                        "texture_width": max(r["x"] + r["width"] for r in placement.values()),
                        "texture_height": max(r["y"] + r["height"] for r in placement.values()),
                        "visible_bounds_width": 4, "visible_bounds_height": 4,
                        "visible_bounds_offset": [0, 1, 0]},
        "bones": bones}]}


def editable_model(model: dict, name: str, placement: dict, atlas: Path, offsets: list) -> dict:
    """A Free Model .bbmodel with pixel UV, embedded atlas and unchanged Java-space geometry.

    Free Model avoids accidentally applying game-specific conversion a second time.
    Actual Blockbench UI import is an outstanding manual acceptance step.
    """
    tid = str(uuid.uuid5(UUID_NS, name + ":texture"))
    width = max(r["x"] + r["width"] for r in placement.values())
    height = max(r["y"] + r["height"] for r in placement.values())
    elements, groups = [], []
    for i, (dx, dz) in enumerate(offsets):
        children = []
        for j, e in enumerate(model["elements"]):
            uid = str(uuid.uuid5(UUID_NS, f"{name}:{i}:{j}"))
            r = e.get("rotation", {"axis": "y", "angle": 0, "origin": [8, 0, 8]})
            pivot = list(r["origin"])
            pivot[0] += dx
            pivot[2] += dz
            rotation = [0, 0, 0]
            rotation["xyz".index(r["axis"])] = r["angle"]
            fr = [e["from"][0] + dx, e["from"][1], e["from"][2] + dz]
            to = [e["to"][0] + dx, e["to"][1], e["to"][2] + dz]
            faces = {face: {"uv": [0, 0, 0, 0], "texture": None} for face in FACES}
            for face, f in e.get("faces", {}).items():
                faces[face] = {"uv": pixel_uv(f, model, placement), "texture": 0}
                if f.get("rotation", 0):
                    faces[face]["rotation"] = f["rotation"]
            elements.append({"name": e.get("name", f"element_{j}"), "type": "cube", "uuid": uid,
                             "from": fr, "to": to, "origin": pivot, "rotation": rotation,
                             "box_uv": False, "autouv": 0, "faces": faces})
            children.append(uid)
        groups.append({"name": f"instance_{i}", "origin": [8, 0, 8],
                       "uuid": str(uuid.uuid5(UUID_NS, name + f":group:{i}")), "children": children})
    return {"meta": {"format_version": "4.10", "model_format": "free", "box_uv": False},
            "name": name, "model_identifier": name, "visible_box": [4, 4, 1],
            "resolution": {"width": width, "height": height}, "elements": elements, "outliner": groups,
            "textures": [{"path": "", "name": atlas.name, "uuid": tid, "id": "0", "mode": "bitmap",
                          "width": width, "height": height, "uv_width": width, "uv_height": height,
                          "source": "data:image/png;base64," + base64.b64encode(atlas.read_bytes()).decode()}]}


def verify_sources() -> dict:
    manifest = json.loads((ROOT / "source_manifest.json").read_text(encoding="utf-8"))
    for entry in manifest["files"]:
        data = (ROOT / "source_snapshots" / entry["path"]).read_bytes()
        actual = hashlib.sha256(data).hexdigest()
        if actual != entry["local_sha256"]:
            raise AssetError(f"Source modified: {entry['path']}")
        if entry["upstream_byte_match"]:
            blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
            if blob != entry["upstream_git_blob_sha1"]:
                raise AssetError(f"Upstream Git blob mismatch: {entry['path']}")
    return manifest


def geometry_fingerprint(model: dict) -> str:
    """Shape count excludes texture, UV, source filename and display-pose duplicates."""
    shapes = [{key: e[key] for key in ("from", "to", "rotation") if key in e}
              for e in model["elements"]]
    # An explicit zero-angle rotation and an omitted rotation describe the same shape.
    for e in shapes:
        if e.get("rotation", {}).get("angle", 0) == 0:
            e.pop("rotation", None)
    return hashlib.sha256(json.dumps(shapes, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def audit_selectors(candidates: list[dict]) -> dict:
    by_source = {c["source_model"]: c for c in candidates}
    by_source[NS + ":item/fixed_skewers/beef/beef_skewer"] = next(c for c in candidates if c["name"] == "beef_raw")
    records = []
    for item in ("raw_beef_skewer", "grilled_beef_skewer", "special_seasoning", "raw_lamb_skewer", "grilled_lamb_skewer", "raw_mushroom_skewer", "grilled_mushroom_skewer", "raw_ender_pearl_skewer", "grilled_ender_pearl_skewer", "raw_fish_skewer", "grilled_fish_skewer", "raw_chicken_skin_skewer", "grilled_chicken_skin_skewer", "raw_potato_slice_skewer", "grilled_potato_slice_skewer", "raw_bun_slice_skewer", "grilled_bun_slice_skewer", "raw_gluten_skewer", "grilled_gluten_skewer", "raw_fried_egg_skewer", "grilled_fried_egg_skewer", "raw_pork_belly_skewer", "grilled_pork_belly_skewer", "raw_meatball_skewer", "grilled_meatball_skewer", "raw_slime_skewer", "grilled_slime_skewer", "raw_golden_skewer", "grilled_golden_skewer", "raw_mid_wing_skewer", "grilled_mid_wing_skewer", "raw_meat_and_bone_skewer", "grilled_meat_and_bone_skewer", "raw_caterpillar_skewer", "grilled_caterpillar_skewer", "raw_squid_tentacle_skewer", "grilled_squid_tentacle_skewer", "raw_sweet_potato_sheet_skewer", "grilled_sweet_potato_sheet_skewer", "ordinary_skewer"):
        path = resource_path(NS + ":item/" + item, "models")
        data = json.loads(path.read_text(encoding="utf-8"))
        edges = []
        for index, override in enumerate(data.get("overrides", [])):
            ref = override["model"]
            if ref not in by_source:
                raise AssetError(f"Unmapped visual state in {item}: {ref}")
            # Resolving every target proves the entire parent chain is available locally.
            resolve_model(ref)
            candidate = by_source[ref]
            edges.append({"java_override_index": index, "predicate": override["predicate"],
                          "source_model": ref, "candidate": candidate["name"],
                          "geometry": candidate["geometry"], "runtime_implemented": False})
        base = {"raw_beef_skewer": "beef_raw", "grilled_beef_skewer": "beef_cooked",
                "special_seasoning": "seasoning_special_empty", "raw_lamb_skewer": "lamb_raw",
                "grilled_lamb_skewer": "lamb_cooked", "raw_mushroom_skewer": "mushroom_raw",
                "grilled_mushroom_skewer": "mushroom_cooked", "raw_ender_pearl_skewer": "ender_pearl_raw",
                "grilled_ender_pearl_skewer": "ender_pearl_cooked",
                "raw_meatball_skewer": "meatball_raw", "grilled_meatball_skewer": "meatball_cooked",
                "ordinary_skewer": "ordinary_full", "raw_slime_skewer": "slime_frame_0", "grilled_slime_skewer": "slime_frame_0",
                **{prefix+family+"_skewer":family+state for family in ("fish","chicken_skin","potato_slice","bun_slice","gluten","fried_egg","pork_belly","golden","mid_wing","meat_and_bone","caterpillar","squid_tentacle","sweet_potato_sheet") for prefix,state in (("raw_","_raw"),("grilled_","_cooked"))}}[item]
        records.append({"java_item": NS + ":" + item, "default_candidate": base,
                        "selector_source": str(path.relative_to(ROOT)), "overrides": edges})
    result = {"purpose": "Source predicate-to-asset mapping, NOT Bedrock gameplay or animation code",
              "runtime_wiring": False, "all_override_targets_resolved": True,
              "selectors": records}
    write_json(ROOT / "reports/visual-state-map.json", result)
    return result


def build() -> dict:
    manifest = verify_sources()
    generated_editor = ROOT / "editor/generated"
    generated_geo = ROOT / "resource_pack/models/entity/kg_a1"
    generated_tex = ROOT / "resource_pack/textures/kg_a1"
    for directory in (generated_editor, generated_geo, generated_tex):
        directory.mkdir(parents=True, exist_ok=True)
    spec_document = json.loads((ROOT / "config/asset_specs.json").read_text(encoding="utf-8"))
    specs = spec_document["candidates"]
    report = {"version": spec_document["version"], "stage": "A1-assets-only",
              "minecraft_tested": False, "blockbench_ui_tested": False,
              "bridge_ui_import_tested": False, "complete_mod_assets": False,
              "source_files": len(manifest["files"]),
              "upstream_byte_matches": sum(x["upstream_byte_match"] for x in manifest["files"]),
              "original_png_count": sum(x["path"].endswith(".png") for x in manifest["files"]),
              "shape_count_definition": "Distinct element coordinates/rotations, excluding UV, texture, hand poses and repeated bottle layouts",
              "candidates": [], "blockers": []}
    shapes, atlas_contents, names = set(), {}, set()
    for spec in specs:
        name, model_id = spec["name"], spec["source_model"]
        offsets, texture_name = spec["offsets"], spec["atlas_name"]
        if not re.fullmatch(r"[a-z0-9_]+", name) or name in names:
            raise AssetError(f"Unsafe or duplicate candidate name: {name}")
        names.add(name)
        if not re.fullmatch(r"[a-z0-9_]+", texture_name):
            raise AssetError(f"Unsafe atlas name: {texture_name}")
        for offset in offsets:
            check_vector(offset, 2, "layout offset")
        original = resolve_model(model_id)
        native = spec.get("allow_native_uv_rotation", False)
        if not isinstance(native, bool):
            raise AssetError("allow_native_uv_rotation must be boolean")
        if native and spec.get("inward_surfaces"):
            raise AssetError("Combined inward surface and native quarter turn path requires separate validation")
        prepared, template_warnings = original, []
        if spec.get("reference_template"):
            from reference_templates import prepare
            prepared, template_warnings = prepare(original, spec.get("source_tint_pending", False))
        uv_model, uv_changes = lower_uv_half_turns(prepared, allow_quarter_turns=native)
        model, changes = (lower_mixed_axis_surfaces(uv_model) if spec.get("mixed_axis_surfaces") else
                          lower_inward_surfaces(uv_model) if spec.get("inward_surfaces") else (uv_model, []))
        warnings = inspect_model(model, allow_native_uv_rotation=native) + changes + uv_changes + metadata_warnings(original) + template_warnings
        if spec.get("mixed_axis_surfaces"):
            particle=original.get("textures",{}).get("particle")
            if particle and not resource_path(texture_id(particle,original["textures"]),"textures").is_file():
                warnings.append({"code":"EXTERNAL_PARTICLE_TEXTURE_NOT_BUNDLED",
                                 "source_value":particle,"particle_runtime_implemented":False})
            canonical=[json.dumps(e,sort_keys=True) for e in original["elements"]]
            duplicate_count=len(canonical)-len(set(canonical))
            if duplicate_count:
                warnings.append({"code":"DUPLICATE_AUTHORED_ELEMENTS_PRESERVED",
                                 "duplicate_elements":duplicate_count,"silently_deduplicated":False})
        shape_hash = geometry_fingerprint(original)
        shapes.add(shape_hash)
        atlas = generated_tex / (texture_name + ".png")
        placement = build_atlas(model, atlas)
        atlas_hash = hashlib.sha256(atlas.read_bytes()).hexdigest()
        if texture_name in atlas_contents and atlas_contents[texture_name] != atlas_hash:
            raise AssetError(f"Shared atlas conflict: {texture_name}")
        atlas_contents[texture_name] = atlas_hash
        geo = geometry(model, name, placement, offsets, allow_native_uv_rotation=native)
        geo_path, editor_path = generated_geo / (name + ".geo.json"), generated_editor / (name + ".bbmodel")
        write_json(geo_path, geo)
        write_json(editor_path, editable_model(model, name, placement, atlas, offsets))
        write_json(ROOT / "reports/resolved_models" / (name + ".json"), original)
        write_json(ROOT / "reports/export_surfaces" / (name + ".json"), model)
        write_json(ROOT / "reports/java_display_transforms" / (name + ".json"), {
            "source_model": model_id, "java_display": model.get("display", {}),
            "applied_to_bedrock": False,
            "note": "Preserved as reference; not validated as Bedrock attachable/hand/display transforms."})
        report["candidates"].append({
            "name": name, "label_zh": spec["label_zh"], "group": spec["group"],
            "source_model": model_id, "shape_sha256": shape_hash,
            "instance_count": len(offsets), "cubes": len(model["elements"]) * len(offsets),
            "source_cuboids": len(original["elements"]), "surface_lowering": changes, "uv_lowering": uv_changes,
            "geometry": str(geo_path.relative_to(ROOT)), "editable": str(editor_path.relative_to(ROOT)),
            "geometry_sha256": hashlib.sha256(geo_path.read_bytes()).hexdigest(),
            "atlas_sha256": atlas_hash, "warnings": warnings,
            "atlas": str(atlas.relative_to(ROOT)), "atlas_regions": placement,
            "in_game_accepted": False, "runtime_wiring": "not implemented",
            **{k: spec[k] for k in ("remaining", "variant", "bite_stage", "recovered_from_fork") if k in spec}})
    # Mixed-source overlays have per-file provenance; do not attribute fork files to main.
    manifest_entries = {x["path"]: x for x in json.loads((ROOT / "source_manifest.json").read_text())["files"]}
    for rec in report["candidates"]:
        logical = str(resource_path(rec["source_model"], "models").relative_to(ASSETS))
        entry = manifest_entries.get("common/src/main/resources/assets/" + logical, {})
        if entry.get("source_repository"):
            rec["source_provenance"] = {k: entry[k] for k in
                ("source_repository", "source_commit", "source_remote_path", "source_url", "provenance_note") if k in entry}
            rec["source_provenance"]["primary_commit_contains_this_file"] = False
        if rec.get("recovered_from_fork"):
            rec["warnings"].append({"code":"FORK_SOURCE_RECOVERED_NOT_RELEASE_EQUIVALENCE",
                "same_release_comparison_done":False})
            if "legged" in rec["name"]:
                rec["warnings"].append({"code":"BELOW_ORIGIN_LEGS_ANCHOR_REVIEW_REQUIRED",
                    "source_min_unrotated_y":-16, "auto_shift_applied":False,
                    "bedrock_block_placement_validated":False})
    # Independent unresolved source items stay explicit; they are not substituted.
    try:
        if "big_vat" not in names:
            inspect_model(resolve_model(NS + ":block/big_vat"))
    except AssetError as exc:
        report["blockers"].append({"name": "big_vat", "reason": str(exc)})
    grill = json.loads((ASSETS / NS / "blockstates/grill.json").read_text(encoding="utf-8"))
    for ref in sorted({x["model"] for x in grill["variants"].values()}):
        if not resource_path(ref, "models").is_file():
            report["blockers"].append({"name": ref,
                "reason": "Unresolved model in pinned partial snapshot; do not infer absence from release JAR."})
    report["candidate_count"] = len(report["candidates"])
    report["unique_geometry_bases"] = len(shapes)
    report["atlas_count"] = len(atlas_contents)
    report["exported_cube_instances"] = sum(x["cubes"] for x in report["candidates"])
    state_map = audit_selectors(report["candidates"])
    report["resolved_selector_edges"] = sum(len(s["overrides"]) for s in state_map["selectors"])
    report["bridge_project"] = {"configuration": "config.json", "packs": ["resource_pack"],
                                "browser_verified": False, "gameplay_included": False}
    write_json(ROOT / "reports/build-report.json", report)
    return report


if __name__ == "__main__":
    try:
        r = build()
        print(f"Built {r['candidate_count']} visual candidates from {r['unique_geometry_bases']} geometry bases.")
        print(f"{len(r['blockers'])} known blockers recorded. No Minecraft runtime/gameplay test performed.")
    except (OSError, ValueError, KeyError) as exc:
        print(f"Build stopped: {exc}", file=sys.stderr)
        raise SystemExit(1)
