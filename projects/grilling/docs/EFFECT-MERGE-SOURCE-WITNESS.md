# Finite custom-effect application merge

This repair is source/API-double evidence. It is not Minecraft, saved-world,
rendered-client, release, deployment, or complete ingredient-effect acceptance.

## Primary sources

Compared Grilling source `9a1acdab27698457bec16c9362678e574895a28c`, both
Forge 1.20.1 and NeoForge 1.21.1. `food/FoodState.applySeasoning`,
`seasoning/AdvancedSeasoningHandler.apply`, `skewer/SkewerItem.finishFoodAndEffect`
and `skewer/SecretSkewerItem.finishFoodAndEffect` apply Java effect instances.
`food/HotFoodHandler.doubleNewDurations` removes and re-adds extended instances,
therefore it intentionally discards their hidden chains; Invincible is excluded.

Official Mojang binaries and mappings were checked against version metadata:

- [1.20.1 client](https://piston-data.mojang.com/v1/objects/0c3ec587af28e5a785c0b4a7b8a30f9a8f78f838/client.jar), SHA1 `0c3ec587af28e5a785c0b4a7b8a30f9a8f78f838`;
  [mappings](https://piston-data.mojang.com/v1/objects/6c48521eed01fe2e8ecdadbd5ae348415f3c47da/client.txt), SHA1 `6c48521eed01fe2e8ecdadbd5ae348415f3c47da`.
  `MobEffectInstance` is `bfa`; mapped `update` lines 85–126, `tick` 179–193,
  `tickDownDuration` 201–204.
- [1.21.1 client](https://piston-data.mojang.com/v1/objects/30c73b1c5da787909b2f73340419fdf13b9def88/client.jar), SHA1 `30c73b1c5da787909b2f73340419fdf13b9def88`;
  [mappings](https://piston-data.mojang.com/v1/objects/2244b6f072256667bcd9a73df124d6c58de77992/client.txt), SHA1 `2244b6f072256667bcd9a73df124d6c58de77992`.
  `MobEffectInstance` is `brz`; mapped `update` lines 125–164, `tick` 217–233,
  `tickDownDuration` 241–244.

The finite strength/duration/hidden-layer rules agree in both inspected engines:

1. Equal strength extends only to the longer duration, without adding durations.
2. Stronger, shorter application becomes active and hides the former active layer.
3. Weaker, longer application updates a hidden layer without lengthening the stronger active layer.
4. Hidden durations run concurrently. Expiry promotes only the immediate layer.
   If that layer has already expired, the effect ends, even if a deeper layer
   would still have time left. An extended active layer must not skip that barrier.

## Defects reproduced before repair

At absolute time 100:

- Heavy Metal `{until:10000,amp:1}` plus one Totem Powder became
  `{until:3700,amp:0}`. Java keeps the existing stronger/longer instance.
- Numb `{until:10000,amp:0}` plus four Sichuan Peppers became
  `{until:1000,amp:0}`. Java keeps the longer equal-strength instance.
- Dragon Blood `{until:1100,amp:1}` plus 7200 ticks at amplifier 0 became
  `{until:7300,amp:1}`. Java keeps the strong instance until 1100 and queues
  the weak instance until 7300.
- Mixed persistent ingredient effects used the same independent duration/strength
  maxima and had the same erroneous promotion.
- The old state codec dropped all hidden-layer information.

Six targeted assertions failed on the unchanged baseline. The fixes are confined
to reward application sites, the finite merge/codec, and deep copying of cached
state. Explicit `fxSet`, `fxReduce`, `fxClear`, damage consumption and reset paths
are not converted into reward merges.

## State compatibility and bounds

Existing `{until,amp}` rows keep their meaning. Optional nested `hidden` rows use
the same absolute deadline and amplifier fields; no bulk migration is needed.
Read/write/cache copies preserve the entire valid chain. Old runtimes would drop
hidden fields, so rolling back still requires the normal saved-world backup.

Supported ingredient registration limits amplifiers to 0–255 and positive finite
ticks (at most 1,728,000). A valid hidden chain strictly descends in amplifier, so
256 nodes cover all supported states. Repeated identical applications refresh a
layer instead of adding layers. Cycles, non-descending strengths, malformed rows
and tails beyond this bound are rejected by ending that malformed tail, retaining
its valid owning head and unrelated effects. Existing single-row legacy records
are not forced through a new amplifier clamp. Infinite-duration effects are not
supported by this reward input contract and are not claimed by this repair.

The existing single-string state has a [32,767-byte UTF-8 limit](https://www.minecraft.net/da-dk/article/1-20-40-update-available-bedrock).
The existing `utf8Bytes` helper checks the complete payload before any setter.
One 256-layer example occupies 8,616 bytes; four such named effects occupy 34,461
bytes and cannot fit. Oversized valid maps are rejected without truncating chains,
changing the previous persisted state, or returning an unpersisted Dragon Blood
amplifier for a native-health grant. This patch does not create multi-key storage.
Thus the full set of possible huge external extension combinations remains beyond
this storage contract; a future larger-capacity design needs separate review.
The acknowledged-write path retains a successful setter that applies then throws,
and rejects a setter that fails before changing the prior state. A rejected reward
logs its failure and returns no applied record; an already-committed meal still
delivers container remainders and processes later ingredients exactly once.

## Tests and remaining boundary

- `test_effect_application_merge.mjs`: actual application functions, finite
  merge/codec, both mixed-strength orderings, equal refresh, expiry barriers,
  repeated application, malformed/cyclic data, maximum supported chain,
  actual runtime cache isolation, serialization/reconnect, milk, hot reset,
  UTF-8 boundaries, oversized multi-chain maps and rejected/acknowledged setters.
- `test_eating_native_completion.mjs`: actual ingredient dispatch and custom
  effect application through both-hand release/native completion, Creative and
  Survival, visual-bite iteration, cancellation, duplicate events, and saved
  native plate snapshot → restoration → selected-food effects → single settlement,
  plus rejected-storage completion without lost containers or later native calls.
- The older `test_full_skewer_flow.mjs` still stubs effect consumers. Its cooking,
  conservation and metadata checks remain useful, but are not effect acceptance.

Native effect application still belongs to Bedrock's engine. This repair merges
only the custom-script `persistent_fx` ledger. Ingredient `kind:'native'` effects
are passed sequentially to `player.addEffect`; the port does not decode or carry
Minecraft-native hidden chains through this ledger. Recording those API calls
cannot establish native Bedrock stacking or Java hidden-chain equivalence. Unknown third-party
food callbacks and payload-specific suspicious-stew effects are not automatically
replayed by the explicit compatibility registry. These separate gaps are not
fixed or certified by a custom-effect merge repair.
