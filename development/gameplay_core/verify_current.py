from __future__ import annotations

from pathlib import Path
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from vibrant_gate import check_pair
from verification_session import SESSION_ENV

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / "projects/grilling/gameplay_core"
BP = PROJECT / "behavior_pack"
RP = PROJECT / "resource_pack"
DEV = Path(__file__).resolve().parent

EXPECTED = {
    "bp_header_uuid": "c68005c5-23ff-54e8-a3ff-da6349ad43c2",
    "bp_data_uuid": "dcf70052-c592-56e3-84d2-2a9b86abe7ab",
    "bp_script_uuid": "d0bb6818-8187-5d20-8e1f-a2ab7b517795",
    "rp_header_uuid": "bbbd2d60-52e5-53a6-8b9a-c09b0f516389",
    "rp_module_uuid": "e7d592db-f4a0-53ce-8b0a-cab7a0cee8d7",
    "cookery_bp_uuid": "d322809c-a51e-4742-bfc4-16d3c1491c9d",
    "cookery_rp_uuid": "8e2c6318-2f5f-4907-aad0-31d10610e405",
}

VERIFIERS = {
    (2, 7, 60): "verify_a2760.py",
    (2, 7, 61): "verify_a2761.py",
    (2, 7, 62): "verify_a2762.py",
    (2, 7, 63): "verify_a2763.py",
    (2, 7, 64): "verify_a2764.py",
    (2, 7, 65): "verify_a2765.py",
    (2, 7, 66): "verify_a2766.py",
    (2, 7, 67): "verify_a2767.py",
    (2, 7, 68): "verify_a2768.py",
    (2, 7, 69): "verify_a2769.py",
    (2, 7, 70): "verify_a2770.py",
    (2, 7, 71): "verify_a2771.py",
    (2, 8, 0): "verify_a280.py",
    (2, 8, 1): "verify_a281.py",
    (2, 8, 3): "verify_a283.py",
    (2, 8, 4): "verify_a284.py",
    (2, 8, 5): "verify_a285.py",
    (2, 8, 6): "verify_a286.py",
    (2, 8, 7): "verify_a287.py",
    (2, 8, 10): "verify_a2810.py",
    (2, 8, 11): "verify_a2811.py",
    (2, 8, 12): "verify_a2812.py",
    (2, 8, 13): "verify_a2812.py",
    (2, 8, 14): "verify_a2812.py",
    (2, 8, 15): "verify_a2812.py",
    (2, 8, 16): "verify_a2812.py",
    (2, 8, 17): "verify_a2812.py",
    (2, 8, 18): "verify_a2818.py",
    (2, 8, 19): "verify_a2819.py",
    (2, 8, 20): "verify_a2820.py",
    (2, 8, 21): "verify_a2821.py",
    (2, 8, 25): "verify_a2825.py",
    (2, 8, 26): "verify_a2826.py",
    (2, 8, 27): "verify_a2827.py",
    (2, 8, 28): "verify_a2828.py",
    (2, 8, 29): "verify_a2829.py",
    (2, 8, 30): "verify_a2830.py",
    (2, 8, 31): "verify_a2831.py",
    (2, 8, 32): "verify_a2832.py",
    (2, 8, 34): "verify_a2834.py",
    (2, 8, 33): "verify_a2833.py",
    (2, 8, 35): "verify_a2835.py",
    (2, 8, 36): "verify_a2836.py",
    (2, 8, 37): "verify_a2837.py",
    (2, 8, 38): "verify_a2837.py",
    (2, 8, 39): "verify_a2839.py",
    (2, 8, 40): "verify_a2840.py",
    (2, 8, 41): "verify_a2841.py",
    (2, 8, 42): "verify_a2842.py",
    (2, 8, 43): "verify_a2843.py",
    (2, 8, 44): "verify_a2844.py",
    (2, 8, 45): "verify_a2845.py",
    (2, 8, 46): "verify_a2846.py",
    (2, 8, 47): "verify_a2847.py",
    (2, 8, 48): "verify_a2848.py",
    (2, 8, 49): "verify_a2849.py",
    (2, 8, 50): "verify_a2850.py",
    (2, 8, 51): "verify_a2851.py",
    (2, 8, 52): "verify_a2852.py",
    (2, 8, 53): "verify_a2853.py",
    (2, 8, 54): "verify_a2854.py",
    (2, 8, 55): "verify_a2855.py",
    (2, 8, 56): "verify_a2856.py",
    (2, 8, 57): "verify_a2857.py",
    (2, 8, 58): "verify_a2858.py",
    (2, 8, 59): "verify_a2859.py",
    (2, 8, 60): "verify_a2860.py",
    (2, 8, 61): "verify_a2861.py",
    (2, 8, 62): "verify_a2862.py",
    (2, 8, 65): "verify_a2865.py",
    (2, 8, 66): "verify_a2866.py",
    (2, 8, 67): "verify_a2867.py",
    (2, 8, 68): "verify_a2868.py",
    (2, 8, 69): "verify_a2869.py",
    (2, 8, 72): "verify_a2872.py",
    (2, 8, 73): "verify_a2873.py",
    (2, 8, 74): "verify_a2874.py",
    (2, 8, 78): "verify_a2878.py",
    (2, 8, 79): "verify_a2879.py",
    (2, 8, 81): "verify_a2881.py",
    (2, 8, 82): "verify_a2882.py",
    (2, 8, 83): "verify_a2883.py",
    (2, 8, 84): "verify_a2884.py",
    (2, 8, 85): "verify_a2885.py",
    (2, 8, 86): "verify_a2886.py",
    (2, 8, 94): "verify_a2894.py",
    (2, 8, 100): "verify_a28100.py",
    (2, 8, 101): "verify_a28101.py",
    (2, 8, 102): "verify_a28102.py",
    (2, 8, 103): "verify_a28102.py",
    (2, 8, 104): "verify_a28104.py",
    (2, 8, 105): "verify_a28105.py",
    (2, 8, 106): "verify_a28106.py",
    (2, 8, 107): "verify_a28107.py",
    (2, 8, 108): "verify_a28108.py",
    (2, 8, 109): "verify_a28109.py",
    (2, 8, 110): "verify_a28110.py",
    (2, 8, 111): "verify_a28111.py",
    (2, 8, 113): "verify_a28113.py",
    (2, 8, 114): "verify_a28114.py",
    (2, 8, 115): "verify_a28115.py",
    (2, 8, 116): "verify_a28116.py",
    (2, 8, 117): "verify_a28117.py",
    (2, 8, 118): "verify_a28118.py",
    (2, 8, 119): "verify_a28119.py",
    (2, 8, 120): "verify_a28120.py",
    (2, 8, 121): "verify_a28121.py",
    (2, 8, 122): "verify_a28122.py",
    (2, 8, 123): "verify_a28123.py",
    (2, 8, 124): "verify_a28124.py",
    (2, 8, 125): "verify_a28125.py",
    (2, 8, 126): "verify_a28126.py",
    (2, 8, 8): "verify_a288_local.py",
}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def module_by_type(manifest: dict, kind: str) -> dict:
    rows = [m for m in manifest.get("modules", []) if m.get("type") == kind]
    assert len(rows) == 1, (kind, rows)
    return rows[0]


