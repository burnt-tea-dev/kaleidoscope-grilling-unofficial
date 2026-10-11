# 煙火現況對照表

更新：2026-10-09；當前維護來源 [G126 熟毛蟲雙手與 HUD 候選](STATUS-A2.8.126.md)，保留 [G125場景聲畫與操作守恆](STATUS-A2.8.125.md)，保留 [G124調料資料映射](STATUS-A2.8.124.md)、[G123指南正文鍵修補](STATUS-A2.8.123.md)、[G122炒鍋、品質與所有權](STATUS-A2.8.122.md)及 [G121酒館指南橋接](STATUS-A2.8.121.md)。
家族目前的 LIVE 配套、部署／保存／指南接收收據統一見[家族基線入口](https://github.com/casama233/kaleidoscope-tavern-unofficial/blob/main/family/BASELINE-STATUS.md)，本頁不另複製部署版本及驗收狀態。
下列標註舊版本的操作觀察仍保留當時範圍，家族載入、資料保存及指南接收不等於原生玩家事件或真人聲畫驗收。
先前未合併機制候選 `f27d40a7c1bab951398e3fc3d3906bcc416c5c3f` 的修補納入 G122；正式 G121 的指南橋接與歷史保持。
本頁沒有完整 Java↔Bedrock 真人聲畫／操作驗收證明；目前驗收狀態依共用基線入口記錄。

[G124調料資料重新載入](BUGS.md#seasoning-data-reload調料准入與效果寫死)：取料、既有食物效果與HUD使用同一目前映射，沿用公開Server-only API保存交易。仍須明確 provider 提供資料根，原生玩家流程與真人效果另行驗收；原型及歷史證據保留。

[G125](STATUS-A2.8.125.md)修復烤架取消／延後目標、榨油機扣料與滿包串譜／穿串／拆串；新增源自原作的牆譜分層、動畫油面及沉浸修補。精確場景／平台限制見[視覺證據](evidence/scene-visual-repair-20261009.md)，真原生事件窄診斷見[烤架收據](evidence/grill-deferred-native-20261009.json)。完整家族與 LIVE 不由這兩份資料替代。

[G126](STATUS-A2.8.126.md) 的動畫僅修 canonical 熟毛蟲的站立第一人稱右手／空副手座標外層。隔離 wide Makena、FOV70 真錄影已見雙手協作及 full/cancel 恢復；近嘴主串放大仍開放，沒有其餘食品、skin/FOV、TP 或 LIVE 驗收。HUD 另將 hold 75ms→100ms，保留原 intro 與 1ms fade；單次受控 no-clear 真片連續 89 幀並自然消失，實際食用取消／完成、完整家族與合併包仍待驗證。

Java 選定來源為作者 [`9a1acdab27698457bec16c9362678e574895a28c`](https://github.com/breezeth-CN/KaleidoscopeGrilling/tree/9a1acdab27698457bec16c9362678e574895a28c)。
2026-10-09（香港）重新核對的正式維護發布為
[Forge 1.20.1／CF8726006](https://www.curseforge.com/minecraft/mc-mods/kaleidoscope-grilling/files/8726006)
及 [NeoForge 1.21.1／CF8726014](https://www.curseforge.com/minecraft/mc-mods/kaleidoscope-grilling/files/8726014)，均為1.1.1。
主要邏輯對照使用 NeoForge；共用資產不代表 Forge 的專有事件也已驗收。
原碼為 BSD-3-Clause，素材為 CC BY-NC-SA 4.0；選定 snapshot 不等於完整原作 JAR 已執行。

證據代號沿用 Phase 0：**A** 是直接執行原 Java 純邏輯所得黃金向量；**B** 是守恆、冪等、交易回滾等不變量；
**C** 是真 BDS 引擎場景；**D** 是真人客戶端視覺、音效與手感對照。
原始碼比較、Python 翻譯公式、資產預覽、static、compile、hash 和 CI 身份檢查是前置，均不算 A–D 通過。
「有實作」與「待驗證」也不分別等於「完整還原」和「新證實的 bug」。

| 項目 | Java 原邏輯／A 證據 | 當前 Bedrock runtime／B 證據 | 真 BDS／C 範圍 | 真人畫面、音效／D 範圍 | 尚未完成／來源參照 |
| --- | --- | --- | --- | --- | --- |
| 環境與完整家族 | 原作兩個 loader 分支各自追蹤；來源 pin 不證明移植完成。 | G126 draft；最低 engine1.26.50；server2.9.0／server-ui2.2.0；Cookery1.6.0 與已登記 family API0.2.10。 | 歷史 G123／T142／W119的42包首次／重啟、當時停服存檔首次／重啟通過，0玩家；18筆玩家資料及2個自訂容器保留。**只證明載入與記錄的保存範圍。** | 沒有當前候選的完整 Java↔Bedrock 全玩法驗收。 | 不能把42包載入稱完整玩法通過。保留了存檔原有 GameTest／upcoming_creator_features 等實驗旗標；未執行 GameTest，也未證明關閉全部實驗仍可完整運作。[Phase0範圍](audit/AUDIT.md) |
| Cookery／Tavern 指南共用入口 | 家族指南導航整合，與 Java 原作機制還原分開記錄。 | 保留已合併 G121 的玩家來源、章節、nonce、語系及 40 tick 確認；返回回主頁、關閉不重開、逾時續原入口。 | G121 的來源／協定檢查保留，尚無本候選完整家族原生 UI 交接 C。 | 開啟、返回、關閉、逾時與多語操作仍待 G122 真人驗收。 | [G121 原範圍](STATUS-A2.8.121.md)、[G122 承接](STATUS-A2.8.122.md#版本沿革與-g121-指南橋接)；煙火仍只有既有 Cookery 書內一個入口，酒館章節使用 Tavern 自己的共用指南。 |
| 固定牛肉串：正常取得 | 一份生牛肉加工出2份牛肉塊；固定配方依序使用牛肉塊／紅辣椒／牛肉塊。這是來源／資料契約，尚無整段 A trace。 | 完整家族 Board API0.1.0 的 replace 配方保留4刀、再一次持刀釋放、輸出2塊；B涵蓋材料、取消、出料交易與回滾。普通未擴充 Cookery 能力另列。 | 舊 Board probe 有真 ItemStack／drop／狀態及重啟資料；其代用容器並非玩家持刀事件。當前 family載入不能補成 G114砧板操作C。 | G114 正常取材、4刀耐久、釋放、取消與拾取仍待同候選完整操作。 | 舊 Cookery1.0.8 取得阻塞已被家族 API 承接，不能當今天仍未修；註冊 accepted 也不是實際取得成功。[G31契約](STATUS-A2.8.31.md)、[Cookery1.6適配](STATUS-A2.8.72.md) |
| 固定牛肉串：穿製 | 原配方的食材順序與 raw→grilled 對應已固定。 | 主副手穿製、固定配方與 snapshot 有實作；B涵蓋扣料、剩餘物與交易失敗。 | 舊 G29 核心 probe 從已提供的物品進管線；`playerUseEvents=false`、`naturalAcquisition=false`。 | 空氣／方塊／實體入口、潛行、連按、換槽、滿包仍需真操作；不能沿用舊候選為G114完整D。 | 優先限定這一配方，避免用注入生串代表生存全流程。[原流程證據](evidence/skewer-flow-native-2.8.29.json) |
| 固定牛肉串：油、四翻、撒料、取出 | 爐容量3串；4翻、20tick翻面冷卻；FINISHED800tick、BURNT400tick階段。每占用串耗1點油、1次調料。 | 當前 core 保留上述規則；一串耗1油／1調料。B有不足不前進、手部失敗回滾、成功後清槽與成品保存。 | 舊G29有19固定串＋1秘製串的真 ItemStack／容器核心烹調與重啟；沒有玩家使用／食用事件。**不是G114／Cookery1.6完整受影響流程C。** | 同一瓶與同一串的刷油→四翻→撒料→熱串取出尚未完整驗收。 | 先復驗瓶前置與此切片，不重做已有爐狀態機；800/400是階段計時，不能直接稱總烹調時間。[既有全流程B](../development/gameplay_core/test_full_skewer_flow.mjs) |
| 調料瓶前置 | EMPTY→PENDING；持續使用80tick／4秒搖勻為SPECIAL；成功撒料才消耗use。 | G114 RawMessage／材料數修補已合併部署；保留原料、搖勻與交易路由。B保護自訂lore、metadata與失敗回滾。G117新增延後爆炸取消／event不可讀時保留瓶、容器與完整保存記錄的B。 | 原生 ItemStack建構、容器資料片段及family載入各有範圍；未證明整個玩家取瓶／完成handler或本輪爆炸取消時序。 | 舊G112真取瓶失敗有記錄；G114同瓶取回→搖勻→撒料仍待復驗，瓶姿態亦未完整D。 | [SEASONING-FLOW](BUGS.md#seasoning-flow自填瓶取回搖勻撒料)、[爆炸取消](BUGS.md#seasoning-explosion-cancel後續取消爆炸仍清除瓶與內容)、[已合併PR176](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/176)。舊draft[#172](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/172)／[#174](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/174)的列明有效差異已承接，不重合併其舊身份。 |
| 熱度與營養 | **有限A**：原 `FoodState.HEAT_BUCKET_TICKS`／`bucket` 方法以Java執行，非負時間的100tick桶向量相符。牛肉串nutrition5、saturation modifier0.6、Strength10秒是原資料，尚非完整A。 | 三油熱期限1200／12000／24000tick；熱食與調味資料有保存路由。B涵蓋期限、外來metadata、回滾與一次結算。 | 當前保存／載入C不等於真人hunger、saturation、effect各分支C；舊core產物讀回只保留其原身份。 | 牛肉串实际营养、10秒Strength及热食到期效果需同候选真食用核对。 | A **没有覆盖整个FoodState、grill、营养／效果回呼或完整JAR**；G122新增的料理品質純A在下方另列。[ORACLE-CHECK](audit/ORACLE-CHECK.json)、[有限向量](../development/gameplay_core/fixtures/java-heat-deadlines.json) |
| 食用、取消與離線 | FOUR profile90tick／4.5秒；25tick提前結算檢查點與release的一tick grace分開；完整動畫不是1.25秒。 | G81已修有完整counter證據的nonterminal stop→leave競態，G114保留。G117讓手持提前結算重取saturation／effectiveMax；B檢查新界限、較低cap、metadata、重複事件與refresh／寫入失敗回滾。 | source／API doubles不能證明真Player stop/complete/leave順序；direct leave、缺省／0counter、shutdown/crash未閉合。新的手持營養修補尚無其原生Player證據。 | 舊G81有局部進食／relog／副手觀察；普通副手air-use未啟動是有限失敗記錄，非G114修復。 | [手持飽和度修補](BUGS.md#handheld-saturation手持串提前結算沿用舊飽和度界限)與G116餐盤修補分開追蹤。24/25/26、90tick完成、取消／換手／換槽／連吃／normal relog仍需當前完整D。[G81範圍](STATUS-A2.8.81.md)、未入基準的文件[#145](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/145) |
| 固定牛肉串 icon、模型、HUD、聲音 | fixed raw/grilled sprite、模型、FOUR曲線、25tick原HUD與音源可追蹤；這些來源不是A執行或Java截圖。 | 靜態icon註冊、原資料衍生的持物／進食投影和audio路由存在；引用鏈／資產檢查只算前置。 | BDS可確認載入與特定API呼叫，不能確認鏡頭、逐口去塊、光照或聽感。 | 第一／第三人稱、主副手、皮膚／FOV、旁觀者、模型去塊與聲音中斷尚未完整對照。 | **待完成D，不宣稱聲畫一致。** 固定串靜態icon與下一行秘製串動態icon分開。[食用契約](JAVA-FIDELITY-GOAL-20261007.md) |
| 任意食材秘製串 inventory icon | 原16×16 GUI按有序食材、數量、生熟與variant合成；Python參考合成器是來源翻譯，**不算A或D**。 | G104有兩張static fallback；任意每串三槽資料的native inventory投影尚未完成。 | 載入static圖像不能驗證任意stack顏色／形狀選擇。 | 有使用者失敗觀察；現行仍待實際inventory復驗。手持模型不能代替背包icon。 | 這是秘製串的真缺口，不能無說明當作固定牛肉串直接阻塞。[SKEWER-GUI](BUGS.md#skewer-gui任意食材秘製串-inventory-icon)、[issue166](https://github.com/casama233/kaleidoscope-grilling-unofficial/issues/166)、[渲染界線](CUSTOM-SKEWER-INVENTORY-RENDER-LIMITS.md)、[G119穩定API重查](evidence/heavy-metal-and-inventory-api-20261009.md) |
| 餐盤營養與互動 | 原食用只結算一次；成功block互動不額外啟動另一份air-eating。 | G116重取live saturation／effectiveMax，並仲裁plate與item-use、排除較近entity；既有B覆蓋具體故障、回滾及合法使用，不證明原生輸入完整相同。 | 舊診斷有saturation越界後回滾；需保留原phase，不當成當前修復C。 | 舊候選有插盤後意外食用剩餘串的觀察，當前復驗未完成。 | 已由G116窄承接[#148](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/148)／[#150](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/150)的列明差異；未導入舊視覺union。[G116](STATUS-A2.8.116.md)記錄來源与LIVE場景，受影響C/D仍待驗。 |
| 放置餐盤與牆上串譜顯示 | 原作按槽、份數與FIXED transform顯示實際串；串譜顯示錄製結果。 | G118新增固定／秘製串專用mesh、原作1–5份布局與四朝向；串譜保留39種固定GUI索引與史萊姆五幀；G125秘製結果改用原16px GUI mask及三個實際RGB分層。成功交易後有界更新，未知helper不釋放配額。 | 新helper、重載及顯示排程待本候選BDS；舊placed候選樣本不能接受G118。 | 四朝向、光照、遮擋、實際動畫與內容更新待本候選D；高負載可跳中間幀。 | [G118顯示範圍](STATUS-A2.8.118.md#放置餐盤與牆上串譜顯示)。保留當前palette與ownership，未以舊placed候選artifact覆蓋現行來源。 |
| 手持餐盤內容／解碼 | 原作手持盤按槽顯示實際食物與1–5份；手持没有放置盤額外的Rz180。 | G119新增保存內容reader、每手單一writer與1–5份模型；兩word均低於2²⁰、count獨立，現行秘製串／瓶通道互斥共用。來源數學及生成引用屬前置。 | G119手持實作保留，仍需當前候選原生property同步／重登與兩手讀回；舊stored1／4故障不當作本版結果。 | 第一／第三人稱、左右手、1–5份、切槽、重登、skin/FOV與旁觀者仍待同候選D。 | [G119手持鏈](STATUS-A2.8.119.md#手持餐盤的完整來源鏈)。舊[PR153](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/153)及155–164保持原型／診斷身份，沒有批次覆蓋現行來源或以float32模型代替實機。 |
| 農業、配方與製油 | Java植物各有骨粉行為；油渣作用兩次、一次消耗；自然凋葉使用loot。大缸7紅磚、fences tag含12原版成員；壓油到16後等10ticks。 | G118既有8植物、144柵欄方向組合、3堆肥率及等待修補保留。G119新增10植物入口及完整鄰位／掉落隔離。G120再加瓜梗2類、纏根土及2種下界藤，總23類；成熟當次RNG、光照／土地／鄰株與果實先於附著梗；藤蔓按方向尋端，第二次沿虛擬新末端延長，age25仍可施肥。G122再加乾燥紅樹葉下生苗與懸掛苗成熟，總25類；先確認所有已進入寫入的方塊／掉落回復，才可退肥料，不覆寫未知槽位。 | 新植物及G118受影響流程仍待本候選原生載入與正常操作；source/SDK無法替代。 | 種植→骨粉／油渣→採果／凋葉→榨油全流程待真人，含上下半、潛行、掉落規則與重登。 | [G119植物來源](evidence/vanilla-plant-fertilizer.md)、[G120瓜梗與根](evidence/stem-and-rooted-dirt-fertilizer-20261009.md)、[下界藤／海帶](evidence/nether-vine-fertilizer-20261009.md)、[紅樹／退款所有權](evidence/mangrove-and-fertilizer-ownership-20261009.md)。瓜梗光照／鄰居更新待原生；甜菜／竹子、海帶流體層及其他植物仍缺適配；甜莓副手以NeoForge1.21.1為主，Forge1.20.1差異另列。 |
| 廚具架、串譜保存與支撐 | 有效破壞保存資料；取消不改方塊。串譜看指定側面，餐盤放置需完整碰撞；串譜選取框10×13×0.25。 | G118廚具架取消／身份與音效鍵已修；串譜交易、credited重載清理及非玩家支撐輪詢有B。已知方塊／樓梯支撐及桌面開關分開判定。 | 新native掉落、before-event生命週期、重啟與20-tick custom block tick未以實機認證。 | 四朝向放置、正常拆除／取消爆炸、一次回收及取放音效待本候選D。 | 未知shape保持未判定；20-tick輪詢非Java updateShape精確時序；prepared／未知交付需明確恢復。[G118 F02/F03/F12–F14](STATUS-A2.8.118.md)。 |
| 熱食效果、作者與出料語義 | 熱食按開始時剩餘duration計增量；FoodState合併忽略creator；出料先回背包，Creative刷油仍消耗。 | G118修正自訂duration、真正作者鍵與精確自動lore；串譜換作者先清舊行。整批出料先預留相容stack，Creative油／調料按planner扣量；B覆蓋回滾。 | 僅執行production函式與API doubles，未補本候選真ItemStack／Player路徑C。 | 同配方跨作者合併、滿包出料、熱食與Creative消耗待真操作。 | 舊未知作者文字保守保留；任意食品回呼等能力仍独立。[G118 F10/F11/F15/F16](STATUS-A2.8.118.md)。 |
| Cookery 料理資料與出料 | 油／調味隨成品，取消毀損不清原站點資料，同一份食物只交付一次。 | G120取消、metadata前像、交付讀回與批次收據保留。G122先確認實際 station／hand 寫入所有權及站點復原才退款，回收原料不冒充新料理；未知保存保留隔離。 | 當前作者host的production與保存失敗回呼尚待原生；註冊accepted和source receipt不同。 | 真實滿包／取出／拆鍋／取消／重登仍待本候選D。 | [G122](STATUS-A2.8.122.md)、[料理守恆](BUGS.md#cuisine-conservation取消清理與取出拆鍋重複出料)。外部任意metadata、跨包清理及crash原子性未完成；天然要塞generation入口仍未完成。 |
| 三道 exact／flex 炒鍋 | 原作兩種配方共存、exact優先、固定九槽、一份輸出；1200tick備料、第一鏟啟動200tick並算第一翻、三翻不足失敗、成品800／黑暗料理400。這些原碼對照不是完整A事件trace。 | G122保存phase／tick／stirs／epoch，新鍋啟用；已接受原配方才進入flex，普通輸入烹調期間鎖定。legacy在製／完成／燒焦鍋先走原流程，其他作者配方明確交接。 | 尚無本候選熱源、原宿主操作、重啟、掉落與收據故障的C。 | 備料／翻炒／盛裝／變質、耐久、音效和手感需真操作。 | [G122流程](STATUS-A2.8.122.md#炒鍋新批次的完整有界流程)、[原規格](evidence/cookery-flex-pot-lifecycle-20261009.md)。普通原料限可原生堆疊的完整普通物品；任意私有NBT及其他作者料理尚未完整移植。 |
| 彈性料理品質 | **有限A**：直接執行兩分支原QualityEvaluator／Quality，1,248個品質觀察相同；原NeoForge QualityUtils另有12組營養／float恢復值。 | G122保持signed-long種子、原recipe ID、Random／shuffle及quality0–3；12個原生食物變體＋一致payload，冷卻與食材快照保留，exact無品質時保持原值。附加熱食／調味需唯一食用會話。 | native float／hunger上限、before-use取消、完成callback和保存重啟仍未通過本候選C。 | 品質tooltip、飽和值、雙手連吃與冷卻後取食仍待D。 | [品質證據](evidence/cuisine-quality-native-food-20261009.md)、[原Java向量](../development/gameplay_core/fixtures/java-cuisine-quality-160.json)。以NeoForge1.21.1營養語義為目標，Forge差異明列；沒有全JAR／完整事件A或原生食用完成宣稱。 |
| 重金屬保命 | Java在死亡回呼取消死亡、移除重金屬、HP=1、中毒12000ticks、broadcast35；兩分支相同。 | G119的單次FX→HP→聲音保留；G125成功HP讀回後補原生圖騰粒子，並非完整event35。G120先持久化並讀回實體claim，再排程／取消；logout只撤callback，同until／amp不能跨session再救。未知取消／儲存結果不退claim。 | 本候選原生傷害／效果保存尚待驗證；舊G73證據不承接為G120。 | 圖騰／死亡順序、吸收盾、多人與event35聲畫仍待原生／真人。 | [G119／G120效果與API](evidence/heavy-metal-and-inventory-api-20261009.md)。仍無剩餘absorption和final death/totem入口；claim實際重登／保存待原生，API讀回不等於磁碟flush／crash原子性。 |
| 其他平台與效能 | 原作流體、準星mixin、碰撞hook及任意食品回呼有各自需求，非單一算法。 | 腳本油流與明列替代保留；任意Java callbacks／Create／Maid等不會自動取得Bedrock等價。 | 有局部native能力與profiling；沒有約定的完整效能通過預算，載入正常不代表slowdown已解決。 | 完整粒子／混音／碰撞／多人手感仍缺。 | 保留[平台與效能缺口](BUGS.md#維護風險與平台決策)，按來源和實際API逐項決策；不由舊README永久判定放棄。 |

PR欄採用 **2026-10-08 G116重新核對的固定runtime差異**；「未入基準」不以版號落後、ahead數或PR仍開啟作判據。
完整exact heads、已承接差異與診斷範圍只維護在[PR-TRIAGE](audit/PR-TRIAGE.md)，不在此複製另一份歷史清單。

後續先修一個能改變玩家結果的問題；本機只做該失敗的診斷，完整必要套件交同一候選CI一次。
沒有相關新變更或新失敗時重用有效證據，不為這張表新增測試或重新啟動BDS。
固定牛肉串下一輪以正常取得→穿製→油→四翻→同瓶撒料→取出→食用→保存為單一路徑；
所需C只補原生／保存缺口，D由使用者實際客戶端對照。來源／發版／備份／家族准入邊界仍保留，禁止模擬玩家。
