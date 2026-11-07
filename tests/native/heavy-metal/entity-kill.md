# Entity.kill capability — SOURCE READY, not run

This independent API question does not reopen command kill, repeat selfDestruct,
or adopt an Ordinary repair. G247 runtime, Player, items, baseline, history and
package stay unchanged. Keep 33e installer, 0feb trace, bd558 food and 00712/G247
refs and their original evidence. No Java/tag recheck or unchanged CI is needed.

## Selected interface and evidence boundary

The official `@minecraft/server` type package
`2.12.0-beta.1.26.60-stable`, selected for BDS 1.26.60.6, declares
`Entity.kill(): boolean`; its `EntityRemoveBeforeEvent` has only a readonly
`removedEntity`, no cancellation field. The current official
[Entity.kill documentation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-experimental#kill)
also warns that true can include an already-dead entity. It does not promise
Creative death, beforeHurt or Heavy cancellation. This is interface evidence,
not a new Native outcome. READY reports event subscriptions; the selected
Players' actual `typeof player.kill` is recorded and required before any call.
An absent API is an interface/setup result with no fallback.

## Single entry and runner contract

The shared owner prepares one small new stopped QA copy by the existing method,
outside a Git checkout. Do not reuse a retired G world, TACZ, LIVE or another
line's copy. Copy just `entity_kill_probe.js` and `entity_kill_gate.js` beside
the unchanged production `scripts/main.js`, then select the single diagnostic
entry `scripts/entity_kill_probe.js`. It imports full main once before observing
its original hurt/heal/death and Heavy handlers. Do not install the old trace
or load a second entry. No production source file is instrumented here.

Keep original G Player, server 2.12beta and existing experiments, both fixed
Creative network identities, max-players=2, online-mode=false, allow-list=false,
and the established same-unit/private netns/cgroup resource/network limits.
Use r16 frozen v11 ten files plus helper unchanged, `actions=True` and
`share_resource_packs=True`. Actions only enables loading-end/stationary frames:
the runner must record **requested_actions=[]**. Never send use, release,
consume or respawn input. No selected empty-slot wire-inventory gate is added.

Wait for one `GRILLING_QA_ENTITY_KILL_READY`. Both real network Players must
spawn/load, send the existing loading-end handshake, have their chunk/ground
built in the successful post-load order, and stand safely before preparation.
Keep the existing isolated QA gamerules naturalRegeneration=false,
keepInventory=true, doMobSpawning=false; the observer reads them without
changing them. Then send exactly once:

```text
scriptevent grilling_qa:entity_kill_capability
```

The observer requires both identities, distinct native ids, actual Creative,
alive health, no custom/native effects and no claim. Only qaNetPlain is first
initialized to HP10, empty selected mainhand and one native offhand totem.
It waits two no-input ticks and reads back those initial conditions. No HP,
totem or effect resets follow that actor's API call. BeforeHurt reads only
safe scalar fields, dynamic properties and item id/count; full accessible
metadata is read in the mutable/after contexts, never via restricted item APIs.

`GRILLING_QA_ENTITY_KILL_CALL` records enter immediately before the one direct
unmodified `player.kill()` member expression, then its real return type/value
or exception name/message/text, actorId, order and currentTick. This does not
claim entry inside native engine code. API true alone proves neither death
nor rescue. The call has no arguments and no retry, wrapper, command, alternate
cause, manual cancellation or original handler replacement. Eight native ticks
then collect same-actor before/afterHurt, heal/totem, death, actual HP, offhand,
effects/claim, and any normal playerSpawn/respawn. State read errors are retained.

`GRILLING_QA_ENTITY_KILL_GATE` admits qaNetHeavy only after alive Plain has a
same-actor native death, positive beforeHurt, and an untouched native totem
without totem healing. Direct death without beforeHurt, no death, or a spent
totem ends this observation with Heavy NOT_RUN. No alternative is attempted.
Only an admitted second actor gets the original `fxApply` heavy_metal effect
(1200 ticks, amplifier0) as initialization, with no prepaid poison or claim.
Its one same-API call needs native beforeHurt cancellation, original payment
and matching claim already read back at that callback, then same-actor HP1,
paid state, untouched totem and no death/respawn. Automatic client respawn or
fixture health initialization cannot satisfy rescue. Later death/respawn up
to disconnect is also retained and fails the final no-later-death check.

## Completion and interpretation

On `GRILLING_QA_NETWORK_CASES_DONE`, normally SIGTERM the same driver. Keep the
observer running for both native leaves; `GRILLING_QA_RESULT` records
playersAfter=`world.getAllPlayers().length`, requiring zero (max600 ticks).
Normally stop BDS, retain all raw results including failures, clean only this
small QA and release the shared slot. Do not hold the slot for CI or add a
backup/save gate. API absence or preparation errors have completed=false;
a completed negative capability observation has completed=true/passed=false.
The fixed fixtureRequestedActions field is only its own intent: the runner's
real requested_actions must separately remain empty.

Report API terminal, native hurt/death/totem, Heavy eligibility and Heavy rescue
separately. A negative is restricted to this method, engine, original G Player
and Creative network context, never all damage/cause/death APIs. This is not a
food_finish observation. Old 39/12, food r2/0feb, command kill, fatal-sensor,
absorption, saved-world and deployed G247 results keep their original scopes.

The small gate regression calls the actual observer's admission function. It
checks that true alone, death without hurt, consumed/healing totem, an already
dead target or another actor's death cannot authorize the second API call.
These are synthetic admission records, not Native death or Heavy evidence:

```sh
node --test tests/native/heavy-metal/test_entity_kill_gate.mjs
```
