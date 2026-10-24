# 變更摘要

- Unreleased isolated T4.2 candidate 2.8.178: test public ONE native use arbitration (`always` → `if_first`) on exact176; normal held-repeat and release behavior remain unverified, not a confirmed fix.

- Unreleased isolated T4.2 candidate: reconstruct fixed-skewer Java FP source motion, consolidate 58 routes and use tick-only bite checkpoints; Blockbench/native review pending, no publication.

來源、發布與真人驗收是不同狀態。版本身份以 [baseline.json](baseline.json) 為準；公開下載與安裝限制見 [RELEASING](docs/RELEASING.md)，現行缺口見 [KNOWN-ISSUES](docs/KNOWN-ISSUES.md)。

## 重建 P2（不變更 runtime 版本）

- 依重建計畫整理來源、Java 資料、驗證工具、測試與文件；canonical BP/RP 不因文件清理變更。
- 文件集中到 PARITY、KNOWN-ISSUES、ARCHITECTURE、RELEASING 及四份既有規範；保留原始失敗、舊 PR 玩家需求與來源連結。
- 不發布新包、不重啟 LIVE，不以 CI 或文件整理宣稱玩法完成。

## 2.8.155 維護來源

- Cookery 1.6.2／公開 API 0.2.13 的油與磨盤適配、餐盤／食譜交易所有權修補，承接較早穿串、原料、架、作物與油刷來源。
- 這是目前 canonical 來源，並非 A2.8.149 下載內容。完整玩家流程及真人結果仍按 PARITY 分項驗收；`publication_request=false`。

## A2.8.149 保留公開下載

- 相依 Cookery 1.6.0；保留當時 G145–149 的呈現來源與發布身份。
- 實際下載的 API 故障模型物品安全問題仍公開記錄；後續 main 修補不改寫已發布 bytes 或舊驗收範圍。

## 歷史

較早版本的逐項修補、候選與有限證據保留於[收斂前 CHANGELOG](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/CHANGELOG.md)及 [archive/pre-rebuild-20261018](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/tree/archive/pre-rebuild-20261018)。歷史版本名稱與收據維持原身份；舊命令不作為目前的建置／發布指令。
