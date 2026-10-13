# 地面判斷資料的啟動負擔

2026-10-13，基於 canonical G130 `a567e17c0316f7f2175dfef07004bb944634ca90`。
本修補尚未在原生候選量測，沒有把 source 等價或 Node 測試列為 watchdog 修復驗收。

`projectile_dodge_ground_core.js` 只使用生成 catalog 的 `PROJECTILE_DODGE_GROUND_ROWS`。
原 catalog 仍在每次載入時建立及遞迴凍結整份原作查核資訊，包含 1,032 筆 diagnostic facts、
未採納身份、分支範圍和未知方塊 ID。這五個 exports 在 canonical production 中沒有 consumer；
唯一直接讀取 facts 的用途是來源回歸測試。

生成器現把這五份來源資料輸出到
`development/gameplay_core/fixtures/projectile-dodge-ground-diagnostics.json`，由原有來源測試讀取。
原始 Java facts、身份證據、未採納範圍及原 fixture 全部保留，`--check` 同時核對 runtime 和 diagnostic 產物。
發布包只保留實際使用的 954 筆 rows，並把相同 JSON 字面內容編碼為 `JSON.parse` 字串，避免編譯大量物件運算式。
原有遞迴 freeze、查找表、alias tuple 驗證與未知狀態拒絕規則保持。

[完整来源差分](ground-catalog-startup-20261013.json)核對相同值、鍵順序、原型、屬性描述符與凍結深度；
954 個已知分類與一個未知分類均相同。從載入路徑移除 **12,640 個 diagnostic 物件／陣列**，
runtime catalog 從 **1,129,402** 降至 **592,979 bytes**。
這是確定的來源工作量減少；不是 Bedrock 記憶體用量或原生耗時的推算。
現有九個地面分類／落地邊界測試通過，沒有新增加玩法或任意放寬地面支撐。

修補開始前讀取 BSM Java 狀態：`checked_at=2026-10-12T22:23:03.909303+00:00`。
Grilling 1.1.1 的 Forge1.20.1／CF8726006 與 NeoForge1.21.1／CF8726014 均為
`reference_metadata_current_parity_pending`；選定原作修訂仍為 `9a1acdab27698457bec16c9362678e574895a28c`。
這次不新增 Java 玩法聲畫驗收範圍，也不改既有植物、食用或保存語義。

G130 的 LIVE 啟動記錄曾有 Grilling 444ms Spike；本修補需隨下一完整家族候選的停服存檔載入／重啟
及正常 LIVE 啟動讀回觀察。`client=false`、原生效能改善未證明、完整 Java 一比一仍待各具體情境驗收。
