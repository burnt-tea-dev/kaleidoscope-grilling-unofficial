# Kaleidoscope Grilling — unofficial Bedrock port

## Current maintained baseline: 2.8.126

[G126 熟毛蟲雙手與 HUD 候選](docs/STATUS-A2.8.126.md)：只承接已錄影的 canonical 熟毛蟲、右手、站立、空副手外層座標修正。雙手與取消／結束恢復有窄實機證據；近嘴放大、Java 實片與其他食品／皮膚／FOV／第三人稱仍未驗收。另將原圖形 HUD hold 75ms→100ms；單次受控 no-clear 錄影連續 89 幀，自然食用／完整家族與合併包仍待驗證。此分支為 draft，未發布或部署。

家族目前的 LIVE 配套、部署與逐檔收據、保存演練及指南接收範圍，統一見[家族基線入口](https://github.com/casama233/kaleidoscope-tavern-unofficial/blob/main/family/BASELINE-STATUS.md)。本倉庫的版本記錄保留各次修補及當時的驗證範圍。

[G125 場景聲畫與操作守恆](docs/STATUS-A2.8.125.md)：修復烤架後續取消／延後目標、榨油機扣料及滿背包串譜／穿串／拆串；烤架亮度回到 7，新增動畫油面、premium 大缸滿亮液面與秘製串牆譜 GUI 分層。Numb 修正 20 倍時間誤差，油壺粒子、搖瓶聲音及保命圖騰粒子補齊可用路由。仍有 native inventory／HUD／第一人稱及原生事件差異；隔離 BDS 診斷不代替完整家族准入或 LIVE 更新。

[G124 調料資料映射](docs/STATUS-A2.8.124.md)：沿用公開 Server-only API 保存及重新載入調料資料，取料、食用與 HUD 共用目前映射。保留 G123 locale 掛鉤及 G122 保存／品質，明確 provider、原生玩家操作與真人驗收限制仍依版本記錄分開保留。

[G123 指南正文語言鍵修補](docs/STATUS-A2.8.123.md)：Cookery 1.6.0 原 registry 接收條目與名稱後會丟棄三語正文；本版登記局部 locale 掛鉤，保留其他 token 驗證與 G122 修補。

[G122炒鍋、品質與所有權修補](docs/STATUS-A2.8.122.md)：三道料理補保存備料／三翻／變質流程和原作彈性配方，
品質原生食物、冷卻與食材快照接通；兩分支原 Java 純邏輯的 1,248 組品質與 12 組 NeoForge 食物值相符。
油渣新增乾燥紅樹葉下生苗與懸掛苗成熟，明列 25 類；施肥與炒鍋退款先確認本次寫入所有權。
先前未合併的機制候選移入 G122；版本沿革與當前驗證邊界見本版狀態頁。
承接[G121酒館指南共用入口](docs/STATUS-A2.8.121.md)：Cookery 的酒館章節交由酒館顯示同一份指南，
以玩家來源與限時交接確認避免重複視窗；關閉不重開，返回才回 Cookery。
承接[G120持久化與出料修補](docs/STATUS-A2.8.120.md)：重金屬在取消傷害前保存並確認防重複結算記錄，
油渣新增瓜梗、纏根土及兩種下界藤，明列 23 類植物適配；料理工作站補取消保存與出料收據守恆。
承接[G119剩餘差異修補](docs/STATUS-A2.8.119.md)：手持餐盤內容與獨立份數解碼，
共用每手顯示通道，擴充原版植物施肥，並將重金屬保命改為一次確認提交。
承接[G118機制與放置顯示修補](docs/STATUS-A2.8.118.md)、
[G117手持營養與瓶保存](docs/STATUS-A2.8.117.md)和[G116餐盤互動](docs/STATUS-A2.8.116.md)。
任意秘製串背包圖示、原生事件差異與聲畫／真人驗收仍分開記錄。

森羅物語：煙火的非官方基岩版移植。目標是跟隨 Java 原作，保留其玩法與沉浸體驗；**完整一比一移植與現行真人驗收仍未完成**。

當前版本、UUID、相依與來源身份以 [baseline.json](baseline.json) 為準。
依賴作者 **Cookery 1.6.0**；最低 engine 宣告 1.26.50，當前驗證使用 BDS 1.26.51.1、
`@minecraft/server` 2.9.0 與 `@minecraft/server-ui` 2.2.0。
家族整合提供的砧板／油壺／炒鍋與酒館指南交接能力，不能當作只安裝作者 Cookery 就有的功能。

查看 [Java 移植對照表](docs/PARITY-MATRIX.md) 了解已實作、平台替代與未完成項；
具體失敗及重現方式在 [BUGS.md](docs/BUGS.md)。腳本、封裝或 BDS 載入成功都不代表畫面、聲音及操作已驗收。

## 日常修改與封裝

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
- [重整前 README](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/6fc3ab711e90ae9f23739b18b1f28ef5f31bbf8a/README.md)：完整歷史敘述，舊命令不作為今天的建置指示。

## 來源、授權與資料保護

Java 參考分開追蹤 Forge 1.20.1／NeoForge 1.21.1，修補前讀家族的現行 Java 上游紀錄；
不能永久把舊 fixture 當最新版。原作素材保留 CC BY-NC-SA 4.0，原碼及衍生工具的 BSD 聲明另列，
Minecraft 模板不套用原作素材聲明。出處見 [ATTRIBUTION.md](projects/grilling/ATTRIBUTION.md) 與各工程 source manifest。

指南維持既有 Cookery 書內的一個煙火入口與六個料理分類，不另發書物品。
不公開作者完整 Cookery 包、私人宿主腳本、世界或憑證。
唯一寫入遠端為 `casama233/kaleidoscope-grilling-unofficial`，repository ID **1377218440**。
