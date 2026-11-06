# Cold houttuynia native data probe

The diagnostic entry imports the real `tryCraftColdHouttuynia` owner, shared
item transaction and oil-pot adapter. It uses native Players, inventory,
offhand equipment, ItemStacks and drops on BDS 1.26.60.6 / server 2.12.0-beta.
The separate QA pack uses gametest 1.0.0-beta, server-ui 2.2.0, gametest and
upcoming_creator_features. It is not a complete exported game candidate.

The Grilling item/crop/player definitions and scripts remain unchanged. Only
the two external Cookery pot IDs use minimal native content with max-stack 1
and allow-offhand, matching the selected native definitions. Their original
author interaction components are not loaded or claimed as tested.

`write` calls the production function with a sneaking native Player. Cases:
ordinary craft (three roots, two premium oil points, one dish), exhausted
roots freeing the main slot with a full inventory, and full-inventory native
drop. Original names, raw lore, flags and Grilling-readable dynamic data are
checked, including the filled-to-empty pot transition. Items are saved in a
native chest. `reload` compares exact affected data after normal stop and
restart of the same QA world. Players disconnect and the QA world is removed.

API write/drop failures are injected only by the existing source scenario
fixture. They are not claimed as natural BDS failures. This probe does not
simulate a real shift-click input, execute the Java crafting grid, render a
client or validate the full family. Current behavior is documented in PARITY.

[Observed results](observed.json): 2026-11-06 write 25 and same-world reload 4
checks passed. Both normal stops, players/errors/OOM zero; peak 408719360 bytes.
The native-tested production scripts match the fixed source recorded in the
result; manifests and the diagnostic entry/content differ from a game export.