def dependency_by_uuid(manifest: dict, uuid: str) -> dict:
    rows = [d for d in manifest.get("dependencies", []) if d.get("uuid") == uuid]
    assert len(rows) == 1, (uuid, rows)
    return rows[0]


def verify_relative_imports() -> int:
    pattern = re.compile(r"(?:from\s+|import\s*)['\"](\.[^'\"]+)['\"]")
    checked = 0
    for path in sorted((BP / "scripts").rglob("*.js")):
        text = path.read_text(encoding="utf-8")
        for spec in pattern.findall(text):
            target = (path.parent / spec).resolve()
            assert target.is_file(), f"missing relative import: {path.relative_to(ROOT)} -> {spec}"
            checked += 1
    return checked


def generic_gate() -> tuple[int, int, int, int]:
    for path in PROJECT.rglob("*.json"):
        load(path)

    bp = load(BP / "manifest.json")
    rp = load(RP / "manifest.json")
    bp_version = tuple(bp["header"]["version"])
    rp_version = tuple(rp["header"]["version"])
    assert bp_version == rp_version, (bp_version, rp_version)
    if bp_version >= (2, 7, 68):
        check_pair(bp, rp)

    assert bp["header"]["uuid"] == EXPECTED["bp_header_uuid"]
    assert rp["header"]["uuid"] == EXPECTED["rp_header_uuid"]

    data_module = module_by_type(bp, "data")
    script_module = module_by_type(bp, "script")
    resource_module = module_by_type(rp, "resources")
    assert data_module["uuid"] == EXPECTED["bp_data_uuid"]
    assert script_module["uuid"] == EXPECTED["bp_script_uuid"]
    assert resource_module["uuid"] == EXPECTED["rp_module_uuid"]
    assert tuple(data_module["version"]) == bp_version
    assert tuple(script_module["version"]) == bp_version
    assert tuple(resource_module["version"]) == rp_version

    rp_dep = dependency_by_uuid(bp, EXPECTED["rp_header_uuid"])
    assert tuple(rp_dep["version"]) == rp_version
    host_ids=("5df753c9-3436-4fba-87f1-a2da3651cfcf","f1d333ca-2d6b-4566-8005-e6c309816324") if bp_version >= (2,8,72) else (EXPECTED["cookery_bp_uuid"],EXPECTED["cookery_rp_uuid"])
    host_version=(1,6,0) if bp_version >= (2,8,72) else (1,0,8)
    cookery_bp = dependency_by_uuid(bp, host_ids[0])
    cookery_rp = dependency_by_uuid(rp, host_ids[1])
    assert tuple(cookery_bp["version"]) == host_version
    assert tuple(cookery_rp["version"]) == host_version

    entry = BP / script_module["entry"]
    assert entry.is_file(), entry
    imports = verify_relative_imports()

    config = load(PROJECT / "config.json")
    assert config["type"] == "minecraftBedrock"
    assert config["namespace"] == "kaleidoscope_grilling"
    assert config["packs"] == {"behaviorPack": "./behavior_pack", "resourcePack": "./resource_pack"}

    active_legacy = sorted((ROOT / ".github/workflows").glob("gameplay-core-a*.yml"))
    archived_legacy = sorted((ROOT / "docs/legacy_workflows").glob("gameplay-core-a*.yml"))
    assert not active_legacy, f"retired gameplay workflows reactivated: {active_legacy}"
    assert len(archived_legacy) == 65, f"expected 65 archived gameplay workflows, got {len(archived_legacy)}"
    assert (ROOT / ".github/workflows/gameplay-core.yml").is_file()

    return bp_version[0], bp_version[1], bp_version[2], imports


