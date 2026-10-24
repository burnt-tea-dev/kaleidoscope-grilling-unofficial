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
node --test --test-name-pattern='^(every fixed|fixed bite|fixed presentation|source routing|dual helper|terminal presentation|ONE render marker)' tests/legacy/test_food_finish.mjs
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

## ONE render identity / sentinel predicate marker (diagnostic only)

The 164 sentinel-only native attempt did not consume food. After normal close,
its exact content file flushed scripting verbose/info but no `164001` or Molang
row. Thus file writing/flush is evidenced, not the attachable predicate or the
retail `query.log` output path. The installed bytes, world RP reference and lack
of a duplicate target identifier are not proof of the active runtime RP.

165 tests this distinction with **one first-person main-hand hold, no use**.
Only the public grilled-caterpillar attachable selects a dedicated main render
controller. The original geometry, material, all curves, visibility, helper and
BP gameplay are unchanged. Third-person/offhand texture selection remains the
original bite texture. In first-person main hand, the diagnostic texture is:

- **Cyan concrete** before the marker latch is set (including a never-executed
  pre-animation control): the dedicated RC rendered, but the predicate latch
  is not evidenced.
- **Magenta concrete** after the same `!v.kg_diag_seen && v.kg_diag_main`
  predicate used by the unchanged sentinel has latched. The assignment sits
  immediately before that sentinel, without modifying either input variable.
- Original yellow/brown texture: the diagnostic RP/RC/context is not established;
  do not interpret it as a logging result. Missing-texture checkerboard, invisible
  model or other colors are invalid/inconclusive controls, not magenta success.

The referenced existing Vanilla paths are `textures/blocks/concrete_cyan` and
`textures/blocks/concrete_magenta`, also present in the installed 1.26.52.3 terrain
atlas. [Mojang samples](https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/textures/blocks)
provide the color sources; no Vanilla images are copied into this pack and no
permanent art/geometry is created. Lighting may change perceived brightness.

Hold once, capture the color, then normally close and inspect only the one
UI-selected content file after flush; restore its previous logging setting.
Magenta plus no sentinel narrows the problem to the call/output path after its
predicate (it does not prove optimization, unsupported syntax or filtering).
Magenta plus sentinel demonstrates that sentinel path, **not** eating timing.
Do not consume in this candidate even if the sentinel appears. Do not retest
other colors, slots or versions without a separately authorized discriminator.
The inherited ONE `none`, 163 failed flash handoff and 164 bounded trace remain
experiments, not production fixes. `client=false`, `production_ready=false`.

### Native165 context failure and the isolated166 RC correction

The one held165 screenshot had no visible model/color. Its same content file,
after normal close, recorded4,441 repetitions of each: unknown
`context.is_first_person`, incompatible Molang argument type, and the dedicated
marker RC missing its default texture. Zero use/consumption and zero164001.
This is a failed marker control, not a predicate or animation acceptance.
The new165 read of attachable context inside the RC is unsupported in that
observed render context; the unchanged pre-animation has not thereby been proven
executed or invalid. The texture/type errors may be a downstream failure to
produce a texture, rather than a misspelled PNG path; native revalidation is
required to separate these. Do not globally replace context queries on that basis.

166 changes only that diagnostic RC (plus required version metadata): it uses
one texture array and a **numeric index**, as in the official
[render-controller array examples](https://learn.microsoft.com/en-us/minecraft/creator/documents/animations/animationrendercontroller?view=minecraft-bedrock-stable).
There is no `c.*` read in this RC. The existing pre-animation `kg_diag_main`
bridges its main-FP decision: false selects the original bite texture, true
selects cyan/magenta from the existing latch. If that bridge variable is absent,
`?? 1` intentionally selects the diagnostic branch and the absent latch selects
cyan. Thus **cyan never proves pre-animation execution**. All53 pre-animation
statements, including the unchanged sentinel and165 latch, are byte-identical.

The test-only RC evaluator now deliberately omits attachable context `c`.
The actual165 expression fails that restricted execution with `c is not defined`;
the actual166 numeric-index expression passes empty-variable cyan, exact-predicate
magenta and pre-derived third-person/offhand controls. This is a regression for
the observed context boundary, not a substitute Molang VM or texture renderer.
The authorized next native test is one idle held screenshot, no recording needed,
then normal close/same-file flush/settings restoration; never use the food.

## ONE visible-flash gate colors (isolated167 diagnostic)

166 produced a visible magenta held model in the one idle screenshot. The exact
post-close content file had scripting verbose/info but zero errors and zero
164001. This supports the active RP and preceding sentinel predicate/latch,
not a working retail q.log sink or successful eating. Do not retry q.log.

167 replaces only the public ONE's client diagnostic expressions: preserve all
15 functional pre-animation assignments verbatim, remove37 client-telemetry
statements and the165 latch, add3 observer assignments (main-FP, local using,
state). The BP's existing bounded `[KG164]` event trace is byte-identical166.
There are no new clocks, offsets, inventories, use policies or geometry/pose changes.
The dedicated RC still uses only pre variables and a numeric texture-array index.

For a main-FP visible model, the actual pre-computed gates select these mutually
exclusive states, in priority order:

| State | Color | Exact source decision |
|---|---|---|
|4|Magenta|`kg_terminal_wait` is true; original mask should hide this main model. If visibly magenta, record the contradiction; never disable the mask to see it.|
|0|Lime|Otherwise `kg_source_projection` is true (the existing active native-use/owner/route predicate).|
|1|Orange|Otherwise the same pre-animation's captured `q.is_using_item` is true: native use without the source projection.|
|2|Red|Otherwise one of active-slot, same-item, owner profile1, owner projection1 is false.|
|3|Cyan|Otherwise native duration is notpositive or owner elapsed is less than native duration−1: the exact terminal clock condition is not yet true.|
|5|White|Uninitialized observer or otherwise unclassified/inconsistent inputs; do not infer a clock or ownership state.|

The numeric observer has no side effects on functional variables. Real main-FP
input combinations make magenta equivalent to the actual original terminal mask,
not an invented substitute. The untouched part_visibility still hides masked
models. Therefore **invisible frames provide no color/state observation**. The
same applies to cropped/obscured/blurred models or ambiguous lighting. Nonmain-FP
uses the original bite texture even if a diagnostic state persisted. White is a
separate unknown fallback, never conflated with cyan or the original food texture.
The six colors reference existing Vanilla concrete textures; no new art is added.

The sole native trial is one normal main-hand serving/use, recorded at30fps in a
new isolated world with the same Cookery. Read only the actual visible flash
frames' color, alongside the unchanged bounded numeric scripting event log from
the UI-selected content file after normal close. No offhand/second-serving/offset
retry. A native-use property and a video frame are not synchronized clocks;
scripting rows may narrow event order but do not timestamp a client frame exactly.
This diagnostic deliberately changes model color and removes the unused client
log calls, so its recording is not a normal-texture performance/parity pair.
Inherited ONE `none`, low framing and terminal flash remain unresolved experiments.
