# Player controls native boundary

Only run in an isolated BDS 1.26.60.6 world with the beta/GameTest experiments.
The harness copies the canonical `behavior_pack/entities/player.json` and
`scripts/core/{player_props,persist_keys}.js` into this probe pack. Do not keep a
second schema or replacement codec here. Keep the engine log and source hashes.

The simulated player checks same-tick eating/seasoning composition, the native
property delay, both 72000-tick clock boundaries, independent food reset and
neutral respawn initialization. It does not start full Grilling gameplay or
render any first/third-person view. Saved-world migration, full-family admission,
client Molang/animation and TACZ coexistence remain separate gates.
