# T3.5-c complete held snapshot probe

This is an isolated C-1 experiment. Production remains the paired G203
27-property protocol. Do not install either probe with an existing Grilling
pack, use a formal save, or copy the test world back to production.

The build copies the current plate model/textures and imports the real plate
planner and item metadata code. Five rows, three secret ingredient cells, stored
shapes and cooked snapshots remain intact in each hand. It adds a bone-free
animation and replaces the test RP's hand-bank reads with owning-player Molang
variables. The candidate declares four player properties: controls, both full
72000-tick clocks, and a frame token. That token permits one complete 24-word
snapshot and masks absent/stale data. This is a proposed transport, not proof
of atomic rendering or client variable scope.

Build from this repository:

```sh
python3 tools/held_snapshot_probe.py --output /tmp/held-snapshot-candidate
python3 tools/held_snapshot_probe.py --control --output /tmp/held-snapshot-control
```

Each output contains BP, RP, a build inventory and one mcaddon. The control has
28 properties, keeps the original property readers and writes both property
banks. The four-property candidate reads only the snapshot. UUIDs differ; use
separate disposable test worlds and identical client settings. The test plate
is hold-only: native food consumption is disabled because the full gameplay
entry is deliberately absent. This experiment cannot pass eating settlement,
nutrition, sounds, gun behavior or final family acceptance.

Use the exact target BDS 1.26.60.6 and record the actual client build, platform,
view distance and frame rate. Enable Beta APIs/GameTest. With cheats enabled:

```text
/scriptevent kg_snapshot_probe:seed 0
/scriptevent kg_snapshot_probe:swap
/scriptevent kg_snapshot_probe:replay
/scriptevent kg_snapshot_probe:clear
```

`seed` places two distinct full plates in the caller's hands. `swap` changes
contents while keeping the item ID. `replay` explicitly asks for all active test
actors' snapshots for the caller; record if it is needed. Manual replay must
never be reported as automatic re-entry success. `clear` clears display data;
the next test poll rebuilds from unchanged held metadata.

Compare the control and candidate in first person, third person and a second
real client's view. Record distinct food/shape/cooked content in both hands,
rapid repeated swaps, late join, dimension changes, leaving/re-entering actual
client visibility and script reload/relog. Show a result before and after manual
replay if automatic visibility fails. Include client content-log errors and
video/frame captures; a server log or a packet-shaped JS test is insufficient.

Only spawn/dimension-entry replay is included in this initial probe. Automatic
re-entry into render distance and frame-time/network cost remain unresolved.
A successful native/API result keeps `clientEvaluated=false` and
`channelViable=null` until those scenes are observed. Do not remove production
properties or start T3.5-d solely because BDS accepts `playAnimation`.

The native diagnostic is started with `scriptevent kg_snapshot_probe:native`
in the isolated engine. It uses two GameTest players and checks only API
acceptance, full input preservation, unchanged suppression, metadata swaps,
targeted replay, maximum words and empty snapshots. All source and failure logs
must retain their original result.
