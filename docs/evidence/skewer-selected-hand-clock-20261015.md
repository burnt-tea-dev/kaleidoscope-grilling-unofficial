# Skewer selected-hand clock: source repair draft

Base: `ce340a7d7f13cd5be0c0ff95e6556ed3187c81a8`, maintained G142. This is an unversioned source draft, not a replacement G142 archive, release, deployment, or client acceptance. PR200's unrelated rawLore changes are excluded.

## Reproduced defect

The actual exported left-hand player clips read `query.main_hand_item_use_duration`. Microsoft's [query contract](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_main_hand_item_use_duration) scopes it to the main hand. With a fresh 90-tick offhand session and alpha=.5, unrelated mainhand remaining=0 produces **4.475 seconds**, while remaining=90 produces **0 seconds**. Previously the timer tests varied the captured duration but assumed the countdown belonged to that same hand.

`test_offhand_eating_clock.py` evaluates exported Molang with independent session elapsed/mainhand countdown values. It fails against the base and passes against this draft. Offhand animation and attachable bite presentation now use the already replicated, session-owned `eat_elapsed_ticks`, gated by local `is_using_item`. Mainhand animation clocks remain byte-for-byte unchanged. No guessed query units, camera offsets, scale changes, new settlement, or server properties were introduced. Offhand resolution is 20 Hz plus replication latency, not a claim of smooth native offhand interpolation.

## Adjacent terminal regression caught and repaired

The first clock-only patch failed the existing secret terminal restart test: its local mainhand-counter restart signal is no longer relevant to an offhand session. After an observed terminal stop, the existing terminal wait now remains latched until the existing session/ownership boundaries clear it. Server elapsed reset, hand/profile/phase clear, item or ingredient snapshot change, fresh attachable instance, and leaving first person retain their explicit exits. This is the existing bounded ownership wait, not a new timeout or perpetual item hide.

The production subscriber harness covers pre-checkpoint cancel without settlement, selected-slot/serving replacement, restart, offhand→mainhand alternation, and deferred old cleanup not deleting the new session. Existing tests retain Java's eligible 24/25-tick cancel settlement once; cancellation is not universally free. No settlement code changed.

## Preserved native evidence

The G127 dedicated right-hand clips remain exactly SHA256 `a14a8333f6abb9eed55db1e7fa2aaa291ec83cc7dd6b0c924efe0dcdc823ef2d`. Historical hashes are not replaced. Witness adapters invert only exact selected-hand assignment / offhand animation clock / terminal-wait scalar changes before comparison. Unknown clock or unrelated channel changes still fail. New source behavior is covered separately and is not certified by those historical native witnesses.

## Remaining visual gaps

Java reference is breezeth-CN/KaleidoscopeGrilling `9a1acdab27698457bec16c9362678e574895a28c`, Forge 1.20.1. Its first-person renderer replaces the native renderer with NONE-context authored arms/items and adjusts for actual eye height. Current port projection admission remains limited by posture, item and helper-hand conditions; fallback hold+motion composition and transitions are unresolved here. Removing those guards without an equivalent camera/eye-height mapping would be speculative.

The current third-person injected Bedrock eating-startup pose is not Java parity. Official Java 1.20.1 class/mapping inspection shows active EAT uses ITEM arm pose (prior X*.5−18°, Y=0) alongside walking, bob, crouch and other setup. A separate candidate must examine removing the extra Bedrock pose without flattening those motions. This draft does not alter it.

## Blockbench review inputs

`tools/build_animation_preview_fixtures.py --revision ce340a7d7f13cd5be0c0ff95e6556ed3187c81a8 --output <directory>` creates pinned committed-source review inputs: 21 native bbmodels, five profile families, bite stages and a player arm rig. Manifest records source and output hashes. Query clocks and blend gates are retained in sidecars but removed from manual-scrub timelines: those previews cannot certify runtime Molang, engine transforms, or cancel event ordering. No authored reverse/cancel curve is invented.

Client acceptance and production readiness remain false. A future approved runtime candidate requires a new release identity and the existing full-family checks; these bytes must never be published under G142.
