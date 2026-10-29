# Java 與 Bedrock 功能對照

這份表記錄玩家能力、目前來源及尚缺的證據。修復候選為 `baseline.json` 的 **2.8.182／Cookery 1.6.4**；目前公開下載 **A2.8.157／Cookery 1.6.4** 另見 [發布與安裝](RELEASING.md)。兩者不能共用相依或驗收身份。

Java 對照固定為 `breezeth-CN/KaleidoscopeGrilling@9a1acdab27698457bec16c9362678e574895a28c`，以計畫所列 NeoForge 1.21.1 路徑為主要邏輯來源。原始素材保留於 `projects/grilling/source_snapshots/`；[data/java](../data/java/) 與[萃取方法](../tools/java_extract/README.md)提供可重現資料。數值與來源差異以這些資料和原碼為準，不從舊 Bedrock 行為反推 Java。

G181 的核心互動修復仍基於 G157 runtime，未合入 #255／G180 的資產清理。它防止自家 idle 外觀替換讓已擷取的穿／拆串、烤架及調料瓶互動失效，沒有改寫原作配方或放寬物品快照檢查。既有 [skewer_item_snapshot](../tests/legacy/test_skewer_item_snapshot.mjs) 已以註冊回呼串起魚串一料、煎蛋串二料、肉丸串三料，三槽烤架、用盡油／調料容器、取出、23 tick 取消與 25 tick 食用及重複完成；宿主油壺與已備好調料瓶是受控輸入。這是 API 模型證據，正常取材、原生完整流程、Java 聲畫及同候選保存仍待實測。

G182 承接 G181，整合 #257 的烤架朝向、#256 的八食材秘製串外觀與 #255 的 RP 資產清理，舊 PR 不因此關閉或視為已驗收。新增食材沿用既有 item IDs 與保存格式，只追加視覺索引 218–225；資產掃描器對目前樹回報零個整檔／混合定義／貼圖候選。這些是可重現來源與靜態結果，完整家族、實際畫面、聲音、原生操作與保存驗收仍待同候選執行。

## 如何讀狀態

`來源已實作`、`CI 通過`、`staging 驗證`、`已部署 luosen`、`真人驗收`是不同證據。表內來源狀態只描述列明能力，不表示整個功能已還原。歷史 BDS、錄影或 API 模型只保留原候選、場景與限制；沒有當前候選的結果就寫待驗。`client=false`、`production_ready=false` 維持不變。

舊對照使用的 A（有限 Java 執行）、B（純函式／API 模型）、C（真 BDS）、D（真人）證據不被抹除，也不自動換成今天的驗收。CI、雜湊、測試數、章節註冊成功或零玩家開服都不能代替玩法和畫面。未驗收與已重現 bug 分開列於 [KNOWN-ISSUES](KNOWN-ISSUES.md)。

下表 runtime 路徑相對於 `projects/grilling/gameplay_core/behavior_pack/scripts/`。保留測試由 [重建 CI](../.github/workflows/ci.yml)與 [保留玩法測試入口](../tools/run_legacy_tests.py)執行；[T2.5 分類](../tests/legacy/classification.json)逐檔記錄保留／抽取／退役及尚缺場景，其 `native_scenario_addendum` 承接 #250 的新增覆蓋。現行測試包含直接 import canonical export 的純規則、資料與故障注入，以及透過[受控外部 API 邊界](../tests/helpers/README.md)執行 canonical ESM、已註冊事件與排程的情境；沒有改寫 runtime JavaScript。這些情境仍不等於 BDS、完整 Player 流程、staging 或真人驗收；退役的 source-VM／幾何檢查不再計作現行覆蓋。

