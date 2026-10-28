# 煙火：非官方 Bedrock 移植

重建進行中。已實作部分 Java 1.1.1 玩法與畫面；完整原生操作、效能與真人驗收仍有缺口，見 [PARITY](docs/PARITY.md) 和 [KNOWN-ISSUES](docs/KNOWN-ISSUES.md)。

## 安裝與版本

公開下載使用 [Releases](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases)，依 [安裝與相依](docs/RELEASING.md) 選對 Cookery 配套。Git 主線是開發來源，不能當成已公開發布或已安裝的版本。

目前來源身份、BP/RP 與精確相依只維護在 [baseline.json](baseline.json)。26.60 命名排程／音效來源需要對應引擎與 Beta APIs；世界要求見同一檔案的 `required_experiments`。來源、CI、staging、部署及真人結果各自記錄；`client=false`、`production_ready=false` 維持至有實際驗收。

## 開發

- 入口：[AGENTS](AGENTS.md) → [重建計劃](docs/REBUILD-PLAN.md)。
- 代碼與保存：[架構](docs/ARCHITECTURE.md)、[存檔相容](docs/SAVE-COMPAT.md)。
- 指南與跨包：[GUIDE-STANDARD](docs/GUIDE-STANDARD.md)、[整合 API](docs/BEDROCK-INTEGRATION-API.md)。
- 原始配方、時長與效果：[data/java](data/java/)；來源萃取：[tools/java_extract](tools/java_extract/README.md)。

方塊互動由共同路由選一個玩法主責，視覺與庫存觀察另外處理。定時工作共用排程器；Cookery 的公開宿主 API 在它自己的包內執行。不要重新增加平行點擊監聽、逐版補丁模組或獨立輪詢。

檢查使用 [既有 CI](.github/workflows/ci.yml)；工具／文件不改輸出時不升包、不重啟。測試只在測試服或隔離世界執行，保留玩家物品、保存鍵和包身份。

## 來源與授權

主要 Java 來源為 `breezeth-CN/KaleidoscopeGrilling@9a1acdab…`。原碼、素材及工具的個別授權見 [ATTRIBUTION](projects/grilling/ATTRIBUTION.md)。公開庫不包含作者完整 Cookery 包、私有整合、世界或憑證。

歷史變更見 [CHANGELOG](CHANGELOG.md) 和 [重建前 archive tag](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/tree/archive/pre-rebuild-20261018)。
