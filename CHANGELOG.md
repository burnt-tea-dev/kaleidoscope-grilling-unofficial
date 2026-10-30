# 變更摘要

## 2.8.200 玩家離開後的提示文字掃描（未發布）

- 已排程的熱度與食物提示掃描遇到已離開的玩家／失效容器時略過該玩家，其餘玩家仍可繼續更新；不改物品內容、熱度時鐘或食用結算。
- 真正 runtime 事件回呼已重現原 InvalidEntityError；修正後回歸通過。完整家族原生門檻、部署及真人複驗仍待完成，`client=false`、`production_ready=false`。

## 2.8.199 指南啟動分批準備（未發布）

- 指南傳輸封包改在啟動後分批準備；ready 到達時重用同一個準備工作，封包完成後才開始傳送。
- R37 隔離原生測量：冷啟動約 180 ms（R35 為 291 ms），GSlowdown 由 8 降至 0，載入錯誤 0。
- 完整家族門檻仍失敗，記錄 297 則警告；此結果不是准入、發佈或客戶端驗收。`client=false`、`production_ready=false`、`publication_request=false`。

## 2.8.198 合成餘桶與宿主配方去重（未發布）

- premium chili oil 原生配方現在明確產生 1 個油桶和 1 個空桶，對應 Java 熔岩桶的容器餘物。
- Cookery 宿主收到重複 ready 訊息時只註冊尚未成功送出的配方，避免同一配方重複傳送；傳送失敗的項目仍可重試。
- Java parity check 通過；指定 BDS 合成行為、完整家族及客戶端結果仍待 QA／真人驗收。`client=false`、`production_ready=false`。

## 2.8.197 烤架原生空手入口（未發布）

- 既有烤架元件加入原生空手互動，沿用同一翻面／取出 owner；一般 before 路徑的主副手快照、取消與長按規則保留。只有可確認雙手皆空的原生回呼會執行，手部讀取失敗時不猜測。
- 同一玩家／方塊／tick 的一般 before 與原生回呼只處理一次，玩家離開即清掉暫存。未新增輪詢、全域訂閱或存檔鍵。
- 真正回呼 scenario 75／75 通過，包含重複輸入、長按、副手有物與切槽取消；BDS 完整烤製、保存及真人結果另行記錄。

## 2.8.196 Cookery 宿主匯出依賴修復（未發布）

- 正式宿主匯出清單補齊 API 已實際引用的核心儲存模組；避免只在 Grilling 本體能載入，複製到 Cookery 後找不到檔案。
- 回歸以真實匯出檔案呼叫現有模組檢查，並移除一個核心模組重現拒絕。既有資料鍵、物品、配方和數量不變；原生及客戶端驗收另行記錄。

## 2.8.195 共用存檔、工作站庫存與物品交易歸屬（開發中，未發布）

- T3.2 將 world 動態屬性存取集中到 `core/persist.js`，把存檔鍵逐字集中在 `core/persist_keys.js`，並將共用物品交易及工作站庫存移入 `core/transaction.js`、`core/storage.js`。
- 保留所有既有資料格式與 ID；75 個存檔鎖項目包含兩個已在使用但先前漏鎖的榨油機登記鍵。未新增存檔格式。
- API 測試、92 個保留測試檔及 105 個差分案例通過；尚未做 BDS、客戶端或真人驗收。

## 2.8.194 榨油機原生命名事件修正（開發中，未發布）

- 使用 BDS 1.26.60 的 ownership-aware `isName` 事件；移除不存在的排程取消 API，完成工作後不再重排。
- 保留同 tick 去重、原保存登記、區塊卸載恢復及出料交易；已拆除機器不會因殘留工作再出油。
- 既有共用 API fixture 同步實際事件形狀，油機反例通過；真引擎完整出油、保存重啟及真人操作仍待驗證。

## 2.8.193 食用完成所有權與呈現恢復（開發中，未發布）

