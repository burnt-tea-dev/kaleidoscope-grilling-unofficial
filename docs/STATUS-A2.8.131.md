# G131：移除啟動路徑中的來源診斷資料

身份：**2.8.131／指南0.3.61**；候選tag `A2.8.131-beta.1`。

地面判斷的來源診斷資料不參與玩法，卻隨腳本啟動建立／凍結。G131 將全部診斷exports及rows內的兩分支來源證據保留在canonical generated fixture，發布包只載入954筆實際判斷必要欄位。保留的資料使用相同JSON文字經JSON.parse載入及原有遞迴freeze；未知方塊／狀態、alias tuples及Java落地範圍保持。

來源比較：runtime catalog **1,129,402→354,022 bytes**；少建／凍結 **17,410個物件**。955個實際分類結果、所有consumer欄位值／順序／描述符／原型／凍結深度相同。既有九項地面边界測試、生成器雙產物檢查與語法檢查通過。完整說明及證據見[來源資料修補](evidence/ground-catalog-startup-20261013.md)。這些數字不是原生耗時或記憶體改善的估計。

G130圖形HUD通道／END快照、25tick食用判定、90／100tick動畫、資料保存與所有玩法沿用；未修改第三方完整腳本。當前Java查核為2026-10-13 06:23 HKT，Grilling1.1.1兩維護分支metadata current、parity pending。

本候選仍須精確來源CI、完整家族准入、停服存檔副本首次載入／重啟與LIVE读回。G130原啟動444ms Spike需在本候選原生窗口重新觀察，沒有宣稱所有watchdog警告解決或完整Java一比一。`client=false`、`production_ready=false`。
