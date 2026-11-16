# 已知問題與驗收缺口

目前來源身份與相依以 [baseline.json](../baseline.json) 為準；公開下載與原來配對另見 [RELEASING](RELEASING.md)，不能把不同候選的證據混用。以下區分「已有失敗觀察」、「來源缺陷已修但待復驗」與「能力／驗收尚缺」。舊候選的失敗不自動證明目前仍有同一 bug；來源改動、測試通過或 PR 關閉亦不證明玩家問題已消失。功能對照與五項保留需求見 [PARITY](PARITY.md)。

## 公開下載的物品安全限制

2026-10-18 對實際公開 G138 TEST／G149 stable JavaScript 的 API 故障模型重播，重現四種結果：不明掉落重試造成兩份掉落、錄製食譜回滾覆寫已換到的無關欄位、扣來源後拋錯造成來源遺失、背包已入帳後拋錯再掉落第二份產物。這是實際下載程式的 API 模型結果，不是原生伺服器重現、世界保存驗收或日常發生率。

後續來源修補沒有改變這兩個下載檔的 bytes；不可因 main 的來源已修就刪掉下載警示。安裝身份、雜湊與 Cookery 1.6.0 相依見 [RELEASING](RELEASING.md#保留公開下載與相依)。測試前保留世界備份；`client=false`、`production_ready=false`。

## 來源修補、原始失敗與待驗收場景

每項穩定 ID 保留自[收斂前 BUGS](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/BUGS.md)。表中的 G 編號限定原記錄，並非新的版本、部署或驗收宣稱。

| ID | 已知事實與來源修補範圍 | 必須保留的重現／驗收 |
| --- | --- | --- |
| RACK-PACKED-PLACEMENT | G249 整合修正既有 rack owner 的過窄篩選；保存格式不變。既有套件涵蓋六面與拆回；原 #382 固定來源的隔離 BDS 已驗向上 block_placer、後置取消及同世界磁碟重啟，精確來源與範圍見 [PARITY](PARITY.md#裝滿料理架重新放置) | 原生只量測石頭向上面與兩工具 payload；其餘五面、調味品／附魔原生覆蓋、完整 main／家族、客戶端及部署仍未於本輪驗證 |
| COLD-HOUTTUYNIA-DELIVERY | 舊成品寫入／drop已套用後拋錯會補發第二份；正常耗盡油壺丟本包可讀DP。已由原cold owner／油壺adapter修復，精確來源與證據只查[PARITY](PARITY.md#涼拌折耳根的製作交付) | 新真main場景驗普通、最後原料釋slot、滿包、確認回收及未確認drop；API故障模型不等於原生自然故障或真人操作 |
| PLAYER-PROPERTY-SLIMMING | [T3.5-b](REBUILD-PLAN.md#t3-5-property-slimming) 來源已由 32 減至 27 格；隔離 BDS 已核 27 格 schema、同 tick 合併與 72000 時計。物品／雙手 bank 格式不變 | 配對 BP/RP 的完整家族、原存檔首次載入／重啟／回退與實際 FP／TP／旁觀者仍待。低槽通道和 TACZ 路由未完成，不宣稱相容 |
| PREMIUM-OIL-CRAFT-REMAINDER | G201 來源改用原生單一 Premium Chili Oil 配方結果；Bedrock `playerCraftRecipe` after-event 對實際製作出的該油桶按數量歸還空桶，背包滿時交給玩家附近的掉落物。原 Java 配方與四種 shapeless 材料保留。因 Bedrock 事件沒有 Java 工作台格子的槽位資料，空桶改入背包／地面，尚未證明真人操作、取消順序或畫面結果；來源測試不是原生合成驗收 | 同候選 BDS 真工作台以任意排列製作 1 份與批次，核材料消耗、油桶數與空桶數；另驗滿包掉落拾取、非目標配方及客戶端事件行為。不可把事件 capability probe 或 API fixture 稱為 Java 全等／真人通過 |
| OIL-NAMED-TICK | G194 修復 26.60 命名事件 API 錯配：以 ownership-aware `isName` 取代不存在的 `isMine/name`，不呼叫不存在的取消方法；原生回呼消耗一次排程，只有未完成工作才重排。原形狀反例失敗，既有油機測試修後通過 | 同候選真引擎榨油→完成→收料、倒數途中拆除、卸載與重啟、重複事件及保存故障；來源模型不等於完整 BDS／真人驗收 |
| HAND-ACTION-PREPARATION | G157 與 G180 的 API 模型可重現新製 Secret 在延後拆串前被 idle 換成 THREE_ALT，原有嚴格 intent 因而拒絕；關閉動畫的 native_plain 與立即入爐也會遇到同根因。G181 以暫時 hand reservation 修復自家外觀替換競爭，未放寬 ownership | 原生新製 Secret 立即拆／入爐；動畫開／關、主副手、被其他玩家或 addon 換 metadata、取消、滿包與重試。來源測試不能證明 native 排程或客戶端已通過 |
| GRILL-DISPLAY-FACING | 舊 helper 將 Java pose rotation 直接取負作 entity yaw，北／南食材柄與放置方向相反；G182 對出生與後續 teleport 同用 `rotation-180`，東／西等價結果不變 | 四個 cardinal 實際查看三槽、四次翻面、區塊重載與 helper respawn；API fixture 已覆蓋位置與 yaw，但未證明實際 geometry／動畫畫面 |
| SECRET-INGREDIENT-VISUALS | G182 追加八種 Java 既有食材的 218–225 視覺索引、七階段色板、GUI color data 與 helper geometry；舊 food／hand-bank marker、油與失敗串 owner 不重新編號 | 八食材逐種穿串、雙手、未完成／失敗串、烤架、餐盤、七階段及保存重載的實際顏色與形狀；每stack背包圖示另查下列SKEWER-GUI |
| SKEWER-CONTENTS | 玩家曾回報配方不合、穿料後只見竹籤與吃空氣；G151／152 有取得契約、短配方、內容、圖像及共同資料守衛修補 | 正常取得→1／2／3 料穿製→烤製→盤／手持→食用／保存；空／不完整串不能被重複穿外層，合法零營養仍遵循原作。任意 stack icon 另驗 |
| CLIENT-HUD | 曾無森羅 UI、外露 `KT_HUD!` 資料、位置錯及秒級延遲；G245提前略過普通訊息／END的圖像群組，保留原packet清場，詳見[入口範圍](PARITY.md#進食hud的訊息入口與額外工作) | 觸控／Desktop、全食品、兩手、連吃、取消、END 隱藏與真實延遲仍未全面觀察；入口模型／BDS載入不是client建構耗時、FPS或發熱改善證據 |
| EATING-OWNER | G143 修 owning-player property 環境、副手進度、末段隱藏、RawMessage 等價比較及失敗掃描節流 | 近鏡放大、末段平片、換槽／重登、瓶子與食物 preparation 並存仍需當前驗收；不猜改 Java 曲線掩蓋失敗 |
| GRILL-DEFERRED-OWNER | G125 延後重讀 cancel 並核 type／permutation／owner／完整物品；舊四個原生 API 診斷用代用容器 | 後續 listener 取消爆炸、排程後換方塊、合法計時中拆爐；須保留整個 customBreak、容器內容與玩家結果 |
| ITEM-DELIVERY | G125 在扣料前核站點身份，保留滿包 planner、實際交付讀回與不明結果隔離 | 榨油機延後扣料、串譜／穿串／拆串滿包、外來槽位和掉落回收未知；未確認回收不得退原料或重發 |
| SEASONING-DATA-RELOAD | G124 合併目前資料根，取料／效果／HUD 共用 resolver，保存失敗恢復；不自動讀 Java datapack | 後根覆寫、錯誤根不部分生效、舊食物依新映射、未知 kind 與 provider 缺席；真人效果仍待驗 |
| SKEWER-GUI | 新client的modifications及cursor缺collection入口已在生成器修復；cursor保留原生圖示、真格子保留逐串圖層；已證及未證範圍只查[PARITY](PARITY.md#秘製串背包圖示gui-display)，不是三格製作視窗 | 尚無本次修正後client／畫面／幀率讀回；新log無位置Invalid expression仍未定位。雙手操作、資料保存與原圖層保留 |
| SEASONING-FLOW | 舊 LIVE 取瓶失敗；RawMessage／材料數與後續動作有來源修補，未有完整同瓶驗收 | 同瓶放三種必要 base→取回 PENDING→持續 80 tick→SPECIAL→向有串烤架撒料；核材料、uses、取消／換槽／重登，不能用改配方或即時轉換通過 |
| SEASONING-EXPLOSION-CANCEL | G117 延後工作僅在 cancel 明確 false 時繼續；取消／event 讀失敗保留瓶、ItemStack、容器及保存記錄 | 在瓶 handler 後取消爆炸，驗內容與 ownership；未取消爆炸的原作毀損規則不變。API 模型不是原生事件結果 |
| PLATE-SATURATION | G116 餐盤在寫 hunger 後重取 saturation／effectiveMax，失敗回滾；舊 trace 曾在 hunger 10→13 後仍用 cap 10 | 重現相同飢餓／食物及原生 cap 條件，核一次營養結算、不吞物品、不虛構 max；同候選 Player／client 待驗 |
| HANDHELD-SATURATION | G117 修手持提前結算的舊 cap；與 G116 餐盤路徑是兩個問題 | hunger／saturation 10／10、兩份熟牛肉串、25 tick 後停止，並以 10／2 對照；核新 cap、metadata、重複事件及寫入失敗回滾 |
| PLATE-USE-ARBITRATION | G116 有 block／item-use 仲裁與較近 entity 排除 | 持多份串向盤插入後不能額外吃掉剩餘串；另驗合法 air-use、潛行副手、其他方塊與取消；真輸入順序待驗 |
| PLATE-PLACED-DISPLAY | G118 有目前內容、FIXED transform、1–5 份與四朝向的專用來源 | 固定／秘製串放盤、即看、取一份及區塊重載；核內容、材質、光照與無殘影。舊 tiny-edge-pixel／朝向故障保留其候選身份 |
| PLATE-HELD-CONTENTS／DECODE | 目前四格來源與原型限定結果見 [T3.5](REBUILD-PLAN.md#t3-5-property-slimming)；全手持 owner 已共用快照，放置與手持旋轉仍分開 | 1–5 份、主副手混持盤／瓶／串、切槽、重登及旁觀者；舊 stored1／4→0／3 與 float32 模型不認證新 transport |
| HEAVY-METAL-COMMIT | G221修正到期漏付；G238修復合適傷害下的雙手圖騰優先；G242的Survival真Ordinary圖騰繞過／Heavy救援已確認。[Creative反例及其他範圍](PARITY.md#heavy-metal-damage-order)由該段持有，部分盾漏救仍未修 | Creative真食用後沒有傷害事件或Heavy付款／救援，仍未修。原override控制保留；巨量傷害死亡不證護甲／抗性繞過。其他addon仲裁、聲畫及crash原子性仍有限制 |
| OIL-RESIDUE-PLANTS | 已明列 29 類植物適配與兩次作用一次扣料；甜菜四階段對應、竹子 1–2 節與葉片下移、海帶長入水方塊並保留含水層已依 Java 來源實作；未知方塊／掉落／含水層恢復結果不退成本 | 竹子無 Java stage 狀態（僅以 16 高上限停止）、海帶含水層原生 `setWaterlogged` 讀回、其他 feature／外部植物仍缺；正常施肥／採果、上下半、光照／鄰位與重載待 staging 驗 |
| JAVA-POT-LIFECYCLE | G122 有指定 exact／flex 配方、備料／翻炒／結果階段、保存與品質；有限 Java 品質向量不是完整 PotBlockEntity trace | 真鍋加油→備料→三翻→盛裝、熱源／卸載／重啟、冷卻、兩手連吃、滿包／拆鍋／保存故障及真營養；其他作者配方與未知私有資料不猜轉換 |
| CUISINE-CONSERVATION | G120／122 修取消後清資料、出料讀回、批次 credit 及手部／站點實際寫入所有權 | 取消／拆鍋／取出／重登／不同 operationId 不得重複交付；確認站點回前像後才補償本次仍擁有的成本；不明保存保持隔離 |
| EATING-ACCEPTANCE | 完成事件已補兩手／槽／metadata核對，短暫手部視圖恢復已補呈現恢復；API情境通過。G81 僅閉合有完整 counter 的 stop→leave 分支；直接leave無stop依[擁有者已接受的平台差異](REBUILD-PLAN.md#t3-4-direct-logout-policy)處理。BDS1.26.60.6已確認23／25／26／90tick離線無stop；兩手離線／重登API情境通過，真人待驗 | 早停、24／25／26 tick、完整 90 tick FOUR、換手／換槽／連吃、stop→leave／重登；普通副手 air-use 單獨驗；核份數、營養、效果、逐口與音效 |

G182 的資產清理只採用目前 canonical 樹中無字串引用的 846 個整檔與混合檔 16 個定義；八食材新增資產均有 consumer。G156 的有限前後畫面證據保留原候選身份，不能代替 G182 全部既有物品／放置表面的前後對照、完整相關家族與同世界重啟驗收。

## 其他必須保留的界線

- **HELD-SNAPSHOT-RECOVERY**：既有動畫提交失敗後換回先前內容，會因舊去重而留下不相符frame；G237由同一publisher重新送完整兩手generation，兩種故障情境通過。具體API／Molang範圍及未觀察的原生客戶端限制只查[PARITY](PARITY.md#手持快照的提交失敗回復)。

- **WARMTH-HEAT-SOURCES**：G234熱源與G236時機／同世界正常重啟已有原生觀察；結果與仍未驗證的範圍只查[PARITY](PARITY.md#溫暖效果的熱源判斷)。跨模組完整同tick順序、客戶端與自動非玩家實體仍非完整Java等價。

- **ADVANCEMENT-CLAIM**：目前owner、單次XP／重複與pending拒絕的原生觀察，以及仍有的限制只查[PARITY](PARITY.md#進度獎勵與領取紀錄)。未實作未發XP恢復，不宣稱跨API原子性或真人結果。
- **天然要塞**：公開 integration API 的新生成／25% 替換協議是既有擴展，不能用附近方塊猜歷史。固定 Java `FortressHouttuyniaHandler` 的現行要求是要塞箱 bonus loot，main 已有原生 loot wrapper；[既有 #405](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/405) 修正 PARITY 的過時分類。新生成協議未完成不等於這個 Java loot 功能缺失，詳見下方重審及 [API](BEDROCK-INTEGRATION-API.md#新生成宿主)。
- **平台能力與替代實作**：真自訂流體、Numb 準星、Pepper 接觸、任意食品／smoking 回呼和 Create／Maid 分項見下方重審。Pepper 接觸已有分桶 AABB 路徑；其物理近似仍有差距。不得把「沒有同名 API」、尚未實測或沒有第三方 provider 一律寫成永久無法實現。
- **視覺全量**：全物品第一人稱／側面貼圖、瓶／盤／串完整操作仍未閉合。舊 G17 editor captures、代表瓶預覽、隔離兩食品片及零玩家 BDS 都只保留原範圍。
- **效能**：曾有 slowdown／記憶體警告及有限 profiling，沒有約定的完整通過預算。圖像裁剪、logging 成功或來源計數下降不是 FPS、延遲或 Watchdog 改善的實測。
- **擁有者決策**：D3 HUD、D5 背包圖示、D6 player 覆寫及其他 D1–D10 仍由 [REBUILD-PLAN](REBUILD-PLAN.md#10-待擁有者決定事項) 管理。T2.6 不代替決策或變更 runtime。

## 2026-10-28 草稿收斂

- [#255](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/255)、#256、#257 的相容、食材與朝向修正已由 G181／G182 承接；[#290](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/290) 的聲音與 [#291](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/291) 的首次 Secret 顯示來源已併入 G187。關閉舊草稿不代表真人驗收通過。
- [#264–#273 診斷鏈入口](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/273) 保留各次 ONE 動畫、粒子、完成時序與 local-stop 的原始結果；未將這些互相疊加的候選放進 G187。ONE 與其他食用動畫的原生／真人缺口仍按上表及 PARITY 跟進。原分支與提交不刪除。
- [#260 fault probe](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/260) 的失敗保留：需測試夾具在同步 setItem 的 after-body 強行重入，尚無 BDS 支援該重入的證據。已交付的獨立抽查工具在 #263；該綠燈不修復 #260 的失敗。今後若有可重現的原生事件來源，再依該具體行為處理，不把它當作目前所有 runtime 發布的凍結條件。

## 需求與證據保留

[T1.3-1 至 T1.3-5](PARITY.md#舊-pr-保留需求)完整保留交易所有權、碰撞／選取、20 種 THREE 食用、固定五幀 icon 及併發餐盤／食譜需求。舊 PR 關閉是工作整理，不是修復或驗收。

原始回報與更細的歷史限定保留於[收斂前 BUGS](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/BUGS.md)、[PARITY-MATRIX](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/PARITY-MATRIX.md)及[公開下載稽核](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/PUBLIC-DOWNLOAD-INSTALLATION-20261018.md)。舊工具／workflow 風險以 T2.4 後的實際入口為準，不能把已退役的驗證鏈描述成仍在執行；玩家缺口不因工具退役而被刪除。

## 2026-11-16：能力、取捨與實作成本重審

範圍：公開 main `e43c0a4752ccd68057c91b6b5b46ec524b17a3a2` 的 PARITY、上列所有已知問題、現行 REBUILD-PLAN、ARCHITECTURE、BEDROCK-INTEGRATION-API、GUIDE-STANDARD、canonical BP/RP 與 20 個 open PR 的實際 changed filenames。Java 仍固定 `breezeth-CN/KaleidoscopeGrilling@9a1acdab27698457bec16c9362678e574895a28c`。本節記錄來源審查與可實作路線；玩家操作、客戶端及原生效能沒有在本輪執行。

目前 BP manifest 選擇 `@minecraft/server 2.12.0-beta`、引擎最低 `1.26.60`。2026-11-16 查閱的官方 stable／experimental 文件只用於候選能力調查；文件中新出現的 API 不代表當前候選已具有它。任何新 API 路徑先以既有版本的型別／原生能力核對，再接原 owner；不以升級假設、特定伺服器分支或全世界掃描掩蓋缺口。

下表「待整合」指已有來源或具體可實作方案；「部分」指已有行為但有列明差異；「保留取捨」指已有明確決策／失敗來源；「待評估」指等價路線尚未證明。沒有一項因單一 API 缺席而宣稱所有 Bedrock 組合皆不可能。路徑相對於 `projects/grilling/gameplay_core/behavior_pack/`，RP 路徑另標。

| 功能／原標記 | 重審結論與來源 | 改善路線及成本界線 |
| --- | --- | --- |
| 秘製串：任意食品完成回呼／smoking | **部分**。Java `SecretSkewerItem.finishFoodAndEffect` 逐食材執行 `finishUsingItem`，再恢復營養；`scripts/secret_compat_runtime.js` 和 integration registry 只承接已登記資料／行為。 | `ItemFoodComponent` 可讀營養等公開欄位；`ItemCustomComponent.onConsume/onCompleteUse` 接自有物品。任意第三方私有 callback 不會由讀 component 自動重播；使用既有 provider 契約擴充明列能力。避免替每種食品新增掃描器或猜 smoking 配方。 |
| 原生合成後返桶 | **部分**。`PREMIUM-OIL-CRAFT-REMAINDER` 已沿 `playerCraftRecipe` 按實際結果返桶；Java 工作台原槽與 Bedrock 背包／掉落位置不同。 | 保留事件式交付。若採新容器 API，須先證明原合成槽資料和取消時序可取得；不能把 after-event 當作原子合成交易。 |
| 90／100／25 tick 食用與時長物品 variant | **保留取捨**。Java `MultiBiteSkewerItem` 每次使用選 profile；本 repo 原生早扣份 spike 已觀察到再次原生扣份，故 variant 仍有實際用途。 | 現有事件式 preparation 已停止每 tick 重讀未變手持。候選 `use_duration`／`onReleaseUse` 要核對目標版本及原生完成扣份；不能只因新文件存在就刪 ID。 |
| 直接斷線食用結算 | **保留已接受差異**。Java `onPlayerLoggedOut` 即時結算；已保存的 Bedrock 原生觀察為 disconnect 無 stop、before-leave 寫入受限、延後 Player 失效。 | 仍依 T3.4 決策處理；不以每 tick 提前扣份補償。只在可證實的新事件時序／可寫入能力改變時重開實作。 |
| Pepper `entityInside`／踩上 | **部分，原「未支援」過廣**。`scripts/pepper_contact_work.js` 已有 AABB 分桶、每 tick 16 實體／64 probe 上限；`world/pepper_tree_runtime.js` 已處理載入／離開與 20 tick 刺傷。 | Java 葉內 `makeStuckInBlock(0.8,0.75,0.8)` 目前以 Slowness I／10 tick 近似，踩上也走同一緩速函式，且 `applyDamage(1)` 未指定 Java sweet-berry cause。應在原 leaf owner 分開踩上／內部接觸並驗動量／傷害種類，協調正在改此檔的 #411；不重建全維度輪詢。官方 `onEntity` 是實體送來的命名事件，不能直接視為通用 enter／inside 事件。 |
| 椒葉支撐、作物掉落及油渣施肥 | **部分／已有改善 PR**：#411 補剝皮橡木支撐；#409 保留 `doTileDrops`。`OIL-RESIDUE-PLANTS` 的 `plant_fertilizer.js` 明列 29 類適配；竹子以 16 高上限近似缺少的 Java stage，樹／蘑菇等 feature、外部植物仍未通用。 | 沿現有 random tick／事件入口整合已知修復；其他植物可在原 adapter 擴充明列 block permutation、空間條件和交付回復。能寫方塊不等於能重播任意原版／第三方骨粉 feature；先核來源及含水層原生結果，不另開世界掃描。本次避開既有 owner 的 source files。 |
| 三種油的真正流體註冊 | **原生註冊路徑仍待評估；桶／大缸已有替代**。官方 `LiquidType`／`BlockFluidContainerComponent` 提供既有液體與容器能力，未提供自訂 Java Fluid registry 的對應註冊介面。 | 方塊狀態、具名 tick、桶和流體 provider 能繼續改善有限互動；這些不能證明原生傳播、游泳、尋路、Create 管線皆等價。保留原 oil owner，先定義要還原的具體行為及有界工作量。 |
| 榨油機尋缸 | **已有性能／順序改善 PR #329**。原 `oil/oil_machine_runtime.js` 最多逐讀 405 座標，PR 改 POI 候選再核實方塊與資料，保留 Java 遍歷選擇順序。 | 直接審查／整合該 PR；Beta／POI 實驗是實際依賴。候選數下降不代稱 TPS 提升；完整交易和當前家族尚需原生核對。 |
| Numb 準星與身體動畫 | **部分**。`scripts/numb_visual_runtime.js` 已有原生身體 pose；Java `NumbCrosshairMixin` 只在第一人稱把準星平移為半徑 24 GUI 座標單位、角速度 2.2rad/s 的圓周。 | `ScreenDisplay` 支援 HUD 可見度，沒有準星平移方法；候選為原有 JSON UI 的準星圖層動畫和狀態通道。`Camera` 搖晃會改視野／瞄準，不能當作只移動準星的等價替代。先核 client UI 和觸控／第三人稱條件，動畫在 client 執行，避免逐 tick camera 命令。 |
| Heavy Metal 部分吸收盾／Creative Ordinary | **部分**。`heavy_metal_damage_runtime.js`、`effect/runtime.js` 與 PARITY 保留具體失敗；#407 已有原生吸收盾候選調查。 | `entityHurt`、`entityHeal`、effect 讀取及傷害選項可組合調查；須保留圖騰先後及已發生的吸收值，不以名義 amplifier 充當剩餘盾。沿 #407，不新增旁路復活或再造 probe。 |
| 持續效果鏈／附魔金蘋果 | **已有改善 PR #410／#413**。前者重用有限 Java merge，後者修正原生再生時長。 | 接現有 food owner；與本次 descriptor 解碼快取不共檔，不把來源差異寫成平台限制。 |
| 未完成串主手拆解／空氣使用 | **部分／已有 #412**。主手 block 互動可用同一 owned transaction；該 PR 已修。沒有 use behavior 的 unfinished item 是否原生產生 air `itemUse` 仍獨立待確認。 | `onUse`／`onUseOn`／before block 事件可各有作用；不能手動 emit 假事件便聲稱原生 air-use 完成，也不能為事件加入可食用行為改變姿勢／玩法。 |
| 秘製串背包圖示／游標圖示 | **部分**。`scripts/secret_gui_state.js`、RP JSON UI 和生成器已有逐 slot 圖層；缺 collection 的 cursor 路徑保留原生圖示。 | 可沿現有狀態通道重用原 sprite layers；新版通用 icon／property API 必先確認任意 stack、容器／游標與目標版本。避免再加 variants、無條件所有 slot 子樹或全背包每 tick 重寫。 |
| 手持／放置模型、貼圖、動畫 | **來源實作與畫面缺口分開**。餐盤方向 #398/#400、動態邊緣 #399、茶圖層 #396/#397、薄片 #395、油刷 #408 已有 source PR。 | 原生 render controller、bone visibility、Molang 和 block permutations 可承接。優先原 owner／生成器共用素材，不用更多 baked geometry 掩蓋 pose 錯誤；精確畫面仍依 Blockbench 和第一／第三人稱觀察。 |
| 被動準星 HUD | **已退役實作取捨**。`scripts/hud/crosshair_hud_runtime.js` 的 register 已為 no-op，沒有被動玩家 poll；進食 HUD 是另一條現有通道。 | 不把 no-op 誤作目前每 tick 效能成本。恢復能力時沿既有 HUD 接口／D3 決策，避免新增 actionbar 競爭。 |
| Warmth 熱源查找 | **可研究優化，尚未替換**。`scripts/effect/runtime.js` 保留 5×3×5、原 `lit` 狀態及 grill DP；最多 75 次 `getBlock`。 | 官方 `Dimension.getBlocks/containsBlock` 可原生篩選型別／tag／permutation，但沒有任意 `lit` 狀態通配條件。僅列已知 vanilla IDs 會漏外來 lit 方塊；先證明完整候選集合和卸載邊界再換，不能以縮短程式碼犧牲行為。 |
| Projectile ground 啟動索引 | **已有性能 PR #391**。不可變 alias 索引可延後到真正需要時建立。 | 合併現有候選並保留低記憶體原生驗證；不另外建立啟動掃描或重做其基準。 |
| 共用事件 router 每次分派複製路由 | **本次接入 Core SDK 0.1.1**。來源 [Core #64](https://github.com/burnt-tea-dev/senluo-bedrock-core/pull/64)／`c7f340f148b91b30a2e9cdffe90f04ad893e1849`；透過現有 `tools/sync_core_sdk.py` 產生 `scripts/host_api/event_router.js`。 | 路由清單在訂閱／解除訂閱時換新，事件保留當次快照，避免每次事件展開副本；取消、priority、observer、解除自身和 pack 隔離不變。block interact 的必要 filter 陣列仍保留，沒有新 API／全域監聽。 |
| 自訂效果重複 JSON 解碼 | **本次來源已改善**：`scripts/effect_state_runtime.js:dodgeDescriptor` 只保留最後一份原字串及 descriptor，命中也回傳獨立小物件。 | 每次必要的 DP 讀取、原文比對、世代、時間與扣款仍由原 owner 執行。不同原文立即取代單筆快取；無效 JSON 與不存在效果同樣可命中。下方列可重現的操作數，沒有原生速度宣稱。 |
| `player.json`／手持同步 | **已實作低槽替代，整合仍需核對**。現行共同快照路徑和自有 extension 已取代早期 32 格描述。 | 沿 Core／家族單一有效 player definition；API property 能同步資料不代表第三方玩家定義可同時覆寫。遵守現有 schema／動畫路由，不為本次快取加欄位。 |
| Fortress Houttuynia 戰利品 | **原缺失標記過時，已有 #405**。重新讀固定 Java `FortressHouttuyniaHandler`：`nether_bridge` 新增 65% bonus pool、1–2 rolls、每次1–3；main 已有同義 loot wrapper／bonus JSON。 | 新區塊／25% 替換的舊 integration 協議不能當成本 Java 類別的未完成標準。優先整合 #405；自然開箱分布及其他 pack 同名 loot 覆寫仍待驗。 |
| Create／Touhou Little Maid 等選用模組 | **外部依賴／provider 未移植**。Java `compat/create`、`compat/touhoulittlemaid` 依靠對方機械／AI API；不是 Grilling 所有食物都缺失。 | Bedrock 實體行為、容器及既有 script provider 可實作明列能力，但缺少對應 Bedrock owner 時不能冒稱已聯動。按能力契約接入、按需執行，不移植整個外部模組或掃描任意機器。 |
| 鍋具、瓶→烤架→盤→食用、料理架、指南及獎勵 | **已有實作／仍有列明缺口**。本頁各穩定 ID、PARITY 和現行 owner 保留更細範圍。`ADVANCEMENT-CLAIM` 未實作未發 XP 恢復；指南宿主 v1 的 32 分類、單層父類及製程多語 map 限制是 provider 契約。 | XP 與 claim 的兩次 API 寫入不能宣稱 crash 原子性；只在可判斷實際交付時設計恢復。指南沿原宿主改善分類／本地化接口；重建獨立 UI 會改操作契約。API 模型、局部原生及來源成功不互相代替；未有新錄影也不重列為「引擎做不到」。本次只用既有定點檢查，不新增 tests／CI／fixtures。 |

### 枚舉覆蓋與未聲稱的範圍

上表 23 群是能力與改善工作的聚合，**不是 23 個物品，也不是全物品、全操作或全 API 已驗收**。輸入包括 PARITY 主表 23 個功能列、本頁原有 27 個穩定 ID，以及後續列明的三個能力 ID；每個原條目保留自己的失敗、來源與待驗條件。相同問題在多份現行文件重複描述時只聚合一次，沒有以歷史狀態文件的數量充當覆蓋率。

| 現行原條目 | 本次重審承接群 |
| --- | --- |
| `RACK-PACKED-PLACEMENT`、`COLD-HOUTTUYNIA-DELIVERY`、`SKEWER-CONTENTS`、`GRILL-DEFERRED-OWNER`、`ITEM-DELIVERY`、`SEASONING-DATA-RELOAD`、`SEASONING-FLOW`、`SEASONING-EXPLOSION-CANCEL`、`PLATE-SATURATION`、`HANDHELD-SATURATION`、`PLATE-USE-ARBITRATION`、`JAVA-POT-LIFECYCLE`、`CUISINE-CONSERVATION` | 鍋具／完整製作交付群；跨作者 callback 另由秘製串與 provider 群承接 |
| `HAND-ACTION-PREPARATION`、`EATING-ACCEPTANCE` | 食用時長 variant、直接離線及未完成串互動群 |
| `GRILL-DISPLAY-FACING`、`SECRET-INGREDIENT-VISUALS`、`EATING-OWNER`、`PLATE-PLACED-DISPLAY`、`PLATE-HELD-CONTENTS／DECODE`、`HELD-SNAPSHOT-RECOVERY` | 手持／放置模型群；快照與同步另接 player definition 群 |
| `CLIENT-HUD`、`SKEWER-GUI`、計畫 D3／D5 | 被動準星 HUD、現有進食通道、背包／游標圖示群；未復原的聲畫與延遲仍保留 |
| `PREMIUM-OIL-CRAFT-REMAINDER`、`OIL-NAMED-TICK` | 原生返桶、榨油機尋缸及既有命名排程群 |
| `PLAYER-PROPERTY-SLIMMING`、計畫 T3.5／D6、ARCHITECTURE 的唯一 player owner | player definition／手持同步群 |
| `HEAVY-METAL-COMMIT`、`WARMTH-HEAT-SOURCES`、`ADVANCEMENT-CLAIM` | Heavy Metal、Warmth、自訂效果解碼及進度獎勵群 |
| `OIL-RESIDUE-PLANTS`、PARITY 作物／天然生成列 | 椒葉／油渣適配、Pepper 接觸及 Fortress loot 群 |
| BEDROCK-INTEGRATION-API 的任意 callback、圖像別名、新生成歷史限制；GUIDE-STANDARD 的分類／本地化限制 | 秘製串 provider、GUI／模型、Fortress 舊擴展及指南群 |

REBUILD-PLAN 的已完成歷史階段、舊 source-VM／診斷鏈、公開下載舊版本與安裝安全限制仍按原文件管理，不視為當前引擎缺少玩法 API；存檔與授權規則也不當作功能缺失。來源中 `unsupported`／`unavailable` 的資料損壞、已卸載方塊或未知交付拒絕，是保留資料的守衛；除非有對應玩家能力缺口，不能按關鍵字自動算作未移植。尚未逐項執行所有食材、裝置、多人時序或第三方作者模組；有限 Java 直接讀取範圍見下列來源，其他數值仍依既有固定 `data/java/`，不宣稱重新執行全 Java 基準。

### 油壺展示的手槽讀取（G270，2026-11-16）

續查 main `3cdc9cf6300d3790de5b44c12eadf160bdcc53c3` 與全部22個開放PR的檔案後，在原 `scripts/oil_brush_visual_runtime.js:syncOilBrushVisual` 移除同次迴圈對同一手槽的第二次讀取。判別油壺的 ItemStack 直接交既有 `readCookeryOilPot`；下一次同步仍重新讀取。活動刷油的獨立物品身份核對、20tick期限、兩手通道與原生快照傳送不變，不增加跨tick快取、全域事件或排程。

這承接上表「手持／放置模型」群的實作成本改善，**不新增缺口群數，也不把尚未完成的油刷貼圖／第一人稱問題標成已修**。[#408](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/408)持有模型與動畫；[#416](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/pull/416)持有站點展示，兩者都沒有修改本檔或本節。Java原始依據為固定 [OilBrushAnimation](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/oil/OilBrushAnimation.java#L12-L69)的20tick、主副手與三種油類。實際畫面、Java手臂曲線及模型均沿既有路線，這次沒有改動或重新驗收。

官方 [Container.getItem](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/container?view=minecraft-bedrock-stable#getitem)與 [EntityEquippableComponent.getEquipment](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityequippablecomponent?view=minecraft-bedrock-stable#getequipment)已提供所需ItemStack。這是原生API使用方式可直接改善的項目，無需升級既有server依賴、換ID、增加helper或把顯示變成庫存寫入。

臨時計數透過現有ESM邊界載入真正production模組，沒有改寫模組或保存新測試。100次雙手idle油壺同步的 `getComponent` **400→200**、主手 `getItem` **200→100**、副手 `getEquipment` **200→100**；該限定路徑的手槽讀取減少50%。六組「主／副手×三種油」各20個活動frame，手槽讀取合計各 **80→60**（25%），活動手的獨立ownership核對保持。兩手非油壺仍為一次主手加一次副手讀取。

前後序列包含四種滿壺狀態、空壺、主副手互換、六組完整20frame、到期、換物取消、明示取消及缺少油metadata；產生的**134份快照請求**、**143個函式回傳**與最終物品／DP／log相同，整個序列SHA256同為 `038b21636add072b037cdcb46e662d4497dac61a08caccdf6da7f046240046cb`。這個有界對照沒有模擬native渲染或宣稱所有故障軌跡相同；被刪除的多餘第二次getter亦不再有獨立失敗點。既有四檔檢查（oil-api、family-oil-food-api、skewer-item-snapshot、held-snapshot-recovery）94/94通過，未新增或修改tests／fixtures／CI。

數字只代表JavaScript請求數，不是FPS、TPS、耗電、CPU或裝置記憶體的實測。公開來源候選使用新配對身份2.8.270；版本歷史保留，Cookery1.6.6／server2.12.0-beta／UUID不變。未執行BDS、client、用戶電腦或LIVE，未發布、合併或部署。

### 本次解碼成本與資料界線

在未改寫 production module 的既有 `createFixture` ESM 邊界執行實際 `main.js`，單玩家持續 100 ticks，效果原文為 `warmth:{until:100000,amp:0}` 與 `projectile_dodge:{until:100000,amp:1}`。只計數傳入這份原文的 `JSON.parse`，不以其他 JSON 工作混入改善數字：修改前 **500 次**，修改後 **101 次**（減少 399 次，79.8%）。兩邊原生 DP 邊界讀取同為 **100 次**、保留效果原文相同、health 同為20、fixture 記錄 write count 同為6、error log 皆空。

另用真正 `readEffects` 同 tick 讀1000次，這份原文 parse **1001→2**、DP讀取仍為1；100輪 read／write／advance tick 的 parse **499→99**、DP讀取同為99。這些是限定輸入的 JavaScript 操作數，不是 Bedrock CPU、TPS、FPS、裝置記憶體或實機載入量測。不同玩家交替不同原文可能沒有命中；快取始終只保留一份原文，不按玩家／效果數量增長。

臨時檢查另核同 tick 外部改寫、200tick效果扣款、無效JSON拋錯、恢復有效資料、清空及 until／amp 數值轉換連續失敗後恢復原世代；原讀取和資料保護結果不變。既有6個玩法檢查檔194項通過（heavy-metal、warmth、food-finish、a2732、a2749、projectile-dodge-movement）。接入 Core SDK 0.1.1 後再跑既有 skewer-item-snapshot、board-api、food-finish 三個檢查檔，233項通過；這與前述194項有重疊，不相加計數。來源沒有新增測試、fixture、CI、排程器、持久欄位、物品ID、模型或動畫。本次依公開 main／20個開放PR的精確來源歷史凍結配對來源候選 2.8.267；BP/RP UUID及Cookery／Script API相依保持。這不是實際安裝版本核實或發布／部署，整合到更新家族來源時仍須保留其既有修改並分配適用身份。

官方能力參照（2026-11-16 查閱）：[BlockCustomComponent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockcustomcomponent?view=minecraft-bedrock-stable)、[BlockComponentEntityEvent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockcomponententityevent?view=minecraft-bedrock-experimental)、[BlockFilter](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockfilter?view=minecraft-bedrock-stable)、[Dimension](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dimension?view=minecraft-bedrock-stable)、[ItemFoodComponent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemfoodcomponent?view=minecraft-bedrock-experimental)、[ItemCustomComponent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemcustomcomponent?view=minecraft-bedrock-experimental)、[WorldAfterEvents](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-experimental)、[ScreenDisplay](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/screendisplay?view=minecraft-bedrock-stable)、[Camera](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/camera?view=minecraft-bedrock-stable)、[LiquidType](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/liquidtype?view=minecraft-bedrock-stable)、[BlockFluidContainerComponent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockfluidcontainercomponent?view=minecraft-bedrock-stable)。

重新直接讀取的固定 Java 原碼：[PepperLeavesBlock](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/world/PepperLeavesBlock.java)、[NumbCrosshairMixin](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/mixin/NumbCrosshairMixin.java)、[MultiBiteSkewerItem](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/MultiBiteSkewerItem.java)、[SecretSkewerItem](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/SecretSkewerItem.java)、[FortressHouttuyniaHandler](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/world/FortressHouttuyniaHandler.java)。其餘 Java 類別／配方詳見已固定來源的 `data/java/`。
