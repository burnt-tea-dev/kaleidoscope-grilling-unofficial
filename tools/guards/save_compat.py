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
import hashlib
import re
import sys
from pathlib import Path

from js_tokens import persisted_literals

ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / "baseline.json"
LOCK = Path(__file__).with_name("save-compat.lock.json")
RETIREMENTS = Path(__file__).with_name("id-retirements.json")



from jsonc import strip_jsonc


def load_json(path: Path):
    return json.loads(strip_jsonc(path.read_text(encoding="utf-8-sig")))


def runtime_roots() -> tuple[Path, Path]:
    base = load_json(BASELINE)
    return ROOT / base["runtime"]["BP"], ROOT / base["runtime"]["RP"]


def collect() -> dict:
    bp, rp = runtime_roots()
    items, blocks, entities, storage = set(), {}, set(), {}
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
        entity = load_json(p).get("minecraft:entity", {})
        ident = entity.get("description", {}).get("identifier")
        if ident:
            entities.add(ident)
            schemas = {}
            groups = {"components": entity.get("components", {}),
                      **{"component_groups/" + name: value for name, value in entity.get("component_groups", {}).items()}}
            for name, components in groups.items():
                inventory = components.get("minecraft:inventory")
                if inventory is not None:
                    schemas[name] = inventory
            if schemas:
                storage[ident] = schemas
    persisted = set()
    for p in sorted((bp / "scripts").rglob("*.js")):
        text = p.read_text(encoding="utf-8", errors="replace")
        persisted.update(persisted_literals(text))
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
        "storage_components": storage,
        "persisted_key_literals": sorted(persisted),
        "packs": packs,
    }


def load_retirements() -> dict[str, dict]:
    if not RETIREMENTS.exists():
        return {}
    doc = json.loads(RETIREMENTS.read_text(encoding="utf-8"))
    return {row["id"]: row for row in doc.get("retired", [])}




def check(lock: dict, now: dict) -> tuple[list[str], list[str]]:
    errors, additions = [], []
    retired = load_retirements()

    def removed(kind: str, ident: str):
        row = retired.get(ident)
        if not row:
            errors.append(f"{kind} removed without retirement: {ident}")
            return
        missing = [k for k in ("replacement", "migration", "reason", "world_rewrite_receipt") if not row.get(k)]
        if missing:
            errors.append(f"{kind} retirement for {ident} lacks {', '.join(missing)}")
            return
        mode = row["migration"]
        if mode not in ("runtime", "offline-rewrite"):
            errors.append(f"{kind} {ident}: unsupported migration {mode!r}")
            return
        path = Path(row["world_rewrite_receipt"])
        if path.is_absolute() or ".." in path.parts:
            errors.append(f"{kind} {ident}: receipt must be a repository-relative evidence file")
            return
        try:
            raw = (ROOT / path).read_bytes()
            if hashlib.sha256(raw).hexdigest() != row.get("receipt_sha256"):
                raise ValueError("receipt SHA256 missing or mismatched")
            proof = json.loads(raw)
            if proof.get("id") != ident or proof.get("replacement") != row["replacement"]:
                raise ValueError("receipt identity/replacement mismatch")
            if proof.get("migration") != mode or proof.get("staging_first_load") is not True or proof.get("staging_restart") is not True:
                raise ValueError("staging first-load/restart or migration evidence missing")
            before, after = proof["counts_before"], proof["counts_after"]
            old, new = before[ident], row["replacement"]
            if not all(isinstance(n, int) and not isinstance(n, bool) and n >= 0
                       for n in (old, before.get(new, 0), after[ident], after[new])):
                raise ValueError("invalid migration counts")
            if after[ident] != 0 or after[new] != before.get(new, 0) + old:
                raise ValueError("migration counts do not preserve contents")
            if mode == "runtime":
                # A comment mentioning an ID is not evidence. Require a bound
                # migration source and separately reviewed scenario proof.
                migration = Path(row.get("migration_source", ""))
                if migration.is_absolute() or ".." in migration.parts or migration.suffix != ".js":
                    raise ValueError("invalid migration source")
                source = ROOT / migration
                bp, _ = runtime_roots()
                if not source.resolve().is_relative_to((bp / "scripts").resolve()):
                    raise ValueError("migration source outside runtime scripts")
                if hashlib.sha256(source.read_bytes()).hexdigest() != proof.get("migration_source_sha256"):
                    raise ValueError("migration source is not bound to receipt")
                if proof.get("scenario_passed") is not True or not proof.get("reviewed_pr"):
                    raise ValueError("runtime migration requires reviewed scenario evidence")
                from js_tokens import tokens, literal
                if ident not in {literal(t) for t in tokens(source.read_text())}:
                    raise ValueError("old identifier absent from executable migration tokens")
        except (OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(f"{kind} {ident}: invalid migration evidence: {exc}")

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
                removed("block state", f"{ident}#state:{name}")
                continue
            lost = sorted(set(values) - set(cur[name]))
            if lost:
                for value in lost:
                    removed("block state value", f"{ident}#state:{name}={value}")
            additions += [f"block {ident} state {name} value added: {v}"
                          for v in sorted(set(cur[name]) - set(values))]
        for name in sorted(set(cur) - set(states)):
            additions.append(f"block {ident} state added: {name}")
    additions += [f"block added: {i}" for i in sorted(set(now["blocks"]) - set(lock.get("blocks", {})))]

    for ident, schemas in lock.get("storage_components", {}).items():
        current = now.get("storage_components", {}).get(ident, {})
        for group, previous in schemas.items():
            present = current.get(group)
            if present is None or present != previous:
                # Fail closed for any storage schema change, including changed
                # ownership/type and moved component groups, not only shrinking.
                removed("storage component", f"{ident}#inventory:{group}")
    for ident, schemas in now.get("storage_components", {}).items():
        for group in schemas:
            if group not in lock.get("storage_components", {}).get(ident, {}):
                additions.append(f"storage component added: {ident}#{group}")

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
    for ident, schemas in now.get("storage_components", {}).items():
        previous = out.setdefault("storage_components", {}).setdefault(ident, {})
        for group, inventory in schemas.items():
            previous.setdefault(group, inventory)
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
