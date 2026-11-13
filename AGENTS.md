# AGENTS.md — 煙火基岩版移植（重建期）

> 這份是**所有 AI 代理與維護者的行為規則**。工作內容與順序在 [`docs/REBUILD-PLAN.md`](docs/REBUILD-PLAN.md)，存檔變更說明在 [`docs/SAVE-COMPAT.md`](docs/SAVE-COMPAT.md)。三者高於 repo 內其他所有文件；舊的 `docs/STATUS-*`、`RELEASE-NOTES-*`、`audit/`、`evidence/`、`history/` 只是歷史紀錄，不是指令。

## 1. 身份與寫入目標

- 本 repo：`burnt-tea-dev/kaleidoscope-grilling-unofficial`，repository ID **1377218440**。任何遠端寫入前，讀 `.repo-target.json` 並核對已驗證的 full name **和**數字 ID。
- 不得寫入上游（`breezeth-CN/KaleidoscopeGrilling`）或任何名稱相似的 repo。寫其他 repo 需要擁有者明確指示。
- 私有整合（senluo-family-integration-private）的內容、作者 Cookery 完整包、世界檔、SSH 金鑰、密碼、BSM token **絕不進入公開 repo、PR、issue、log 或收據**。

## 2. 開工前

1. 讀本檔及目前擁有者任務，按 `/root/senluo-baseline-20260930/CURRENT-WORK.md` 找唯一現行佇列；`docs/REBUILD-PLAN.md` 的舊階段只按其歷史範圍使用。
2. `git status`、`git log -5`、確認分支與遠端；保留別人尚未提交的工作，不要覆蓋。
3. 一個任務一個分支一個 PR：`rebuild/T2-3-java-data` 之類；PR 標題以任務編號開頭。多個有依賴關係的連鎖 PR 使用 `gh stack` 管理，並在各 PR 說明依賴關係；仍維持一個任務一個 PR。
4. 遇到真正缺少的前置或未獲授權的新決策時，說清楚具體缺口並繼續獨立工作；不以舊階段條件重新索取已有授權。不要自行擴大範圍；使用者指示有明顯錯誤或決策衝突時，直接指出問題與依據，不把推測寫成已確認事實。

## 3. 硬規則（違反即拒絕合併）

1. **存檔相容鎖已移除（2026-11-04 擁有者指示）**：不再以 ID 清單、退役收據或等待期阻擋。保留完整玩家資料；只有確實需要時才做資料轉換。保存檢查也受下列當前測試授權限制。
2. **目前測試授權**：以擁有者最新指令為準。2026-11-13 重建期，來源代理和協調者不新增、不執行測試，也不透過 push／PR 觸發 CI；只有少量且必要的客戶端操作可由協調者交現有 bot。原碼、配置、既有日誌、直接審閱與正常生成可繼續，不能把等待 bot 當獨立來源工作的前置。既有測試入口保留不等於獲准執行。
3. **禁止模式**（詳見計畫 §2.2）：不新增每版驗證器、`augment_a*`、`tools/gNNN_*`、`STATUS-*` 文件；不寫切原始碼文字的測試；不為選動畫／圖示新增或替換 item ID；不新增全域 `playerInteractWithBlock`／`runInterval`；不 commit 建置產物；不公開完整作者 Cookery 檔案或改寫作者原始歸檔；不擴充 `player.json`。
4. **舊重建階段只屬歷史**；本輪按擁有者已授權的完整玩家功能修復，不能以早期 P2 的位元組不變要求阻止 gameplay 修正。
5. **最小必要保護**：存檔 ID／storage／pack UUID 及其遷移契約不可無聲破壞；歷史測試、膨脹計數器、舊流程與診斷檔可以正常精簡或退役，不再以檔案存在本身作為合併條件。
6. **不改寫 Git 歷史、不 force push main、不刪 tag**。分支刪除需擁有者決策 D7。

## 4. luosen 正式世界

- luosen 有真實玩家資料。任何會改動它的動作，依序：停服完整備份（計畫 §5.3）→ staging 驗證（§5.4）→ 以家族既有工具部署（§5.5）→ 讀回確認 → 保留可 15 分鐘內完整回滾的最新一份；每個持續使用的世界各留一份完整恢復點，不得以一服的新備份刪另一服的備份。
- 不在 luosen 試錯、不在 luosen 跑模擬玩家、不把 staging 世界複製回 luosen。
- 部署授權以 `/root/AGENTS.md` 及本輪擁有者指令為準；共同安裝由唯一部署負責人持有。測試服可裝已審閱、正常生成的局部修復候選；正式服只收符合既有保護與發行要求的穩定版本。不得用舊 P1–P3／D2 文字覆蓋新授權或繞過 §3 禁測限制。
- 伺服器路徑、帳號、金鑰位置只寫在私有 repo 或伺服器上的受控檔案。

## 5. 工程方式

- 目標結構與規則見計畫 §3：按 Java 功能域分模組；`logic.js` 不 import `@minecraft/server`；方塊互動用 custom components；計時走唯一排程器；寫入走 `core/transaction.js`；persisted key 集中在 `core/persist_keys.js` 並逐字保留。
- 還原的依據是 Java 1.1.1 原碼與素材（`breezeth-CN/KaleidoscopeGrilling@9a1acdab`）及 `data/java/`。不憑印象、不以舊 Bedrock 實作當作正確答案。
- 檢查與 bot 操作遵守 §3 的當前授權。每次只回答會改變下一步修復的具體玩家問題，重用有效結果，不新增歷史守恆／見證／收據類門檻。
- 視覺：用 Bedrock 原生狀態機制（render controller 陣列、bone 可見度、entity/player property、block permutation）；單一 geometry ≤ 512 KB；平台做不到的寫進 `docs/KNOWN-ISSUES.md`。
- 先找檔案再讀局部範圍；不要反覆讀整份大文件或巨型 log。重複的診斷沒有新資訊時，換一個證據來源。

## 6. 回報用語（不可混用）

`來源已實作` → `CI 通過` → `staging 驗證` → `已部署 luosen`。

- BDS 載入成功、雜湊一致、測試數量都**不等於**玩法或畫面已還原。
- 本機或未推送的工作不是「已交付」；推送後讀回遠端才算。
- 回報包含：做了什麼、怎麼驗證、還剩什麼不確定。遵守 §3 的當前測試授權；少量 bot 結果只證明實際觀察範圍，不反覆等待或要求 dot。未觀察的聲畫不冒稱完成。

## 7. 仍然有效的專案規範

- 指南：遵循 `docs/GUIDE-STANDARD.md`——在既有 Cookery 書內只有一個煙火入口與六個料理分類，不新增實體書物品，不替換宿主檔案。
- 已授權的宿主適配沿公開來源契約與現有 Core 本機組裝流程，使用者自行提供合法原包；保留原始輸入，為變更輸出固定新配對身份。自有玩法修回 canonical owner，私有只留必要跨包連接；作者完整腳本與原包不公開。
- 授權：原作素材 CC BY-NC-SA 4.0；原碼及衍生工具的 BSD 聲明另列；出處見 `projects/grilling/ATTRIBUTION.md`。
- 版本：玩法或輸出資產變更才 bump 版本並同步 manifests／`baseline.json`；只改工具或文件不 bump、不部署。

- 禁止繁雜補丁式修復、特定包組合與機器環境特化。修原功能的負責來源，移除舊路徑；通用自有能力回到公開 addon／既有共用依賴，私有整合只保留必要跨包連接。
