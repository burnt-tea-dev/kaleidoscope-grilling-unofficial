# Isolated Heavy Metal payment probe

Never install this diagnostic on a player server. It changes a small flat-world
area and creates one native pig. It imports the unchanged production Heavy Metal
handler, effect writer and their dependencies under a diagnostic pack identity.
It does not replace production functions or simulate their effect transition.

Use BDS 1.26.60.6, server 2.12.0-beta and Beta APIs in an inaccessible disposable
world. Copy production scripts and `probe.js` into its script directory, select
the probe as the entry and provide the existing `kg_java21.heavy_metal` sound
definition/sample in a diagnostic RP. Record the actual inputs and overlay.

The [dated observation](observed.json) passed with Beta APIs and upcoming creator
features enabled. It records the original handler/writer hashes, native callback
rows and both normal-stop stages; it is a capability probe, not a family candidate.

One native lethal `applyDamage` triggers `world.beforeEvents.entityHurt`. The
probe calls the real handler and records provisional health, cancellation and
the immediate saved-field readback. It requires Heavy Metal to be consumed and
12000 ticks of poisoning to be written while the last-tick effect is still
active, followed by native health 1. Stop normally after stage 1, restart the
same world, and require stage 2 to read the same poison deadline, unrelated
effect, claim and health. Keep both logs and stop normally again.

This establishes only the measured restricted-callback writes, health update
and affected saved-data behavior. The actual main event routing and failure
rollback are tested separately in the ESM scenario. It does not establish
totem/absorption ordering, other-addon arbitration, client visuals or sound.

`damage_order_probe.js` is a separate four-case diagnostic with server-gametest
1.0.0-beta. Use it as the entry instead of `probe.js`; it creates two pigs and
two simulated players and disconnects both players after one observation.
The [damage-order observation](damage-order-observed.json) records full versus
partly spent absorption and native offhand totem versus totem plus Heavy Metal.
Its controls passed while Java parity failed. Do not call its execution success
a repair. It needs one normal stop and does not repeat the expiry/save cycle.

[The later passive fatal-sensor probe](../fatal-sensor/README.md) is a separate
actual-Player capability observation. Its native event witnesses are positive,
but the predicate marks both full-shield survival and spent-shield death fatal.
It does not repair or replace this handler and changes no production runtime.

`ordinary_maxfloat_probe.js` prepares the remaining Ordinary cause observation.
The older Totem-priority probe used 100 damage for selfDestruct; only override
used Float.MAX_VALUE. That result does not settle selfDestruct at the actual
Ordinary amount. Use the candidate's real `applyOrdinary` and registered
food/effect handlers with two native Survival Players, one at a time, through
the default Ordinary food and its unchanged preparation/animation variants. The
QA pack must include all three existing Ordinary definitions. Require a
native completion and one max-float hit, an untouched offhand totem and no
TotemOfUndying healing. Without Heavy Metal the Player must die; with it the
existing handler must pay before cancelling and rescue to 1HP. Do not replace
native methods or callbacks, infer remaining shields, replay damage or add a
Player overlay. This is not complete main startup, saved-state, armor/resistance
bypass or client validation. Any execution requires the shared owner's slot.

The [2026-11-06 native observation](ordinary-maxfloat-observed.json) passed all
12 checks with actual 100-tick food completions. No Heavy Metal means death,
with the offhand totem untouched and no totem heal. Heavy Metal means the real
handler pays, cancels and rescues to 1HP, preserving the totem and Warmth. The
first fixture omitted a variant and stopped before damage; that failure is
retained separately. Both temporary worlds were removed after normal stops;
the successful run returned the shared slot before source CI. These are narrow
native results, not a claim about armor/resistance or the full family release.

`ordinary_creative_probe.js` prepares only the previously unmeasured Creative
boundary. Both reviewed Java branches register Ordinary as always edible and
call its custom `ordinary_skewer` source after committed food, without excluding
Creative. Their vanilla Player immunity checks allow `bypasses_invulnerability`;
the author's additive tag includes Ordinary. This shares that tag with vanilla
generic_kill but is not a call to genericKill. In contrast, both vanilla server
game-mode callers return PASS for Spectator before invoking the item, so do not
create a synthetic Spectator food/damage requirement.

Use unchanged G242 scripts, the existing three Ordinary definitions and own
Player definition. Require the actual Creative mode, native food completion
with its serving retained, existing Ordinary feedback, native damage events,
and the no-Heavy/Heavy outcomes separately. One ordinary native attack controls
for Creative immunity. Feedback request counters witness code execution, not
audible sound. Any execution requires the shared owner's fresh slot first.

The [2026-11-06 Creative observation](ordinary-creative-observed.json) has 11
valid entry/control witnesses and four unmet Java damage/rescue expectations.
Both native 100-tick meals complete with their serving retained and two actual
Ordinary feedback requests. Neither produces a hurt/heal/death event or changes
10HP; Heavy Metal remains unpaid with a null claim. The normal attack control
also preserves Creative immunity. Raw passed=false and the wrapper's exit1 are
retained; BDS itself stops normally with exit0, no errors/OOM or Players. QA was
removed and the slot returned before source CI. No runtime or release identity
changed. This is a selected-path counterexample, not proof that every cause,
kill operation or future native capability fails; no unverified replacement is
adopted. The existing Survival results are reused within their original scope.

`ordinary_kill_command_probe.js` prepares a separately authorized, single-entry
Creative capability question. Official [kill](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/kill?view=minecraft-bedrock-stable)
supports player targets. Lack of a promised callback order prevents adopting it
without evidence; it does not prevent this bounded observation. One no-Heavy
and one Heavy Player use the unchanged G242 handlers and own Player definition.
The same exact name/tag selector first passes native testfor, which shares
kill's Game Directors/cheats requirement, then receives one kill command.
Record the native command result, actual mode, before/after-hurt cause/amount,
cancel state, claim/effect payment, heals, death and observed callback order.
No synthetic hurt, effect prepayment, health clearing, mode/immunity switch,
Entity.kill, cause sweep or new Player overlay is allowed. This is not food
completion or a production repair. Prepare once, obtain a fresh shared slot,
then stop/clean and return it immediately; PR375's raw/history stay unchanged.

The [2026-11-06 command observation](ordinary-kill-command-observed.json) has
eight valid input/target/control conditions and seven unmet effect/Heavy
expectations. Both exact selectors pass testfor with successCount1, but both
kill commands return successCount0 without throwing. No before/after-hurt,
heal or death event is observed; both Players stay at 10HP and Heavy remains
unpaid with a null claim. Target selection is witnessed; a successful kill is
not, so do not infer post-kill cancellation or payment order from absent events.
Raw passed=false and wrapper exit1 are retained. BDS stops normally with exit0,
zero errors/OOM/Players, and QA is removed before returning the slot, before CI.
This selected script-command configuration is not adopted as an Ordinary repair.
No second origin, Entity.kill, cause sweep or replay follows this observation;
the result does not rule out all other native capabilities or versions.
