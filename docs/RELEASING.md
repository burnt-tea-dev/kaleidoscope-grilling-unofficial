# 安裝、驗證與發布

## 公開下載與來源開發主線

main 的自有 BP/RP 來源身份查 [baseline.json](../baseline.json)。本節記錄的已發布下載為 [A2.8.212](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases/tag/A2.8.212) **預發布**（2026-11-03 查核），與後續開發主線分開。不能僅以 main/Release 判斷存檔准入或 LIVE 已部署。當次已發布資產、雜湊須查對該 Release 實際項目；[Release 請求](../.github/release-request.json) 是提交/審查紀錄，不取代實際公開資產與其雜湊。

公開 **精確 T194／G212／W180** 組裝指引及 Cookery 1.6.4 / 1.6.20012 本機相容輸入見 [Core G212 現行配套](https://github.com/burnt-tea-dev/senluo-bedrock-core/blob/main/docs/FAMILY-ASSEMBLY.md#current-g212-installation)。作者 Cookery／Immersive Eating 必須自行從合法來源取得並按精確 descriptor 由使用者本機接入；本庫下載只含自有 Grilling BP/RP。這不是三個倉庫各自最新 main 的任意拼接；當次 G212 完整家族的保存、真人客戶端及 LIVE 驗收，未有相同精確身份的證據時一律維持**未知／未驗**，不得沿用 G206 紀錄。

### 2026-11-01 G206 家族歷史驗證（不作 G212 准入）

G206 當次曾通過 canonical CI、完整家族同存檔首載／重開六條流程、原玩家與世界資料保存、真正故障回退，以及其後正式部署 600 秒監看；公開三移植包及共用接入檔當次逐位元符合 G206 整合候選。此為**當時已固定的 G206 精確配對**，不可改標為 G212／T197／W183 的存檔或 LIVE 結果。當次真人雙手／第一人稱／音效、C04 及多人效能仍待驗，不能宣稱 S1 完成；可選 TACZ 的私服配套另有獨立相依與真人門檻。

## 2026-10-18 至 2026-10-27 重建歷史

以下保留 G157／G181／G182 當時的規則與未完成狀態，不是現行發布指令。

### 當時 P2 的規則

P2 只整理來源與工具，不產生新 runtime 候選。`publication_request=false` 維持；CI 通過、bridge 匯出成功或 main 合併都不是發布授權。玩法／輸出改變才依計畫 bump 並同步 manifests／baseline；文件與工具沒有改輸出時不 bump、不部署。

維護來源的版本、UUID、Cookery 相依、最低 engine 與 Script API 以 [baseline.json](../baseline.json) 及兩份 manifest 為唯一來源；這是來源宣告，實際安裝查完整家族收據，真人結果另驗。canonical BP/RP 位置也從 baseline.runtime 查詢。以下 G157／G181／G182 段落是各候選原始邊界，不能作為今天的來源或部署狀態。

G157 承接 2026-10-26 已凍結的 Cookery 1.6.4 相容維護；2026-10-27 發布相同自有 runtime，未合併 G156／PR #255 的資產清理。本次發布不宣告 P3 或真人驗收完成。

### G182 資產／食材／朝向整合候選

G182 從 main 的 G181 延伸，吸收 PR #257 的四向烤架顯示修正、PR #256 的八食材秘製串外觀及 PR #255 的未引用 RP 資產清理；三個舊 PR 及其歷史身份保持獨立，不以本候選改寫。BP/RP UUID、Cookery 1.6.4、Script API 相依、item／block／entity ID、block states 與 persisted keys 不變。

目前只有來源實作、可重現資產生成、API／resource expression 測試與靜態護欄結果。本候選尚未完成完整家族、同世界重啟、所有既有可見表面的刪除前後對照、八食材實際手持／放置、四向烤架、聲音或真人驗收；維持 draft／未發布，`.github/release-request.json` 仍保留 G157 的歷史身份與 `publication_request=false`。

### G181 核心流程修復候選

依擁有者本輪核心流程修復指示，G181 從 G157 `2e3ef63839e38f84b4a0109957077ac00a140697` 的 runtime 延伸，承接 main 的 G157 發布文件。G158–178 與 PR #255 的 G180 已有保留身份，因此使用新的 paired BP/RP 2.8.181；不覆寫任何舊 history，也不合入 #255 的資產刪除。BP/RP UUID、Cookery 1.6.4 及 Script API 相依不變。

來源修復與 API fixture 測試不等於可部署候選。G181 維持 draft／未發布，`.github/release-request.json` 仍保留 G157 的歷史身份與 `publication_request=false`；不得以 G157 的首啟／重啟結果替代 G181。#255 日後吸收本修復時也必須分配另一個未占用版本，不能改寫 G180。

同一份 G181 完整家族候選仍須依序驗證：一／二／三料正常取得與穿串、立即拆串、點火與三槽入爐、刷油扣三份、四次翻面、撒料扣三份、取出與主副手食用；涵蓋 23／24／25 tick 取消、重複完成、換槽／換手、最後一份與油壺／調料容器、正常停服重啟及保存抽查。Java 對照、音效、第一／第三人稱及 Creative 畫面另保留實際客戶端證據。完成前 `client=false`、`production_ready=false`。

## 2026-10-27 G157 發布與安裝邊界

[A2.8.157 公開下載](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases/tag/A2.8.157) 於 2026-10-27 發布；只包含自有 Grilling BP/RP，不含作者 Cookery 包或私人整合。

| 項目 | 已發布內容 |
| --- | --- |
| 檔案 | `Kaleidoscope_Grilling_A2.8.157_baseline1.mcaddon` |
| SHA256 | `f5da55c63558dd2552616c3774545eb60248b065b335f01e8c678ea450936216` |
| 大小與範圍 | 15,429,509 bytes；791 BP 檔案與 3762 RP 檔案 |
| 凍結內容來源 | `2e3ef63839e38f84b4a0109957077ac00a140697` |

這份自有 runtime 已在 Tavern 0.6.185／Grilling 2.8.157／World Liquor 0.1.164 的完整 47 包家族中，通過 2026-10-27 的 static、原生首啟／重啟、安裝及正常運行讀回。這是該次精確配套的結果，不是一般單包安裝或完整 Java 還原證明。實際玩法、畫面與真人仍待驗收，`client=false`、`production_ready=false` 保持。

啟用兩份 Grilling pack 與精確且已套用相容整合的 Cookery 1.6.4 BP/RP。普通 mcaddon 匯入不執行 `host-extensions/board-api.json` 的來源組裝；宣告相依不等於砧板／油壺／料理／指南能力皆可用。完整家族組裝是另一個流程，必須遵守其完整原版輸入與來源 lock。作者包從其官方渠道取得；本下載不提供完整家族的一鍵組裝。

## 歷史保留下載與其相依

以下兩項是 2026-10-18 保留的下載身份；本次 G157 發布不替換、重新標記或修改這些資產。

| 公開包 | 檔案與 SHA256 | 原內容 commit |
| --- | --- | --- |
| [A2.8.149 stable](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases/tag/A2.8.149) | `Kaleidoscope_Grilling_A2.8.149_baseline1.mcaddon`；`9a75e2d516e3f2c222af094537bc0b0410d4132eb591231fdf5d27af39ca3bd1` | `aa7431f9ea729338f75f134a9c9be8194298b968` |
| [A2.8.138-beta.1 TEST](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases/tag/A2.8.138-beta.1) | `Kaleidoscope_Grilling_A2.8.138_Review.mcaddon`；`bd2d3abe0190027a0ba47de95eaef9dd88657647b0c586431863fceb5c4a5a71` | `d0fb23b98e3cad60340ba202effd44a05baad707` |

TEST 比上述 stable 更舊，不是降版建議。兩者都要求作者 [Cookery **1.6.0／file 9054164**](https://www.curseforge.com/minecraft-bedrock/addons/kaleidoscope-cookery-unofficial/files/9054164) 的 BP/RP，原 archive SHA256 為 `da12fe6d39d7514aff1de3c963d69899324d771be5ca0fc3da1ccb759c7ad458`；BP UUID `5df753c9-3436-4fba-87f1-a2da3651cfcf`、RP UUID `f1d333ca-2d6b-4566-8005-e6c309816324`，版本均為 `[1,6,0]`。Cookery 1.6.1／1.6.2 不是這兩個公開下載的替代相依。

公開 G138／G149 的程式在 API 故障模型中曾重現物品遺失、覆寫及重複產物；[KNOWN-ISSUES](KNOWN-ISSUES.md#公開下載的物品安全限制)保留四種結果與限制。後續 G155 修補尚未成為上述下載 bytes。測試前保留備份；`client=false`、`production_ready=false`。

[原下載稽核](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/PUBLIC-DOWNLOAD-INSTALLATION-20261018.md)保留 G138 發布文字混用 G132 證據、T163／G137 與 G138 不匹配、T170／G149／W148 lock 及各作者輸入身份。歷史文字或 receipt 不重新標成另一個候選。

## 現行驗證與世界作業

開發任務使用 [pstack 代理入口](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5bc82d3d60e1837306eeb3f0ae4da64c7df4b392/family/UPDATE-WORKFLOW.md#pstack-代理入口)，並遵守 [AGENTS.md](../AGENTS.md) 與現行重建計畫。普通 PR 由 [ci.yml](../.github/workflows/ci.yml) 檢查可載入 JSON、核心玩法及現行 UI／指南／戰利品；本機只重現受影響範圍，命令見 [tests/README.md](../tests/README.md)。完整歷史回歸與 growth ratchet 留在手動發布檢查，不是普通 PR 或文件修改的常設門檻。

輸出 runtime 未變的工具／文件工作不凍結新遊戲版本、不組裝候選或部署。真正發布仍保留配對身份、授權聲明、完整來源及 `baseline_gate.py check --release`；P2 純結構整理沿現行計畫證明相應 runtime 範圍不變。

世界作業只在任務已授權的環境，依[家族更新流程](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5bc82d3d60e1837306eeb3f0ae4da64c7df4b392/family/UPDATE-WORKFLOW.md#pstack-代理入口)及 [REBUILD-PLAN §5](REBUILD-PLAN.md#5-伺服器與-luosen-存檔作業手冊) 執行。保留最新一份完整一致回退，使用同一停服存檔副本驗證首次載入與重啟，再由既有工具安裝及讀回。真人驗收不作完成門檻；尚未觀察的聲畫如實標示。staging 世界不得複製回正式世界，主機路徑、憑證與玩家資料保持私有。

[先前的 P2／staging 操作文字](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/e43c0a4752ccd68057c91b6b5b46ec524b17a3a2/docs/RELEASING.md#p2-的必要驗證)保留在歷史提交；下方 dated 驗收記錄保留原樣，不增加今天的門檻。

## T1.8／T2.8 驗收補充（2026-10-24）

本補充只記擁有者豁免與有界驗收進度；[原重建計畫](REBUILD-PLAN.md)與本指南的歷史內容及其他驗收條件不變。不是 T2.8／P2 完成、發布或部署宣告。

### T1.8 擁有者豁免

2026-10-24 00:26 UTC，擁有者豁免 T1.8「真人進服」：狀態為 **OWNER WAIVED，不是 PASS**。此單項不再阻擋 P3；不推定伺服器 RP 下載或真人互動成功，不豁免同世界 BDS 正常停服／重啟後的測試資料抽查、完整相關家族組合相容或其他未豁免出口，也不新增維護或私有包修改授權。

### T2.8 已有證據與界限

範圍：[PR #255](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/255)，G155 2.8.155 → G156 2.8.156 的刪除無退步驗證，不是全 Java 視覺重建。

- 已完成：人工抽查 10 項及被刪 geometry／texture 的有限引用核對；Creative 90 個可見圖格、固定 20＋隨機 18 常規主手、真正 Dark／Secret、五個未完成／普通／神秘串樣本、材料 26 與 OTHER 12 的指定可見表面配對。90 圖格不等於 163 個 hidden 變體逐項覆蓋。
- 新 24 項副手已有 48 張 BEFORE＋48 張 AFTER 手持畫面，最終 route 相符；其中 7 項經普通重新選取，不證明初始隨機分配相同。舊 7 項副手是不同 cohort，不能相加宣稱 31 項精確配對。
- 新 9 組放置配對（盤 1–4、待搖瓶、Special 瓶、三種油）已完成；既有五串盤及靜態器具／作物／樹樣本另有有界證據。
- 裁切、遮擋、角色／姿態差異與原有外觀問題仍限制判讀；未見新增粗退步不等於動畫、精細握點、聲音或 Java 一致性通過。
- Special 瓶正常空手取回在 G155 與 G156 均失敗，保留為原因未定的基線問題；不冒稱成功、不判成 G156 獨有回歸，也不自動新增為 P3 前必修條件。

### 仍須閉合的原要求

- **T2.8 全部物品三表面的刪除無退步驗收**：尚待補齊既有 cohort 的最終逐 ID／表面對應。部分早期索引存取不足是證據定位缺口，不代表未測或整批需要重做；先整理既有證據，只對確定沒有有效配對的正常可達表面列具體缺項。
- **完整相關家族組合相容**：核心四包不能替代。21-pack 家族候選確曾載入 gallery，但仍有相依版本警告，不能記為乾淨相容。
- **同世界 BDS 正常重啟後的測試資料抽查**：尚未完成，單機保存重進不能替代。依原計畫 §5.4／§9.5 執行，未獲授權的操作仍須先取得授權。
- **P2 出口與 #255 整合收尾**：#255 仍為 draft；最終驗收、最新 main 整合、必要 CI／guards、配套版本例外核對及原計畫的 P2 數值出口仍須完成。本補充不改 #255 head 或候選 pack 位元組。

### P3 階段邊界

P3 仍須等待 P1／P2 所有未豁免出口完成。進食系統重寫屬原計畫 T3.4，逐表面 Java 視覺重建屬 P4。另行要求的 Java 動畫重建（2.8.161 起的並行候選）保留獨立追蹤，不取消其要求、不混入 #255 的 G155／G156 證據，也不新增為原計畫的 P3 前置條件。

## Runtime 候選的部署與回滾

P3 起的部署節奏依 D2；現有授權的範圍由 [AGENTS §4](../AGENTS.md#4-luosen-正式世界) 定義，本文件不增刪授權。候選通過適用 CI、存檔與 staging 驗收後，才按計畫處理 tag／release 及完整家族部署。

使用家族既有 `family_bundle`／`family_guard`／BSM 准入工具安裝整組，不手動覆蓋一份包。部署前再次完整停服備份，部署後讀回實際 pack 順序／UUID／版本／雜湊、content log 與核心流程，將有限結果記在家族單一部署紀錄。公開部分先去除任何機密與玩家資料。

保留可在 15 分鐘內恢復的上一份完整備份與 pack 組合；回滾順序為正常停服→還原備份與上一組 packs→開服→讀回。目前依受管家族流程保留最新一份完整可用回退；原 LKG 與歷史證據仍保留其原始範圍，不把它們當成需要每輪新增的備份。

item／block／entity／state／key／UUID 的退役另走 [SAVE-COMPAT](SAVE-COMPAT.md) 全部條件，不因有備份或具部署權限而免除遷移證據。作者完整包、私有整合遊戲邏輯、世界資料與憑證均不進公開 repo。
