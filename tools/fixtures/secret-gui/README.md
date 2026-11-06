# Secret skewer GUI reference

The seven original 16px masks and both unchanged `CustomSkewerGuiTexture.java`
files come from `breezeth-CN/KaleidoscopeGrilling@9a1acdab27698457bec16c9362678e574895a28c`.
The original resource paths and asset identities are in `upstream.json`.

Assets retain CC BY-NC-SA 4.0 attribution in `projects/grilling/LICENSE-ASSETS`;
Java source retains the BSD notice in `data/java/LICENSE-CODE`.

`tools/build_secret_gui.py` uses these masks and the existing pinned GUI palette.
`tools/test_secret_gui_assets.py` runs both original Java composers with only
the external Minecraft/image boundary substituted. Its pixels do not establish
that a particular Minecraft client's per-slot bindings rendered them.
