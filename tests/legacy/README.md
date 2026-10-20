# 重建期保留測試

## PR250／PR251 additive reconciliation

All 93 existing entrypoints and their pure assertions remain. Native ESM scenarios are now
consolidated into the existing plate, oil, rack, bottle, food-finish and snapshot suites;
shared queue/configuration assertions live in test_core. The rack suite also runs seven
native-boundary regressions. Total counted test files remains 101; no ceiling is raised.
The resolve-only loader supplies the external @minecraft/server boundary while canonical
modules and registered handlers execute unchanged. No source slicing or appended exports.
See classification.json native_scenario_addendum for the exact mapping and remaining gaps.

The original classification below describes the first pure-only pass. Its statements that
native callbacks/a2769 were not yet exercised are superseded by this addendum; BDS, staging,
client acceptance and the broader P3/P4 work remain unclaimed.

## Original first-pass classification

這裡是 T2.5 第一輪分流後仍可在 Node 執行的 93 支測試檔。它們直接 import
`projects/grilling/gameplay_core/behavior_pack/scripts/` 的匯出，不再使用
`development/` 副本、切出原始碼函式、`node:vm` 或替換 runtime 模組。
其中有些使用明確的物品資料或儲存 callback 來檢查 metadata、失敗回滾與輸出規則；
這些結果不代表 Minecraft 事件、原生容器、staging 或真人畫面已驗收。

```sh
python3 tools/run_legacy_tests.py
```

runner 執行這個目錄內全部 `test_*.mjs` 與 `*.test.mjs`，不設失敗例外清單，
也不加 VM 選項。P3 每個域以 Java 規則建立 unit／scenario 測試後，刪除對應的
legacy 測試；不要把這裡的舊 Bedrock 實作當成 Java 正確答案。

## 逐檔決定與未覆蓋規則

[`classification.json`](classification.json) 列出基準 `df0ff11` 的全部 224 個測試檔：
93 個搬遷或抽留純函式部分、122 個退役、9 個留在原位置。最後一組包含 8 個工具／
宣告檢查，以及隨 notebook 和兩個 caller 留至 T2.2 的 `notebook/test.mjs`。
棘輪計數從 221 降至 101；3 個原始 `test.mjs` 不在該指標的命名範圍。

分類檔是審查索引，不是新的 CI gate、見證鏈或驗收收據。每個刪除的 source VM
套件都有後續規則群與 T3／P4 任務；尤其以下流程仍需重建：

- **餐盤與串譜**：主副手轉移、滿背包、破壞／爆炸取消、未知掉落結果、隔離狀態跨重啟，
  以及外來資料變更後不誤退款。這裡只保留直接函式的解碼、朝向、支撐與擁有權檢查。
- **榨油與大缸**：桶的餘量、產物掉落、延後完成、區塊卸載、多人操作、寫入失敗與重試。
  這裡只保留直接函式的油種／容量、工具、registry 與資料轉換規則。
- **料理架**：實際點擊位置、9 格轉移、工具 metadata、跨架自動化、失敗回滾與顯示同步。
  這裡的 tag、filter、命中計算與資料函式不代替完整事件測試。
- **進食、熱度與 lore**：原生完成與提前結算不得重複扣份／給效果，原生欄位及完整
  RawMessage 必須保留。`test_a2769_core.mjs` 的 canonical import 會到達
  `@minecraft/server`，本輪未以假模組繞過；其 tooltip／20 行 lore 場景列為待補。
- **視覺**：舊 Python 投影、校準、幾何烘焙與實驗包測試退役。第一／第三人稱、放置、
  進食、瓶、工具與 HUD 是否正確，仍要在 P4 以 Java 參考與真實 renderer 驗收。

`source_text_slicing_tests = 0` 是測試棘輪的結果，**不表示整個 repo 已沒有原始碼
文字斷言**。非 `test_*` 的 `tools/check_family_knives.mjs` 與
`tools/check_station_storage.py` 仍由 family-candidate 使用；它們的 development
副本相等／source includes 段落留待 T2.7／P3 處理。station 的真實 entity、inventory
與 resource schema 檢查必須保留，不能把整支工具刪掉以取得零計數。

## 明確修正的舊期待

初次改成 canonical import 時發現的差異已逐項記在分類檔，沒有用新版總數取代舊版
總數來湊通過。a2727 保留具體配方與正向 capability 篩選，移除「只能有 9 配方／4
磨坊配方」；a2732 保留食物效果，移除「只能有 2 食物」。防禦拷貝改以物品或配方 ID
定位，避免把陣列第一筆當成永遠固定。

a277 的 primary 失敗改成先部分寫入，再斷言原狀態恢復且資源數量不變，不鎖死未嘗試
步驟的 rollback callback 次數。初始 grill state 的 `seasonings: []` 是回傳 schema
適配。燒成炭後保持火焰，以及 ready HUD 使用 `jade.kaleidoscope_grilling.grill.ready`，
均由 Java `9a1acdab27698457bec16c9362678e574895a28c` 的 `GrillBlockEntity`／
`GrillProvider` 原碼確認；測試內附永久連結。

Java survival 配方測試改讀 `data/java/recipes.json` 的 1.21.1 `recipe/` 資料
（`result.id`），不是 Forge 的 `recipes/`（`result.item`）。原玩法斷言保持不變。

## 資料與其他檢查

`fixtures/` 的 7 份 JSON 從原位置逐位元搬遷，保留原作者、版本、萃取方法與限制。
它們是獨立 Java 向量／來源資料或既有公開的有限 Cookery 契約資料，不是從目前
Bedrock 輸出重新錄製的答案。完整配方／tag 改讀 `data/java/`；原本的 Java 原始
fixtures 與 `source_snapshots` 仍留待各自任務處理。

存檔 guard、膨脹棘輪、baseline、bridge export、Java extraction 與 preview 工具
安全測試維持。指南 icon 與真實 loot 宣告檢查保留；loot 的固定 blob-hash 斷言刪除。
舊 immersion／player-binding workflows 只服務已退役實驗；本輪一併退役其測試 caller。
`check_cookery162_host.py` 的 source VM 驗證入口退役，**不代表 T1.10 官方包與伺服器包
逐檔比對完成**。
