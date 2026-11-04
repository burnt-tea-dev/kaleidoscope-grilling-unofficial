# Isolated pending-bottle metadata probe

Never install this diagnostic on a player server. It creates one simulated
player, one chest and a small flat-world platform. Load the unchanged production
main beside `probe.js`, using the current Grilling source, reviewed Cookery
1.6.4 dependencies, BDS 1.26.60.6, server 2.12.0-beta and server-gametest
1.0.0-beta. Record source bytes and explicit diagnostic manifest/entry overlays;
do not call a diagnostic pack identity a released production candidate.

The first stage uses the actual native 80-tick pending-bottle interaction. It
requires the completed bottle to retain the exposed name, foreign lore, flags,
Adventure restrictions and visible dynamic-property value, while resetting
owned uses, variant and lore. The probe stores the result in a native chest,
disconnects the player and stops normally. Restart that same world and compare
the restored native metadata snapshot and ingredients, then stop normally again.

This is the owner's additional data-preservation adaptation. Both Java 1.1.1
branches create a new SPECIAL stack rather than preserving arbitrary input
metadata. The adapter projects fields exposed to its ItemStack API owner across
the type change; it is not an arbitrary NBT serializer or access to another
pack's private data. Failure rollback uses the original native pending stack.
Client rendering, ordinary player offhand activation and complete-family
deployment are separate from this test.

The [2026-11-05 observation](observed.json) passed both normal-stop stages with
one native mainhand use and one same-world chest reload. It records the source
module hash and separate diagnostic identities, with Beta APIs, POI and upcoming
creator features enabled. Reuse that result only while the tested production
code is unchanged; it does not certify an arbitrary later family assembly.
