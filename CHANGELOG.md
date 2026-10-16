# G149 pending offhand NONE-route candidate

- Remove the mirrored FP pending shake only from nine offhand attachables; retain the existing static hold and separate sprinkle precedence.
- Preserve main-hand, TP/player/clip payloads, assets, BP lifecycle, UUIDs and prior history; use a new paired2.8.149 identity.
- Full default-path Java evidence supports this contributor removal, while native host-frame and runtime acceptance remain open. [Source contract](docs/evidence/pending-offhand-none-route-g149.md).

# G148 third-person seasoning item contributor candidate

- Restore the original active main-arm SPECIAL item-local half-turn before its display transform, with converted translation and orientation.
- Add one separate TP item clip and exclusive main-hand active/idle selection for the 65 SPECIAL attachables; preserve existing FP clips, player equations, assets and gameplay.
- Preserve prior release identities and source witnesses. The relative source correction does not certify absolute socket, camera, native material or rendered-client parity. [Evidence scope](docs/evidence/seasoning-tp-item-inversion-g148.md).

# G147 guarded owner eating properties candidate

- Cache five individually guarded owning-entity eating properties once per attachable frame; preserve zero fallback and existing valid-state behavior.
- Change only 65 eating attachables, three item-animation documents and paired 2.8.147 identity; runtime text shrinks by 93,380 bytes before identity changes.
- Keep historical source pins and the G146 ownership manifest immutable, with exact reversible current-layer validation.
- Source-expression checks are separate from editor/native/client and long-term deployment acceptance. [Evidence scope](docs/evidence/owner-eating-property-guards-g147.md).

# G146 local plate-use arm source candidate

- Suppress the generic left-arm/sleeve use fallback only for active first-person main-hand skewer plate with empty offhand.
- Preserve map branches, occupied offhand, all skewer routes, transforms, G144 performance, G145 composition and CI fixes.
- Keep strict current/historical producer separation; no native acceptance, publication or deployment.
- G145 fingerprints remain immutable; G146 is a separate local release identity.

# G145 composed skewer Java-source repair candidate

- Preserve merged G144 indexed deadline work and synchronous effect snapshots.
- Compose reviewed THREE/raw ONE/failure/offhand projections, third-person item exclusion, cooked slime world-clock frames, saved failure/slime plate visuals, initial grill facing, native GUI icon families, finite custom-effect merging and bottle-clear guide clarification.
- Preserve UUIDs, saved ownership, settlement, all 83 bottle-clear recipes and original source witnesses. G144 performance and all local effect/resolver runtime bytes are composition-tested.
- This is a draft source candidate. No full canonical/Windows package, native client, saved-world or deployment acceptance is claimed. Source-left offscreen motion is preserved where independently confirmed from the original Java call chain; editor captures are not engine acceptance.
- Suspicious-stew variants, native vanilla hidden-effect chains and unregistered external callbacks remain outside this custom-effect repair. PR217 grill/rack shape changes remain separate.

# 維護變更

## 2.8.144：限制排程積壓與玩家效果重複工作

油流／熱食提示共用的 deadline queue 改為每個 key 只保留一個 heap node，重排與取消直接移除舊工作，避免一次有限額的 `take` 額外清掃大量失效節點。20,000 次同槽重排後取消的來源場景，下一次空工作清掃由20,000次降為0次。

玩家同步效果迴圈只取一次局部快照；100個idle tick的效果讀取由555次降至100次，hunger／saturation component各100次降至0次。事件交易仍各自讀回目前狀態，效果到期與vigor保護不降頻。保留配方、油流期限、原作時間、進食第25tick／單次結算、動畫素材與HUD傳輸。操作次數是來源證據；當前候選的BDS耗時、客戶端RTT／FPS與完整玩法尚未驗收。[證據及範圍](docs/evidence/performance-bounded-work-20261015.md)。

## 2.8.143：進食玩家狀態與瓶子準備隔離

