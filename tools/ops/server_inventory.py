"""Read-only inventory of a Bedrock Dedicated Server tree (BSM-managed or plain).

Run ON THE SERVER, e.g. for the luosen world:

    python3 server_inventory.py --server-root /srv/bsm/servers/luosen > luosen-inventory.json

It never writes inside --server-root, never stops/starts anything and never
opens LevelDB. It records, for every world:

* the ordered behavior/resource pack stacks the world actually enables
  (world_behavior_packs.json / world_resource_packs.json),
* which installed pack folder each UUID resolves to, its manifest version,
  script modules, dependencies, a content hash and size,
* unresolved UUIDs, UUIDs installed more than once (version shadowing),
  dependency versions that do not match what is installed,
* vanilla-entity overrides (e.g. two packs both defining minecraft:player),
* the server.properties keys that matter for addons.

This is the Phase-1 evidence the rebuild plan requires before anything on the
live server changes. Standard library only (Python 3.8+).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

PACK_DIRS = {
    "behavior": ["behavior_packs", "development_behavior_packs"],
    "resource": ["resource_packs", "development_resource_packs"],
}
PROPERTY_KEYS = ("level-name", "server-port", "server-portv6", "allow-cheats", "content-log-file-enabled",
                 "texturepack-required", "online-mode", "max-players", "tick-distance", "view-distance")


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "guards"))
from jsonc import strip_jsonc


def read_json(path: Path):
    return json.loads(strip_jsonc(path.read_text(encoding="utf-8-sig")))


def version(value):
    return (isinstance(value, list) and len(value) == 3
            and all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in value))


def manifest(path):
    doc = read_json(path)
    if not isinstance(doc, dict) or not isinstance(doc.get("header"), dict):
        raise ValueError("manifest/header must be objects")
    header = doc["header"]
    if not isinstance(header.get("uuid"), str) or not header["uuid"] or not version(header.get("version")):
        raise ValueError("invalid manifest UUID/version")
    for field in ["modules", "dependencies"]:
        if not isinstance(doc.get(field, []), list) or not all(isinstance(x, dict) for x in doc.get(field, [])):
            raise ValueError(f"invalid manifest {field}")
    return doc


def tree_hash(root: Path) -> tuple[str, int, int]:
    h, size, count = hashlib.sha256(), 0, 0
    for p in sorted(root.rglob("*")):
        if p.is_file():
            rel = p.relative_to(root).as_posix().encode()
            data = p.read_bytes()
            h.update(len(rel).to_bytes(4, "big") + rel + hashlib.sha256(data).digest())
            size += len(data)
            count += 1
    return h.hexdigest(), size, count


def vstr(v):
    return ".".join(map(str, v)) if isinstance(v, list) else str(v)


def installed_packs(server_root: Path, world_dir: Path, problems=None) -> dict[str, list[dict]]:
    found: dict[str, list[dict]] = {}
    problems = problems if problems is not None else []
    roots = []
    for kind, names in PACK_DIRS.items():
        roots += [(kind, server_root / n) for n in names]
        roots += [(kind, world_dir / n) for n in names]
    for kind, root in roots:
        if not root.is_dir():
            continue
        for man_path in root.glob("*/manifest.json"):
            try:
                man = manifest(man_path)
            except (OSError, ValueError, TypeError) as exc:
                problems.append(f"{man_path}: {exc}")
                continue
            header = man["header"]
            uuid = header["uuid"]
            digest, size, count = tree_hash(man_path.parent)
            entities, fragments = [], []
            ent_dir = man_path.parent / "entities"
            if ent_dir.is_dir():
                for e in ent_dir.rglob("*.json"):
                    try:
                        doc = read_json(e)
                        entity = doc["minecraft:entity"]
                        if not isinstance(entity, dict): raise ValueError("entity must be an object")
                        if "description" not in entity:
                            # Vanilla version-overlay fragments legitimately
                            # omit description. Report them explicitly rather
                            # than fabricating an identifier or a parse error.
                            fragments.append(e.relative_to(man_path.parent).as_posix())
                            continue
                        ident = entity["description"]["identifier"]
                        if not isinstance(ident, str): raise ValueError("entity identifier must be a string")
                        if ident.startswith("minecraft:"): entities.append(ident)
                    except (OSError, ValueError, TypeError, KeyError) as exc:
                        problems.append(f"{e}: invalid entity: {exc}")
            found.setdefault(uuid, []).append({
                "kind": kind,
                "folder": str(man_path.parent),
                "name": header.get("name"),
                "version": vstr(header.get("version")),
                "min_engine_version": vstr(header.get("min_engine_version")),
                "modules": [{"type": m.get("type"), "entry": m.get("entry"), "uuid": m.get("uuid"),
                             "version": vstr(m.get("version"))} for m in man.get("modules", [])],
                "dependencies": [{"uuid": d.get("uuid"), "module_name": d.get("module_name"),
                                  "version": vstr(d.get("version"))} for d in man.get("dependencies", [])],
                "vanilla_entity_overrides": sorted(entities),
                "entity_fragments_without_identifier": sorted(fragments),
                "sha256_tree": digest, "bytes": size, "files": count,
            })
    return found


def world_report(server_root: Path, world_dir: Path) -> dict:
    report = {"world_dir": str(world_dir), "stacks": {}, "problems": []}
    installed = installed_packs(server_root, world_dir, report["problems"])
    for kind, fname in (("behavior", "world_behavior_packs.json"), ("resource", "world_resource_packs.json")):
        try:
            stack = read_json(world_dir / fname)
            if not isinstance(stack, list): raise ValueError("pack stack must be an array")
        except (OSError, ValueError, TypeError) as exc:
            report["problems"].append(f"{fname}: {exc}")
            stack = []
        rows = []
        for order, entry in enumerate(stack):
            if not isinstance(entry, dict) or not isinstance(entry.get("pack_id"), str) or not version(entry.get("version")):
                report["problems"].append(f"{fname} entry {order}: invalid pack identity/version")
                continue
            uuid, want = entry["pack_id"], vstr(entry["version"])
            cands = [c for c in installed.get(uuid, []) if c["kind"] == kind]
            match = [c for c in cands if c["version"] == want]
            row = {"order": order, "pack_id": uuid, "version": want,
                   "resolved": match[0] if match else None,
                   "other_installed_versions": sorted({c["version"] for c in cands if c not in match})}
            if not match:
                report["problems"].append(f"{kind} {uuid} v{want} enabled but not installed at that version")
            if len(match) > 1:
                report["problems"].append(f"{kind} {uuid} v{want} installed {len(match)} times: "
                                          + ", ".join(c["folder"] for c in match))
            rows.append(row)
        report["stacks"][kind] = rows
    enabled = {(r["pack_id"], r["version"]) for rows in report["stacks"].values() for r in rows}
    owners: dict[str, list[str]] = {}
    for rows in report["stacks"].values():
        for r in rows:
            res = r["resolved"]
            if not res:
                continue
            for dep in res["dependencies"]:
                if dep["uuid"] and (dep["uuid"], dep["version"]) not in enabled:
                    report["problems"].append(f"{res['name']} needs {dep['uuid']} v{dep['version']} which the world does not enable")
            for ent in res["vanilla_entity_overrides"]:
                owners.setdefault(ent, []).append(res["name"])
    for ent, names in owners.items():
        if len(names) > 1:
            report["problems"].append(f"{ent} overridden by several packs (only one wins): {names}")
    report["vanilla_entity_overrides"] = owners
    report["world_files"] = sorted(p.name for p in world_dir.iterdir() if p.is_file())
    db = world_dir / "db"
    report["leveldb_bytes"] = sum(p.stat().st_size for p in db.rglob("*") if p.is_file()) if db.is_dir() else None
    return report


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Read-only BDS addon inventory")
    ap.add_argument("--server-root", required=True, type=Path)
    args = ap.parse_args(argv)
    root = args.server_root.resolve()
    if not root.is_dir() or not (root / "server.properties").is_file():
        ap.error("server root must exist and contain server.properties")
    props = {}
    sp = root / "server.properties"
    if sp.exists():
        for line in sp.read_text(encoding="utf-8", errors="replace").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                if k.strip() in PROPERTY_KEYS:
                    props[k.strip()] = v.strip()
    worlds = sorted(p.parent for p in (root / "worlds").glob("*/level.dat")) if (root / "worlds").is_dir() else []
    if not props.get("level-name") or not any(w.name == props["level-name"] for w in worlds):
        ap.error("configured active world/level.dat is missing")
    out = {"schema": 1, "server_root": str(root), "server_properties": props,
           "active_world": props.get("level-name"),
           "worlds": [world_report(root, w) for w in worlds]}
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")
    problems = sum(len(w["problems"]) for w in out["worlds"])
    print(f"{len(worlds)} world(s), {problems} problem(s)", file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
