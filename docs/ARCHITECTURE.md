# 目前架構

本文描述目前實際來源；P3 的完整目標佈局另見 [REBUILD-PLAN §3](REBUILD-PLAN.md#3-目標架構終態)。來源仍在原 canonical BP/RP；功能域集中在 scripts 下，沒有建立第二份 pack。

## 來源與輸出

| 範圍 | 目前唯一位置／責任 |
| --- | --- |
| canonical BP | `projects/grilling/gameplay_core/behavior_pack/` |
| canonical RP | `projects/grilling/gameplay_core/resource_pack/` |
| 身份與相依 | [baseline.json](../baseline.json)：目前 BP/RP UUID、版本、Cookery 相依與來源樹身份 |
| bridge 工程 | [config.json](../config.json) 指向同一 BP/RP；匯出檢查不等於發布或 client 驗收 |
| Java 來源 | `projects/grilling/source_snapshots/` 與 `source_manifest.json` 保留逐檔來源；主要 pin 為 `9a1acdab…`，另有明列 fork 來源，不把所有素材偽稱同一來源 |
| Java 資料表 | [data/java](../data/java/)；[tools/java_extract](../tools/java_extract/README.md) 可由釘選上游重新萃取，P2 不改 runtime 去讀它們 |
| 工程護欄 | `tools/guards/`、`tools/baseline_gate.py`；存檔與 bytes 邊界見 [SAVE-COMPAT](SAVE-COMPAT.md) |
| 世界作業 | [tools/ops](../tools/ops/README.md)：盤點及停止備份副本的 ID 普查；目前 census 工具沒有改寫模式 |

`development/` 與依賴它的舊產生器已於 T2.7 退役；保留測試直接載入 canonical 模組，不另存第二份 pack。已退役的版本層驗證不能重新作為 main 的建置入口。工具／文件不改輸出時，不 bump 包版本、不建 runtime 候選、不重啟 LIVE。

## Runtime 的現況

`scripts/main.js` 只組裝功能域。烤架、穿串、食用、效果、玩家事件及調料各有自己的 runtime；食用、動作與效果的暫存表由該域私有保存，透過具名函式協調。版本編號模組已按功能搬回域中；沒有用新包裝轉呼叫舊 main。七條從未載入的食材處理路徑，以及已被公開油 API 取代的舊 fallback 已退役。

| 功能域 | 目前入口與核心 |
| --- | --- |
| 烤架與穿串 | `grill/runtime.js`、`grill/grill_transaction_core.js`、`skewer/runtime.js`、`skewer/skewering_core.js` |
| 食用、效果、玩家 | `food/runtime.js`、`effect/runtime.js`、`player/runtime.js`；各域保存自己的暫存狀態 |
| 調料、油、料理 | `seasoning/runtime.js`、`oil/oil_machine_runtime.js`、`food/cookery_cuisine_runtime.js` |
| 餐盤、架、作物 | `plate/`、`rack/`、`world/`、`recipe/` |
| 共用與外部 | `core/events.js`、`core/scheduler.js`、既有 transaction 模組、`host_api/`、`guide/` |

食用外觀仍使用既有相容物品與 player properties；這輪沒有冒稱食用或全部交易已完成原生重建。
上表只定位來源，不表示每條能力都已完成原生或真人驗收。完整玩家結果和跨域缺口在 [PARITY](PARITY.md)／[KNOWN-ISSUES](KNOWN-ISSUES.md)。

## 共用事件與排程

`core/events.js` 是本包的唯一全域方塊互動入口。依明列的優先序及方塊範圍派送；第一個接受手勢的玩法設定 cancel 後，後續玩法不再寫入。庫存與視覺觀察在玩法派送後執行。原生格子、物品及方塊 custom component 的既有交易路徑保留。

`core/scheduler.js` 是本包唯一的 interval。各域註冊自己的週期與工作；一項失敗不阻塞其他工作。同一 tick 共用玩家查詢，不跨 tick 保存過期玩家清單。方塊原生命名 tick 保留由引擎排程。

`host_api/oil_api_host.js` 是供 Cookery 使用的公開宿主來源，執行於另一個包的腳本環境，因此保留自己的互動入口。全樹計數含它，不能把兩個包硬接成一個全域事件環境。

## 保存與交易邊界

烤架、料理架與調料瓶的隱藏庫存實體裝著真實 ItemStack。它們的 identifier、容量、component schema 與 ownership 受 `save-compat.lock.json` 保護；普通「清理實體」不能刪它們或縮減庫存。

目前有 world／entity／item dynamic properties、保存 envelope、claim、批次／回復記錄及其他 persisted key。完整字面值／前綴以 [save-compat.lock.json](../tools/guards/save-compat.lock.json) 的 `persisted_key_literals` 為準，不抄固定舊數量。未知交付不能當失敗重試；外來槽位與 metadata 不因本次回滾被覆寫。API 讀回也不證明磁碟 flush 或任意 crash 原子性。

P3 將保存鍵集中與交易收斂時，仍要逐字保留既有 key／ID／UUID。任何退役走 [SAVE-COMPAT](SAVE-COMPAT.md) 的完整流程；文件改名或目錄整理不是例外。

## 視覺與跨包接口

目前 player property、held transport、RP controller 與 attachable 共同呈現食物／瓶／盤。Grilling 仍有自己的 `entities/player.json`；共用 player owner 與其他進食包相容屬 T3.4／D6，本文不把未來方案寫成已部署架構。巨型烘焙模型、影子 item ID 與多代路線也仍在 runtime；P2 文件收斂沒有退役它們。

manifest 的 Cookery 相依只表示包身份要求，不證明每項 adapter／宿主能力已存在。公開接口的來源、認證界線與 failure behavior 以 [BEDROCK-INTEGRATION-API](BEDROCK-INTEGRATION-API.md) 為準；指南只使用既有 Cookery 書的一個煙火入口與六個根類。原作者完整包、私有整合邏輯與機密不放入這裡。

## CI 與證據

[ci.yml](../.github/workflows/ci.yml) 跑既有 guards、baseline、tracked JSON、保留玩法測試、指南／戰利品宣告、Java 萃取與保留工具回歸；[guards.yml](../.github/workflows/guards.yml) 另以 base lock／ratchet 保護規則。baseline 與 bridge 的必要驗證保留；T2.4 退役舊工具不代表放寬 runtime 身份或輸出約束。

保留測試包含純規則，以及 #250 以[受控外部 API 邊界](../tests/helpers/README.md)執行 canonical ESM、已註冊事件與排程的情境；loader 只解析外部依賴，不切割、改寫或替換正式模組。具體覆蓋與未補場景見 [分類補充](../tests/legacy/classification.json) 的 `native_scenario_addendum`；受控 API 結果仍不等於完整 BDS／Player 流程。需要 native binding 的 census 合成測試另有隔離入口；既有工具能執行不代表真實 LKG 重跑或 staging 已通過。實際來源、CI、staging、部署、真人證據分開記錄。

## 授權與歷史

原碼、素材與工具的授權各自保留，見 [ATTRIBUTION](../projects/grilling/ATTRIBUTION.md)、`projects/grilling/LICENSE-ASSETS`、`LICENSE-TOOLS`、`data/java/LICENSE-CODE`／`LICENSE-ASSETS`／`NOTICE`，以及 [個別來源聲明](../projects/grilling/licenses/)。T2.6 搬移兩份來源聲明時保留原 bytes，沒有改為同一授權。

較早架構與版本細節可在 [archive tag](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/tree/archive/pre-rebuild-20261018)及[收斂前來源](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/tree/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b)查閱；它們保留歷史身份，不再作為今天的操作指令。
