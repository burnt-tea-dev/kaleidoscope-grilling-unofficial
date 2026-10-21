# 安裝、驗證與發布

## 重建期間的規則

P2 只整理來源與工具，不產生新 runtime 候選。`publication_request=false` 維持；CI 通過、bridge 匯出成功或 main 合併都不是發布授權。玩法／輸出改變才依計畫 bump 並同步 manifests／baseline；文件與工具沒有改輸出時不 bump、不部署。

維護來源以 [baseline.json](../baseline.json) 為準：**2.8.157、Cookery 1.6.2**，最低 engine 宣告 1.26.50，`@minecraft/server` 2.9.0、`@minecraft/server-ui` 2.2.0。canonical BP/RP 在 `projects/grilling/gameplay_core/`。這是來源與 manifest 宣告，不是普通安裝、玩法或 client 成功證明。

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

## Runtime 候選的部署與回滾

P3 起的部署節奏依 D2；現有授權的範圍由 [AGENTS §4](../AGENTS.md#4-luosen-正式世界) 定義，本文件不增刪授權。候選通過適用 CI、存檔與 staging 驗收後，才按計畫處理 tag／release 及完整家族部署。

使用家族既有 `family_bundle`／`family_guard`／BSM 准入工具安裝整組，不手動覆蓋一份包。部署前再次完整停服備份，部署後讀回實際 pack 順序／UUID／版本／雜湊、content log 與核心流程，將有限結果記在家族單一部署紀錄。公開部分先去除任何機密與玩家資料。

保留可在 15 分鐘內恢復的上一份完整備份與 pack 組合；回滾順序為正常停服→還原備份與上一組 packs→開服→讀回。最近三份備份與 LKG-0 的保留規則依計畫，不以本次整理刪除。

item／block／entity／state／key／UUID 的退役另走 [SAVE-COMPAT](SAVE-COMPAT.md) 全部條件，不因有備份或具部署權限而免除遷移證據。作者完整包、私有整合遊戲邏輯、世界資料與憑證均不進公開 repo。
