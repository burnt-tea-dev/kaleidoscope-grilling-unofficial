# Guarded Blockbench capture toolkit

Portable Python 3.10+ standard-library CLI for an already-open, reviewed native scoped fixture. This implements the capture step of the [official-source-first repair workflow](../../docs/ANIMATION-ITEM-REPAIR-WORKFLOW.md), not a Minecraft acceptance test. It neither installs software nor opens/imports a fixture. The operator retains the native UI.

## Before connecting

Use an authorized, hardened local Blockbench MCP installation: loopback listener only, arbitrary execution disabled, remote prompt download disabled before first load. This CLI cannot configure or independently prove those plugin settings. It refuses an advertised `risky_eval` tool, invokes only seven fixed typed tools, never calls prompts, never executes application code, and reads only the exact live project resource advertised for the active project UUID.

Open the intended fixture in Blockbench; set native first/third-person mode and reset its camera. Select the intended primary animation, enable its playback, and lock each secondary clip. Pause/scrub calls always target that same primary. The `.bbmodel` exporter does not serialize playing/locked flags: the receipt labels them operator-declared, **not machine-verified**. Confirm their icons visually and preserve separate UI evidence. Scope, Override, selected primary and Bedrock mode are checked against the live export.

No bundled official application archive, Mojang/player textures, Java assets or other licensed fixtures are included. Provide your own authorized local `.bbmodel`. The earlier one-off ASAR fixture compiler is not shipped: its hardcoded source paths and private asset inputs are experimental and not a portable builder.

## Inspect, review, then capture

Run from the repository root. Choose new output directories outside the checkout; outputs may contain embedded textures and machine-specific paths. Do not publish them wholesale.

```sh
python tools/blockbench_preview/capture.py --fixture /local/fixture.bbmodel \
  --inspect-project YOUR_OPEN_PROJECT_NAME --output /local/review-inspection
```

This performs read-only project/resource inspection and writes `initial-live.bbmodel` plus an `inspected_only` receipt with actual `list_views` camera/dimension metadata. It prints SHA256 values for the exact source fixture bytes and exact UTF-8 live-resource text bytes. Independently compare the inspected live export to the intended source (expected editor serialization changes, scopes, binding, overrides, preview-only differences). Do not automatically approve whatever project is open just by copying the observed hash.

Copy `plan.example.json` to a private file, replace both hash placeholders with independently reviewed pins, and fill project name, primary clip, camera, sample times and context. The primary must already be selected in the inspected export. `playing_order` lists the effective order, including all manually locked secondary clips. Context version/revision/hand and runtime limits are operator declarations; this CLI does not certify installed app version or game state.

```sh
python tools/blockbench_preview/capture.py --fixture /local/fixture.bbmodel \
  --plan /local/review-plan.json --output /local/review-capture
```

Default endpoint: `http://127.0.0.1:3000/bb-mcp`. `--endpoint` accepts HTTP with a literal loopback IP, explicit port and exactly `/bb-mcp`; DNS hostnames, credentials, queries, fragments, redirects and proxies are rejected/disabled. Requests have bounded response sizes and timeouts, and failed or uncertain operations are never automatically retried.

Set `view_mode` explicitly. The example uses `active`: the CLI reads the native viewport through typed `list_views {}` and requires its observed ID, width/height, perspective projection, unlocked angle, position/target and FOV to match the reviewed plan before and after each operation. Camera values are reported by the plugin rounded to three decimals, so the comparison tolerance is 0.001; dimensions and viewport identity are exact. These are reported viewport dimensions, not a promised PNG size: native first-person letterboxing may yield a differently sized image. Each frame separately records its actual PNG IHDR width/height; inspect framing/aspect rather than stretching output to the declared viewport size. It captures that fixed viewport ID without creating, resetting, resizing, moving or deleting a camera. Resize/reset manually before inspection if needed.

