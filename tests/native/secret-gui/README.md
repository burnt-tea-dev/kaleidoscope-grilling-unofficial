# Secret inventory icon data probe

`secret_gui_probe.js` is a diagnostic entry, not a second production writer.
The runner copies the exact source scripts, unchanged native secret item
definitions and player properties into a separate QA pack identity `[1,0,0]`.
It imports the real registered `hot_lore_runtime.js` inventory queue.

The selected engine is BDS 1.26.60.6, `@minecraft/server` 2.12.0-beta,
`@minecraft/server-gametest` 1.0.0-beta and server-ui 2.2.0, with gametest and
upcoming_creator_features enabled. No LIVE world or player is used.

Phase `write` checks actual `ItemStack.setLore/getRawLore`, including the
98-code-unit formatting cache inside the existing progress RawMessage. It
checks cache stability and unchanged name, count, flags, foreign raw lore and
gameplay metadata; then the registered native inventory events update two
same-ID recipes and a cooked snapshot. Reordering and chest transfer preserve
the complete data. Phase `reload` reads the same chest after normal stop and
restart and compares the saved data exactly. Native Players disconnect before
the result. The runner retains logs/results and removes its temporary world.

This tests the lore API and affected saved data. It cannot test `#hover_text`
values in a real inventory/hotbar collection, JSONUI loading or actual pixels.
There is currently no observed client rendering result. Current delivery scope
is maintained in [PARITY](../../../docs/PARITY.md#秘製串背包圖示gui-display).

[Observed results](observed.json): BDS 1.26.60.6 on 2026-11-06, write 24 and
same-world reload 6 checks passed, two normal stops, players/errors/OOM zero.
This confirms this formatting-only RawMessage path; it does not invalidate the
documented 50-character limit for arbitrary string lore. Source runtime scripts
match the diagnostic commit recorded in the result. QA manifests/entry/minimal
content differ from the complete exported game candidate. No client was used.
