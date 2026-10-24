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

## Isolated ONE terminal trace (diagnostic, not a fix)

The native 163 recording still showed terminal full-model flash, so extending
presentation ticks is not justified. The next isolated diagnostic changes only
telemetry in the public grilled-caterpillar route, plus required version metadata.
All existing poses, selectors, mask expressions and settlement remain unchanged.
It inherits the ONE-only `none` experiment and all its limitations.

The operator enables **Content Log File** through native Creator settings and
records the exact displayed path and prior setting. Do not read launcher/auth
logs. First hold one public caterpillar in first-person main hand without using
it. The actual attachable emits numeric sentinel **164001** once per instance
through documented [`query.log`](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_log?view=minecraft-bedrock-stable).
If the sentinel is missing or parser errors occur, stop before consuming food;
source syntax checks are not proof of a retail-client log sink.

After sentinel confirmation, one normal main-hand use arms an independent local
`query.delta_time` clock from local use, owning-entity use, or matching published
ONE ownership. This also records a divergence where both client use queries stay
false while the server ownership has arrived. Numeric rows begin **164010** and end **164011**, with
19 values in order: row, render-evaluation index, relative seconds, local using,
owning-entity using, owner profile, owner hand, owner projection, owner native
ticks, owner elapsed ticks, local main-use duration, frame alpha, active-slot,
same-item, using-owned, terminal-wait, source-projection, bite-stage, helper-visible.
Emit the first sample, then the >=3.5-second terminal window or a local-use=false
sample. Stop after recording the first all-inactive sample, or at **300 rows /
7 seconds**. The one-shot latch is per attachable instance; unloading/recreating
it resets that latch, so only one operator-controlled serving/use is allowed.
Attachable disappearance on debit ends the trace; missing later rows are not
proof that properties reached zero. Render evaluations are not video frames.

Server lines use `[KG164]` plus a numeric JSON array: phase, server tick, relative
tick, event remaining ticks (-1 outside events), selected slot, main-hand count,
same-use-identity boolean, active-session boolean, and the same five owner fields
(profile, hand, projection, native ticks, elapsed ticks). Phases: 10 start,
11 published, 20 stop callback, 30 complete callback, 31 handoff publication,
40/41 before/after clearing, 50 existing scheduler observation, 60 a new native
use boundary (closes the old trace before any new presentation change). The
server trace also closes after recording an all-inactive scheduler sample or
player leave. A stable player ID is used internally, never logged. Only the first
public main-hand ONE session per script lifetime is armed; **300 rows / 140
ticks** bound output. Instrumentation exceptions cannot alter gameplay.

No player names/IDs, lore, coordinates, world data or credentials are logged.
Inspect only this bounded task trace from the exact native content-log path,
record actual syntax/format before decoding, and restore the prior logging
setting afterward. Logging can perturb timing; a trace is diagnostic evidence,
not a parity pass or permission to retune offsets or settlement.
