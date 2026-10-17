# Attribution / 來源與修改聲明

本工程是 Kaleidoscope Grilling 的**非官方、尚未完成**基岩版移植素材工作包。不是原作者或 Cookery 基岩版作者發布的成品，未聲稱獲其背書。

原專案：breezeth-CN/KaleidoscopeGrilling；原作者 breezeth。鎖定提交 `9a1acdab27698457bec16c9362678e574895a28c`。
原素材：Copyright (c) 2026 breezeth；其中含改編或重用 Kaleidoscope Cookery 素材，Copyright (c) 2025 Kaleidoscope Official Production Team。

授權來源：[上游 LICENSE-ASSETS](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/LICENSE-ASSETS)。完整條款：https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode

## 此工作包的修改

- 原 PNG 保留原始位元組，並以 Git blob SHA-1 核对；新圖集只排列原像素，不重繪。
- 已讀完整內容的 JSON 以標準排版保存；目前仍有一份不與上游原始排版位元組相同，逐檔狀態見 `source_manifest.json`。
- 部分模型轉出 Bedrock geometry 候選及可編輯 Free Model `.bbmodel`，包括座標、UV 及模型層次轉換。
- 調料瓶 2–4 瓶布局按原作 Renderer 的偏移值組合，仍未驗證遊戲中的方位、材質和互動。
- 預覽由來源幾何離線繪製，不是 Minecraft 畫面；它們亦為原素材的衍生品。

`source_snapshots/`、`resource_pack/`、`editor/`、`reports/resolved_models/` 內的美術／模型，以及 `reports/previews/`、HTML 內嵌預覽依 CC BY-NC-SA 4.0 分享。不可把新工具的 MIT 授權誤當成上述素材的授權。

新 Python 工具與測試的授權見 `LICENSE-TOOLS`。沒有重新打包、分發或修改 Cookery 基岩版包。

## 技術參照

Bedrock 格式：[Microsoft geometry 1.16.0](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/schemasreference/schemas/minecraftschema_geometry_1.16.0?view=minecraft-bedrock-stable)。

座標、旋轉及上下表面 UV 約定以 Blockbench 官方格式程式核對：JannisX11/blockbench，提交 `2569d0245d600030760cf0b8429b1b0017b871f1` 的 `js/formats/bedrock/bedrock.js`（parseCube / compileCube）。本包不包含或聲称已執行 Blockbench。


## A1.1.0 新增與修改（2026-09-19）

固定來源提交維持 9a1acdab27698457bec16c9362678e574895a28c。新增牛肉串熟度／焦化原圖、生熟分口／食物碎塊模型，以及特製調料 65 個狀態模型及 selector。逐檔來源／原始 blob／本地 SHA-256 見 source_manifest.json。來源回復只有位元組 blob 雜湊完全吻合才接受，並保留沿用三份重新排版 JSON 的原狀態。

衍生修改為座標與 UV 轉換、圖集排列、原作元素組裝／狀態展開、Free Model 編輯檔、離線來源預覽；沒有新增重畫貼圖或通用代替模型。生成的 geometry、bbmodel 內嵌圖集、PNG 及 HTML 內嵌預覽仍依 CC BY-NC-SA 4.0。回復工具中的原 PNG base64 和原作素材資料也保留同一素材授權，並非 MIT。

bridge. 文件及公開程式只用於核對專案和封裝結構，未將其編輯器程式碼打包或聲稱 bridge. 官方背書。

## A1.2.0 additions and transformations

Pinned upstream source commit unchanged: `9a1acdab27698457bec16c9362678e574895a28c`. Added the authored oil_press, oil_press_frame, oil_press_hit_0–4 JSONs and original oil_press.png, all full Git-blob verified. Restored exact source byte formatting for seasoning_bottle and big_vat; one older JSON remains explicitly marked non-byte-exact in source_manifest.json.

Adaptations include lossless PNG atlas placement, coordinate/UV conversion, and explicit one-sided zero-thickness face lowering of all-axis-inverted interior cuboids. The original models remain in source_snapshots. Generated geometry, model previews and embedded textures remain adaptations governed by CC BY-NC-SA 4.0. New offline review software is covered by LICENSE-TOOLS; this does not relicense the original or adapted art. No official affiliation, endorsement, or game-engine acceptance is implied.


## A1.3.0 新增與修改（2026-09-19）

