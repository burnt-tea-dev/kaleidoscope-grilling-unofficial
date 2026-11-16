# Secret skewer GUI reference

The seven original 16px masks and both unchanged `CustomSkewerGuiTexture.java`
files come from `breezeth-CN/KaleidoscopeGrilling@9a1acdab27698457bec16c9362678e574895a28c`.
The original resource paths and asset identities are in `upstream.json`.

Assets retain CC BY-NC-SA 4.0 attribution in `projects/grilling/LICENSE-ASSETS`;
Java source retains the BSD notice in `data/java/LICENSE-CODE`.

`tools/build_secret_gui.py` uses these masks and the existing pinned GUI palette.

`native-item-renderer.json` retains Mojang's `common.item_renderer` definition
from the linked fixed bedrock-samples revision (MIT). The current generator
preserves its custom type, renderer, layer, default and native binding prefix
inside the collection slot's `native_icon`. Its sixth binding uses `#visible`
and sibling scope; the recipe source, native icon, stick and food masks are
siblings. No parent custom-renderer alpha or recipe factory is used.

The collection owner is `common.container_item`, whose complete native input
panel is retained in `data/native_inventory_slot.json`. The generator changes
only `$item_renderer|default` to `kg_secret_gui.slot_renderer`; buttons, focus,
counts, durability and overlays retain the native definition. Global/cursor
callers still inherit Mojang's `common.item_renderer`, which this pack does not
redefine. `native-item-callers.json` keeps the original selected-icon and
inventory/hotbar inputs. The selected icon supplies global bindings without a
collection; the collection callers inherit the container renderer choice.

The same four methods in `tools/test_secret_gui_ui.py` cover exported output,
native renderer preservation, cursor exclusion and recipe/native separation
with the original Java layer order. The three historical selector cases now
read those actual producer locations. The historical alpha-named method keeps
its identity but addresses the sibling visibility layout. Source/data checks
do not run Minecraft's UI parser, prove caller rendering or render a frame.

Each generated food/style image packs six 16px masks in one 96x16 strip; the
six item layers use fixed UV cells and keep independent per-slot recipe data.
`tools/test_secret_gui_assets.py` runs both original Java composers with only
the external Minecraft/image boundary substituted. Its pixels do not establish
that a particular Minecraft client's per-slot bindings rendered them.
