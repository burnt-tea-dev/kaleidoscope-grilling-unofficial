#!/usr/bin/env python3
"""Compare private, manually observed restart samples; never open a world DB.

Standard library only. Reads two bounded JSON files and emits a value-free
comparison on stdout. Exit 0: equal supplied observations; 1: differences;
2: invalid/incomplete inputs. No result establishes client or staging acceptance.
"""
from __future__ import annotations

import argparse
from datetime import datetime
import json
from pathlib import Path
import re
import sys
from uuid import UUID

KINDS = frozenset(("grill", "plate", "rack", "bottle", "vat", "oil"))
MAX_BYTES = 1024 * 1024


class InputError(ValueError):
    """Only constant error codes may leave the process."""


def require(condition, code):
    if not condition:
        raise InputError(code)


def exact_keys(value, keys):
    require(type(value) is dict and set(value) == set(keys), "SCHEMA_FIELDS")


def opaque_id(value):
    require(type(value) is str, "OPAQUE_ID")
    try:
        require(str(UUID(value)) == value, "OPAQUE_ID")
    except (ValueError, AttributeError):
        raise InputError("OPAQUE_ID") from None


def timestamp(value):
    require(type(value) is str and re.fullmatch(
        r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?Z", value), "CAPTURE_TIME")
    try:
        return datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError:
        raise InputError("CAPTURE_TIME") from None


def canonical(value):
    # Preserve JSON types (True != 1, 1 != 1.0), list order and lore formatting.
    return json.dumps(value, sort_keys=True, ensure_ascii=True, allow_nan=False,
                      separators=(",", ":"))


def validate(doc, phase):
    exact_keys(doc, ("schema", "evidence_kind", "world_ref", "run_ref", "capture_ref",
                     "phase", "captured_at", "pack_set_sha256", "checks", "samples"))
    require(type(doc["schema"]) is int and doc["schema"] == 1, "SCHEMA_VERSION")
    require(doc["evidence_kind"] in ("manual_staging", "synthetic_fixture"), "EVIDENCE_KIND")
    require(doc["phase"] == phase, "PHASE")
    for field in ("world_ref", "run_ref", "capture_ref"):
        opaque_id(doc[field])
    timestamp(doc["captured_at"])
    require(type(doc["pack_set_sha256"]) is str and
            re.fullmatch(r"[0-9a-f]{64}", doc["pack_set_sha256"]), "PACK_SET_DIGEST")
    exact_keys(doc["checks"], ("joined", "normal_gameplay", "normal_restart_completed"))
    require(all(type(v) is bool for v in doc["checks"].values()), "CHECK_TYPE")
    require(doc["checks"]["joined"] and doc["checks"]["normal_gameplay"], "GAMEPLAY_NOT_OBSERVED")
    require(doc["checks"]["normal_restart_completed"] == (phase == "after"), "RESTART_NOT_OBSERVED")
    require(type(doc["samples"]) is list and 6 <= len(doc["samples"]) <= 60, "SAMPLE_COVERAGE")
    samples = {}
    locators = set()
    kinds = set()
    for sample in doc["samples"]:
        exact_keys(sample, ("sample_id", "kind", "locator_ref", "evidence_ref", "state", "items"))
        kind = sample["kind"]
        require(type(kind) is str and kind in KINDS, "SAMPLE_KIND")
        sid = sample["sample_id"]
        require(type(sid) is str and re.fullmatch(kind + r"-[0-9]{2}", sid), "SAMPLE_ID")
        require(sid not in samples, "DUPLICATE_SAMPLE")
        opaque_id(sample["locator_ref"])
        opaque_id(sample["evidence_ref"])
        require(sample["locator_ref"] not in locators, "DUPLICATE_LOCATOR")
        locators.add(sample["locator_ref"])
        require(type(sample["state"]) is dict and bool(sample["state"]), "STATE_NOT_OBSERVED")
        require(type(sample["items"]) is list and len(sample["items"]) <= 256, "ITEMS_SCHEMA")
        require(phase == "after" or kind == "vat" or bool(sample["items"]), "EMPTY_GAMEPLAY_SAMPLE")
        slots = set()
        for item in sample["items"]:
            exact_keys(item, ("slot", "type_id", "amount", "lore", "properties", "name"))
            slot = item["slot"]
            require(type(slot) is int and 0 <= slot <= 255 and slot not in slots, "ITEM_SLOT")
            slots.add(slot)
            require(type(item["type_id"]) is str and
                    re.fullmatch(r"[a-z0-9_.-]+:[a-z0-9_./-]+", item["type_id"]), "ITEM_ID")
            require(type(item["amount"]) is int and 1 <= item["amount"] <= 255, "ITEM_AMOUNT")
            require(type(item["lore"]) is list and len(item["lore"]) <= 128 and
                    all(type(line) is str for line in item["lore"]), "ITEM_LORE")
            require(type(item["properties"]) is dict and type(item["name"]) is str, "ITEM_METADATA")
        samples[sid] = sample
        kinds.add(kind)
    require(kinds == KINDS, "SAMPLE_COVERAGE")
    return samples


def compare(before, after):
    left, right = validate(before, "before"), validate(after, "after")
    for field in ("evidence_kind", "world_ref", "run_ref", "pack_set_sha256"):
        require(before[field] == after[field], "PAIR_CONTEXT_MISMATCH")
    require(before["capture_ref"] != after["capture_ref"], "CAPTURE_REUSED")
    require(timestamp(before["captured_at"]) < timestamp(after["captured_at"]), "CAPTURE_ORDER")
    require(set(left) == set(right), "SAMPLE_SET_MISMATCH")
    # One photo may support multiple samples within one capture. Every after
    # photo must still be new: borrowing another before sample's ref is reuse.
    before_evidence = {sample["evidence_ref"] for sample in left.values()}
    after_evidence = {sample["evidence_ref"] for sample in right.values()}
    require(before_evidence.isdisjoint(after_evidence), "CAPTURE_EVIDENCE_REUSED")
    rows = []
    for sid in sorted(left):
        a, b = left[sid], right[sid]
        require(a["kind"] == b["kind"] and a["locator_ref"] == b["locator_ref"], "SAMPLE_IDENTITY_MISMATCH")
        differences = []
        if canonical(a["state"]) != canonical(b["state"]):
            differences.append({"field": "state"})
        ai, bi = ({item["slot"]: item for item in s["items"]} for s in (a, b))
        for slot in sorted(set(ai) | set(bi)):
            if slot not in ai or slot not in bi:
                differences.append({"field": "item_presence", "slot": slot})
                continue
            for field in ("type_id", "amount", "lore", "properties", "name"):
                if canonical(ai[slot][field]) != canonical(bi[slot][field]):
                    differences.append({"field": field, "slot": slot})
        rows.append({"sample_id": sid, "equal": not differences, "differences": differences})
    equal = all(row["equal"] for row in rows)
    return {"schema": 1, "task": "T1.8", "evidence_kind": before["evidence_kind"],
            "result": "equal_supplied_observations" if equal else "differences_found",
            "sample_count": len(rows), "samples": rows,
            "provenance": ("synthetic_fixture_no_world" if before["evidence_kind"] == "synthetic_fixture"
                           else "operator_declared_not_independently_verified"),
            "staging_acceptance": "not_established", "client": False, "production_ready": False}


def unique_object(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, "DUPLICATE_JSON_KEY")
        out[key] = value
    return out


def reject_constant(_):
    raise InputError("NONFINITE_JSON_NUMBER")


def read_sample(path):
    # Bounded read, no DB bindings, server operations, network or output files.
    with path.open("rb") as stream:
        raw = stream.read(MAX_BYTES + 1)
    require(len(raw) <= MAX_BYTES, "INPUT_TOO_LARGE")
    doc = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=unique_object,
                     parse_constant=reject_constant)
    canonical(doc)  # Also rejects numeric overflow such as 1e999.
    return doc


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    args = parser.parse_args(argv)
    try:
        result = compare(read_sample(args.before), read_sample(args.after))
        status = 0 if result["result"] == "equal_supplied_observations" else 1
    except (OSError, ValueError, TypeError, RecursionError, OverflowError):
        # Never echo paths, JSON fragments, exception messages or field values.
        result = {"schema": 1, "task": "T1.8", "result": "invalid_or_incomplete_input",
                  "staging_acceptance": "not_established", "client": False,
                  "production_ready": False}
        status = 2
    print(json.dumps(result, ensure_ascii=True, sort_keys=True))
    return status


if __name__ == "__main__":
    sys.exit(main())
