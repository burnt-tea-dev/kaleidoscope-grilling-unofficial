# Java 與 Bedrock 功能對照

這份表記錄玩家能力、目前來源及尚缺的證據。來源版本與相依以 [baseline.json](../baseline.json) 為準；公開下載另見 [發布與安裝](RELEASING.md)。兩者不能共用相依或驗收身份。

Java 對照固定為 `breezeth-CN/KaleidoscopeGrilling@9a1acdab27698457bec16c9362678e574895a28c`，以計畫所列 NeoForge 1.21.1 路徑為主要邏輯來源。原始素材保留於 `projects/grilling/source_snapshots/`；[data/java](../data/java/) 與[萃取方法](../tools/java_extract/README.md)提供可重現資料。數值與來源差異以這些資料和原碼為準，不從舊 Bedrock 行為反推 Java。

G181 的核心互動修復仍基於 G157 runtime，未合入 #255／G180 的資產清理。它防止自家 idle 外觀替換讓已擷取的穿／拆串、烤架及調料瓶互動失效，沒有改寫原作配方或放寬物品快照檢查。既有 [skewer_item_snapshot](../tests/scenario/test_skewer_item_snapshot.mjs) 已以註冊回呼串起魚串一料、煎蛋串二料、肉丸串三料，三槽烤架、用盡油／調料容器、取出、23 tick 取消與 25 tick 食用及重複完成；宿主油壺與已備好調料瓶是受控輸入。這是 API 模型證據，正常取材、原生完整流程、Java 聲畫及同候選保存仍待實測。

G182 承接 G181，整合 #257 的烤架朝向、#256 的八食材秘製串外觀與 #255 的 RP 資產清理，舊 PR 不因此關閉或視為已驗收。新增食材沿用既有 item IDs 與保存格式，只追加視覺索引 218–225；資產掃描器對目前樹回報零個整檔／混合定義／貼圖候選。這些是可重現來源與靜態結果，完整家族、實際畫面、聲音、原生操作與保存驗收仍待同候選執行。

## 如何讀狀態

T3.4的[原生能力實測](../tests/native/eating-debit-spike/observed.json)已在BDS1.26.60.6證明：100tick測試餐的兩份stack由腳本在25／90tick先扣一份後，引擎仍會complete再扣一份；原生控制只扣一份。此未採用設計不能用來移除正式時長variant。當前來源改為初次觀察、主背包／hotbar事件及設定變更才準備手持，不再在未變的idle手持上反覆讀metadata。副手API直寫沒有這兩種事件，保留既有wrong-duration使用前guard；未新增「未快取就拒絕」的准入條件。此為替代路線的局部收斂，T3.4完整重寫／影子退役、Java每次使用的隨機profile準備時機及真人輸入／聲畫仍未完成。

T3.4後續來源修復把固定烤串的完成事件也交給 `completedEatingStillCurrent` 核對手／槽／數量與metadata；暫時不一致後恢復同一份食物時，重建profile／手／原生時長及投影，保留原有已過時間與bite cursor、不重播聲音。既有food_finish真runtime測試覆蓋兩手、換槽／異物／改名及恢復後一次完成。Java `SkewerEatingProfile` 是每次use的暫存選擇，不是永久物品標記；本次不新增存檔key。

