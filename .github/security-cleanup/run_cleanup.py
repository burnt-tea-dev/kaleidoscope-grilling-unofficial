"""Publish locally reviewed clean Git objects from a scoped GitHub Actions job.

No repository source or user-provided hook is executed. The job uses only its
own repository's short-lived GITHUB_TOKEN. Plans contain clean objects and ref
name digests, never private replacement preimages or authentication material.
"""
from __future__ import annotations
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parent
STAGING = "refs/heads/security/history-cleanup-20261017"
LAST_RESULT = {}


class CleanupError(RuntimeError):
    pass


def digest(data):
    return hashlib.sha256(data).hexdigest()


def name_digest(ref):
    return digest(ref.encode("utf8", "surrogateescape"))


def command(args, *, cwd=None, input=None, token=None):
    env = os.environ.copy()
    for key in list(env):
        if key.startswith("GIT_"):
            del env[key]
    env.update({"GIT_TERMINAL_PROMPT": "0", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull,
                "GIT_NO_REPLACE_OBJECTS": "1", "GIT_NO_LAZY_FETCH": "1"})
    # A private per-process Git config entry keeps the credential out of the
    # command line, repository configuration, output and cleanup payload.
    if token:
        encoded = base64.b64encode(("x-access-token:" + token).encode()).decode()
        env.update({"GIT_CONFIG_COUNT": "2", "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
                    "GIT_CONFIG_VALUE_0": "AUTHORIZATION: basic " + encoded,
                    "GIT_CONFIG_KEY_1": "credential.helper", "GIT_CONFIG_VALUE_1": ""})
    if args and args[0] == "git":
        args = ["git", "-c", "core.hooksPath=" + os.devnull, "-c", "core.fsmonitor=false", *args[1:]]
    p = subprocess.run(args, cwd=cwd, input=input, env=env,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode:
        # Git stderr may contain original private branch labels. Do not emit it.
        message = p.stderr.lower()
        if b"permission" in message or b"denied" in message or b"403" in message:
            code = "GIT_PERMISSION_DENIED"
        elif b"protected" in message or b"rule" in message:
            code = "GIT_REPOSITORY_RULE_REJECTED"
        elif b"stale info" in message or b"fetch first" in message:
            code = "GIT_LEASE_REJECTED"
        else:
            code = "GIT_OPERATION_FAILED"
        raise CleanupError(code)
    return p.stdout


def remote_refs(url):
    result = {}
    for row in command(["git", "ls-remote", "--heads", "--tags", url]).splitlines():
        oid, ref = row.decode("utf8", "surrogateescape").split("\t", 1)
        if ref.endswith("^{}"):
            continue
        if not re.fullmatch(r"[0-9a-f]{40}", oid):
            raise CleanupError("INVALID_REMOTE_OBJECT_ID")
        result[ref] = oid
    return result


def check_baseline(plan, remote, staging_sha):
    if remote.get(STAGING) != staging_sha:
        raise CleanupError("STAGING_REF_CHANGED")
    actual = {name_digest(k): v for k, v in remote.items() if k != STAGING}
    expected = {x["name_sha256"]: x["sha"] for x in plan["baseline_refs"]}
    if len(expected) != len(plan["baseline_refs"]) or actual != expected:
        raise CleanupError("CONCURRENT_REMOTE_REF_CHANGE")


def push_specifications(plan, remote):
    by_digest = {name_digest(k): k for k in remote if k != STAGING}
    leases, specs = [], []
    planned_targets = set()
    for update in plan["updates"]:
        old_ref = by_digest.get(update["old_name_sha256"])
        if old_ref is None or remote[old_ref] != update["old_sha"]:
            raise CleanupError("UPDATE_PREIMAGE_MISMATCH")
        new_ref = update["new_ref"]
        new_sha = update["new_sha"]
        if not new_ref.startswith(("refs/heads/", "refs/tags/")) or new_ref == STAGING:
            raise CleanupError("INVALID_UPDATE_NAMESPACE")
        if not re.fullmatch(r"[0-9a-f]{40}", new_sha) or new_ref in planned_targets:
            raise CleanupError("INVALID_UPDATE_TARGET")
        planned_targets.add(new_ref)
        leases.append(f"--force-with-lease={old_ref}:{update['old_sha']}")
        if new_ref != old_ref:
            if new_ref in remote:
                raise CleanupError("RENAME_TARGET_ALREADY_EXISTS")
            leases.append(f"--force-with-lease={new_ref}:")
            specs.append(":" + old_ref)
        specs.append(new_sha + ":" + new_ref)
    return leases, specs


def expected_result(plan, remote):
    result = {k: v for k, v in remote.items() if k != STAGING}
    by_digest = {name_digest(k): k for k in result}
    for update in plan["updates"]:
        result.pop(by_digest[update["old_name_sha256"]])
        result[update["new_ref"]] = update["new_sha"]
    return result


def delete_staging(repository, mirror, token, expected_sha):
    # A Git lease closes the race between reading and deleting the staging ref.
    command(["git", "-C", str(mirror), "push", "--atomic", "--porcelain",
             f"--force-with-lease={STAGING}:{expected_sha}", "origin", ":" + STAGING], token=token)
    if STAGING in remote_refs("https://github.com/" + repository + ".git"):
        raise CleanupError("STAGING_DELETE_VERIFICATION_FAILED")


def assemble_pack(plan, target):
    hasher = hashlib.sha256()
    total = 0
    with target.open("wb") as stream:
        for part in plan["pack"]["parts"]:
            name = part["path"]
            if not re.fullmatch(r"payload/clean-objects\.pack\.part[0-9]{3}", name):
                raise CleanupError("INVALID_PACK_PART_PATH")
            value = (HERE / name).read_bytes()
            if len(value) != part["bytes"] or digest(value) != part["sha256"]:
                raise CleanupError("PACK_PART_INTEGRITY_FAILED")
            stream.write(value)
            hasher.update(value)
            total += len(value)
    if total != plan["pack"]["bytes"] or hasher.hexdigest() != plan["pack"]["sha256"]:
        raise CleanupError("PACK_INTEGRITY_FAILED")


def assemble_auxiliary_files(plan):
    for entry in plan.get("auxiliary_files", []):
        target = entry["path"]
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", target) or target.endswith(".py"):
            raise CleanupError("INVALID_AUXILIARY_TARGET")
        chunks = []
        for part in entry["parts"]:
            name = part["path"]
            if not re.fullmatch(r"payload/aux-[A-Za-z0-9_.-]+\.part[0-9]{3}", name):
                raise CleanupError("INVALID_AUXILIARY_PART")
            data = (HERE / name).read_bytes()
            if len(data) != part["bytes"] or digest(data) != part["sha256"]:
                raise CleanupError("AUXILIARY_PART_INTEGRITY_FAILED")
            chunks.append(data)
        content = b"".join(chunks)
        if len(content) != entry["bytes"] or digest(content) != entry["sha256"]:
            raise CleanupError("AUXILIARY_FILE_INTEGRITY_FAILED")
        (HERE / target).write_bytes(content)


def main():
    global LAST_RESULT
    plan = json.loads((HERE / "plan.json").read_text())
    repository = plan["repository"]
    token = os.environ.get("GH_TOKEN", "")
    stage_sha = os.environ.get("GITHUB_SHA", "")
    authorized = {
        "burnt-tea-dev/kaleidoscope-grilling-unofficial": "1377218440",
        "burnt-tea-dev/kaleidoscope-tavern-unofficial": "1377171148",
        "burnt-tea-dev/kaleidoscope-world-liquor-unofficial": "1385218112",
    }
    if (repository not in authorized
            or str(plan.get("repository_id", "")) != authorized.get(repository)
            or os.environ.get("GITHUB_REPOSITORY_ID") != authorized.get(repository)):
        raise CleanupError("REPOSITORY_NOT_AUTHORIZED")
    if (os.environ.get("GITHUB_REPOSITORY") != repository or os.environ.get("GITHUB_REF") != STAGING
            or os.environ.get("GITHUB_EVENT_NAME") != "push" or not token
            or not re.fullmatch(r"[0-9a-f]{40}", stage_sha)):
        raise CleanupError("EXECUTION_CONTEXT_MISMATCH")
    if plan.get("backup_verified") is not True or plan.get("local_verification_passed") is not True:
        raise CleanupError("LOCAL_REVIEW_GATE_MISSING")
    url = "https://github.com/" + repository + ".git"
    original = remote_refs(url)
    final_refs = {row["ref"]: row["sha"] for row in plan["final_refs"]}
    actual_without_stage = {k: v for k, v in original.items() if k != STAGING}
    resumed_git = actual_without_stage == final_refs and original.get(STAGING) == stage_sha
    if not resumed_git:
        check_baseline(plan, original, stage_sha)
        if expected_result(plan, original) != final_refs:
            raise CleanupError("FINAL_REF_PLAN_INCONSISTENT")
    expected = final_refs
    result = {"repository": repository, "git_published": False, "git_verified": False,
              "updated_refs": len(plan["updates"]), "staging_deleted": False}
    LAST_RESULT = result
    with tempfile.TemporaryDirectory(prefix="authorized-history-cleanup-") as td:
        work = Path(td)
        mirror = work / "repository.git"
        command(["git", "clone", "--mirror", "--quiet", url, str(mirror)])
        command(["git", "-C", str(mirror), "config", "remote.origin.mirror", "false"])
        if not resumed_git:
            pack = work / "clean-objects.pack"
            assemble_pack(plan, pack)
            command(["git", "-C", str(mirror), "index-pack", "--stdin"], input=pack.read_bytes())
        for row in plan["updates"]:
            command(["git", "-C", str(mirror), "cat-file", "-e", row["new_sha"]])
        # Validate every new tip's complete reachable object graph before pushing.
        if plan["updates"]:
            command(["git", "-C", str(mirror), "fsck", "--full", "--no-reflogs", "--no-dangling",
                     *[row["new_sha"] for row in plan["updates"]]])
        latest = remote_refs(url)
        if not resumed_git:
            check_baseline(plan, latest, stage_sha)
            leases, specs = push_specifications(plan, latest)
            if specs:
                command(["git", "-C", str(mirror), "push", "--atomic", "--porcelain", *leases,
                         "origin", *specs], token=token)
        elif {k: v for k, v in latest.items() if k != STAGING} != expected or latest.get(STAGING) != stage_sha:
            raise CleanupError("CONCURRENT_REMOTE_REF_CHANGE")
        result["git_published"] = True
        actual = {k: v for k, v in remote_refs(url).items() if k != STAGING}
        if actual != expected:
            raise CleanupError("POST_PUSH_REF_VERIFICATION_FAILED")
        result["git_verified"] = True
        result["final_default_head"] = actual["refs/heads/" + plan["default_branch"]]
        # Unpin the pre-clean staging ancestry as soon as Git publication has
        # been verified. A later attachment failure must not keep it reachable.
        delete_staging(repository, mirror, token, stage_sha)
        result["staging_deleted"] = True
        if plan.get("surface_plan"):
            assemble_auxiliary_files(plan)
            import execute_surface_cleanup
            result["surfaces"] = execute_surface_cleanup.run_cleanup(
                repository=repository, plan_path=HERE / plan["surface_plan"],
                token=token, workdir=work / "surfaces")
        print("CLEANUP_RESULT_JSON=" + json.dumps(result, sort_keys=True), flush=True)
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            Path(summary).write_text("## Repository cleanup completed\n\n"
                                     + f"Verified {len(plan['updates'])} reference updates.\n\n"
                                     + "The temporary cleanup branch was removed. Read-only pull-request references and external copies require separate handling.\n")


if __name__ == "__main__":
    try:
        main()
    except CleanupError as exc:
        print("CLEANUP_PARTIAL_RESULT_JSON=" + json.dumps(LAST_RESULT, sort_keys=True), flush=True)
        print("CLEANUP_ERROR=" + str(exc), flush=True)
        sys.exit(1)
    except Exception as exc:
        # Exception text and stack locals may include sensitive source material.
        if type(exc).__name__ == "SurfaceCleanupError":
            LAST_RESULT["surfaces"] = getattr(exc, "receipt", {})
            print("CLEANUP_PARTIAL_RESULT_JSON=" + json.dumps(LAST_RESULT, sort_keys=True), flush=True)
            print("CLEANUP_ERROR=SURFACES_" + str(getattr(exc, "code", "FAILED")), flush=True)
            sys.exit(1)
        print("CLEANUP_PARTIAL_RESULT_JSON=" + json.dumps(LAST_RESULT, sort_keys=True), flush=True)
        print("CLEANUP_ERROR=UNEXPECTED_" + type(exc).__name__, flush=True)
        sys.exit(1)
