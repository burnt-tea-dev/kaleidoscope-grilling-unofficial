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
remained. All other item use-animation values stay unchanged. Candidates163–172 inherited
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


## Full-completion property boundary candidate (2.8.168)

The 167 isolated native run still showed a full **cyan** model on two terminal
frames, then an empty-hand frame. Cyan only establishes the published clock predicate
was false; it does not measure exact client elapsed or packet timing. The bounded
server trace separately records native completion at start+89 for duration90,
with published elapsed88. The terminal write90 becomes readable next tick; the
subsequent clear becomes readable one tick later. This matches the documented
[Entity getProperty/setProperty next-tick semantics](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable).

This candidate changes only the fixed58 terminal clock comparison from `D-1` to
`D-2`: native completion includes its start tick (`start+D-1`), and the existing
scheduler's most recent readable property is from the preceding tick (`D-2`).
It does not change source curves, arm/helper gating, bite clocks, use duration,
settlement/debit, handoff lifetime, properties, timers, transactions or the six
composited routes. The ONE color observer follows the same changed comparison;
all other diagnostic colors and bounded server trace remain. The inherited
public ONE `use_animation: none` is still an experiment, not a general particle
or third-person fix.

Tests exercise the actual event graph with an optional next-tick property
boundary and actual attachable/RC expressions. The prior `D-1` candidate fails
the reproduced readable-elapsed window; this is not an emulated native renderer
or a claim about arbitrary network delay. There is no new extra-tick hold and
no broadening to the 25-tick release settlement threshold. Release eligibility
alone does not prove inventory/metadata/transaction settlement succeeded.

A same-ID slot/metadata replacement or failed near-terminal settlement can still
be hidden transiently until authoritative property resets become visible. The
new window begins exactly one readable tick earlier; it cannot guarantee zero
wrong-hide frames or arbitrary delayed packets. Early cancellations and earlier
eligible releases retain their prior predicates. This is an isolated candidate
requiring a new native meal observation, not a flash fix or Java parity result.


## ONE last native countdown observer (2.8.169)

168 still displayed one full cyan terminal frame. Its five green CI checks and
source-derived `D-2` boundary did not remove the native flash; do not infer a
stable improvement from one frame versus167's two. This observer leaves every
168 mask, clock, pose and gameplay byte unchanged except version manifests.
Only public ONE appends eight observer-only diagnostic assignments and a texture
branch to the existing dedicated render controller. All eighteen prior
pre-animation assignments remain exact; no latch changes visibility.

