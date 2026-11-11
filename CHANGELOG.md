# 變更摘要

## 2.8.265 原生動畫圖示側邊對齊

- 修正史萊姆串與神秘串原生圖示側面沿 X 軸反向、斜角出現交叉輪廓的問題；僅反射側面位置並調整上表面 U 方向，保留正反主面、原始貼圖、五格動畫時序、ID 與顯示姿態。相同候選的 Blockbench 原生動畫對照已檢查；未執行 Minecraft 客戶端、BDS、staging 或正式服驗收。

## 2.8.258 創造物品按用途分類

- 料理、食材、餐飲設備、餐具與食譜改放「物品」；花椒木歸建材，花椒葉與作物歸自然。同名共用分類採一致的原版圖示與繁中／簡中／英文短標籤；分類資料由 `data/creative-groups.json` 經 `python tools/build_creative_catalog.py` 重產。
- 保留原有 90 個創造項目、各群內順序與隱藏實作；只改 menu_category、原生分類表與分類翻譯。配方、metadata、ID、JS 玩法及其他資產不變。生成結果可重現且 JSON 可讀；未執行客戶端或正式服驗收。

## 2.8.257 原生物品渲染器變數預設

- `common.item_renderer` 的完整原生定義補上 `$item_collection_name` 空字串預設；沒有 collection 的原生呼叫端（背包 selected icon、箱子與熔爐產物）不再對每個狀態輸出 missing ancestor variable 警告。有傳入 collection 的畫面仍使用實際值，secret overlay、五條原生 binding 與圖層不變。
- 僅改 UI 生成器與輸出；secret GUI／素材離線測試通過。未做客戶端渲染驗收，警告是否完全消失需以實際 client log 確認。

## 2.8.256 低記憶體來源優化

- 物品與展示還原遇到既有、逐位元相同的不可變 metadata 記錄時，省去重複 world dynamic property 寫入；保留碰撞處理、lore、保存格式及舊物品可讀性。既有情境還原三欄位物品 100 次，由 300 次重寫降為 0；新值仍正常保存。
- 刪除現行調料瓶已不引用的 16 張大型舊貼圖；保留正在使用的 palette、geometry、UV 與 render controller。減少 141,184 來源位元組；88 MiB 只是被移除的未引用來源像素量，不是客戶端實測 RAM 節省。
- 封包驗證發現前版 pack.description 仍寫 Cookery 1.6.4，現已與既有 1.6.6 依賴同步。未發布的 G255 審核候選保留原基線紀錄，最終候選使用新 G256 身份。
- 既有核心玩法 682 項離線測試通過；新 BP/RP 配對身份同步 manifests、baseline 與 bridge config。範圍、剩餘記錄增長風險及驗證限制見 [低記憶體審核](docs/LOW-MEMORY-AUDIT.md)，本輪未執行 BDS、客戶端或 LIVE。

## 2.8.253 花椒木去皮保留工具附魔

- 移除花椒木去皮另行固定扣耐久的舊路徑，改用既有工具 planner；Unbreaking／unbreakable／Creative 免扣時不改手持物品，實際耗盡仍正常破損。工具與原木透過既有交易一起提交，失敗不留下免費去皮或多扣耐久。
- 把原軸向測試延伸成已註冊互動情境，覆蓋六向、雙手、最後耐久、免扣及寫入失敗重試；不增加案例數、測試檔或 CI 門檻。這是 API fixture 來源驗證，未執行 BDS、客戶端或 LIVE。

## 2.8.252 花椒葉遵守方塊掉落設定

- 修正關閉 `doTileDrops` 後，敲掉花椒葉及自然凋落仍產生樹苗／木棍／花椒。共用葉片交付 owner 保留方塊移除，依世界規則決定是否建立掉落；採果與開啟掉落時的原行為不變。
- 擴充既有花椒情境，確認關閉掉落時採果／敲葉／凋落不出物品，重新開啟後正常掉落；未增加測試案例數、檔案或 CI 門檻。這是 API fixture 來源驗證，未執行 BDS、客戶端或 LIVE。

## 2.8.251 烤架點火遵守耐久附魔

- 修正打火石點火固定扣耐久、忽略 Unbreaking 的差異。原工具 planner 依原生傷害機率準備扣損，保留 Creative／unbreakable 免扣與工具／烤架交易；附魔成功保護時不重寫手持物品。
- 擴充既有點火情境，不新增測試檔或檢查門檻：驗普通扣損、耐久附魔保住最後一點、實際扣損時破損，以及既有音效／重複輸入／交易失敗行為。這是 API fixture 來源驗證，未執行 BDS、客戶端或 LIVE。