直接離線依[擁有者已接受的平台差異](REBUILD-PLAN.md#t3-4-direct-logout-policy)處理。原Java離線結算TODO已換成兩手23／25／26／90tick離線／重登的正常行為斷言，沒有把Java當場結算改記為通過；真人斷線仍待驗。

獨立100tick測試食物在BDS1.26.60.6確認完整食用／主動停止兩個正向對照，但四個直接simulated disconnect均無stop。詳見[原生能力結果](../tests/native/eating-debit-spike/observed.json)的logout_events。同一測試世界重啟後，before-leave同份物品setItem被restricted execution拒絕，system.run延後讀Player得到InvalidEntityError；[官方API](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playerleavebeforeeventsignal?view=minecraft-bedrock-experimental)也列為restricted callback。這是有限的事件／寫入能力證據，沒有執行Grilling即時離線結算或真人斷線測試。

`來源已實作`、`CI 通過`、`staging 驗證`、`已部署 luosen`、`真人驗收`是不同證據。表內來源狀態只描述列明能力，不表示整個功能已還原。歷史 BDS、錄影或 API 模型只保留原候選、場景與限制；沒有當前候選的結果就寫待驗。`client=false`、`production_ready=false` 維持不變。

舊對照使用的 A（有限 Java 執行）、B（純函式／API 模型）、C（真 BDS）、D（真人）證據不被抹除，也不自動換成今天的驗收。CI、雜湊、測試數、章節註冊成功或零玩家開服都不能代替玩法和畫面。未驗收與已重現 bug 分開列於 [KNOWN-ISSUES](KNOWN-ISSUES.md)。

下表 runtime 路徑相對於 `projects/grilling/gameplay_core/behavior_pack/scripts/`。保留測試由 [重建 CI](../.github/workflows/ci.yml)與 [保留玩法測試入口](../tools/run_tests.py)執行；[T2.5 分類](../tests/legacy/classification.json)逐檔記錄保留／抽取／退役及尚缺場景，其 `native_scenario_addendum` 承接 #250 的新增覆蓋。現行測試包含直接 import canonical export 的純規則、資料與故障注入，以及透過[受控外部 API 邊界](../tests/helpers/README.md)執行 canonical ESM、已註冊事件與排程的情境；沒有改寫 runtime JavaScript。這些情境仍不等於 BDS、完整 Player 流程、staging 或真人驗收；退役的 source-VM／幾何檢查不再計作現行覆蓋。

| 功能 | Java 類別／資料 | Bedrock 位置 | 來源狀態 | 已知差異／待驗收 | 保留測試／資料 |
| --- | --- | --- | --- | --- | --- |
| 正常取得牛肉塊與料理原料 | `SkewerRecipes`、Cookery 加工配方 | `a2727_cookery_host_recipes_runtime.js`、`host_api/board_api_core.js` | 來源已實作：登記及取得契約 | 普通作者包的能力與家族組裝分開；accepted 不代表真玩家加工／拾取成功。SKEWER-CONTENTS | [board_api](../tests/legacy/test_board_api.mjs)、[a2727_core](../tests/legacy/test_a2727_core.mjs)；`data/java/recipes.json`、`cookery.json`；正常取材→穿串待同候選驗收 |
| 固定配方、秘製串與短配方 | `SkeweringHandler`、`SkewerRecipes`、`SecretSkewerItem` | `a24_skewering_core.js`、`main.js` | 來源已實作：有序配方、內容與交易 | 不能用注入生串代替正常取得；空氣／方塊／實體、換槽、滿包及內容保存待驗 | [a24_core](../tests/legacy/test_a24_core.mjs)、[skewer_item_snapshot](../tests/scenario/test_skewer_item_snapshot.mjs)；`recipes.json`、`gameplay_rules.json`；T1.3-1、T1.3-5 |
| 烤架點火、油、翻面、撒料、成品 | `GrillBlock(Entity)`、`GrillRenderer` | `a275_grill_input_core.js`、`a276_grill_intent_core.js`、`a277_grill_transaction_core.js`、`grill_visual_runtime.js`、`main.js` | 來源已實作：三槽狀態、交易與四向顯示 yaw | 階段時間不等於總烹調時間；取消／替換後誤拆、同瓶同串全流程及重啟仍需驗收；G182 四向出生／更新公式尚未經實際 renderer 驗收 | [core](../tests/legacy/test_core.mjs)、[a275_core](../tests/legacy/test_a275_core.mjs)、[a277_core](../tests/legacy/test_a277_core.mjs)；四 cardinal 的三槽、翻面與 helper respawn 為 API fixture；`gameplay_rules.json`、`heat.json`；GRILL-DEFERRED-OWNER；T1.3-2 |
| 調料瓶裝料、搖勻、撒料與 reload | `SeasoningData`、`SeasoningUse`、`AdvancedSeasoningHandler` | `seasoning_registry_core.js`、`seasoning_motion_runtime.js`、`main.js` | 來源已實作：資料 resolver、保存與動作路由 | 同瓶 EMPTY→PENDING→80 tick→SPECIAL→撒料未完整真人閉合；取消爆炸須保留內容；明確 provider 仍是前提 | [a2743_core](../tests/legacy/test_a2743_core.mjs)、[bottle_raw_lore](../tests/legacy/test_bottle_raw_lore.mjs)；`gameplay_rules.json`、`seasoning_colors.json`；SEASONING-FLOW／DATA-RELOAD／EXPLOSION-CANCEL |
| 熱食、營養、作者與合併 | `FoodState`、`HotFoodExpiryHandler`、`HotFoodMerge` | `food_finish_core.js`、`food_snapshot_core.js`、`main.js` | 來源已實作：期限、metadata 與一次結算 | 有限 Java heat bucket 向量不等於完整食用；手持與餐盤要各自核 live saturation 上限與回滾 | [java_heat_deadlines](../tests/legacy/test_java_heat_deadlines.mjs)、[food_snapshot](../tests/legacy/test_food_snapshot.mjs)；`heat.json`、`foods.json`；HANDHELD-SATURATION、PLATE-SATURATION |
| 食用、停止、換手與離線 | `MultiBiteSkewerItem`、`SkewerEatingAnimation` | `secret_eating_core.js`、`cuisine_eating_core.js`、`main.js` | 來源已實作：會話、進度與結算 | readiness、release grace、完整動畫長度分開；直接離線依[已接受的Java差異](REBUILD-PLAN.md#t3-4-direct-logout-policy)處理；真人斷線、缺少 counter、crash 與副手事件尚未全面驗收 | [a285_core](../tests/legacy/test_a285_core.mjs)、[food_finish](../tests/legacy/test_food_finish.mjs)、[skewer_item_snapshot](../tests/scenario/test_skewer_item_snapshot.mjs)；純規則與受控 API 情境涵蓋 use/start/complete admission、匹配完成的一次結算、效果期限及消耗 metadata；stop/leave、缺少 counter、crash、副手與原生完整流程仍待驗。`eating_profiles.json`、`animation_curves.json`；EATING-ACCEPTANCE；T1.3-3 |
| 手持／進食模型、聲音與持物 ownership | `SkewerEatingPiece`、`SkewerColorProvider`、各 `*FirstPersonAnimation` | `core/player_props.js`、`held_visual_dispatch_runtime.js`、`secret_visual_state_core.js`、RP attachables／animations | 來源已實作：目前呈現路由與八種新增食材的既有索引擴充 | owning-player 修正不等於近鏡、末段平片、皮膚／FOV、旁觀者、兩手及聲音中斷已正確；八食材雙手／helper 實際畫面仍待驗 | [immersion_audio](../tests/legacy/test_immersion_audio.mjs)、[secret_visual_state](../tests/legacy/test_secret_visual_state.mjs)；後者執行 225 個索引、owner 與 resource expression，不是 renderer；`animation_curves.json`、`model_frames.json`、`sounds.json`；EATING-OWNER；T1.3-3 |
| 固定動態背包 icon | `SkewerColorProvider`、原動態 sprites | RP textures／texture animation 定義 | 來源已實作：固定圖像路由 | 熟史萊姆與神秘串五幀、每幀 4 tick 的真人觀察仍需同候選結果；不代替任意 stack GUI | 當前沒有完整自動化情境；`model_frames.json`；T1.3-4 |
| 任意三食材秘製串背包圖示（GUI display） | `CustomSkewerGuiTexture`、`SkewerGuiDecorator` | `secret_gui_state.js`、生成的 `kg_secret_gui*.json`；手持 renderer 是另一條路徑 | 新client不支援屬性已改直接alpha binding；新增cursor缺collection警告已在生成器排除非格子入口，原G239原生資料證據保留 | [本項範圍與限制](#秘製串背包圖示gui-display)；保留雙手穿料、原ID及64堆疊 | [正式main情境](../tests/scenario/test_secret_inventory_icon.mjs)、[Java原合成器比對](../tools/test_secret_gui_assets.py)、[原生觀察](../tests/native/secret-gui/observed.json)；SKEWER-GUI；issue #166 |
| 餐盤交易、營養與互動仲裁 | `SkewerPlateBlock(Entity)`、`SkewerPlateItem` | `a25_plate_recipe_core.js`、`a25_plate_recipe_runtime.js`、`plate_transaction_core.js` | 來源已實作：保存、回滾與互動路由 | 放置／取回、點盤誤吃、未知交付、外來槽位及併發必須各自保留；不得用 PR 關閉認定修好 | [a25_core](../tests/legacy/test_a25_core.mjs)、[plate_transactions](../tests/legacy/test_plate_transactions.mjs)；PLATE-SATURATION、PLATE-USE-ARBITRATION；T1.3-1、T1.3-5 |
| 放置餐盤與牆上串譜顯示 | `SkewerPlateRenderer`、`SkewerRecipeBlockRenderer` | `plate_recipe_visual_core.js`、`a2770_placed_visual_runtime.js`、共享 secret palette | 來源已實作：內容、份數、四朝向與八食材放置色板 | 1–5 份、八食材、真材質、光照、重載與更新待驗；舊 tiny-edge-pixel 觀察保留原身份 | [a2770_core](../tests/legacy/test_a2770_core.mjs)、[secret_visual_state](../tests/legacy/test_secret_visual_state.mjs)；放置 resource expression 非實際畫面；`model_frames.json`；PLATE-PLACED-DISPLAY |
| 手持餐盤內容與同步 | `SkewerPlateRenderer` | `plate_held_visual_core.js`、`plate_held_visual_runtime.js`、共享 held transport | 來源已實作：reader、writer、獨立 count | 兩手混持、切槽、重登、skin／FOV、旁觀者及未知外來模型待驗；數學模型不能替代 client | [plate_food_cache](../tests/legacy/test_plate_food_cache.mjs)；僅內容 cache 規則；held transport 事件與畫面仍待驗。PLATE-HELD-CONTENTS／DECODE；`model_frames.json` |
| 油壓、油壺、滿包出料 | `OilPressBlock(Entity)`、`BigVatBlock(Entity)`、`OilFillingHandler` | `oil/oil_machine_core.js`、`oil/oil_machine_runtime.js`、`oil_press_registry.js`、油壺 adapter | 來源已實作：G194以26.60 `isName`命名事件推進，完成後停止重排，保留登記恢復 | 同候選真引擎出油／拆除／卸載／重啟仍待驗；延後身份、交付與回收未知時不退款重發；普通作者安裝與家族能力分開 | [oil_transactions](../tests/legacy/test_oil_transactions.mjs)、[oil_api](../tests/legacy/test_oil_api.mjs)；`gameplay_rules.json`；ITEM-DELIVERY／OIL-NAMED-TICK |
| 作物、油渣施肥、採果與凋葉 | 各 `*CropBlock`、`CropDropHandler`、`PepperLeavesBlock`；vanilla `BeetrootBlock`、`BambooStalkBlock`、`BambooSaplingBlock`、`KelpBlock` | `plant_fertilizer.js`、`plant_fertilizer_transaction_core.js`、`world/pepper_tree_runtime.js` | 來源已實作：明列植物（含甜菜、竹子、海帶）與交易 | 29 類適配不等於通用骨粉；竹子 stage 無對應狀態、海帶含水層原生讀回、鄰位、光照、果實未知結果及重載仍待 staging | [plant_fertilizer_storage](../tests/legacy/test_plant_fertilizer_storage.mjs)、[a2748_core](../tests/legacy/test_a2748_core.mjs)；`world_data.json`、`gameplay_rules.json`；OIL-RESIDUE-PLANTS；T1.3-1 |
| 料理架、串譜與支撐 | `AdvancedRack*`、`SkewerRecipeBlock(Entity)` | `a2746_advanced_rack_core.js`、`a2746_advanced_rack_runtime.js`、`a25_plate_recipe_runtime.js` | 來源已實作：取放與保存路由 | 貼牆選取、碰撞、取消、支撐更新時序、一次回收及音效待驗；不趁文件收斂改操作方式 | [rack_transactions](../tests/legacy/test_rack_transactions.mjs)、[rack_aim_hit](../tests/legacy/test_rack_aim_hit.mjs)；`collision_shapes.json`、`gameplay_rules.json`；T1.3-2、T1.3-5 |
| 外來作者、Creative 與批次出料 | `HotFoodMerge`、出料／油刷規則 | `integration_stack_core.js`、`main.js` | 來源已實作：明列出料與 metadata 路徑 | 跨作者合併、滿包、Creative 消耗及未知作者文字保留須實測；任意外部回呼未因此完成 | [a23_hot_merge](../tests/legacy/test_a23_hot_merge.mjs)、[food_snapshot](../tests/legacy/test_food_snapshot.mjs)；`foods.json`、`gameplay_rules.json`；ITEM-DELIVERY |
| Cookery 料理資料與取消清理 | `PotOilAccess`、`OilPotCompat`、料理資料契約 | `a2750_cookery_cuisine_core.js`、`a2750_cookery_cuisine_runtime.js` | 來源已實作：保存、交付與取消保護 | 真宿主出料／拆鍋／取消／保存故障待驗；API 讀回不證明任意 NBT 或 crash 原子性 | [cookery_output_contract_core](../tests/legacy/test_cookery_output_contract_core.mjs)、[a2750_core](../tests/legacy/test_a2750_core.mjs)；CUISINE-CONSERVATION；T1.3-5；[整合 API](BEDROCK-INTEGRATION-API.md) |
| exact／flex 鍋具生命週期與品質 | Cookery `PotBlockEntity`、`QualityEvaluator`、`QualityUtils` | `a2750_wok_food_core.js`、`a2752_stockpot_food_core.js`、`cuisine_eating_core.js` | 來源已實作：列明配方流程與品質 | 有限品質 Java 向量不等於完整事件；備料／翻炒／熱源／卸載／盛裝／冷卻／兩手食用待驗 | [java_pot_core](../tests/legacy/test_java_pot_core.mjs)、[cuisine_quality_java](../tests/legacy/test_cuisine_quality_java.mjs)；`cookery.json`、`foods.json`；JAVA-POT-LIFECYCLE |
| 重金屬保命與其他效果 | `AdvancedSeasoningHandler.onDeath`、`InvincibleHandler`、`DragonEggPowderHandler` | `heavy_metal_damage_runtime.js`、`effect/runtime.js` | 來源已實作：單次claim、取消前付款；G238合適傷害下圖騰先處理；G242在Survival真Ordinary完成的圖騰繞過／Heavy救援確認 | Creative食用後沒有受傷／Heavy救援，部分吸收盾漏救仍未解；窄結果與限制見[圖騰及吸收順序](#heavy-metal-damage-order)。護甲／抗性、其他addon競合與crash持久性未完全等價；聲畫另驗 | [真main事件與失敗回復](../tests/scenario/test_heavy_metal_rescue.mjs)、[原生回呼寫入／同世界重開](../tests/native/heavy-metal/observed.json)、[歷史4案順序對照](../tests/native/heavy-metal/damage-order-observed.json)、[G238圖騰優先](../tests/native/heavy-metal/totem-priority-observed.json)、[G242 Survival](../tests/native/heavy-metal/ordinary-maxfloat-observed.json)、[Creative反例](../tests/native/heavy-metal/ordinary-creative-observed.json)；HEAVY-METAL-COMMIT |
| 花椒生成、戰利品與天然要塞 | `PepperTreeFeature`、`FortressHouttuyniaHandler`、各 loot handler | `a2759_pepper_worldgen_fruiting_runtime.js`、`a2860_pepper_worldgen_seed_runtime.js`、`loot_tables/chests/nether_bridge.json`、`loot_tables/kaleidoscope_grilling/fortress_houttuynia_bonus.json` | 來源已實作：原生要塞箱 loot table wrapper 保留 vanilla pool，另加 Java 對應的 65% bonus pool（1–2 rolls、每次 1–3） | 26.60 Mojang vanilla `nether_bridge` snapshot 與目前保留副本一致；現有測試核對 wrapper、bonus 參數及可種植物品鏈。仍未取得同候選 BDS 真實箱子開箱分布／玩家驗收；同名 vanilla loot table 覆寫仍有跨 addon 相容風險 | [test_fortress_loot_current.py](../tools/test_fortress_loot_current.py)（已列入 CI）、[a2759_core](../tests/legacy/test_a2759_core.mjs)、[java_survival_parity](../tests/legacy/test_java_survival_parity.mjs)；[官方 26.60 vanilla nether_bridge](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/behavior_pack/loot_tables/chests/nether_bridge.json)；[整合 API](BEDROCK-INTEGRATION-API.md#新生成宿主) |
| 進度與獎勵 | Java advancements 與完成回呼 | [advancement_runtime](../projects/grilling/gameplay_core/behavior_pack/scripts/advancement/advancement_runtime.js)、[advancement_event_runtime](../projects/grilling/gameplay_core/behavior_pack/scripts/advancement/advancement_event_runtime.js)、[advancement_challenge_runtime](../projects/grilling/gameplay_core/behavior_pack/scripts/advancement/advancement_challenge_runtime.js) | 來源已實作：單次 XP 嘗試 | 原生XP／claim及未確認的範圍見[本項說明](#進度獎勵與領取紀錄) | [a2753_core](../tests/legacy/test_a2753_core.mjs)、[a2756_core](../tests/legacy/test_a2756_core.mjs)、[a2758_core](../tests/legacy/test_a2758_core.mjs)只覆蓋條件／計數；[原生XP／claim](../tests/native/advancement-claim/observed.json)17項通過 |
| Cookery／Tavern 指南入口與多語 | 家族整合能力；不冒充 Java 原作玩法 | `guide/main.js`、guide publisher；[指南規範](GUIDE-STANDARD.md) | 來源已實作：單入口、內容與交接 | 接收章節不等於玩家 UI 正確；返回、關閉、逾時、觸控、三語及多人隔離待驗 | [指南靜態檢查](../tools/check_grilling_guide.py)；[GUIDE-STANDARD](GUIDE-STANDARD.md)；既有指南檢查與真人場景分開 |
| HUD、平台替代與效能 | Java HUD／流體／碰撞／mixin／選用模組 | 目前 HUD、油流與明列 adapter；現況見 [ARCHITECTURE](ARCHITECTURE.md) | 來源已實作：有限替代；部分能力未實作 | 原始資料碼外露、位置與延遲保留失敗；未有完整效能預算。D3／D5／D6 仍按計畫待決 | [a2739_core](../tests/legacy/test_a2739_core.mjs)、[a2740_core](../tests/legacy/test_a2740_core.mjs)；僅 HUD 目標／狀態規則；無完整效能或畫面驗收。CLIENT-HUD、平台與效能；`hud.json`、`minecraft_assets.json` |

## 進食HUD的訊息入口與額外工作

G142已讓食材圖像用原生ignored條件裁剪，但普通actionbar、Tavern訊息及END仍會進入工廠，再逐一判斷子圖層。G245把原base圖層已有的ignored條件放到單一eating_content群組，在進入圖像子樹前略過。每筆訊息仍保留輕量kg_eating_packet及原factory替換／0.2秒到期配置，讓END和普通訊息繼續清掉上一份HUD；不採根節點ignored的G244草稿，避免改動這個清場路徑。原visible條件、全部圖像／填充選擇與觸控位置不變，未改BP發送頻率或新增cache／timer。

[入口情境](../tools/test_eating_hud_ui.py)直接讀canonical UI中的ignored式，並使用正式javaEatingHudFrame產生90／100tick的起始、25tick邊界與完成packet；普通訊息／END略過圖層而有效食用packet保留，根packet保持可建立且清場訊息為隱藏。測試僅代替JSONUI字串減法／比較邊界，不是native UI parser、建構耗時或FPS測量。此修復只限定普通訊息造成的額外工廠工作，不能用來宣稱全程掉幀／發熱已解。既有client位置、外露資料碼、延遲及所有食品／兩手畫面限制仍保留。

## 秘製串背包圖示（GUI display）

本項的GUI指背包／快捷欄中每串圖示的繪製，不是輸入三格食材的製作視窗。固定Java `9a1acdab`的[Forge1.20.1](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/SkeweringHandler.java)與[NeoForge1.21.1](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/SkeweringHandler.java)均以雙手逐次穿料、直接更新手上成品；兩分支的`CustomSkewerGuiTexture`／`SkewerGuiDecorator`讀每stack食材、生熟及variant畫圖示。沒有新增三格窗口、關閉返料或自動烹飪的原作要求；`secret_terminal_visibility.py`處理的是食用末段顯示，不能當成製作終端。

新增來源使用同版官方[Mojang UI sample](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/ui/ui_common.json)的每slot `#hover_text` collection binding。既有進度RawMessage附上純格式碼顯示快取，由原庫存／副手／已追蹤容器的tooltip queue更新；不新增lore行、物品ID、視窗或排程。每串的三個食材索引、原GUI variant及生熟palette選出Java原圖層；原名稱、完整快照及世界metadata record保留，重複食材比較忽略這份純視覺快取。缺少owned進度行的自訂tooltip維持原樣。額外addon食品仍受既有視覺catalogue範圍限制，未宣稱任意外部貼圖可自動讀取。

`tools/build_secret_gui.py`從[公開原圖／原Java來源](../tools/fixtures/secret-gui/README.md)產生圖層與 `common.item_renderer` hook，不接管庫存按鈕或雙手交易。原G239的同名定義漏掉type／renderer與native bindings；同名定義會替換基底，不能靠modifications自動保留它。2026-11-06實際client報告與背包截圖證實一般物品圖示消失，只留數量／耐久，selected item、hotbar、bundle衍生類型連鎖報Type not specified。G243生成器保留固定Mojang sample的完整custom／inventory_item_renderer基底與全部原bindings；[生成資料回歸](../tools/test_secret_gui_ui.py)修前因type缺失失敗、修後通過。 後續已部署G30015的人類新ContentLog有97筆＝93筆UI Unknown property [modifications]、1筆無位置UI Invalid expression及3筆另一addon Molang。這是新失敗證據：G243完整定義仍輸出modifications，不能把type及五條binding存在當作client通過。生成器現已移除此屬性，直接在原五條bindings之後接第六條alpha view binding；原生drawing依recipe source切透明度，propagate_alpha=false保留子圖層自身alpha，stick／food順序不變。真正生成器的回歸在修前因該屬性失敗、修後通過，並比對兩個實際輸出、原生binding前綴及透明度接線；沒有假造client零錯誤。 後續另一份client log有94筆同屬性UI error及6筆warning：large／small chest拿起物品的default／pressed／hover圖示，其kg_secret_recipe_source沒有$item_collection_name。新檔無時間／版本，不能推為G246部署後結果。固定Mojang的inventory_selected_icon確實以global bindings覆寫base且沒有collection；真生成器現以空collection default及ignored條件略過此圖層，保留原native cursor繪製，不猜inventory_items或另一格。inventory／hotbar真caller仍保留原逐串圖層；原生caller資料回歸修前缺default失敗、修後通過。這只驗證生成配置與變數／布林運算邊界，不宣稱client已無警告；cursor的逐stack自訂秘製圖示也未因此建立。

G243讓每slot只讀一份visible條件的hover資料，原先八份always hover binding收為一份；以原生collection factory的0／1長度配置普通slot不建立秘製圖層，標記串才建立原圖層。圖層把food高／低位與style分成小數值binding，最長expression由3177字元收為1040字元。這些是生成資料的實際差異，不是已量測的FPS／CPU提升，也不是factory在當前client的實機證明。681個生成輸出只改兩份UI，原貼圖逐位元相同，沿用兩Java原合成器各5400組像素比對；正式main情境仍確認獨立配方、生熟快照、雙手穿料及拆解。未改BP玩法或保存資料；沒有新增interval或掃描器。

2026-11-06 BDS1.26.60.6／server2.12.0-beta的[窄原生30項](../tests/native/secret-gui/observed.json)確認既有進度RawMessage內98碼純格式資料可寫入及完整讀回，cache穩定；真庫存事件、換槽、chest轉移、同一QA世界正常重啟後，name／count／flags／原RawMessage及private carrier／遊戲metadata完整相同。兩次正常stop／exit0、players／errors／OOM皆0，QA已清；詳見[測試範圍](../tests/native/secret-gui/README.md)。這只確認此RawMessage格式路徑，不推論任意string lore的官方單行50字限制均失效。測試用獨立QA manifest及entry，資料實作與G239相同，並非完整家族候選或client測試。

原ContentLog的74筆UI與26筆另一addon方塊錯誤保留原範圍；後續部署後97筆新log已如上列入，不能叫舊快取。G只負責UI生成來源，3筆另一addon粒子Molang交其owner。未附檔名／位置的JSON UI Invalid expression仍未定位，不能只靠JSON載入或expression縮短宣稱消失。尚無本次直接binding修正後的client讀回；原生衍生caller可替換bindings陣列，每slot／hotbar供值、factory實際建立與回收、換槽後畫面、bundle及其他包衝突仍須按真實結果描述，不宣稱client錯誤0、實際幀率或完整GUI等價，也不新增真人等待門檻。原始範圍另見[issue166](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/issues/166)；原生資料保存、手持模型及固定五幀圖示各保留其證據範圍。

## 涼拌折耳根的製作交付

兩個Java分支的[Forge](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/food/ColdHouttuyniaCraftingRecipe.java)／[NeoForge](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/food/ColdHouttuyniaCraftingRecipe.java)都在四個已占用製作格中核對三份折耳根與一個至少含2點高級辣椒油的油壺，產出一份涼拌折耳根，複製原油壺後扣2點作餘物。Bedrock既有適配仍是主手至少三根、副手油壺、蹲下點工作台；這不是Java原生四格製作視窗。原料數、油量與成品數不改。

正式main的[製作場景](../tests/scenario/test_cold_houttuynia_transaction.mjs)在舊來源重現三項：成品庫存寫入已套用後拋錯，舊give改丟地上而多一份；滿包drop已套用後拋錯，再spawn第二份；正常用完油轉空壺時，丟失本包可讀的附加DP。修復移除原cold owner的舊give，直接使用既有 `core/transaction.js` 與output planner；先回收可確認的成品才退款，無法確認drop時不補發或退款，沿用既有未確認交易阻擋重試的行為。最後三根釋出的主手格可接成品，滿包仍可掉落一份。油壺adapter在跨ID時保留本包可讀properties，仍清理原已知legacy油鍵；不讀取其他包私有資料，也不聲稱可複製不可見NBT。

G240的新五個真main場景與受影響的既有油交易／公開API共93項通過。這是API故障模型及來源行為證據，不是BDS自然故障。2026-11-06 BDS1.26.60.6／server2.12.0-beta的[29項原生觀察](../tests/native/cold-houttuynia/observed.json)確認真craft函式、native Player／ItemStack／庫存／副手／drop的三個健康流程，空壺保留本包DP／name／raw lore／flags，存chest同QA正常重啟後資料一致；兩階段normal stop／exit0、players／errors／OOM皆0，QA已清。這使用最小外部pot內容，並非真人shiftclick、作者pot component互動、Java工作台或完整新家族候選的驗證；精確範圍見[窄測說明](../tests/native/cold-houttuynia/README.md)。

## 進度獎勵與領取紀錄

目前的 `advancement/advancement_runtime.js:awardOneShotAdvancement` 先以既有進度DP寫入並讀回pending，再嘗試一次原生`addExperience`；成功後將同一DP寫成布林true。已完成、pending、未知值或讀取失敗都拒絕再次發獎。若XP呼叫或完成寫入的結果不明，保留pending，不用命令fallback或自動重試；這是「最多嘗試一次」，不是XP與DP的跨API原子交易，也沒有恢復未發XP的功能。

上表三個core測試只驗數值、條件及計數，不能當成原生發獎證據；舊表的a2753／a2756／a2758 runtime檔名已改連實際owner。2026-11-06的[窄原生觀察](../tests/native/advancement-claim/observed.json)在BDS1.26.60.6沿PR364原函式及observer通過17項：NativePlayer XP0→25、完成claim=true，重複拒絕且XP不變；既有pending的兩種先前付款結果保持25→25／35→35、原DP bytes不變。正常stop／exit0、players/errors/OOM為0，自己的QA世界／引擎已清，詳見[範圍與重現說明](../tests/native/advancement-claim/README.md)。這只確認直接函式與原生XP／DP，不證明真玩法trigger、重啟、未知寫入故障、跨API原子性或客戶端聲畫；真人不另立完成門檻。

## 手持快照的提交失敗回復

T3.5 的正式路徑由 `held_visual_dispatch_runtime.js` 匯集兩手provider，交同一個 `held_visual_transport.js` publisher；`tests/native/held-snapshot/` 是獨立歷史原型，並非另一個由main啟動的writer，不能只因名稱相似就刪除。實際property宣告查 [player.json](../projects/grilling/gameplay_core/behavior_pack/entities/player.json)，來源使用既有四個欄位，不靠新增欄位修復回復流程。

G237 修正既有失敗分支：A已送出，改成B時先更新原生frame、但動畫提交拋錯，之後兩手又回A；舊去重直接認定A已送過，留下原生frame B與舊packet A不相符，連週期refresh也只重送舊frame。正式publisher現有pending時直接建立與目前兩手資料一致的新generation，成功後才恢復去重，不新增retry queue、保存欄位或第二writer。

[真實publisher／staged-owner情境](../tests/scenario/test_held_snapshot_recovery.mjs)使用既有API fixture的延後property寫入，覆蓋動畫submit前失敗及呼叫已套用後拋錯兩種既有故障模型；兩者原版均未重送、修後均以新frame恢復兩手完整內容，晚到的A/B packet不能覆蓋。這是API故障注入及實際生成Molang請求的query邊界執行，未聲稱BDS自然出現此錯誤、真客戶端變數scope或完整renderer已驗證；現有低槽通道的客戶端限制仍保留。

## 溫暖效果的熱源判斷

G234 修正 `effect/runtime.js` 的原熱源判斷：熄滅的普通／靈魂營火不供熱；原生 `lit_furnace`、`lit_smoker`、`lit_blast_furnace`、已亮的紅石類型及 `lit=true` 的蠟燭／銅燈供熱；火、靈魂火、靜止／流動岩漿、岩漿塊與既有已點火烤架仍有效。依據為已釘選 Cookery [WarmthEffect](https://github.com/KaleidoscopeMods/KaleidoscopeCookery/blob/4d39e36cfa749939ba5f9d6d3b715ef9a984cb9c/src/main/java/com/github/ysbbbbbb/kaleidoscopecookery/effect/WarmthEffect.java) 的 LIT 判斷及[熱源 tag](https://github.com/KaleidoscopeMods/KaleidoscopeCookery/blob/4d39e36cfa749939ba5f9d6d3b715ef9a984cb9c/src/generated/resources/data/kaleidoscope_cookery/tags/block/warmth_heat_source_blocks.json)；Bedrock 名稱與狀態來自官方 1.26.60.5 [mojang-blocks.json](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/metadata/vanilladata_modules/mojang-blocks.json)。該引擎的營火使用布林 `extinguished`，不是舊名稱 `extinguished_bit`。

[真 main 排程情境](../tests/scenario/test_warmth_heat_sources.mjs)先重現原本三熔爐不回血、兩熄滅營火誤回血，修後涵蓋原生 ID／狀態切換、5×3×5 邊界、多熱源只回血一次、生命上限、烤架與下界慢速回復。G234 的保存鍵、效果期限和檢查頻率不變。[既有原生觀察](../tests/native/warmth/heat-observed.json)已確認15項：兩種營火真實extinguished狀態、三種熔爐投入原生食材與煤後自行燃燒、idle不回血及burning回1HP，正常停服、0players/errors/OOM。該窄測使用正式effect application/tick入口，並非完整main或客戶端驗證；首次診斷缺少player屬性及同一世界補入未修改G234 player定義後成功的範圍，見[探針說明](../tests/native/warmth/README.md)。它不證明後續時機修正已通過原生測試。

G236 接續修正獨立時機差異。Mojang 1.20.1／1.21.1 的 `MobEffectInstance.tick` 均先呼叫效果的duration判斷／apply，再`tickDownDuration`；以官方[1.20.1 JAR](https://piston-data.mojang.com/v1/objects/0c3ec587af28e5a785c0b4a7b8a30f9a8f78f838/client.jar)及[映射](https://piston-data.mojang.com/v1/objects/6c48521eed01fe2e8ecdadbd5ae348415f3c47da/client.txt)、[1.21.1 JAR](https://piston-data.mojang.com/v1/objects/30c73b1c5da787909b2f73340419fdf13b9def88/client.jar)及[映射](https://piston-data.mojang.com/v1/objects/2244b6f072256667bcd9a73df124d6c58de77992/client.txt)核對，對應1.20.1 `bfa.a(bfz,Runnable)`、1.21.1 `brz.a(btn,Runnable)`。因此tick7套用40tick效果，後續tick8先處理duration40、tick28處理duration20；原G234的全域時鐘只在tick20／40回復。直接把`until-now`當作扣減前duration的G235草稿也漏掉第一tick，未獨立合併或部署；其身份保留，由G236取代。

正式owner以既有active deadline恢復本次扣減前的`until - world absolute time + 1`，判斷20的倍數；不新增保存欄位、計時器或待辦資料。[真main情境](../tests/scenario/test_warmth_heat_sources.mjs)核對第一tick、第二次回復、續期、到期不補零tick回血，以及原生DP欄位模型在process clock重啟後保留同deadline。12項情境通過，原G234在新增的三項失敗。

2026-11-06 的[G236原生觀察](../tests/native/warmth/timing-observed.json)沿未改寫的exported函式通過10＋11項：原生Player在tick87套用40tick效果，elapsed1／13／20／21／40的HP為5／5／5／6／6；同QA正常停服再開，原生保存actor的相同DP期限及4HP保留，在absolute741（扣減前601）不回復、742（600）回到5HP，期限不變。兩次正常stop／exit0、players/errors/OOM為0。這確認原生時機與受影響保存資料；沒有證明native process clock重置、完整main、跨模組完整同tick順序、客戶端或自動非玩家支援，詳見[探針說明](../tests/native/warmth/README.md#g236-duration-timing-and-same-world-restart)。

## 搖瓶完成的額外資料保存適配

G222 接續 [PR350](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/350) 的單一修復：`food/runtime.js:completePending` 使用已核對的目前手持瓶，經既有 `copyEatingVariant` 保留 API 可見名稱、RawMessage lore、keepOnDeath／lockMode、Adventure 放置／破壞限制和可讀寫的動態欄位；只重建已知由煙火持有的 lore，重設 uses=0 與隨機 variant。失敗回復目前的原生 pending stack，不回寫開始食用時已過期的旗標／限制快照。[原有真main回歸](../tests/scenario/test_pending_seasoning_metadata.mjs)已在當前來源依賴執行，覆蓋目前 metadata、主副手失敗回復和拒絕新 variant 後重試；原生操作／保存範圍見[專用探針](../tests/native/seasoning-metadata/README.md)。

[2026-11-05 原生觀察](../tests/native/seasoning-metadata/observed.json)已確認一次主手 native use 的開始／完成相隔80ticks；成品保存上述公開欄位，同時重設owned lore／uses／variant，放入原生箱子、正常停服／同世界重開後仍為相同metadata。測試使用BDS1.26.60.6、server2.12.0-beta、server-ui2.2.0、gametest1.0.0-beta及已審閱Cookery1.6.4，Beta APIs／POI／upcoming creator features已開。自有來源程式未改寫，獨立診斷BP/RP身份／entry overlay已列明；這不是正式G222整組候選或一般玩家副手操作的驗收。沒有重跑未變的重金屬／圖騰實驗。

這是**擁有者資料保護要求下的額外適配，不是 Java 缺口計數**。固定 Java1.1.1 的 [NeoForge](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/PendingSeasoningItem.java)／[Forge](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/PendingSeasoningItem.java) `finishUsingItem` 本身也建立新 SPECIAL stack，只轉 ingredients／隨機 variant，沒有複製名稱與任意 metadata。跨種類成功轉換沿既有公開欄位投影，不等於同種類 `ItemStack.clone()` 的完整原生複製；未知 NBT、不可讀欄位及其他 pack 私有資料不在已證明範圍。原料、產量、次數上限與隨機機率不變。

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
| T1.3-4／#222 | 熟史萊姆串與神秘串背包圖示按 Java 五幀、每幀 4 tick 動畫呈現 | 固定動態 inventory icon；與任意三食材每stack圖示缺口分開 |
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
G220 fixes the Cookery cuisine-seasoning audience/category mismatch in
`food/cookery_cuisine_runtime.js`. Both the
[NeoForge](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/SeasoningUse.java#L22-L23)
and [Forge](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/SeasoningUse.java#L22-L23)
references broadcast from the player's BlockPos in PLAYERS, at .85/1. The
adapter now uses the existing dimension-wide `useSound` route and a
`kg_imm.cuisine_season` alias in `player`, reusing the season sample. Grill
seasoning retains the `block` alias. The registered runtime callbacks in
[immersion_audio](../tests/legacy/test_immersion_audio.mjs) cover pot/stockpot
success, the final bottle use, negative player coordinates and silence for
missing host capability, empty seasoning, changed hand, repeated input and a
rejected commit. No saved data or debit rules change. Native eating/burp
duplication, actual loudness, attenuation and category-slider behavior remain
unverified. Test doubles do not establish that a player heard the sound.

## T3.3 oil POI 接續（2026-11-03）

G212 候選從已發布 G208 接入原生查缸、Java z/y/x 順序和嚴格流體讀寫。保留 [原329草稿](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/329) 的舊證據與版本衝突，不沿用其 G208–210 release identities。Beta APIs／POI 兩項旗標為必要條件；全部 block/item/存檔鍵與包 UUID 保留。來源測試與[原生交易／同世界重開](../tests/native/oil-poi/observed.json)已完成：四餅→四桶＋四渣、滿缸等待、損壞資料拒絕及重開後只結算一次。原生測試只帶指定Cookery配套；完整家族存檔／回退與真人畫面、聲音、多人效能仍待完成。

<a id="heavy-metal-expiry"></a>
## T3.3 重金屬到期結算（2026-11-05）

G221 修正已重現的最後一 tick 競態：tick9 的重金屬期限為10，舊程式先取消致命傷，tick10 常規清理刪掉效果後，延後結算就放棄。結果保留原生命且沒有中毒。Java 1.1.1 [NeoForge](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/AdvancedSeasoningHandler.java)／[Forge](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/AdvancedSeasoningHandler.java) 均在 `onDeath` 立即消耗重金屬、設1HP及添加12000tick中毒。現在沿既有受傷入口，在取消前先確認 claim 與效果寫入；生命／聲光仍按 Bedrock 限制延後一 tick。未取消傷害的失敗會恢復原效果與 claim，不新增保存鍵或遷移。

[原生觀察](../tests/native/heavy-metal/observed.json)直接執行未改寫的 handler／effect writer：BDS1.26.60.6、server2.12.0-beta、Beta APIs與upcoming creator features已開；native豬受到100傷害時，before-hurt讀到暫時計算的-90HP，立即讀回效果轉換及claim，cancel=true，native恢復10HP，下一tick變成1HP。正常停服／同世界重開後保留相同中毒期限、無關warmth、claim及1HP。這是隔離能力與受影響保存資料的證據；真main事件、到期及失敗回復另由上述ESM情境覆蓋，不是完整家族、原生圖騰／剩餘absorption、其他addon仲裁或客戶端聲畫等價證明。

<a id="heavy-metal-damage-order"></a>
### 吸收生命與原生圖騰順序（2026-11-06）

Java 兩分支先扣實際剩餘吸收生命，再檢查原生圖騰，只有仍要死亡才進 `AdvancedSeasoningHandler.onDeath`。已從 Mojang 官方1.20.1／1.21.1 client JAR及 mappings核對 `LivingEntity.hurt`：`actuallyHurt` 先計吸收值，`checkTotemDeathProtection` 成功則跳過 `die`。Forge／NeoForge 的死亡掛鉤分別在 [Forge `die`](https://github.com/MinecraftForge/MinecraftForge/blob/d13dd327bdc75c010f3358992e80e7e92f51e030/patches/minecraft/net/minecraft/world/entity/LivingEntity.java.patch)／[NeoForge `die`](https://github.com/neoforged/NeoForge/blob/624c929f49920c250166e2a8df7af87f16d220ef/patches/net/minecraft/world/entity/LivingEntity.java.patch)。原生圖騰成功不會由重金屬添加中毒；NeoForge 的一般重金屬使用預設 [PROTECTED_BY_TOTEM cure](https://github.com/neoforged/NeoForge/blob/624c929f49920c250166e2a8df7af87f16d220ef/src/main/java/net/neoforged/neoforge/common/EffectCures.java)，亦會被該圖騰清除。官方JAR／mappings來源記在[本次觀察](../tests/native/heavy-metal/damage-order-observed.json)。

G221 的歷史原生對照重現以下兩個差異；部分盾仍未修正，圖騰優先由下述 G238 來源修復接續：

- 兩隻10HP原生豬同時取得吸收I，其中一隻先受3點傷害。再各受13點傷害時，兩個 before-hurt 均讀到 -3HP、amp0、期限378ticks，現行 handler 都不取消；完整盾的豬存活1HP，部分盾的豬死亡，漏掉原作應有的重金屬救援。測試中 `getComponents()` 沒有吸收量元件，`getComponent('minecraft:absorption')` 回傳空值。[Effect](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/effect?view=minecraft-bedrock-experimental) 只提供等級／期限等欄位，不能由它推得剩餘盾量。
- 10HP原生模擬玩家副手持圖騰、受100點傷害：不帶重金屬的 control 消耗圖騰並存活；帶重金屬時，handler 先取消傷害、添加中毒，圖騰仍留在副手。這與 Java 的原生圖騰優先不同。

所選引擎的 [before-hurt](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityhurtbeforeevent?view=minecraft-bedrock-experimental) 位於原生吸收／圖騰處理之前，沒有剩餘吸收值或最終圖騰結果；[after-hurt／after-death](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-experimental) 不能取消最終死亡。這限制了部分盾修復，**不代表無法實讀兩手圖騰並讓原生先處理**：上述舊 probe 已在 before-hurt 讀到真副手圖騰。讓路與清理是兩件事；持有物只能決定優先路徑，效果清理仍須下述真實成功治療訊號。舊4案本身未改 runtime 或 LIVE，原始失敗不改寫。

#### 原生圖騰成功訊號的來源調查（2026-11-05）

官方 1.26.60.5 [server 2.12.0-beta bindings](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/metadata/script_modules/%40minecraft/server-bindings_2.12.0-beta.json) 已提供 `entityHeal` 與 `EntityHealCause.TotemOfUndying`。成功後事件能確認原生圖騰治療，不應把「before-hurt 沒有結果」擴大成所有公開 API 都無法得知成功。它仍不是可取消的最終死亡階段；同份 bindings 沒有暴露剩餘吸收值。

G233 將原 G230 清理來源原樣整合至 G232 主線；來源候選沿用同一個正值 `TotemOfUndying` after-heal 路徑，清除存活實體的 16 種已核對預設可治療效果及其隱藏層：煙火的 heavy_metal、dragon_blood、numb、invincible，以及 Cookery 的 flatulence、tundra_strider、warmth、satiated_shield、vigor、sulfur、mustard、preservation、hinder、projectile_dodge、instant_smelting、vitality。保留不可治療中毒、重金屬 claim 與未知名稱效果；G227 的窄範圍版本身份不改寫。來源為釘選 [Grilling ModEffects](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModEffects.java)、[Cookery ModEffects](https://github.com/KaleidoscopeMods/KaleidoscopeCookery/blob/4d39e36cfa749939ba5f9d6d3b715ef9a984cb9c/src/main/java/com/github/ysbbbbbb/kaleidoscopecookery/init/ModEffects.java) 與 [BaseEffect](https://github.com/KaleidoscopeMods/KaleidoscopeCookery/blob/4d39e36cfa749939ba5f9d6d3b715ef9a984cb9c/src/main/java/com/github/ysbbbbbb/kaleidoscopecookery/effect/BaseEffect.java)，配合 NeoForge 的預設 PROTECTED_BY_TOTEM cure；不涵蓋其他 Java 模組事後修改 cure 或否決移除的情形。

效果保存移除確認後，既有 owner 請求生命群組重設、停止麻痺姿勢。成功原生圖騰先撤銷較早的龍血待補生命、彈射物閃避與重金屬待結算，防止效果剛過期或保存移除失敗時，舊回呼仍補傳送或覆蓋新生命結果；保存寫入失敗時不冒稱已清除效果。龍血的事件前綴原先讀取不存在的 `PERSISTED_KEY.DRAGON_HEALTH_PREFIX`，本次改用已存在且對應 player.json 的 `LOCKED_DRAGON_HEALTH_EVENT_PREFIX`，不新增 player 覆寫。這修正成功圖騰後的效果殘留與舊延後結算問題，不改 before-hurt 傷害取消決策，**G233 當時仍有部分盾漏救與重金屬搶先圖騰；目前圖騰修復見下段，部分盾仍未修正**。API 情境中的 fresh-runtime reload 只證明保存值可由新模組讀回；生命群組與姿勢只驗證請求，不等同原生生命上限、磁碟重啟或客戶端畫面驗收。

G233 當時沒有讓手持圖騰先行，其原因是尚未驗證這條路徑；假設其他訂閱者之後取消治療，亦不是已重現的原生死亡結果。G238 現在直接修正原 owner：確定致命且主手／副手真持原生圖騰時，合適的傷害先交原生，當場不消耗重金屬、不寫 claim、不自行清理效果。只放背包的圖騰不算可用；void／override／selfDestruct 保留重金屬原處理，不能見圖騰就對所有 cause 跳過。普通無圖騰、已確認 Totem cure、寫入失敗與排程撤銷的情境保留，正式 main 註冊事件整檔35項通過。

排除 override 有實際 Java 路徑：兩分支 [CursedSkewerItem](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/CursedSkewerItem.java) 用 ordinary_skewer／Float.MAX_VALUE，而作者共同 [bypasses_invulnerability tag](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/minecraft/tags/damage_type/bypasses_invulnerability.json) 明確包含該傷害。Mojang兩版圖騰檢查都先拒絕此 tag；Java原生圖騰不擋它，重金屬的LivingDeath仍可救。Bedrock在G238當時將平凡owner映射為override；該次只修正誤稱保留Java圖騰的註解。現行G242的cause修復與窄原生範圍見下段，不新增旁路。

G238 的[窄原生觀察](../tests/native/heavy-metal/totem-priority-observed.json)於2026-11-06 04:50 HKT完成39項：BDS1.26.60.6／server2.12.0-beta、server-ui2.2.0、gametest1.0.0-beta，gametest及upcoming_creator_features實際保存為1；來源固定100b6fde（與受檢3862b992同tree）。[原observer](../tests/native/heavy-metal/totem_priority_probe.js)直接載入正式 effect/runtime 的已註冊傷害／after-heal入口，使用真native Players／applyDamage；QA另用1.0身份，不冒稱完整候選載入。entityAttack的主／副手，以及magic／fall／none副手均先耗原生圖騰、產生正值TotemOfUndying治療；Heavy／Warmth隨後清除，無中毒或claim。void／平凡實際override maxfloat／selfDestruct帶Heavy時均保留手持圖騰、付款並救回1HP；無圖騰／只在背包同樣保留Heavy救援，背包圖騰不變。

**不符合Java的原生結果亦保留**：void／selfDestruct無Heavy controls沒有圖騰治療，玩家死亡、圖騰仍在；override／maxfloat無Heavy control則耗掉圖騰且產生正值TotemOfUndying治療，仍死亡且Warmth未清。後者不等同Java ordinary_skewer先拒圖騰，且證明正值治療不保證存活；既有清理還要求存活生命值，未把該control誤清。這個control差異不改標成全Java等價，沒有為它新增傷害旁路或復活。

本次正常stop／exit0、players0／errors空／OOM0，自己的QA世界已清且槽已交還。未重跑剩餘盾或舊保存；未驗其他addon後續否決、所有cause、client聲畫或完整家族保存。修復未新增屬性、interval、盾量追蹤、復活或版本例外，部分盾漏救仍未修正。

#### 平凡串的selfDestruct／maxfloat（G242，2026-11-06）

G238舊probe的selfDestruct只給100傷害，只有override才用Float.MAX_VALUE。因此它未否定selfDestruct＋真平凡串傷害這個候選。G242只改原applyOrdinary的cause，保留Float.MAX_VALUE、原延後排程及無敵／Heavy owner；不手動取走圖騰、猜剩餘盾、拆分／取消重播傷害或復活，不增加Player定義／Core邏輯。兩Java分支的CursedSkewerItem與bypasses_invulnerability／armor／resistance tags本輪已另讀；12:23 HKT的當前上游監控仍為各分支1.1.1。

[新observer](../tests/native/heavy-metal/ordinary_maxfloat_probe.js)在BDS1.26.60.6／server2.12beta直接載入正式food／effect訂閱，以真正Survival Player的useItemInSlot走預設Ordinary食用；不是直接呼叫回呼。固定07f2a760的[原生結果](../tests/native/heavy-metal/ordinary-maxfloat-observed.json)記兩場各100ticks的itemStartUse→itemCompleteUse及真扣1份，正式applyOrdinary各發一次selfDestruct／3.4028234663852886e38。無Heavy場死亡至0HP，副手圖騰仍在、無圖騰治療；有Heavy場由原before-hurt先付12000tick中毒與claim再取消，救至1HP，圖騰與無關Warmth保留。

12項窄檢查全部通過，正常stop／Quit correctly／exit0、players／errors／OOM皆0，peak433356800bytes，QA已清且先於來源CI還槽。首場fixture漏帶正式preparation會選用的既有java_three_alt，傷害前即停止，不能算cause失敗；修正只補齊三個原物品定義、容納預設native時長，不改handler／Player／config。首場原錯誤與正常停清保留於同一觀察記錄。

這證明本引擎下Survival模式Ordinary食用完成的圖騰繞過與既有Heavy救援，沒有重跑舊39案或fatal sensor。巨量傷害下死亡本身不能證護甲／抗性繞過；其他手槽／cause／addon仲裁、完整main啟動、保存重啟及client仍只沿各自既有證據，不擴稱完整Java parity。部分盾漏救仍未修。G240冷菜與G241餐盤姿勢保留；來源新配對身份是G242，不重用PR372原草稿G240。

#### 平凡串的Creative免傷邊界（2026-11-06，未修）

兩維持分支的原作都允許此食用路徑：[Forge ModItems](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L336)用alwaysEat、[NeoForge ModItems](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L406)用alwaysEdible；各自MultiBiteSkewerItem.finishUsingItem在完成後呼叫CursedSkewerItem.afterFoodCommitted，未排除Creative。實際使用自訂ordinary_skewer／Float.MAX_VALUE，作者以replace=false追加bypasses_invulnerability；不是直接呼叫genericKill。既有[兩版官方JAR／mappings來源](../tests/native/heavy-metal/damage-order-observed.json)本輪另核Player.hurt及Entity.isInvulnerableTo：該tag可穿過abilities／entity免傷檢查。原版generic_kill也在該tag，不代表兩個damage source相同。兩版ServerPlayerGameMode.useItem則對Spectator先回PASS，尚未呼叫物品；不為這個不可達的食用caller另造旁觀傷害要求。18:28 HKT僅刷新Grilling的兩分支，當前仍各為1.1.1。

[固定observer](../tests/native/heavy-metal/ordinary_creative_probe.js)在不改G242 runtime／Player定義的BDS1.26.60.6／server2.12beta中，依序測兩名真Creative Player，分別無Heavy／有Heavy。[原生結果](../tests/native/heavy-metal/ordinary-creative-observed.json)記兩場真getGameMode=Creative、各100tick itemStartUse→itemCompleteUse及保留1份food，原Ordinary fatal feedback各增加2筆接受的sound request。普通entityAttack control回false、生命10HP不變；食用後兩場同樣沒有before-hurt／heal／death、都留10HP，圖騰仍在。有Heavy者原Heavy／Warmth與null claim不變，沒有付款或1HP救援。feedback請求只見證程式路徑，不是聲音已聽到；未攔截或替換applyDamage，也不由事件缺席推斷所有引擎內部順序。

11個入口／control條件成立、4個Java傷害／Heavy期待失敗，raw passed=false原樣保留。BDS正常stop／Quit correctly／exit0、players／errors／OOM皆0，peak590299136bytes；wrapper因期待失敗exit1、MainPID0，自己QA已在shared flock內assert_idle後清除並立即還槽，不等來源CI。未重跑既有Survival39／12案、fatal／盾／保存／P140；本輪未改runtime或發布身份。

兩分支AdvancedSeasoningHandler.onDeath也沒有Creative排除：[Forge](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/AdvancedSeasoningHandler.java#L40)／[NeoForge](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/AdvancedSeasoningHandler.java#L41)在有Heavy且無中毒時取消死亡、移除Heavy、設1HP並付款。因此不能把保留Creative免傷或直接殺掉帶Heavy的玩家當成修復。

選定2.12型別的EntityApplyDamageOptions只有cause／damagingEntity；官方[applyDamage說明](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-experimental#applydamage)允許因免傷而回false。[selfDestruct原因名稱](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entitydamagecause?view=minecraft-bedrock-stable)描述kill來源，沒有承諾以applyDamage指定該enum即可繞過Creative。現在只確認這個selected engine／既有G Player／selfDestruct-maxfloat食用路徑有差距；其他cause／kill並未測量，不能因此全部封口。沒有未驗就改用它們，亦不加入mode例外、Player overlay、傷害重播或復活。Creative差距保持未修，G242已確認的Survival範圍保留；不擴稱一般所有免傷來源、護甲／抗性或完整Java等價。

本包既有Heavy原生腳本及G238／G242相關observer未測Entity.kill、原生命令kill或damage，沒有可沿用的Heavy攔截反證，也沒有成功證據。官方[Entity.kill](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable#kill)及[kill命令](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/kill?view=minecraft-bedrock-stable)有殺死實體的正面說明，沒有承諾before-hurt／可取消死亡與Heavy付款順序；[damage命令](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/damage?view=minecraft-bedrock-stable)則以整數amount為參數，不能直接表達原Float.MAX_VALUE。這些是尚未建立等價契約的獨立入口，不是本輪已否定的路徑；未以換字串掃cause、清health或kill繞過Heavy，也未為它們盲開另一場BDS或發布空G243。

#### 單一kill命令的Creative觀察（2026-11-06，未採用）

前段記PR375當時尚未測量的替代入口；其raw及歷史不改。後續明確續派一個不同的原生命令入口：[kill](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/kill?view=minecraft-bedrock-stable)支援player target，足以做有界能力觀察；沒有排序保證只限制直接採用，不禁止觀察。[同權限testfor](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/testfor?view=minecraft-bedrock-stable)先以同一固定QA name/tag selector核目標，兩者均需Game Directors與cheats。這次只各執行一次kill，不掃Entity.kill、其他cause／版本或其他command origin。

[固定observer](../tests/native/heavy-metal/ordinary_kill_command_probe.js)在G242原registered before/after-hurt及after-heal handler／原Player定義下，依序測無Heavy／有Heavy兩名真Creative Player。BDS1.26.60.6／server2.12beta的[原始結果](../tests/native/heavy-metal/ordinary-kill-command-observed.json)：兩場實讀Creative、10HP及正確effects／claim／totem，世界各只有該名Player；testfor均successCount1，kill均successCount0、沒有exception。before/afterHurt、heal、death全空，立即及四tick後仍10HP；Heavy／Warmth原樣、claim null。目標可找到及同權限控制成立，不等於kill已有成功效果；沒有可分析的傷害cause／amount／cancel事件，不能宣稱成功殺死後才無攔截，或付款發生在某個已觀察的死亡之後。

8個輸入／target／control成立、7個命令效果／Java及Heavy期待未滿足，raw passed=false原樣保留。BDS在19:06 HKT正常stop／Quit correctly／exit0、players0/errors[]/OOM0，peak502857728bytes；wrapper因期待未滿足exit1、MainPID0，QA在shared flock內assert_idle後清除，先於來源CI還槽。本輪不是食用完成或Ordinary修復，沒有改runtime／身份、預付Heavy、偽造hurt、清health、切模式／關免傷、Player overlay、重播或復活；原Survival／PR375／39案／fatal／盾／保存／P140不重播。

這個selected Script.Dimension.runCommand／selector／Creative SimulatedPlayer／既有G Player配置未建立成功kill與合格可取消hurt／Heavy付款救援，故不採為替代入口、不發布空G243。這不證明Entity.kill、其他origin、所有命令／cause或未來版本均失敗；本輪依限定問題做一次即停。創造模式食用差距仍未修，已確認的G242 Survival玩法保留。

#### 被動原生fatal sensor新路徑（2026-11-06，未採用）

官方[has_damage:fatal](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/filters/has_damage?view=minecraft-bedrock-stable)及[damage_sensor](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_damage_sensor?view=minecraft-bedrock-stable)提供另一個待驗入口，並未承諾Player或護盾／圖騰時序。[新窄對照](../tests/native/fatal-sensor/README.md)在BDS1.26.60.6／server2.12beta以真Survival Player、固定Mojang原Player及QA-only被動overlay執行，無Heavy handler或傷害取消。28個控制條件成立，無條件sensor、JSON property及data-driven event均有正向witness，因此不是沒有接到原生事件。

同10HP／吸收I／同期限、13傷害時，完整盾存活1HP卻發fatal event；先耗3盾者死亡，亦發同fatal event。[逐案與時序](../tests/native/fatal-sensor/observed.json)另記全鑽甲存活5.710000038146973HP且無fatal、圖騰真消耗／正值治療／存活卻有fatal。此predicate在本測配置無法分清必要的fresh／spent盾，依這個反例停止路線，不發布降級修復。data-event回應另晚於Script beforeHurt；晚回應只限制接入既有回呼，不是單獨否定所有原生component能力，也不由回應先後推斷內部判斷順序。條件式deals_damage與後續Heavy付款未測、未採用。

本場正常stop／exit0、players／errors／OOM皆0，QA已清／時段已還；沒有重啟、保存格式變更或runtime採用。G240及原圖騰優先修復不變，部分盾缺口仍在。此結果只限列明的引擎／Player定義／被動component與entityAttack cases，不推成所有Player或版本均不支持。

### 裝滿料理架重新放置

PR #382 的原 G248 草稿修正點支撐方塊時未送達既有 rack owner 的路由。2026-11-06 隔離原生觀察固定來源 head `99674927ab6d24f1586292baef9e1ae0d060faf8`、tree `23094ddc954374feca5fa7354b66241c3f29e3e1`。當時後續文件提交沒有修改該 runtime 或草稿身份。六面、拆回、附魔與失敗情境的既有 API 測試仍是另一層證據。

引擎為[官方 BDS 1.26.60.6](https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.60.6.zip)，Build 52886190。ZIP SHA-256 `cbbd5414fa6a310353ed1fc76a0ba691c3fd1ea852fd04bb76764ee4c1afdb98`；binary SHA-256 `ea16b541a448e07c337848d2c5f37321b706554b5216dd942f3f11e7a8ed2bad`。全新雲端測試世界僅綁 loopback，保留 online-mode 與空 allowlist；未使用客戶端、LIVE 或使用者電腦。診斷 BP/RP 使用獨立且兩次啟動相同的身分，載入原 rack runtime 與其依賴，不載 production main 或 Cookery；3822 個沿用檔逐一核對原來源，另有 4 個明列的診斷 manifest／entry／probe 檔，安裝後 3826 檔雜湊再次相符。

真實 Survival SimulatedPlayer 以 canonical codec 製作的 packed rack fixture 點石頭向上面；本次沒有原生拆架生成這件 fixture。後置 owner 取消時觀察到 native before-event、下一 tick cancel 仍為 true，沒有放置事件／方塊、物品扣除或 storage ledger。允許時觀察到一次 native before-event 與一次 playerPlaceBlock，原 block_placer 扣除一件並恢復 slots 5／8 的兩件 flint_and_steel、占用篩選及空鎖定 slot 6；名稱、raw lore、字串／數值／布林／向量 DP、耐久與冒險模式限制保留。沒有直接 setblock 架子或呼叫其放置 handler。正常 stop 後重啟同一個磁碟世界，透過非創建讀取確認 payload、filters、方塊狀態及持久 owner token 相同。兩階段各自通過，兩次退出皆為 0、stop 前皆為 0 玩家，無內容／腳本 error。

第一／第二階段 log SHA-256 分別為 `96c6a2546c044fa656dee0ce3b6c1fd0fdd170ee13c9cf3ae85e9f41b99998d9`、`4c51b5c72bf5de2adea88d6049285db8aa73e6e6e1e208e8aec6a0a3cef34993`。這是 rack 域的原生放置與保存結果，不是整包 admission、舊玩家存檔遷移或視覺驗收。沒有單獨計數取消後的 orphan helper，也未以另一架子替換已取消的目標；不把它擴稱所有競爭情境的證明。六面中只有向上面進行原生觀察，調味品與附魔的原生案例、其他 addon 仲裁、完整 main／家族與客戶端仍不在本次範圍。

2026-11-08 與 main `d2883392071ef23fc10c8d165df9ec7403025a75` 的包資訊／指南語系來源合流，料理架 runtime 與上述已測 head 逐位元組相同；因兩側都曾使用 G248，合流採用全新 G249 配對身份。原草稿 G248 history 雜湊與提交保留，G249 另行凍結來源；不把舊窄原生結果重標為 G249 全包／完整 main、家族、客戶端或 LIVE 驗收。
