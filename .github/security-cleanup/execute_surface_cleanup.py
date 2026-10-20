"""Execute a version 2 repository-scoped GitHub surface cleanup plan.

Only this module's caller chooses whether to execute it. Importing performs no
network requests. All replacements and all remote preconditions are checked
before any write. The receipt contains identifiers and status codes, never API
error bodies, download URLs, source contents, logs, or credentials.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import time
from dataclasses import dataclass
from typing import Any
import urllib.error
import urllib.parse
import urllib.request


API_HOST = "api.github.com"
UPLOAD_HOST = "uploads.github.com"
API_VERSION = "2026-03-10"
KINDS = ("replace_release_assets", "delete_actions_artifacts", "delete_run_logs", "patch_release_bodies")
ID_KEYS = dict(zip(KINDS, ("asset_id", "artifact_id", "run_id", "release_id")))
HEX64 = re.compile(r"[0-9a-f]{64}\Z")
REPOSITORY_IDS = {
    "burnt-tea-dev/kaleidoscope-grilling-unofficial": 1377218440,
    "burnt-tea-dev/kaleidoscope-tavern-unofficial": 1377171148,
    "burnt-tea-dev/kaleidoscope-world-liquor-unofficial": 1385218112,
}
REPOSITORY = re.compile(r"burnt-tea-dev/kaleidoscope-(?:grilling|tavern|world-liquor)-unofficial\Z")


class SurfaceCleanupError(Exception):
    """A deliberately nonverbose error safe for public CI receipts."""

    def __init__(self, code: str, http_status: int | None = None):
        self.code = code if re.fullmatch(r"[A-Z][A-Z0-9_]{0,79}", code) else "INTERNAL_ERROR"
        self.http_status = http_status if isinstance(http_status, int) else None
        self.receipt: dict[str, Any] | None = None
        super().__init__(self.code)


def fail(code: str, http_status: int | None = None):
    raise SurfaceCleanupError(code, http_status)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def positive_id(value: Any) -> int:
    if type(value) is not int or value <= 0:
        fail("INVALID_PLAN_ID")
    return value


def exact_bytes(data: bytes, digest: str, size: int, code: str):
    if len(data) != size or sha(data) != digest:
        fail(code)


@dataclass
class Response:
    status: int
    headers: dict[str, str]
    body: bytes = b""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class UrllibTransport:
    """No redirects, cookies, credential discovery, or error-body reads."""

    def __init__(self):
        self.opener = urllib.request.build_opener(_NoRedirect())

    def request(self, method, url, headers, data=None, *, read_body=True,
                max_bytes=8 * 1024 * 1024):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        response = None
        try:
            try:
                response = self.opener.open(req, timeout=60)
            except urllib.error.HTTPError as exc:
                response = exc
            status = response.code
            response_headers = {k.lower(): v for k, v in response.headers.items()}
            body = b""
            if read_body and 200 <= status < 300:
                body = response.read(max_bytes + 1)
                if len(body) > max_bytes:
                    fail("RESPONSE_SIZE_LIMIT")
            return Response(status, response_headers, body)
        except SurfaceCleanupError:
            raise
        except Exception:
            # Do not stringify exceptions: they can contain signed URLs.
            raise SurfaceCleanupError("NETWORK_ERROR") from None
        finally:
            if response is not None:
                response.close()


class GitHubClient:
    def __init__(self, repository: str, token: str, transport=None, *,
                 pace_writes=None, clock=None, sleeper=None):
        if not REPOSITORY.fullmatch(repository):
            fail("INVALID_REPOSITORY")
        if not isinstance(token, str) or not token or "\n" in token or "\r" in token:
            fail("MISSING_OR_INVALID_TOKEN")
        self.repository = repository
        self._token = token
        self.transport = transport or UrllibTransport()
        self._pace_writes = transport is None if pace_writes is None else bool(pace_writes)
        self._clock = clock or time.monotonic
        self._sleep = sleeper or time.sleep
        self._last_mutation_at = self._clock()

    def _url(self, path: str, host=API_HOST):
        prefix = "/repos/" + self.repository
        if (host not in (API_HOST, UPLOAD_HOST) or
                not (path == prefix or path.startswith(prefix + "/")) or
                "#" in path or "\\" in path or ".." in path.split("?")[0].split("/")):
            fail("UNSAFE_API_TARGET")
        return "https://" + host + path

    def _request(self, method, path, *, host=API_HOST, data=None,
                 content_type=None, binary=False, read_body=True,
                 max_bytes=8 * 1024 * 1024):
        if host == UPLOAD_HOST and method != "POST":
            fail("UNSAFE_UPLOAD_METHOD")
        headers = {
            "Authorization": "Bearer " + self._token,
            "Accept": "application/octet-stream" if binary else "application/vnd.github+json",
            "X-GitHub-Api-Version": API_VERSION,
            "User-Agent": "audited-public-surface-cleanup/1",
        }
        if content_type:
            headers["Content-Type"] = content_type
        if data is not None:
            headers["Content-Length"] = str(len(data))
        url = self._url(path, host)
        mutating = method in ("POST", "PUT", "PATCH", "DELETE")
        if mutating and self._pace_writes:
            delay = 1.1 - (self._clock() - self._last_mutation_at)
            if delay > 0:
                self._sleep(delay)
        try:
            result = self.transport.request(method, url, headers, data,
                                            read_body=read_body, max_bytes=max_bytes)
        finally:
            if mutating:
                self._last_mutation_at = self._clock()
        if result.status in (401, 403):
            fail("PERMISSION_DENIED", result.status)
        return result

    def json(self, method, path, *, allowed=(200,), host=API_HOST,
             data=None, content_type=None):
        result = self._request(method, path, host=host, data=data,
                               content_type=content_type)
        if 300 <= result.status < 400:
            fail("UNEXPECTED_API_REDIRECT", result.status)
        if result.status not in allowed:
            fail("API_STATUS", result.status)
        if not result.body:
            return result.status, None
        try:
            return result.status, json.loads(result.body)
        except Exception:
            raise SurfaceCleanupError("INVALID_API_JSON") from None

    @staticmethod
    def _download_url(url: str):
        try:
            parsed = urllib.parse.urlsplit(url)
            host = parsed.hostname or ""
            # GitHub release assets and Actions' documented Azure storage.
            allowed = host in {
                "github.com", API_HOST, "release-assets.githubusercontent.com",
                "objects.githubusercontent.com", "github-releases.githubusercontent.com",
            } or (host.endswith(".blob.core.windows.net") and
                  re.fullmatch(r"[a-z0-9]+\.blob\.core\.windows\.net", host))
            if (parsed.scheme != "https" or not allowed or parsed.username is not None or
                    parsed.password is not None or parsed.port not in (None, 443) or parsed.fragment):
                fail("UNSAFE_DOWNLOAD_REDIRECT")
        except SurfaceCleanupError:
            raise
        except Exception:
            raise SurfaceCleanupError("UNSAFE_DOWNLOAD_REDIRECT") from None
        return url

    def download(self, path: str, expected_size: int):
        if not 0 <= expected_size <= 1024 * 1024 * 1024:
            fail("DOWNLOAD_SIZE_LIMIT")
        result = self._request("GET", path, binary=True, max_bytes=expected_size)
        visited = set()
        for _ in range(6):
            if result.status == 200:
                if len(result.body) != expected_size:
                    fail("DOWNLOAD_SIZE_MISMATCH")
                return result.body
            if result.status not in (301, 302, 303, 307, 308):
                fail("DOWNLOAD_STATUS", result.status)
            location = self._download_url(result.headers.get("location", ""))
            if location in visited:
                fail("DOWNLOAD_REDIRECT_LOOP")
            visited.add(location)
            # Fresh headers: NEVER forward Authorization or API credentials.
            result = self.transport.request(
                "GET", location,
                {"Accept": "application/octet-stream", "User-Agent": "audited-public-surface-cleanup/1"},
                read_body=True, max_bytes=expected_size)
            if result.status in (401, 403):
                fail("PERMISSION_DENIED", result.status)
        fail("DOWNLOAD_REDIRECT_LIMIT")

    def probe_logs(self, path: str):
        # Deliberately do not follow the signed redirect or read log bytes.
        result = self._request("GET", path, read_body=False)
        if result.status in (200, 302):
            return True
        if result.status == 404:
            return False
        fail("LOG_PROBE_STATUS", result.status)


def _sidecar(base: Path, build: dict, key: str) -> Path:
    name = build.get(key)
    if (not isinstance(name, str) or not name or Path(name).name != name or
            name in (".", "..") or "\\" in name):
        fail("INVALID_BUILD_REFERENCE")
    result = base / name
    if not result.is_file() or result.is_symlink():
        fail("MISSING_BUILD_INPUT")
    expected = build.get(key + "_sha256")
    if not isinstance(expected, str) or not HEX64.fullmatch(expected) or sha(result.read_bytes()) != expected:
        fail("BUILD_INPUT_HASH_MISMATCH")
    return result


def _module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Executor:
    def __init__(self, repository, plan_path, token, workdir, *, dry_run=False, client=None):
        if not isinstance(repository, str) or not REPOSITORY.fullmatch(repository):
            fail("INVALID_REPOSITORY")
        environment_repo = os.environ.get("GITHUB_REPOSITORY")
        if environment_repo and environment_repo != repository:
            fail("REPOSITORY_ENV_MISMATCH")
        environment_token = os.environ.get("GITHUB_TOKEN")
        if environment_token and token is not None and environment_token != token:
            fail("TOKEN_ENV_MISMATCH")
        self.repository = repository
        self.base = Path(plan_path).resolve().parent
        self.workdir = Path(workdir)
        self.workdir.mkdir(parents=True, exist_ok=True)
        self.receipt_path = self.workdir / "surface_cleanup_receipt.json"
        self.dry_run = dry_run
        try:
            self.plan = json.loads(Path(plan_path).read_text())
        except Exception:
            raise SurfaceCleanupError("INVALID_PLAN_JSON") from None
        self.actions = self._validate_plan()
        self.plan_hash = sha(json.dumps({"repository": repository, "actions": self.actions,
                                        "build": self.plan.get("build", {})},
                                       sort_keys=True, separators=(",", ":")).encode())
        prior = self._prior_receipt()
        self.receipt = {"schema_version": 1, "repository": repository,
                        "scoped_plan_sha256": self.plan_hash, "dry_run": dry_run,
                        "status": "initializing", "items": []}
        self.rows = {}
        for kind in KINDS:
            for action in self.actions[kind]:
                item_id = action[ID_KEYS[kind]]
                key = (kind, item_id)
                row = {"kind": kind, ID_KEYS[kind]: item_id, "status": "pending"}
                if kind == "replace_release_assets":
                    row.update(release_id=action["release_id"], expected_new_sha256=action["new_sha256"])
                    old = prior.get(key, {})
                    for flag in ("delete_attempted", "original_deleted"):
                        if old.get(flag) is True:
                            row[flag] = True
                self.rows[key] = row
                self.receipt["items"].append(row)
        self.client = client
        if client is not None and getattr(client, "repository", repository) != repository:
            fail("CLIENT_REPOSITORY_MISMATCH")
        if self.client is None and any(self.actions.values()):
            self.client = GitHubClient(repository, token or environment_token)
        self.member_map = self.recovery = self.rebuilder = self.recoverer = None
        self.prepared = {}

    def _validate_plan(self):
        if self.plan.get("repository_id") != REPOSITORY_IDS[self.repository]:
            fail("PLAN_REPOSITORY_ID_MISMATCH")
        if self.plan.get("schema_version") != 2:
            fail("UNSUPPORTED_PLAN_SCHEMA")
        result = {}
        names = set()
        for kind in KINDS:
            values = self.plan.get(kind, [])
            if not isinstance(values, list):
                fail("INVALID_PLAN_ACTIONS")
            result[kind] = []
            seen = set()
            for action in values:
                if not isinstance(action, dict):
                    fail("INVALID_PLAN_ACTION")
                if action.get("repository") != self.repository:
                    continue
                item_id = positive_id(action.get(ID_KEYS[kind]))
                if item_id in seen:
                    fail("DUPLICATE_PLAN_ID")
                seen.add(item_id)
                a = dict(action)
                if kind in ("replace_release_assets", "delete_actions_artifacts"):
                    if not isinstance(a.get("name"), str) or not a["name"] or any(c in a["name"] for c in "\r\n/\\"):
                        fail("INVALID_ASSET_NAME")
                    if not HEX64.fullmatch(a.get("original_sha256", "")):
                        fail("INVALID_PLAN_DIGEST")
                    if type(a.get("original_size")) is not int or a["original_size"] < 0:
                        fail("INVALID_PLAN_SIZE")
                    if not isinstance(a.get("original_updated_at"), str):
                        fail("INVALID_PLAN_TIMESTAMP")
                if kind == "replace_release_assets":
                    positive_id(a.get("release_id"))
                    if not HEX64.fullmatch(a.get("new_sha256", "")):
                        fail("INVALID_PLAN_DIGEST")
                    if type(a.get("new_size")) is not int or a["new_size"] < 0:
                        fail("INVALID_PLAN_SIZE")
                    if a.get("kind") not in ("release_asset", "release_checksum", "release_text"):
                        fail("INVALID_REPLACEMENT_KIND")
                    if not isinstance(a.get("tag"), str) or not a["tag"]:
                        fail("INVALID_RELEASE_TAG")
                    if not isinstance(a.get("content_type"), str) or any(c in a["content_type"] for c in "\r\n"):
                        fail("INVALID_CONTENT_TYPE")
                    if a.get("label") is not None and not isinstance(a.get("label"), str):
                        fail("INVALID_ASSET_LABEL")
                    label = a.get("label") or ""
                    if any(c in label for c in "\r\n"):
                        fail("INVALID_ASSET_LABEL")
                    name_key = (a["release_id"], a["name"])
                    if name_key in names:
                        fail("DUPLICATE_RELEASE_NAME")
                    names.add(name_key)
                    if a["kind"] == "release_text":
                        self._literal(a, body=False)
                if kind == "delete_actions_artifacts":
                    positive_id(a.get("run_id"))
                if kind == "delete_run_logs":
                    if not re.fullmatch(r"[0-9a-f]{40}", a.get("original_run_head_sha", "")):
                        fail("INVALID_RUN_HEAD")
                    if not isinstance(a.get("original_run_updated_at"), str):
                        fail("INVALID_PLAN_TIMESTAMP")
                if kind == "patch_release_bodies":
                    if not isinstance(a.get("tag"), str) or not a["tag"]:
                        fail("INVALID_RELEASE_TAG")
                    if not isinstance(a.get("original_updated_at"), str):
                        fail("INVALID_PLAN_TIMESTAMP")
                    for key in ("original_body_sha256", "new_body_sha256"):
                        if not HEX64.fullmatch(a.get(key, "")):
                            fail("INVALID_PLAN_DIGEST")
                    for key in ("original_body_size", "new_body_size"):
                        if type(a.get(key)) is not int or a[key] < 0:
                            fail("INVALID_PLAN_SIZE")
                    metadata = a.get("expected_release_metadata")
                    if not isinstance(metadata, dict) or set(metadata) != {"name", "draft", "prerelease"}:
                        fail("INVALID_RELEASE_METADATA_PLAN")
                    if type(metadata["draft"]) is not bool or type(metadata["prerelease"]) is not bool:
                        fail("INVALID_RELEASE_METADATA_PLAN")
                    if metadata["name"] is not None and not isinstance(metadata["name"], str):
                        fail("INVALID_RELEASE_METADATA_PLAN")
                    self._literal(a, body=True)
                result[kind].append(a)
        result["replace_release_assets"].sort(key=lambda a: (a["release_id"], a["kind"] == "release_checksum", a["asset_id"]))
        return result

    @staticmethod
    def _literal(a, *, body):
        key = "clean_body_content_b64" if body else "clean_content_b64"
        digest_key = "new_body_sha256" if body else "new_sha256"
        size_key = "new_body_size" if body else "new_size"
        try:
            data = base64.b64decode(a[key], validate=True)
            data.decode("utf-8")
        except Exception:
            raise SurfaceCleanupError("INVALID_CLEAN_UTF8_LITERAL") from None
        exact_bytes(data, a[digest_key], a[size_key], "CLEAN_LITERAL_HASH_MISMATCH")
        return data

    def _prior_receipt(self):
        if not self.receipt_path.exists():
            return {}
        try:
            prior = json.loads(self.receipt_path.read_text())
        except Exception:
            raise SurfaceCleanupError("INVALID_PRIOR_RECEIPT") from None
        if (prior.get("schema_version") != 1 or prior.get("repository") != self.repository or
                prior.get("scoped_plan_sha256") != self.plan_hash):
            fail("PRIOR_RECEIPT_SCOPE_MISMATCH")
        return {(r.get("kind"), r.get(ID_KEYS.get(r.get("kind"), "_"))): r
                for r in prior.get("items", []) if isinstance(r, dict)}

    def save(self):
        temporary = self.receipt_path.with_suffix(".json.tmp")
        encoded = (json.dumps(self.receipt, indent=2, sort_keys=True) + "\n").encode()
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "wb") as target:
            target.write(encoded)
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, self.receipt_path)

    def path(self, suffix=""):
        return "/repos/" + self.repository + suffix

    def get(self, suffix, *, optional=False):
        status, data = self.client.json("GET", self.path(suffix), allowed=(200, 404) if optional else (200,))
        if status == 404:
            return None
        if not isinstance(data, dict):
            fail("UNEXPECTED_API_SHAPE")
        return data

    def pages(self, suffix, collection=None):
        result = []
        for page in range(1, 101):
            _, data = self.client.json("GET", self.path(suffix + "?per_page=100&page=" + str(page)))
            rows = data.get(collection) if collection and isinstance(data, dict) else data
            if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
                fail("UNEXPECTED_API_SHAPE")
            result.extend(rows)
            if len(rows) < 100:
                return result
        fail("API_PAGINATION_LIMIT")

    def _release(self, a):
        release = self.get("/releases/" + str(a["release_id"]))
        if release.get("id") != a["release_id"] or release.get("tag_name") != a["tag"]:
            fail("RELEASE_IDENTITY_CHANGED")
        if type(release.get("immutable")) is not bool:
            fail("RELEASE_IMMUTABILITY_UNKNOWN")
        return release

    def _asset_matches(self, meta, a, *, original):
        expected_size = a["original_size"] if original else a["new_size"]
        if (type(meta.get("id")) is not int or meta["id"] <= 0 or
                meta.get("name") != a["name"] or meta.get("size") != expected_size or
                meta.get("state") != "uploaded" or
                (meta.get("label") or "") != (a.get("label") or "") or
                meta.get("content_type") != a["content_type"]):
            fail("ASSET_METADATA_CHANGED")
        if original and (meta["id"] != a["asset_id"] or meta.get("updated_at") != a["original_updated_at"]):
            fail("ASSET_METADATA_CHANGED")

    def _asset_bytes(self, meta, a, *, original):
        self._asset_matches(meta, a, original=original)
        size = a["original_size"] if original else a["new_size"]
        expected = a["original_sha256"] if original else a["new_sha256"]
        data = self.client.download(self.path("/releases/assets/" + str(meta["id"])), size)
        exact_bytes(data, expected, size, "ASSET_BYTES_CHANGED" if original else "CLEAN_ASSET_VERIFICATION_FAILED")
        return data

    def _same_name(self, a):
        rows = self.pages("/releases/" + str(a["release_id"]) + "/assets")
        matches = [r for r in rows if r.get("name") == a["name"]]
        if len(matches) > 1:
            fail("AMBIGUOUS_RELEASE_NAME")
        return matches[0] if matches else None

    def _release_state(self, a):
        release = self._release(a)
        same = self._same_name(a)
        # The freshly fetched release-assets list provides the full asset
        # metadata. Reuse that exact-ID record instead of spending another
        # request on the same representation. If the original name/ID is not
        # present, independently check its ID to detect a renamed original.
        original = (same if same is not None and same.get("id") == a["asset_id"] else
                    self.get("/releases/assets/" + str(a["asset_id"]), optional=True))
        if original is not None:
            if same is None or same.get("id") != a["asset_id"]:
                fail("RELEASE_ASSET_MEMBERSHIP_CHANGED")
            data = self._asset_bytes(original, a, original=True)
            if release["immutable"]:
                fail("RELEASE_IS_IMMUTABLE")
            return "replace", data, None
        if same is not None:
            if same.get("id") == a["asset_id"]:
                fail("RELEASE_ASSET_READ_RACE")
            self._asset_bytes(same, a, original=False)
            return "already_clean", None, same["id"]
        row = self.rows[("replace_release_assets", a["asset_id"])]
        if not (row.get("delete_attempted") or row.get("original_deleted")):
            fail("MISSING_ORIGINAL_WITHOUT_RECEIPT")
        if release["immutable"]:
            fail("RELEASE_IS_IMMUTABLE")
        return "restore", None, None

    def _load_build(self):
        if self.member_map is not None:
            return
        build = self.plan.get("build", {})
        map_path = _sidecar(self.base, build, "member_map")
        contents = map_path.read_bytes()
        if map_path.name.endswith(".gz"):
            contents = gzip.decompress(contents)
        self.member_map = json.loads(contents)
        self.rebuilder = _module(_sidecar(self.base, build, "script"), "_surface_zip_builder")
        self.recovery = json.loads(_sidecar(self.base, build, "recovery_metadata").read_text())
        self.recoverer = _module(_sidecar(self.base, build, "recovery_script"), "_surface_zip_recovery")

    def _build(self, a, original=None):
        if a["kind"] == "release_text":
            data = self._literal(a, body=False)
        else:
            self._load_build()
        if a["kind"] == "release_checksum":
            spec = self.member_map.get("checksums", {}).get(a["original_sha256"])
            if not spec or spec.get("asset_id") != a["asset_id"] or spec.get("new_sha256") != a["new_sha256"]:
                fail("CHECKSUM_NOT_IN_BUILD_MAP")
            data = base64.b64decode(spec["clean_content_b64"], validate=True)
        elif a["kind"] == "release_asset":
            spec = self.member_map.get("archives", {}).get(a["original_sha256"])
            if not spec or spec.get("asset_id") != a["asset_id"] or spec.get("new_sha256") != a["new_sha256"]:
                fail("ARCHIVE_NOT_IN_BUILD_MAP")
            data = (self.rebuilder.rebuild_archive(original, self.member_map) if original is not None else
                    self.recoverer.recover_archive(a["original_sha256"], self.member_map, self.recovery))
        exact_bytes(data, a["new_sha256"], a["new_size"], "REPLACEMENT_BUILD_MISMATCH")
        target = self.workdir / ("clean_asset_" + str(a["asset_id"]))
        target.write_bytes(data)
        target.chmod(0o600)
        return target

    def _body_state(self, a):
        release = self._release(a)
        for key, expected in a["expected_release_metadata"].items():
            if release.get(key) != expected:
                fail("RELEASE_BODY_METADATA_CHANGED")
        body = release.get("body")
        if body is not None and not isinstance(body, str):
            fail("INVALID_RELEASE_BODY_RESPONSE")
        data = (body or "").encode("utf-8")
        if len(data) == a["new_body_size"] and sha(data) == a["new_body_sha256"]:
            return "already_clean"
        exact_bytes(data, a["original_body_sha256"], a["original_body_size"], "RELEASE_BODY_CHANGED")
        if release.get("updated_at") != a["original_updated_at"]:
            fail("RELEASE_BODY_METADATA_CHANGED")
        if release["immutable"]:
            fail("RELEASE_IS_IMMUTABLE")
        return "patch"

    def _patch_body(self, a):
        row = self.rows[("patch_release_bodies", a["release_id"])]
        state = self._body_state(a)
        if state == "already_clean":
            row["status"] = "already_clean_verified"
            self.save()
            return
        clean = self._literal(a, body=True).decode("utf-8")
        row["status"] = "patching_body"
        self.save()
        try:
            _, result = self.client.json(
                "PATCH", self.path("/releases/" + str(a["release_id"])),
                data=json.dumps({"body": clean}, ensure_ascii=False).encode("utf-8"),
                content_type="application/json", allowed=(200,))
            if not isinstance(result, dict) or not isinstance(result.get("body"), str):
                fail("INVALID_BODY_PATCH_RESPONSE")
            exact_bytes(result["body"].encode("utf-8"), a["new_body_sha256"], a["new_body_size"],
                        "BODY_PATCH_RESPONSE_MISMATCH")
        except SurfaceCleanupError as exc:
            if exc.code == "PERMISSION_DENIED":
                raise
            if exc.code != "NETWORK_ERROR" and exc.http_status not in (500, 502, 503, 504):
                raise
            if self._body_state(a) != "already_clean":
                raise exc
        if self._body_state(a) != "already_clean":
            fail("BODY_PATCH_NOT_VERIFIED")
        row["status"] = "clean_verified"
        self.save()

    def _run_metadata(self, run_id, expected_head=None, expected_updated=None):
        run = self.get("/actions/runs/" + str(run_id))
        if run.get("id") != run_id:
            fail("RUN_IDENTITY_CHANGED")
        if isinstance(run.get("repository"), dict) and run["repository"].get("full_name") != self.repository:
            fail("RUN_REPOSITORY_CHANGED")
        if expected_head and run.get("head_sha") != expected_head:
            fail("RUN_HEAD_CHANGED")
        if expected_updated and run.get("updated_at") != expected_updated:
            fail("RUN_UPDATED_AT_CHANGED")
        if run.get("status") != "completed":
            fail("RUN_NOT_COMPLETED")
        return run

    def _artifact_state(self, a):
        meta = self.get("/actions/artifacts/" + str(a["artifact_id"]), optional=True)
        if meta is None:
            self._run_metadata(a["run_id"])
            matches = [r for r in self.pages("/actions/runs/" + str(a["run_id"]) + "/artifacts", "artifacts")
                       if r.get("id") == a["artifact_id"]]
            if matches:
                fail("ARTIFACT_READ_RACE")
            return "already_absent"
        if (meta.get("id") != a["artifact_id"] or meta.get("name") != a["name"] or
                meta.get("size_in_bytes") != a["original_size"] or
                meta.get("updated_at") != a["original_updated_at"] or
                (meta.get("workflow_run") or {}).get("id") != a["run_id"]):
            fail("ARTIFACT_METADATA_CHANGED")
        digest = meta.get("digest")
        if digest:
            if digest != "sha256:" + a["original_sha256"]:
                fail("ARTIFACT_DIGEST_CHANGED")
        else:
            data = self.client.download(self.path("/actions/artifacts/" + str(a["artifact_id"]) + "/zip"), a["original_size"])
            exact_bytes(data, a["original_sha256"], a["original_size"], "ARTIFACT_BYTES_CHANGED")
        return "delete"

    def _logs_state(self, a):
        # GitHub changes run.updated_at when logs are deleted. First validate
        # immutable identity, then probe without following or reading log data.
        run = self._run_metadata(a["run_id"], a["original_run_head_sha"])
        if not isinstance(run.get("repository"), dict):
            fail("RUN_REPOSITORY_CHANGED")
        present = self.client.probe_logs(self.path("/actions/runs/" + str(a["run_id"]) + "/logs"))
        if not present:
            return "already_absent"
        # An unrelated change while logs still exist must still block DELETE.
        if run.get("updated_at") != a["original_run_updated_at"]:
            fail("RUN_UPDATED_AT_CHANGED")
        return "delete"

    def preflight(self):
        repository = self.get("")
        if (repository.get("full_name") != self.repository or
                repository.get("id") != REPOSITORY_IDS[self.repository]):
            fail("REPOSITORY_IDENTITY_CHANGED")
        for a in self.actions["patch_release_bodies"]:
            row = self.rows[("patch_release_bodies", a["release_id"])]
            self._literal(a, body=True)
            row.update(status="preflight_" + self._body_state(a), expected_new_sha256=a["new_body_sha256"])
            self.save()
        for a in self.actions["replace_release_assets"]:
            row = self.rows[("replace_release_assets", a["asset_id"])]
            mode, original, new_id = self._release_state(a)
            if mode != "already_clean":
                self.prepared[a["asset_id"]] = self._build(a, original)
            if new_id:
                row["new_asset_id"] = new_id
            row["status"] = "preflight_" + mode
            self.save()
        # Check checksum text against the already-built ZIPs, not just filenames.
        by_id = {a["asset_id"]: a for a in self.actions["replace_release_assets"]}
        for a in self.actions["replace_release_assets"]:
            if a["kind"] != "release_checksum":
                continue
            paired = a.get("paired_archive_ids", [])
            if not paired or any(i not in by_id for i in paired):
                fail("CHECKSUM_ARCHIVE_PAIR_MISSING")
            self._load_build()
            text = base64.b64decode(self.member_map["checksums"][a["original_sha256"]]["clean_content_b64"], validate=True)
            for item_id in paired:
                if by_id[item_id]["new_sha256"].encode() not in text:
                    fail("CHECKSUM_ARCHIVE_PAIR_MISMATCH")
        for a in self.actions["delete_actions_artifacts"]:
            self.rows[("delete_actions_artifacts", a["artifact_id"])]["status"] = "preflight_" + self._artifact_state(a)
            self.save()
        for a in self.actions["delete_run_logs"]:
            self.rows[("delete_run_logs", a["run_id"])]["status"] = "preflight_" + self._logs_state(a)
            self.save()
        self.receipt["status"] = "preflight_passed"
        self.save()

    def _verify_uploaded(self, a, meta):
        if not isinstance(meta, dict):
            fail("INVALID_UPLOAD_RESPONSE")
        if meta.get("id") == a["asset_id"]:
            fail("UPLOAD_ID_NOT_NEW")
        self._asset_bytes(meta, a, original=False)
        same = self._same_name(a)
        if same is None or same.get("id") != meta["id"]:
            fail("UPLOADED_ASSET_MEMBERSHIP_CHANGED")
        return meta["id"]

    def _replace(self, a):
        row = self.rows[("replace_release_assets", a["asset_id"])]
        mode, _, existing_id = self._release_state(a)
        if mode == "already_clean":
            row.update(status="already_clean_verified", new_asset_id=existing_id)
            self.save()
            return
        data = self.prepared[a["asset_id"]].read_bytes()
        exact_bytes(data, a["new_sha256"], a["new_size"], "STAGED_REPLACEMENT_CHANGED")
        if mode == "replace":
            row.update(status="deleting_original", delete_attempted=True)
            self.save()
            self.client.json("DELETE", self.path("/releases/assets/" + str(a["asset_id"])), allowed=(204, 404))
            row.update(status="original_deleted", original_deleted=True)
            self.save()
        if self._release(a)["immutable"]:
            fail("RELEASE_IS_IMMUTABLE")
        same = self._same_name(a)
        if same is not None:
            new_id = self._verify_uploaded(a, same)
            row.update(status="clean_verified", new_asset_id=new_id)
            self.save()
            return
        query = {"name": a["name"]}
        if a.get("label"):
            query["label"] = a["label"]
        upload_path = self.path("/releases/" + str(a["release_id"]) + "/assets?" + urllib.parse.urlencode(query))
        row["status"] = "uploading_clean"
        self.save()
        try:
            _, meta = self.client.json("POST", upload_path, host=UPLOAD_HOST, data=data,
                                       content_type=a["content_type"], allowed=(201,))
        except SurfaceCleanupError as exc:
            # 403/401 is an immediate stop, including read-only follow-ups.
            if exc.code == "PERMISSION_DENIED":
                raise
            if exc.code != "NETWORK_ERROR" and exc.http_status not in (422, 500, 502, 503, 504):
                raise
            same = self._same_name(a)
            if same is None:
                raise exc
            # A starter or conflicting upload is never deleted: its ID was not
            # authorized by the plan. Verification fails safely instead.
            meta = same
        new_id = self._verify_uploaded(a, meta)
        row.update(status="clean_verified", new_asset_id=new_id)
        self.save()

    def mutate(self):
        # Patch bodies first: GitHub may update the enclosing release timestamp.
        # Later asset checks compare asset timestamps and release identity, so
        # the intentional body update cannot invalidate their preconditions.
        for a in self.actions["patch_release_bodies"]:
            self._patch_body(a)
        for a in self.actions["replace_release_assets"]:
            self._replace(a)
        for a in self.actions["delete_actions_artifacts"]:
            row = self.rows[("delete_actions_artifacts", a["artifact_id"])]
            mode = self._artifact_state(a)
            if mode == "delete":
                row["status"] = "deleting_artifact"
                self.save()
                self.client.json("DELETE", self.path("/actions/artifacts/" + str(a["artifact_id"])), allowed=(204, 404))
                if self._artifact_state(a) != "already_absent":
                    fail("ARTIFACT_DELETE_NOT_VERIFIED")
            row["status"] = "deleted_verified" if mode == "delete" else "already_absent_verified"
            self.save()
        for a in self.actions["delete_run_logs"]:
            row = self.rows[("delete_run_logs", a["run_id"])]
            mode = self._logs_state(a)
            if mode == "delete":
                row["status"] = "deleting_logs"
                self.save()
                self.client.json("DELETE", self.path("/actions/runs/" + str(a["run_id"]) + "/logs"), allowed=(204, 404))
                if self._logs_state(a) != "already_absent":
                    fail("LOG_DELETE_NOT_VERIFIED")
            row["status"] = "deleted_verified" if mode == "delete" else "already_absent_verified"
            self.save()

    def run(self):
        try:
            if not any(self.actions.values()):
                self.receipt["status"] = "no_actions"
                self.save()
                return self.receipt
            self.receipt["status"] = "preflight"
            self.save()
            self.preflight()
            if not self.dry_run:
                self.receipt["status"] = "executing"
                self.save()
                self.mutate()
            self.receipt["status"] = "dry_run_verified" if self.dry_run else "completed"
            self.save()
            return self.receipt
        except Exception as raw:
            exc = raw if isinstance(raw, SurfaceCleanupError) else SurfaceCleanupError("INTERNAL_ERROR")
            self.receipt.update(status="stopped", error_code=exc.code)
            if exc.http_status:
                self.receipt["http_status"] = exc.http_status
            try:
                self.save()
            except Exception:
                pass
            exc.receipt = self.receipt
            raise exc from None


def run_cleanup(*, repository, plan_path, token=None, workdir, dry_run=False, client=None):
    """Root CI interface; ``client`` is injectable solely for offline tests.

    ``token`` must be the caller's GITHUB_TOKEN, with no credential fallback.
    A matching receipt should be retained for resumable interrupted uploads.
    """
    try:
        return Executor(repository, plan_path, token, workdir, dry_run=dry_run, client=client).run()
    except SurfaceCleanupError:
        raise
    except Exception:
        raise SurfaceCleanupError("INITIALIZATION_ERROR") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--workdir", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        receipt = run_cleanup(repository=args.repository, plan_path=args.plan,
                              token=os.environ.get("GITHUB_TOKEN"), workdir=args.workdir,
                              dry_run=args.dry_run)
    except SurfaceCleanupError as exc:
        print(json.dumps(exc.receipt or {"status": "stopped", "error_code": exc.code,
                                         "http_status": exc.http_status}, sort_keys=True))
        return 1
    print(json.dumps(receipt, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
