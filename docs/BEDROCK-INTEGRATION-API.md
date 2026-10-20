# Bedrock integration API v1

本接口補齊跨包出料、公開逐堆變體、展示註冊及新生成來源契約。它不複製 Java 選用模組，也不推斷原作者私人 dynamic properties。既有 Cookery 油壺、砧板、出料收據及 secret-food 事件保持原契約。

## 傳輸與確認

作者伺服器腳本以 `system.sendScriptEvent` 發出 `kaleidoscope_grilling:integration_request`；回覆為 `kaleidoscope_grilling:integration_response`。僅處理 `sourceType === "Server"`；不接受實體來源、NPC 命令或真人冒充伺服器腳本。這是可信伺服器模組的介面，不是模組身份認證機制；有伺服器命令權限的管理員也能呼叫。

每筆 JSON 必含 `api: 1`、1–64 字元的 `requestId` 及 `op`，最大 8192 UTF-8 bytes。回覆包含相同 `requestId`、`ok`，及 `result` 或 `error`。無法解析或超限的訊息不執行；註冊總資料另限 30000 UTF-8 bytes。發送／確認機制見 [官方 System API](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/system?view=minecraft-bedrock-stable#sendscriptevent)。

| op | 其他欄位 | 行為 |
| --- | --- | --- |
| `discover` | 無 | 回傳能力、熔爐設定及平台限制 |
| `register_producer` | `registration: {producerId, items, kinds}` | 持久註冊；32 個來源、每個最多 64 種 output；kinds 為 cuisine／furnace／smoker／fresh_fortress |
| `register_projection` | `registration: {itemId, provider, defaultData?}` | 持久註冊 0–32767 的原生 data provider；128 筆上限 |
| `register_held_visual` | `registration: {itemId, referenceItemId}` | 以現有 213 個已核對圖像中的一個明確作為別名；128 筆上限 |
| `inspect_projection` | `target, expected` | 讀取實際物品，經同一 station renderer 規則取得 data |
| `inspect_held_visual` | `itemId` | 回傳目前圖像索引；未知為 0 |
| `inspect_producer` | `producerId, kind` | 回傳最後 sequence／phase，供確認失敗後核查 |
| `decorate_output` | `producerId, sequence, kind, target, expected, metadata` | 在指定的實際食物上寫公開資料；不產生／給予任何物品 |
| `fresh_fortress` | `producerId, sequence, generation` | 只處理權威新生成宿主提交的明確 wart 座標 |

同鍵、同值註冊為冪等；有衝突的註冊拒絕，不以後到訊息默默覆蓋。資料存入 Grilling 自己的 UUID 所有權，重啟重新驗證。無法讀回或回復的註冊會拒絕後續操作。

## 實際出料與逐堆變體

可直接採用自主編寫的 `scripts/integration_client.js`、`integration_stack_core.js`、`host_api/food_api_core.js` 及釘選公開原版資料 `vanilla_food_nutrition.js`，按原相對目錄放入作者自己的模組。原版食品不公開 scripting food component，SDK 以既有 Mojang 定義辨識；data-driven 食品仍以原生 component 為準，不把非食品 tag 猜成可食用。client 支援關聯回覆、逾時、關閉及同 producer 串行操作；不要重放作者食用回呼或偽造 `itemCompleteUse`。

```js
import {world} from '@minecraft/server';
import {createIntegrationClient} from './integration_client.js';
import {publicStackFingerprint} from './integration_stack_core.js';

const client = createIntegrationClient('example:food');
await client.request('register_producer', {
  registration: {producerId:'example:oven', items:['minecraft:cooked_beef'], kinds:['furnace']}
});
// 作者已實際完成製作／取料；container、位置及物品由作者自己的流程取得。
await client.serialized('example:oven', async () => {
  const state = await client.request('inspect_producer', {producerId:'example:oven', kind:'furnace'});
  if (!['unused','committed','rolled_back'].includes(state.phase)) throw Error('Inspect unresolved delivery');
  await client.request('decorate_output', {
    producerId:'example:oven', sequence:state.sequence + 1, kind:'furnace',
    target:{kind:'block_slot',dimensionId:'minecraft:overworld',x:10,y:64,z:10,slot:2},
    expected:publicStackFingerprint(container.getItem(2)),
    metadata:{seasoning:[]}
  });
});
```

`expected` 是 SDK 產生的 `{id, amount, name, lore}` 完整公開快照。JSON key 順序不影響比較；數量、名稱或 lore 變動則拒絕。目標可為 `block_slot`（dimensionId、x/y/z、slot）、`entity_slot`（entityId、slot）或 `player_slot`（playerId、slot）。clone 保留原生物品，從不以同名新建物品替換其原生 aux 或作者資料。

`metadata` 可含 `hotTicks`（cuisine：0–1728000）、`seasoning`（既有公開食物 v1：最多 8 個 item ID）、`nativeVariant`（0–32767）和 `projection: {v:1, provider, data}`。期限採製作時的世界 absolute tick，不取整到秒。furnace／smoker 使用 `enableSmeltedFoodHeat` 與 `smeltedFoodSeconds`；遵循 Java 預設 **false／30 秒**，管理命令沿用 `kaleidoscope_grilling:config`。沒有穩定的原生熔爐出料事件，因此作者仍須從自己的真正製作／取料 callback 呼叫；不把背包增加或容器關閉猜成新製作。

需要在交付前寫入時，可在實際 output 上呼叫 `prepareProducedFood(stack, metadata, world.getAbsoluteTime(), config)`，把返回的 clone 交回作者原本的交付流程。它嚴格拒絕非食物、損壞 payload 及已滿 lore，原物品不先被修改。熱度／調味使用 `senluo.public.food.v1`；逐堆展示使用 `senluo.public.projection.v1` 空翻譯 carrier。這些是公開資料，不能承載秘密。

註冊 provider 後，作者把實際 data 以 `writePublicProjection` 寫在那堆物品；兩堆同 ID 可有不同 data。來源作者須保證所公布的 nativeVariant 與實際原生物品相符；Grilling 不宣稱能從私人資料反推出它。未註冊／不符 provider、重複 carrier 或損壞值會拒絕展示，helpers 仍不擁有或交付物品。

每個 producer 只保留一筆最後操作，儲存量有界。sequence 從 1 開始逐次加 1；同 sequence／同請求的 committed 重播只回覆原結果，**不再加熱**；舊序號、跳號及同序號不同內容拒絕。prepared／quarantined 尚未解決時不得開始下一次。寫入失敗嘗試還原並核對；已確認成功而最終 journal 失敗，回傳 `recoveryPending:true`，保留 guard。逾時先核查，不得直接換新序號重做同一筆生產。真正要重試時保留原請求與序號；只改 requestId。

## 調料資料重新載入

未發版候選新增 `seasoning_data_roots_v1`，仍使用現有 Server-only request、保存讀回及失敗回滾：

```js
await client.request('replace_seasoning_data', {roots: [
  {seasoning_effects: [{ingredient: 'my_addon:spice', kind: 'speed'}]},
  {seasoning_effects: [{ingredient: 'my_addon:spice', kind: 'duration'}]}
]});
```

每次從原作預設值重建；後面的資料根覆寫相同 ingredient，空 `roots` 恢復預設值。一般 JSON 資料根可以沒有 `seasoning_effects`。未知或空 kind 仍是合法調料材料，但不附加虛構效果。瓶內必需的三種 base 材料依實際 ID 判斷，不能用 kind 冒充。

原 Java [GrillingDataManager](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/data/GrillingDataManager.java) 在 reload 時合併資料根，食用時才依目前映射計數；本介面同樣保留食物已存的 ingredient IDs。已存食物與瓶子的資料不因 reload 改寫。資料保存沿用 30,000-byte 登記上限；失敗不留下半套映射，舊 v1 存檔缺少 `seasonings` 欄位時仍可載入。

這是明確提供資料的介面，沒有自動讀取 Java datapack、探查 Cookery 私有 producer 或新增宿主能力。原作預設效果、瓶容量 8、16 次用量、配料與扣料守恆保持。實際原生重啟與玩家操作另行驗證；候選尚未凍結或部署。

## 手持展示

`referenceItemId` 必須是已存在的 catalog 食物圖像。明確別名會進入主副手各三個 client_sync 槽；沒有新物品圖像就拒絕，不悄悄選一個近似圖示。新增作者 textures／geometry 需要下一個已審查資源包發行；此接口不能即時產生任意 textures、背包 GUI 圖示、原作 tint 或脫離的第二截模型。Windows 畫面另行驗收。

## 新生成宿主

`generation` 必含：

```json
{"dimensionId":"minecraft:nether","structureId":"minecraft:fortress","isNewChunk":true,
 "generatedAt":1000,"chunk":{"x":0,"z":0},
 "bounds":{"min":{"x":0,"y":64,"z":0},"max":{"x":15,"y":64,"z":15}},
 "positions":[{"x":1,"y":64,"z":0}]}
```

只有可信生成器能在新區塊生成後、公開給玩家操作前提交；`isNewChunk`、結構與 bounds 是**宿主的權威保證**，接口無法獨立驗證歷史。generatedAt 距當前最多 20 ticks，bounds 必須裁切在該新區塊，最多 128 個不同座標。逐點核對目前仍為 soul sand 上的原生 nether wart；當前安裝後被真人放置／破壞過的整個下界區塊永久排除。不得用本接口處理舊區塊或自行掃描附近磚塊猜要塞。

選取遵循 Java 1.1.1 的 signed-long coordinate hash，`floorMod(hash,100)<25`；採四段 16-bit 精確整數，避免 2.8.50 在 BDS 的 BigInt 差異，並以 [277 筆獨立 Java 向量](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/d7adcef6fbeb9e5aa58b5a6e078bde79a6532cdd/development/gameplay_core/fixtures/fortress-java-vectors.json) 核對。wart age 0／1／2–3 映射為紅魚腥草 0／3／7。操作具同一持久序號、讀回與失敗回復，重播不再改方塊。

目前 `vanillaFortressCallbackInstalled:false`。官方 [WorldAfterEvents](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable) 沒有新區塊／要塞生成事件；[getGeneratedStructures](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dimension?view=minecraft-bedrock-stable#getgeneratedstructures) 仍為 pre-release，僅查指定點的結構名稱，不能提供所需的新生成歷史。完整 vanilla 自然 25% 替換仍待可靠宿主；本接口及人工搭建的原生測試都不能冒充此項完成。

## 證據界線

source 回歸檢查故障、儲存量、衝突、期限、signed-long hash、來源及重播。隔離 BDS 另核對跨 BP 事件、原生 inventory／variant、區塊讀寫與停服重啟。沒有模擬玩家；零玩家探針不證明 Windows 客戶端、真人農場事件、熔爐取料、自然要塞生成或第三方全部 callback。整套家族及最新停服存檔准入後更新 live，再由真人驗收。
