# Cooked-slime held frame selector: isolated source candidate

Base: `23031fc67ac96542d47d4a99295427e3a69af5c5` on canonical Grilling main. No release/version/UUID/baseline/history changes. This source candidate must not be installed or published under the frozen version. `client=false`, `production_ready=false`.

## Source failure and corrected count

Java Forge 1.20.1 and NeoForge 1.21.1 at [9a1acdab](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/client/ClientSetup.java#L109-L117) compute `(level.getGameTime() / 4L % 5L) / 4.0F`, with zero for a missing level. This clock is independent of use/eating, player age, equipment changes and camera view. Ordered item overrides select five frames for each of three bite stages.

The old attachable selected stage0's frame4 permanently and later stages' frame0. Independent effective transformed-corner/UV/RGBA comparison found **five effective state mismatches**: stage0 frames0–3 and stage1 frame2. Raw source-element JSON differs in seven states; stage1 frames3/4 only move a pivot whose rotation angle is zero, so those two are geometrically equivalent. All fifteen state aliases are nevertheless required. The distinction corrects the earlier seven-visible-mismatch interpretation.

## Minimal implementation

- Reuse the fifteen already converted source assets, with only the established +24 Y hand rebake and existing grip → skewer_pose → skewer_model hierarchy. Copy the two exact atlases. Select `stage*5+frame` through the actual attachable's geometry/texture controller.
- Preserve the item's identifiers, item JSON, food data, material, default pose, animation aliases/gates and eating/bite clocks. Raw slime and other foods are unchanged.
- Reserve **215–219** in each hand's existing `secret_*_piece` integer channel for frames0–4. All eleven other words in a slime packet must be zero. Secret0–213, bottle214, invalid254 and plate255 retain their meanings. The player remains at **32 properties**; no player JSON edit occurs.
- Compute the frame once from `world.getAbsoluteTime()` before the existing one-tick player loop. Both hands of every player receive that same sample. No new player scan, interval or five-tick discovery dependency is introduced. Other held-content providers and the five-tick dispatcher keep their original cadence.
- A frame-only update changes one discriminant, so the frame cannot be split across different payload words. Existing owner invalidation and retry caching remain for switches. Decoder requires the exact current item and correct hand's integer marker range. Missing, stale or invalid data selects visible frame0, not an invisible model. The first equipped frame before the next tick/client update may therefore be frame0.
- Exact slime-owned aliases are added to the projection-admission and geometry-inventory checks. Missing, swapped, foreign-owner and extra aliases fail. The three main-loop additions have a strictly positioned reversible wrapper so historical generator source pins remain unchanged.

## Clock evidence and limits

Official [Script World documentation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/world?view=minecraft-bedrock-stable) describes `getAbsoluteTime()` as elapsed world time. The [1.x World documentation](https://learn.microsoft.com/en-us/minecraft/creator/priorscriptapi/minecraft/server-1xx/world?view=minecraft-bedrock-stable#setabsolutetime) specifies ticks for its corresponding absolute-time setter. This supports choosing world absolute time rather than session/eating clocks, but is **not native proof** of Java-equivalent persistence or time-command behavior.

Direct Molang `q.time_stamp` was rejected. Its [official definition](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_time_stamp?view=minecraft-bedrock-stable) does not fully specify units/lifetime, and float32 arithmetic independently breaks the four-tick contract: timestamp16777219 rounds into frame0 instead of4; 67108869 produces3 instead of2. Above2^26 it can skip complete frames. Tests cover2^24,2^26,2^28,2^32,2^40. Script reduces safe integer timestamps before synchronization; only215–219 crosses the client float32 boundary. Tests cover exact BigInt reference arithmetic through `Number.MAX_SAFE_INTEGER`. Missing/throwing/invalid/unsafe clock inputs select0; there is no `system.currentTick`, `time_of_day` or `life_time` fallback.

These checks establish arithmetic, source ownership and selected-asset fidelity. They do not establish native replication latency, query lifetime, rendering boundary or multiplayer phase equality.

## Reproducible checks

The canonical `verify_current.py` source path (and its existing CI caller) now invokes `verify_slime_frames.py` before the historical full suite for G143 and later. A receipt-order unit test ensures this cannot be skipped. No historical source hash or release gate is relaxed.

Run from repository root:

```sh
python tools/build_slime_frame_selector.py --check
python tools/build_eating_motion.py --check
python development/gameplay_core/test_slime_frame_selector.py
python development/gameplay_core/test_slime_clock_precision.py
node --experimental-vm-modules --test development/tests/runtime/slime_frame_transport.test.mjs
python development/gameplay_core/test_held_render_contracts.py
python development/gameplay_core/test_java_eating_projection_admission.py
python development/gameplay_core/test_secret_held_owner_context.py
python development/gameplay_core/test_partial_skewer_held.py
```

Before repair, the focused selector suite failed actual controller selection and global-frame wiring while its five effective historical negative controls passed. The transport suite could not load the absent module. After repair, selector/source/mutation checks, transport/runtime failures and both generator checks pass. The unchanged clean baseline also passes the full eating generator. During development, extra aliases initially caused projection de-admission and a shared-clip pin failure; exact-owned-alias admission fixed the cause, without relaxing the pin. The subsequent main source pin failure was fixed by the exact reversible wrapper, not by replacing the pinned hash.

Independent review checked all15 actually selected model/texture pairs against resolved pinned Java:180 oriented faces and6400 exact RGBA pixels pass. Source tests use the real runtime/transport with only native equipment/log boundaries substituted; this is not BDS or client acceptance. Full canonical/release/export suites have not been certified for this unversioned candidate.

## Required native acceptance, still pending

In a disposable, correctly versioned QA world only:

1. Compare idle/eating, first/third person, main/offhand and two simultaneous players through all20 ticks and all3 bite stages. Record server absolute tick, marker and rendered frame rather than editor timeline time.
2. Equip immediately before and after each four-tick boundary; measure first-update and network delay. Change hands/items through bottle, plate, secret skewer, raw slime and empty, including rapid switches. Confirm no stale ownership or hidden model.
3. Save/reload and restart the server at nonzero frame phases. Verify world absolute time persistence and expected Java-equivalent phase; test dimension change and join-in-progress.
4. Check `/time set`, `/time add`, daylight-cycle changes, sleep and absolute-time API behavior separately. Establish whether the selected clock tracks Java gameTime rather than mutable daytime; do not infer this from API names.
5. Use large persisted timestamps around2^24,2^26,2^28 and greater to verify four ticks per frame with no skip, including late join/reload.
6. Test unavailable clock/property writes and recovery. A failed hand must not block the other; fallback frame0 is visible. Verify ordinary food/eating, bottle/plate/secret packets, content logs and default pose remain unchanged.

No Blockbench captures, native-game acceptance, release, merge or LIVE deployment are claimed by this document.