## 2.8.250 調料瓶灑料保留文字

- 修正非末次灑料時整段覆寫調料瓶 lore。烤架 owner 沿用現有 helper，只更新剩餘次數，保留自訂文字、翻譯訊息與食材提示；用量、配方及最後一次換新空瓶遵循 Java 原行為。
- 既有測試新增同一瓶 EMPTY→加料→PENDING→搖勻 80 tick→SPECIAL→16 次刷油／翻面／灑料／取串流程，覆蓋跨剩餘量外觀與原生可讀 metadata。這是 API fixture 來源驗證，未執行 BDS、客戶端或 LIVE。

## 2.8.249 裝滿料理架重新放置

- 修正料理架互動只接收既有架子方塊，導致點支撐方塊放置時跳過內容／篩選復原。既有 owner 同時接收料理架物品的放置意圖，並於延後復原前確認沒有被取消；不新增監聽或保存格式。
- 現有玩法測試覆蓋六個放置面、命名／附魔／耐久與其他物品資料、再次拆下及保存 payload 在新 runtime 中讀回，另驗取消與重複事件。沿用原 #382 head 的隔離 BDS 1.26.60.6 實測向上原生放置、後置取消與同世界磁碟重啟；[範圍與來源](docs/PARITY.md#裝滿料理架重新放置)分開記錄，不宣稱完整 main／家族、客戶端或 LIVE 已驗收。
- 與已合併的 G248 語系來源合流，改用全新 G249 配對身份並更新基線；原 G248 草稿的歷史雜湊保留，不把舊原生結果改標成 G249 整包驗收。

## 2.8.248 包資訊多語與指南名稱填充

- manifest name/description 改用 `pack.name`/`pack.description` 多語鍵；BP 補上缺失的 `texts/*.lang` 與 `languages.json`。
- 指南 payload 的 `names` 欄位從 entry title 自動填充缺項，check 與 test 驗證完整覆蓋三語。
- bridge_project.py 更新斷言接受多語鍵並驗證 lang 檔；版本號 2.8.247 → 2.8.248 同步 baseline、manifests、configs。

## 2.8.245 普通提示略過進食HUD圖層

- 把原base圖層已有的ignored條件放到單一內容群組，普通actionbar、其他addon訊息與END略過圖層。保留輕量packet、原factory替換及0.2秒到期，避免改變清場；全部原圖像與位置、有效G進食packet及BP發送皆保留。
- 入口情境讀實際UI式並呼叫正式formatter，確認一般訊息／END隱藏、有效進食保留；僅模型邊界證據，未量測native UI建構或FPS，不把這項來源修正稱為全程卡頓已解。

## 2.8.244 根節點略過草稿（未採用）

- 已凍結但未發布／部署。為保留原factory每筆訊息替換舊packet的清場路徑，未採用根節點ignored；由G245改在內容群組略過。原身份與history保留，不重用版本。

## 2.8.243 原生物品圖示基底與秘製圖層成本

- 修正共用item_renderer同名定義漏掉type、renderer及native bindings，導致一般背包、快捷列與bundle圖示連鎖失效。從固定Mojang參考保留原生基底；不修改物品或雙手操作。
- 每slot八份always hover收為一份visible binding，以原生collection factory配置僅標記串建立秘製圖層；拆短重複的texture expression，Java原貼圖不變。生成資料回歸與既有庫存／穿料情境通過，尚無部署後client讀回或實測FPS，詳見PARITY。

## 2.8.242 平凡串的圖騰繞過

- 原平凡串owner只將傷害cause由override改為selfDestruct；Float.MAX_VALUE、延後排程與既有無敵／重金屬入口不變。保留G240冷菜修復與G241餐盤姿勢，不重用舊草稿G240身份。
- BDS1.26.60.6真Player兩次各100tick原生食用完成、扣1份後，無Heavy死亡但圖騰未耗／無治療；有Heavy先付款再救1HP且保留圖騰。12項窄檢查通過。首場漏帶既有進食variant的fixture錯誤另保留，詳見PARITY；未證護甲／抗性繞過、部分盾或完整Java parity，尚未隨家族部署。

## 2.8.241 餐盤第一人稱姿態來源

