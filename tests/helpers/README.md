# Native Minecraft test boundary

`minecraft-fixture.mjs` supplies a deterministic test double for the external
`@minecraft/server` API. It does not simulate a Bedrock client or replace BDS
acceptance testing.

```js
import {createFixture} from '../helpers/minecraft-fixture.mjs';
const f = createFixture();
await f.load('a25_plate_recipe_runtime.js');
f.startup();
const plate = f.block('kaleidoscope_grilling:skewer_plate_block', {x: 0, y: 64, z: 0});
const player = f.player({location: {x: 0, y: 64, z: 1}});
f.emit('world.beforeEvents.playerInteractWithBlock', {
  block: plate, player, blockFace: 'Up', isFirstEvent: true, cancel: false,
});
f.flush();
```

## Loading and isolation

The helper registers a Node `resolve` hook. Only `@minecraft/server` is
redirected. Every canonical production module is imported by native ESM, with
unchanged source and its ordinary transitive imports and subscriptions. There
is no `load` hook, source extraction, VM, source rewrite, appended export, or
replacement of a production dependency. A fixture query in canonical module
URLs propagates through the entire graph, so private caches and registrations
belong to that fixture.

Use `await f.load(name)` for runtime exports and for helpers with module state
(such as `itemData.js`, `skewer_item_snapshot.js`, and transaction signatures).
All loads on one fixture share its graph. State-free modules may be imported
statically. For retained tests with static Minecraft imports, preload a default
fixture:

```sh
node --import ./tests/helpers/register-minecraft-loader.mjs --test tests/legacy/test_core.mjs
```

The preload is compatible with the explicit fixture API. The modules use Node
22 APIs and no installed test dependency.

## State and events

- `f.world`, `f.system`, `f.dimension`, and `f.getDimension(id)` expose fake APIs.
- `f.subscribers` maps full event names to arrays of actual subscribed callbacks.
  `f.emit(name, event)` invokes all of them in registration order, without
  inventing unrelated vanilla after-events or block destruction.
- `f.startup()` delivers the actual startup event. `f.blockComponents`,
  `f.itemComponents`, and `f.commands` contain registered implementations.
  `f.component(name, callback, event)` and `f.command(name, origin, ...args)`
  invoke those registrations.
- `f.tick(n)` advances deterministic ticks, running due one-shots and intervals
  in registration order. `f.flush()` advances one tick, including intervals;
  it does not drain repeating jobs forever. Nested `system.run` calls become
  eligible on the next tick. Uncaught callbacks propagate to the test.
- `f.pendingJobs()` exposes timing metadata. It does not expose callback bodies.
- `f.dp` / `f.world.dynamicProperties` is the backing map.
  `f.snapshotProperties()` returns a copy for
  `createFixture({dynamicProperties: snapshot})`, which creates fresh runtime
  caches around persisted data.
- `f.logs`, `f.sounds`, `f.particles`, `f.messages`, `f.effects`, `f.scriptEvents`,
  `f.commandCalls`, and `f.writes` capture observable boundary effects.
  Script-event sends are captured; an external host's reply is never fabricated.

## Items, inventories, and blocks

`f.item(typeId, amount, metadata)` and `new f.ItemStack(typeId, amount)` support
native names, lore / RawMessages, dynamic properties, tags, durability,
enchantments, placement/destruction restrictions, lock mode, and keep-on-death.
Cloning and inventory reads/writes preserve metadata by value. Grilling item
capacity, tags, food, and durability come from canonical BP item JSON, not
runtime source text. Public Cookery rack knife/shovel identities are represented
as unstackable external tools. Their generic durability ceiling is only a test
capability, not evidence of the host's actual durability balance. Other foreign
item definitions can be supplied with `createFixture({itemDefinitions: {...}})`
using Bedrock item-component objects. The fixture does not load or modify the
host pack.

Stackable items reject native dynamic-property writes. Use the real, same-graph
`itemData.js` exports for Grilling's portable metadata (world records plus lore
tokens); tests must not bypass that adapter.

`f.player({main, off, inventorySize, selectedSlotIndex, location, gameMode,
isSneaking})` provides `inventory`, `equipment`, `main`, and `off` accessors. Set
`viewBlock`, `viewEntities`, `headLocation`, or `viewDirection` to control aim,
or replace individual fake API methods for a scenario. Native effect
`addEffect`, `getEffect`, `getEffects`, and `removeEffect` track durations and
expiry against the deterministic tick clock.

`f.block(typeId, location, {states, inventorySize, dimension})` creates a block
at the specified location. Canonical BP block JSON supplies exact owned-block state
names, value domains and defaults, including enabled placement traits. Unknown
owned-block states and invalid values throw; vanilla/foreign schemas stay an
explicit external boundary, with shared trait values validated. Rack blocks default to a native nine-slot inventory;
`inventorySize: 0` exercises real managed station storage instead. Inventory
helper entities spawned by that storage adapter have their defined capacity.
The stable-API block model deliberately omits `isSolid`, allowing the canonical
support-shape fallback to execute.

Drops are native-style entities in `f.drops`, including invalid/removed entries.
Use `drop.isValid`, `drop.getComponent('minecraft:item').itemStack`, and
`drop.remove()`; `drop.itemStack` / `drop.stack` are inspection conveniences.

## Faults

```js
f.faults.failNext(player.inventory, 'setItem', {
  phase: 'after',
  predicate: (slot, stack) => slot === 0 && stack === undefined,
});
```

`phase: 'before'` rejects before mutation; `'after'` applies the mutation and then
throws. Covered boundaries include world/item/entity dynamic-property writes,
inventory/equipment writes, block writes, drop/entity spawning and removal,
and drop component reads. Rules are consumed only by matching calls.
`f.faults.clear()` removes pending rules. Fake API methods remain writable for
more specific outcomes, such as a foreign replacement after a write or an
unacknowledged drop; production functions remain untouched.
