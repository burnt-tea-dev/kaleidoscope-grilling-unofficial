# 變更摘要

來源、發布與真人驗收是不同狀態。版本身份以 [baseline.json](baseline.json) 為準；公開下載與安裝限制見 [RELEASING](docs/RELEASING.md)，現行缺口見 [KNOWN-ISSUES](docs/KNOWN-ISSUES.md)。

## 2.8.156 資產清理候選（T2.8，待完整 staging）

- 移除 667 個未引用 geometry 檔與 179 張未引用貼圖，並從混合模型精確移除 16 個舊定義，保留 40 個仍用定義。
- 退役已完成用途的 `apply_skewer_display_parity.py`；原碼與 Java 輸入保持歷史可查，不改玩法、持久化 item／block／entity ID、pack UUID 或存檔資料。
- 同步 BP／RP 配套版本及基線；完整 staging 前後畫面、真人與重啟驗收尚未完成，沒有發布或部署。

## 重建 P2 T2.1–T2.7（來源與工具整理）

- 依重建計畫整理來源、Java 資料、驗證工具、測試與文件；canonical BP/RP 不因文件清理變更。
- 文件集中到 PARITY、KNOWN-ISSUES、ARCHITECTURE、RELEASING 及四份既有規範；保留原始失敗、舊 PR 玩家需求與來源連結。
- 不發布新包、不重啟 LIVE，不以 CI 或文件整理宣稱玩法完成。

## 2.8.155 維護來源

- Cookery 1.6.2／公開 API 0.2.13 的油與磨盤適配、餐盤／食譜交易所有權修補，承接較早穿串、原料、架、作物與油刷來源。
- 這些玩法修補由後續維護來源承接，並非 A2.8.149 下載內容。完整玩家流程及真人結果仍按 PARITY 分項驗收；`publication_request=false`。

## A2.8.149 保留公開下載

- 相依 Cookery 1.6.0；保留當時 G145–149 的呈現來源與發布身份。
- 實際下載的 API 故障模型物品安全問題仍公開記錄；後續 main 修補不改寫已發布 bytes 或舊驗收範圍。

## 歷史

較早版本的逐項修補、候選與有限證據保留於[收斂前 CHANGELOG](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/CHANGELOG.md)及 [archive/pre-rebuild-20261018](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/tree/archive/pre-rebuild-20261018)。歷史版本名稱與收據維持原身份；舊命令不作為目前的建置／發布指令。