- 承接已確認的 #333 Blockbench 姿態，僅變更左右第一人稱的 position／scale；旋轉、第三人稱、幾何、餐盤食材配置與互動不變。
- 保留可重現的來源推導與唯讀檢查，明確區分舊宿主校準、編輯器預覽與尚未觀察的現行引擎畫面。本次未部署。

## 2.8.240 涼拌折耳根交付與空壺資料

- 原成品寫入／掉落已套用後拋錯時，會再丟一份。製作owner改用既有交易與成品planner，確認回收後才退款，未知drop不重發；最後三根釋出的格子可接成品。配方、油量與既有雙手操作不變。
- 油壺耗盡跨ID時保留本包可讀DP，仍退役已知舊油鍵。93項來源／油流程與新原生25＋同QA重啟4通過；最小外部pot內容、函式測試、API故障與未觀察的實際輸入範圍分清，詳見PARITY。

## 2.8.239 逐串秘製串背包圖示來源

- 既有進度行附純顯示快取；每slot JSONUI按該串三食材、GUI variant及生熟選取Java原圖層。保留雙手逐次穿料、原ID、64堆疊與完整metadata；視覺cache不改變重複食材判定。
- 正式main庫存／穿料及既有快照88項通過；兩Java原合成器各5400組像素相同；原生setLore/getRawLore、庫存事件、換槽、chest及同QA重啟30項通過。真client的每slot binding及畫面未觀察，完整範圍查PARITY，不稱完整GUI等價。

## 2.8.238 原生圖騰先於重金屬

- 合適傷害下，主手或副手的真原生圖騰先處理；只有成功TotemOfUndying治療才沿原入口清理效果。背包圖騰、虛空及強制傷害保留原重金屬處理，包含Java明確繞過圖騰的平凡傷害。
- 正式main事件35項與BDS1.26.60.6新窄原生39項通過；普通圖騰實際先耗、真治療清效果及Heavy後備救援成立。override/maxfloat無Heavy耗圖騰仍死亡的control差異保留於PARITY；部分吸收盾漏救仍未修，不改保存格式或新增玩家屬性。

## 2.8.237 手持快照提交失敗後恢復舊內容

- 新generation提交失敗後，即使兩手已換回上一次成功內容，仍由原publisher補送目前完整快照，避免原生frame與舊packet不相符；成功後恢復原去重。property schema、物品metadata與24個內容word格式不變。
- 正式staged-owner／publisher及延後property模型覆蓋submit前失敗和套用後拋錯，並執行生成請求核對晚到packet拒絕；不是BDS自然故障或客戶端renderer通過。

## 2.8.236 溫暖按 Java 扣減前時長處理

- 依 Mojang 1.20.1／1.21.1 的效果 tick 順序，在期限剩餘時間補回本 tick 的一格，再判斷 Java 每20tick回復點；涵蓋效果第一tick、續期及同一保存期限在process重啟後的時機。保存格式、熱源與回血量不變。
- 12項真main情境通過；原G234在新增的第一tick／保存重載／續期三項失敗。本次時機的原生及正常重啟尚未驗證。G234熱源15項原生觀察獨立保留，不改標成新時機通過。

## 2.8.235 剩餘期限時機草稿（未採用）

- 第一版直接用deadline減目前時間，漏掉Java先觸發再扣duration的順序，未獨立合併或部署；身份與來源指紋保留，由G236在同一owner改正，不重用已凍結版本。

## 2.8.234 溫暖效果辨認原生熱源

- 熄滅營火不再提供回血；辨認燃燒熔爐、已亮紅石與原生 lit 狀態，保留火／岩漿和既有烤架。範圍、每次回血量、下界 fallback 與保存格式不變。
- 真 main 的熱源切換及回血邊界情境通過；本次原生引擎與客戶端熱源操作尚未驗證。同步計畫中已退役的存檔鎖／PR 棘輪與已授權宿主適配規則，沒有新增護欄。

## 2.8.233 圖騰效果清理與 G232 主線整合（候選）

- 將 G230 的已確認圖騰清理整合至 G232；16 種已核對可治療效果、待結算撤銷與龍血事件前綴修正維持原樣，並保留已合併的餐盤、冷態提示與油機登記功能。
- 保留兩邊全部既有版本身份，同步新的 G233 配對。仍為來源候選，部分吸收盾漏救與重金屬搶先原生圖騰未修正，不宣稱原生、客戶端或 LIVE 驗收。

