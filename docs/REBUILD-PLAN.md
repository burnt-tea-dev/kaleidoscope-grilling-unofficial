# 煙火（Kaleidoscope Grilling）基岩版移植：重建執行計畫

> **讀者**：接手執行的 AI 代理與維護者。**權威順序**：`AGENTS.md`（行為規則）→ 本文件（工作內容與順序）→ `docs/SAVE-COMPAT.md`（存檔硬規則）。三者與舊文件衝突時，以這三份為準；舊文件（`docs/STATUS-A*.md`、`docs/RELEASE-NOTES-*`、`docs/audit/*`、`history/` 等）只當歷史參考，**不是指令**。
>
> **建立**：2026-10-18，基準 commit `4d5fb095`（G155／2.8.155）。
>
> **一句話目標**：把一個靠「版本層疊補丁＋見證測試」維持的移植，換成**一份以 Bedrock 原生機制實作、按 Java 1.1.1 功能域組織、可以放心刪改的 runtime**；同時保證 luosen 存檔裡玩家的東西一件都不會消失。

---

## 目錄

0. [執行規則摘要（先讀）](#0-執行規則摘要先讀)
1. [現況診斷：數據與根因](#1-現況診斷數據與根因)
2. [已就位的護欄與禁止模式](#2-已就位的護欄與禁止模式)
3. [目標架構（終態）](#3-目標架構終態)
4. [分階段執行（P0–P7）](#4-分階段執行p0p7)
5. [伺服器與 luosen 存檔作業手冊](#5-伺服器與-luosen-存檔作業手冊)
6. [senluo-family-integration-private 收斂方針](#6-senluo-family-integration-private-收斂方針)
7. [視覺還原方法（逐表面）](#7-視覺還原方法逐表面)
8. [邏輯還原方法（Java → Bedrock 對照）](#8-邏輯還原方法java--bedrock-對照)
9. [測試策略與刪除清單](#9-測試策略與刪除清單)
10. [待擁有者決定事項](#10-待擁有者決定事項)
11. [風險登記](#11-風險登記)
12. [附錄](#12-附錄)

---

## 0. 執行規則摘要（先讀）

1. **一次只做一個任務（T-x.y），一個任務一個 PR。** PR 標題以任務編號開頭，例如 `T2.3: remove committed build artifacts`。
2. **每個任務都有「驗收條件」**。沒有全部達成就不能標完成，不能用「測試通過」代替「玩法正確」。
3. **P2 之前不准改 runtime 行為**；P2 的所有 PR 依 §4 P2 共通驗收證明 BP/RP 位元組不變。T2.8 僅依該任務的明示例外變更 RP，仍須完整 staging 驗收。
4. **任何 item／block／entity／state 值／persisted key 的移除**只能走 `docs/SAVE-COMPAT.md` 的退役流程。護欄會擋。
5. **不准新增**：`verify_a*.py`、`augment_a*.py`、`tools/gNNN_*.py`、`docs/STATUS-*.md`、版本前綴模組（`aNNNN_*.js`）、版本前綴模型目錄、只為了視覺路線而存在的 item ID、新的全域 `playerInteractWithBlock` 監聽、新的 `system.runInterval`。棘輪會擋。
6. **luosen 是正式玩家世界**。任何改動 luosen 的動作都要：停服完整備份 → staging 驗證 → 部署 → 讀回確認 → 保留一份可完整回滾的上一版。（§5）
7. **不要修改作者 Cookery 包的檔案**，不要把私有整合的內容放進公開 repo。（§6）
8. **遇到計畫沒寫的決策**：停下，把選項寫進 PR 描述的「需要擁有者決定」段落，不要自行假設後繼續大規模工作。
9. 報告用語：`來源已實作`／`CI 通過`／`staging 驗證`／`已部署 luosen`／`真人驗收`五級分開寫，不可混用。

---

## 1. 現況診斷：數據與根因

### 1.1 量化現況（2026-10-18，commit `4d5fb095`）

| 面向 | 數字 | 說明 |
| --- | --- | --- |
| 工作樹大小 | 329 MB（不含 .git） | `artifacts/` 188 MB 是歷史建置產物（146 檔 `.brproject/.mcaddon`），GitHub Releases 已有正式包 |
| 遠端分支 | 492 | 大量 `fix/*`、`diag/*`、`repair/*`、`integrate/*` 一次性分支 |
| 開啟中的 PR | 5（#214 #217 #220 #222 #232） | 皆為「主體已吸收，待收束」狀態 |
| 文件 | 459 檔（`docs/`），其中 `STATUS-*` 186、`RELEASE-NOTES-*` 24 | 狀態與證據散落，彼此引用、互相更正 |
| 每版驗證器 | `verify_a*.py` **259 支**，繼承鏈深 **107 層** | `verify_a28155 → a28154 → … → a283`，每版加一層 |
| 舊增補腳本 | `augment_a*.py` 66 支 | A2.1–A2.7 時代的層疊建置 |
| 版本層工具 | `tools/g15x_*_source.py` 等 10 支 | 以「前一版 commit＋tree＋雜湊帳本」鎖死來源，CI 要回抓歷史 commit |
| 測試 | 278 支 | 33 支直接切 `main.js` 原始碼文字（`indexOf('function '+name)` 括號配對再 `vm` 執行） |
| CI | 主 workflow 19–23 分鐘 | 大部分時間花在歷史層驗證 |
| BP 腳本 | 265 個模組、2.3 MB；`main.js` 103 KB | **125 個**以版本號命名（`a2746_…`、`a285_…`） |
| 全域事件監聽 | `playerInteractWithBlock`（before）**12 處**、`playerBreakBlock` 13、`explosion` 7、`scriptEventReceive` 23、`runInterval` 16 | 同一次右鍵由多個模組競爭處理，順序依 import 先後 |
| 逐 tick 玩家迴圈 | `main.js` 每 tick 對每位玩家做約 15 項工作 | 包括每 tick 檢查並**替換手上物品**（見 1.2-④） |
| 重複程式 | `development/gameplay_core/` 有 64 個 JS 與 runtime **逐位元相同** | 另有 129 個 JS 副本 |
| 物品定義 | 249 個，其中 Java 原有約 93 個 | **156 個影子 ID**：`_native_plain` 42、`_java_three_alt` 22、`_cuisine_q0–3` 12、`special_seasoning_r*_v*` 64、`partial/pending_seasoning_f1–8` 16 |
| RP geometry | 2650 個 geometry、923 個檔 | **684 個沒有任何引用**（整代 `a283_hand` 194、`a2764_skewer_hand` 150、`a22_bites` 150、`a286_hand` 86、`a2766_special_seasoning` 42、`a21` 39） |
| 巨型模型 | `failure_skewer_held.geo.json` 7.3 MB、`plate_held` 4.4 MB、`secret_held` 1.8 MB、`grill_display` 1.6 MB | 把每種狀態烘焙成幾何，客戶端記憶體與載入時間代價高（分支 `fix/oom-family-20261018` 即與此相關） |
| RP 總量 | 57 MB；271 張貼圖沒有路徑引用 | `a2770_placed` 193 張 |
| 玩家實體覆寫 | BP 內含 `entities/player.json`，宣告 **32 個** player property | Bedrock 同一實體類型只有一份 `player.json` 生效、property 有數量上限；任何其他也覆寫 player 的附加包都會與它互相覆蓋 |

### 1.2 根因（為什麼視覺和邏輯都還原得很差）

1. **以「層」而非「功能」組織**：A2.1、A2.3、A2.7.46… 每一版都新增一個模組＋一支驗證器＋一份狀態文件。後一層修前一層，但前一層不能刪（「保留並行修補」「append-only」「保留歷史」等規則）。結果是同一個行為有好幾條路徑，修一條、另一條照樣出錯。
2. **測試在保護「程式碼形狀」而不是「玩法」**：切原始碼文字、比對前一版雜湊帳本、驗證「前一版＋精確差異＝這一版」。任何正常重構都會打破這些測試，所以每個 AI 只能再疊一層。這是「表面上能動、實際亂七八糟」的主要機制。
3. **競爭式事件處理**：12 個模組各自訂閱同一個 before-interact 事件，彼此用 `cancel` 搶。互動結果取決於 import 順序與時序，造成「點餐盤誤吃串」「取消後還是拆掉烤架」之類的 bug，再各自加補丁。
4. **用替換物品 ID 來挑動畫**：`prepareEatingItems` 每 tick 檢查手上的串，必要時用 `_native_plain`／`_java_three_alt` 影子物品**替換玩家手上的 ItemStack**，只為了選另一套進食動畫／時長。這會：觸發背包事件、造成不同 ID 不能堆疊、所有配方／餐盤／烤架判斷都要先 `canonicalFoodId` 還原、斷線或崩潰時玩家可能留著影子物品。
5. **以烘焙幾何追求視覺**：把 Java 物品模型的每一種狀態（每種食材組合、每一口、每個姿勢）烘焙成獨立 geometry，數 MB 一個檔，還要用一整套「投影路線」、校準、見證文件去維護。Bedrock 原生其實有 render controller 的貼圖陣列、bone 可見度、part_visibility、entity property 驅動等機制，可以用小得多的資產表達同樣的狀態。
6. **私有整合補宿主**：家族整合（senluo-family-integration-private）在部署時修補作者 Cookery 宿主，公開 runtime 又依賴這些修補（「家族整合提供的砧板／油壺／炒鍋…不能當作只安裝作者 Cookery 就有的功能」），形成兩個 repo 之間沒有測試的隱性契約。
7. **流程成本壓過工程**：每個修正都要換版本、20 分鐘 CI、整套家族准入、停服部署 luosen、寫證據文件。工程時間被流程吃掉，沒有時間做正確的結構修正。

### 1.3 已確認可以安全保留的資產

- Java 原作 1.1.1（`breezeth-CN/KaleidoscopeGrilling@9a1acdab`）的素材已逐位元匯入於 `projects/grilling/source_snapshots/`，`source_manifest.json` 有逐檔雜湊與授權。**這是視覺還原的唯一正確來源**，保留。
- `development/gameplay_core/fixtures/java-*` 中由 Java 原碼萃取的資料（配方、熱度期限、效果、HUD 尺寸、進食曲線、音效）有價值，**重新整理為 `data/java/` 的單一資料表**後保留（T2.3）。
- BP/RP UUID、所有 item／block／entity ID、persisted key：存檔相依，**全部保留**（護欄已鎖）。
- 已存在的交易安全觀念（先快照、寫入失敗回滾、不吞物品）：觀念保留，實作收斂到 `core/transaction.js` 一處（T3.2）。

---

## 2. 已就位的護欄與禁止模式

### 2.1 護欄（P0 已完成，CI 必跑，`guards.yml`）

| 護欄 | 檔案 | 擋什麼 |
| --- | --- | --- |
| 存檔相容鎖 | `tools/guards/save_compat.py`、`save-compat.lock.json`、`id-retirements.json` | 任何 item／block／block state 值／entity／persisted key 字面值／pack UUID 的消失；CI 另用 base 分支的 lock 再查，手改 lock 藏不住 |
| 膨脹棘輪 | `tools/guards/growth_ratchet.py`、`growth-ratchet.json` | 24 項反模式計數只能下降；CI 另用 base 分支的上限再查，PR 不能自己調高上限 |
| 受保護檔案 | `guards.yml` | 刪除護欄、`AGENTS.md`、本計畫、`SAVE-COMPAT.md` 會直接失敗 |
| 標籤不提供旁路 | `guards.yml` | PR label 不會跳過 base 分支的存檔鎖或棘輪上限比較；不得在任務 PR 中自行放寬護欄 |

規則：

- 每個 PR 結束前在本機跑：
  ```sh
  python3 tools/guards/test_guards.py
  python3 tools/guards/save_compat.py check
  python3 tools/guards/growth_ratchet.py check
  ```
- 清理讓計數下降後，在同一個 PR 執行 `python3 tools/guards/growth_ratchet.py tighten` 鎖住新上限。
- 新增合法 ID 後，在同一個 PR 執行 `python3 tools/guards/save_compat.py update`。

### 2.2 禁止模式（看到就拒絕）

| 編號 | 禁止 | 改用 |
| --- | --- | --- |
| F1 | 每個版本新增一支驗證器／狀態文件／版本層工具 | 行為測試（§9）＋ `CHANGELOG.md` 一行 |
| F2 | 測試讀 `main.js` 或任何 runtime 檔的**原始碼文字**、切函式本體 | import 匯出的純函式；或用 fake world harness 跑事件 |
| F3 | 雜湊帳本鎖「前一版 commit/tree＋差異」 | 不需要；Git 本身就是歷史 |
| F4 | 為選動畫／圖示／姿勢而新增或替換 item ID | entity property／render controller／attachable 動畫控制 |
| F5 | 新的全域 `world.beforeEvents.playerInteractWithBlock` 等監聽 | block／item custom components；或 `core/events.js` 的唯一路由 |
| F6 | 新的 `system.runInterval` | `core/scheduler.js` 的唯一排程器（分攤、按需） |
| F7 | 把建置產物、截圖、log commit 進 repo | GitHub Actions artifact／Releases |
| F8 | 修改作者 Cookery 的檔案或在部署時注入 runtime | `compat/cookery` 介面卡＋能力探測（§6） |
| F9 | 以模板字串重新拼出 persisted key | `core/persist_keys.js` 逐字字面值（SAVE-COMPAT） |
| F10 | 在 luosen 直接試錯 | staging 世界（§5.4） |
| F11 | 把「BDS 載入成功／hash 一致／測試數」寫成「已還原」 | §0 第 9 條五級用語 |
| F12 | 烘焙超過 512 KB 的單一 geometry | 原生狀態機制（§7） |
| F13 | 新增或擴充 `player.json` 覆寫 | 先走決策 D6；預設不覆寫 |

---

## 3. 目標架構（終態）

### 3.1 Repo 佈局

```
/                         README.md, AGENTS.md, CHANGELOG.md, baseline.json, config.json, .repo-target.json
/packs/BP/                唯一 canonical behavior pack（P3 由 projects/grilling/gameplay_core/behavior_pack 搬入）
/packs/RP/                唯一 canonical resource pack
/data/java/               由 Java 1.1.1 萃取的資料表（recipes, cook_times, effects, foods, seasonings, skewers, oils…）
/assets-src/java/         Java 原始素材快照（自 projects/grilling/source_snapshots 搬入）＋ source_manifest.json
/assets-src/blockbench/   .bbmodel 原始檔（Bedrock 專用模型），由 Blockbench 匯出至 packs/RP
/tools/                   build.py（打包）、validate.py（靜態驗證）、guards/、ops/（伺服器唯讀／備份工具）、java_extract/
/tests/unit/              純邏輯測試（node:test）
/tests/scenario/          fake-world 事件流程測試（node:test）
/tests/gametest/          只在測試用 BDS 載入的 GameTest BP（不隨正式包發布）
/docs/                    ARCHITECTURE.md, PARITY.md, KNOWN-ISSUES.md, RELEASING.md, SAVE-COMPAT.md, REBUILD-PLAN.md, GUIDE-STANDARD.md, BEDROCK-INTEGRATION-API.md
```

刪除（P2，移到 `archive/pre-rebuild-20261018` tag 保存）：`artifacts/`、`history/`、`development/`（萃取資料先轉進 `data/java/`）、`migration/`、`notebook/`、`compat/`（家族 manifest 移到 tavern 家族 repo 或 `tools/ops/`）、`projects/grilling/{editor,reports,review,integration,tools,guide}` 中不屬於 runtime 的內容、`docs/` 除上列以外全部。

### 3.2 Runtime 模組佈局（`packs/BP/scripts/`）

按 Java 套件（`cn.breezeth.kaleidoscope_grilling.*`）分域，**每個域兩層**：

```
scripts/
  main.js                     只做組裝：import 各域 register()，不含邏輯
  core/
    ids.js                    所有 identifier 常數（唯一來源）
    persist_keys.js           所有 dynamic property key（逐字字面值）
    persist.js                版本化讀寫＋遷移（每個 key 一個 codec）
    transaction.js            ItemStack/容器/玩家飽食度 的快照—寫入—回滾
    storage.js                方塊站點的隱藏庫存實體（沿用 inventory_*_v1，不改 ID）
    events.js                 唯一全域事件路由（只在 custom component 做不到時使用）
    scheduler.js              唯一排程器（分攤、按玩家/區塊需要才跑）
    player_props.js           player property 唯一寫入點（含節流與差異寫入）
    item_meta.js              item dynamic property／lore 的讀寫
    config.js                 伺服器設定
    log.js                    節流 log
  grill/      logic.js runtime.js visual.js     ← GrillBlock / GrillBlockEntity / GrillRenderer
  skewer/     logic.js runtime.js visual.js     ← SkewerItem, SecretSkewer, Unfinished, Failed, Recipe book, Skewering
  plate/      logic.js runtime.js visual.js     ← SkewerPlateBlock/Entity/Item
  recipe/     logic.js runtime.js               ← SkewerRecipeBlock, SkewerRecipes, crafting recipes
  seasoning/  logic.js runtime.js visual.js     ← SeasoningBottle*, SeasoningData/Effects/Use, Pending/Advanced
  oil/        logic.js runtime.js visual.js     ← OilPress, BigVat, OilFilling, OilBrush, PremiumChiliOil, oil pot compat
  rack/       logic.js runtime.js visual.js     ← AdvancedRack, filters, selection/shortcut（server-ui）
  food/       logic.js runtime.js               ← HotFood*, EffectFood, DualEffect, FoodState, WeddingCandy, eating
  effect/     logic.js runtime.js               ← heavy_metal(_poisoning), dragon_blood, numb, invincible, DragonEggPowder
  crops/      logic.js runtime.js               ← canola, houttuynia, onion, sweet potato, pepper tree
  world/      logic.js runtime.js               ← pepper worldgen fruiting, village/fortress loot, knife drops, stripping
  advancement/ logic.js runtime.js              ← 21 個 Java advancement 的 Bedrock 等價
  compat/cookery/ adapter.js probe.js           ← 與作者 Cookery 的唯一接點（§6）
  compat/family/  api.js                        ← 對 Tavern/World Liquor 公開的 integration API（沿用現有契約）
  guide/      …                                 ← Cookery 指南的煙火入口（沿用 GUIDE-STANDARD）
  hud/        …                                 ← 僅在 D3 決定保留時
```

規則：

- `logic.js` **不得 import `@minecraft/server`**，只接收資料、回傳決策（例如 `grillTick(state, now) → {state, outputs, sounds}`）。單元測試只測這一層。
- `runtime.js` 把 Minecraft 事件轉成 logic 輸入、把 logic 決策套用到世界，**所有寫入走 `core/transaction.js`**。
- `visual.js` 只負責把狀態投射成 entity property／block permutation／顯示實體，**不得改變遊戲資料**。
- 域之間只透過匯出函式呼叫，不共享可變全域 Map（`ACTIVE_EATS` 之類收進各域並提供 `forgetPlayer(id)`）。
- 不使用版本號命名任何檔案、函式或 key（既有 persisted key 除外，逐字保留）。

### 3.3 事件模型

| 用途 | Bedrock 機制（`@minecraft/server` 2.x） |
| --- | --- |
| 右鍵烤架／餐盤／串譜架／料理架／調料瓶／榨油機／大缸 | block custom component `onPlayerInteract`（在 block JSON 宣告 `"kaleidoscope_grilling:grill": {}`） |
| 方塊被玩家破壞 | `onPlayerBreak`；爆炸／活塞等非玩家破壞用 `onBreak`（若該版本提供）或 `core/events.js` 單一路由 |
| 烤架加熱與食物熟成、作物生長 | `minecraft:tick` ＋ `onTick`；作物用 `onRandomTick`；熟成以「絕對 tick 時間戳」計算，不依賴每 tick 加一 |
| 放置前檢查 | `beforeOnPlayerPlace` |
| 物品使用（刷油、撒調料、搖瓶） | item custom component `onUse`／`onUseOn` |
| 進食完成 | item custom component `onConsume`（或 `onCompleteUse`），飢餓／飽和度由 `minecraft:food` 原生處理，額外效果在這裡給 |
| 進食開始／中止（動畫與 HUD） | `world.afterEvents.itemStartUse`／`itemStopUse`，**只訂閱一次**，在 `core/events.js` 依 typeId 分派 |
| 玩家上線／離線 | `playerSpawn`／`playerLeave` 各訂閱一次，分派給各域的 `onPlayerJoin/forgetPlayer` |
| 跨包整合 | `scriptEventReceive` 只訂閱一次（`compat/family/api.js`），以 namespace 分派 |

驗收：P3 結束時棘輪 `global_block_interact_handlers ≤ 1`、`script_event_listeners ≤ 1`、`run_intervals ≤ 2`。

### 3.4 持久化模型

- **方塊狀態優先放 block permutation**（lit、cooking phase、fill level、facing、age）：原生同步、存檔原生保存、不需 dynamic property。
- **需要真實 ItemStack 的站點**（烤架 3 格、料理架 9 格、調料瓶 4 格）沿用現有隱藏庫存實體 `inventory_grill_v1`／`inventory_rack_v1`／`inventory_seasoning_v1` 與 `storage_v1/` ledger（**不可改 ID 與 key**），收斂到 `core/storage.js`。
- **其他世界資料**（例如烤架的計時、餐盤內容 envelope）用 world dynamic property，key 由 `core/persist_keys.js` 宣告，每個 key 有：schema 版本、codec、遷移函式、**方塊移除時的清理**、以及 `tools/ops/` 的離線稽核方法。
- **物品資料**（秘製串三格食材、熱食到期、調料用量）放 item dynamic property，讀寫集中於 `core/item_meta.js`。
- **玩家暫態**（進食中、撒料中）只放記憶體＋必要的 player property，不持久化。
- 寫一個 `persist.audit()`：開服時（或 `/scriptevent kaleidoscope_grilling:audit`）列出孤兒 key 數量（對應方塊已不存在），只回報不刪除；刪除由擁有者決定。

### 3.5 物品 ID 策略

- **一個 Java 物品＝一個 Bedrock 物品**。狀態用 item dynamic property 表達。
- **唯一例外**：Java 在**背包圖示**上就有不同外觀、而 Bedrock 只能用不同 ID 呈現的狀態（例如調料瓶的剩餘量階段）。這類變體必須：在 `data/variants.json` 宣告理由與 Java 依據、由產生器產出 item JSON（不手寫）、數量最小化。
- 退役目標（P4，走 SAVE-COMPAT 流程）：
  - `*_native_plain`（42）、`*_java_three_alt`（22）：進食路線影子物品，動畫改由 player property 選擇 → **全部退役**，替代為對應基礎 ID。
  - `*_cuisine_q0–3`（12）：料理品質。Java `CuisineQualitySupport` 是 stack 上的 Cookery `Quality`，會以 `QualityUtils.modifyFoodProperties` 改變營養、以 `quality.getRatio()` 縮放效果時間、並加一行 tooltip；不是不同物品。Bedrock 的 `minecraft:food` 營養綁在 item ID，所以現行用 4 個 ID 表達 4 種營養。目標：基礎 ID＋item dynamic property 記品質＋lore 顯示，營養差額與效果時間在 `onConsume` 由腳本補正（以基礎營養為最低品質，腳本只加不減，避免原生結算後再扣）→ **退役** 12 個 ID（若擁有者在 D5 決定背包圖示必須不同則保留並改由產生器管理）。
  - `special_seasoning_r*_v*`（64）、`partial/pending_seasoning_f1–8`（16）：先在 P4 盤點 Java 背包圖示實際有幾種外觀，再決定保留數量；保留的改由產生器產出。
- 不完整、自訂秘製串的**背包圖示**依三格食材變化：Bedrock 無法按 stack 動態合成背包圖示，這是平台限制。終態：通用秘製串圖示＋名稱／lore 列出三格食材；手持、放置、進食畫面則依 property 正確呈現。寫進 `docs/KNOWN-ISSUES.md`，不再用影子 ID 嘗試。

### 3.6 CI 與發布

- `ci.yml`（每 PR，目標 < 3 分鐘）：guards → `node --test tests/unit tests/scenario` → `tsc --noEmit --checkJs`（用 `@minecraft/server` 型別檢查 JS）→ `eslint` → `python3 tools/validate.py`（靜態包驗證，§9.3）→ `python3 tools/build.py` 產出 `.mcaddon` 上傳為 workflow artifact（**不 commit**）。
- `gametest.yml`（每晚＋手動）：下載 BDS、載入正式 BP/RP＋`tests/gametest` BP，跑 `/gametest runall`，解析 log。
- `release.yml`（手動）：從已通過 CI 的 tag 建包、上傳 GitHub Release、寫 SHA256。
- 版本號：語意版本。玩法／資產變更 bump minor 或 patch；文件／工具不 bump。**不再使用 G/T/W 代號與 `STATUS` 文件**；家族配對關係記在家族 repo 的單一 lock 檔。

### 3.7 文件保留清單（與 §3.1 一致）

根目錄保留 `README.md`（安裝、相依、目前版本）、`AGENTS.md`、`CHANGELOG.md`（每版幾行）。`docs/` 保留 `ARCHITECTURE.md`、`PARITY.md`（單一表格：Java 功能 × 狀態 × 測試 × 已知差異）、`KNOWN-ISSUES.md`、`RELEASING.md`（含部署手冊）、`SAVE-COMPAT.md`、`REBUILD-PLAN.md`、`GUIDE-STANDARD.md`、`BEDROCK-INTEGRATION-API.md`。P2 仍依 T2.6 驗收 `docs_files_total ≤ 12`；此處列出目標清單，不表示 T2.6 已完成。

本計畫完成後在原路徑記錄完成狀態與歷史 tag 連結；`docs/REBUILD-PLAN.md` 仍受護欄保護，不由清理任務移走或刪除。若未來需要調整保留清單或受保護檔案的退場方式，另開規則修訂 PR 審查。

---

## 4. 分階段執行（P0–P7）

> 每個任務格式：**目的／前置／步驟／驗收／不要做**。依序執行，除非註明可並行。

### P0：安全網（已完成，2026-10-18）

- T0.1 存檔相容鎖＋退役流程（`tools/guards/save_compat.py`、`docs/SAVE-COMPAT.md`）✅
- T0.2 膨脹棘輪（`tools/guards/growth_ratchet.py`）✅
- T0.3 `guards.yml`（含 base 比較與受保護檔案）✅
- T0.4 重寫 `AGENTS.md`、建立本計畫 ✅
- T0.5 伺服器唯讀盤點工具 `tools/ops/server_inventory.py` ✅
- **分支保護核對**：確認 GitHub main 將 `Rebuild guards` 設為 required check，並以 GitHub 設定讀回為準；無法讀取時記為未能驗證。PR label 不提供任何護欄旁路。

### P1：凍結與盤點（不改任何 runtime、不改 luosen）

**T1.1 凍結功能開發**
- 步驟：在 README 頂端加一行「重建進行中，P3 前只接受 P0 等級存檔安全修補」；`.github/release-request.json` 保持 `publication_request=false`。
- 驗收：README 已更新；沒有開著的功能 PR 會被合併。

**T1.2 封存現況**
- 步驟：
  ```sh
  git tag -a archive/pre-rebuild-20261018 4d5fb095 -m "State before rebuild plan"
  git push origin archive/pre-rebuild-20261018
  git for-each-ref --format='%(refname:short) %(objectname)' refs/remotes/origin > /tmp/branches.txt
  ```
  把分支清單存為 release asset 或 `tools/ops/receipts/branches-20261018.txt`（小檔，可 commit）。
- 驗收：tag 存在於遠端；分支清單可查。
- 不要做：還不要刪分支（D7）。

**T1.3 處理開啟中的 PR**
- 步驟：對 #214 #217 #220 #222 #232 逐一在 PR 留言：「依 REBUILD-PLAN 關閉；保留分支與 archive tag；其行為需求已登錄於 docs/PARITY.md 第 N 列」，然後關閉。先把每個 PR 要解決的**玩家可見問題**一句話登錄到 `docs/PARITY.md` 的待辦欄（T2.6 建立該檔前，先記在本 PR 描述）。
- 驗收：0 個開啟中的 PR；每個 PR 的問題都有登錄。
- 不要做：不要把這些 PR 的程式碼 cherry-pick 進來。

**T1.4 伺服器唯讀盤點**（需要伺服器存取，§5.1）
- 步驟：在伺服器執行 `tools/ops/server_inventory.py --server-root <luosen 所在 BDS 根>`，輸出存為 `tools/ops/receipts/luosen-inventory-<日期>.json`。**移除其中任何私密路徑或憑證後**才 commit；若有疑慮只 commit 摘要。
- 驗收：收據列出 luosen 啟用的完整 BP/RP 順序、每包版本與雜湊、未解析 UUID、重複版本、player 覆寫衝突。
- 不要做：不要動 world 檔、不要重啟。

**T1.5 luosen 基準備份（LKG-0）**（§5.3）
- 驗收：一份停服、完整、可還原的備份，記錄 SHA256、大小、時間、對應的 pack 組合收據；並在**另一台機器或另一個磁碟**有副本。

**T1.6 世界 ID 普查（離線、只讀副本）**（§5.6）
- 步驟：在 LKG-0 的**副本**上跑 ID 普查工具，統計每個 `kaleidoscope_grilling:*` item／block／entity 的數量與所在位置類型（玩家背包、容器、隱藏庫存實體、掉落物、方塊調色盤），以及 world dynamic property 中各 key 前綴的筆數。
- 驗收：`tools/ops/receipts/luosen-id-census-<日期>.json`。這份數據決定 P4 退役的優先順序與風險。

**T1.7 私有整合盤點**（需要私有 repo 存取，§6.1）
- 驗收：`docs/` 不放私有內容；在私有 repo 產出 `INVENTORY.md`：它修改了哪些 Cookery 檔案、注入了哪些腳本、對外提供了哪些 API、公開 runtime 依賴其中哪些。

**T1.8 staging 伺服器**（§5.4）
- 驗收：BSM 內有 `luosen-staging`（不同 port，不對外公告），世界來自 LKG-0 副本，pack 組合與 luosen 相同；能正常開服、進入、重啟。

**P1 出口條件**：T1.2–T1.10 全部完成（T1.4 的 pack 組合盤點已於 2026-10-19 完成，見 §5.0；剩 content log warning 分類）。T1.4–T1.8 若因權限暫時無法進行，P2 可以先開始（P2 不改 runtime），但 **P3 之前必須完成**。

### P2：Repo 瘦身（runtime 位元組不得改變）

**共通驗收（每個 P2 PR 都要）**：

```sh
python3 tools/baseline_gate.py check     # 既有：BP/RP 樹雜湊與 baseline.json 一致
python3 tools/guards/save_compat.py check
python3 tools/guards/growth_ratchet.py check && python3 tools/guards/growth_ratchet.py tighten
```

並在 PR 描述貼上 `git diff --stat origin/main -- projects/grilling/gameplay_core/behavior_pack projects/grilling/gameplay_core/resource_pack` 的輸出，**必須為空**。

**T2.1 刪除已提交的建置產物**：`git rm -r artifacts/`；`.gitignore` 加 `/artifacts/`。驗收：`committed_artifact_files=0`。不要改寫 Git 歷史（D8）。

**T2.2 刪除歷史樹與舊實驗**：`history/`、`migration/`、`notebook/`、`docs/legacy_workflows/`、`docs/archive/`、`docs/history/`。驗收：`history_tree_files=0`。

**T2.3 萃取 Java 資料表**
- 步驟：把 `development/gameplay_core/fixtures/java-*.json` 與 `projects/grilling/source_snapshots/` 內的資料（配方、熱度期限、效果、進食曲線、HUD 尺寸、調料顏色、音效對照、碰撞形狀）整理成 `data/java/*.json`，每檔頂端記 `source_commit: 9a1acdab…` 與萃取方法；寫 `tools/java_extract/` 腳本可從上游原碼重新產生（用 `git clone https://github.com/breezeth-CN/KaleidoscopeGrilling`，鎖定 commit）。
- 驗收：`data/java/` 內容可由腳本重現；每個 runtime 用到的 Java 數值都能在這裡找到出處。
- 不要做：不改 runtime 去讀這些檔（P3 才做）。

**T2.4 刪除驗證器與層工具**
- 刪除：`development/gameplay_core/verify_*.py`（259）、`augment_a*.py`（66）、`build.py`、`apply_a281_repair.py`、`verification_session*.py`、`vibrant_gate.py`、`publish_test_release.py`、`render_a273_icons.py` 及所有只被它們使用的模組；`tools/g15[0-9]_*.py`、`tools/test_g15*`、`tools/historical_source_refs.py`、`tools/source_provenance.py`、`tools/test_g75_source_conservation.py`、`tools/stable_host_source.py`、`tools/public_source_witness.py`、`tools/*_source_witness.py`、`tools/release_claim.py` 等「見證／守恆」工具。
- 同時：把 `gameplay-core.yml` 換成過渡版 `ci.yml`，只跑 guards＋`baseline_gate`＋`tools/check_json.py`＋保留下來的測試（T2.5）。
- 驗收：`per_version_verifiers=0`、`augment_layer_scripts=0`、`version_layer_tools=0`；CI < 5 分鐘。
- 不要做：不要因為刪除導致某個保留測試失敗就恢復驗證器；改測試或刪測試（依 T2.5 規則）。

**T2.5 測試分流（第一輪）**
- 規則（逐檔判斷，PR 描述附表）：
  - **刪除**：讀 runtime 原始碼文字者（33 支，棘輪 `source_text_slicing_tests`）；比對雜湊／收據／發布綁定者（`test_g6*_local_release_receipt.py`、`test_publish_test_release.py`、`test_verify_current.py`、`test_package_current.py` 的雜湊部分）；測試 Python 投影產生器、校準、幾何烘焙的（`test_*_projection*.py`、`test_*calibration*.py`、`test_held_*`、`test_native_*_fp.py` 等）——這些在 P4 會整個被替換。
  - **暫留**：直接 import runtime 匯出的純函式且斷言遊戲規則的 `.mjs`（例如 `test_core.mjs`、`test_a24_core.mjs`、`test_plate_transactions.mjs`）。搬到 `tests/legacy/`，在 P3 被新測試取代後刪除。
- 驗收：`source_text_slicing_tests=0`；`tests_total` 明顯下降並 tighten。

**T2.6 文件收斂**
- 建立：`docs/PARITY.md`（從 `PARITY-MATRIX.md`＋`BUGS.md` 萃取成單一表格，欄位：Java 功能／Java 類別／Bedrock 實作位置／狀態（未實作、來源已實作、staging 驗證、已部署、真人驗收）／已知差異／對應測試）、`docs/KNOWN-ISSUES.md`、`docs/ARCHITECTURE.md`（先寫現況，P3 改為終態）、`docs/RELEASING.md`。
- 刪除：所有 `STATUS-*`、`RELEASE-NOTES-*`、`BDS-*.json`、`G6*-*.json`、`NATIVE-*.json`、`THREADED-*`、`PARITY-BATCH*`、`FAMILY-COMPAT-BATCH*`、`docs/evidence/`、`docs/audit/`、`docs/render-audit/`、`docs/parity/` 等。
- `CHANGELOG.md`：改為每版幾行；舊內容截斷並連到 archive tag。
- README：重寫為 1 頁（安裝、相依、目前狀態一句、連 PARITY 與 KNOWN-ISSUES）。
- 驗收：`docs_files_total ≤ 12`、`status_docs=0`、`release_note_docs=0`。

**T2.7 刪除 `development/` 剩餘部分與重複 JS**：確認 `tests/legacy/` 不再 import `development/` 後整個刪除。驗收：`development/` 不存在。

**T2.8 移除未引用的 RP 資產（不影響 runtime 行為，但改 RP 位元組）**
- 這一項**例外**允許 RP 變動，但只能刪「完全沒有被任何 JSON／腳本以字串引用」的 geometry／貼圖。
- 步驟：寫 `tools/validate.py` 的 `unused-assets` 子命令（以 geometry identifier 與貼圖路徑字串比對；同時掃描 render controller 陣列與腳本字串）；列出清單→人工抽查 10 個→刪除→ `baseline.json` 的 RP 樹雜湊更新、RP 版本 patch bump（這是一次資產變更，需完整 staging 驗證）。
- 預期移除：`models/entity/{a21,a22_bites,a2764_skewer_hand,a2766_special_seasoning,a283_hand,a286_hand}` 與 `a2770_placed` 中未引用的 16 個、對應未引用貼圖。
- 驗收：staging 世界所有物品手持／放置／背包圖示與刪除前截圖一致；`rp_geometry_files`、`rp_total_mib`、`version_prefixed_model_dirs` 下降並 tighten。

**P2 出口條件**：repo 工作樹 < 120 MB；CI < 5 分鐘；docs ≤ 12；`development/`、`artifacts/`、`history/` 不存在；runtime BP 位元組與 `4d5fb095` 相同（RP 僅 T2.8 的刪除）。

### P3：Runtime 重構（行為保持，先寫特徵測試再搬）

> 原則：**先寫能在 fake world 跑的行為測試，固定現在「正確的」行為，再把程式搬到新結構**。遇到現行行為與 Java 不一致時，**先照 Java 修正測試期望值**並在 PARITY.md 記一筆，不要為了保持舊 bug 寫測試。

**T3.1 建立 fake world harness**（`tests/scenario/harness.js`）
- 提供：`World`（方塊、permutation、dynamic properties、實體與容器、時間）、`Player`（背包、主副手、飢餓／飽和、效果、property）、`ItemStack`（typeId、amount、dynamic properties、lore、可堆疊判定）、事件觸發（interact、break、explode、itemStartUse/StopUse/CompleteUse、tick）、故障注入（第 N 次寫入拋錯）。
- 以 `@minecraft/server` 的型別為準，只實作用到的子集；**不 mock 任何 runtime 模組**，透過 import map 把 `@minecraft/server` 換成 harness。
- 驗收：用 harness 跑通「放烤架→點火→放 3 串生牛肉串→時間推進→取出熟串」的完整流程測試。

**T3.2 `core/` 建立**：`ids.js`（由 BP items/blocks/entities 產生並檢查一致）、`persist_keys.js`（把 `tools/guards/save-compat.lock.json` 的 `persisted_key_literals` 全部逐字集中，含各 namespace 的 key 與前綴；清單與數量以執行任務時的鎖為準，舊模組改為 import 這裡的常數）、`persist.js`、`transaction.js`、`storage.js`（搬入 `family_station_storage.js` 的邏輯，不改 key／實體 ID）、`events.js`、`scheduler.js`、`player_props.js`、`item_meta.js`。
- 驗收：save_compat 鎖不變；新 core 單元測試覆蓋：寫入失敗回滾、容器滿時剩餘掉落、metadata 完整保留。

**T3.3 逐域搬遷**（每個域一個 PR，順序：`grill` → `skewer` → `plate` → `recipe` → `seasoning` → `oil` → `rack` → `food`/`effect` → `crops` → `world` → `advancement` → `compat` → `guide`）

每個域 PR 的固定步驟：
1. 從 `data/java/` 與 Java 原碼（§8 對照表列出的類別）整理該域規則，寫 `tests/unit/<域>.test.mjs`（logic 層）與 `tests/scenario/<域>.test.mjs`（完整玩家流程＋至少 1 個故障注入）。
2. 建 `scripts/<域>/logic.js`、`runtime.js`、`visual.js`；把舊模組中屬於此域的邏輯搬進來（**搬而不是重疊**），舊檔刪除。
3. 該域的方塊改用 custom component（block JSON 加 component 宣告），刪除對應的全域監聽。
4. 該域所有計時移入 `core/scheduler.js` 或方塊 `onTick`。
5. `npx tsc --noEmit` 對新檔通過；舊 `tests/legacy/` 中該域的測試刪除。
6. 棘輪 tighten：`script_modules`、`version_prefixed_script_modules`、`global_*`、`run_intervals` 應下降。
7. 打包後在 **staging** 跑該域的人工檢查清單（§9.5），結果貼在 PR。

**T3.4 進食系統重寫**（跨 skewer/food/plate，單獨一個 PR，高風險）
- 刪除 `prepareEatingItems` 換手持物品的機制；進食動畫選擇改為：`itemStartUse` 時寫 player property（profile、hand、random alt），attachable 動畫控制器讀 `q.property`（必要時 `c.owning_entity`）。
- Java 事實（`MultiBiteSkewerItem`，已核對原碼）：一次連續使用吃完整串；`AnimationProfile` 決定時長與每口的秒數——ONE 90 tick、TWO 90、THREE 100、THREE_ALT 90、FOUR 90；THREE_RANDOM 物品每個 stack 以 custom data `SkewerEatingProfile` 決定走 THREE（100）或 THREE_ALT（90）；可見的口數＝已過秒數跨過幾個 bite 秒數；放開時已使用 ≥ 25 tick（`MINIMUM_EAT_TICKS`）即可結算；關閉進食動畫設定時時長為 25 tick。現行 `_java_three_alt`／`_native_plain` 影子 ID 就是為了讓 Bedrock 的原生 `use_duration`（綁在 item ID）跟著這些時長變。
- 目標做法：每個物品只留一個 ID，`minecraft:use_modifiers.use_duration` 設為該物品可能的最長時長；使用開始時腳本決定本次 profile（THREE_RANDOM 的選擇存在 item dynamic property，對應 Java 的 `SkewerEatingProfile`）並寫 player property；口數由腳本依已過 tick 計算後寫 player property，attachable 以 bone 可見度呈現；結算三種路徑：(a) 原生完成；(b) 本次 profile 較短（例如 THREE_ALT 90）時，腳本在第 90 tick 以交易方式結算並扣 1 份，扣份會結束原生使用；(c) 放開時 ≥ 25 tick 結算。每次使用一個 settled 旗標，防止 (a)(b)(c) 重複結算。
- **先做技術驗證（spike）**：在 T3.4 開頭用 GameTest／staging 驗證「使用中由腳本扣 1 份會結束原生使用且不會再觸發原生完成」。若驗證失敗，保留影子 ID 機制但收斂到 `food/` 一處、只在使用開始前替換一次（不再每 tick 檢查），並在 PARITY 記錄；**不可**在驗證前就刪掉現行機制。
- 影子 ID 在這個 PR **還不退役**（存檔裡可能有），只是**不再產生**；新增 runtime 遷移：玩家上線、開啟容器、手持時把影子 ID 換回基礎 ID（保留 metadata）。退役在 P4。
- 驗收：scenario 測試覆蓋主手／副手進食、中途切換、斷線、連吃；staging 實測三種串；`shadow_route_items` 下降 0（仍保留定義）但 runtime 不再引用它們產生新物品（新增一個 validate 規則：除遷移模組外，腳本不得出現影子 ID 字串）。

**T3.5 player.json 決策落實**（依 D6）
- 預設方案：移除對 `minecraft:player` 的覆寫，改為 property 需求最小化（目標 ≤ 8 個），並與 Tavern／World Liquor 協調出**家族唯一**的 player.json 由家族共用包提供；若家族無法共用，保留現狀但在 KNOWN-ISSUES 寫明不可與其他覆寫 player 的包共存。
- 驗收：`vanilla_entity_overrides` 依決策為 0 或維持 1 並記錄；staging 與其他家族包同時啟用時進食與手持畫面正常。

**T3.6 runtime 結構收尾**：`main.js` ≤ 100 行只做組裝；`packs/BP`、`packs/RP` 搬家（`baseline.json`、`config.json` 路徑同步；`save_compat`／`growth_ratchet` 路徑常數同步）；版本 bump 到 **2.9.0**。

**P3 出口條件**：
- 棘輪：`global_block_interact_handlers ≤ 1`、`global_break_handlers ≤ 1`、`global_explosion_handlers ≤ 1`、`script_event_listeners ≤ 1`、`run_intervals ≤ 2`、`version_prefixed_script_modules = 0`、`source_text_slicing_tests = 0`。
- 每個域都有 unit＋scenario 測試；`tests/legacy/` 為空。
- staging 完整走過 §9.5 全清單並記錄；luosen 部署 2.9.0（§5.5）。

### P4：視覺重建與影子 ID 退役

**T4.1 視覺盤點表**：以 `data/java/` 的物品清單產生 `docs/PARITY.md` 的視覺子表：每個物品 × {背包圖示、第一人稱、第三人稱、放置、進食}，記 Java 參考（模型路徑）與 Bedrock 實作方式（§7）。

**T4.2 逐表面重做**（每個表面一個 PR，順序：烤架顯示 → 餐盤顯示 → 手持串（固定串）→ 手持秘製串 → 進食 → 調料瓶 → 油刷／榨油 → 料理架 → 串譜架 → 大缸）
- 每個 PR：從 Java 原模型在 Blockbench 建 Bedrock 模型（`.bbmodel` 存 `assets-src/blockbench/`）→ 匯出 → 改用原生狀態機制 → 刪除舊烘焙 geometry 與「投影」腳本 → staging 截圖對照 Java 截圖（同角度）。
- 驗收：`largest_geometry_kib ≤ 512`；`rp_total_mib` 明顯下降；對照截圖附在 PR。

**T4.3 影子 ID 退役**（走 SAVE-COMPAT 流程，最高風險）
- 前置：T1.6 普查數據；T3.4 的 runtime 遷移已在 luosen 運行 ≥ 2 週（讓多數玩家物品已被自動換回）。
- 步驟：重新普查 → 離線改寫工具在 staging 副本執行（§5.6）→ 收據顯示影子 ID 數量歸零 → staging 載入／互動／重啟 → `id-retirements.json` 登錄 → 刪除影子 item JSON 與相關 attachable → 部署 luosen（停服＋備份＋離線改寫＋開服讀回）。
- 驗收：luosen 改寫收據；開服後再普查一次影子 ID=0、基礎 ID 數量＝改寫前基礎＋影子；玩家回報無物品遺失。
- 不要做：不要只靠 runtime 遷移就刪除定義（沒上線的玩家、沒打開的箱子都還有舊物品）。

### P5：功能還原補完

依 `docs/PARITY.md` 中狀態不是「真人驗收」的列，按玩家影響排序逐列處理：先核心循環（取得食材→穿串→烤→調味→吃→效果），再機器（榨油機、大缸、料理架），再世界（花椒樹、作物、戰利品、成就），最後周邊（指南、HUD）。

每列一個 PR：Java 原碼位置（§8）→ 差異描述 → 測試 → 實作 → staging → 更新 PARITY 該列。

### P6：家族整合收斂（可在 P3 後並行）

見 §6。驗收：私有 repo 不含任何遊戲邏輯；公開 runtime 不依賴任何「只有私有整合才提供」的能力而不降級。

### P7：常態維護

- 每個變更：一個 PR、CI < 3 分鐘、CHANGELOG 一行。
- 玩法變更：staging 驗證後才部署 luosen；部署頻率依 D2。
- Java 上游更新：`tools/java_extract/` 重新萃取 → diff `data/java/` → 依差異開 PR。
- 每季：普查 luosen 一次、跑 `persist.audit()`、檢查棘輪是否可再收緊。

---

## 5. 伺服器與 luosen 存檔作業手冊

> 以下 `<BDS>` 代表 luosen 的 BDS 根目錄。2026-10-19 盤點實測：BSM 以 Docker 容器執行（`dmedina559/bedrock-server-manager:3.10.6`，容器名 `bsm-container`），資料卷 `bsm_data` 掛在主機 `/var/lib/docker/volumes/bsm_data/_data`（容器內 `/root/bedrock-server-manager`）。所以 `<BDS>` = `/var/lib/docker/volumes/bsm_data/_data/servers/luosen`，世界 = `<BDS>/worlds/Bedrock level`。家族範本裡的 `/srv/bsm/...` 不是這台的實際路徑；`/srv/src`、`addon_quality`、`family_bundle` 的實際位置仍待確認。

### 5.0 luosen 實測現況（2026-10-19 01:33 唯讀盤點）

來源：擁有者電腦以 SSH 唯讀收集的 metadata（未停服、未寫入、不含憑證與世界資料庫內容）。原始報告不進公開 repo（含主機名稱與 port）；以下只記錄對重建有影響的事實。

| 項目 | 實測 | 對計畫的影響 |
| --- | --- | --- |
| BDS 版本 | 伺服器內附 vanilla pack 到 1.26.52 | GameTest／staging 用同版本 BDS |
| 世界啟用 | **26 個 BP、24 個 RP**；manifest 全部可解析、相依沒有缺 | 排查衝突時要看整個組合，不只家族包 |
| 腳本包 | 25 個 BP 帶 script 模組，`@minecraft/server` 版本從 1.13.0 到 2.10.0 混用 | 伺服器腳本負載高；煙火的逐 tick 迴圈與 16 個 interval 會和其他 24 個腳本包搶 tick 預算（伺服器設定 `script-watchdog-slow-threshold=10`、`spike=100`） |
| **最高優先權包** | 第 1 位是「森羅私有修復支援 1.0.57」BP（純 data）＋RP；**RP 相依 Tavern、Grilling、World Liquor、A Magic Way、Java Saturation、Immersive Eating** | 相依宣告本身不能證明私有包內有哪些與 Grilling 同路徑的檔案。若有同路徑資產，較高優先權可能使 Grilling 的修正不生效；**實際覆蓋範圍與是否造成畫面未變，待 T1.9 逐檔清單與對照確認**。 |
| Cookery | 作者 Cookery 1.6.2（BP 第 12 位）；其中 `scripts/api/cuisine_api_host.js`、`board_api_core.js`、`food_api_core.js` 與本 repo `host_api/` 同名檔**逐位元相同** | 需確認作者官方 1.6.2 發布包是否本來就含這些檔（作者採納）或是部署時被注入（宿主修補）（T1.10） |
| 改版的第三方包 | 「森羅廚房：國味」標示「相容修補 1.0.55；作者原版 1.0.6」、版本號改成 1.0.10657；「Java Saturation」「UI Queue」「FP decode」都帶「Senluo HUD／Senluo FP decode」標記與改過的版本號 | 家族對第三方包也做了修補版，這些都屬於 §6 要收斂的私有整合範圍；HUD 通道衝突（`KT_HUD!` 原始碼外露）與這幾個包有關 |
| 另一個進食包 | 「Kaleidoscope Immersive Eating 1.1.0」BP＋RP 同時啟用 | 與煙火自己的進食動畫／投影可能重疊；T3.4 與 D6 必須把它列入相容驗證（staging 第 11 項） |
| 主機資源 | 16 GB RAM、可用約 4.2 GB；**2 GB swap 已用盡**；同時有 2 個 `bedrock_server` 程序 | 記憶體吃緊；巨型 geometry 與高頻腳本會放大問題。staging 伺服器要確認記憶體足夠再開，必要時先停掉另一個 BDS |
| 磁碟 | 248 GB 中約 33 GB 可用 | 每份停服備份的大小要先量；保留策略（§5.3）要配合可用空間 |
| content log | 最新一份尾段 1228 行：0 個 error、**489 個 warning** | 尚未分類；T1.4 補做 warning 分類（哪個包、哪類） |
| 伺服器設定 | survival、easy、`allow-cheats=true`、`tick-distance=4`、`view-distance=8`、`max-players=10`、content log 有開 | — |

新增 P1 任務：

- **T1.9 私有包覆蓋清單**：列出「森羅私有修復支援」RP（與 BP）中每個與 Grilling RP／BP **同路徑**的檔案，逐一分類：(a) 已在 Grilling 修好、私有包是舊版 → 從私有包移除；(b) 私有包修的是 Grilling 的真 bug → 移進 Grilling canonical；(c) 跨包整合 → 依 §6。驗收：覆蓋 Grilling 的檔案數歸零，或每個都有分類與去處。
- **T1.10 Cookery 原版比對**：取得作者官方 Cookery 1.6.2 發布包，比對伺服器上那份的逐檔雜湊。驗收：列出伺服器版與官方版不同的每個檔案及來源。若有任何注入，計畫 §6.2 的「B 宿主修補」要把它們全部移除。

### 5.1 存取

- SSH 金鑰由擁有者提供；**金鑰、密碼、BSM token 一律不得寫入任何 repo、PR、issue、log 或收據**。
- 進入伺服器後第一步：
  ```sh
  hostname; date; free -h; df -h /var/lib/docker
  docker ps --format '{{.Names}} {{.Image}} {{.Status}}'
  ls /var/lib/docker/volumes/bsm_data/_data/servers/
  grep -E '^(level-name|server-port)=' <BDS>/server.properties
  ```

### 5.2 唯讀盤點

```sh
python3 tools/ops/server_inventory.py --server-root <BDS> > /tmp/luosen-inventory.json
```
重點看 `problems`：未安裝的 UUID、同 UUID 多版本、相依不滿足、多個包覆寫 `minecraft:player`。

### 5.3 停服完整備份（每次改動 luosen 之前）

1. 公告玩家 → 透過 BSM 正常停止 luosen（不要 kill）。
2. 確認程序已結束、`<BDS>/worlds/<level>/db/LOCK` 不被占用。
3. 打包（luosen 的附加包都裝在世界目錄內的 `behavior_packs/`、`resource_packs/`，會一起備份）：
   ```sh
   cd <BDS> && tar --zstd -cpf <備份目錄>/luosen-<YYYYMMDD-HHMM>-<目的>.tar.zst \
     "worlds/Bedrock level" server.properties permissions.json allowlist.json 2>/dev/null
   ```
   `<備份目錄>` 由擁有者指定，**不要放在 bsm_data 卷內**（同一磁碟故障會一起遺失）；先 `du -sh "<BDS>/worlds/Bedrock level"` 確認空間。
4. `sha256sum` 寫入同名 `.sha256`；記錄大小。
5. 解壓到臨時目錄抽驗 `level.dat` 存在、`db/` 檔數一致。
6. 複製一份到伺服器以外的位置（擁有者指定）。
7. 保留策略：最近 3 次＋LKG-0 永久。

### 5.4 staging 伺服器

- 在 BSM 建立 `luosen-staging`：同版本 BDS、不同 port、`allowlist` 只含擁有者與測試帳號。
- 世界：從最新備份解壓。pack：與 luosen 相同組合（26 BP／24 RP，含私有修復支援包與 Immersive Eating），再換上候選版本。
- 主機記憶體吃緊（§5.0）：開 staging 前看 `free -h`；可用記憶體不足時先和擁有者確認是否暫停另一個 BDS。
- 每次驗證流程：開服（看 content log 無錯誤）→ 進服 → 執行 §9.5 檢查 → 正常停服 → 再開服 → 抽查資料仍在。
- staging 世界用完可重置，**永遠不要把 staging 世界複製回 luosen**。

### 5.5 部署到 luosen

1. 前置：候選版本已 CI 通過、已在 staging 驗證、已打 tag／release。
2. §5.3 備份。
3. 以家族既有工具（`family_bundle`／`family_guard`／BSM 准入）安裝完整家族組合；**不手動拷貝單一包**。
4. 開服；看 content log；確認世界啟用的 pack 版本（再跑一次 §5.2，比對收據）。
5. 進服抽查核心循環。
6. 寫部署收據（時間、版本組合、備份檔名與 SHA256、驗證結果）到家族 repo 的單一部署紀錄檔。
7. 回滾：停服 → 還原上一份備份 → 恢復上一組 pack → 開服 → 讀回。**回滾必須在 15 分鐘內可完成**，每次部署前確認備份可用。

### 5.6 世界 ID 普查與離線改寫

用途：T1.6（普查）、T4.3（退役改寫）。

- 工具選擇（P1 評估，二選一後寫進 `tools/ops/world_ids.py`）：`amulet-leveldb`＋`amulet-nbt`（Python，含 Mojang LevelDB fork 與 zlib-raw 壓縮），或 Node 的 Bedrock LevelDB 綁定＋`prismarine-nbt`。
- 掃描範圍：
  - `SubChunkPrefix`（tag 0x2f）記錄中的方塊調色盤 → 方塊 ID 與 state。
  - 方塊實體（tag 0x31）與 actor 記錄（`actorprefix…`／`digp…`；舊格式 tag 0x32）→ 容器 `Items`、實體 `Inventory`／`Mainhand`／`Offhand`／`Armor`、掉落物 `Item`。
  - 玩家：`~local_player`、`player_server_*`。
  - 遞迴尋找所有含 `Name` 字串欄位的物品 compound（包括 shulker box 內的巢狀 `Items`）。
  - world dynamic properties（LevelDB 中 dynamic properties 記錄）→ 依 `persist_keys.js` 前綴統計。
- 普查輸出：每個 ID × 位置類型 × 數量；每個 key 前綴筆數；找不到對應方塊的站點 key 數。
- 改寫規則：只改 `Name`（必要時 `Damage`/`Block` 欄位），保留 `Count`、`tag`、`CanPlaceOn` 等全部欄位；方塊調色盤改名需同時處理 state 對應。
- 安全規則：**只在停服備份的副本上執行**；改寫前後各普查一次；收據必須滿足「舊 ID＝0、新 ID 增量＝舊 ID 原量」；然後才在 staging 開服驗證，再於 luosen 停服狀態套用**同一工具同一參數**。
- 工具本身要有單元測試（用小型合成世界或從 staging 匯出的單一 chunk）。

---

## 6. senluo-family-integration-private 收斂方針

> 本計畫撰寫時無法存取該私有 repo；以下是終態要求與盤點步驟，具體檔案清單由 T1.7 補上。
>
> 伺服器盤點（§5.0）記錄了最高優先權的「森羅私有修復支援 1.0.57」BP＋RP；其 RP manifest 相依 Tavern／Grilling／World Liquor／A Magic Way／Java Saturation／Immersive Eating。**相依宣告不等同於已確認的檔案覆蓋**，實際與 Grilling 同路徑的檔案及其內容仍待 T1.9 盤點。同時存在數個改過版本號的第三方修補包（國味相容修補、Java Saturation／UI Queue 的 Senluo HUD 版、Senluo FP decode）。T1.9、T1.10 與 T1.7 一起完成。

### 6.1 盤點（T1.7）

在私有 repo 產出 `INVENTORY.md`，逐項列出：
1. 部署時對作者 Cookery 包做的每一個修改（檔案、目的、對應公開 runtime 的哪個需求）。
2. 注入或額外載入的腳本／pack（UUID、版本、作用）。
3. 對 Tavern／Grilling／World Liquor 提供或依賴的 API（scriptevent namespace、dynamic property、player property、UI）。
4. 伺服器專用設定（世界名、port、路徑）與憑證存放位置（只寫位置，不寫內容）。
5. 每一項的分類：**A 遊戲邏輯**／**B 宿主修補**／**C 部署設定**／**D 憑證**。

### 6.2 終態

| 類別 | 去處 |
| --- | --- |
| A 遊戲邏輯 | 移入對應公開 repo（例如 `grilling/compat/cookery/`），以能力探測啟用；不能公開的（作者授權問題）改為不需要 |
| B 宿主修補（改 Cookery 檔案） | **全部移除**。需要的能力改為：(1) 向 Cookery 作者提出 API 需求；(2) 在 Grilling 端以介面卡與降級處理實作；(3) 仍做不到的寫進 KNOWN-ISSUES |
| C 部署設定 | 留在私有 repo，只剩設定檔與部署腳本 |
| D 憑證 | 不放 repo；伺服器上的權限受控檔案 |

驗收：私有 repo 不再含 `.js` 遊戲邏輯或 Cookery 檔案副本；luosen 以「作者原版 Cookery＋三個公開包＋設定」即可運作，缺少的整合能力在遊戲中靜默降級（不報錯、不掉物品）。

### 6.3 Grilling 端的 Cookery 介面卡規範（`scripts/compat/cookery/`）

- `probe.js`：開服時偵測 Cookery 版本（pack 不可直接讀版本 → 用 Cookery 公開的 scriptevent／API 握手或其已註冊的方塊／物品 ID 存在性判斷），產出能力表 `{board: bool, oilPot: bool, wok: bool, stockpot: bool, millstone: bool, guide: bool}`。
- `adapter.js`：對每項能力提供 `available()` 與操作函式；不可用時回傳明確的「不支援」，呼叫端顯示既有 Java 風格回饋或什麼都不做，**絕不扣除物品**。
- 依賴的 Cookery 版本寫在 `baseline.json` 一處；manifest 相依與 `baseline.json` 由 `tools/validate.py` 檢查一致。

---

## 7. 視覺還原方法（逐表面）

> 總則：**以 Java 1.1.1 素材為唯一來源**（`assets-src/java/`）。Bedrock 能原生表達的狀態就用原生機制；不能的寫進 KNOWN-ISSUES，不用烘焙巨型幾何或影子 ID 硬湊。每個表面都要在 staging 截圖，與 Java 同角度截圖並排附在 PR。

| 表面 | Java 參考 | Bedrock 目標實作 | 取代的現行做法 |
| --- | --- | --- | --- |
| 烤架方塊本體 | `GrillBlock`、`models/block/grill*.json` | block geometry＋`minecraft:material_instances`；lit/phase 以 block state＋permutation 切換貼圖 | 保留，整理 |
| 烤架上的串（3 格） | `GrillRenderer` | 單一顯示實體 `grill_food_visual`：一個扁平「物品精靈擠出」幾何含 3 個 slot bone；**每格一個 render controller**，貼圖陣列以 `q.property('kaleidoscope_grilling:slotN')` 索引（int，0＝空）；生／熟／焦為不同索引 | 1.6 MB `grill_display.geo.json` 烘焙 |
| 餐盤（1–5 串） | `SkewerPlateRenderer` | 同上模式：顯示實體 5 個 slot bone＋5 個 render controller；朝向用 block state 傳給實體 property | `plate_food_visual` 烘焙＋投影 |
| 固定串手持 | Java item model（`models/item/fixed_skewers/*`） | 每個物品一個 attachable，geometry 用 Blockbench 從 Java item model 轉出（通常是 2D 精靈擠出）；第一／第三人稱位移在 attachable 動畫或 geometry 的 item_display_transforms 對齊 Java `display` | 多代 `aNNN_hand` 幾何 |
| 秘製串手持（任意 3 食材） | `SecretSkewerItem`、`SkewerColorProvider` | 共用 attachable：3 個食材 bone，貼圖陣列（全部食材精靈拼成的 atlas 或陣列）以 player property `secret_main_0..2`／`secret_off_0..2` 索引；竹籤一個 bone | 1.8 MB `secret_held` 烘焙＋多段校準 |
| 秘製串背包圖示 | `CustomSkewerGuiTexture`、`SkewerGuiDecorator` | **平台限制**：Bedrock 無法依 stack 合成圖示 → 通用圖示＋lore 列食材（KNOWN-ISSUES） | 影子 ID 嘗試 |
| 失敗串 | `FailedSkewerData` | 與秘製串相同 attachable，換貼圖陣列 | 7.3 MB `failure_skewer_held` |
| 進食動畫 | `SkewerEatingAnimation`、`SkewerEatingPiece`、`EnderPearlEatingAnimation` | attachable 動畫＋動畫控制器，條件 `q.is_using_item`＋`q.property('…:eat_profile')`；一口一口的消失用 bone 可見度（`q.property('…:eat_piece')`），不是 150 個 bite 幾何 | `a22_bites` 150 幾何、影子 ID 換手 |
| 調料瓶（放置） | `SeasoningBottleRenderer` | block geometry＋state（內容量階段），4 個瓶位用 permutation | 保留，整理 |
| 調料瓶（手持／搖） | `SeasoningFirstPersonAnimation`、`SeasoningAnimation` | attachable＋動畫控制器讀 `season_phase`／`season_hand` | 現行可沿用，移除重複版本 |
| 調料瓶背包圖示 | `SeasoningColorProvider` | 若 Java 圖示隨顏色／量變化：最少數量的變體 ID，由 `data/variants.json` 產生（D5） | 64＋16 個手寫變體 |
| 油刷 | `OilBrushFirstPersonAnimation` | attachable 動畫＋property | 沿用並整理 |
| 榨油機（鐵砧壓） | `AnvilPressAnimation`、`OilPressBlock` | block geometry＋state；壓下動畫以 block permutation 階段或短暫顯示實體 | 沿用 |
| 大缸 | `BigVatRenderer` | block state `vat_level`/`vat_fluid` 已存在 → permutation 切換液面幾何與貼圖 | 沿用，移除 `vat_premium_visual` 若可用 permutation 表達 |
| 料理架 | `AdvancedRackRenderer` | 顯示實體＋slot render controllers（同烤架模式） | `rack_tool_visual` 等 |
| 串譜架 | `SkewerRecipeBlockRenderer` | 顯示實體顯示配方圖示（同模式） | `recipe_icon_visual`、`custom_recipe_icon_visual` 兩套 → 合一 |
| 作物／花椒樹 | `*CropBlock`、`PepperLeavesBlock` | block geometry＋age state（已存在） | 沿用 |
| 熱食徽章 | `HotFoodGuiBadge` | 平台限制：用 lore／名稱顏色表示（KNOWN-ISSUES） | — |
| HUD（進食、調料、油鍋、機器） | `SkewerEatingHud`、`SeasoningBottleHud`、`OilPotHud`、`PotHud`、`MachineHud` | 依 D3；建議以家族共用的單一 JSON UI 通道實作，或先移除 | Actionbar 編碼傳輸（曾外露 `KT_HUD!S:` 原始碼） |
| 料理架介面 | `AdvancedRackScreen`、`RackSelectionScreen`、`RackShortcutScreen` | `@minecraft/server-ui` ActionForm／ModalForm | 沿用並整理 |

Blockbench 流程（擁有者電腦已有 Blockbench MCP）：
1. 開 Java 模型（`assets-src/java/.../models/...json`）→ 轉換為 Bedrock Entity／Block 格式 → 校正 pivot 與 UV → 存 `.bbmodel` 到 `assets-src/blockbench/<表面>/`。
2. 匯出 geometry 與貼圖到 `packs/RP`，identifier 以 `geometry.kaleidoscope_grilling.<表面>.<名稱>` 命名（無版本號）。
3. 第一人稱／第三人稱位移：以 Java `display` 區塊為準，在 Blockbench 的 Display 模式對齊，記錄數值到 `data/java/display_transforms.json` 對照。

---

## 8. 邏輯還原方法（Java → Bedrock 對照）

Java 參考：`https://github.com/breezeth-CN/KaleidoscopeGrilling/tree/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/`（Forge 1.20.1 分支邏輯相同時以 NeoForge 為準；差異寫進 PARITY）。

| 域 | Java 類別（主要） | Bedrock 實作重點 | 平台差異 |
| --- | --- | --- | --- |
| grill | `GrillBlock`、`GrillBlockEntity`、`GrillLoopSound`、`GrillCommand` | 3 格 ItemStack 存隱藏庫存實體；點火／刷油／翻面／調味的狀態機在 `grill/logic.js`；熟成以絕對 tick 計；循環音效用顯示實體播放或 `playSound` 節流 | 無 block entity → 隱藏實體＋dynamic property |
| skewer | `SkewerItem`、`SecretSkewerItem`、`UnfinishedSkewerItem`、`MultiBiteSkewerItem`、`GoldenSkewerItem`、`CursedSkewerItem`、`SkeweringHandler`、`SkewerRecipes`、`FailedSkewerData` | 穿串規則表來自 `data/java/skewer_recipes.json`（20 組有序配方）；秘製串三格內容存 item dynamic property（沿用既有 key） | 背包圖示限制（§7） |
| plate | `SkewerPlateBlock`、`SkewerPlateBlockEntity`、`SkewerPlateItem`、`SkewerPlatePlacement` | 餐盤內容 envelope（沿用 `plate_skewers` key）；手持盤食用＝依 Java 營養計算一次結算 | — |
| recipe | `SkewerRecipeBlock(Entity)`、`SkewerRecipeBookItem/Handler`、`SkewerRecipeCraftingRecipe`、`ClearSeasoningCraftingRecipe`、`ColdHouttuyniaCraftingRecipe` | 特殊合成無法用 Bedrock 配方 JSON 表達者，以互動方塊或 `onUse` 實作 | Bedrock 無自訂 crafting 序列化 |
| seasoning | `SeasoningBottleBlock(Entity)`、`SeasoningData`、`SeasoningEffects`、`SeasoningUse`、`PendingSeasoningItem`、`AdvancedSeasoningHandler` | EMPTY→PENDING→80 tick 搖勻→SPECIAL→使用扣次數；資料可由 integration API 覆寫（沿用 `replace_seasoning_data` 契約） | — |
| oil | `OilPressBlock(Entity)`、`BigVatBlock(Entity)`、`OilFillingHandler`、`OilFluidType`、`PremiumChiliOilBlock`、`OilPotCompat`、`PotOilAccess` | 流體以自訂液體方塊（已存在 `canola_oil` 等）＋桶物品；與 Cookery 油鍋互動走 `compat/cookery` | Bedrock 無自訂流體物理 → 方塊模擬 |
| rack | `AdvancedRackBlock(Entity)`、`RackFilterContainer`、`AdvancedRackMenu`、`RackKeyHandler` | 9 格庫存實體；篩選設定存 dynamic property（沿用 `rack_filters_` key）；介面用 server-ui | 無自訂容器 GUI → 表單 |
| food | `HotFoodHandler`、`HotFoodMerge`、`HotFoodExpiryHandler`、`EffectFoodItem`、`DualEffectFoodItem`、`FlavorFoodItem`、`FoodState`、`CuisineQualitySupport`、`WeddingCandyItem` | 熱食到期存 item property（`hot_until`）；合併規則照 Java；品質改 property（§3.5） | — |
| effect | `GrillingMobEffect`、`InvincibleHandler`、`DragonEggPowderHandler`；效果 `heavy_metal`、`heavy_metal_poisoning`、`dragon_blood`、`numb`、`invincible` | Bedrock 無自訂效果 → 腳本狀態＋原生效果近似＋圖示（若 D3 保留 HUD）；效果狀態沿用 `a21_fx` key | 自訂效果是平台替代，PARITY 註明 |
| crops | `CanolaCropBlock`、`HouttuyniaCropBlock`、`OnionCropBlock`、`SweetPotatoCropBlock`、`PepperSapling/Log/LeavesBlock`、`CropDropHandler` | `onRandomTick` 生長；骨粉 `onUseOn`；掉落用 loot table | — |
| world | `PepperTreeFeature`、`FortressHouttuyniaHandler`、`FortressWartReplacementHandler`、`VillagePepperLootHandler`、`KnifeDropHandler`、`StrippingHandler` | feature rules／loot table 注入；刀具掉落與 Cookery 刀的介面卡 | worldgen 只影響新區塊 |
| advancement | `data/.../advancement/*.json`（21 個） | Bedrock 無成就系統 → 以 scoreboard／dynamic property 記錄＋toast 式訊息（沿用既有 `adv_` key） | 平台替代 |
| compat | `compat/jade`、`jei`、`create`、`touhoulittlemaid`、`kubejs`、`ordertocook` | **不移植**（Bedrock 無對應模組）；PARITY 標記「不適用」 | — |

---

## 9. 測試策略與刪除清單

### 9.1 測試金字塔（終態）

| 層 | 位置 | 測什麼 | 數量目標 | 執行 |
| --- | --- | --- | --- | --- |
| 單元 | `tests/unit/` | `*/logic.js` 純函式：配方、熟成、效果、營養、合併、狀態機 | 每域 5–20 | 每 PR |
| 情境 | `tests/scenario/` | 經真實 runtime＋fake world 的玩家流程，含故障注入 | 每域 3–8 | 每 PR |
| 靜態包驗證 | `tools/validate.py` | §9.3 規則 | 1 支 | 每 PR |
| GameTest | `tests/gametest/` | 在真 BDS 內放方塊、模擬互動、推進 tick、斷言 | 核心循環 10–20 | 每晚 |
| 人工 | §9.5 清單 | 畫面、手感、聲音 | 每次部署 | staging |

### 9.2 寫測試的規則

- 測試名稱描述玩家可見行為（`"three raw beef skewers become cooked after 600 ticks while lit"`），不寫版本號。
- 期望值來自 `data/java/`，並在測試檔註明 Java 類別與行號。
- 每個 bug 修正附一個能在修正前失敗的測試；**不加**「守恆」「見證」「收據」類測試。
- 不測試私有實作細節；重構不應該讓測試失敗。

### 9.3 `tools/validate.py` 規則

1. 所有 JSON 可解析（允許 JSONC）。
2. BP／RP manifest 版本一致、與 `baseline.json` 一致；相依 UUID 與版本一致。
3. 每個 item 有 `minecraft:icon` 且貼圖存在；每個 item 在 `texts/en_US.lang`、`zh_TW.lang`、`zh_CN.lang` 都有名稱。
4. 每個 attachable／entity 引用的 geometry、texture、animation、render controller 都存在。
5. 每個 geometry 檔 ≤ 512 KB（P4 後強制）。
6. 配方與 loot table 引用的物品存在。
7. 除了 `core/migrations.js`，腳本中不得出現影子 ID 字串（P3 後）。
8. `unused-assets` 子命令列出未引用資產（P2 後每 PR 強制為 0）。

### 9.4 現有測試刪除／保留清單（T2.5 依此執行）

| 類別 | 範例 | 處置 |
| --- | --- | --- |
| 每版驗證器 | `verify_a*.py`（259） | 刪除 |
| 雜湊帳本／前版守恆 | `tools/test_g15*`、`test_g75_source_conservation.py`、`test_historical_source_refs.py`、`test_source_provenance.py` | 刪除 |
| 發布收據 | `test_g65_local_release_receipt.py`、`test_g66_local_release_receipt.py`、`test_publish_test_release.py`、`test_release_claim.py` | 刪除 |
| 切原始碼文字 | 33 支（棘輪計數） | 刪除；其斷言的玩法規則改寫進新 scenario 測試 |
| 投影／校準／烘焙幾何 | `test_*projection*.py`、`test_*calibration*.py`、`test_held_*`、`test_native_*`、`test_secret_*` 幾何類、`test_bottle_*` 幾何類 | 刪除（P4 換新實作） |
| 純邏輯 `.mjs` | `test_core.mjs`、`test_a24_core.mjs`、`test_a25_core.mjs`、`test_plate_transactions.mjs`、`test_oil_transactions.mjs`、`test_rack_transactions.mjs` 等 | 移 `tests/legacy/`，P3 各域完成後刪除 |
| 護欄 | `tools/guards/test_guards.py`、`tools/test_baseline_gate.py` | 保留 |

### 9.5 staging 人工檢查清單（每次部署前）

以表格記錄 ✔／✘／備註，附截圖：
1. 取得食材（砧板、磨盤、作物收成、刀具掉落）。
2. 穿串：固定配方 1 組、秘製串（3 種不同食材）、失敗串。
3. 烤架：放置、點火、刷油、放 3 串、翻面、調味、取出熟串、燒焦、拆除（內容物掉落）、爆炸取消。
4. 進食：主手、副手、中途切換、連吃、斷線重連；飢餓／飽和數值與 Java 對照。
5. 餐盤：放 1–5 串、四個朝向、取出、手持盤食用。
6. 調料瓶：EMPTY→PENDING→搖勻 80 tick→SPECIAL→撒料扣次數。
7. 榨油機、大缸、油刷、與 Cookery 油鍋互動（若可用）。
8. 料理架：放入、篩選、快捷取出。
9. 效果：重金屬、龍血、麻、無敵、龍蛋粉。
10. 重啟伺服器後：上述站點內容與物品資料仍在。
11. 同時啟用 Tavern／World Liquor：手持與進食畫面正常、無 content log 錯誤。

---

## 10. 待擁有者決定事項

| 編號 | 問題 | 建議預設 | 影響 |
| --- | --- | --- | --- |
| D1 | Java 對照版本 | NeoForge 1.21.1 分支、上游 commit `9a1acdab`（1.1.1）；新版本由 P7 流程跟進 | 所有還原工作的基準 |
| D2 | luosen 部署頻率（現行 AGENTS 有「每個候選都部署」的常設授權） | 重建期間只在 **P3 結束、P4 每次退役、P5 每批** 部署；P0 級存檔安全修補隨時部署 | 降低 luosen 風險與流程成本 |
| D3 | HUD（進食條、調料、油鍋、機器） | 重建期間**停用**，P5 最後以家族共用 JSON UI 通道重做或放棄 | 移除最大的 UI 衝突來源 |
| D4 | 是否開始 TypeScript | 否；用 JS＋`// @ts-check`＋`tsc --checkJs`，避免建置步驟 | 降低 AI 執行複雜度 |
| D5 | 料理品質與調料瓶的背包圖示是否必須不同 | 品質：否（用 lore）；調料瓶：依 Java 實際外觀數量保留最少變體 | 影子 ID 退役範圍 |
| D6 | `player.json` 覆寫 | 家族共用一份；Grilling 不再單獨覆寫 | 與其他附加包共存 |
| D7 | 刪除 492 個遠端分支 | 封存 tag＋清單後，刪除已合併或超過 7 天未更新的分支 | repo 可讀性 |
| D8 | 是否改寫 Git 歷史清掉 188 MB 產物 | 否（破壞所有既有連結與 fork）；只從 main 移除 | clone 大小維持 ~55 MB |
| D9 | 私有整合中無法公開的部分 | 改為不需要（降級），不另建第二個私有 runtime | §6 |
| D10 | 公開下載版（目前 A2.8.149）在重建期間 | 保持不動；P3 完成後發布 2.9.0，README 標示舊版已知問題 | 公開使用者 |

---

## 11. 風險登記

| 風險 | 可能性 | 衝擊 | 對策 |
| --- | --- | --- | --- |
| 清理時誤刪 ID 導致 luosen 玩家物品消失 | 中 | 極高 | 存檔相容鎖＋base 比較＋退役流程＋普查＋停服備份 |
| 重構改變行為而沒被發現 | 高 | 高 | 先寫 scenario 測試；staging 清單；GameTest |
| AI 代理遇到困難又開始疊補丁 | 高 | 高 | 棘輪＋禁止模式＋AGENTS.md；PR 審查看棘輪輸出 |
| 離線改寫工具破壞 LevelDB | 低 | 極高 | 只在副本執行；改寫前後普查；staging 驗證；備份可 15 分鐘回滾 |
| Cookery 版本更新造成介面卡失效 | 中 | 中 | 能力探測＋降級；依賴版本集中一處 |
| 家族包衝突（player.json、UI 檔） | 中 | 中 | D6；staging 第 11 項 |
| 擁有者無法即時回覆決策 | 中 | 低 | 每個 D 都有建議預設；只在不可逆動作前停下 |
| 伺服器存取受限 | 中 | 中 | P2 不需要伺服器；P3 前必須完成 P1 伺服器任務 |

---

## 12. 附錄

### 12.1 影子 ID 清單產生方式

```sh
python3 - <<'EOF'
import json,glob,re
ids=[json.load(open(p))['minecraft:item']['description']['identifier'] for p in glob.glob('projects/grilling/gameplay_core/behavior_pack/items/*.json')]
for pat in ['_native_plain$','_java_three_alt$','_cuisine_q\\d$','special_seasoning_r\\d+_v\\d+$','(partial|pending)_seasoning_f\\d$']:
    m=[i for i in ids if re.search(pat,i)]; print(pat,len(m))
EOF
```

### 12.2 現行全域監聽位置（P3 要逐一消除）

`beforeEvents.playerInteractWithBlock`：`main.js`、`a23_oil_world.js`、`a25_plate_recipe_runtime.js`、`a26_oil_machine_runtime.js`、`a2722_cold_houttuynia_runtime.js`、`a2736_typed_oil_pot_block_runtime.js`、`a2746_advanced_rack_runtime.js`、`a2750_cookery_cuisine_runtime.js`、`dragon_powder_runtime.js`、`hot_lore_runtime.js`、`station_contents_visual_runtime.js`、`host_api/oil_api_host.js`。

`system.runInterval`（16 處）：`main.js`、`hot_lore_runtime.js`、`oil_pot_ambient_runtime.js`、`held_visual_dispatch_runtime.js`、`a2747_wedding_candy_runtime.js`、`immersion_effect_feedback.js`、`immersion_audio_runtime.js`、`a26_oil_machine_runtime.js`、`a2748_pepper_tree_runtime.js`、`a2770_placed_visual_runtime.js`（2）、`a25_plate_recipe_runtime.js`、`a23_oil_world.js`、`grill_visual_runtime.js`、`station_contents_visual_runtime.js`。

### 12.3 未引用 geometry（依 geometry identifier 字串比對，T2.8 前需重新產生並抽查）

| 目錄 | 定義 | 未引用 |
| --- | --- | --- |
| `models/entity/a283_hand` | 194 | 194 |
| `models/entity/a2764_skewer_hand` | 150 | 150 |
| `models/entity/a22_bites` | 150 | 150 |
| `models/entity/a286_hand` | 86 | 86 |
| `models/entity/a2766_special_seasoning` | 42 | 42 |
| `models/entity/a21` | 39 | 39 |
| `models/entity/a2770_placed` | 59 | 16 |
| `models/blocks` | 49 | 3 |
| `models/entity`（根） | 1691 | 4 |

### 12.4 名詞

- **canonical runtime**：`baseline.json` 指向的唯一 BP/RP。
- **影子 ID**：為了選動畫／圖示而存在、Java 沒有的 item ID。
- **LKG**：last known good，完整可還原的停服備份。
- **staging**：與 luosen 同組合的測試伺服器，世界來自備份副本。
- **退役**：依 SAVE-COMPAT 流程移除一個持久化 identifier。