手持串的自訂進食 properties 改從 owning player 讀取，避免 attachable 的另一個查詢環境把手部、profile 和時間讀成零。第一人稱副手使用既有同步進度，不再借用主手倒數；秘製串在本機 use flag 重啟但服務端仍為上一份末段時繼續隱藏，直到既有新份／身份／手部／清空邊界重置。

承接 PR200 的窄修補：僅比較瓶子／串快照最外層 lore 的等價 RawMessage 表示，保留實際 lore 和其他 metadata 精確校驗。瓶子完整掃描在開始時記錄節流，單一失敗不阻止其餘槽位與副手；食物動畫準備獨立執行，失敗物品保持原狀。

保留 Java 曲線、骨架、PNG、聲音、UUID、指南契約、營養／結算、90／100 tick 時長、第 25 tick 檢查點與 G140–G142 HUD 布局／傳輸。近鏡放大、末段平片、最新 HUD 延遲及任意三食材 native inventory icon 未據來源測試宣稱恢復。候選 `A2.8.143`；完整來源 CI、家族准入與 LIVE 讀回另行記錄，`client=false`、`production_ready=false`。

## 2.8.142：裁剪未選中的進食 HUD 圖像

每次原生 Actionbar 實例只保留本次選中的底條、填色和圖示；外來或完整結束資料不建立圖像內容，外層 packet、容量與過期生命週期保留。405 個候選圖像的靜態投影最多選中 3 個圖像；這是來源控制樹模型，沒有據此宣稱客戶端實際配置數或秒級延遲已驗收。

保留 G141 原生剩餘時間與立即首幀、Java 素材和 Desktop／觸控位置、食物時長／結算／動作／音效。正式標籤 `A2.8.142`，輸出後綴 `baseline1`；`client=false`、`production_ready=false`。

## 2.8.141：進食 HUD 對齊原生剩餘時間

進食條以原生開始事件提供的剩餘 tick 對齊完整 90／100 tick 時長，避免從零重算已經開始的進度；缺失或無效值沿用捕獲時鐘。開始事件立即送出首幀，其後維持每 tick 更新。這去除最多一個排程 tick 的首幀等待，未據此宣稱秒級延遲已完成真人驗收。

保留第 25 tick 檢查點、原生食物時間與結算、動作、音效、素材及 G140 觸控／Desktop 布局。正式標籤 `A2.8.141`，輸出後綴 `baseline1`；`client=false`、`production_ready=false`。

## 2.8.140：進食 HUD 錨點、觸控布局與完整結束

修正原生 HUD 錨點方向，讓進食填色與圖示對準原作底條和第 25 tick 檢查點；觸控介面將整組圖形上移 26 邏輯像素，避開原生「使用物品」按鈕，Desktop 保留 Java 座標。共用原生 Actionbar 僅隱藏自有資料碼，保留飽和度及一般提示。

延續 G138 的原生觸控使用入口，食物營養、使用時間、結算、動畫與素材保留。完整 END 標記即使带原生格式前綴，也會關閉底條及全部進食圖形。2.8.139 保留其凍結來源，未公開發布／部署；公開正式標籤為 `A2.8.140`，輸出後綴為 `baseline1`；來源 CI、家族存檔准入與真人畫面驗收分開記錄，`client=false`、`production_ready=false`。

## 2.8.125：場景聲畫、延後目標與滿背包交付

烤架在延後拆除前確認爆炸取消與站點所有權，完整物品 metadata 讀取移出 restricted before-event。榨油機加入站點 instance／手部前像與可確認的交易回滾；串譜、穿串、拆串先插入可用庫存，再掉落剩餘物，未確認交付留下持久記錄防止重複退款。

亮度 13→7；三種油採官方 Bedrock 動畫素材與原作 tint，premium 大缸只有液面滿亮；秘製串牆譜用原作 GUI mask 與實際食材顏色分層。Numb 改正 tick／秒、弧度／角度轉換與獨立控制器，油壺新增 per-player 粒子，搖瓶本人／旁觀者聲音分流，保命成功後補原生圖騰粒子。