新增原作八個油餅堆疊／壓縮模型、榨油機 multipart 方塊狀態、羊肉串十九個鏈內 JSON、兩個物品 selector 與六張原 PNG，共三十六個固定來源檔，完整 Git blob 全數核對吻合。來源提交不变，逐檔網址、blob、SHA-256 記在 source_manifest.json。

衍生修改包括候選幾何／UV 轉換、圖集原像素排列、既有部件的原規則組裝、編輯檔及離線檢查圖。原作素材、回復工具中內嵌的素材資料、全部新增圖集／模型／渲染與 HTML 預覽仍依 CC BY-NC-SA 4.0；新工具授權不會改變原素材的權利。

沒有自行重畫羊肉貼圖、修正原作油餅零高度 UV 或移動原始幾何掩蓋穿插。沒有提供流體、動畫、玩法或官方背書。

## A1.4.0 新增與修改（2026-09-19）

新增蘑菇串與末影珍珠串的38份模型鏈JSON、4份selector與12張PNG，共54份固定來源；完整Git blob全部吻合。來源提交仍為`9a1acdab27698457bec16c9362678e574895a28c`，逐檔證據保存在source_manifest.json。

衍生修改包含圖集原像素排列、原始元素／狀態轉換，以及180°面UV等價改寫為反向端點。不重畫、調色或抹去原作粒子別名問題。新增生成模型、編輯檔中素材、來源資料、回復工具內嵌素材及渲染／HTML預覽仍依CC BY-NC-SA 4.0；新工具授權不會重新授權上述美術。沒有官方背書、引擎驗收或玩法完成的聲明。


## A1.5.0 新增與修改（2026-09-19）

來源提交不變。新增魚串、雞皮串、土豆片串、饅頭片串的完整固定目錄鏈與對應物品 selector，以及28張原PNG，合計106個來源檔全部完整Git blob核對吻合。來源、模型數、分口數及原圖引用差異逐項保留。

衍生修改為座標／UV轉換、圖集原像素排列、可編輯檔和離線模型渲染。沒有重畫貼圖、補造原作不存在的部件或自行調整分口數。新模型、PNG、HTML內嵌圖、contact_sheets、multiview圖及恢復腳本內的原素材資料都依CC BY-NC-SA 4.0，工具授權不取代上述素材授權。沒有官方背書或引擎驗收聲明。

## A1.9.0 烤爐補充來源與衍生修改（2026-09-19）

主要素材來源提交仍為 `9a1acdab27698457bec16c9362678e574895a28c`。本批缺檔的四種烤爐和兩張貼圖改從 **Arbousier1/KaleidoscopeGrilling** 的 **`1f58a520a4e8424b2f10558d2a60e2817bcb5635`** 提交取得，實際路徑在 `craftengine/kaleidoscope_grilling/resourcepack/assets/kaleidoscope_grilling/`。感謝 Arbousier1 保存並公開此 CraftEngine 移植版的資源。

新增六個檔案完整 Git blob 全部吻合。source_snapshots 的 common/... 目錄是轉換器使用的邏輯資源覆蓋層，不表示這六個檔案存在於主上游提交。逐檔 source_repository、source_commit、source_remote_path 是來源依據；未聲稱與正式 Java 發行包等價。

Fork 原 NOTICE 保存於 docs/third_party/Arbousier1-NOTICE.txt，原聲明明確保留 CC BY-NC-SA 4.0。本批來源、恢復腳本中的模型數值與 PNG base64、轉換幾何、圖集、編輯檔、PNG／HTML 預覽均依相同素材授權。工具 MIT 授權不取代這些素材條款。

衍生修改為坐標／UV 轉換、反向內壁拆成原位單面片、圖集原像素排列和離線預覽。沒有重畫、重新染色、縮短斜腳、補實爐網或重寫原 JSON。NeoForge 特殊亮度與低於原點的擺放需求保存並明列未完成，不冒稱基岩版功能已實現。


## A1.10.0 source completion

84 added snapshots (65 JSON, 19 PNG) are from breezeth-CN/KaleidoscopeGrilling, revision 9a1acdab27698457bec16c9362678e574895a28c, within the original models/item/fixed_skewers, item selectors and textures/item/fixed_skewers paths. Families: caterpillar, squid_tentacle, sweet_potato_sheet and ordinary. Full blob hashes are verified. All 20 fixed-skewer directory trees are verified against pinned source trees. Geometry conversion, atlasing and editable counterparts are adaptations under the original asset terms; no endorsement implied. Earlier fork grill attribution is unchanged.

