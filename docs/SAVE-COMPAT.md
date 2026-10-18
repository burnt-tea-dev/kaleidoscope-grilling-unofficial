# 存檔相容規則（luosen 與所有玩家存檔）

> 這份文件和 `tools/guards/save_compat.py` 一起構成**硬性護欄**。任何人（含 AI）都不得為了「清理」、「重構」或「收斂」而繞過它。

## 為什麼

Bedrock 載入世界時，對「已不存在的定義」不會報錯，而是**靜默銷毀資料**：

| 被移除／改動的東西 | 世界裡會發生的事 |
| --- | --- |
| 物品 identifier | 背包、箱子、掉落物、烤架／料理架／調料瓶 helper 庫存中的該物品**消失** |
| 方塊 identifier | 已放置的方塊變成 unknown／被替換，方塊上的狀態與綁定資料失效 |
| 方塊 state 或 state 值 | 存檔中的 permutation 無法對應，方塊重置或變 unknown |
| entity identifier | 該類實體全部被刪除。`inventory_grill_v1`、`inventory_rack_v1`、`inventory_seasoning_v1` **裝著玩家真實的 ItemStack**，刪除等於刪光所有烤架／料理架／調料瓶內容 |
| pack header／module UUID | 世界找不到原本啟用的 pack，整包失效 |
| dynamic property 的 key 或前綴 | 舊資料變成孤兒：烤架狀態、秘製串內容、餐盤內容、效果、所有權收據全部讀不到 |

## 護欄做什麼

`tools/guards/save-compat.lock.json` 記錄 canonical runtime 目前的：items、blocks（含每個 state 的所有值）、entities、腳本中可辨識的 persisted key 字面值／前綴、BP/RP UUID。

- `python3 tools/guards/save_compat.py check`：任何一項**消失**就失敗。
- `python3 tools/guards/save_compat.py update`：只把**新增**項記錄進 lock，**永遠不刪**。
- CI（`.github/workflows/guards.yml`）另外用 **base 分支的 lock** 再檢查一次，所以在 PR 裡手改 lock 刪項目也藏不住。

## 唯一允許的退役流程

要移除任何 identifier／state 值／key，必須**全部**做到：

1. 在 `tools/guards/id-retirements.json` 的 `retired` 陣列加一筆：
   ```json
   {
     "id": "kaleidoscope_grilling:grilled_beef_skewer_native_plain",
     "replacement": "kaleidoscope_grilling:grilled_beef_skewer",
     "migration": "runtime | offline-rewrite",
     "reason": "eating-route shadow item; animation now selected by player property",
     "world_rewrite_receipt": "ops/receipts/2026-11-xx-luosen-staging-rewrite.json"
   }
   ```
2. `migration: "runtime"`：腳本裡**仍保留**舊 ID 字串，在玩家上線／開啟容器／互動時把舊物品轉成新物品（保留數量與所有 metadata）。保留至少兩個正式版本後才可再評估。
3. `migration: "offline-rewrite"`：在**停服世界的副本**上執行離線改寫工具（見 REBUILD-PLAN §5.6），收據要記錄改寫前後每個 ID 的數量，**舊 ID 改寫後數量必須為 0、新 ID 增加量必須等於舊 ID 數量**。
4. 先在 staging 世界走完：載入→互動→重啟→再載入，沒有遺失。
5. 才可以部署到 luosen。部署前保留完整停服備份（見 REBUILD-PLAN §5.3）。

純視覺實體（`*_visual`）沒有玩家資料，但仍需走這個流程（`migration` 可填 `runtime`，由腳本在區塊載入時清除舊實體；收據填 staging 驗證紀錄）。

## Persisted key 的寫法規範（重構時必讀）

- 所有 dynamic property key 與前綴集中在一個登錄模組（目標：`scripts/core/persist_keys.js`），**字面值逐字保留**，例如 `'kaleidoscope_grilling:g_'`、`'kaleidoscope_grilling:storage_v1/'`。
- 不可改成模板字串拼出同樣結果（護欄看不到，等於移除）。
- 要換新格式：新增新 key，讀取時「新 key 優先、否則讀舊 key 並寫回新 key」，舊 key 的讀取碼保留到退役流程完成。

## 新增東西

新增 item／block／entity／state 值／key 是允許的，但必須在同一個 PR 執行 `update` 把它記錄進 lock，讓審查者看到。新增也代表從此必須永久保留，所以**不要為了視覺路線新增 item ID**（見 REBUILD-PLAN 的「禁止模式」）。
