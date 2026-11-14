# Configured secret-skewer visual inputs

`legacy-palettes.json` restores the 217 reviewed, source-attributed palette
inputs from this repository's `61efa642cbb29983e149a7fa7d81146ebca73037`, at
`development/gameplay_core/fixtures/secret-food-palettes.json`. Its
`recovered_from` field records that identity. These are the original sampled
colors and source limitations, not new artwork or a claim of complete Java
item-color parity. The retired importer/build framework is not required.

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

Run `python3 tools/build_secret_visual_catalog.py`. It generates palettes and
stable helper geometries, extends existing maps/arrays, and updates consumer
bounds/strides via `secret_visual_consumers`.
It never renumbers old food slots or changes the saved 8-bit food packing.
Helper markers 225/226 remain oil owners; new foods use markers 227–234.

For palette-only changes, `python3 tools/build_secret_visual_catalog.py
--palettes-only` uses the same palette producer without regenerating geometry,
GUI colors, consumer expressions or player properties. Within each style, it
compares complete generated PNG bytes and points equal non-provisional entries
to the first path in index order. It removes only the superseded palette PNGs;
all food/style texture keys and controller arrays remain. Different generated
content receives its own path again on the next normal generation. Unresolved
particle fallback samples remain separate until their source is repaired.

Both modes keep the existing 256×96 white-concrete atlas, per-face/stage tint,
alpha and PNG encoding. They do not change material, UV or render settings.
Generation alone does not establish client rendering or device memory use.

The already-edited held-plate palette arrays use compact JSON value lists.
This lossless formatting keeps the main-branch RP growth budget without
changing palette pixels. Consumer check mode compares
JSON semantics, preserving this deterministic serialization.
