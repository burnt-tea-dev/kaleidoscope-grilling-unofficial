> **重建進行中（2026-10-18 起）：** 本 repo 依 [docs/REBUILD-PLAN.md](docs/REBUILD-PLAN.md) 重建。P3 前只接受 P0 等級存檔安全修補；所有變更受 [存檔相容規則](docs/SAVE-COMPAT.md) 與 `tools/guards/` 護欄約束。代理請先讀 [AGENTS.md](AGENTS.md)。

> **Published-download notice (2026-10-18):** Actual G138 TEST/G149 stable fault-injection replay found item-loss, overwrite and duplication paths. These are API-model findings, not native frequency claims. Exact Cookery dependencies, historical release-text corrections and the public assembler's TEST/stable source-lock boundaries are in [published installation and safety guidance](docs/PUBLIC-DOWNLOAD-INSTALLATION-20261018.md). Existing download bytes are unchanged.

## Current maintained source: 2.8.155

**G155 source candidate, pending canonical checks, complete-family gates and client acceptance.** It combines the Cookery 1.6.2 public API 0.2.13 oil and millstone adapters with plate and recipe transaction repairs that preserve captured ownership and block unsafe refunds or retries. It retains the complete G151/G152/G153 skewer, input, rack, crop, pepper and oil brush repairs. Guide 0.3.66 keeps both guide corrections and the Cookery 1.6.2 host reference. [Composition scope](docs/RELEASE-NOTES-A2.8.155.md).

**The retained G152 baseline uses Cookery 1.6.1 / family API 0.2.12.** It preserves the G151 skewer repairs and synchronizes the three-language chopping-board guide with the actual current outputs. It repairs current chopping-board ingredient production, short-recipe progress, native-mode secret-skewer contents and eating-data ownership, and appends four missing Cookery foods to the display catalog. The [G151 repair review](docs/evidence/skewer-repair-20261017.md) records the actual source defects, verification and remaining client scope. It retains the earlier author identity/state adaptation and Java grill/rack collision repairs.