The optional `offscreen` mode (also the backward-compatible default when omitted) creates its own view at the declared dimensions and applies the explicit perspective camera. Both modes pause the primary, sample exact times and capture PNGs. There is no automatic fallback between them. Native mode, player/attachable scopes and bindings must already be correct. It does not reproduce arbitrary free-orbit views or prove offscreen/native/game camera parity. First-person defaults in the example are the documented scoped 5.2.2 preset; choose a separately recorded third-person camera when appropriate.

## Fail-closed identity and evidence

- Before any mutation: source fixture SHA256, active project name, exact live-export SHA256, ruleset/mode, selected primary and declared clip scope/Override must match.
- Before and after every view/timeline/capture operation: recheck source fixture, active project UUID/name and exact live-export hash. Any drift fails the run. A screenshot whose post-check fails is not saved as an accepted frame.
- The server does not offer an atomic project lock. Do not interact with or switch projects during capture. Pre/post checks detect observable drift but cannot prove a transient switch-and-return never occurred. Capture additionally passes the expected project UUID to the typed screenshot tool. Treat suspected concurrency as invalid evidence and rerun into a fresh directory after review.
- Exact byte pinning intentionally rejects benign serialization/selection changes too. Review new bytes and repeat inspection rather than weakening the guard or silently repinning. Source and live hashes are separate; serialized live bytes need not equal source fixture bytes.
- Output reuse is rejected. A failed run preserves an explicit `failed` receipt; previously written frames from that run must not be presented as a completed sequence. Only `captured_editor_only` is a completed editor batch.
- Cleanup deletes only a view this run successfully created. A known local MCP 1.10.0 trial rendered one guarded frame, then threw `onContextMenu is not defined` during deletion. `captured_editor_cleanup_failed` and exit code 2 preserve that distinction; this is not a fully successful capture/cleanup trial. Active mode creates no offscreen resources.
- The pinned [plugin disposal implementation](https://github.com/jasonjgardner/blockbench-mcp-plugin/blob/178ce46feeca740163898748606575a3844a55b6/lib/views.ts) removes the registry entry in `finally`, even on disposal errors. It attempts controls/context cleanup, but successful GPU/listener release is unverified after an exception. A missing `list_views` entry therefore does not prove complete cleanup. Offscreen canvases are not visible tabs: no manual close button is established. Session termination uses the same disposal route for still-registered views and cannot reclaim an already-removed entry. Do not repeat offscreen trials or claim a four-slot leak from the exception alone. Keep the failure evidence, use the explicitly reviewed active mode for new captures, and arrange an operator-controlled save/restart if a clean editor process is needed; this CLI does not restart/reload/patch Blockbench or its plugin.
- Timeline position is left at the last attempted sample and playback is paused. No undo or silent restoration is promised.

Outputs: reviewed plan in `receipt.json`, exact `initial-live.bbmodel`, per-operation arguments and identity guards, sample time/PNG SHA256 for each raw frame, final status and cleanup outcome. No HTTP headers, MCP session IDs, raw server errors or general app screenshots are persisted. Project UUID is an identity reference, not a session token. Keep all output private until reviewing embedded assets, metadata and redistribution permissions. The CLI uploads nothing.

The receipt explicitly says editor preview only and client=false. It does not verify stage transitions, native item-use clocks, runtime controller wiring, per-hand sessions, camera bob or gameplay. List preview-only binding/clock/gate replacements and unresolved runtime limits in the plan.

## Focused safety tests

```sh
python -m unittest discover -s tools/blockbench_preview -p 'test_*.py' -v
```

Tests use a synthetic loopback mock MCP server and a generated one-pixel PNG. They cover JSON/SSE capture, fixture/live/name gates before mutation, project/camera drift during capture, active-view dimensions and no-camera-mutation behavior, cleanup, unsafe tools, untrusted resource links, redirects/non-loopback endpoints, mismatched responses, private-error redaction, invalid plans and read-only inspection. They do not launch Blockbench or Minecraft and do not establish native preview integration. A separate operator trial of the earlier offscreen revision produced one verified editor frame and a cleanup failure; active-mode native integration remains pending. No game acceptance is implied.
