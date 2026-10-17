## Current maintained source: 2.8.151

**G151 uses Cookery 1.6.1 / family API 0.2.12.** It repairs current chopping-board ingredient production, short-recipe progress, native-mode secret-skewer contents and eating-data ownership, and appends four missing Cookery foods to the display catalog. The [G151 repair review](docs/evidence/skewer-repair-20261017.md) records the actual source defects, verification and remaining client scope. It retains the earlier author identity/state adaptation and Java grill/rack collision repairs.

**Public download:** [A2.8.149](https://github.com/casama233/kaleidoscope-grilling-unofficial/releases/tag/A2.8.149), which uses **Cookery 1.6.0**. G151's [release request](.github/release-request.json) remains `publication_request=false`; a source merge is not a new public package. The G149 stable publication retains the owner's existing source/editor/CI/package decision and its [bounded evidence and deferred risks](docs/RELEASE-NOTES-A2.8.149.md).

**Last LIVE batch recorded in the repository:** T169/G144/W147/private42, deployed **2026-10-15 22:40:27 HKT** and reported checked at the start of the following source batch. This repair session has no new LIVE readback. The [single family status index](https://github.com/casama233/kaleidoscope-tavern-unofficial/blob/main/family/BASELINE-STATUS.md) owns delivery identities and acceptance.

G145–G149 presentation corrections are already retained in current main and included in G149's published runtime; their older “local candidate / publication pending” prose is historical. [Earlier README](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/2422c2ab217aadc0d4ca56b6fd560ad9ed233a1f/README.md) and versioned notes retain their original source and evidence.

**Current work:** [#214](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/214) still has unabsorbed plate rollback/pepper-harvest changes. The main runtime subjects of [#217](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/217), [#220](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/220) and [#222](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/222) are absorbed; residual review remains before closing them. [PR triage](docs/audit/PR-TRIAGE.md) records that distinction.

The owner's **all-item Blockbench first-person/side-texture review** and current complete skewer/bottle/plate gameplay acceptance remain open. Per-stack custom inventory icons are still missing; bottles and plates already have source implementations. `client=false`, `production_ready=false`. See [PARITY-MATRIX](docs/PARITY-MATRIX.md) and [BUGS](docs/BUGS.md).

森羅物語：煙火的非官方基岩版移植。目標是跟隨 Java 原作，保留其玩法與沉浸體驗；**完整一比一移植與現行真人驗收仍未完成**。

當前版本、UUID、相依與來源身份以 [baseline.json](baseline.json) 為準。
從目前main建置G151依賴作者穩定版 **Cookery 1.6.1**；公開G149請使用其Cookery1.6.0相依。G151最低engine宣告 1.26.50，
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

從乾淨已提交的來源直接封裝：

```sh
python3 -B development/gameplay_core/package_current.py --output-dir artifacts/review
```

直接封裝需要 Git 與 Python 標準庫，輸出位於 checkout 內。
官方 Dash 編譯由 [canonical CI](.github/workflows/gameplay-core.yml) 執行；
本機若已安裝 bridge Dash，依 [BRIDGE-WORKFLOW.md](docs/BRIDGE-WORKFLOW.md) 使用。
Linux 的 `/usr/bin/dash` 是 shell，不能當作 bridge 編譯器。

`development/gameplay_core/build.py`、`augment_a*.py` 是歷史重建工具，**不是現行 release 的前置步驟**。
舊 build 已改為預設拒絕，只有明確指定全新、位於 Git 工作樹外的輸出才能重建 A2.0；
不能靠疊加舊 augment 重建 G114。使用界線見 [歷史工具說明](docs/LEGACY-AUTHORING.md)。
歷史素材工程、驗收台及舊 artifacts 保留原用途，不是現行包的替代來源。

## 最少而有效的驗證

先修可重現的問題。本機只跑受影響的既有檢查，完整必要套件交該 PR 的 CI；
成功的同一份來源不重跑。新增測試必須能攔住既有檢查未涵蓋的具體故障，
不以測試數、公式照抄或重複 hash 表示還原度。

CI 的當前入口是 `development/gameplay_core/verify_current.py`；
來源檢查一次完成後，其精確收據供 Dash 輸出比對重用。
來源／發版、原包、候選、停服備份／遷移與部署邊界仍保留完整性關卡。
詳見 [維護流程](docs/BASELINE-MAINTENANCE.md)、[Phase 0 測試盤點](docs/audit/TEST-AUDIT.md)。

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
唯一寫入遠端為 `casama233/kaleidoscope-grilling-unofficial`，repository ID **1377218440**。
