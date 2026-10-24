# 安裝、驗證與發布

## 重建期間的規則

P2 整理來源與工具；T2.8 依計畫例外清理未引用 RP 資產並同步配套版本，候選須完成完整 staging 驗收。`publication_request=false` 維持；CI 通過、bridge 匯出成功或 main 合併都不是發布授權。玩法／輸出改變才依計畫 bump 並同步 manifests／baseline；文件與工具沒有改輸出時不 bump、不部署。

維護來源以 [baseline.json](../baseline.json) 為準：**2.8.156、Cookery 1.6.2**，最低 engine 宣告 1.26.50，`@minecraft/server` 2.9.0、`@minecraft/server-ui` 2.2.0。canonical BP/RP 在 `projects/grilling/gameplay_core/`。這是來源與 manifest 宣告，不是普通安裝、玩法或 client 成功證明。

## 保留公開下載與相依

以下是 2026-10-18 已記錄的實際下載身份；T2.6 沒有發布、替換或重新標記任何資產。

| 公開包 | 檔案與 SHA256 | 原內容 commit |
| --- | --- | --- |
| [A2.8.149 stable](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases/tag/A2.8.149) | `Kaleidoscope_Grilling_A2.8.149_baseline1.mcaddon`；`9a75e2d516e3f2c222af094537bc0b0410d4132eb591231fdf5d27af39ca3bd1` | `aa7431f9ea729338f75f134a9c9be8194298b968` |
| [A2.8.138-beta.1 TEST](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases/tag/A2.8.138-beta.1) | `Kaleidoscope_Grilling_A2.8.138_Review.mcaddon`；`bd2d3abe0190027a0ba47de95eaef9dd88657647b0c586431863fceb5c4a5a71` | `d0fb23b98e3cad60340ba202effd44a05baad707` |

TEST 比上述 stable 更舊，不是降版建議。兩者都要求作者 [Cookery **1.6.0／file 9054164**](https://www.curseforge.com/minecraft-bedrock/addons/kaleidoscope-cookery-unofficial/files/9054164) 的 BP/RP，原 archive SHA256 為 `da12fe6d39d7514aff1de3c963d69899324d771be5ca0fc3da1ccb759c7ad458`；BP UUID `5df753c9-3436-4fba-87f1-a2da3651cfcf`、RP UUID `f1d333ca-2d6b-4566-8005-e6c309816324`，版本均為 `[1,6,0]`。Cookery 1.6.1／1.6.2 不是這兩個公開下載的替代相依。

啟用兩份 Grilling pack 與精確相依。普通 mcaddon 匯入不執行 `host-extensions/board-api.json` 的來源組裝；宣告相依不等於砧板／油壺／料理／指南能力皆可用。公開家族組裝是另一個流程，必須遵守其完整原版輸入與來源 lock，不把舊示例說成今日一鍵安裝器。

公開 G138／G149 的程式在 API 故障模型中曾重現物品遺失、覆寫及重複產物；[KNOWN-ISSUES](KNOWN-ISSUES.md#公開下載的物品安全限制)保留四種結果與限制。後續 G155 修補尚未成為上述下載 bytes。測試前保留備份；`client=false`、`production_ready=false`。

[原下載稽核](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/PUBLIC-DOWNLOAD-INSTALLATION-20261018.md)保留 G138 發布文字混用 G132 證據、T163／G137 與 G138 不匹配、T170／G149／W148 lock 及各作者輸入身份。歷史文字或 receipt 不重新標成另一個候選。

## P2 的必要驗證

以 PR 實際 head 為準，執行 [ci.yml](../.github/workflows/ci.yml) 與其必要 workflows。最少保留：

```sh
python3 tools/baseline_gate.py check
python3 tools/guards/save_compat.py check
python3 tools/guards/growth_ratchet.py check
```

計數下降時按計畫在同 PR `tighten`，但不得調高上限或刪 lock 項掩飾差異。PR 附相對 base 的 canonical BP/RP diff，P2 必須為空（T2.8 僅有明示 RP 例外）。測試分流後只引用實際仍存在且被執行的檢查；不恢復舊版本驗證器。

文件／工具的有效驗證可以沿用同一來源的成功結果；只有具體新風險才重跑相關檢查。source、CI、staging、部署及真人結果分開報告，不以測試數或包雜湊推論玩法正確。

## 世界作業與 staging

任何正式世界變更前，依 [REBUILD-PLAN §5](REBUILD-PLAN.md#5-伺服器與-luosen-存檔作業手冊) 執行。真實主機、port、路徑、帳號與憑證由私有受控設定提供，不填入公開文件或 receipts。

1. 正常停止伺服器，確認世界 DB 不再占用；完整備份 world、相依 packs 與必要設定，記錄 SHA256／大小。備份放在服務資料卷以外，另保留伺服器以外的副本；驗證可還原。
2. 若需 ID 普查，只對停止備份的還原副本操作，遵循 [ops README](../tools/ops/README.md)。目前工具建立獨立暫存 DB，沒有改寫模式；`complete=false` 或非零 exit 不能當作舊 ID 已不存在的證據。
3. staging 使用相同 BDS／完整 pack 組合及 LKG 副本，隔離 port／allowlist；先確認資源足夠。按計畫走開服→真人進入→核心流程→正常停服→重啟→保存抽查。零玩家載入不代替這些步驟。
4. 按 [§9.5](REBUILD-PLAN.md#95-staging-人工檢查清單每次部署前) 留下同候選場景與截圖：取得、穿串、烤架、食用、餐盤、調料、油／鍋具、料理架、效果、重啟及其他家族包共存。staging 世界永遠不複製回正式世界。

公開 [T1.4 盤點](../tools/ops/receipts/luosen-inventory-20261019.json)、[LKG 備份](../tools/ops/receipts/luosen-lkg0-backup-20261019.json)及 [ID 普查](../tools/ops/receipts/luosen-id-census-20261019.json)各有自己的時間、輸入與限制。工具後來被修正，舊世界結果不自動成為新版工具的重跑結果；備份或部署包身份也不證明 staging 真人流程完成。

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

保留可在 15 分鐘內恢復的上一份完整備份與 pack 組合；回滾順序為正常停服→還原備份與上一組 packs→開服→讀回。最近三份備份與 LKG-0 的保留規則依計畫，不以本次整理刪除。

item／block／entity／state／key／UUID 的退役另走 [SAVE-COMPAT](SAVE-COMPAT.md) 全部條件，不因有備份或具部署權限而免除遷移證據。作者完整包、私有整合遊戲邏輯、世界資料與憑證均不進公開 repo。
