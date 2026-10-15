# 煙火目前缺口與待重現問題

Phase 0 原始稽核基準：2.8.114／`6fc3ab711e90ae9f23739b18b1f28ef5f31bbf8a`；目前維護來源2.8.142，更新2026-10-15。
本頁不把「缺證據」全部當作已證實程式 bug，也不把舊候選觀察沿用成現行驗收。
G116承接餐盤營養界限與防誤食；G117修復瓶爆炸取消及手持提前結算界限。
G118補本日一比一稽核的核心、農業與容器機制差異；完整逐項狀態見[G118](STATUS-A2.8.118.md)。真人驗收仍待完成。
G119補手持盤及植物／效果提交；[G120](STATUS-A2.8.120.md)續修持久 claim、瓜梗與料理出料守恆。
[G121](STATUS-A2.8.121.md)的正式酒館指南橋接保留；先前未合併機制候選移入 G122。
[G122](STATUS-A2.8.122.md)接通三道炒鍋備料／三翻／品質，增補紅樹與寫入所有權；具體原生操作與真人驗收仍按版本記錄保留範圍。
[G123](STATUS-A2.8.123.md)修復原 Cookery 1.6.0 的三語正文鍵拒絕；[G124](STATUS-A2.8.124.md)修復調料資料重新載入。家族目前的 LIVE 配套、部署／保存／指南接收收據見[家族基線入口](https://github.com/casama233/kaleidoscope-tavern-unofficial/blob/main/family/BASELINE-STATUS.md)；家族載入及資料接收不補成食用、鍋具或客戶端操作驗收。
現況總表見 [PARITY-MATRIX.md](PARITY-MATRIX.md)，工具變更見 [CHANGELOG](../CHANGELOG.md)。

## CLIENT-HUD：食用入口、圖形缺失與延遲

**狀態：保留真實失敗；G138／G140–G142 修補已遠端合併及部署，最新客戶端延遲和完整操作仍未驗收。**

| 玩家觀察（2026-10-14） | 已進 canonical 的修補與目前界線 |
| --- | --- |
| 原生 HUD、Java Saturation 和魔法模組的 Java 飢餓 UI 正常，森羅 UI 完全沒出現；多次分層及普通標題測試仍回覆沒有出現。 | G137 恢復原生 Actionbar factory；後來截圖仍見 `KT_HUD!S:…`／`KT_HUD!END;` 原始資料碼，否定了當時已恢復的說法。家族 host 的掛載與自有資料碼隱藏由私有整合承接；不能單靠伺服器送出成功判斷畫面。 |
| 按住串完全沒有進食動作。G138 後「使用物品」按鈕已出現，早期數量變動本身不足以證明動畫恢復。 | [PR205](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/205) 新增食用串原生觸控入口；後續截圖 76212／76213 已見進食姿勢，串數量從 46 到 45，但沒有因此接受全部食品、主副手、取消／連吃或各平台。 |
| 後續截圖看得到進食條與調酒色塊，但回報位置不對；76251 又回報進食條延遲很大。 | [PR206](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/206) 的 G140 修正進食錨點、觸控上移 26 邏輯像素與完整 END 隱藏，Desktop 保留 Java 座標；[PR208](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/208) 的 G141 按原生 `itemStartUse.useDuration` 剩餘 ticks 對齊並同步發首幀，其後每 tick 更新。調酒位置另由 Tavern T165 修正。沒有證據認定這已解決所有秒級延遲。 |
| 雪克杯按很久 UI 才出現，整體性能仍差。 | [PR209](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/209) 的 G142 以 `ignored` 跳過未選進食圖像；保留 native packet／容量／過期、素材、布局及結算。Tavern T166 另有預覽快取與調酒圖形裁剪。來源投影不是實測配置數、FPS 或延遲，最新真人結果仍待取得。 |

G142 的 source／Windows export CI、完整家族停服存檔副本 first／restart、准入及 LIVE 讀回已通過；正式 `A2.8.142` 已發布，公開下載與 LIVE 內容一致。這些證據沒有覆蓋最新客戶端實際手感，維持 `client=false`、`production_ready=false`、`pending_client_acceptance`。使用者已要求停止畫面探針及反覆索取測試，本次同步沒有再發送探針，也沒有使用模擬玩家。後續回報應直接承接本節，不把先前失敗改寫成成功。

## GRILL-DEFERRED-OWNER：取消或替換後誤拆烤架

**狀態：G125 已修復來源路由，並有原生事件／API 窄診斷；完整拆爐與玩家驗收保留。**

G124 先排程後直接 customBreak，較後 listener 取消爆炸仍會清除站點。G125 延後重讀 cancel，並核對 type、permutation、owner、完整物品及語義狀態；正常計時不阻止合法拆除。before 階段只 clone，完整 restricted metadata getter 改到 deferred。原生 BDS 1.26.52.3 的四個事件診斷通過，但使用 vanilla chest 作庫存 fixture，沒有 full customBreak／玩家／家族驗收。[G125 詳細邊界](STATUS-A2.8.125.md#烤架取消與延後目標)

## ITEM-DELIVERY：榨油機延後扣料與滿背包拒絕

**狀態：G125 已補站點身份、原生交付讀回及持久隔離；玩家完整操作待同候選復驗。**

榨油機延後點擊若遇方塊替換，G124 可能先扣油渣才發現目標失效。現在在扣料前核對 instance／前像；只恢復自己的写入。原 Java `placeItemBackInInventory` 可將剩餘物落地，G124 串譜／穿串／拆串卻會因滿包拒絕。G125 共用扣料後的插入／剩餘掉落 planner，保留完整 metadata；產物收回未確認，不退回原料或覆寫外來槽位。[G125 操作範圍](STATUS-A2.8.125.md#操作交易與滿背包)

G125 同時修正亮度、Numb 速度及可用場景聲畫路由；native inventory 圖示、秘製串 HUD 色彩通道、準星偏移等缺口仍見 [場景與介面限制](evidence/scene-visual-repair-20261009.md#investigated-surfaces-that-remain-incomplete)，沒有將適配聲畫改標為一比一。

## SEASONING-DATA-RELOAD：調料准入與效果寫死

**狀態：G123 的來源差距已由 G124 修正；明確 provider、原生玩家流程與真人效果驗收限制保留。**

原 Java 的 `GrillingDataManager.apply` 從預設調料映射合併各資料根；`isSeasoningIngredient` 與 `seasoningCount` 在使用時讀目前映射。G123 的取料准入與食用計數卻讀固定 `SEASONING_KINDS`，無法接受新映射或讓已存食物遵循 reload。

G124 以單一自有 resolver 提供預設及當前映射，取料、效果與既有 HUD 共用；移除 main 的另一份硬編碼計數。明確的 `replace_seasoning_data` 經現有 Server-only integration API 與登記保存交易接收有序資料根，舊 v1 存檔保持可讀。後根覆寫、錯誤根不留部分更新、保存後拋錯會恢復記憶體及持久資料；未知 kind 不附加效果，三個 base ID、8 格及16次用量不變。

既有 integration／食用 production consumer 回歸核對保存重載、寫入故障及已存 ingredient IDs 的效果變更；沒有新增組合矩陣或模擬玩家。原未合併 `grilling-seasoning-registry-20261008` 工作區保持，G124 只承接經當前 Java 原碼核對的必要自有邏輯。此介面不自動讀 Java datapack，不代寫 Cookery 的私有 producer。[使用契約](BEDROCK-INTEGRATION-API.md#調料資料重新載入)

## SKEWER-GUI：任意食材秘製串 inventory icon

**狀態：使用者有失敗觀察；現行來源缺動態 GUI 投影，当前候選仍待 client 複驗。**

重現：用未完成串手動穿三份胡蘿蔔，分別查看未完成與完成串的背包 icon。
比較其他食材及 raw/cooked／variant，確認 inventory icon 是否仍只呈現通用空串。
不要用手持 geometry 或進食模型替代 inventory 觀察。

Java 預期：GUI 依三槽實際食材、狀態與 variant 合成原作圖像。
當前三份相同食材可以完成秘製串、未完成空串可堆疊不是這個 defect。
來源與入口：[issue #166](https://github.com/casama233/kaleidoscope-grilling-unofficial/issues/166)、
[現行 GUI 邊界](CUSTOM-SKEWER-INVENTORY-RENDER-LIMITS.md)、`tools/java_custom_skewer_gui.py`。
Python 原作參考圖像存在，但沒有證明 native inventory 路由完成。
此項與固定牛肉串的靜態 icon 分開驗收。

## SEASONING-FLOW：自填瓶取回→搖勻→撒料

**狀態：舊 LIVE 候選有失敗；G114 RawMessage／材料數修補已部署，完整實際操作尚待複驗。**

重現：在一個新瓶放入 Java 必要 base 材料（green chili powder、Sichuan pepper、onion powder），
取回同一瓶，記錄材料數與 PENDING；在空氣中持續使用 80 ticks／4 秒，
確認成為 SPECIAL，然後對有一串、可調味的烤爐撒料。
全程保留同一瓶，記錄剩餘 uses、食材資料、背包／手持／放置畫面。

Java 預期：EMPTY→PENDING→80-tick held-use→SPECIAL，成功調味才消耗該瓶的 use，
不得為了讓流程成功而改配方、即時轉換或清除原材料。
來源：[issue #168](https://github.com/casama233/kaleidoscope-grilling-unofficial/issues/168)、
[PR176](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/176)、
`main.js` 的 `refreshBottleIngredientLore`／`warnMissingSeasoningBase`／取瓶與 seasoning handlers。
失敗的舊瓶如何編碼已被保留為來源回歸案例；本輪没有再做真人操作。

## SEASONING-EXPLOSION-CANCEL：後續取消爆炸仍清除瓶與內容

**狀態：G116來源可重現；G117已在延後結算前確認取消狀態，未沿用舊候選的原生／client驗收。**

重現：放置含自訂名稱、外來metadata與材料的調料瓶，讓原生爆炸before-event先經過瓶handler，
再由較後訂閱者設 `cancel=true`，最後執行已排程工作。
G116仍把瓶變成AIR、清除native容器與兩筆保存資料，沒有掉落。

`scheduleNativeBottleExplosion`現在與既有餐盤路徑一致：延後工作只在 `cancel===false` 時繼續，
取消或讀取event失敗均保留方塊、完整ItemStack與原有ownership；既有目標／owner快照檢查保留。
原本未取消爆炸的Java毀損與不掉落行為不變。
既有 [native-storage API回歸](../development/gameplay_core/test_seasoning_native_storage.mjs)新增一項具體故障案例，
直接執行production函式並核對完整瓶資料、容器identity與保存記錄；這是B，並非BDS或真人爆炸操作證據。
此次runtime變更使用新的G117identity；完整家族准入另行記錄，不能重用G116包證據。

## PLATE-SATURATION：餐盤營養寫入使用舊飽和度界限

**狀態：G116已承接營養窄修補；production函式回歸通過，受影響Player／client待LIVE復驗。**

重現參數：舊 native trace 中 hunger 10→13 寫入成功後，cached saturation view 的 max仍為10，
後續寫入12.353846153846154造成 `ArgumentOutOfBoundsError`，交易退回食物與營養。
在獨立当前候選重現同一飢餓／食物與原生界限條件，觀察吃餐盤是否成功或被回滾。

Java 預期：完成食用後按食物資料加飢餓與飽和度，且只結算一次；
原生寫入失敗則完整回滾，不可吞物品、虛構 attribute max 或丟失應有增益。
G116 的 `addSecretNutrition` 在 hunger 寫入後重新取得 saturation，尊重 live effectiveMax；
刷新／寫入失敗仍回滾，沒有導入舊餐盤union。[修補範圍與LIVE場景](STATUS-A2.8.116.md)；
[PR148](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/148) 保留原故障與來源。

## HANDHELD-SATURATION：手持串提前結算沿用舊飽和度界限

**狀態：G116的餐盤修補沒有覆蓋這條手持路徑；G117已修正production結算，實際Player／client仍待復驗。**

重現：hunger=10、saturation=10，手持兩份熟牛肉串，在25-tick checkpoint後停止使用。
使用餐盤G116回歸已有的native captured-cap模型，舊 `hungerSettle` 先讀取cap=10的saturation view，
再將hunger提高至15並用舊view寫saturation=15，導致整筆交易退回10／10且不消耗、不給效果。
hunger=10、saturation=2的對照則可以成功，說明不是所有提前停止都失敗。

現在hunger寫入後才重取saturation component，在其即時effectiveMax內完成原配方的營養結算。
取得或寫入失敗仍回復完整食物與原hunger／saturation；不修改份數、25-tick checkpoint、
熱食倍數、一次結算、原生完整食用或既有餐盤路徑。
[實際handler回歸](../development/gameplay_core/test_eating_native_completion.mjs)涵蓋新cap、較低有效cap、
metadata保留、重複stop／complete不再扣料，以及refresh／寫入失敗回滾。
這是production函式與API模型的B；不是新的真人飢餓值或原生食用事件觀察。

## PLATE-USE-ARBITRATION：點餐盤時意外食用手持剩餘串

**狀態：G116已承接block／item-use仲裁；原生輸入次序與client仍待LIVE復驗。**

重現：手持多份可食用串，對餐盤進行正常插入；停止操作後觀察手持剩餘數量、hunger及延遲吃的動作。
另做空氣中合法食用、其他方塊與取消操作控制組。

Java 預期：成功餐盤互動遵守 block／item use 次序，不額外啟動獨立的 air-eating 或扣另一份食物。
G116 `a25_plate_recipe_runtime.js` 已承接
[PR150](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/150) 的窄防誤食路由，並核對較近entity，
保留合法air-use與潛行副手例外。實際Player／client驗收仍獨立，見[G116場景](STATUS-A2.8.116.md)。

## PLATE-PLACED-DISPLAY：已放置餐盤缺完整內容投影

**狀態：G118新增專用來源實作與回歸；本候選原生／client復驗待完成。舊原生候選的 tiny-edge-pixel／朝向問題保留其原身份。**

重現：餐盤插入普通熟牛肉串與秘製串，按1–5份、四朝向放置；
立即查看、取出一份、再載入區塊，記錄是否顯示完整串及原作布局。
Java 預期：顯示真實內容、對應布局與 source FIXED transform；成功交易後更新一次，失敗不改顯示。

G118的`plate_recipe_visual_core.js`及`plate_food_visual`讀取目前保存的固定／秘製串，
共用現行烤架mesh與palette，按原作布局、FIXED變換及四朝向定位。成功交易後排入有界更新，
只有確認helper移除後才釋放配額；重載重新從保存資料索引。普通／外部物品仍有明列後備路徑。
source／API doubles不能接受原生畫面；實際四朝向、1–5份及重載需重測，見[G118](STATUS-A2.8.118.md)。

歷史來源分散在 [PR146](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/146)、
[PR147](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/147)、
[PR149](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/149)、
[PR152](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/152)。
本次保留當前 palette、ownership 和後續修補，未用舊發版 artifact 覆蓋。

## PLATE-HELD-CONTENTS／DECODE：G119 手持盤來源實作，原生待驗

**狀態：G119 已新增 canonical reader、共享通道、獨立 count 與專用手持模型；本候選原生／真人畫面仍待接受。**

重現／驗收：普通熟牛肉串與不同秘製串分別裝成 1–5 份，主副手同時拿盤或另一手拿瓶／秘製串；
確認順序、顏色、份數、切槽、重新登入及其他玩家視角。Java 預期是每槽實際內容與對應布局。

G119 直接讀取保存 envelope；每手既有 12 個欄位由單一 writer/cache 仲裁，
每份以兩個小於 2²⁰ 的 word 傳輸，份數獨立 0–5，沒有把舊 +0.5 貼到不存在的 decoder。
手持與放置的 FIXED 旋轉分開，完整路徑與限制見 [G119](STATUS-A2.8.119.md)。
未對應的外部模型保留原槽位與資料；這些來源檢查不等於實際客户端正確。

舊 G95 的 stored1／4→0／3、tiny-edge-pixels 與 secret-alt 空顯示保留原候選身份。
[PR153](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/153)及
[PR164](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/164)等原型／診斷未整包導入，
其舊原生觀察不能接受本版的新 transport 與姿態。

## HEAVY-METAL-COMMIT：保命效果提交失敗仍可能改生命

**狀態：G119 修正來源結算，G120 加入取消之前的持久 claim；死亡／圖騰及吸收值能力仍未完全等價。**

G118 的 deferred 救命依序呼叫 fxClear／fxSet，兩者吞掉 effect writer 的例外，
可能在效果尚未消耗時仍把生命設為 1 或播放聲音。排程拋錯還可能保留 pending。
G119 成功排程後才取消；一次轉移效果並核對 fresh 前像／實際 raw，再確認生命寫入。
已保護但結果不明的相同效果保持隔離；不重播傷害或盲目退還保命。

仍需驗證：本候選的原生傷害、後續 addon 改寫、圖騰競合、部分吸收盾、效果保存與真人聲畫。
G120 先寫入並讀回實體自己的 claim，再排程及取消；現有 leave／remove hooks 不清除它，
所以同 until／amp 不因 map 重建而再救一次。取消明確未發生時才可復原自身前像。
原生重登／存檔重啟尚待驗；API 讀回不代表磁碟 flush，任意 crash 原子性仍未成立。
詳細 [API 與來源邊界](evidence/heavy-metal-and-inventory-api-20261009.md)。

## OIL-RESIDUE-PLANTS：明列 25 植物，通用骨粉仍未完成

**狀態：G119 新增 10 種並保留原 8 種，G120 再補 5 種，G122 再補 2 種；沒有假設所有 growth 狀態具有相同成熟值。**

新增可可、甜莓、粉紅花簇、無果洞穴藤、四種雙高花及短草／蕨，
兩次作用只扣一次，花卉掉落與完整上下半進入同一交易及恢復邊界。
甜莓的非潛行主手採果、潛行／副手施肥按 NeoForge 1.21.1 呼叫鏈處理，Forge 差異明列。

G120 補西瓜／南瓜梗剛成熟當次的結瓜 RNG、光照／耕地／鄰株、單方向及果實先於附著梗；
纏根土只對下方空氣生根。已成熟瓜梗不再施肥，所有已讀鄰位及雙光照值在扣料前重驗。
光照組合是有來源推導的有限適配，原生夜間／天氣及鄰居更新尚未認證。
兩種下界藤按連接方向尋末端，完整使用原版長度概率，第二次作用沿第一次虛擬结果尋新末端；
age25 仍可施肥，未知 chunk／高度中止整筆。
G122 增加紅樹葉下方乾燥空氣生苗、乾燥懸掛胎生苗 stage 0–4 成熟；不把第二次作用改點新苗，水浸或地面苗不扣料。
另修 journal 的實際 setter 進入點、槽位原生身份與掉落移除確認；任何方塊／掉落回復未知，均不退成本。
完整範圍見[紅樹與所有權證據](evidence/mangrove-and-fertilizer-ownership-20261009.md)。
仍需適配：甜菜中間年齡、竹子stage、海帶液體層回滾、其他feature及外部植物；
還需本候選正常玩家施肥／採果、上下半、掉落與重載驗收。
具體來源、ID/state映射與未知結果處理見 [植物證據](evidence/vanilla-plant-fertilizer.md)。
本輪增量見[瓜梗與纏根土](evidence/stem-and-rooted-dirt-fertilizer-20261009.md)與[下界藤／海帶邊界](evidence/nether-vine-fertilizer-20261009.md)。

## JAVA-POT-LIFECYCLE：三次翻炒、備料時鐘與料理品質

**狀態：G120 已查清而未實作；G122 接通三道料理的有界來源流程，原生／保存世界／client 尚待驗收。**

新鮮空鍋在實際作者 registry 接受三道原配方後，保存 1200 tick 備料、第一鏟啟動 200 tick 並算第一翻、
三翻不足的可疑炒菜、800 tick 成品及 400 tick 黑暗料理，最後保存一次 1–3 木炭並清鍋。
備料加取料不重開時鐘，烹調鎖定普通材料；無热源／未載入不補算時間。
舊 ACTIVE／RESULT／BURNT 仍按原流程取完，不能捏造舊 preparation time 或改變既有 input ownership。
其他作者配方交回 legacy；本版並非整個 Cookery 的全面流程替換。

Flex 保留原作按 Item 去重、一對一九槽匹配、exact 優先及固定 1 份輸出。
世界種子以 signed-long 字串計算原 recipe 品質；兩分支未修改原 Java 純邏輯的 1,248 品質觀察及
12 組 NeoForge 原食物值與自有 core 相符。這是有限 A，不是完整 PotBlockEntity 或引擎玩法 trace。
十二個內部原生 food 變體負責品質營養；public quality、冷卻、合併、成品快照與食材投影共同保存。
原生食用前驗 ID／payload，熱食與調味另要求唯一匹配的開始／完成會話，不以重複完成手動補發品質營養。

仍需完成：真鍋加油→備料→三翻→碗取出，無熱源／卸載／重啟，冷卻與兩手連吃、滿包／拆鍋／保存失敗，
以及真飢餓／飽和、動作音效與普通原料限制的使用者驗收。未知或不可原生比較的私有物品資料保留不扣，
不猜序列化。Forge 食物 modifier 與 NeoForge 恢復值差異已列明，当前以維護中的 NeoForge 為目標。
詳見[G122](STATUS-A2.8.122.md)、[品質與食物值](evidence/cuisine-quality-native-food-20261009.md)；
[G120 原始規格](evidence/cookery-flex-pot-lifecycle-20261009.md)保留當時「尚未實作」的歷史範圍。

## CUISINE-CONSERVATION：取消清理與取出／拆鍋重複出料

**狀態：G119 來源存在取消後清資料及未完整確認交付的路徑；G120 補交易，G122 再修成本回復所有權，真宿主仍待驗收。**

工作站 before-break／explosion 曾直接排程清除油與調味資料，未重新確認後續取消。
G120 只在取消明確為 false、原站點確實消失、位置可讀且 metadata 前像相同時清理。
取消、無法讀 event、新站點或已變更 metadata 都保留資料。

出料原有 prepared／batch 寫入未讀回，slot／drop 回滾也未確認撤回。
G120 補實際確認，未知交付保留隔離，不把可能已給出的成品連同本次容器一起退款。
取出已 credit 而作者份數保存未完成時，拆鍋不能以另一 operationId 再發一次；
已拆鍋的批次亦不能因舊站點資料仍在，回到正常取出重發。
本版也補炒鍋／湯鍋的容器扣除確認、按 owner＋output receipt 綁定的成本結算，
以及燒焦原菜品身份與空手取炭／拆鍋共用收據。木炭不增加食物metadata。
破壞性回復需 native 所有權確認；非堆疊／未知保存不猜退款，持久fingerprint不是任意NBT完整證明。
來源細節及恢復限制見[G120](STATUS-A2.8.120.md)。
G122 不再因「實際狀態剛好等於規劃後像」就宣稱本次已寫入；手部與 station 各自記錄 setter 是否進入。
只有已確認站點回到前像，才可補償確實由本次改動且仍屬於本次的手部物品；油罐退款要求原生身份。
新鍋原料取回使用批次／revision／index 的既有交付收據，回收不被背包增量 fallback 當新菜裝飾。
黑暗料理／木炭仍繼承同批次已領取與未知交付的防重發邊界；詳見[G122](STATUS-A2.8.122.md)。

## EATING-ACCEPTANCE：逐口、雙手、停止與離線

**狀態：驗收缺口與舊候選有限失敗；没有本輪重現的新 bug。**

場景：固定牛肉串依次測早停、24／25／26-tick checkpoint、完整90-tick FOUR profile、
換手／換槽／連吃、stop後立即leave及重新加入；觀察份數、hunger／saturation、Strength、模型去塊和音效。
以普通副手持食物、主手工具或空手的 air-use 為單獨情境。

Java 預期：25-tick readiness、release一tick grace與完整動畫長度分開；
每次只消耗／獎勵一次，取消不吞食物；副手與攝影機場景按原作行為比較。
G81 已修有完整 counter 證據的 stop→leave 分支，未知／0 counter、direct leave等仍未全面認證。
[PR145](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/145) 有有限真人進食／relog／副手記錄，
其版本不能自動認證今日 G114，亦不含完整 Java 聲畫矩陣。

## 維護風險與平台決策

| 項目 | 已知事實 | 下一步，不是本輪修補 |
| --- | --- | --- |
| 舊 build 入口 | 重整後預設拒絕，只有全新且位於 Git 工作樹外的明確輸出可用；不再刪除既有目錄 | 已修工具；66個augment仍是歷史入口，不能當現行release鏈 |
| 舊 workflow 直接寫主幹 | 兩個 localization workflow 已移到 `docs/legacy_workflows`，Actions不再執行 | 已退出自動執行，歷史內容保留；没有證據稱它們曾覆蓋今日main |
| 驗證鏈重複 | 四組已審查重複命令在當前一次source-receipt驗證內重用成功結果 | 已去重；保留失敗／來源漂移拒絕及historical standalone行為 |
| 效能 | 有手動 BDS profiling，尚無約定的通過預算；家族有 slowdown／記憶體警告 | 独立当前场景量測，再決定上限；不能把 logging 成功當能效已修復 |
| 真自訂流體／Numb準星／Pepper entityInside／任意 mod smoking | 有已記錄平台替代或未完成项 | 按選定API與實際場景重審，分別決定近似／等待，不永久憑舊README放棄 |

完整 PR 處置來源與范围見 [稽核表](audit/PR-TRIAGE.md)；
下一階段按具體玩家問題從current main逐項修復；本輪不將這些舊提案直接合併或刪除歷史證據。
