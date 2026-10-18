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


def strip_jsonc(text: str) -> str:
    text = re.sub(r"(?m)^\s*//.*$", "", text)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r",(\s*[}\]])", r"\1", text)


def read_json(path: Path):
    try:
        return json.loads(strip_jsonc(path.read_text(encoding="utf-8-sig")))
    except Exception as exc:  # noqa: BLE001 - inventory must keep going
        return {"__error__": f"{type(exc).__name__}: {exc}"}


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


def installed_packs(server_root: Path, world_dir: Path) -> dict[str, list[dict]]:
    found: dict[str, list[dict]] = {}
    roots = []
    for kind, names in PACK_DIRS.items():
        roots += [(kind, server_root / n) for n in names]
        roots += [(kind, world_dir / n) for n in names]
    for kind, root in roots:
        if not root.is_dir():
            continue
        for man_path in root.glob("*/manifest.json"):
            man = read_json(man_path)
            header = man.get("header", {}) if isinstance(man, dict) else {}
            uuid = header.get("uuid")
            if not uuid:
                continue
            digest, size, count = tree_hash(man_path.parent)
            entities = []
            ent_dir = man_path.parent / "entities"
            if ent_dir.is_dir():
                for e in ent_dir.rglob("*.json"):
                    ident = read_json(e).get("minecraft:entity", {}).get("description", {}).get("identifier", "")
                    if ident.startswith("minecraft:"):
                        entities.append(ident)
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
                "sha256_tree": digest, "bytes": size, "files": count,
            })
    return found


def world_report(server_root: Path, world_dir: Path) -> dict:
    installed = installed_packs(server_root, world_dir)
    report = {"world_dir": str(world_dir), "stacks": {}, "problems": []}
    for kind, fname in (("behavior", "world_behavior_packs.json"), ("resource", "world_resource_packs.json")):
        stack = read_json(world_dir / fname) if (world_dir / fname).exists() else []
        rows = []
        for order, entry in enumerate(stack if isinstance(stack, list) else []):
            uuid, want = entry.get("pack_id"), vstr(entry.get("version"))
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
    props = {}
    sp = root / "server.properties"
    if sp.exists():
        for line in sp.read_text(encoding="utf-8", errors="replace").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                if k.strip() in PROPERTY_KEYS:
                    props[k.strip()] = v.strip()
    worlds = sorted(p.parent for p in (root / "worlds").glob("*/level.dat")) if (root / "worlds").is_dir() else []
    out = {"schema": 1, "server_root": str(root), "server_properties": props,
           "active_world": props.get("level-name"),
           "worlds": [world_report(root, w) for w in worlds]}
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")
    problems = sum(len(w["problems"]) for w in out["worlds"])
    print(f"{len(worlds)} world(s), {problems} problem(s)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
