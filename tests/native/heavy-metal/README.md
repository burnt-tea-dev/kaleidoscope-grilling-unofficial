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
