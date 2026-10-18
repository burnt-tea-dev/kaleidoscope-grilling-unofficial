"""Growth ratchet: the known anti-patterns of this repository may only shrink.

Each metric counts one pattern that produced the current patch-over-patch
state (per-version verifiers, version-prefixed modules, extra global event
handlers, committed build outputs, ...). A pull request may lower any count;
it may never raise one. After a cleanup lowers a count, run ``tighten`` so the
lower number becomes the new ceiling.

    python3 tools/guards/growth_ratchet.py check
    python3 tools/guards/growth_ratchet.py tighten   # only ever lowers ceilings
    python3 tools/guards/growth_ratchet.py report    # print counts, never fails

Raising a ceiling requires editing growth-ratchet.json by hand with a written
justification in the same pull request; reviewers must reject that unless the
REBUILD-PLAN phase explicitly allows it.

Standard library only.
"""
from __future__ import annotations

import json
import re
import sys
import subprocess

from js_tokens import code
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CEILINGS = Path(__file__).with_name("growth-ratchet.json")
BASELINE = json.loads((ROOT / "baseline.json").read_text())
BP = ROOT / BASELINE["runtime"]["BP"]
RP = ROOT / BASELINE["runtime"]["RP"]
if not BP.is_dir() or not RP.is_dir():
    raise ValueError("canonical runtime directories missing")


def files(base: Path, pattern: str) -> list[Path]:
    return [p for p in base.glob(pattern) if p.is_file()] if base.exists() else []


def regex_count(paths, rx: str) -> int:
    r = re.compile(rx)
    return sum(len(r.findall(p.read_text(encoding="utf-8", errors="replace"))) for p in paths)


def committed_artifacts():
    raw = subprocess.check_output(["git", "ls-files", "-z", "--", "artifacts/"], cwd=ROOT)
    return len([p for p in raw.split(b"\0") if p and (ROOT / p.decode()).is_file()])


def js_count(paths, rx):
    pattern = re.compile(rx)
    return sum(len(pattern.findall(code(p.read_text(encoding="utf-8")))) for p in paths)


def scripts() -> list[Path]:
    return files(BP / "scripts", "**/*.js")


def tests() -> list[Path]:
    out = []
    for base in (ROOT / "development", ROOT / "tools", ROOT / "tests"):
        out += files(base, "**/test_*.mjs") + files(base, "**/test_*.py") + files(base, "**/*.test.mjs")
    return out


METRICS = {
    # --- verification bureaucracy -------------------------------------------------
    "per_version_verifiers": lambda: len(files(ROOT / "development/gameplay_core", "**/verify_a*.py")),
    "augment_layer_scripts": lambda: len(files(ROOT / "development/gameplay_core", "**/augment_a*.py")),
    "version_layer_tools": lambda: len([p for p in files(ROOT / "tools", "**/*.py")
                                        if re.match(r"(test_)?g\d+_", p.name)]),
    "tests_total": lambda: len(tests()),
    # Tests that slice function bodies out of main.js source text and eval them
    # freeze code shape and block refactoring.
    "source_text_slicing_tests": lambda: sum(
        1 for p in tests()
        if re.search(r"indexOf\(['\"]function ['\"]\s*\+|readFileSync\([^)]*main\.js", p.read_text(encoding="utf-8", errors="replace"))
    ),
    # --- documentation and committed outputs --------------------------------------
    "status_docs": lambda: len(files(ROOT / "docs", "STATUS-*.md")),
    "release_note_docs": lambda: len(files(ROOT / "docs", "RELEASE-NOTES-*.md")),
    "docs_files_total": lambda: len(files(ROOT / "docs", "**/*")),
    "committed_artifact_files": committed_artifacts,
    "history_tree_files": lambda: len(files(ROOT / "history", "**/*")),
    # --- runtime architecture -----------------------------------------------------
    "script_modules": lambda: len(scripts()),
    "version_prefixed_script_modules": lambda: len([p for p in scripts() if re.match(r"a\d+_", p.name)]),
    "global_block_interact_handlers": lambda: js_count(scripts(), r"beforeEvents\.playerInteractWithBlock\.subscribe"),
    "global_break_handlers": lambda: js_count(scripts(), r"Events\.playerBreakBlock\.subscribe"),
    "global_explosion_handlers": lambda: js_count(scripts(), r"beforeEvents\.explosion\.subscribe"),
    "script_event_listeners": lambda: js_count(scripts(), r"scriptEventReceive\.subscribe"),
    "run_intervals": lambda: js_count(scripts(), r"system\.runInterval\("),
    "vanilla_entity_overrides": lambda: len([p for p in files(BP / "entities", "*.json")
                                             if '"minecraft:player"' in p.read_text(encoding="utf-8", errors="replace")
                                             or re.search(r'"identifier"\s*:\s*"minecraft:', p.read_text(encoding="utf-8", errors="replace"))]),
    # --- content surface ----------------------------------------------------------
    "item_definitions": lambda: len(files(BP / "items", "**/*.json")),
    "shadow_route_items": lambda: len([p for p in files(BP / "items", "**/*.json")
                                       if re.search(r"_(native_plain|java_three_alt)\.", p.name)]),
    "rp_geometry_files": lambda: len(files(RP / "models", "**/*.json")),
    "version_prefixed_model_dirs": lambda: len([p for p in (RP / "models/entity").iterdir()
                                                if p.is_dir() and re.match(r"a\d+_", p.name)]) if (RP / "models/entity").exists() else 0,
    "largest_geometry_kib": lambda: max((p.stat().st_size for p in files(RP / "models", "**/*.json")), default=0) // 1024,
    "rp_total_mib": lambda: sum(p.stat().st_size for p in files(RP, "**/*")) // (1024 * 1024),
}


