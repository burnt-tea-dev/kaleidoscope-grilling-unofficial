> C-1 is historical. Reproduce 1.0.8 from commit `5b7736adfb815a5829d2d7cb8ef318bb0c45073d`; the current source refuses to rebuild changed runtime under that test identity. The formal protocol and source status are maintained in [T3.5](../../../docs/REBUILD-PLAN.md#t3-5-property-slimming).

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

<a id="formal-batch"></a>
## Formal batch acceptance

This is one batch for the finished canonical source and its exact integrated
candidate. Fill package identities, downloads, byte sizes and SHA256 from the
S1 candidate receipt before sending it to dot. A source tree or an earlier C-1
package is not that candidate. Keep the original r7/r8/r9 failures and limited
recovery observations. Do not send another height-only probe.

### Setup and controls

1. Record BDS/client version, platform, resource renderer, experiments, screen
   size, FOV, UI profile/scale, view bobbing and client content-log settings.
2. Download all parts directly from the private Drive links in the receipt.
   Verify full bytes/SHA256, BP/RP UUID/version/dependencies and installed files;
   name or download success alone is insufficient. Use isolated world copies.
3. First run the pinned pre-migration functional control without TACZ. Its
   existing FP clipping is a recorded baseline, not a new transport failure.
   Confirm full gameplay, content and recovery before changing the candidate.
4. Then run the complete formal four-property candidate with its selected host
   player and IE/Grilling FP controller. Do not retain the C-1 probe player.
5. Finally run the identical candidate with the pinned TACZ compatibility
   outputs. Confirm the effective whole-family BP schema remains <=32, with
   four Grilling fields and all 24 reviewed TACZ fields. Keep the full selected
   player/resource collision audit; a two-pack subtotal is insufficient.
6. Before each phase capture clean content-log sources. Keep their original
   files, timestamps, byte sizes and completion/truncation indicators. Do not
   concatenate unrelated sessions or label a 4KiB prefix as a complete log.

### Hand contents and full capacity

7. Prepare two different full plates. Each has five secret rows, each row has
   three different foods; vary all three shapes, raw/cooked snapshots, styles,
   native envelopes, translated lore and a foreign metadata value. Save the
   actual 30 ingredient identities and both source envelopes as expectations.
8. Verify all five rows and all three cells per row in FP and TP, each hand
   alone, both hands together, and from a second real client. Mark obscured
   foods INCONCLUSIVE, never PASS merely because both plate bodies are visible.
9. Repeat with counts 0/1/2/3/4/5, ordinary/fixed/failure/slime rows, mixed plates,
   unfinished one/two-cell skewers, standalone secret/failure/slime skewers,
   empty/partial/full/pending bottles, oil pots and all three brush types.
10. Switch rapidly across those owners and swap hands; change the metadata of
    an item without changing its type ID. Look for stale food, opposite-hand
    contamination, missing rows, a stuck brush or incorrect bottle ordering.
11. Keep all items and metadata identical after passive display tests. Then
    exercise plate placement, pickup, highest-nutrition eating and recovery.
    The displayed item and restored saved contents must agree exactly.

### First person and animation

12. Test the final generated pose, not pose0/4/8 debug commands. Capture original
    PNG/JPEG at 4:3, dot's baseline viewport and 16:9, normal/min/max supported
    FOV, Classic/Pocket UI and relevant UI scales. Record the actual viewport.
13. At rest require the complete full-plate contents inside the view, separate
    hand regions, readable HUD and a usable aiming center. Keep .4 model scale,
    original layouts and TP presentation; do not delete food to obtain a fit.
14. Test walking, sprinting, sneaking, jumping, swimming, flight, looking up/down,
    swinging and switching FP/TP. Record natural hand motion separately from
    idle clipping. Check spear, map, skin/slim arms and spectator routes.
15. Test every eating profile from each allowed hand: start, early cancel,
    completion checkpoint, release, native completion, rapid switch, death,
    dimension change, direct logout and respawn. Verify food counts, nutrition,
    effects, projected bites, HUD, sounds and correct neutral arm restoration.
16. Test seasoning, bottle shaking, filling and brushing with cancellation or
    switching during the action. Substitute model and arm must follow the
    same hand/phase and stop at the original endpoint without stale motion.
17. Check all previous content-log errors plus unknown public variables,
    redirected null-coalescing, missing aliases/controllers, invalid empty
    bones, missing properties and divide-by-zero. Report each source window.

### Re-entry, persistence and real viewers

18. Save/quit and re-enter without commands, swaps or manual replay. Capture
    the first readable world and about +1/+5/+10/+20 seconds. Report automatic
    recovery as a bounded interval from timestamped originals, not an ACK.
19. Repeat after fully closing/reopening the client, after a resource reload,
    a server restart and a script reload where supported. Reconstructed data
    must remain correct; both full plates, metadata and unfinished food survive.
20. Two real clients observe both directions. Test late join, reconnect,
    respawn, entering/leaving real view distance and dimension changes. Record
    the actual observer and owner; a singleplayer third-person view is not this.
21. Hold content unchanged for at least 30 seconds. Check that refresh restores
    recreated actors, does not increment unchanged frames, restart eating/
    brush animations, spawn extra entities or grow historical controllers.
22. Only after the untouched automatic recovery window may manual replay be
    used as a separately labelled diagnostic. It cannot repair the prior result.
23. S1 performs the same stopped-world-copy first-load/restart and rollback
    rehearsal for the final candidate. Compare original player records, world
    keys/types and complete item envelopes; never copy the QA world to LIVE.

### TACZ and complete family

24. Equip every gun-family render route, including paired variants. Check FP/TP,
    arm/skin geometry, aim, fire, recoil, reload, inspect and all attachment modes.
25. Switch gun -> plate/skewer/bottle/food -> gun rapidly. Inspect both control
    families and ensure one player's state never changes another player's gun.
26. Hold a plate or supported tool offhand while holding a gun; test idle, aim,
    reload, switch and each interaction the engine permits. Check the correct
    hand contents and existing eating effects. With an occupied offhand, its
    native/food route owns the left arm; an empty offhand retains TACZ's
    two-handed curves. Test both branches and the transition. Unsupported actions need a
    precise platform limit, not silently disappearing effects or reduced capacity.
27. Save/re-enter and fully restart with gun state plus offhand food/plate.
    Verify the original TACZ properties, events and saved ammo/attachments as
    well as the reconstructed Grilling display and the selected host behavior.
28. Check the remaining selected family features and actual merged player
    components: health/dragon changes, raids, exhaustion/lunge, knockback,
    movement, maps, spectator/invisibility, skins and immersive eating routes.
29. Measure identical cold/warm scenarios, server tick time, persistent Slowdown,
    client frame-time samples, player count, view distance and request/refresh
    rate. Separate time/load conditions; unrelated HUD FPS samples do not prove
    the channel cheaper or satisfy S1's full-family performance gate.

### Evidence, repairs and exit

30. Report each row as PASS/FAIL/INCONCLUSIVE/NOT-RUN, with exact candidate and
    raw evidence references. Original FP images must be individually readable;
    include before/after status, both hand words, frame and server time where
    available, plus original error logs and their completeness. Do not rely on
    a ZIP alone, a montage alone, inaccessible paths or pasted summaries.
31. Group failures by content transport, camera/pose, eating/action, gun route,
    persistence or performance. Reproduce a minimal failing case, repair its
    canonical owner/generator, then re-run that case and affected batch rows.
    Changed runtime requires a fresh paired identity; retain the failed evidence.
32. No formal acceptance until capacity, both hands, effects, recovery, real
    viewers and the TACZ/full-family gates pass on the same candidate. S1 then
    coordinates admission, consistent backup, deployment and readback. Keep
    client=false, production_ready=false and pending_client_acceptance until
    actual evidence warrants changing each state.