| 功能 | Java 類別／資料 | Bedrock 位置 | 來源狀態 | 已知差異／待驗收 | 保留測試／資料 |
| --- | --- | --- | --- | --- | --- |
| 正常取得牛肉塊與料理原料 | `SkewerRecipes`、Cookery 加工配方 | `a2727_cookery_host_recipes_runtime.js`、`host_api/board_api_core.js` | 來源已實作：登記及取得契約 | 普通作者包的能力與家族組裝分開；accepted 不代表真玩家加工／拾取成功。SKEWER-CONTENTS | [board_api](../tests/legacy/test_board_api.mjs)、[a2727_core](../tests/legacy/test_a2727_core.mjs)；`data/java/recipes.json`、`cookery.json`；正常取材→穿串待同候選驗收 |
| 固定配方、秘製串與短配方 | `SkeweringHandler`、`SkewerRecipes`、`SecretSkewerItem` | `a24_skewering_core.js`、`main.js` | 來源已實作：有序配方、內容與交易 | 不能用注入生串代替正常取得；空氣／方塊／實體、換槽、滿包及內容保存待驗 | [a24_core](../tests/legacy/test_a24_core.mjs)、[skewer_item_snapshot](../tests/legacy/test_skewer_item_snapshot.mjs)；`recipes.json`、`gameplay_rules.json`；T1.3-1、T1.3-5 |
| 烤架點火、油、翻面、撒料、成品 | `GrillBlock(Entity)`、`GrillRenderer` | `a275_grill_input_core.js`、`a276_grill_intent_core.js`、`a277_grill_transaction_core.js`、`grill_visual_runtime.js`、`main.js` | 來源已實作：三槽狀態、交易與四向顯示 yaw | 階段時間不等於總烹調時間；取消／替換後誤拆、同瓶同串全流程及重啟仍需驗收；G182 四向出生／更新公式尚未經實際 renderer 驗收 | [core](../tests/legacy/test_core.mjs)、[a275_core](../tests/legacy/test_a275_core.mjs)、[a277_core](../tests/legacy/test_a277_core.mjs)；四 cardinal 的三槽、翻面與 helper respawn 為 API fixture；`gameplay_rules.json`、`heat.json`；GRILL-DEFERRED-OWNER；T1.3-2 |
| 調料瓶裝料、搖勻、撒料與 reload | `SeasoningData`、`SeasoningUse`、`AdvancedSeasoningHandler` | `seasoning_registry_core.js`、`seasoning_motion_runtime.js`、`main.js` | 來源已實作：資料 resolver、保存與動作路由 | 同瓶 EMPTY→PENDING→80 tick→SPECIAL→撒料未完整真人閉合；取消爆炸須保留內容；明確 provider 仍是前提 | [a2743_core](../tests/legacy/test_a2743_core.mjs)、[bottle_raw_lore](../tests/legacy/test_bottle_raw_lore.mjs)；`gameplay_rules.json`、`seasoning_colors.json`；SEASONING-FLOW／DATA-RELOAD／EXPLOSION-CANCEL |
| 熱食、營養、作者與合併 | `FoodState`、`HotFoodExpiryHandler`、`HotFoodMerge` | `food_finish_core.js`、`food_snapshot_core.js`、`main.js` | 來源已實作：期限、metadata 與一次結算 | 有限 Java heat bucket 向量不等於完整食用；手持與餐盤要各自核 live saturation 上限與回滾 | [java_heat_deadlines](../tests/legacy/test_java_heat_deadlines.mjs)、[food_snapshot](../tests/legacy/test_food_snapshot.mjs)；`heat.json`、`foods.json`；HANDHELD-SATURATION、PLATE-SATURATION |
| 食用、停止、換手與離線 | `MultiBiteSkewerItem`、`SkewerEatingAnimation` | `secret_eating_core.js`、`cuisine_eating_core.js`、`main.js` | 來源已實作：會話、進度與結算 | readiness、release grace、完整動畫長度分開；direct leave、缺少 counter、crash 與副手事件尚未全面驗收 | [a285_core](../tests/legacy/test_a285_core.mjs)、[food_finish](../tests/legacy/test_food_finish.mjs)、[skewer_item_snapshot](../tests/legacy/test_skewer_item_snapshot.mjs)；純規則與受控 API 情境涵蓋 use/start/complete admission、匹配完成的一次結算、效果期限及消耗 metadata；stop/leave、缺少 counter、crash、副手與原生完整流程仍待驗。`eating_profiles.json`、`animation_curves.json`；EATING-ACCEPTANCE；T1.3-3 |
| 手持／進食模型、聲音與持物 ownership | `SkewerEatingPiece`、`SkewerColorProvider`、各 `*FirstPersonAnimation` | `player_presentation_core.js`、`held_visual_dispatch_runtime.js`、`secret_visual_state_core.js`、RP attachables／animations | 來源已實作：目前呈現路由與八種新增食材的既有索引擴充 | owning-player 修正不等於近鏡、末段平片、皮膚／FOV、旁觀者、兩手及聲音中斷已正確；八食材雙手／helper 實際畫面仍待驗 | [immersion_audio](../tests/legacy/test_immersion_audio.mjs)、[secret_visual_state](../tests/legacy/test_secret_visual_state.mjs)；後者執行 225 個索引、owner 與 resource expression，不是 renderer；`animation_curves.json`、`model_frames.json`、`sounds.json`；EATING-OWNER；T1.3-3 |
| 固定動態背包 icon | `SkewerColorProvider`、原動態 sprites | RP textures／texture animation 定義 | 來源已實作：固定圖像路由 | 熟史萊姆與神秘串五幀、每幀 4 tick 的真人觀察仍需同候選結果；不代替任意 stack GUI | 當前沒有完整自動化情境；`model_frames.json`；T1.3-4 |
| 任意三槽秘製串背包 GUI | `CustomSkewerGuiTexture`、`CustomSkewerGuiDecorator` | 現有 fallback icon；手持 renderer 是另一條路徑 | 未實作：完整每 stack 原作 GUI 合成 | 有原始失敗觀察；計畫採通用圖示＋名稱／lore 的平台方案，不新增視覺影子 ID；不把平台取捨寫成真人完成 | 當前沒有完整自動化情境；SKEWER-GUI；issue #166；`model_frames.json` |
| 餐盤交易、營養與互動仲裁 | `SkewerPlateBlock(Entity)`、`SkewerPlateItem` | `a25_plate_recipe_core.js`、`a25_plate_recipe_runtime.js`、`plate_transaction_core.js` | 來源已實作：保存、回滾與互動路由 | 放置／取回、點盤誤吃、未知交付、外來槽位及併發必須各自保留；不得用 PR 關閉認定修好 | [a25_core](../tests/legacy/test_a25_core.mjs)、[plate_transactions](../tests/legacy/test_plate_transactions.mjs)；PLATE-SATURATION、PLATE-USE-ARBITRATION；T1.3-1、T1.3-5 |
| 放置餐盤與牆上串譜顯示 | `SkewerPlateRenderer`、`SkewerRecipeBlockRenderer` | `plate_recipe_visual_core.js`、`a2770_placed_visual_runtime.js`、共享 secret palette | 來源已實作：內容、份數、四朝向與八食材放置色板 | 1–5 份、八食材、真材質、光照、重載與更新待驗；舊 tiny-edge-pixel 觀察保留原身份 | [a2770_core](../tests/legacy/test_a2770_core.mjs)、[secret_visual_state](../tests/legacy/test_secret_visual_state.mjs)；放置 resource expression 非實際畫面；`model_frames.json`；PLATE-PLACED-DISPLAY |
| 手持餐盤內容與同步 | `SkewerPlateRenderer` | `plate_held_visual_core.js`、`plate_held_visual_runtime.js`、共享 held transport | 來源已實作：reader、writer、獨立 count | 兩手混持、切槽、重登、skin／FOV、旁觀者及未知外來模型待驗；數學模型不能替代 client | [plate_food_cache](../tests/legacy/test_plate_food_cache.mjs)；僅內容 cache 規則；held transport 事件與畫面仍待驗。PLATE-HELD-CONTENTS／DECODE；`model_frames.json` |
| 油壓、油壺、滿包出料 | `OilPressBlock(Entity)`、`BigVatBlock(Entity)`、`OilFillingHandler` | `a26_oil_machine_core.js`、`a26_oil_machine_runtime.js`、油壺 adapter | 來源已實作：機器與明列介面 | 延後身份、實際交付與回收未知時不得退款重發；作者能力及普通安裝需分開核對 | [oil_transactions](../tests/legacy/test_oil_transactions.mjs)、[oil_api](../tests/legacy/test_oil_api.mjs)；`gameplay_rules.json`；ITEM-DELIVERY |
| 作物、油渣施肥、採果與凋葉 | 各 `*CropBlock`、`CropDropHandler`、`PepperLeavesBlock`；vanilla `BeetrootBlock`、`BambooStalkBlock`、`BambooSaplingBlock`、`KelpBlock` | `plant_fertilizer.js`、`plant_fertilizer_transaction_core.js`、`world/pepper_tree_runtime.js` | 來源已實作：明列植物（含甜菜、竹子、海帶）與交易 | 29 類適配不等於通用骨粉；竹子 stage 無對應狀態、海帶含水層原生讀回、鄰位、光照、果實未知結果及重載仍待 staging | [plant_fertilizer_storage](../tests/legacy/test_plant_fertilizer_storage.mjs)、[a2748_core](../tests/legacy/test_a2748_core.mjs)；`world_data.json`、`gameplay_rules.json`；OIL-RESIDUE-PLANTS；T1.3-1 |
| 料理架、串譜與支撐 | `AdvancedRack*`、`SkewerRecipeBlock(Entity)` | `a2746_advanced_rack_core.js`、`a2746_advanced_rack_runtime.js`、`a25_plate_recipe_runtime.js` | 來源已實作：取放與保存路由 | 貼牆選取、碰撞、取消、支撐更新時序、一次回收及音效待驗；不趁文件收斂改操作方式 | [rack_transactions](../tests/legacy/test_rack_transactions.mjs)、[rack_aim_hit](../tests/legacy/test_rack_aim_hit.mjs)；`collision_shapes.json`、`gameplay_rules.json`；T1.3-2、T1.3-5 |
| 外來作者、Creative 與批次出料 | `HotFoodMerge`、出料／油刷規則 | `integration_stack_core.js`、`main.js` | 來源已實作：明列出料與 metadata 路徑 | 跨作者合併、滿包、Creative 消耗及未知作者文字保留須實測；任意外部回呼未因此完成 | [a23_hot_merge](../tests/legacy/test_a23_hot_merge.mjs)、[food_snapshot](../tests/legacy/test_food_snapshot.mjs)；`foods.json`、`gameplay_rules.json`；ITEM-DELIVERY |
| Cookery 料理資料與取消清理 | `PotOilAccess`、`OilPotCompat`、料理資料契約 | `a2750_cookery_cuisine_core.js`、`a2750_cookery_cuisine_runtime.js` | 來源已實作：保存、交付與取消保護 | 真宿主出料／拆鍋／取消／保存故障待驗；API 讀回不證明任意 NBT 或 crash 原子性 | [cookery_output_contract_core](../tests/legacy/test_cookery_output_contract_core.mjs)、[a2750_core](../tests/legacy/test_a2750_core.mjs)；CUISINE-CONSERVATION；T1.3-5；[整合 API](BEDROCK-INTEGRATION-API.md) |
| exact／flex 鍋具生命週期與品質 | Cookery `PotBlockEntity`、`QualityEvaluator`、`QualityUtils` | `a2750_wok_food_core.js`、`a2752_stockpot_food_core.js`、`cuisine_eating_core.js` | 來源已實作：列明配方流程與品質 | 有限品質 Java 向量不等於完整事件；備料／翻炒／熱源／卸載／盛裝／冷卻／兩手食用待驗 | [java_pot_core](../tests/legacy/test_java_pot_core.mjs)、[cuisine_quality_java](../tests/legacy/test_cuisine_quality_java.mjs)；`cookery.json`、`foods.json`；JAVA-POT-LIFECYCLE |
| 重金屬保命與其他效果 | `GrillingMobEffect`、`InvincibleHandler`、`DragonEggPowderHandler` | `effect_lifecycle_core.js`、`main.js` | 來源已實作：單次 claim 與效果路由 | final death／totem／absorption、其他 addon 競合與磁碟持久性未完全等價；聲畫另驗 | 當前沒有完整自動化情境；`effects.json`；HEAVY-METAL-COMMIT |
| 花椒生成、戰利品與天然要塞 | `PepperTreeFeature`、`FortressHouttuyniaHandler`、各 loot handler | `a2759_pepper_worldgen_fruiting_runtime.js`、`a2860_pepper_worldgen_seed_runtime.js`、`integration_api_runtime.js` | 來源已實作：列明生成與公開宿主接口；天然要塞入口未完成 | 可信新生成宿主不得由附近磚塊推測；舊區塊不能被當作新區塊掃描改寫 | [a2759_core](../tests/legacy/test_a2759_core.mjs)、[java_survival_parity](../tests/legacy/test_java_survival_parity.mjs)；`world_data.json`；[整合 API](BEDROCK-INTEGRATION-API.md#新生成宿主) |
| 進度與獎勵 | Java advancements 與完成回呼 | `a2753_advancement_runtime.js`、`a2756_advancement_event_runtime.js`、`a2758_advancement_challenge_runtime.js` | 來源已實作：單次 XP 嘗試 | claim 後未知結果不重試；未發 XP 的恢復、跨 API 原子性及真人驗收仍缺 | [a2753_core](../tests/legacy/test_a2753_core.mjs)、[a2756_core](../tests/legacy/test_a2756_core.mjs)、[a2758_core](../tests/legacy/test_a2758_core.mjs)；僅條件／計數規則；真 XP／claim 交付仍待 scenario。`world_data.json`；ADVANCEMENT-CLAIM |
| Cookery／Tavern 指南入口與多語 | 家族整合能力；不冒充 Java 原作玩法 | `guide/main.js`、guide publisher；[指南規範](GUIDE-STANDARD.md) | 來源已實作：單入口、內容與交接 | 接收章節不等於玩家 UI 正確；返回、關閉、逾時、觸控、三語及多人隔離待驗 | [指南靜態檢查](../tools/check_grilling_guide.py)；[GUIDE-STANDARD](GUIDE-STANDARD.md)；既有指南檢查與真人場景分開 |
| HUD、平台替代與效能 | Java HUD／流體／碰撞／mixin／選用模組 | 目前 HUD、油流與明列 adapter；現況見 [ARCHITECTURE](ARCHITECTURE.md) | 來源已實作：有限替代；部分能力未實作 | 原始資料碼外露、位置與延遲保留失敗；未有完整效能預算。D3／D5／D6 仍按計畫待決 | [a2739_core](../tests/legacy/test_a2739_core.mjs)、[a2740_core](../tests/legacy/test_a2740_core.mjs)；僅 HUD 目標／狀態規則；無完整效能或畫面驗收。CLIENT-HUD、平台與效能；`hud.json`、`minecraft_assets.json` |

## 指南內容的歷史來源索引

以下章節承接 catalog 的 `source_refs`。連結固定在文件收斂前的 `df0ff11de5fbff8f0c64324d8e2c3bf7d618084b`，保留每份記錄的原候選、日期與驗證限制；它們是歷史來源，不是目前候選已完成原生／真人驗收的證據。catalog 的正文、配方、payload、語言與 icon 不因此改變。

### guide-cuisine-quality

[原料理品質與營養記錄](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/evidence/cuisine-quality-native-food-20261009.md)對應 G122 的三道料理、品質、冷卻／合併與公開 metadata。有限 Java 品質計算、原生資料與 API 模型分開，完整鍋具生命週期及真人營養驗收仍列於 JAVA-POT-LIFECYCLE／CUISINE-CONSERVATION。

### guide-processing

[原指南製程稽核](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/evidence/guide-processing-audit-20261017.md)保存七個 Java 磨盤配方與指南處理契約，以及當時 Cookery 1.6.1 的手動、工人庫存、掉落物三個 admission gate 缺口。它是來源核對，不能被改寫成 Cookery 1.6.2 或目前家族候選的實機驗收；普通安裝與家族能力仍須分別確認。

### guide-fertilizer-basics

[原版植物施肥來源](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/evidence/vanilla-plant-fertilizer.md)保存作者油渣兩次作用、一次扣料及有限 Bedrock 狀態適配；有效但未生長與無效目標不同。來源／資料核對不等於原生玩家施肥成功。

### guide-fertilizer-stem-rooted-dirt

[瓜梗與纏根泥土增量](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/evidence/stem-and-rooted-dirt-fertilizer-20261009.md)保存西瓜梗、南瓜梗、纏根泥土的來源、RNG 與交易順序。當時 21 類 handler 只是範圍計數，光照、鄰居更新與真人操作仍待驗。

### guide-fertilizer-nether-vines

[下界藤增量與海帶阻點](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/evidence/nether-vine-fertilizer-20261009.md)保存兩種藤的方向、尋端、age、RNG 與 journal，以及第二次作用重找末端的規則；當時 23 類計數不代表海帶或原生施肥已完成。

### guide-fertilizer-mangrove-ownership

[紅樹增量與所有權修補](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/evidence/mangrove-and-fertilizer-ownership-20261009.md)保存 G122 的紅樹葉、乾燥懸掛胎生苗與未知回復不退成本；25 類不涵蓋地植長樹、含水胎生苗、所有植物狀態、存檔或 client 驗收。

## 舊 PR 保留需求

下列穩定 ID 直接承接 [T1.3／PR #239](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/239) 與[處置前來源登錄](../tools/ops/receipts/legacy-pr-requirements-20261019.json)。五個舊 PR 已關閉，分支／head 保留；這不代表需求已完成，也不授權重新套用舊候選。

| ID／來源 | 必須保留的玩家結果 | 本表對應與待驗收 |
| --- | --- | --- |
| T1.3-1／#214 | 餐盤／食譜交易失敗或花椒採收掉落不明時，保留物品資料與所有權，不覆寫外來物品、不重複退款／採收、不遺失內容 | 餐盤、串譜、作物與世界；未知結果／故障注入和同候選真人流程仍需對照 |
| T1.3-2／#217 | 烤架與貼牆廚具架碰撞／選取符合 Java，避免空氣阻擋與靠牆點不中 | 烤架、料理架；已有來源承接不代替四朝向與貼牆實際結果 |
| T1.3-3／#220 | 20 種既定 THREE 路線烤串在站立、第一人稱主手食用時，逐口模型與手臂投影符合 Java | 食用與呈現；精確食品／路線與鏡頭條件不擴張成全食品驗收 |
| T1.3-4／#222 | 熟史萊姆串與神秘串背包圖示按 Java 五幀、每幀 4 tick 動畫呈現 | 固定動態 inventory icon；與任意三槽 GUI 缺口分開 |
| T1.3-5／#232 | 放置／取回餐盤、錄製食譜與 Cookery 書轉換在併發或 API 回應不明時保留物品所有權與資料，避免覆寫、遺失及複製 | 餐盤、串譜、Cookery；G155 來源承接不等於 API 故障及真人路徑都已驗收 |

## 來源與後續更新

本表合併舊對照的 21 個詳細項、進度獎勵邊界、BUGS 的 19 個問題區段及上述五項需求。原候選與細節保留於[收斂前 PARITY-MATRIX](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/PARITY-MATRIX.md)、[收斂前 BUGS](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/BUGS.md)及各自連結；完整重建前樹見 [archive tag](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/tree/archive/pre-rebuild-20261018)。收斂前 commit 與較早 archive tag 是不同時間點，不把後來的證據改寫成 tag 已有。

後續每次更新必須把來源 commit／候選、實際場景、測試位置及未覆蓋範圍寫在同一列。刪除過時測試可保留其歷史證據連結，但不能把它計作現行自動化覆蓋。文件清理不關閉尚未驗收的玩家需求。

### Unreleased sound-contract correction (T3.3)

這份修正已併入 G187 的來源線，沿用新身份與家族發布流程；不再保留另一份未凍結草稿。CI、原生載入及真人聲音分開驗證，`client=false`、`production_ready=false`。

- At official pin `9a1acdab27698457bec16c9362678e574895a28c`, NeoForge
  [GrillAutomationApi.java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/GrillAutomationApi.java#L196-L227)
  supplies ignition volume 1 and pitch `r*.4+.8`, extinguish volume .5 and pitch
  `2.6+(r1-r2)*.8`. The adapter now sends those formulas at block center.
  Distribution is preserved, not Java PRNG sequence or float-bit identity.
- `SkeweringHandler.java:53–60,114–121` uses PLAYERS at player BlockPos for
  disassembly (.8/1) and threading (.7/1). A distinct `kg_imm.thread_success`
  alias reuses the existing sample and .85 sample gain; grill insertion keeps
  the existing BLOCKS `kg_imm.action_success`. Disassembly uses player category.
  Player one-shots use floor(location)+.5, including negative coordinates.
- Grill one-shots use y+.5; the native grill loop remains y+.35, .65/1,
  loopCount -1. Non-grill callers of blockSound keep their existing origin.
- Category spelling `player` / `block` is confirmed by the
  [official Mojang sound schema](https://github.com/Mojang/bedrock-schemas/blob/main/schemas/rp/sounds/index.schema.json).
  [WorldSoundOptions](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldsoundoptions?view=minecraft-bedrock-stable)
  defines numeric pitch/volume; engine clamping, actual loudness, attenuation,
  category-slider behavior and native sample equivalence remain unverified.

Regression events exercise actual main.js subscriptions, successful and failed
ignition, redundant ignition/extinguish silence, thread/disassembly exclusivity,
block insertion category, negative player position and pitch extrema. No new
OGG, texture, model, use timing, cancellation or debit policy is introduced.
The optional Cookery cuisine-seasoning audience/category mismatch remains
separate and unfixed; native eating/burp duplication and listening acceptance
also remain open. Test doubles do not establish that a player heard the sound.
