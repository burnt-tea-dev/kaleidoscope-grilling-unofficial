"""Save-compatibility lock for the live world (luosen) and every player save.

Why this exists
---------------
Bedrock silently deletes items whose identifier no longer exists, turns
removed custom blocks into unknown blocks, drops entities whose type was
removed (including the hidden inventory entities that hold grill / rack /
seasoning-bottle ItemStacks), and resets block permutations whose state
value disappeared. A "cleanup" that deletes an ID therefore destroys player
property in the live world with no error at pack load.

This guard records every persisted identifier surface of the canonical
runtime and fails when any of them disappears, unless the removal is listed
in ``id-retirements.json`` together with a replacement and an in-runtime
migration that still mentions the old identifier.

Additions are allowed but must be recorded with ``--update`` so they are a
deliberate, reviewed change. ``--update`` never deletes entries.

Usage::

    python3 tools/guards/save_compat.py check
    python3 tools/guards/save_compat.py update   # record additions only

Standard library only; runs in well under a second.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / "baseline.json"
LOCK = Path(__file__).with_name("save-compat.lock.json")
RETIREMENTS = Path(__file__).with_name("id-retirements.json")

# Constants whose value is a persisted key or key prefix
# (world/entity/item dynamic properties). Renaming the constant is fine;
# dropping the literal value orphans saved data.
PERSIST_CONST = re.compile(
    r"\b(?:const|let|var)\s+([A-Z][A-Z0-9_]*(?:KEY|PREFIX|PROPERTY|OWNER|NAMESPACE)[A-Z0-9_]*)\s*=\s*"
    r"(['\"`])(kaleidoscope_grilling:[^'\"`$]*)\2"
)
PERSIST_CALL = re.compile(r"[gs]etDynamicProperty\(\s*(['\"])(kaleidoscope_grilling:[^'\"]+)\1")
# Literal key prefixes that are concatenated with coordinates/ids, e.g. the grill
# state key 'kaleidoscope_grilling:g_' + dimension + x/y/z.
PERSIST_CONCAT = re.compile(r"(['\"])(kaleidoscope_grilling:[a-z0-9_./:-]+)\1\s*\+")


def strip_jsonc(text: str) -> str:
    out, i, n, in_str = [], 0, len(text), False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
        elif text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            i = n if j < 0 else j + 2
        else:
            out.append(c)
            i += 1
    return re.sub(r",(\s*[}\]])", r"\1", "".join(out))


def load_json(path: Path):
    return json.loads(strip_jsonc(path.read_text(encoding="utf-8-sig")))


def runtime_roots() -> tuple[Path, Path]:
    base = load_json(BASELINE)
    return ROOT / base["runtime"]["BP"], ROOT / base["runtime"]["RP"]


def collect() -> dict:
    bp, rp = runtime_roots()
    items, blocks, entities, client_entities = set(), {}, set(), set()
    for p in sorted((bp / "items").rglob("*.json")):
        ident = load_json(p).get("minecraft:item", {}).get("description", {}).get("identifier")
        if ident:
            items.add(ident)
    for p in sorted((bp / "blocks").rglob("*.json")):
        desc = load_json(p).get("minecraft:block", {}).get("description", {})
        ident = desc.get("identifier")
        if not ident:
            continue
        states = {}
        for name, values in (desc.get("states") or {}).items():
            if isinstance(values, dict):  # integer range form {"values": {"min":..,"max":..}}
                rng = values.get("values", values)
                if isinstance(rng, dict) and "min" in rng and "max" in rng:
                    values = list(range(int(rng["min"]), int(rng["max"]) + 1))
                else:
                    values = rng if isinstance(rng, list) else []
            states[name] = sorted({json.dumps(v) for v in values})
        blocks[ident] = states
    for p in sorted((bp / "entities").rglob("*.json")):
        ident = load_json(p).get("minecraft:entity", {}).get("description", {}).get("identifier")
        if ident:
            entities.add(ident)
    persisted = set()
    for p in sorted((bp / "scripts").rglob("*.js")):
        text = p.read_text(encoding="utf-8", errors="replace")
        persisted.update(m.group(3) for m in PERSIST_CONST.finditer(text))
        persisted.update(m.group(2) for m in PERSIST_CALL.finditer(text))
        persisted.update(m.group(2) for m in PERSIST_CONCAT.finditer(text))
    packs = {}
    for label, root in (("BP", bp), ("RP", rp)):
        man = load_json(root / "manifest.json")
        packs[label] = {
            "header_uuid": man["header"]["uuid"],
            "module_uuids": sorted(m["uuid"] for m in man.get("modules", [])),
        }
    return {
        "items": sorted(items),
        "blocks": {k: blocks[k] for k in sorted(blocks)},
        "entities": sorted(entities),
        "persisted_key_literals": sorted(persisted),
        "packs": packs,
    }


def load_retirements() -> dict[str, dict]:
    if not RETIREMENTS.exists():
        return {}
    doc = json.loads(RETIREMENTS.read_text(encoding="utf-8"))
    return {row["id"]: row for row in doc.get("retired", [])}


def script_text() -> str:
    bp, _ = runtime_roots()
    return "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in (bp / "scripts").rglob("*.js"))


def check(lock: dict, now: dict) -> tuple[list[str], list[str]]:
    errors, additions = [], []
    retired = load_retirements()
    scripts = None

    def removed(kind: str, ident: str):
        nonlocal scripts
        row = retired.get(ident)
        if not row:
            errors.append(f"{kind} removed without retirement: {ident}")
            return
        missing = [k for k in ("replacement", "migration", "reason", "world_rewrite_receipt") if not row.get(k)]
        if missing:
            errors.append(f"{kind} retirement for {ident} lacks {', '.join(missing)}")
            return
        if scripts is None:
            scripts = script_text()
        if row["migration"] == "runtime" and ident not in scripts:
            errors.append(f"{kind} {ident} retired with runtime migration, but no script still mentions it")

    for key in ("items", "entities", "persisted_key_literals"):
        before, after = set(lock.get(key, [])), set(now[key])
        for ident in sorted(before - after):
            removed(key[:-1], ident)
        additions += [f"{key[:-1]} added: {i}" for i in sorted(after - before)]

    for ident, states in lock.get("blocks", {}).items():
        cur = now["blocks"].get(ident)
        if cur is None:
            removed("block", ident)
            continue
        for name, values in states.items():
            if name not in cur:
                errors.append(f"block {ident} lost state {name} (saved permutations become invalid)")
                continue
            lost = sorted(set(values) - set(cur[name]))
            if lost:
                errors.append(f"block {ident} state {name} lost values {', '.join(lost)}")
        for name in sorted(set(cur) - set(states)):
            additions.append(f"block {ident} state added: {name}")
    additions += [f"block added: {i}" for i in sorted(set(now["blocks"]) - set(lock.get("blocks", {})))]

    for label, rec in lock.get("packs", {}).items():
        cur = now["packs"].get(label, {})
        if cur.get("header_uuid") != rec["header_uuid"]:
            errors.append(f"{label} header UUID changed {rec['header_uuid']} -> {cur.get('header_uuid')}: worlds lose the pack")
        if cur.get("module_uuids") != rec["module_uuids"]:
            errors.append(f"{label} module UUIDs changed: {rec['module_uuids']} -> {cur.get('module_uuids')}")
    return errors, additions


def merge(lock: dict, now: dict) -> dict:
    out = json.loads(json.dumps(lock))
    for key in ("items", "entities", "persisted_key_literals"):
        out[key] = sorted(set(lock.get(key, [])) | set(now[key]))
    blocks = out.setdefault("blocks", {})
    for ident, states in now["blocks"].items():
        prev = blocks.setdefault(ident, {})
        for name, values in states.items():
            prev[name] = sorted(set(prev.get(name, [])) | set(values))
    out["blocks"] = {k: blocks[k] for k in sorted(blocks)}
    out.setdefault("packs", now["packs"])
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("command", choices=["check", "update"])
    ap.add_argument("--lock", type=Path, default=None,
                    help="check against this lock instead (CI passes the base branch lock so that "
                         "deleting entries from the lock file cannot hide a removal)")
    args = ap.parse_args(argv)
    now = collect()
    if args.lock is not None:
        if args.command != "check":
            ap.error("--lock is only valid with check")
        lock = json.loads(args.lock.read_text(encoding="utf-8"))
        errors, _ = check(lock, now)
        for line in errors:
            print("  -", line, file=sys.stderr)
        if errors:
            print(f"SAVE-COMPAT FAILURE against {args.lock}", file=sys.stderr)
            return 1
        print(f"save-compat OK against {args.lock}")
        return 0
    if not LOCK.exists():
        if args.command != "update":
            print("save-compat lock missing; run: python3 tools/guards/save_compat.py update", file=sys.stderr)
            return 1
        lock = {"schema": 1}
    else:
        lock = json.loads(LOCK.read_text(encoding="utf-8"))
    errors, additions = check(lock, now)
    for line in additions:
        print("note:", line)
    if errors:
        print("\nSAVE-COMPAT FAILURE: this change would delete or corrupt saved player data.", file=sys.stderr)
        for line in errors:
            print("  -", line, file=sys.stderr)
        print("Read docs/SAVE-COMPAT.md before retiring any identifier.", file=sys.stderr)
        return 1
    if args.command == "update":
        merged = merge(lock, now)
        merged["schema"] = 1
        LOCK.write_text(json.dumps(merged, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"lock updated: {len(merged['items'])} items, {len(merged['blocks'])} blocks, "
              f"{len(merged['entities'])} entities, {len(merged['persisted_key_literals'])} key literals")
        return 0
    if additions:
        print("\nUnrecorded additions. Record them deliberately: python3 tools/guards/save_compat.py update", file=sys.stderr)
        return 1
    print(f"save-compat OK: {len(now['items'])} items, {len(now['blocks'])} blocks, {len(now['entities'])} entities, "
          f"{len(now['persisted_key_literals'])} persisted key literals preserved")
    return 0


if __name__ == "__main__":
    sys.exit(main())
