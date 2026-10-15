from __future__ import annotations

from pathlib import Path
import argparse
import hashlib
import json
import os
import zipfile
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"tools"))
from baseline_gate import check as baseline_check,read as baseline_read
from vibrant_gate import check_paths, check_archive
from verify_current import generic_gate, verify_compiled_exact

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / "projects/grilling/gameplay_core"
BP = PROJECT / "behavior_pack"
RP = PROJECT / "resource_pack"

ZIP_TIME = (2020, 1, 1, 0, 0, 0)


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def publication_artifact_suffix(version, root=ROOT):
    request_path = root / '.github/release-request.json'
    if not request_path.is_file():
        return 'Review'
    request = load(request_path)
    if request.get('prerelease') is not False:
        return 'Review'
    from publish_test_release import release_classification
    suffix, _ = release_classification(request)
    assert request['version'] == version, 'Stable publication request is for another runtime version'
    return suffix


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def tree_hash(roots: list[tuple[str, Path]]) -> str:
    h = hashlib.sha256()
    for prefix, root in roots:
        for path in sorted((p for p in root.rglob("*") if p.is_file() and not p.name.startswith(".")), key=lambda p: p.relative_to(root).parts):
            rel = f"{prefix}/{path.relative_to(root).as_posix()}"
            h.update(rel.encode("utf-8"))
            h.update(b"\0")
            h.update(hashlib.sha256(path.read_bytes()).digest())
    return h.hexdigest()


def add_file(z: zipfile.ZipFile, source: Path, arcname: str) -> None:
    info = zipfile.ZipInfo(arcname, ZIP_TIME)
    # Canonical archives were frozen on Linux; retain its ZIP host metadata
    # on Windows runners too, rather than zipfile's platform-dependent default.
    info.create_system = 3
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    z.writestr(info, source.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)


def compiled_pack(source: Path) -> Path:
    manifest = load(source / "manifest.json")
    uuid = manifest["header"]["uuid"]
    dist = PROJECT / "builds/dist"
    matches = [p.parent for p in dist.rglob("manifest.json") if load(p).get("header", {}).get("uuid") == uuid]
    assert len(matches) == 1, (source.name, matches)
    return matches[0]


def make_zip(path: Path, roots: list[tuple[str, Path]], *, exclude_project_builds: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w") as z:
        for prefix, root in roots:
            for source in sorted((p for p in root.rglob("*") if p.is_file()), key=lambda p: p.relative_to(root).parts):
                rel = source.relative_to(root)
                if source.name.startswith("."):
                    continue
                if exclude_project_builds and ("builds" in rel.parts or ".bridge" in rel.parts):
                    continue
                arc = f"{prefix}/{rel.as_posix()}" if prefix else rel.as_posix()
                add_file(z, source, arc)
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None, path


def main() -> None:
    parser = argparse.ArgumentParser(description="Create deterministic review artifacts from the canonical Grilling runtime")
    parser.add_argument("--output-dir", default="artifacts/review")
    parser.add_argument("--compiled", action="store_true", help="Verify a Dash export and package it; default exports the canonical runtime directly")
    args = parser.parse_args()

    # Standalone packaging must reject a lost declaration or an old Dash build,
    # even when the caller bypasses the usual CI verifier steps.
    baseline_check(baseline_read(ROOT/"baseline.json"),release=True)
    generic_gate()
    source_manifests = check_paths(BP, RP)
    if args.compiled:verify_compiled_exact()
    bp_manifest, rp_manifest = source_manifests
    version = tuple(bp_manifest["header"]["version"])
    assert version == tuple(rp_manifest["header"]["version"])
    label = ".".join(map(str, version))
    suffix = publication_artifact_suffix('A' + label)
    stem = f"Kaleidoscope_Grilling_A{label}_{suffix}"
    out = ROOT / args.output_dir

    compiled_bp = compiled_pack(BP) if args.compiled else BP
    compiled_rp = compiled_pack(RP) if args.compiled else RP
    mcaddon = out / f"{stem}.mcaddon"
    brproject = out / f"{stem}.brproject"
    sums = out / "SHA256SUMS.txt"
    report = out / "build-report.json"

    make_zip(mcaddon, [("behavior_pack", compiled_bp), ("resource_pack", compiled_rp)])
    check_archive(mcaddon, source_manifests)
    baseline_check(baseline_read(ROOT/"baseline.json"),archive=mcaddon)
    make_zip(brproject, [("", PROJECT)], exclude_project_builds=True)

    payload = {
        "schema": 1,
        "version": f"A{label}",
        "git_sha": os.environ.get("GITHUB_SHA") or os.environ.get("GIT_COMMIT") or "unknown",
        "source_tree_sha256": tree_hash([("behavior_pack", BP), ("resource_pack", RP)]),
        "mcaddon": {"path": mcaddon.relative_to(ROOT).as_posix(), "sha256": sha256(mcaddon)},
        "brproject": {"path": brproject.relative_to(ROOT).as_posix(), "sha256": sha256(brproject)},
        "deterministic_zip_timestamp": "2020-01-01T00:00:00",
        "vibrant_manifest_and_export_checked": True,
        "compiled_export_verified": args.compiled,
        "minecraft_tested": False,
        "bds_tested": False,
        "client_visuals_tested": False,
    }
    report.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    sums.write_text(
        f"{payload['mcaddon']['sha256']}  {mcaddon.name}\n"
        f"{payload['brproject']['sha256']}  {brproject.name}\n",
        encoding="utf-8", newline="\n",
    )
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
