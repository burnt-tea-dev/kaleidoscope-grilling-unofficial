# Custom-skewer inventory rendering: evidence and limits

G104 corrects a separate asset error: the two native inventory icons previously
contained the held shaft's UV atlas. They now use the diagonal Java GUI stick
and a completed three-mask sprite in the author's fallback color. This static
fallback fixes the UV-layout icon; ordered per-stack colors, count and variants
remain unresolved. See [G104 scope](STATUS-A2.8.104.md).

Research rechecked 2026-10-09 (Hong Kong; 2026-10-08 UTC). **Exact per-stack Java GUI parity remains unresolved.**
The documented stable Bedrock icon/API surfaces below do not provide a verified
route from arbitrary ordered skewer ingredients to three independently colored
inventory-icon layers. This is a bounded support finding, not proof that every
undocumented or future JSON UI technique is impossible.

2026-10-15 G143 整合時重新閱讀 Microsoft stable icon 與自訂物品文件：仍未找到可由每個 ItemStack 的三份任意食材分別指定 tint／variant 的受支援 native inventory 路由。本輪沒有以單一 RGB dye、手持模型或離線合成圖冒充這個缺口完成。

## Version and source boundary

- Target client/BDS: **1.26.52.3**; Grilling item format: **1.26.30**
- Stable modules: **`@minecraft/server` 2.9.0**, **`@minecraft/server-ui` 2.2.0**
- Official schema/API/sample pin: **Mojang/bedrock-samples
  `46ba6ea985fb5a92d79a9419198f10dda14c199d`** (sample 1.26.50.4, already used by
  this repository). This is a nearby official sample, not a 1.26.52 renderer test
- Java author source pin: **breezeth-CN/KaleidoscopeGrilling
  `9a1acdab27698457bec16c9362678e574895a28c`**, specifically the Forge 1.20.1 path
  below. A source commit is not evidence of a newly released author binary

No rendered-client experiment was performed for this research. Static schemas,
Script API declarations, BDS loading and Python image checks cannot certify an
inventory icon on the target client.

The latest official `Mojang/bedrock-samples` main was read back at this recheck
and still resolves to the same `46ba6ea9` pin. Its actual 2.9.0/2.2.0 bindings,
modern icon schema, Molang queries and native inventory renderer were reread;
no newly supported three-position per-stack color/variant bridge was found.
The current Microsoft stable ItemStack, ItemDyeableComponent and icon references
agree with that bounded finding. See the compact [API recheck record][api-recheck].

## What the Java GUI actually draws

[`CustomSkewerGuiTexture.java`][java-compositor] creates a **16×16** dynamic
texture from `stick.png` and up to three ordered food masks. Each position has
two mask variants, selected by its bit in a three-bit value. Slots are painted
back-to-front, 2→1→0; an absent ingredient paints nothing. Each ingredient's tint
is the per-channel average of palette cells **5, 6, 9, 10**. Five mask tones apply
the original darkening/highlighting and rounding rules.

[`SkewerGuiIconCache.java`][java-cache] has a separate 64× capture route.
[`HotFoodConfig.java`][java-config] defaults that custom-skewer option off;
the 16× template compositor is therefore the relevant default GUI reference.
The target is not a full ingredient-texture screenshot or the held 3D model.

The exact seven PNG templates, two Java source files, licenses and byte manifest
are preserved in
`development/gameplay_core/fixtures/java-custom-skewer-gui-9a1acdab/`.
Assets are CC-BY-NC-SA-4.0; code is BSD-3-Clause, as recorded in the fixture.

`tools/java_custom_skewer_gui.py` is an **offline source-derived QA compositor**.
`python tools/test_java_custom_skewer_gui.py` passed **7 focused tests** during
this research, covering provenance, empty-stick identity, tones/rounding,
variant bits/missing slots, overlap order, cooking snapshots and invalid input.
These tests do not certify Java screenshot equality or Bedrock runtime routing.

Generate references with:

```sh
python tools/java_custom_skewer_gui.py --output artifacts/review/g73-custom-skewer-reference
```

The example set uses carrot palettes for counts 1–3, variants 0–7, raw and cooked
snapshots. Cooked partial-count rows are **renderer probes only**, not claims
about normal assembly gameplay. The receipt labels these as source-derived
references, not native inventory icons or engine screenshots.

## Supported Bedrock surfaces and their limits

### Native icon selection and atlas arrays

The [pinned current icon schema][icon-schema] accepts a texture-reference string
or a `textures` map of texture-reference strings. It documents roles for default
icons, armor trims and bundle-open imagery. The [official dye tutorial][dye-tutorial]
also documents `textures.dyed`. It does not document an arbitrary per-stack
selector, compositing callback, dynamic-property expression or current `frame`
field. Additional map keys being schema-valid does not prove the renderer uses
them as arbitrary layers.

The [vanilla atlas][atlas] contains texture arrays, including armor-material and
bow-frame variants. Those show engine-selected atlas entries, not an established
custom-item contract mapping arbitrary aux/damage to a skewer image. Even an
index into pre-baked icons would still require enumerating the combinations.