def measure() -> dict[str, int]:
    return {name: int(fn()) for name, fn in METRICS.items()}


def main(argv=None) -> int:
    args = list(argv if argv is not None else sys.argv[1:]) or ["check"]
    cmd = args[0]
    global CEILINGS
    if "--ceilings" in args:  # CI passes the base branch file so a PR cannot raise its own ceiling
        CEILINGS = Path(args[args.index("--ceilings") + 1])
        if cmd != "check":
            print("--ceilings is only valid with check", file=sys.stderr)
            return 2
    now = measure()
    if cmd == "report" or (cmd == "tighten" and not CEILINGS.exists()):
        if cmd == "tighten":
            CEILINGS.write_text(json.dumps({"schema": 1, "ceilings": now}, indent=1) + "\n", encoding="utf-8")
        for k, v in now.items():
            print(f"{k:36} {v}")
        return 0
    if not CEILINGS.exists():
        print("growth-ratchet.json missing", file=sys.stderr)
        return 1
    doc = json.loads(CEILINGS.read_text(encoding="utf-8"))
    ceil = doc["ceilings"]
    bad, lowered = [f"{k}: ceiling has no measured metric" for k in sorted(set(ceil) - set(now))], []
    for k, v in now.items():
        if k not in ceil:
            bad.append(f"{k}: new metric without a ceiling (add it with tighten on main)")
        elif v > ceil[k]:
            bad.append(f"{k}: {v} > ceiling {ceil[k]}")
        elif v < ceil[k]:
            lowered.append(f"{k}: {ceil[k]} -> {v}")
    if cmd == "tighten":
        if bad:
            print("Cannot tighten while a metric exceeds its ceiling:\n  " + "\n  ".join(bad), file=sys.stderr)
            return 1
        doc["ceilings"] = {k: min(ceil.get(k, v), v) for k, v in now.items()}
        CEILINGS.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")
        print("tightened:", ", ".join(lowered) or "nothing to lower")
        return 0
    if bad:
        print("GROWTH RATCHET FAILURE: this change grows a known anti-pattern.", file=sys.stderr)
        for line in bad:
            print("  -", line, file=sys.stderr)
        print("See docs/REBUILD-PLAN.md §2.2 禁止模式. Fix the design instead of raising a ceiling.",
              file=sys.stderr)
        return 1
    if lowered:
        print("Shrunk (run tighten to lock in):", "; ".join(lowered))
    print("growth ratchet OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