The installed Vanilla player's pre-animation and the [official attachable
example](https://learn.microsoft.com/en-us/minecraft/creator/documents/custom_projectiles?view=minecraft-bedrock-stable)
use `max_duration - (use_duration - frame_alpha + 1)` while the main-hand native
use duration is positive. This diagnostic samples those existing main-hand
queries, not generic crossbow/brush queries. It does not assume a final native
countdown is rendered or equate a cached sample with confirmed completion.

On **each observed using frame**, a valid actual source-projection sample must
have positive owner duration, equal native maximum, and remaining in `(0,max]`.
The cache overwrites the last remaining/max; an invalid using frame clears it.
It never retains a maximum/sticky terminal flag. On a stopped frame it does not
sample the zero-reset native query. It retains only an existing snapshot while
main-FP/item/owner/profile/projection and cached maximum still match. Context
loss clears it. Observed restart/countdown increase overwrites the old sample;
a whole session or same-ID metadata replacement between frames is not detectable.

Only the **original cyan branch** gets a new texture interpretation; idle RED,
active LIME, other nonflash colors, and nonmain original bite textures remain.

| Flash color | Exact observation |
|---|---|
| Black | Current owner native duration is nonpositive (tested before cache validity). |
| White | No usable cached sample, invalid observed using sample, context/max mismatch, or uninitialized/recreated observer. Not proof of any one cause. |
| Blue | Valid last native remaining is greater than0 and at most1. |
| Yellow | Valid last native remaining is greater than1 and at most2. |
| Purple | Valid last native remaining is greater than2 and at most4. |
| Brown | Valid last native remaining is greater than4. |

The blue/yellow/purple/brown bins require the stored native maximum to equal
the current positive owner duration. They measure query values, not confirmed render-time ticks or network
latency. Missing/cropped/ambiguous frames cannot be assigned a bin; white is not
zero. The variables are renderer-instance observations, not durable ItemStack
identity. [Molang variable lifetime](https://learn.microsoft.com/en-us/minecraft/creator/documents/molang/syntax-guide?view=minecraft-bedrock-stable)
does not guarantee attachable continuity across replacement or count changes.
One native meal determines whether a local snapshot supplies useful evidence.
If not, retain a bounded presentation limitation rather than guessing `D-3` or
claiming that cancellation and completion are distinguishable from this cache.


## ONE-main local stop presentation candidate (2.8.170)

169's isolated native flash was BLUE: a valid cached native remaining sample in
`(0,1]`, with native maximum equal to positive owner duration. The next recorded
frame was empty-hand. This establishes one usable local snapshot, not a universal
completion/cancel detector or packet-delay measurement.

Only the public ONE attachable appends two local presentation variables after
its unchanged26 pre-animation statements. The first observes a same-owned main-FP
`using=true` to `using=false` edge and arms only with retained valid remaining in
`(0,1]` and matching native maximum/owner duration. It can remain armed on later
stopped frames only while that same context/cache remains valid. The second saves
the current owned-use flag for the next evaluation. Every observed using frame
clears the hold (and the existing observer overwrites/invalidates its sample).
Observed identity/owner/profile/hand/duration/context loss or invalid cache clears
it, even if that permits a later packet-order flash. Missing cache or a fresh
instance without an observed using edge cannot arm it.

The dedicated public ONE main-model RC adds `!kg_local_terminal` to its existing
visibility predicate. The original server `kg_terminal_wait`, clocks, textures,
geometry, poses, arms/helper, use policy and every BP gameplay/transaction byte
remain unchanged. Other57 fixed routes, six composites and offhand receive no
local mask. This is not a generic cleanup or expansion of the inherited ONE
`none` experiment. BLUE still reports the unchanged observer classifier; with a
valid observed edge this model should now be hidden by the added local mask.

The hold has **no independent timeout**. Its bound is observed ownership reset
or new use, not a promised number of frames. Indefinitely stale owner fields can
retain it; no arbitrary packet-delay or zero-residual guarantee is claimed.
Same-ID metadata/slot replacement and a whole use between rendered samples are
not distinguishable from these inputs. A failed near-terminal settlement or
same-ID replacement can therefore be hidden until the existing authoritative
clear becomes observable. Tests explicitly preserve this limitation, inventory
and nutrition; they do not silently treat release eligibility as settlement.

Regression tests run actual emitted JSON with persistent render-state inputs
and the unchanged server event graph. The same targeted visibility assertions
fail against immutable169 JSON. Coverage includes early/eligible releases,
invalid/no sample, no observed false frame between uses, fresh-instance stop,
new-use reset, owner/context changes, failed settlement, same-ID replacements,
and continuous servings. There is no extension of the arm/helper animation or
new debit. The next native trial must determine whether this ONE full-completion
flash disappears; source tests alone cannot accept it or the broader Java poses.


## ONE live source-route clock observer (2.8.171)

170 still showed a full angled LIME main model before an empty-hand frame.
A same-session CRF25/lossless-CQP0 recording control also showed it in both
valid meals. This excludes lossy quantization and B-frame reordering as necessary
causes, not X11/compositor sampling, forced-CFR effects or arbitrary capture load.
Video frames are not game ticks; server and client frame clocks remain unsynced.

This diagnostic appends one private observer after all28 unchanged pre-animation
statements. Only the former LIME (actual `kg_source_projection=true`) texture
branch changes; no visibility, cache, local hold, clock, geometry, pose, helper,
BP event trace, use policy or settlement changes. Every other route is unchanged.
The existing native remaining/maximum samples are read, not resampled or clamped:

| Source-route color | Meaning of the current observed inputs |
| --- | --- |
| WHITE | New observer uninitialized/unknown; never treated as numeric zero |
| BLACK | Owner duration observed nonpositive (including existing missing-property-to-zero mapping) |
| GRAY | Positive owner duration but native maximum nonpositive/different, or remaining outside `[0,max]` |
| LIGHT_BLUE | Matching positive maximum and current remaining exactly zero |
| PINK | Matching positive maximum and current remaining in `(0,1]` |
| GREEN | Matching positive maximum and current remaining in `(1,max]` |

BLACK does not prove an absent property or a server-side zero. GREEN does not
identify89 or a new use. In actual JSON counterexamples, D0/remaining0 and
D90/remaining89 both give stage0/clock0, whereas D90/remaining0 gives stage2 and
4.45seconds. The next single-meal observation can distinguish these broad
branches, not prove the underlying lifecycle or packet cause. No color may be
assigned when the independent model is invisible or ambiguous. The stopped-cache
BLUE/YELLOW/PURPLE/BROWN/WHITE/BLACK branches and other gates retain their meaning;
non-main-FP retains original textures. All concrete aliases are installed vanilla
assets, not proposed final skewer art. This is not an animation or repeat-eating fix.


## ONE owned presentation handoff candidate (2.8.172)

171's visible full model was GREEN: source projection true, matching positive
native maximum/owner duration, and current remaining greater than1. This does not
prove a particular counter value or new session. Actual171 JSON shows an armed
local hold is unconditionally discarded when native using returns true, including
when owner elapsed stays87 or rises88. The same branch is indistinguishable there
from a genuine fresh owner clock at0/1.

Only public ONE changes its already-armed local hold. Two private snapshots capture
owner elapsed and duration while unarmed, before evaluating the stop-edge rule.
Context here is the original main-FP/item-ID/owner profile/hand/projection/positive-duration tuple; posture or occupied opposite hand blocks the source route but is not itself owner-context loss.
Once armed, those snapshots remain stable. Extension across native using=true
requires a saved anchor in `(0,savedDuration]` and a currently valid owned native
sample/source admission. Missing/zero/out-of-range anchors, invalid using samples
or using source fallback retain the prior170 fail-visible behavior. With those
checks satisfied, a native-use rebound alone no longer unlocks the hold. Observed context/identity loss, duration mismatch, or owner
elapsed strictly below the captured anchor unlocks it. An unarmed instance retains
the original valid-last-sample `(0,1]` plus observed true-to-false use-edge rule;
a rising counter or missing stop edge cannot arm it. The existing native sample
cache still overwrites/invalidates normally. RC predicates, server mask, clocks,
clips, helper/arm poses, all other57 fixed/six composite routes and BP bytes are
unchanged (apart from required version manifests). No debit or input-policy fix.

An elapsed regression is **reset-like evidence, not a session nonce**. A genuine
continuous serving may remain masked until its owner reset reaches the client.
Low frame rate may miss that reset; a nonpositive/missing anchor cannot distinguish a reset and therefore does not
extend masking into resumed use;
same-ID metadata/slot replacement remains invisible to these client inputs.
Failed settlement or replacement can be hidden until authoritative context clears.
There is no independent timeout or arbitrary-latency guarantee under an otherwise
valid indefinitely stale tuple. Invalid native using samples deliberately unlock
the retention extension. New stop-edge admission is unchanged; an existing eligible hold stays pending
until observed reset/context loss, including a second stopped frame after rebound. Context loss still clears
it, even if another delivery order later exposes a full model.

Actual171 counterfactual visibility tests must fail before this change. Tests also
cover delayed replicated new-start reset, normal continuous servings, early cancel,
failed settlement, same-ID replacement, missing sample/edge and duration changes.
Native acceptance remains pending. If a new terminal flash remains, do not widen
the hold or add guessed timing thresholds: stop and design an explicit session-ID/
atomic presentation contract with its compatibility costs before another fix.

The unchanged BP same-tick `SETTLED` guard cannot distinguish a prior StopUse
from an immediate new-session StopUse on that exact completion tick. The new
actual-main early-cancel control starts the second serving on the next tick and
cancels before its reset publishes; it does not claim that older input-order
ambiguity is fixed. Repeat-eating policy remains a separate investigation.


## ONE native EAT single-factor control (2.8.173)

172's isolated public ONE meal and subsequent bounded A/B/C/D controls showed no
specified complete terminal model rebound at the reviewed completion boundaries.
The early release retained its item/idle view, and the second continuous serving
was visible. These limited observations do not establish all-family, TP/offhand,
normal-material, Java-pose or repeat-eating-policy acceptance.

This control changes only public `grilled_caterpillar_skewer`'s item component
`minecraft:use_animation.value` from diagnostic `none` back to `eat`. The pinned
Java `MultiBiteSkewerItem.getUseAnimation` returns `UseAnim.EAT`, and the original161
Bedrock item used `eat`. All172 RP content (including diagnostic colors, cache,
local hold and poses), BP scripts/debit, duration/nutrition and other item values
remain identical apart from required version manifests.

The native item component is not main-FP-scoped: it applies to this ONE item
across relevant first-/third-person and offhand contexts. Only a main-hand meal
is tested here; matching the Java EAT name is not proof of Bedrock pose parity.

The purpose is to test whether the narrow172 terminal protection depends on the
experimental native-pose suppression. Native icon-textured food particles may
return; that is expected for this control and must not be confused with the
solid diagnostic-color held model. The helper remains original food-textured,
so any ambiguous fragment must remain unclassified rather than assigned a cause.
No color removal, particle workaround, TP adjustment, FP offset or repeat-eating
prototype is included. The new test checks the actual item configuration only,
not native visuals. One reviewed native meal is required before any later plan
to remove diagnostics or expand families; no universal fix is claimed here.

## ONE normal-material diagnostic cleanup (2.8.174 candidate)

173's single EAT control did not show the specified solid-color main-skewer
terminal rebound in its reviewed interval. Large original-textured planes did
return and remained visible after the first empty-slot frame. This does not
identify their renderer/emitter or accept first-person fit, TP/offhand, other
families, or repeat-input policy. EAT remains enabled here.

Only public ONE returns to its original five stage texture aliases. The private
RC keeps its existing identifier (despite the historical `diagnostic` name),
geometry, material and visibility expression. Fifteen color aliases and three
pure classifiers (`kg_diag_state`, `kg_diag_clock_bucket`,
`kg_diag_live_bucket`) are removed. The remaining 28 pre-animation statements
are unchanged, including `kg_diag_main`, `kg_diag_using` and the `kg_diag_clock_*`
cache variables: they are functional inputs to the tested local hold, not dead
telemetry. No rename or broader refactor is hidden in this cleanup.

The one-shot server `ONE_TRACE` state, `traceOneEating`, and its logging/read-only
hooks are removed. No client `q.log` remains to remove: that failed observation
path was already retired in167. No new subscriber, timer, property, item ID,
geometry, pose, particle edit, or settlement/input policy is introduced. All
other57 fixed and six composite visual routes remain unchanged. The pre-existing
same-tick StopUse ambiguity and local hold's missing-sample/reset/identity limits
remain; removing diagnostics does not resolve them.

Existing tests now check normal textures and no diagnostic output while retaining
cache, terminal-edge, owner-reset, early-cancel, fault, replacement and continuous
serving behavior. An external read-only comparison executes the frozen173 and
candidate174 actual modules on the same deterministic event graphs and compares
inventory, nutrition, owner properties, animation selection and nontrace logs.
A separate actual-JSON comparison checks every retained variable, clip selector
and visibility output across independent query values and transitions. These
are source-level evidence, not a native Molang engine or client-rendering proof.
The restored material needs its own isolated native check; no production or
all-family acceptance is claimed.

## Released-use two-session observation (175 source candidate, not a fix)

The user identified continuation after release/a single tap, not normal held
continuous eating; whether another item was deducted is unknown. This isolated
observer leaves174 EAT, normal textures, cache/hold and all gameplay decisions
unchanged. The two rejected same-tick cleanup prototypes are not included.

One nonpersistent server observer emits script readiness from the existing
single-player/no-active scheduler result. It deliberately does not query held
inventory; the operator must verify count2 separately and the first accepted
public ONE main Start checks its captured initial-use count2. The numeric sentinel must
actually appear in the designated contentlog before use; source execution cannot
prove disk flush. There is no client q.log fallback. A two-use label follows
existing use-object identity for script callback comparison only, not a native
nonce. Inactivity does not close it. The second Start never resets300tick/512row
budgets; a third target Start records then closes logging only. Existing observed
Start/ownership-loss/leave/death branches close scope. An inactive slot/item change
is not polled; the next Start check or budget bounds that missing observation.

The initial observer design was rejected because extra inventory/component reads
could consume transient original failures and change a debit into success. The
lean revision performs no such reads (including native event/ItemStack payload
re-reads) and never fabricates empty count0 from a
failed tolerant getter. It records original event payloads/guard outcomes/script
owner lifecycle, the existing hungerSettle held-count read, and actual original
write callback requests/return-or-throw receipts. Requested count is not inventory
readback; external/native quantity changes are unknown unless independently
observed. No health/stat or replicated-property snapshots are claimed.

Original Stop/Complete predicates/evaluation order remain intact. Actual debit/
restore and nutrition callbacks are bracketed in try/finally preserving returns,
throws and rollback. The original held amount/remaining reads are stored at their original
evaluation points, not repeated or forced through a short circuit. Entry fields
therefore deliberately remain unknown; initial amount comes only from the
immutable identity already captured by gameplay. No input control, stack/metadata mutation, interval,
listener, player property, cooldown or repeat-policy fix is introduced. Only
numeric fields are serialized; identities/lore/coordinates are excluded. Owner
lifecycle rows do not claim HUD show/hide intent or client display.

Source tests and actual174-module differential scenarios are not physical release,
engine ordering, client rendering or sink acceptance. The observer itself can
perturb wall time. Native input-up requires separate approved evidence, not caller
return or ItemStopUse; those clocks retain explicit uncertainty. Independent review
and a frozen candidate are required before publication or any native trial.
