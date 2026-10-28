# Configured secret-skewer visual inputs

`ingredients.json` pins eight existing Grilling ingredients to append-only slots
218–225. Models and PNGs were independently fetched from Java 1.1.1 commit
`9a1acdab27698457bec16c9362678e574895a28c`; the PNGs already in the resource pack
match those upstream Git blobs exactly. All eight models use `item/generated`
and their own `layer0` particle sprite. No tint is registered for these items in
the pinned Forge ClientSetup item-color registration.

The sampler (`tools/secret_food_palette.py`) is restored unchanged from this
repository's `61efa642cbb29983e149a7fa7d81146ebca73037`. Its original pinned Java
provider SHA-256 matches the newly fetched upstream file. Float32 arithmetic,
Java rounding, Lab clustering and Integer HashMap tie order are retained.
`generated_food_sprite.py` retains the pure alpha-span/geometry functions from
the same revision, without its retired fixture loader or build orchestration.

`white_concrete.png` is the same 16px official Java 1.20.1 base texture used by
all existing secret-food atlas tiles (SHA-256 in the manifest). Each palette
color multiplies that sprite using the original channel rounding. Attribution:
Minecraft texture © Mojang; Grilling artwork © breezeth, CC-BY-NC-SA-4.0, as in
`projects/grilling/licenses/`. No external Cookery artwork is added here.

Run `python tools/build_secret_visual_catalog.py`, then the same command with
`--check`. It appends palettes and stable helper geometries, extends existing
maps/arrays, and updates consumer bounds/strides via `secret_visual_consumers`.
It never renumbers old food slots or changes the saved 8-bit food packing.
Helper markers 225/226 remain oil owners; new foods use markers 227–234.

Regression: `tests/legacy/test_secret_visual_state.mjs` executes production
projection/transport and resource arithmetic for all new foods/styles/shapes,
plus old and reserved helper markers. This is not native-client acceptance.

The already-edited held-plate palette arrays use compact JSON value lists.
This lossless formatting keeps the main-branch RP growth budget without asset
deletions or changing any existing palette pixel. Consumer check mode compares
JSON semantics, preserving this deterministic serialization.
