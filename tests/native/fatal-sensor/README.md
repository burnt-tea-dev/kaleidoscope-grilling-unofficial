# Passive fatal damage-sensor capability

This is a new diagnostic path, not an implementation of Heavy Metal. The
runtime, pack identities, Core and installed family remain unchanged.

Primary references, read 2026-11-06:

- [has_damage filter](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/filters/has_damage?view=minecraft-bedrock-stable)
  includes a fatal predicate.
- [damage_sensor](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_damage_sensor?view=minecraft-bedrock-stable)
  supplies `on_damage` events and `deals_damage`. These pages do not define
  armor, absorption, totem or Script before-hurt ordering.
- Mojang samples pinned at `15701fa9c13923f12662984c32c124327e40e3d3` declare
  [1.26.60.5](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/version.json).
  The [villager](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/behavior_pack/entities/villager_v2.json)
  uses fatal damage for zombification. The same pinned pillager and
  [player](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/behavior_pack/entities/player.json)
  files do not contain this sensor. Generic entity examples do not prove
  Player support.
- The pinned [1.26.60 component schema](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/metadata/json_schemas/server/entity/1.26.60/Entity%20component%20definitions.json)
  lists `minecraft:damage_sensor` as a dynamic value, with no Player or timing
  guarantee. BDS 1.26.60.6's official archive does not contain these entity
  source definitions or a detailed damage-sensor schema.

The isolated QA input uses that original Mojang Player file, retained outside
this repository with its original license, and applies `player-overlay.json`
only to the QA copy. The overlay adds one diagnostic property and component
groups with passive `deals_damage: yes`. No production player is rewritten.
The observer imports only native server/GameTest APIs, not Heavy Metal.

The minimal selected-engine test uses actual Survival Players:

1. A direct JSON event must update the native property. An unconditional
   damage event is a separate positive witness for the sensor on Player.
2. Both sensor-disabled and fatal-sensor pairs receive absorption I at 10HP.
   One spends three shield points; after the same cooldown their amplifier
   and duration match. Both then receive 13 damage. Record native survival,
   death and actual fatal event acknowledgments separately.
3. Bare lethal, full native armor and native offhand totem controls compare
   classification with real outcomes and check that passive observation has
   not changed native damage, armor or totem behavior.
4. Record native data-driven event, before-hurt, after-hurt, positive totem
   healing, death and immediate/next-tick property state with an ordered index.

Read filter correctness before transport timing. A late property/event only
limits feeding that response into the existing Script before-hurt handler;
it does not disprove all native component uses. Conditional native damage
suppression and the later Heavy Metal transaction are not tested or adopted.
If the predicate itself conflates full and spent shields, stop this route
instead of publishing a fallback runtime. Generic schema acceptance, manual
event delivery and a successful probe are not Java-parity results.

This test reads no remaining-shield amount, maintains no shield ledger, does
not cancel or replay damage, and never resurrects a Player. It uses one fresh
isolated world and normal stop/cleanup, with no saved-state or restart cycle.
The new native slot follows the shared G240 update and already-scheduled T
test; do not start it from an idle-lock observation alone.
