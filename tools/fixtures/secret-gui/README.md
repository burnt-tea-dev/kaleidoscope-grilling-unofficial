# Secret skewer GUI reference

The seven original 16px masks and both unchanged `CustomSkewerGuiTexture.java`
files come from `breezeth-CN/KaleidoscopeGrilling@9a1acdab27698457bec16c9362678e574895a28c`.
The original resource paths and asset identities are in `upstream.json`.

Assets retain CC BY-NC-SA 4.0 attribution in `projects/grilling/LICENSE-ASSETS`;
Java source retains the BSD notice in `data/java/LICENSE-CODE`.

`tools/build_secret_gui.py` uses these masks and the existing pinned GUI palette.

`native-item-renderer.json` retains only Mojang's `common.item_renderer`
definition from the linked fixed bedrock-samples revision (MIT). A same-name UI
definition replaces that native base; the generator must preserve its `custom`
type, `inventory_item_renderer`, layer, default and every native binding. The
client's selected-item, hotbar and bundle controls inherit those fields.
`tools/test_secret_gui_ui.py` checks that contract against the generated data;
it does not execute the Minecraft UI parser or a renderer.
Each generated food/style image packs six 16px masks in one 96x16 strip; the
six item layers use fixed UV cells and keep independent per-slot recipe data.
`tools/test_secret_gui_assets.py` runs both original Java composers with only
the external Minecraft/image boundary substituted. Its pixels do not establish
that a particular Minecraft client's per-slot bindings rendered them.
