# 變更摘要

來源、發布與真人驗收是不同狀態。版本身份以 [baseline.json](baseline.json) 為準；公開下載與安裝限制見 [RELEASING](docs/RELEASING.md)，現行缺口見 [KNOWN-ISSUES](docs/KNOWN-ISSUES.md)。

## 2.8.184 Bedrock 26.60 grill sound option correction (unreleased)

- Correct the native `WorldSoundOptions.loopCount` option to `-1`. G183 used `loop`, so a one-shot handle could remain retained after the clip ended and prevent playback from restarting. Keep one native handle per grill and the existing independent stop/unload lifecycle.
- Add a real runtime-adapter scenario that advances beyond two clip durations and stops each grill independently. This is API-boundary behavior coverage, not native audio or client acceptance. The [26.60 release notes](https://feedback.minecraft.net/hc/en-us/articles/49852828563853-Minecraft-Bedrock-Edition-26-60-Changelog) document `loopCount`.

## 2.8.183 Bedrock 26.60 native scheduling and audio candidate (unreleased)

- Preserve the merged G182 visual repairs and asset cleanup. Replace oil-press per-tick registry polling with owned named ticks and 20-tick recovery; preserve saved-state keys, loaded-tick progress and item transactions. Startup recovery only arms the next native tick.
- Native grill audio loop keeps one handle per station and retains extinguish, removal and unloaded-station cleanup. Observer seasoning one-shots are unchanged.
- Requires Bedrock 26.60 and server 2.12.0-beta / Beta APIs (`gametest=true`). Bridge flags configure the editor only. Source/CI is not client or LIVE acceptance.

## 2.8.182 資產／食材／朝向整合候選（未發布）

- 承接 G181 核心互動修復，依 Java 1.1.1 修正烤架食材柄在四個 cardinal 的出生與更新朝向；南北不再反向，槽位、翻面、ID 與保存資料不變。
- 秘製串追加牛肉塊、雞皮、魷魚鬚、生地瓜片、魚腥草碎、馬鈴薯片、胡蘿蔔丁與生饅頭片的既有食材索引 218–225、七階段色板及 helper 外觀；保留舊索引、其他 hand-bank owner 與 32 個既有 player properties。
- 移除 667 個整檔未引用 geometry、179 張未引用貼圖及混合檔中的 16 個未引用定義；保留所有仍有引用的定義與新增食材資產。完整畫面前後對照、原生操作、聲音、保存與真人驗收仍待同候選驗證；`client=false`、`production_ready=false`、`publication_request=false`。

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
