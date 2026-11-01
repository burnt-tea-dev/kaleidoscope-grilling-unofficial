# T3.5-c complete held snapshot probe

This is an isolated C-1 experiment. Production retains the paired 27-property
protocol; see [baseline.json](../../../baseline.json) for its formal version.
Do not install either probe with an existing Grilling
pack, use a formal save, or copy the test world back to production.

The build copies the current plate model/textures and imports the real plate
planner and item metadata code. Five rows, three secret ingredient cells, stored
shapes and cooked snapshots remain intact in each hand. It adds a bone-free
animation and replaces the test RP's hand-bank reads with owning-player Molang
variables. The candidate declares four player properties: controls, both full
72000-tick clocks, and a frame token. That token permits one complete 24-word
snapshot and masks absent/stale data. This is a proposed transport, not proof
of atomic rendering or client variable scope.

Build from this repository. Supply the external Mojang player definition from
the fixed [1.26.60.5 sample commit](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/entity/player.entity.json).
The builder verifies SHA256
`7e520d872fc72be266223b3db2883c2818742a9a450330753a6de4d2ad813608` before
writing output. This input is subject to Mojang's [EULA](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/LICENSE.md),
is not vendored here, and is not evidence for a different client build.

```sh
python3 tools/held_snapshot_probe.py --player-template /path/to/player.entity.json --output /tmp/held-snapshot-candidate
python3 tools/held_snapshot_probe.py --player-template /path/to/player.entity.json --control --output /tmp/held-snapshot-control
```

Each output contains BP, RP, a build inventory and one mcaddon. The control has
28 properties, keeps the original property readers and writes both property
banks. The four-property candidate reads only the snapshot. UUIDs differ; use
separate disposable test worlds and identical client settings. The test plate
is hold-only: native food consumption is disabled because the full gameplay
entry is deliberately absent. This experiment cannot pass eating settlement,
nutrition, sounds, gun behavior or final family acceptance.

Use pack **1.0.8** or later for this experiment. Earlier 1.0.4 omitted the
owning player's public-variable declarations; its API-only results keep their
original scope and cannot establish the attachable contract. Both variants now
preserve the pinned vanilla player routing, bind the carrier aliases and expose
the complete 24-word snapshot plus its frame as initialized public variables.
This follows the [official Molang rule](https://learn.microsoft.com/en-us/minecraft/creator/documents/molang/syntax-guide#public-variables);
it still needs actual client evaluation.

The first real 1.26.60.4 control run rejected 1.0.5's empty `bones` object and
reported an uninitialized vanilla `melee_spear_equipped` before seeding items.
Version 1.0.6 omits the optional bones field and supplies a neutral init-only
fallback that preserves a value already supplied by the engine. It does not
override spear state each frame or change plate capacity or transforms. The
original control failure remains evidence; the native API observation below
still describes 1.0.5. The clipped first-person view, full five-by-three contents,
candidate rendering and multiplayer/re-entry still require real client tests.

The 1.26.60.4 candidate run then rejected 1.0.6 expressions such as
`(c.owning_entity->v.kg_snapshot_frame ?? 0)`: the left operand of `??` is a
redirected expression, not a direct variable. Version 1.0.7 reads the initialized
public snapshot variables directly, preserving the property/frame gate that
hides absent or stale data. It does not change snapshot publishing, plate
transforms, capacity, food metadata or formal runtime. The earlier client
errors and clipped first-person views retain their failed result. Source tests
of these generated readers do not replace a native client parser/render test.

Client 1.0.7 testing then found both saved-world and complete-client re-entry
empty until manual replay, while the property control restored visible food.
The unchanged publisher never sent another request. In 1.0.8, the existing test
poll refreshes a complete unchanged snapshot at most once per 100 server ticks
(five seconds at 20 TPS), without advancing the frame or dropping any words.
Each temporary animation ends once its frame commits. Targeted viewer replay
does not postpone the next broadcast refresh. This follows the distinction in
Mojang's [one-off client packet description](https://mojang.github.io/bedrock-protocol-docs/1.26.60-preview.30/packets/animate-entity-packet/);
it is an implementation to test, not evidence that a client received or rendered
the request. Re-entry, visible recovery delay and client/network cost still need
native measurements. The original 1.0.7 failures remain intact.

The control also reported an undefined vanilla `first_person_item_rotation_factor`
before seeding. The player now defaults it to zero only during initialization,
preserving any existing native value and all later engine writes. Zero preserves
the numeric fallback used by the old missing-variable read; it is not a new
per-frame attack or hand-pose override. The native client must verify the fix.

Use the exact target BDS 1.26.60.6 and record the actual client build, platform,
view distance and frame rate. Enable Beta APIs/GameTest. With cheats enabled:

```text
/scriptevent kg_snapshot_probe:seed 0
/scriptevent kg_snapshot_probe:swap
/scriptevent kg_snapshot_probe:replay
/scriptevent kg_snapshot_probe:clear
/scriptevent kg_snapshot_probe:status
/scriptevent kg_snapshot_probe:pose 4
```

`seed` places two distinct full plates in the caller's hands. `swap` changes
contents while keeping the item ID. `replay` explicitly asks for all active test
actors' snapshots for the caller; record if it is needed. Manual replay must
never be reported as automatic re-entry success. `clear` clears display data;
the next test poll rebuilds from unchanged held metadata.

`status` only logs the property frame, cached full hand words, current held words,
refresh/replay counts and expression character length. Counts are submitted API
requests, not client acknowledgements or measured wire bytes. Capture status
before manual replay if automatic recovery fails.

`pose 0`, `pose 4` and `pose 8` select a test-only offset in the two first-person
plate Y translations. Zero preserves the source pose; third-person transforms,
geometry, all food cells and persisted item data remain unchanged. Compare one
offset at a time at fixed FOV/UI/window settings and restore `pose 0`. Seeding or
re-entering also resets this diagnostic to zero. This is a calibration control,
not a proven crop fix or permission to modify formal pose assets. It uses one
extra initialized public Molang variable, not another entity property.

Compare the control and candidate in first person, third person and a second
real client's view. Record distinct food/shape/cooked content in both hands,
rapid repeated swaps, late join, dimension changes, leaving/re-entering actual
client visibility and script reload/relog. Show a result before and after manual
replay if automatic visibility fails. On saved-world re-entry and a complete
client restart, capture the original held plates before any new seed or replay;
record the wait and whether all contents restore automatically. Include client
content-log errors and original frame captures as individual readable images
plus UTF-8 excerpts under 1 MiB with source line numbers. Keep the complete
original logs separately and label GUI copies, file logs and launcher stdout
by their actual source. A server log or a packet-shaped JS test is insufficient.

Spawn/dimension-entry replay and the 100-tick full refresh are included in this
probe. Automatic re-entry into render distance and frame-time/network cost remain unresolved.
A successful native/API result keeps `clientEvaluated=false` and
`channelViable=null` until those scenes are observed. Do not remove production
properties or start T3.5-d solely because BDS accepts `playAnimation`.

The native diagnostic is started with `scriptevent kg_snapshot_probe:native`
in the isolated engine. It uses two GameTest players and checks only API
acceptance, full input preservation, unchanged suppression, metadata swaps,
targeted replay, maximum words and empty snapshots. All source and failure logs
must retain their original result.
