# Grill helper orientation at birth (isolated source repair)

## Scope and diagnosis

Base: `fd47371e` (reviewed composed animation/guide source). The frozen candidate worktree was not edited. This repair has no release/version/export/deployment or native-client acceptance.

Reported symptom: a raw skewer briefly points left after being placed on a grill, then settles into its correct orientation.

`grill_visual_core.js` already computes the final slot pose before spawning. Previously its spawn callback received only location. `grill_visual_runtime.js` called `spawnEntity(type, location)` without initial yaw, then teleported the entity to the final yaw. This leaves the birth orientation unspecified by the add-on. Subsequent updates with the same signature do not write anything, so the five-tick polling interval does not schedule a later yaw repair. The raw `flips=0` animation has no yaw transition: its only rotation is the flip around Z. There is no delayed raw-item yaw correction in the resource animation.

The smallest fix supplies `initialRotation: -rotation` at birth, using exactly the yaw of the existing teleport. Final positions, final yaw, model properties, ready publication, hop and flip animation are unchanged. No timeout, extra hidden interval, or new API dependency was introduced. Missing initial yaw is a verified source defect; attribution of the player's precise half-second visual symptom to client interpolation remains a hypothesis until tested in a native client.

## Java and Bedrock evidence

Java author source `9a1acdab27698457bec16c9362678e574895a28c`, `neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/grill/GrillRenderer.java`, lines 31–41 applies grill-facing yaw before drawing any slot. Lines 45–64 initialize observed flips without starting an animation; lines 83–91 apply the per-slot flip. The maintained family source index identifies Grilling 1.1.1 for NeoForge 1.21.1 (file 8726014), separately from Forge 1.20.1 (8726006). No author-version refresh or complete branch-parity claim is made here; the external BSM upstream status file is not present in this workspace.

The add-on declares `@minecraft/server` **2.9.0**. Its exact official npm package was read without installing/executing package code:

- https://registry.npmjs.org/@minecraft/server/2.9.0
- https://registry.npmjs.org/@minecraft/server/-/server-2.9.0.tgz
- Package integrity: `sha512-tzPwJbcXs4H3daAy5v0KldOMUwgSr4cc5x6TpEvsr3Jto9XtvsBcNUVLVdni5NEZCizQ0mzBwnLCXgxyYpR91A==`

The 2.9.0 `index.d.ts` declares `Dimension.spawnEntity(identifier, location, options?: SpawnEntityOptions)` and `SpawnEntityOptions.initialRotation?: number`. This is not an assumption based only on latest docs. The official [SpawnEntityOptions reference](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/spawnentityoptions?view=minecraft-bedrock-stable) confirms degrees at spawn. The official [Entity reference](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable) documents next-tick property application, represented explicitly by the test double.

## Reusable regression and results

`development/gameplay_core/test_grill_initial_orientation.mjs` executes the real runtime in a VM with the real display controller and a recording API double. It inspects yaw passed to the spawn call before teleport/property writes, then publishes pending properties on the next simulated tick and follows unchanged state through tick 15. Coverage includes all four facings, all three native slots, 19 fixed raw types and secret/custom skewers, flip reuse, invalid-helper replacement, audience leave/return (reconnect analogue), and startup cleanup/rebuild (reload analogue). These are API-double restoration scenarios, not actual network/world reload tests.

Both new tests fail on the original two source files from `fd47371e` because spawn lacks `initialRotation`. Both pass with the fix. The existing grill verification entry `verify_a2829.py` now includes them.

Run:

```
node --test development/gameplay_core/test_grill_initial_orientation.mjs development/gameplay_core/test_grill_visual.mjs development/gameplay_core/test_grill_tick_native_reads.mjs
```

Result: **18 tests passed**. `git diff --check` passes. Full-family, BDS and native-client acceptance were not run. No rendered first-frame timing or elimination of the reported half-second drift is certified. Native acceptance must observe insertion from each facing, custom/fixed skewers, re-entry/reload and flips without an initial sideways sweep, while retaining the final pose.
