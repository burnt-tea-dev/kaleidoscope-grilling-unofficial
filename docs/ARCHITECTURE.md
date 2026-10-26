# 目前架構

本文描述重建 P2 的實際來源；P3 的目標佈局另見 [REBUILD-PLAN §3](REBUILD-PLAN.md#3-目標架構終態)。文件收斂沒有建立新 runtime，也沒有把目前模組搬到 `packs/` 或新的 `core/`。

## 來源與輸出

| 範圍 | 目前唯一位置／責任 |
| --- | --- |
| canonical BP | `projects/grilling/gameplay_core/behavior_pack/` |
| canonical RP | `projects/grilling/gameplay_core/resource_pack/` |
| 身份與相依 | [baseline.json](../baseline.json)：當前版本、BP/RP UUID、Cookery 相依與來源樹身份（本分支為 G180／Cookery 1.6.4 的 T2.8 整合候選） |
| bridge 工程 | [config.json](../config.json) 指向同一 BP/RP；匯出檢查不等於發布或 client 驗收 |
| Java 來源 | `projects/grilling/source_snapshots/` 與 `source_manifest.json` 保留逐檔來源；主要 pin 為 `9a1acdab…`，另有明列 fork 來源，不把所有素材偽稱同一來源 |
| Java 資料表 | [data/java](../data/java/)；[tools/java_extract](../tools/java_extract/README.md) 可由釘選上游重新萃取，P2 不改 runtime 去讀它們 |
| 工程護欄 | `tools/guards/`、`tools/baseline_gate.py`；存檔與 bytes 邊界見 [SAVE-COMPAT](SAVE-COMPAT.md) |
| 世界作業 | [tools/ops](../tools/ops/README.md)：盤點及停止備份副本的 ID 普查；目前 census 工具沒有改寫模式 |

`development/` 與依賴它的舊產生器已於 T2.7 退役；保留測試直接載入 canonical 模組，不另存第二份 pack。已退役的版本層驗證不能重新作為 main 的建置入口。工具／文件不改輸出時，不 bump 包版本、不建 runtime 候選、不重啟 LIVE。

## Runtime 的現況

BP 的 `scripts/main.js` 仍同時承擔組裝與大量玩法工作；旁邊保留多個版本前綴模組。P3 尚未把它們收斂為每個 Java 功能域的 `logic.js`／`runtime.js`、唯一排程器或統一交易模組。現有全域事件與多個計時入口的競爭，是重構要解決的問題，不能在架構圖上先畫成已解決。

| 功能域 | 可定位的現有入口／核心 |
| --- | --- |
| 穿串、烤架、食用 | `main.js`、`a24_skewering_core.js`、`a275_grill_input_core.js`、`a276_grill_intent_core.js`、`a277_grill_transaction_core.js`、`secret_eating_core.js` |
| 餐盤與串譜 | `a25_plate_recipe_core.js`／`runtime.js`、`plate_transaction_core.js`、`plate_recipe_visual_core.js` |
| 調料、油與料理 | `seasoning_registry_core.js`、`seasoning_motion_runtime.js`、`a26_oil_machine_core.js`／`runtime.js`、`a2750_cookery_cuisine_core.js`／`runtime.js` |
| 料理架、植物、效果 | `a2746_advanced_rack_core.js`／`runtime.js`、`plant_fertilizer.js`、`plant_fertilizer_transaction_core.js`、`effect_lifecycle_core.js` |
| 動態手持與進食呈現 | `player_presentation_core.js`、`held_visual_dispatch_runtime.js`、`held_visual_transport.js`、各 held/visual runtime，加上 RP attachables／controllers／animations |
| 外部與指南 | `integration_api_runtime.js`、`integration_registry_core.js`、各 Cookery adapter、`guide/`；契約見 [整合 API](BEDROCK-INTEGRATION-API.md) 與 [指南規範](GUIDE-STANDARD.md) |

上表只定位來源，不表示每條能力都已完成原生或真人驗收。完整玩家結果和跨域缺口在 [PARITY](PARITY.md)／[KNOWN-ISSUES](KNOWN-ISSUES.md)。

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