- 固定烤串完成時核對本次使用的手、槽及完整物品資料，換走食物後不再套用舊完成事件的效果。
- 同一份食物從暫時不一致的手部視圖恢復時，接續原有進度、動作及投影，不重播聲音。
- Java 隨機動作是每次使用的暫存選擇；直接離線依[擁有者決定](docs/REBUILD-PLAN.md#t3-4-direct-logout-policy)保留Java平台差異；原生和真人驗收仍未完成。

## 2.8.192 共用事件派送（開發中，未發布）

- 方塊互動、破壞前／後、爆炸及腳本訊息改由每個原生環境的共用入口派送；保留取消與延後工作的時序，個別client可獨立關閉。
- 公開宿主共用同一SDK路由，API helper契約追加0.2.14；移除三個已被統一作物owner取代的未載入模組。
- API模型不代表BDS、畫面、聲音或真人驗收完成。

來源、發布與真人驗收是不同狀態。版本身份以 [baseline.json](baseline.json) 為準；公開下載與安裝限制見 [RELEASING](docs/RELEASING.md)，現行缺口見 [KNOWN-ISSUES](docs/KNOWN-ISSUES.md)。

## 2.8.190 原生時長準備改為變動觸發（未發布）

- 不再對未變的idle手持每tick展開metadata；初次觀察、inventory／hotbar原生事件及動畫設定改變才準備原生時長variant，正在食用或有手部交易時保留等待。
- 保留合法食物的原有准入、數量、metadata與原生完成扣份；沒有採用已被原生控制證明會重複扣份的「提早扣1份即結束」設計。副手直寫缺少原生inventory事件，沿用wrong-duration使用前guard。
- 新情境執行真正runtime，涵蓋idle無重複查詢、換槽／設定、交易等待和副手路徑。Native探針是隔離能力證據，完整T3.4及真人聲畫仍待驗。

## 2.8.189 油渣施肥補完：甜菜、竹子、海帶（未發布）

2.8.188 是同一 PR 的前一候選（海帶原頭部記為 0），未合併；本版依擁有者決定改為保留原年齡。

- 油渣對甜菜依 Java `BeetrootBlock`（CropBlock 2–5 點數除以 3）每次推進 0 或 1 階，以 Bedrock growth 0–1／2–3／4–6／7 對應四個 Java 年齡；未推進仍扣料，成熟不扣。
- 竹子依 `BambooStalkBlock`／`BambooSaplingBlock`：16 節以下的竹柱從頂端長 1–2 節，葉片與粗細照 `growBamboo` 下移；頂端被擋仍扣料不生長。Bedrock 沒有 Java stage 狀態，只以高度上限停止。
- 海帶依 `KelpBlock`：每次向上長入一格水（源或流動），年齡上限 25，原頭部保留原年齡、不改寫；新頭部明確寫入含水層，回滾必須讀回原水方塊與含水層，否則保留成本並隔離。
- 測試夾具新增 `isWaterlogged`／`setWaterlogged` 與 `getEquipmentSlot`；保留測試檔數不變。沒有新增 item、block、state 或 persisted key。

## 2.8.187 共用模型與聲音修正（未發布）

- 合併完全相同的模型定義，保留骨架、位置、UV 與顯示範圍；貼圖和材質仍由原消費者指定。模型檔分銀行且每檔不超過 512 KiB；實際客戶端效能另驗。
- 吸收 #291 的秘製串首次顯示修正與 #290 的 Java 點火／熄火音高、穿串分類和聲源位置修正，沿用其真實回歸場景與生成器。
- 來源工具 `tools/compact_geometry.py` 更新 canonical 資產；相同輸入重跑不產生差異。沒有新增 item ID、player property 或貼圖。

## 2.8.186 功能域收斂（未發布）

- main 僅保留組裝；烤架、穿串、食用、效果、玩家與調料各自保存和處理自己的狀態。保留既有時序、交易及完整物品資料。
- 版本編號模組搬回功能域，移除七條未載入的處理路徑和舊油壺 fallback；Cookery 公開宿主的來源／輸出路徑同步更新。
- 保留物品、方塊、實體、保存鍵及 UUID。測試與 CI 不代表客戶端畫面驗收。

## 2.8.185 共用互動與排程（未發布）

- 本包十一個方塊互動處理改由一個主責路由派送；接受後停止其他玩法寫入，視覺／庫存觀察另行執行。Cookery 宿主 API 保留獨立腳本環境。
- 十六個 interval 收斂為一個排程入口，同 tick 共用玩家查詢；原有工作週期及方塊命名 tick 保留。合併油壺相容與環境效果，移除未使用的 HUD transport。
- 保留所有物品、方塊、實體、保存鍵與 UUID；原生及真人結果另驗。

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