**Public download:** [A2.8.149](https://github.com/casama233/kaleidoscope-grilling-unofficial/releases/tag/A2.8.149), which uses **Cookery 1.6.0**. G155's [release request](.github/release-request.json) remains `publication_request=false`; a source merge is not a new public package. The G149 stable publication retains the owner's existing source/editor/CI/package decision and its [bounded evidence and deferred risks](docs/RELEASE-NOTES-A2.8.149.md).

**Last LIVE batch recorded in the repository:** T169/G144/W147/private42, deployed **2026-10-15 22:40:27 HKT** and reported checked at the start of the following source batch. This repair session has no new LIVE readback. The [single family status index](https://github.com/casama233/kaleidoscope-tavern-unofficial/blob/main/family/BASELINE-STATUS.md) owns delivery identities and acceptance.

G145–G149 presentation corrections are already retained in current main and included in G149's published runtime; their older “local candidate / publication pending” prose is historical. [Earlier README](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/2422c2ab217aadc0d4ca56b6fd560ad9ed233a1f/README.md) and versioned notes retain their original source and evidence.

**Current work:** the exact plate continuation from [#232](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/232) is included in G155 together with the host adaptation. Both conflicting G154 histories remain preserved. Under rebuild task T1.3, [#214](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/214), [#217](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/217), [#220](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/220), [#222](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/222) and [#232](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/232) have been closed; their player-visible requirements and preserved source heads are recorded in [#239](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/239) for transfer to `docs/PARITY.md` at T2.6. Closure does not establish gameplay or client acceptance. [PR triage](docs/audit/PR-TRIAGE.md) records their historical scope.

The owner's **all-item Blockbench first-person/side-texture review** and current complete skewer/bottle/plate gameplay acceptance remain open. Per-stack custom inventory icons are still missing; bottles and plates already have source implementations. `client=false`, `production_ready=false`. See [PARITY-MATRIX](docs/PARITY-MATRIX.md) and [BUGS](docs/BUGS.md).

森羅物語：煙火的非官方基岩版移植。目標是跟隨 Java 原作，保留其玩法與沉浸體驗；**完整一比一移植與現行真人驗收仍未完成**。

當前版本、UUID、相依與來源身份以 [baseline.json](baseline.json) 為準。
從目前候選建置G155依賴作者穩定版 **Cookery 1.6.2**；公開G149請使用其Cookery1.6.0相依。G155最低engine宣告 1.26.50，
`@minecraft/server` 2.9.0 與 `@minecraft/server-ui` 2.2.0；原生證據的引擎版本與範圍以各次紀錄為準。
家族整合提供的砧板／油壺／炒鍋與酒館指南交接能力，不能當作只安裝作者 Cookery 就有的功能。

查看 [Java 移植對照表](docs/PARITY-MATRIX.md) 了解已實作、平台替代與未完成項；
具體失敗及重現方式在 [BUGS.md](docs/BUGS.md)。腳本、封裝或 BDS 載入成功都不代表畫面、聲音及操作已驗收。

## 日常修改與封裝

動畫、物品顯示與手持修復先走[官方來源優先流程](docs/ANIMATION-ITEM-REPAIR-WORKFLOW.md)：固定版本／原生 Blockbench scopes、鏡頭與多 clip 播放，再分開 editor、BDS 與真人驗收；附可複用檢查清單與收據。

現行來源只有一組：
[canonical BP](projects/grilling/gameplay_core/behavior_pack/) 與
[canonical RP](projects/grilling/gameplay_core/resource_pack/)。
在 bridge 開啟倉庫根 `config.json`，直接編輯這組來源；不在安裝或封裝時注入玩法。

重建 P2 期間停用舊版驗證器、疊加建置與發布／封裝入口，不產生新的正式包。
既有下載與 BP/RP 位元組保持不變；不因工具清理部署 LIVE。
[重建 CI](.github/workflows/ci.yml) 執行存檔護欄、膨脹棘輪、baseline、JSON 與保留的玩法／資料萃取測試。
[bridge 匯出檢查](.github/workflows/bridge-project.yml) 仍驗證現有工程與 Dash 匯出，但不是發布授權。

## 最少而有效的驗證

先修可重現的問題。本機只跑受影響的既有檢查，完整必要套件交該 PR 的 CI；
成功的同一份來源不重跑。新增測試必須能攔住既有檢查未涵蓋的具體故障，
不以測試數、公式照抄或重複 hash 表示還原度。

本機可執行 `python3 tools/run_legacy_tests.py` 與 `python3 tools/test_java_extract.py`；
完整入口見 [重建 CI](.github/workflows/ci.yml)。測試分流與後續發布流程依 [重建計畫](docs/REBUILD-PLAN.md) 推進。
舊版收據、守恆與投影驗證不再作為當前重建的准入條件。

玩法或輸出變更必須換版本，完成 canonical PR／檢查／合併及完整家族准入後更新 LIVE，
讓使用者實測。工具／文件沒有改輸出 runtime 時不升包、不重啟。
`client=false`、`production_ready=false` 會維持到實際人工作業驗收。

## 文件與歷史

- [Java 移植對照表](docs/PARITY-MATRIX.md)：現況及下一條固定牛肉串流程。
- [缺口與重現](docs/BUGS.md)：未完成項和具體失敗。
- [重整變更](CHANGELOG.md)：當前工具／文件調整。
- [Phase 0 決策](docs/audit/AUDIT.md)保留原始稽核快照；[PR 處置與保留工作](docs/audit/PR-TRIAGE.md)已重新比對G116，保留各原型的固定來源。
- [release-history.json](release-history.json) 與 `docs/STATUS-A*.md`：各版身份與當時的證據範圍。
- [CURRENT-REPAIR-STATUS.json](docs/CURRENT-REPAIR-STATUS.json)：2.8.51 的歷史來源審查快照，保留當時 bytes 與驗收欄位；目前狀態見上述對照表與缺口頁，不用舊快照代表 G142 或 LIVE 驗收。
- [重整前 README](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/6fc3ab711e90ae9f23739b18b1f28ef5f31bbf8a/README.md)：完整歷史敘述，舊命令不作為今天的建置指示。

## 來源、授權與資料保護

Java 參考分開追蹤 Forge 1.20.1／NeoForge 1.21.1，修補前讀家族的現行 Java 上游紀錄；
不能永久把舊 fixture 當最新版。原作素材保留 CC BY-NC-SA 4.0，原碼及衍生工具的 BSD 聲明另列，
Minecraft 模板不套用原作素材聲明。出處見 [ATTRIBUTION.md](projects/grilling/ATTRIBUTION.md) 與各工程 source manifest。

指南維持既有 Cookery 書內的一個煙火入口與六個料理分類，不另發書物品。
不公開作者完整 Cookery 包、私人宿主腳本、世界或憑證。
唯一寫入遠端為 `burnt-tea-dev/kaleidoscope-grilling-unofficial`，repository ID **1377218440**；寫入前依 [.repo-target.json](.repo-target.json) 核對完整名稱與數字 ID。
