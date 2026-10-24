# Source skewer motion reconstruction

This is the isolated T4.2 fixed-skewer candidate authorized on 2026-10-24; it does
not complete P3 or bypass its native settlement/ownership spike. G156 acceptance
inputs, player.json, inventory logic, existing item IDs and normal held/TP clips
are not replaced. No release or deployment is requested.

`motion.py` reads the existing pinned `data/java/animation_curves.json` arrays
and implements the authored sampling, arm application and ordered item transforms.
`THREE_RANDOM` must resolve once to THREE or THREE_ALT before sampling. ONE has
**two** bite checkpoints. The source sampler interpolates partial ticks; bite geometry does not. The retained live main-hand adapter adds `q.frame_alpha`, while offhand motion still uses replicated integer `eat_elapsed_ticks / 20` (tick-stepped). Offhand clock smoothness and packet timing remain pending native validation; no new alpha is inferred without that evidence.
The actual unmodified Java classes are executed by [java_oracle](java_oracle/README.md),
with narrow, documented game-API surrogates rather than a game/JOML renderer.

`compiler.py` reconstructs the ten first-person item clips and player arm targets.
The inherited item-slot/skin adapter remains explicit: upright target origin
`24 - (1.62 - 1.501) * 16 = 22.096` pixels; model/hand matrix conventions and
slim-skin item offsets still require visual acceptance. An old ONE/right
profile-specific +4.67658183-pixel vertical shift is removed from both arms;
this is source-basis alignment, not proof that the new camera image is correct.
Third-person keeps native arm behavior plus the authored held-model route; the
pinned Java custom eating classes are first-person only.

58 fixed routes (39 canonical raw/cooked/ordinary identities plus 19 existing
ALT identities) now select one source-profile projection rather than overlapping
family calibrations. The inactive arm/item is render-masked for active-only
profiles, matching the Java first-person mixin; the opposite inventory stack is
not touched. ONE/THREE retain the existing occupied-opposite-hand fallback, at start and
dynamically during use: their helper shares that item binding, so suppressing
the real held item independently requires further model/binding work. This is
an explicit Java-parity gap, not a supported occupied-helper-hand case.
The three composited surfaces (secret, mysterious, dark; six routes with ALT)
retain their prior selectors and models and are **not reconstructed** here.
Their use of the common item clips does not make their ingredient/held behavior
accepted. Their lifecycle/visibility selectors are not changed by the fixed-route
handoff below.

## Author and review

```sh
python tools/skewer_animation/compiler.py --output /tmp/skewer-clips
python tools/skewer_animation/compiler.py --review-bundle --output /tmp/skewer-review
python tools/test_java_extract.py
node --test --test-name-pattern='^(every fixed|fixed bite|fixed presentation|source routing|dual helper|terminal presentation)' tests/legacy/test_food_finish.mjs
```

The review bundle contains actual per-family geometry/texture pairs, current
clips and a 64-route checklist. It is **not a pack** and contains no manifest,
player skin or world. It records missing inherited vanilla textures for the
unrebuilt composited surfaces instead of inventing substitutes. Import the
geometry and clips in the existing operator-controlled Blockbench session;
save `.bbmodel` sources only after the operator verifies the codec/binding.
Record any preview-only clock/binding replacement. Use the already reviewed
loopback MCP plugin with remote prompts and arbitrary execution disabled; this
compiler does not install or control any GUI/plugin.

Review all four hold contexts, both motion sides, every bite before/at/after,
normal completion, interrupted/switch/continuous use, occupied opposite hand,
standard/slim skin and complete framing (no cropped terminal model). Then run
same-candidate native scenarios to establish actual use/debit/property ordering.
A numeric matrix or JSON-expression test is not a screenshot or native clock.
`client=false`, `production_ready=false` until those gates pass.

The subset-expression helper in `tests/helpers/skewer-presentation.mjs` evaluates
actual JSON decisions under supplied query inputs. It does not model rendering,
network delay, Bedrock's evaluator, or inventory consumption. Numeric source
checks compare 3,730 actual Java outputs with the Python reconstruction; they do
not execute Minecraft's renderer. Assets/code retain the repository attribution
and original CC BY-NC-SA/BSD notices.

## Numeric accuracy is not visual acceptance

The Python-source comparison tolerance is **0.00025** position/degree units;
that tolerance does not describe JSON interpolation. Separate tests evaluate
actual emitted JSON linear keyframes at a 3 ms grid: item transformed-vertex
error is bounded below **0.05 model pixels** at the three documented test
vertices; arm target-position error below **0.1 model pixels**, and scalar arm
rotation error below **0.5 degrees**. THREE helper scale-ramp position keys are
sampled at at least 480 Hz; ONE uses an exact step, THREE an explicit clamped
source cubic, and fixed helper visibility follows the source `scale > 0.001`.
These finite-grid bounds are numerical candidate checks, not global proofs,
Minecraft rendering tolerances, or acceptance of camera/skin alignment.

## Native findings and bounded terminal handoff

The isolated 2.8.161/162 native ONE trials reproduced a full held-model flash
between native use ending and the consumed inventory view disappearing. The
162 single-factor change (`grilled_caterpillar_skewer` native `eat` → `none`)
removed the large icon-textured planes in that recording, while custom crumbs
remained. The actor changed from Kai to Sunny; this is not an arm/skin pixel pair
or evidence for expanding `none` to every food. Low framing and terminal flash
remained. All other item use-animation values stay unchanged. The next candidate inherits
this **ONE-only diagnostic `none`**, not a production particle fix. Java itself
uses EAT; occupied-hand fallback and third-person native pose regressions from
`none` remain unaccepted, so it must not be generalized or silently promoted.

The next candidate separates presentation retirement from gameplay settlement.
Successful admitted fixed-route completion/release removes the gameplay session
and performs the existing debit/reward immediately, retaining its five existing
owner fields only until the next **actual scheduler tick**. A fixed attachable's
main render controller hides the stale full model when native use is false and
that owner/hand/item still matches at the terminal clock. Successful release
publishes that terminal presentation clock; early cancellation clears it
immediately without changing deferred gameplay cleanup. It does not hold an arm, extend the helper,
change third person, or defer/repeat consumption. New starts invalidate the old
presentation token; cancellation, identity/slot mismatch, spawn and leave clear
it. Both normal and animated-slime controllers use the same ownership mask.

This one-boundary handoff is a bounded renderer-adapter candidate, **not** an
acknowledgement of client inventory packets. The client query cannot distinguish
same-ID replacement metadata before server properties arrive. Server-only event
and actual JSON-expression tests cannot establish packet order, visual absence
of flash, or continuous-use smoothness. Native completion/cancel/switch/stack
recordings on the new immutable candidate are still required. Existing T3.4
TODOs (including stale completion effects and logout settlement) are not closed.
