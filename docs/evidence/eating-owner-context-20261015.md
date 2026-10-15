# G143 進食狀態與瓶子準備修復收據

2026-10-15。[PR215](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/215) 的來源修補；本收據依[官方來源優先流程](../ANIMATION-ITEM-REPAIR-WORKFLOW.md)區分來源、editor、BDS 與真人證據。沒有將 PR216 的 editor captures 或舊版 native captures 計為 G143 驗收。

## 精確來源與適用範圍

| 層級 | 固定身份與範圍 |
| --- | --- |
| Canonical 前像 | `ce340a7d7f13cd5be0c0ff95e6556ed3187c81a8`；修補邏輯提交 `8e8d6fceda6bf293501964ff1698faecb8ba0cb5`、`b95ba664290aa247e8e48dd125b2b3dd6a9a6742`、`83a22bbfca4ceae9c5267a282ad0a1d4b375658a`。 |
| G143 凍結 runtime | `361e4b1594b2713912095485bf20c8b194fd117c`；BP `9e06abe2ab1be4a977b319b9bd2a5731855e94a8a8885e5c7d84a35207d8e072`；RP `88a4c46f2d079f11f5f6f1e9965ff74b191c4a15ae64cac8f9461913971e1068`。合併 PR216 文件不改這組 runtime。 |
| Java 作者 | Grilling 1.1.1：Forge 1.20.1／CF8726006、NeoForge 1.21.1／CF8726014；選定作者來源 `9a1acdab27698457bec16c9362678e574895a28c`。進食時長／checkpoint 對照 `MultiBiteSkewerItem.java`，既有 Java 曲線 fixture 與 source snapshots 保留。這不是本輪重跑 Java client。 |
| Bedrock 目標 | client/BDS `1.26.52.3`；item format `1.26.30`；stable `@minecraft/server` `2.9.0`、`@minecraft/server-ui` `2.2.0`。上次已部署存檔首次載入（2026-10-14）記錄 BDS `Version 1.26.52.3`／`Build ID 51798919`，僅確認既有引擎身份，不沿用為本候選 C；本候選未重新跑 editor／BDS／client。 |
| 官方範例 | Mojang `bedrock-samples` `46ba6ea985fb5a92d79a9419198f10dda14c199d`（sample `1.26.50.4`）；它與目標 client 有版本差距，不能當作同版 vanilla 校準通過。 |

完整71檔功能差異（4個BP模組、67個RP JSON）的前後 SHA256 見 [`g143-eating-context-reviewed-delta.json`](../../tools/fixtures/g143-eating-context-reviewed-delta.json)。`main.js` 只隔離兩組 preparation 的精確一行差異見 [`g143-main-reviewed-delta.json`](../../tools/fixtures/g143-main-reviewed-delta.json)。包／模組版本與 BP→RP 自有相依同步143；UUID、指南契約及第三方相依身份保留。

## 官方依據 → 原失敗 → 最小修補

- Microsoft [`query.property`](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_property?view=minecraft-bedrock-stable)定義讀取被檢視實體的 property，缺失返回零；Mojang 固定版本的 [spear controller](https://github.com/Mojang/bedrock-samples/blob/46ba6ea985fb5a92d79a9419198f10dda14c199d/resource_pack/animation_controllers/spear.animation_controllers.json)明確用 `c.owning_entity->query` 取得持有者狀態。G143 的 `eat_*` properties 宣告在 player，舊 attachable 卻直接讀 `q.property`。修補只將這組自有 property／has_property 指向 owning player；player clips 保留 direct query，原生 item queries 保持既有環境。
- Microsoft [`query.main_hand_item_use_duration`](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_main_hand_item_use_duration?view=minecraft-bedrock-stable)明訂主手範圍。舊副手第一人稱路徑也讀主手 counter；G143 改用已存在的 `eat_elapsed_ticks` 同步時鐘，不猜測另一個原生 query 的單位。主手倒數慣例保留。
- 副手不再隨主手 counter 重啟後，既有末段測試揭露秘製串隱藏狀態會提早解除。沿用每手 retained `seen` 值，`2` 表示待服務端確認的隱藏；延續必須滿足仍有食材及完整四欄 snapshot 相同。elapsed 倒退、身份／手部／phase 或 snapshot 變更仍解除，沒有任意 timeout 或新增 player property。
- [PR200](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/200) 的窄比較修補只規範 snapshot 最外層等價 RawMessage lore 的比較，保留實際 lore、opaque metadata、損壞拒絕與回滾。失敗瓶子原會每 tick 重試完整背包並阻止後面的食物動畫準備；現在先記掃描節流、各槽獨立處理，瓶子與食物 preparation 各自執行。

## 差異、驗證與保留界線

`preview_only_changes: none`。G143 沒有使用 `.bbmodel`、editor camera／holder 補償、literal offhand binding、stage0 fixture 或 preview clock 作發布輸入；Java authored 曲線、骨架、geometry、PNG、音效、營養／結算、90／100 ticks、第25 tick與現行HUD布局／傳輸均保留。原生 `use_animation=eat` 與既有 player Override 沒有被刪除。

| 證據層 | 本輪結果 |
| --- | --- |
| source／結構 | exact reviewed continuation 可還原原始完整來源；原歷史 native/source hash 不改寫。新增 owner harness 將 attachable 與 player properties 分開；既有取消、完成、重複食用、末段與 metadata 守護保留。 |
| invariants B | 原 production 函式／API doubles 的扣料、單次結算、metadata readback／rollback及失敗瓶隔離案例通過；只支持其涵蓋的契約，不是原生玩家操作。 |
| 精確CI身份 | `712c8481811db85117b890858eb8ff920ae914c5` 的 [G505](https://github.com/casama233/kaleidoscope-grilling-unofficial/actions/runs/38689655950) source／Windows、baseline420、bridge406、family258及pre-commit成功。加入 PR216 文件與本收據後的新Git tree仍須取得自己的必檢結果，不能沿用712的whole-tree成功。 |
| editor preview | `not_run`；editor version／scope／camera／selected／playing set／timeline captures 均為 `not_run`，無本輪 captures，因此不報 editor 視覺通過。 |
| Java 純邏輯 A | `not_run`；本輪不是新Java邏輯向量或遊戲畫面對照。 |
| current native BDS C | `not_run`；本候選尚待完整家族存檔准入。 |
| current client D | `not_run`；本候選實際 client version／platform／FOV／skin 均為 `not_run`；`client=false`、`production_ready=false`。 |

近鏡放大、末段平片及最新 HUD 延遲仍未驗收；任意三食材獨立 tint／variant 的 native inventory icon 仍沒有已核實的 stable 路由。來源 clock／scope 修補、離線參考圖、editor或BDS均不能替代這些畫面結果。[目前缺口](../BUGS.md#eating-owner手持串的進食狀態與瓶子錯誤)與[GUI邊界](../CUSTOM-SKEWER-INVENTORY-RENDER-LIMITS.md)保持。
