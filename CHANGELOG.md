# 變更摘要

來源、發布與真人驗收是不同狀態。版本身份以 [baseline.json](baseline.json) 為準；公開下載與安裝限制見 [RELEASING](docs/RELEASING.md)，現行缺口見 [KNOWN-ISSUES](docs/KNOWN-ISSUES.md)。

## 2.8.181 核心互動修復候選（未發布）

- 從 G157 gameplay/runtime 延伸；新身份保留既有 G158–178 與 PR #255／G180 候選，不納入 #255 的資產刪除。
- 穿／拆串與烤架／調料瓶已擷取的延後互動，暫停手中物品的 idle 外觀替換直到回呼結束；保留完整雙手、欄位及 metadata 身份檢查。修復新製 Secret 立即拆串或入爐被自己的動畫路由取消的 API 模型失敗。
- 既有測試入口新增立即互動、拒絕已換物品、失敗後重試，以及一／二／三料串至食用的註冊回呼流程。油壺與已備好調料瓶是受控輸入，原生用物事件時序、完整家族、保存與真人驗收仍待同候選驗證；`client=false`、`production_ready=false`、`publication_request=false`。

## 重建 P2（不變更 runtime 版本）

- 依重建計畫整理來源、Java 資料、驗證工具、測試與文件；canonical BP/RP 不因文件清理變更。
- 文件集中到 PARITY、KNOWN-ISSUES、ARCHITECTURE、RELEASING 及四份既有規範；保留原始失敗、舊 PR 玩家需求與來源連結。
- 不發布新包、不重啟 LIVE，不以 CI 或文件整理宣稱玩法完成。

## 2.8.157 Cookery 1.6.4 相容維護

- 同步作者 Cookery 1.6.4 的 BP/RP 身份、公開 API 來源宣告、指南宿主參考與生成器；保持既有 Grilling 玩法。G156／PR #255 獨立保留，公開下載與真人驗收狀態不變。

## 2.8.155 維護來源

- Cookery 1.6.2／公開 API 0.2.13 的油與磨盤適配、餐盤／食譜交易所有權修補，承接較早穿串、原料、架、作物與油刷來源。
- 這是當時的維護來源，並非 A2.8.149 下載內容。完整玩家流程及真人結果仍按 PARITY 分項驗收；`publication_request=false`。

## A2.8.149 保留公開下載

- 相依 Cookery 1.6.0；保留當時 G145–149 的呈現來源與發布身份。
- 實際下載的 API 故障模型物品安全問題仍公開記錄；後續 main 修補不改寫已發布 bytes 或舊驗收範圍。

## 歷史

較早版本的逐項修補、候選與有限證據保留於[收斂前 CHANGELOG](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/CHANGELOG.md)及 [archive/pre-rebuild-20261018](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/tree/archive/pre-rebuild-20261018)。歷史版本名稱與收據維持原身份；舊命令不作為目前的建置／發布指令。