Historical caution: [Mojang's 1.16.100 notes][legacy-icon] described `frame` and
`legacy_frame` Molang fields. Those fields are absent from the pinned modern
schema. This research does not claim an exact removal version or continued
support through a legacy-format workaround; either requires a target-client
proof and would not by itself establish three-layer tinting.

### One real per-stack tint, not three documented tint channels

The exact [server 2.9.0 declarations][server-api] contain writable
`ItemDyeableComponent.color: RGB` and read-only `defaultColor`. The official
tutorial specifies a grayscale TGA icon for the dyed role. This is a supported
single-color customization route, but it does not expose three independent RGB
values for the three food positions.

Eight prebuilt shape arrangements can represent 2³ mask choices; they do not
solve independent ingredient colors. Encoding three palette indices into RGB
would additionally need a renderer that decodes them into three colors. No such
native-icon decoder is documented here. A single averaged tint is an explicit
visual approximation, not the Java compositor.

### Item data, durability and Molang context

- The pinned `ItemStack` API has no writable aux/data, icon, texture, or arbitrary
  component-definition setter. Its constructor accepts item type and amount
- Durability damage is writable, but the API does not promise that damage
  selects a custom item's icon. [Stacked-by-data][stacked-data] controls stack
  merging, not icon composition
- The [pinned Molang query metadata][molang] includes remaining/max durability
  and animation-frame queries, but no `query.item_aux_value` or query reading
  `ItemStack` dynamic properties
- `query.property` reads entity properties. It is not Script API
  `ItemStack.getDynamicProperty`. Entity/attachable rendering context does not
  establish an arbitrary inventory-slot rendering context

### JSON UI and server-ui 2.2.0

[JSON UI][json-ui] supports layered image controls, colors and bindings. The
[pinned common inventory renderer][ui-sample] binds `#item_renderer_data` to the
engine's `inventory_item_renderer`; the filtered renderer exposes fields such
as `#item_id_aux`, one `#item_custom_color` and specialized built-in data.
Separate durability bindings also exist. The inspected common, inventory,
pocket-inventory and HUD sources do not expose a skewer dynamic-property bridge.
Binding a native item renderer is not a script callback for drawing each slot.

**Correction to older API assumptions:** stable [server-ui 2.2.0][ui-api] already
contains `CustomForm`, images and observables. It is not limited to the three
older form classes. [`CustomForm.image`][custom-form] selects an image path
inside a resource pack; the exact 2.2.0 `ImageOptions` fields are `onClick`,
`tooltip`, `visible` and `width`. This provides neither runtime pixel generation
nor a native inventory-slot replacement hook.

## Route choices and safe experiment boundary

1. **Current supported fallback:** retain stable item identity and complete
   ingredient metadata. A generic icon or one dye tint must remain labeled an
   adaptation; neither completes exact inventory parity
2. **Finite pre-baked icons/aliases:** feasible for a deliberately bounded
   catalog, but not the arbitrary ordered-ingredient requirement. Do not create
   millions of aliases or globally repaint vanilla carrot to mask this gap
3. **JSON UI proof of concept, not implemented:** test whether a client-visible
   per-stack field can safely carry finite palette/shape indices and drive three
   slot-local overlays. Decoding, field types, update behavior and screen
   coverage remain unverified. This is a separate UI/data-bridge investigation
4. **Separate inspection form:** packaged reference images can be displayed in a
   form, but that is not the normal inventory/hotbar icon and does not solve
   arbitrary runtime image composition

Any proof of concept must use a disposable test world/resource pack and custom
test items. First show two different skewers simultaneously and verify the
correct per-slot values before expanding it. Then check reordering, drag/cursor
items, containers, hotbar, touch/classic UI, relog and concurrent players.
Preserve vanilla icons, canonical dynamic properties and normal durability/dye
semantics; do not migrate live items or override shared HUD channels merely to
transport test data. Stop if the bridge needs unsupported assumptions or causes
cross-slot contamination. No such experiment, live change or native acceptance
is included in this document or the QA compositor.

[java-compositor]: https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/CustomSkewerGuiTexture.java
[java-cache]: https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/SkewerGuiIconCache.java
[java-config]: https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/food/HotFoodConfig.java
[icon-schema]: https://github.com/Mojang/bedrock-samples/blob/46ba6ea985fb5a92d79a9419198f10dda14c199d/metadata/json_schemas/server/item/1.26.30/minecraft_icon%20v1.21.80.json
[atlas]: https://github.com/Mojang/bedrock-samples/blob/46ba6ea985fb5a92d79a9419198f10dda14c199d/resource_pack/textures/item_texture.json
[dye-tutorial]: https://learn.microsoft.com/en-us/minecraft/creator/documents/addcustomitems?view=minecraft-bedrock-stable#dyeable-custom-items
[server-api]: https://github.com/Mojang/bedrock-samples/blob/46ba6ea985fb5a92d79a9419198f10dda14c199d/metadata/script_modules/%40minecraft/server-bindings_2.9.0.json
[stacked-data]: https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_stacked_by_data?view=minecraft-bedrock-stable
[molang]: https://github.com/Mojang/bedrock-samples/blob/46ba6ea985fb5a92d79a9419198f10dda14c199d/metadata/molang_modules/mojang-molang-queries.json
[json-ui]: https://learn.microsoft.com/en-us/minecraft/creator/reference/content/jsonuireference/examples/jsonuicomponents/ui_element?view=minecraft-bedrock-stable
[ui-sample]: https://github.com/Mojang/bedrock-samples/blob/46ba6ea985fb5a92d79a9419198f10dda14c199d/resource_pack/ui/ui_common.json#L3935-L4025
[ui-api]: https://github.com/Mojang/bedrock-samples/blob/46ba6ea985fb5a92d79a9419198f10dda14c199d/metadata/script_modules/%40minecraft/server-ui-bindings_2.2.0.json
[custom-form]: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/customform?view=minecraft-bedrock-stable#image
[legacy-icon]: https://feedback.minecraft.net/hc/en-us/articles/360052592091-Minecraft-1-16-100-Bedrock
[api-recheck]: evidence/heavy-metal-and-inventory-api-20261009.md
