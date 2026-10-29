# 已知問題與驗收缺口

目前來源身份與相依以 [baseline.json](../baseline.json) 為準；公開下載與原來配對另見 [RELEASING](RELEASING.md)，不能把不同候選的證據混用。以下區分「已有失敗觀察」、「來源缺陷已修但待復驗」與「能力／驗收尚缺」。舊候選的失敗不自動證明目前仍有同一 bug；來源改動、測試通過或 PR 關閉亦不證明玩家問題已消失。功能對照與五項保留需求見 [PARITY](PARITY.md)。

## 公開下載的物品安全限制

2026-10-18 對實際公開 G138 TEST／G149 stable JavaScript 的 API 故障模型重播，重現四種結果：不明掉落重試造成兩份掉落、錄製食譜回滾覆寫已換到的無關欄位、扣來源後拋錯造成來源遺失、背包已入帳後拋錯再掉落第二份產物。這是實際下載程式的 API 模型結果，不是原生伺服器重現、世界保存驗收或日常發生率。

後續來源修補沒有改變這兩個下載檔的 bytes；不可因 main 的來源已修就刪掉下載警示。安裝身份、雜湊與 Cookery 1.6.0 相依見 [RELEASING](RELEASING.md#保留公開下載與相依)。測試前保留世界備份；`client=false`、`production_ready=false`。

## 來源修補、原始失敗與待驗收場景

每項穩定 ID 保留自[收斂前 BUGS](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/BUGS.md)。表中的 G 編號限定原記錄，並非新的版本、部署或驗收宣稱。

| ID | 已知事實與來源修補範圍 | 必須保留的重現／驗收 |
| --- | --- | --- |
| HAND-ACTION-PREPARATION | G157 與 G180 的 API 模型可重現新製 Secret 在延後拆串前被 idle 換成 THREE_ALT，原有嚴格 intent 因而拒絕；關閉動畫的 native_plain 與立即入爐也會遇到同根因。G181 以暫時 hand reservation 修復自家外觀替換競爭，未放寬 ownership | 原生新製 Secret 立即拆／入爐；動畫開／關、主副手、被其他玩家或 addon 換 metadata、取消、滿包與重試。來源測試不能證明 native 排程或客戶端已通過 |
| GRILL-DISPLAY-FACING | 舊 helper 將 Java pose rotation 直接取負作 entity yaw，北／南食材柄與放置方向相反；G182 對出生與後續 teleport 同用 `rotation-180`，東／西等價結果不變 | 四個 cardinal 實際查看三槽、四次翻面、區塊重載與 helper respawn；API fixture 已覆蓋位置與 yaw，但未證明實際 geometry／動畫畫面 |
| SECRET-INGREDIENT-VISUALS | G182 追加八種 Java 既有食材的 218–225 視覺索引、七階段色板、GUI color data 與 helper geometry；舊 food／hand-bank marker、油與失敗串 owner 不重新編號 | 八食材逐種穿串、雙手、未完成／失敗串、烤架、餐盤、七階段及保存重載的實際顏色與形狀；任意 stack GUI 合成仍是另一項未實作能力 |
| SKEWER-CONTENTS | 玩家曾回報配方不合、穿料後只見竹籤與吃空氣；G151／152 有取得契約、短配方、內容、圖像及共同資料守衛修補 | 正常取得→1／2／3 料穿製→烤製→盤／手持→食用／保存；空／不完整串不能被重複穿外層，合法零營養仍遵循原作。任意 stack icon 另驗 |
| CLIENT-HUD | 曾無森羅 UI、外露 `KT_HUD!` 資料、位置錯及秒級延遲；G138／140–142 有入口、錨點、時計及圖像裁剪來源修補 | 觸控／Desktop、全食品、兩手、連吃、取消、END 隱藏與真實延遲；送出 packet、BDS 載入與舊窄片不代替結果 |
| EATING-OWNER | G143 修 owning-player property 環境、副手進度、末段隱藏、RawMessage 等價比較及失敗掃描節流 | 近鏡放大、末段平片、換槽／重登、瓶子與食物 preparation 並存仍需當前驗收；不猜改 Java 曲線掩蓋失敗 |
| GRILL-DEFERRED-OWNER | G125 延後重讀 cancel 並核 type／permutation／owner／完整物品；舊四個原生 API 診斷用代用容器 | 後續 listener 取消爆炸、排程後換方塊、合法計時中拆爐；須保留整個 customBreak、容器內容與玩家結果 |
| ITEM-DELIVERY | G125 在扣料前核站點身份，保留滿包 planner、實際交付讀回與不明結果隔離 | 榨油機延後扣料、串譜／穿串／拆串滿包、外來槽位和掉落回收未知；未確認回收不得退原料或重發 |
| SEASONING-DATA-RELOAD | G124 合併目前資料根，取料／效果／HUD 共用 resolver，保存失敗恢復；不自動讀 Java datapack | 後根覆寫、錯誤根不部分生效、舊食物依新映射、未知 kind 與 provider 缺席；真人效果仍待驗 |
| SKEWER-GUI | issue #166 有任意三槽 GUI 的失敗觀察；參考圖與手持 geometry 不證明 native inventory 合成 | 同一串三份胡蘿蔔及不同原料、raw／cooked／variant，查看背包與快捷欄；固定五幀 icon 不能取代此項 |
| SEASONING-FLOW | 舊 LIVE 取瓶失敗；RawMessage／材料數與後續動作有來源修補，未有完整同瓶驗收 | 同瓶放三種必要 base→取回 PENDING→持續 80 tick→SPECIAL→向有串烤架撒料；核材料、uses、取消／換槽／重登，不能用改配方或即時轉換通過 |
| SEASONING-EXPLOSION-CANCEL | G117 延後工作僅在 cancel 明確 false 時繼續；取消／event 讀失敗保留瓶、ItemStack、容器及保存記錄 | 在瓶 handler 後取消爆炸，驗內容與 ownership；未取消爆炸的原作毀損規則不變。API 模型不是原生事件結果 |
| PLATE-SATURATION | G116 餐盤在寫 hunger 後重取 saturation／effectiveMax，失敗回滾；舊 trace 曾在 hunger 10→13 後仍用 cap 10 | 重現相同飢餓／食物及原生 cap 條件，核一次營養結算、不吞物品、不虛構 max；同候選 Player／client 待驗 |
| HANDHELD-SATURATION | G117 修手持提前結算的舊 cap；與 G116 餐盤路徑是兩個問題 | hunger／saturation 10／10、兩份熟牛肉串、25 tick 後停止，並以 10／2 對照；核新 cap、metadata、重複事件及寫入失敗回滾 |
| PLATE-USE-ARBITRATION | G116 有 block／item-use 仲裁與較近 entity 排除 | 持多份串向盤插入後不能額外吃掉剩餘串；另驗合法 air-use、潛行副手、其他方塊與取消；真輸入順序待驗 |
| PLATE-PLACED-DISPLAY | G118 有目前內容、FIXED transform、1–5 份與四朝向的專用來源 | 固定／秘製串放盤、即看、取一份及區塊重載；核內容、材質、光照與無殘影。舊 tiny-edge-pixel／朝向故障保留其候選身份 |
| PLATE-HELD-CONTENTS／DECODE | G119 有 envelope reader、每手單 writer、兩 word 與獨立 count；放置和手持旋轉分開 | 1–5 份、主副手混持盤／瓶／串、切槽、重登及旁觀者；舊 stored1／4→0／3 與 float32 模型不認證新 transport |
| HEAVY-METAL-COMMIT | G119 單次效果→HP→聲音；G120 在取消前持久 claim，不因重建 map 再救同一效果 | 原生傷害、其他 addon、圖騰、部分 absorption、重登／存檔與聲畫；API 讀回不等於磁碟 flush 或 crash 原子性 |
| OIL-RESIDUE-PLANTS | 已明列 29 類植物適配與兩次作用一次扣料；甜菜四階段對應、竹子 1–2 節與葉片下移、海帶長入水方塊並保留含水層已依 Java 來源實作；未知方塊／掉落／含水層恢復結果不退成本 | 竹子無 Java stage 狀態（僅以 16 高上限停止）、海帶含水層原生 `setWaterlogged` 讀回、其他 feature／外部植物仍缺；正常施肥／採果、上下半、光照／鄰位與重載待 staging 驗 |
| JAVA-POT-LIFECYCLE | G122 有指定 exact／flex 配方、備料／翻炒／結果階段、保存與品質；有限 Java 品質向量不是完整 PotBlockEntity trace | 真鍋加油→備料→三翻→盛裝、熱源／卸載／重啟、冷卻、兩手連吃、滿包／拆鍋／保存故障及真營養；其他作者配方與未知私有資料不猜轉換 |
| CUISINE-CONSERVATION | G120／122 修取消後清資料、出料讀回、批次 credit 及手部／站點實際寫入所有權 | 取消／拆鍋／取出／重登／不同 operationId 不得重複交付；確認站點回前像後才補償本次仍擁有的成本；不明保存保持隔離 |
| EATING-ACCEPTANCE | 完成事件已補兩手／槽／metadata核對，短暫手部視圖恢復已補呈現恢復；API情境通過。G81 僅閉合有完整 counter 的 stop→leave 分支；直接leave無stop仍有已知差異 | 早停、24／25／26 tick、完整 90 tick FOUR、換手／換槽／連吃、stop→leave／重登；普通副手 air-use 單獨驗；核份數、營養、效果、逐口與音效 |

G182 的資產清理只採用目前 canonical 樹中無字串引用的 846 個整檔與混合檔 16 個定義；八食材新增資產均有 consumer。G156 的有限前後畫面證據保留原候選身份，不能代替 G182 全部既有物品／放置表面的前後對照、完整相關家族與同世界重啟驗收。

## 其他必須保留的界線

- **ADVANCEMENT-CLAIM**：G132 記錄先保存 claim 再作單次 XP 嘗試，未知結果不 fallback／重試。這是 at-most-once attempt；未發 XP 的人工恢復、跨 API 原子性及當前原生／真人結果仍未完成。[原範圍](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/docs/PARITY-MATRIX.md#進度獎勵失敗邊界g132)
- **天然要塞**：公開 integration API 不提供 vanilla 新區塊／要塞生成回呼；不能用附近方塊猜歷史，也不能以人工搭建的原生測試冒充自然 25% 替換完成。見 [API](BEDROCK-INTEGRATION-API.md#新生成宿主)。
- **平台差異**：真自訂流體、Numb 準星、Pepper entityInside、任意食品／smoking 回呼、Create／Maid 等 Java 模組各自列為未支援或待評估。按計畫和實際 API 決定，不由舊 README 永久宣告放棄，也不杜撰等價能力。
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