包／模組及自有相依 2.8.125、指南 0.3.55。具體來源、受影響檢查、隔離 BDS 診斷與平台／真人限制見 [G125](docs/STATUS-A2.8.125.md)。完整家族、fresh 停服存檔及 LIVE 需同候選獨立收據，`client=false`、`production_ready=false`。

## 2.8.124：調料資料重新載入與共用效果映射

修復准入及食用效果寫死的來源差距。既有 Server-only integration API 接收有序調料資料根，保存讀回及失敗回滾共用原登記交易；舊 v1 存檔缺欄位仍可載入。原有食物的 ingredient IDs 不改寫，使用時依目前映射計數；main、HUD 與准入共享同一 resolver，預設資料不再另複製一份。

包／模組及自有相依 2.8.124、指南 0.3.54；Cookery 1.6.0 與 family API 0.2.10 保留。沒有新增 Cookery 私有 producer 掛鉤、替換宿主全文或自動讀取 Java datapack。必要來源檢查、provider 及真人限制見 [G124](docs/STATUS-A2.8.124.md)。舊候選 Native／LIVE 證據保持原身份。

## 2.8.123：保留指南三語正文

原 Cookery 1.6.0 的 Guidebook Extension registry 將 `mechanicsByLocale` 鍵套用小寫 token 驗證，丟棄 `zh_CN`／`zh_TW`／`en_US`。自有 `publicGuideLocale` 透過已登記的局部掛鉤保留標準語言鍵；分類、source、revision 等驗證不變。包／模組 2.8.123、指南 0.3.53、family API 0.2.10，保留 G122 玩法與作者身份。

乾淨原包與套用後的實際 registry 回歸見 [G123 狀態](docs/STATUS-A2.8.123.md)。完整家族接收、原生載入、存檔演練及部署按家族流程另記；真人驗收仍待完成。

## 2.8.122：保存炒鍋、原作品質與施肥所有權

三道料理保留原 exact 配方並接通 flex，保存九槽備料、第一鏟起算、三翻及成品／黑暗料理／木炭階段。
品質使用原 Java 種子、配方 ID 與隨機順序；兩分支 1,248 個品質觀察及 12 組 NeoForge 食物值相符。
12 個原生品質變體保留完整可公開的成品資料，共用基本菜品圖示與秘製串視覺索引；
調料色盤生成器為這 12 個內部別名新增精確排除，保留原生成輸出與完整比對。
油渣由 23 增至 25 類，新增乾燥紅樹葉下生苗及懸掛苗成熟；
植物與炒鍋先確認實際寫入所有權及完整回復，才退還本次成本，未知交付仍保留隔離。

本版承接已合併 G121 的 Tavern 共用指南橋接，保留其玩家來源、限時確認、返回與關閉行為。
包／模組與配對版本為 2.8.122，指南 0.3.52，自有 family API 0.2.9；既有 UUID 與作者 Cookery 1.6.0 保留。
先前公開的 `f27d40a7c1bab951398e3fc3d3906bcc416c5c3f` 是當時未合併的機制候選，現納入 G122；
G121 的正式指南橋接狀態及 release-history 歷史不被重寫。
[來源、有限原 Java 證據與剩餘條件](docs/STATUS-A2.8.122.md)；完整 CI、原生載入、保存演練、
LIVE 與真人驗收按 G122 精確候選另記，不沿用舊候選結果。

## 2.8.121：酒館共用指南入口

Cookery 酒館章節以玩家來源、nonce、語系與40 tick期限確認後交給 Tavern 共用指南；
返回回到 Cookery，關閉不重開。保留G120修補與指南內容，配對包、模組、兩個bridge名稱121，
指南0.3.51、自有family API0.2.8同步。針對性來源／協定檢查通過；完整CI、BDS、存檔與真人驗收分別記錄。
[完整範圍](docs/STATUS-A2.8.121.md)。

## 2.8.120：持久保命記錄、瓜梗與料理出料守恆

