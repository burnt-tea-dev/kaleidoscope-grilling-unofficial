# G147 owner eating property guards

Source candidate based on G146 commit `58f2fc72a286b1ddf210128017c36f14dad759a9`, tree `06988449f9f85872d5fa5fe6f312b7db85dff429`. No native editor, Minecraft client, saved-world, release or deployment acceptance is established by this document.

## Demonstrated gap and bounded change

The supported G146 player definition declares all required properties. However, 65 eating attachables read owner `eat_*` properties without guards, including an eager third-person idle clock read. An owner lacking these properties can therefore produce content errors. This is a robustness gap for missing-property contexts, not evidence that normal supported player rendering fails.

Microsoft documents that an absent `query.property` returns zero and raises a content error, and recommends `query.has_property` for this case. The Molang arrow operator changes entity context, so the guard and read must both address `c.owning_entity`.

- [Entity property semantics](https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontoentityproperties?view=minecraft-bedrock-stable)
- [Molang context and conditional evaluation](https://learn.microsoft.com/en-us/minecraft/creator/documents/molang/syntax-guide?view=minecraft-bedrock-stable)

G147 reads exactly five properties through explicit guarded ternaries at the start of each affected attachable's `pre_animation`: `eat_profile`, `eat_hand`, `eat_projection`, `eat_native_ticks` and `eat_elapsed_ticks`. Each result is cached in a distinct local `v.kg_owner_*` variable. Existing selectors, pre-animation expressions and three item-animation documents consume those values. The generated runtime changes 65 attachables and three animation files and is 93,380 bytes smaller than G146 before the two manifest version changes.

The zero fallback is retained independently for each absent property. No direct player/native query, animation curve, geometry, UV, texture, binding, render-controller predicate, food duration, settlement or persistence behavior is intentionally changed. Unavailable actor references and actual native content logs require separate engine verification.

## Source and regression boundary

- Existing generator `tools/build_eating_motion.py --check` owns the final guard stage and checks the entire generated output.
- `test_eating_owner_context.py` exercises actual current scripts, compares present-property behavior and zero fallback against the exact predecessor, and checks that every cached item clip has initialized attachable consumers.
- The G147 inverse accepts only the exact initialization and reversible substitutions. Historical byte readers also require unchanged canonical serialization before inversion; malformed or unrelated changes remain rejected.
- The prior 19-path runtime ownership manifest and its pinned hash are unchanged. The new boundary derives G147 from the full exact G146 runtime plus only this guard transform and version 2.8.147 identity, then checks the existing G146 ownership boundary.
- Historical generators and source pins remain immutable. Current behavioral test harnesses execute the actual initialization with a shared variable store; historical comparisons use only the validated inverse.

These checks execute source expressions or compare bytes. They do not run the Bedrock Molang parser or establish native timing, rendering, content-log silence or long-term live stability.

## Pending acceptance

Actual Blockbench scoped import/playback and bridge export/schema diagnostics are separate. First/third person, both hands, interruption/restart, missing-property owners and native content logs remain to be tested against the eventual exact candidate. Existing external Cookery 1.6.0 resources must be checked with the exact dependency; old or newer asset versions do not close that dependency evidence gap.
