# G128：調料 Uses 與 Numb schema 修補草稿

身份 **2.8.128**、指南 **0.3.58**，在既有 PR194 branch 普通追加；G127 `4524942dbc88c04eff02f05989b37fe0abb2fe6b` 與全部歷史 lock/witness 保留。由於 exported bytes 改變，依不可重用身份契約升版，沒有改寫 G127。

- Uses 修補是獨立 source commit `160edcd0c0ad421dd17b7b55024f96ae73d36b24`，只有兩個功能腳本：正規辨識已擁有的 Uses RawMessage/legacy 行，替換為唯一當前行，保留 Ingredients 和自訂 lore；不改扣次、物品變體或交易。具體缺陷與原生界線見 [證據](evidence/cookery-uses-lore-native-20261011.md)。
- Numb 只移除 `animation.kg_a22.player.numb_stop` 的空 `bones: {}`，保留 0.05 秒 stop、active clips 和 controller。既有 Numb regression 新增空 map schema guard；calibration 先逐 byte 驗不可變 G125 witness，再只容許該刪除。Numb 原生載入／觸發／消退复驗 pending，不能借用 Uses 原生通過。
- 其餘 runtime 改動僅 paired manifests、module/dependency 和 guide identity，沒有其他玩法、動畫或 HUD 修補。G127 動畫和 Atlas source gate 由新正式入口完整繼承。

## 驗證界線

Uses 獨立 G125 DIAG1 的新三基礎粉瓶：搖成 Special16/16，再兩次真撒料，三張原圖均唯一 Uses16→15→14、Ingredients3/8 保留；已 cold rollback 全檔回原 baseline。舊髒瓶 cleanup、DIAG1 完整耗盡與音效未測。新 G128 合併包原生、BDS／完整家族與保存演練沒有由此證成。`client=false`、`production_ready=false`，不 merge、Release 或 LIVE。

本版正式入口 `verify_current.py` 繼承完整 G127 gates 並新增已知 Uses 缺陷 regression。本地 targeted 結果和精確新 head 的 required CI 應分開報告，不繼承舊 head 的完整通過聲明。

2026-10-11 07:55 UTC 重新讀 canonical Tavern `family/java-upstream.json`（blob `6837a24050fcc4c95cad72de528eea9374ba8755`），Grilling 維護分支仍列 Forge1.20.1 CF8726006／NeoForge1.21.1 CF8726014、作者1.1.1。這是目前 registry 讀回，非作者發布端或 BSM 新查核；歷史 BSM 狀態不冒充本次刷新，完整 Java parity 仍未宣稱。
