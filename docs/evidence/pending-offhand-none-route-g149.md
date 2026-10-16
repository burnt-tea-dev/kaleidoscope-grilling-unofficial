# G149: pending seasoning offhand first-person dispatch

## Source correction

Both maintained Java 1.1.1 branches leave the OFF_HAND pending-bottle view to the ordinary renderer. While that hand is actively using this item, its `UseAnim.NONE` branch applies the normal equip translation and renders the item. It does not apply the custom main-hand shake. G148 nevertheless selected a mirrored custom shake in the Bedrock offhand.

G149 removes only that extra FP contributor from the nine PENDING attachables (`pending_seasoning` and fill proxies 1–8). Each description loses the `shake_left` alias and animate row; its `fp_left` hold loses only the matching pending-shake exclusion. The separate sprinkle exclusion remains, preserving simultaneous or stale seasoning-state precedence. Removing the active alias without updating the idle exclusion would leave an unposed item; retaining both would compose two absolute poses.

The existing static grip, all animation documents (including the now-unselected left shake), TP/player/main-hand/sprinkle selectors, meshes, UVs, pixels, materials and BP gameplay remain byte-identical. Exported differences are nine attachables and paired 2.8.149 identity only. UUIDs, Cookery dependencies, API versions, item definitions, four-second duration, captured hand/identity/slot checks, cancellation, completion replacement, ingredients, variants, sound and rewards are unchanged.

## Complete default-path evidence

The maintained source remains [9a1acdab27698457bec16c9362678e574895a28c](https://github.com/breezeth-CN/KaleidoscopeGrilling/tree/9a1acdab27698457bec16c9362678e574895a28c). Published-file freshness, exact JAR hashes and current branch distinctions are retained in the [G148 provenance record](seasoning-tp-item-inversion-g148.md#author-version-and-provenance). The actual published [Forge 1.20.1 artifact](https://modrinth.com/mod/kaleidoscope-grilling/version/dwwwzjdV) and [NeoForge 1.21.1 artifact](https://modrinth.com/mod/kaleidoscope-grilling/version/ao5iN7Jb), official Mojang client/mapping bytes and pinned platform patches were inspected as data. No Java class or game was executed.

- Both published `SeasoningFirstPersonAnimation.render` handlers return for OFF_HAND before cancellation. That fact alone is insufficient, so the uncanceled platform and vanilla branches were followed too.
- `PendingSeasoningItem` returns 80 ticks and `UseAnim.NONE`, starts use with the supplied hand, and returns consume. Consume itself does not request a swing. Non-sneaking block use passes; sneaking placement is preserved.
- The uncanceled hand callback reaches `renderArmWithItem`. Default `IClientItemExtensions.applyForgeHandTransform` returns false; the selected pending item has no overriding client extension. The reviewed author NeoForge registration is fluid-only.
- With `isUsingItem`, positive remaining ticks and matching used hand, the NONE switch branch calls only `applyItemArmTransform` before ordinary item rendering. In official 1.20.1 bytecode it is switch 693 → NONE 736 → translation 743 → join 1273 → render 1489; in 1.21.1 it is 689 → 732 → 739 → 1261 → 1477.
- The translation is the ordinary handed equip transform, not a shake oscillator. Outer camera/bob and display transforms still exist. Built-in pending IDs have no skewer profile, so the separately reviewed skewer mixin returns before cancellation. Concurrent press/brush timers, custom data/resource/scripts or other mods remain outside the isolated default-path proof.

Java tries main-hand interaction before offhand. Inventory placement alone therefore does not prove the action reaches OFF_HAND. Actual OFF_HAND is opposite the dominant arm, not intrinsically physical left. Neither caveat justifies copying the Java custom MAIN_HAND curve into the Bedrock offhand selector.

## Regression and historical conservation

The source generator restricts pending shake selection and its static-hold exclusion to the main/right route. Existing expression tests cover all nine pending IDs and synthetic inactive/use/cancel/restart/completion-identity inputs in both hands. These are selector tests, not execution of native item completion. Independent boolean evaluation of the complete pre-change proposal covered 1,944 valid contexts: exactly 63 changed from `shake_left` to `fp_left`, with no missing or doubled hold; 1,152 unsupported contexts selected nothing.

`tools/pending_offhand_source.py` validates the complete eleven-path postimage against a code-pinned ledger, reconstructs the exact G148 runtime, and then retains the existing G148/G147/G146 conservation chain. Historical access is limited to the nine exact reviewed pending postimages. Forged ledgers, edited bytes, unrelated paths, additions or deletions fail closed. Existing history and earlier source witnesses are not rewritten.

This follows the official [Bedrock animation alias/dispatch and cumulative-channel model](https://learn.microsoft.com/en-us/minecraft/creator/documents/animations/animationsoverview?view=minecraft-bedrock-stable). Existing owner caches retain the official [property/has_property guard pattern](https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontoentityproperties?view=minecraft-bedrock-stable). The static Java parser, independent boolean evaluator and editor tools are project/community tools, not official cross-engine certification.

## Remaining acceptance

Static hold removes a confirmed extra source contribution; it does not prove the current host/socket/equip/bob/camera frame equals Java. Full final rendering, actual use-hand admission, cancellation/restart, replacement and client timing need a paired isolated runtime capture. The minimum pending case is stationary right-dominant use in offhand with empty main hand, looking into air and no concurrent actions: idle, start, 0.25 s, 1 s, 3.95 s, completion, release/restart and slot swap, with actual clocks/identity and camera recorded.

Other FP offhand sprinkle and TP mirrored extensions remain separate required alignment work. This candidate does not grant a functional/visual exclusion, complete Java parity, native client acceptance, family/save/stability acceptance, merge, release or deployment.
