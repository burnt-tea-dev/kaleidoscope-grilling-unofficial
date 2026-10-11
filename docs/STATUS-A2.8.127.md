# G127：兩食品動畫與 Atlas HUD 後繼草稿

身份為 **2.8.127**，指南 **0.3.57**。以 G126 的完整來源為前置，保持其 PR、UUID、歷史 witness 與修補；本版是獨立後繼草稿。

## 精確來源範圍

- G126 動畫 admission 原樣保留；只增加熟饅頭片 TWO／熟末影珍珠 THREE、主手及空副手的 exact-ID selector。專用 player clips 僅改原曲線的手臂外層位置與比例，其餘 fallback、第三人稱、物品／socket／helper、秘製串及其他食品保留。
- HUD 使用 Java 1.1.1 NeoForge 1.21.1 原 JAR 的圖形資料生成單張 Atlas；保留 54 張舊 PNG、來源 fixture、25-tick checkpoint、原 intro／hold／fade 及 no-clear 行為。Atlas 以正式 HUD functional 入口觸發既有測試。
- generator 在 G127 註冊兩條路由；完整重建須冪等，非目標 runtime 除版本／guide metadata 外逐檔守恆。
- public source witness 新增一個 exact selector delta，以獨立、不可變的 reviewed source commit 為 postimage；原 G126 witness 與歷史身份不改寫。

## 驗證與邊界

本版正式入口是 `development/gameplay_core/verify_current.py`。來源收據只在完整 functional 成功且來源未漂移後寫入；baseline、歷史身份、實際打包與 Dash export 為各自獨立門檻。先前未编版草稿的 diagnostic sweep 並非本版 aggregate 成功證據。

獨立兩食品窄實片已涵蓋特定皮膚／FOV 的 full/cancel 恢復；Atlas 單次受控 no-clear 實片不代表此合併包。G127 的組合原生呈現、自然食用、所有食品／皮膚／FOV／第三人稱、完整家族與保存演練仍未完成。近嘴串放大與原作碎屑等粒子呈現仍開放；本次不加入 NONE、no-crumb 或 flash 實驗。`client=false`、`production_ready=false`。

## 上游與交付狀態

2026-10-10 04:30 UTC 讀取 canonical `family/java-upstream.json`：Grilling 維護分支仍列 Forge 1.20.1 CF8726006 與 NeoForge 1.21.1 CF8726014，均為作者 1.1.1。使用完整 NeoForge JAR 作資產來源核對，沒有執行 Java 遊戲。BSM 上游狀態僅沿用 2026-10-09 22:35 UTC 的讀回；這不是新 LIVE 檢查。來源 pin 與資產相等不代表完整 Java 還原。

此階段只授權離線身份、witness 與完整門檻；沒有 remote push、merge、Release、家族部署或 LIVE 變更。後續遠端發布須對精確提交與 scope 另行排程。