重金屬先在實體自己的 dynamic property 保存 claim 並讀回，才排程與取消傷害；
logout／reload 不清除同一 until／amp 的記錄，未知取消與寫入結果保守隔離。
精確 server 2.9.0 bindings 允許受限事件使用 dynamic-property setter；HP／聲音仍延後處理。
油渣新增西瓜梗、南瓜梗、纏根土及兩種下界藤，明列 23 類；保留剛成熟當次結瓜、單次方向抽樣、
光照／土地／鄰株快照、果實先於附著梗、兩次作用一次扣費及回滾。
下界藤按連接方向尋端，第二次讀第一次虛擬生長，age25仍可施肥；海帶流體層回滾尚未適配。
料理工作站尊重後續破壞／爆炸取消並檢查 metadata 前像；出料需 prepared 與實際交付確認，
取出／拆鍋依共用批次記錄防止重發，未知交付不盲目退回該次容器。
容器成本綁 owner 與實際出料收據；木炭取出與拆鍋共用 plain receipt，native 所有權未知不覆寫。
自有 family API 0.2.7 保留作者8個原檔與UUID，僅更新有精確前像的短掛鉤。

指南0.3.50只更新油渣頁兩個三語段落；包／模組／自有配對120與兩個bridge名稱同步。
現行 verifier 補接 G117–G120 已有的 source-session 四組成功命令重用，必要回歸與斷言保留。
沒有新增／本機執行模擬玩家測試；既有完整套件由必要CI執行。
[來源、驗證範圍與剩餘條件](docs/STATUS-A2.8.120.md)；原生光照／鄰居更新、吸收／圖騰、
完整宿主生產、inventory圖示、聲畫、fresh家族存檔及LIVE仍有未閉合範圍。

## 2.8.119：手持盤、原版植物與重金屬單次提交

新增手持盤 1–5 份保存內容投影及專用模型；兩手各自以唯一 writer 共用原秘製串／瓶顯示欄位。
每份拆成兩個有界 word，份數獨立傳送，保留目前 palette、ownership、原作手持 FIXED 與既有物品資料。
原版植物明列支援由 8 增至 18，處理甜莓主副手／潛行與採果順序、雙高植物、兩次花卉掉落，
並把所有讀取鄰位納入快照及未知結果隔離。
重金屬改為成功排程後才取消，一次提交移除效果與12000tick中毒；核對實際前像及讀回後再改生命／聲音。

指南0.3.49三語、包／模組／自有配對119與兩個bridge名稱同步；既有UUID及Cookery相依保留。
任意秘製串背包圖示、其餘植物、吸收／死亡／圖騰時序及同候選原生／真人仍未閉合。
[完整來源、驗證與剩餘條件](docs/STATUS-A2.8.119.md)；未以資產或CI代替LIVE／客戶端接受。

## 2.8.118：原作機制對照修補

三路代理分別修正核心食用／背包、農業／製油、容器／放置，交叉覆核後整合：
廚具架尊重後續爆炸取消並使用正確取放音效；錄製串譜以可回滾的放置、交付與清理保存完整資料。
油渣接入本包作物與花椒苗的實際施肥處理，自然凋葉走原掉落規則並阻止過期採果／拆葉手勢。
大缸改用7顆紅磚，榨油機涵蓋12種原版柵欄混搭，補3項堆肥率及不可跳過的10-tick完成等待。
熱食比較食用開始時的剩餘效果時間；秘製串只忽略真正作者欄位及可確認的自動作者提示。
烤架出料預留相容堆疊容量，Creative刷油／調味由原作消耗規則決定。
串譜側面支撐、10×13×0.25選取框及餐盤完整方塊／桌面開關各自對照。
放置餐盤新增實際固定／秘製串模型、原作1–5份布局與四朝向；牆上串譜新增固定結果圖示、
熟史萊姆五幀及秘製串扁平後備。成功交易後有界更新，無法確認移除的helper保留配額。
來源數學與API doubles不等於客戶端驗收；手持餐盤投影與任意inventory圖示仍未閉合。

完整來源、交易界線、針對性回歸與仍未還原範圍見[G118狀態](docs/STATUS-A2.8.118.md)。
新身份不沿用舊候選的BDS／LIVE收據；完整CI與封裝、家族准入、真人接受分開記錄。

