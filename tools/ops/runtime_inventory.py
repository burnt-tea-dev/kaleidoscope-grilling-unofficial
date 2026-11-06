"""Collect the current runtime catalog for an explicitly requested world census.

This is a read-only inventory. It is not a saved-ID lock or a CI gate.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/guards"))
from js_tokens import persisted_literals
from jsonc import strip_jsonc

BASELINE = ROOT / "baseline.json"


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
        # The canonical key registry may include external API keys such as
        # Cookery's unnamespaced `kc_oil_count`; ordinary identifier catalogs
        # still require a namespace before a literal counts as persisted.
        persisted.update(persisted_literals(
            text,
            include_bare_registry_keys=p.name == "persist_keys.js" and p.parent.name == "core",
        ))
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