## 2.8.232 油機登記與冷態提示主線整合

- 將 G228 油壓機登記確認整合至 G231 冷態提示與餐盤來源；三項功能來源保持不變，保留各版既有身份並同步新的 G232 包配對。

## 2.8.231 冷態提示與餐盤主線整合

- 前向整合已合併的 G225 餐盤修正與 G226 冷秘製串提示；兩邊功能來源不變，保留既有版本身份並同步新的 G231 包配對。

## 2.8.230 確認圖騰治療後清除 Java 預設可治療效果（候選）

- 擴充同一個成功圖騰事件路徑，清除 Java 已核對的 4 種煙火與 12 種 Cookery 效果及其隱藏層；保留不可治療中毒、重金屬 claim 與未知名稱的效果。
- 保存移除確認後，請求既有原生生命群組重設、停止麻痺姿勢。成功圖騰訊號也會撤銷較早的龍血待補生命與彈射物閃避結算，不因效果剛過期或清除保存失敗而補血或補傳送。修正龍血錯用不存在的事件前綴欄位，改用既有正確常數。
- G227 身份與雜湊保留不變。部分吸收盾漏救、重金屬搶先原生圖騰仍未修正；情境僅驗證 API 邊界、保存資料與清理請求，不宣稱原生順序、生命上限、客戶端姿勢或磁碟重啟已驗收。

## 2.8.228 油壓機待完成登記的寫入確認

- 沿既有 registry owner 確認逐台登記、移除與舊陣列遷移的讀回結果；未確認前保留舊資料，不提交未登記的完成進度。
- 寫入後拋錯時重新載入登記，避免交易回滾誤信快取、漏掉重啟後的待完成批次。保存鍵、格式、排程與油量不變。
- 實際 runtime 的 API 替身情境覆蓋失敗、回滾、重新載入與一次交付；未進行原生存檔、BDS 或客戶端驗收。

## 2.8.227 確認原生圖騰治療後的重金屬清理（候選）

- 只在原生 `TotemOfUndying` 成功治療事件後清除重金屬，保留中毒、claim 與其他效果；一般治療、零治療或單純換手不視為圖騰成功。
- 撤銷同實體較早排入的重金屬生命寫回，避免覆蓋較新的原生圖騰生命結果。
- 致命傷判定及取消決策不變；部分吸收盾漏救、重金屬搶先圖騰兩個既有缺陷仍未修正。來源情境通過，不宣稱原生圖騰順序、存檔重啟或客戶端驗收。

## 2.8.226 手工秘製串的冷態提示

- 冷的秘製串顯示 Java 的「生／熟」，加熱時隱藏；食材名稱仍依原始穿入順序，保留數量、變體及外來資料。舊串沿既有按需提示流程補齊，不新增物品身份或全域計時器。
- 進食與待執行手部操作期間延後提示改寫；完整 lore 優先保留外來行與公開／私有資料載體，避免冷卻重試或重複更新。
- 每 stack 的背包／快捷欄圖像合成仍未實作，#166 保持開啟；此為文字提示修正，不宣稱原生畫面驗收。

## 2.8.225 放置餐盤與搖瓶資料保存（整合候選）

- 前向整合 #350 的搖瓶資料保存與目前 main；餐盤模型、貼圖路由、布局與既有手持姿勢不變。
- G222 曾被兩個分支重複使用；本分支保留 main 的 G222 與既有 G224 歷史，原餐盤 G222 保留於 commit `65f14b094d9f1e55dd6729a137d93de10756f4d4`，不改寫或重新發布舊身份。合併內容使用新的 G225 配對。

## 2.8.224 放置餐盤普通串（整合候選）

- 保留 G221 重金屬修正，整合 G222 完整普通串餐盤模型；保留兩份既有版本歷史並同步新的包配對與雜湊，餐盤功能不變。

## 歷史餐盤候選 G222（身份衝突，已由 G224／G225 取代）

- 普通串改用獨立的完整 19-cube 餐盤模型與原作材質，保留五份布局、四朝向、秘製／特殊混盤及既有史萊姆索引；不改手持餐盤姿勢。

## 2.8.222 搖瓶完成時的額外資料保存適配

