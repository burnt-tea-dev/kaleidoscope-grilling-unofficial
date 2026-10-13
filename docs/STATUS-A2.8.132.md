# G132：進度獎勵所有權與啟動資料精簡

身份：**2.8.132／指南0.3.62**；候選 tag `A2.8.132-beta.1`。G131 的不可變 release claim/history 保留，本輪只發布及部署最終 G132。

山野芬芳等共用進度獎勵原先先發 XP 再寫完成，寫入失敗或 native XP 結果不明可能在重試／fallback 重複發獎。現在先寫 pending 並確認讀回，才作一次 native XP 嘗試；成功完成仍保存 legacy boolean true。正常 25 XP／0 XP、公告及事件保持；八項實際 adapter 故障 regression 通過並接入 canonical CI。[原作證據與限制](evidence/advancement-claim-20261013.md)。

這是 at-most-once attempt 防重，不是跨 dynamic property／XP API 的原子交易；未知結果可能尚未發 XP 而留在 pending，沒有自動重發或完整送達保證。

保留 [G131 啟動資料精簡](STATUS-A2.8.131.md)：catalog 1,129,402→354,022 bytes，移除 17,410 個不用於玩法的 eager 診斷物件；完整來源 facts／954 筆判斷語義保留。G130 HUD 圖形隔離／END 快照保持。這些來源結果不能證明 Grilling 舊 444ms Spike 已消失。

修補前 BSM Java 查核為 2026-10-13 06:23 HKT，Grilling 1.1.1 兩維護分支 metadata current、parity pending。候選仍待精確 source CI、完整家族停服存檔驗證／准入／LIVE 讀回及真人測試；`client=false`、`production_ready=false`，沒有完整 Java 一比一或全 addon 相容宣稱。