## 2.8.117：爆炸取消保存與手持營養界限

調料瓶的延後爆炸工作會再確認event仍未取消；後續訂閱者取消或event不可讀時，
保留方塊、原生容器、完整ItemStack及保存ownership，延續原目標快照檢查。
手持串提前結算在hunger寫入後重新取得saturation並尊重live effectiveMax；
刷新／寫入失敗仍完整退回食物與營養，保留一次消耗及一次效果。

包／模組／配對依賴117、guide0.3.47及兩個bridge輸出名稱同步；UUID與作者Cookery1.6.0相依保留。
18個舊草稿的已吸收差異、未完成placed／held功能及原診斷文檔集中在現有[PR索引](docs/audit/PR-TRIAGE.md)。
[修補證據與原生／client界線](docs/STATUS-A2.8.117.md)；本版沒有引入舊餐盤視覺union。

## 2.8.116：保留前方花／藤的互動目標

承接115的餐盤營養與防誤食修補，視線查詢明確保留passable block輪廓，
避免盤子在花／藤後面時攔錯目標；液體設定維持Java Fluid.NONE對應。
包／模組／配對依賴116、guide0.3.46及兩個bridge輸出名称同步。
115維持原frozen身份與失敗CI記錄，未合併／部署，不重用該身份。
[來源、界線與LIVE場景](docs/STATUS-A2.8.116.md)。

## 2.8.115：餐盤營養與插串誤食

在hunger寫入後刷新saturation並尊重原生界限，避免餐盤獎勵因舊view回滾；
仲裁盤子與item-use，防止插串後誤吃剩餘串，保留合法使用與較近entity互動。
只沿用受影響既有檢查；guide身份同步0.3.45，其他配方、UUID與現行修補保留。
[來源、證據界線及真人場景](docs/STATUS-A2.8.115.md)。

## 2026-10-08：建置、驗證與文件重整

本輪是工具與文件調整，canonical BP/RP、UUID、相依及 release-history 沒有變動；
遊戲版本保持 2.8.114，無需建立新遊戲候選或重啟 LIVE。

- 舊 A2.0 `build.py` 預設拒絕執行，必須明確指定全新、位於 Git 工作樹外的歷史輸出；移除刪除現行 gameplay_core 的路徑。現行 release 仍直接封裝 canonical packs。
- 將兩個帶主幹寫入步驟的歷史 localization workflows 移至 `docs/legacy_workflows`，不再作為 Actions 入口。66 個舊 augment 保留原版本 gate；它們仍是歷史工具，未宣稱整條舊生成鏈可隔離重建現行版本。
- 當前 CI 的同一次來源驗證只執行一次四組重複工作：熱食合併、調料原生儲存、瓶子第一人稱來源檢查、進食動畫產物檢查。只有成功且命令／目錄／環境相同的工作可重用；失敗不記錄成功。歷史獨立 verifier 保留原行為。
- README 改為現行使用入口；Java 狀態集中在 [PARITY-MATRIX.md](docs/PARITY-MATRIX.md)，具體問題在 [BUGS.md](docs/BUGS.md)。完整舊敘述留在 Git 歷史，Phase 0 報告保留原快照。
- 維護規則明訂優先重用既有檢查，本機針對性診斷、完整必要套件交 CI；新測試須有具體未覆蓋故障，文件整理不新增測試。

此重整不修復餐盤、任意食材 GUI 或完整進食聲畫，不代表 Java 一比一驗收完成。
未合併功能與調料 registry 原型保留，處置依 [PR 稽核](docs/audit/PR-TRIAGE.md) 逐項決定。

## 歷史版本

包版本的正式身份以 [release-history.json](release-history.json) 為準；
每版範圍見 `docs/STATUS-A*.md`。
[重整前 README](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/6fc3ab711e90ae9f23739b18b1f28ef5f31bbf8a/README.md) 保留歷史開發與有限驗收記錄。
不要把舊候選的測試、部署或真人觀察沿用成現行全部功能通過。