def verify_compiled_exact() -> None:
    dist = PROJECT / "builds/dist"
    for name, source in (("behavior_pack", BP), ("resource_pack", RP)):
        manifest = load(source / "manifest.json")
        uuid = manifest["header"]["uuid"]
        matches = [p.parent for p in dist.rglob("manifest.json") if load(p).get("header", {}).get("uuid") == uuid]
        assert len(matches) == 1, (name, matches)
        target = matches[0]
        source_files = {
            p.relative_to(source).as_posix(): p
            for p in source.rglob("*")
            if p.is_file() and not p.name.startswith(".")
        }
        target_files = {
            p.relative_to(target).as_posix(): p
            for p in target.rglob("*")
            if p.is_file() and not p.name.startswith(".")
        }
        assert set(source_files) == set(target_files), {
            "pack": name,
            "missing": sorted(set(source_files) - set(target_files)),
            "extra": sorted(set(target_files) - set(source_files)),
        }
        for rel, path in source_files.items():
            compiled = target_files[rel]
            if path.suffix == ".json":
                assert load(path) == load(compiled), rel
            else:
                assert path.read_bytes() == compiled.read_bytes(), rel


def source_snapshot() -> dict:
    """Bind functional results to this HEAD and all non-output checkout inputs."""
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    paths = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT,
    ).decode("utf-8").split("\0")
    # Published archives and compiler output are not verifier inputs. Everything
    # else, including untracked nonignored source, fixtures and CI config, is bound.
    outputs = ("artifacts/", "builds/", "dist/", "projects/grilling/gameplay_core/builds/")
    # Pinned Dash 0.13.0 writes this build cache under each project root.
    # Do not exclude .bridge broadly: extensions/compiler settings are inputs.
    dash_caches = {
        f"{prefix}.bridge/.dash.{mode}.json"
        for prefix in ("", "projects/grilling/gameplay_core/")
        for mode in ("production", "development")
    }
    entries = []
    for relative in sorted(set(paths)):
        if not relative or relative.startswith(outputs) or relative in dash_caches:
            continue
        path = ROOT / relative
        entries.append([relative, hashlib.sha256(path.read_bytes()).hexdigest()])
    digest = hashlib.sha256(json.dumps(entries, separators=(",", ":")).encode("utf-8")).hexdigest()
    return {"head": head, "input_sha256": digest, "input_files": len(entries)}