- 接續原 PR350，搖勻待完成調料瓶後保留 API 可見的名稱、外來 lore、物品旗標、Adventure 限制與動態資料；煙火自己的剩餘次數、配料提示與隨機外觀仍正常更新。
- 轉換／寫入失敗時保留目前的原生待完成瓶，避免回滾到過時的公開資料。此為擁有者資料保護要求的額外適配；Java 原作本身建立新瓶，不把它算成 Java 缺口修復，也不宣稱能跨種類保留未知 NBT 或其他包私有資料。
- 隔離模擬玩家的原生80tick搖瓶、成品入箱及同世界正常重開已核對；一般玩家副手啟動、客戶端聲畫與完整家族部署仍是不同範圍。

## 2.8.221 重金屬到期時的保命結算

- 重金屬只剩最後一 tick 時，致命傷不再因下一 tick 清理過期效果而漏掉結算。取消傷害前就消耗重金屬並寫入 10 分鐘中毒，下一 tick 設為 1 點生命並播放回饋。
- 未取消傷害的寫入／排程／取消失敗會恢復原效果與 claim。事件測試及 BDS 1.26.60.6 的受傷回呼寫入、生命值、同世界重開通過；圖騰／吸收生命競合與客戶端聲畫仍未完整驗證。

## 2.8.220 料理調味聲音

- 炒鍋與湯鍋調味成功後，改從玩家所在方格向附近玩家播放聲音，使用玩家音效類別，對應 Java Forge／NeoForge 1.1.1 的 0.85 音量與 1.0 音高；烤架仍使用方塊音效類別。
- 沿用既有聲音樣本、調味交易與保存資料。事件測試覆蓋成功、最後一次使用及取消／失敗時無聲；實際響度、距離衰減與音量滑桿尚未確認。

## 2.8.212 原生查缸與交易修正（候選）

- 油壓機以原生 POI 查附近大缸，移除 405 格逐格掃描；依 Java 的 z/y/x 次序選缸，保留 X/Z±4、Y±2 範圍。需要 Beta APIs 與 Points of Interest。
- 損壞的缸資料不再當成空缸；寫入未被引擎確認時保留原批次，避免沒有交油卻付出油渣。
- 從已發布 G208 接續，保留其 UI／宿主修正與版本歷史。原生交易、完整家族存檔、真人與多人效能各自驗證，尚未宣告完整還原。

## 2.8.206 四格手持顯示與玩家相容來源（未發布）

- 雙手 24 字外觀改用完整快照，玩家宣告由 27 減至 4；保留兩個完整進食時計、五串餐盤／三格秘製食材及全部物品 metadata。所有顯示 owner、失敗重試、重入補送與每 tick 動作共用既有排程。
- 自有 player extension 套到選定的完整宿主定義；固定 TACZ 原包的合成器保留 24 欄與槍械路由，兩包合計 28。公開來源不含完整宿主／TACZ 作者檔。
- 依已公開的左右手相機模型重算 FP 位置，保留模型大小、轉角、TP 與容量；幾何預覽／來源測試不是實機畫面證明。
- 正式整包、保存／回退、進食／聲音、多人、TACZ 與效能出口仍按 [T3.5](docs/REBUILD-PLAN.md#t3-5-property-slimming) 驗證；尚未部署或發布。

## 2.8.203 玩家動作屬性瘦身（未發布）

- 六個進食／撒料／搖瓶狀態共用一個動作字，玩家屬性由 32 減至 27；24 格雙手外觀與兩個 0–72000 計時欄保留。
- 共用寫入者保留同 tick 更新與失敗重試；RP 由同一 schema 產生解碼，物品 metadata／ID／UUID 不變。
- 完整家族、存檔與實際客戶端驗收另行記錄；27 格仍不足以宣稱 TACZ 相容。

## 2.8.201 原生合成退桶與指南傳送減壓（未發布）

- 修正 BDS 1.26.60.6 拒絕秘製辣椒油任意排列配方輸出兩種物品：配方只輸出油桶，原生合成完成事件按實際產量退回空桶；滿背包沿既有路線掉在玩家旁。四種材料與產量不變。
- 空桶回到背包／地面，與 Java 留在合成格的位置不同；此適配與真正客戶端合成驗收仍分開記錄。公開宿主 SDK 配對升至 0.2.15。
- 指南每 tick 最多傳 2 包；最大 514 包仍在接收端 600 tick 時限內送完。真實 runtime 交易及協定回歸通過，完整家族、存檔與真人複驗待完成；`client=false`、`production_ready=false`。

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
