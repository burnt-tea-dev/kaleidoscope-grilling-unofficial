# AGENTS.md — 煙火基岩版移植（重建期）

> 這份是**所有 AI 代理與維護者的行為規則**。工作內容與順序在 [`docs/REBUILD-PLAN.md`](docs/REBUILD-PLAN.md)，存檔硬規則在 [`docs/SAVE-COMPAT.md`](docs/SAVE-COMPAT.md)。三者高於 repo 內其他所有文件；舊的 `docs/STATUS-*`、`RELEASE-NOTES-*`、`audit/`、`evidence/`、`history/` 只是歷史紀錄，不是指令。

## 1. 身份與寫入目標

- 本 repo：`burnt-tea-dev/kaleidoscope-grilling-unofficial`，repository ID **1377218440**。任何遠端寫入前，讀 `.repo-target.json` 並核對已驗證的 full name **和**數字 ID。
- 不得寫入上游（`breezeth-CN/KaleidoscopeGrilling`）或任何名稱相似的 repo。寫其他 repo 需要擁有者明確指示。
- 私有整合（senluo-family-integration-private）的內容、作者 Cookery 完整包、世界檔、SSH 金鑰、密碼、BSM token **絕不進入公開 repo、PR、issue、log 或收據**。

## 2. 開工前

1. 讀本檔 → `docs/REBUILD-PLAN.md` §0 → 找到你要做的任務編號（T-x.y）與其前置條件。
2. `git status`、`git log -5`、確認分支與遠端；保留別人尚未提交的工作，不要覆蓋。
3. 一個任務一個分支一個 PR：`rebuild/T2-3-java-data` 之類；PR 標題以任務編號開頭。
4. 若任務的前置未完成，或需要計畫沒寫的決策：停下，在 PR／回覆中列出選項與建議，不要自行擴大範圍。

## 3. 硬規則（違反即拒絕合併）

1. **存檔相容**：item／block／block state 值／entity／persisted key／pack UUID 只增不減；移除只能走 `docs/SAVE-COMPAT.md` 退役流程。`python3 tools/guards/save_compat.py check` 必須通過。
2. **膨脹棘輪**：`python3 tools/guards/growth_ratchet.py check` 必須通過；計數下降後同 PR 執行 `tighten`。不得在 PR 中調高上限。
3. **禁止模式**（詳見計畫 §2.2）：不新增每版驗證器、`augment_a*`、`tools/gNNN_*`、`STATUS-*` 文件；不寫切原始碼文字的測試；不為選動畫／圖示新增或替換 item ID；不新增全域 `playerInteractWithBlock`／`runInterval`；不 commit 建置產物；不修改作者 Cookery 檔案；不擴充 `player.json`。
4. **P2 之前不改 runtime 行為**；P2 的 PR 必須證明 BP 位元組不變（計畫 §4 P2 共通驗收）。
5. **不刪護欄與計畫**：`tools/guards/*`、`AGENTS.md`、`docs/REBUILD-PLAN.md`、`docs/SAVE-COMPAT.md` 受 CI 保護。
6. **不改寫 Git 歷史、不 force push main、不刪 tag**。分支刪除需擁有者決策 D7。

## 4. luosen 正式世界

- luosen 有真實玩家資料。任何會改動它的動作，依序：停服完整備份（計畫 §5.3）→ staging 驗證（§5.4）→ 以家族既有工具部署（§5.5）→ 讀回確認 → 保留可 15 分鐘內完整回滾的上一版。
- 不在 luosen 試錯、不在 luosen 跑模擬玩家、不把 staging 世界複製回 luosen。
- 部署授權：擁有者 2026-10-03 的常設授權（完成 PR／檢查／合併並通過 static、BDS、存檔遷移後部署完整家族）**在擁有者回覆決策 D2 前仍然有效**；但重建 P1–P2 不產生 runtime 候選，因此不會觸發。P3 起依 D2 執行。
- 伺服器路徑、帳號、金鑰位置只寫在私有 repo 或伺服器上的受控檔案。

## 5. 工程方式

- 目標結構與規則見計畫 §3：按 Java 功能域分模組；`logic.js` 不 import `@minecraft/server`；方塊互動用 custom components；計時走唯一排程器；寫入走 `core/transaction.js`；persisted key 集中在 `core/persist_keys.js` 並逐字保留。
- 還原的依據是 Java 1.1.1 原碼與素材（`breezeth-CN/KaleidoscopeGrilling@9a1acdab`）及 `data/java/`。不憑印象、不以舊 Bedrock 實作當作正確答案。
- 測試測玩家可見行為（計畫 §9）。每個 bug 修正附一個修正前會失敗的測試。不加守恆／見證／收據類測試。
- 視覺：用 Bedrock 原生狀態機制（render controller 陣列、bone 可見度、entity/player property、block permutation）；單一 geometry ≤ 512 KB；平台做不到的寫進 `docs/KNOWN-ISSUES.md`。
- 先找檔案再讀局部範圍；不要反覆讀整份大文件或巨型 log。重複的診斷沒有新資訊時，換一個證據來源。

## 6. 回報用語（不可混用）

`來源已實作` → `CI 通過` → `staging 驗證` → `已部署 luosen` → `真人驗收`。

- BDS 載入成功、雜湊一致、測試數量都**不等於**玩法或畫面已還原。
- 本機或未推送的工作不是「已交付」；推送後讀回遠端才算。
- 回報包含：做了什麼、怎麼驗證、還剩什麼不確定。`client=false`、`production_ready=false` 維持到有實際真人結果。

## 7. 仍然有效的專案規範

- 指南：遵循 `docs/GUIDE-STANDARD.md`——在既有 Cookery 書內只有一個煙火入口與六個料理分類，不新增實體書物品，不替換宿主檔案。
- 授權：原作素材 CC BY-NC-SA 4.0；原碼及衍生工具的 BSD 聲明另列；出處見 `projects/grilling/ATTRIBUTION.md`。
- 版本：玩法或輸出資產變更才 bump 版本並同步 manifests／`baseline.json`；只改工具或文件不 bump、不部署。
