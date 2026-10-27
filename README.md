# 煙火：非官方 Bedrock 移植

> **重建進行中：P3 前只接受 P0 等級存檔安全修補。** 工作順序見 [REBUILD-PLAN](docs/REBUILD-PLAN.md)，代理先讀 [AGENTS](AGENTS.md)。

目前仍未完成 Java 1.1.1 的全部玩法、畫面與真人驗收；`client=false`、`production_ready=false`。來源已實作、CI、staging、部署及真人結果分開記錄，不能用測試數或載入成功代替還原度。

## 安裝與版本

| 用途 | 版本與相依 |
| --- | --- |
| 目前公開下載 | [A2.8.157](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases/tag/A2.8.157)，只含自有 Grilling BP/RP；需要 Cookery **1.6.4** 配套，見 [RELEASING 的安裝邊界](docs/RELEASING.md#目前公開下載與安裝邊界) |
| 維護修復候選 | [baseline.json](baseline.json) 的 **2.8.181／Cookery 1.6.4**；從 G157 runtime 延伸的核心互動修復，未納入 PR #255／G180 資產清理，尚未發布或完成 native／真人驗收 |
| 歷史公開下載 | [A2.8.149](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases/tag/A2.8.149)，仍需要作者 Cookery **1.6.0** 的 BP/RP |

公開 G138 TEST／G149 stable 的 API 故障模型曾重現物品遺失、覆寫與重複產物；這不是原生發生率證明，後續來源修補也沒有改變既有下載 bytes。測試前保留世界備份。精確檔案、雜湊、相依與安裝限制見 [RELEASING](docs/RELEASING.md)；勿把不同 Cookery 版本互換。

## 目前進度與問題

- [PARITY](docs/PARITY.md)：Java 功能、實作位置、驗收界線及五個舊 PR 的保留需求。
- [KNOWN-ISSUES](docs/KNOWN-ISSUES.md)：已知失敗、重現方式、平台差異與待驗收場景。
- [ARCHITECTURE](docs/ARCHITECTURE.md)：目前來源結構、保存與跨包接口；P3 目標不冒充已完成。
- [SAVE-COMPAT](docs/SAVE-COMPAT.md)：物品、方塊、實體、state、key 與 UUID 的硬性保留規則。

## 開發與驗證

唯一 canonical pack 在 `projects/grilling/gameplay_core/{behavior_pack,resource_pack}`；bridge 根工程 [config.json](config.json) 指向同一來源。重建 CI 見 [.github/workflows/ci.yml](.github/workflows/ci.yml)。工具／文件沒有改輸出時不升版、不部署；`publication_request=false` 維持。

指南維持既有 Cookery 書內一個煙火入口與六個根類，見 [GUIDE-STANDARD](docs/GUIDE-STANDARD.md)；公開接口見 [BEDROCK-INTEGRATION-API](docs/BEDROCK-INTEGRATION-API.md)。完整家族／作者能力不能由 manifest 相依自行推論。

## 來源與授權

主要 Java 來源為 `breezeth-CN/KaleidoscopeGrilling@9a1acdab…`，資料表與萃取方法見 [data/java](data/java/)／[tools/java_extract](tools/java_extract/README.md)。原碼、素材及工具授權各自保留於 [ATTRIBUTION](projects/grilling/ATTRIBUTION.md) 與各來源聲明；不公開作者完整 Cookery 包、私有整合、世界或憑證。

[CHANGELOG](CHANGELOG.md)保留簡短版本摘要；舊細節見 [重建前 archive tag](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/tree/archive/pre-rebuild-20261018)。唯一寫入目標為 `burnt-tea-dev/kaleidoscope-grilling-unofficial`（ID `1377218440`），依 [.repo-target.json](.repo-target.json) 核對。
