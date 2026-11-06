# Creative Ordinary through a fully loaded network Player

Prepared only; no BDS has run this fixture. Runtime, Player, item JSON,
baseline and release identity remain G247. This is a different caller from the
closed G242 kill observation and does not reinterpret that result.

The old `ordinary_creative_probe.js` creates GameTest SimulatedPlayers and calls
`useItemInSlot(0)`. Its effect module imports the real food module, so the old
100-tick completion really entered the registered production food handler. It
was neither a direct completion call nor a normal network login. The old raw
11 controls / 4 unmet expectations remain valid only in that scope. The old
network r4 sent kill, not item use. No fully loaded normal network food result
exists among these observations.

Pinned Java 9a1acdab, both maintained branches: ModItems allows always-edible
Ordinary; MultiBiteSkewerItem.finishUsingItem calls CursedSkewerItem's
`afterFoodCommitted`, which attempts ordinary_skewer damage at Float.MAX_VALUE
without a Creative exclusion. The common additive bypasses_invulnerability tag
contains that damage type. This one no-Heavy, no-invincible case therefore
expects damage/death, with the native totem untouched. No Heavy rescue claim is
made. See the existing PARITY references for the Java files and damage order.

## Exact source and preparation

Use `ordinary-network-food-contract.json` and the observer in this directory.
Place the observer beside the unchanged production `scripts/main.js` and point
the single diagnostic script-module entry to `scripts/ordinary_network_food_probe.js`.
It imports full main first. Do not separately start a second copy of main,
replace any production handler, or load a partial set of food subscriptions.
Use the existing isolated-copy preparation with fresh diagnostic pack UUIDs;
preserve the source's own Player, API versions and required experiments. This
is not a new game release or a reason for a new complete backup/save cycle.
The shared owner prepares a small new QA world; the old G kill world is gone.
Do not borrow the stopped TACZ world or change its packs.

The existing reviewed host/dependency setup stays with the shared preparer.
Keep the two fixed names, Creative before login, max-players=2,
online-mode=false, allow-list=false, cheats, safe stationary ground, and the
existing private netns/cgroup limits. No LIVE, mode or immunity changes.
Use the root-fixed v11 driver and its supplied source snapshot plus helper;
do not rebuild or modify it. Start it in the same unit with `actions=True` and
`share_resource_packs=True`, preserving the existing private ICE interface,
localhost and exact /32 allow rules. Wait for both real spawned records and
v11's initial-loading-end record. Sent loading/input is not server acceptance.

Only qaNetPlain receives one factory-produced Ordinary. qaNetHeavy stays idle.
Preparation uses the existing `prepareProducedFood(new ItemStack(...))` output
factory with cold, empty-seasoning public metadata. It sets QA health10,
hunger10/saturation0 and one offhand totem. Both Players must already be
Creative; the subject must have no custom/native effects or claim. These are
legal isolated initial conditions, not damage, mode or immunity workarounds.
The source JSON permits can_always_eat; the reduced initial hunger avoids an
incidental full-hunger ambiguity without changing the Creative question.
No item, effect or health is rewritten after ordinary readiness.

## Runner events and markers

1. Send `scriptevent grilling_qa:prepare_ordinary_network_food` once after both
   Players are loaded. `GRILLING_QA_FOOD_READY` follows 40 native no-input ticks,
   after factory metadata survives the normal preparation/animation routing.
2. During preparation collect real driver `input item_evidence` for selected
   slot0, count1, registry-found, nonzero stack network ID, matching the actual
   readiness item (base/alternate/plain). It must come from server inventory
   data, including v11 NormalInventoryTransaction handling, never the outgoing
   `UseTransaction` evidence. Inventory packets can precede READY; use the
   latest matching record since this preparation began, not only later lines.
3. Send `scriptevent grilling_qa:arm_ordinary_network_food` once. Wait for
   `GRILLING_QA_FOOD_INPUT_READY` case=ordinary, then call the unchanged helper
   `send_player_action(process, 'qaNetPlain', 'use_item')` once.
4. Keep holding until `GRILLING_QA_FOOD_RELEASE` case=ordinary. Immediately send
   the one native `release_item` action. The marker comes from actual native
   completion or a bounded 160-server-tick timeout; it is not a completed event.
   Do not release after 25 ticks or after a guessed wall-clock sleep. Source
   base/alternate durations are100/90 ticks; a naturally selected plain item is
   25 ticks. All are recorded in the JSON contract; no animation/config is forced.
   An 8-tick post-release window observes the source's queued damage and native
   hurt/heal/death/totem order. CompleteUse, its native duration and fatal-feedback
   request delta are separate caller witnesses; source feedback alone is not
   native completion or audible sound. A release-only settlement cannot pass.
5. Only if that single case has no native CompleteUse, a conditional
   `GRILLING_QA_FOOD_CONTROL_READY` prepares one vanilla milk plus native night
   vision. Preserve the entire Ordinary result. Wait for the real selected milk
   inventory readback, send `grilling_qa:arm_ordinary_network_milk`, wait for
   INPUT_READY case=milk, use once and release on its RELEASE marker. The milk
   timeout is100 native ticks. Native completion and actual night-vision removal
   provide the control; the fixture never removes the effect itself. No golden
   apple, absorption, second Ordinary, Heavy or mode matrix is permitted.
6. `GRILLING_QA_NETWORK_CASES_DONE` contains the cases, checks and ordered native
   callbacks. SIGTERM the same driver normally via the existing helper. Final
   `GRILLING_QA_RESULT` follows native Players leaving, with playersAfter equal
   to world.getAllPlayers().length (600-tick maximum wait). Only then normally
   stop BDS, retain raw failure, clean this QA and release the slot. Do not wait
   for CI while holding the slot. A driver/item-readback/fixture setup failure
   is an input failure, not a Creative damage counterexample.

Record actual item ids/count/full accessible metadata at readiness, start,
complete and post-settlement; custom/native effects, claim, HP and offhand;
before/after-hurt cause/amount/cancel as observed, native heal/totem and death,
and callback order/ticks. These are observer reads, with no native API wrapper,
fake event, direct food/effect invocation, kill, score or using-state mutation.
No renderer/client-audio/FPS or saved-world claim follows from this headless QA.
The default driver duration and normal shutdown/resource limits remain unchanged.
