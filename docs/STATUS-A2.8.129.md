# G129: shared HUD catalog repair

Version 2.8.129 and guide 0.3.59 retain G128's gameplay, animation, Uses and
Numb repairs. Pack/module identities and the owned BP/RP dependency advance
together; Cookery 1.6.0, API versions, UUIDs and guide content stay unchanged.

All 405 original eating sprite states now live in independently registered
`ui/kg_grilling_hud.json`, namespace `kaleidoscope_grilling_hud`. Tavern and
Grilling use one byte-identical minimal native HUD bridge with two optional
roots and their joint packet text filters. The full implementation, source
comparison and remaining actionbar concerns are in the
[catalog repair record](evidence/hud-catalog-compatibility-20261012.md).

Original textures, dimensions, 25-tick checkpoint, 90/100-tick progress,
packet producer and 100 ms hold / 1 ms owned expiry are preserved. This repair
does not substitute text progress, polling messages or a shared clear packet.
The existing generator and HUD/atlas checks now read the independently
registered catalog; one focused regression protects its load/mount closure.

The focused existing HUD and atlas checks pass locally. Required exact-head
CI, full-family saved-world loading and admission, LIVE deployment/readback,
and human client rendering each retain their separate status. No earlier
client recording certifies this new catalog arrangement. Client=false and
production_ready=false; no complete Java or multi-layout UI parity claimed.

The current six-hour Java read-only status at 2026-10-12 10:23 UTC continues
to list Grilling 1.1.1 for Forge 1.20.1 / CF8726006 and NeoForge 1.21.1 /
CF8726014, with metadata current and parity pending. This repair does not
install the new Cookery 1.6.1 / Chinese Food 1.0.5 / Nether/End 1.0.2 UUIDs.
