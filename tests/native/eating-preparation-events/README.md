# Preparation-event coverage

This test-only BP observes actual inventory, hotbar and metadata writes, then
compares direct offhand equipment/metadata writes. On the selected BDS1.26.60.6
the first three have positive event controls; the two offhand writes have no
matching event in the bounded window. Results are recorded with the adjacent
[early-debit observations](../eating-debit-spike/observed.json).

Never install on LIVE or include it in a formal export. The diagnostic creates
one simulated player in an isolated world and disconnects it. It does not
establish human-input event order, rendered inventory or animation/audio.