## A1.11 additions

The five advanced-rack models, their original PNG, the rack blockstate mapping and the skewer recipe-data JSON are from the primary pinned KaleidoscopeGrilling commit; exact paths and blob hashes are recorded in source_manifest.json. The guide prose, navigation prototype and adapter port were authored for this Bedrock engineering workspace. The Chinese Food and Cookery public author pages are referenced as design evidence only; no scripts or guide assets from their mcaddon packages have been copied. The adapter is not claimed to be a public Cookery API.

## A1.12 canola and guide-only integration

Canola models/textures remain under the same pinned Grilling source licence. The 25 guide thumbnails are derived from actual exported model geometry, not newly drawn replacement art. Publisher licence and detailed attribution are in integration/cookery106/. Cookery 1.0.6 host code is only inspected/tested from the user-provided archive and is not bundled into runtime packs.


## G82 Java Cookery palette sources

Default generated particle samples for 99 original foods are reviewed from KaleidoscopeMods/KaleidoscopeCookery Forge `2f4e386ce23f49a385ddf003c67fc6415c55417a` and NeoForge `4d39e36cfa749939ba5f9d6d3b715ef9a984cb9c`. Only suspicious stir fry changes its seven derived stage atlases; 98 equal palettes remain. Original/derived resources: Copyright (c) 2025 Kaleidoscope Official Production Team, CC BY-NC-SA 4.0. Detailed source paths, identities, limited tint scope and the changed public sprite attribution are in development/gameplay_core/fixtures/java-cookery-palette-160/. No author endorsement or private Bedrock food scripts are included.

## Failure-skewer source alignment candidate (2026-10-15)

The mysterious-skewer and dark-grilling source closure is from [breezeth-CN/KaleidoscopeGrilling at 9a1acdab27698457bec16c9362678e574895a28c](https://github.com/breezeth-CN/KaleidoscopeGrilling/tree/9a1acdab27698457bec16c9362678e574895a28c). Credit: Copyright (c) 2026, breezeth; reused Cookery resources Copyright (c) 2025, Kaleidoscope Official Production Team. No endorsement is implied.

The 403 pinned files, original notices and per-file Git blob/SHA256 provenance are in `development/gameplay_core/fixtures/java-failure-skewer-9a1acdab/` at the repository root. Author Java source remains under its original BSD 3-Clause `LICENSE-CODE`. Original art and all adapted failure-skewer geometries, texture atlases and attachable/model asset data remain under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), as preserved in `LICENSE-ASSETS`; this project's tool/code license does not relicense those assets.

## Cookery 1.6.1 public food visual extension

The four appended food slots 214–217 (`tea_egg`, `butter_tea`, `clay_pot_milk_tea`, `mystery_tea`) reference the required [Cookery Bedrock 1.6.1 public file 9123386](https://www.curseforge.com/minecraft-bedrock/addons/kaleidoscope-cookery-unofficial/files/9123386), archive SHA256 `5b01865d4dd9a455cd80dae4ddc94dc45964e074025f7d24c6f0c5e35f0fbe52`. Original creator: Kaleidoscope Official Production Team; Bedrock adaptation: Loyallay. The pack's `ATTRIBUTION.txt` retains the original resource license, CC BY-NC-SA 4.0.

Only sixteen-color samples, alpha outline facts, and derived Grilling stage palettes are retained here. Complete Cookery artwork and behavior scripts are not included. Helper textures reference `textures/items/kc_{food_name}` in the installed dependency RP. The catalog, palette and alpha fixtures record each source item path/hash and texture path/hash; `tools/import_cookery_161_visuals.py` verifies those extracted bytes against the exact archive and preserves all preceding 213 records. These derived data, palette PNGs and sprite outlines retain CC BY-NC-SA 4.0. The Bedrock samples make no claim of Java particle equivalence, author endorsement, or native client rendering acceptance.

Adaptations are Java-to-Bedrock coordinate/UV conversion, source-pixel atlas packing, ordered override selection and held/eating attachment routing. No replacement art, guessed tint or corrected upstream override is introduced. The generated files are `gameplay_core/resource_pack/models/entity/failure_skewer_held.geo.json`, `textures/failure_skewer/`, `render_controllers/failure_skewer_held.render_controllers.json`, and the six mysterious-skewer/dark-grilling canonical/ALT/plain attachables. Extracted vanilla charcoal/magma-cream research textures and the vanilla client archive are not bundled.