def require_source_validation(path: Path) -> dict:
    receipt = load(path)
    assert receipt.get("schema_version") == 1, "unsupported source validation receipt"
    assert receipt.get("scope") == "canonical-functional-source", "receipt is not functional source validation"
    assert receipt.get("source") == source_snapshot(), "source/HEAD changed since functional validation"
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description="Canonical verifier for the current Grilling gameplay core")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--compiled", action="store_true", help="run full functional checks and compare the real Dash output")
    mode.add_argument("--compiled-only", action="store_true", help="compare Dash output after validating a prior functional receipt")
    parser.add_argument("--write-source-validation", type=Path, help="write a functional source receipt outside the checkout after success")
    parser.add_argument("--source-validation", type=Path, help="receipt required by --compiled-only for the same HEAD and source")
    args = parser.parse_args()

    if args.compiled_only:
        if args.source_validation is None or args.write_source_validation is not None:
            parser.error("--compiled-only requires --source-validation and cannot write a functional receipt")
        require_source_validation(args.source_validation)
        major, minor, patch, imports = generic_gate()
        verify_compiled_exact()
        # Detect source changes during comparison as well as before it.
        require_source_validation(args.source_validation)
        print(
            f"Canonical compiled export gate PASS: {major}.{minor}.{patch}; "
            f"relative imports checked={imports}; same HEAD/source functional receipt verified; "
            "functional suite not repeated"
        )
        return
    if args.source_validation is not None:
        parser.error("--source-validation is only valid with --compiled-only")
    source_before = None
    if args.write_source_validation is not None:
        if args.write_source_validation.resolve().is_relative_to(ROOT.resolve()):
            parser.error("write the source validation receipt outside the checkout")
        # A failed rerun must not leave an older PASS available to later steps.
        args.write_source_validation.unlink(missing_ok=True)
        source_before = source_snapshot()

    major, minor, patch, imports = generic_gate()
    subprocess.run([sys.executable, str(DEV / "verify_visual_refs.py")], check=True)
    version = (major, minor, patch)
    verifier = VERIFIERS.get(version)
    if verifier is None:
        known = ", ".join(".".join(map(str, v)) for v in sorted(VERIFIERS))
        raise SystemExit(
            f"No release verifier registered for {major}.{minor}.{patch}. "
            f"Add the new version verifier to verify_current.py before changing canonical source. Known: {known}"
        )

    command = [sys.executable, str(DEV / verifier)]
    if args.compiled:
        command.append("--compiled")
    environment = dict(os.environ)
    environment.pop(SESSION_ENV, None)
    # Only this current source-receipt run has the existing immutable-input
    # boundary. Standalone/full historical verifiers retain every command.
    if source_before is not None and verifier in {
        "verify_a28114.py", "verify_a28115.py", "verify_a28116.py",
        "verify_a28117.py", "verify_a28118.py", "verify_a28119.py", "verify_a28120.py", "verify_a28121.py", "verify_a28122.py", "verify_a28123.py", "verify_a28124.py",
    }:
        environment[SESSION_ENV] = verifier
    subprocess.run(command, check=True, env=environment)
    if args.compiled:
        verify_compiled_exact()
    if args.write_source_validation is not None:
        assert source_before == source_snapshot(), "source/HEAD changed during functional validation"
        receipt = {
            "schema_version": 1,
            "scope": "canonical-functional-source",
            "version": list(version),
            "source": source_before,
        }
        args.write_source_validation.parent.mkdir(parents=True, exist_ok=True)
        args.write_source_validation.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(
        f"Canonical gameplay-core gate PASS: {major}.{minor}.{patch}; "
        f"relative imports checked={imports}; compiled={args.compiled}"
    )


if __name__ == "__main__":
    main()
