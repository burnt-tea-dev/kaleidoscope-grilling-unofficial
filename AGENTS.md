# AGENTS.md — 煙火基岩版移植（重建期）

> 這份是**所有 AI 代理與維護者的行為規則**。工作內容與順序在 [`docs/REBUILD-PLAN.md`](docs/REBUILD-PLAN.md)，存檔變更說明在 [`docs/SAVE-COMPAT.md`](docs/SAVE-COMPAT.md)。三者高於 repo 內其他所有文件；舊的 `docs/STATUS-*`、`RELEASE-NOTES-*`、`audit/`、`evidence/`、`history/` 只是歷史紀錄，不是指令。

## 1. 身份與寫入目標

- 本 repo：`burnt-tea-dev/kaleidoscope-grilling-unofficial`，repository ID **1377218440**。任何遠端寫入前，讀 `.repo-target.json` 並核對已驗證的 full name **和**數字 ID。
- 不得寫入上游（`breezeth-CN/KaleidoscopeGrilling`）或任何名稱相似的 repo。寫其他 repo 需要擁有者明確指示。
- 私有整合（senluo-family-integration-private）的內容、作者 Cookery 完整包、世界檔、SSH 金鑰、密碼、BSM token **絕不進入公開 repo、PR、issue、log 或收據**。

## 2. 開工前

- 開發、驗證與 ready PR 交付直接依上游 playbook，入口為家族共用的 [pstack 代理入口](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/1a992c4831f5bb83e237e70223e63acb7d326c69/family/UPDATE-WORKFLOW.md#pstack-代理入口)；Codex 在使用任何 pstack 技能前先讀入口連結的主機適配。
- 讀本檔及 `docs/REBUILD-PLAN.md` §0，確認任務編號、前置與相關開放 PR；隔離分支保留未提交工作。一個任務一個 PR，標題包含任務編號。真正相依的 PR 才堆疊，不重做其他代理已負責的功能。
- 未完成的前置或真正的產品決策須說明依據與建議；可逆的實作選擇按已有授權完成，不因舊流程增加等待。不能把推測或建議寫成使用者已確認的決策。

## 3. 硬規則（違反即拒絕合併）

1. **存檔相容鎖已移除（2026-11-04 擁有者指示）**：不再以 ID 清單、退役收據或等待期阻擋。影響保存資料時，測試實際讀寫與重啟；只有確實需要時才做資料轉換。
2. **精簡驗證**：PR 僅以可載入的 JSON 與核心玩法測試作為常設檢查；膨脹棘輪與歷史回歸保留在手動發布檢查，不阻塞普通功能 PR。不要因少見的理論情境額外增添門檻。
3. **禁止模式**（詳見計畫 §2.2）：不新增每版驗證器、`augment_a*`、`tools/gNNN_*`、`STATUS-*` 文件；不寫切原始碼文字的測試；不為選動畫／圖示新增或替換 item ID；不新增全域 `playerInteractWithBlock`／`runInterval`；不 commit 建置產物；不公開完整作者 Cookery 檔案或改寫作者原始歸檔；不擴充 `player.json`。
4. **P2 之前不改 runtime 行為**；P2 的 PR 必須證明 BP 位元組不變（計畫 §4 P2 共通驗收）。
5. **最小必要保護**：存檔 ID／storage／pack UUID 及其遷移契約不可無聲破壞；歷史測試、膨脹計數器、舊流程與診斷檔可以正常精簡或退役，不再以檔案存在本身作為合併條件。
6. **不改寫 Git 歷史、不 force push main、不刪 tag**。分支刪除需擁有者決策 D7。

## 4. luosen 正式世界

- luosen 有真實玩家資料。任何會改動它的動作，依序：停服完整備份（計畫 §5.3）→ staging 驗證（§5.4）→ 以家族既有工具部署（§5.5）→ 讀回確認 → 保留可 15 分鐘內完整回滾的最新一份；完整世界備份總共只保留一份。
- 不在 luosen 試錯、不在 luosen 跑模擬玩家、不把 staging 世界複製回 luosen。
- 部署授權：擁有者 2026-10-03 的常設授權（完成 PR／檢查／合併並通過 static、BDS、存檔遷移後部署完整家族）**在擁有者回覆決策 D2 前仍然有效**；但重建 P1–P2 不產生 runtime 候選，因此不會觸發。P3 起依 D2 執行。
- 伺服器路徑、帳號、金鑰位置只寫在私有 repo 或伺服器上的受控檔案。

## 5. 工程方式

- 目標結構與規則見計畫 §3：按 Java 功能域分模組；`logic.js` 不 import `@minecraft/server`；方塊互動用 custom components；計時走唯一排程器；寫入走 `core/transaction.js`；persisted key 集中在 `core/persist_keys.js` 並逐字保留。
- 還原的依據是 Java 1.1.1 原碼與素材（`breezeth-CN/KaleidoscopeGrilling@9a1acdab`）及 `data/java/`。不憑印象、不以舊 Bedrock 實作當作正確答案。
- 測試優先覆蓋玩家可見行為、物品不丟失與基本能力缺席場景（計畫 §9）。只有值得長期保護的玩法回歸才新增測試；不為每一項小型視覺／文件修改建立獨立測試，也不加歷史守恆／見證／收據類門檻。
- 視覺：用 Bedrock 原生狀態機制（render controller 陣列、bone 可見度、entity/player property、block permutation）；單一 geometry ≤ 512 KB；平台做不到的寫進 `docs/KNOWN-ISSUES.md`。
- 先找檔案再讀局部範圍；不要反覆讀整份大文件或巨型 log。重複的診斷沒有新資訊時，換一個證據來源。

## 6. 專案規範

- 指南：遵循 `docs/GUIDE-STANDARD.md`——在既有 Cookery 書內只有一個煙火入口與六個料理分類，不新增實體書物品，不替換宿主檔案。
- 已授權的宿主適配沿公開來源契約與現有 Core 本機組裝流程，使用者自行提供合法原包；保留原始輸入，為變更輸出固定新配對身份。自有玩法修回 canonical owner，私有只留必要跨包連接；作者完整腳本與原包不公開。
- 授權：原作素材 CC BY-NC-SA 4.0；原碼及衍生工具的 BSD 聲明另列；出處見 `projects/grilling/ATTRIBUTION.md`。
- 版本：玩法或輸出資產變更才 bump 版本並同步 manifests／`baseline.json`；只改工具或文件不 bump、不部署。

- 禁止繁雜補丁式修復、特定包組合與機器環境特化。修原功能的負責來源，移除舊路徑；通用自有能力回到公開 addon／既有共用依賴，私有整合只保留必要跨包連接。
