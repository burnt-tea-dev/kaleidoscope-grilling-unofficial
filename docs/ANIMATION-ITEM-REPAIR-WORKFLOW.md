# 動畫、物品顯示與手持修復流程

適用：所有後續動畫、attachable、第一／第三人稱手持、放置／掉落／背包物品顯示修復。先以官方推薦、官方範例與精確版本實作確認契約，再採用已獨立重現的開發者論壇／社群方案。不得用猜測位移、縮放或鏡頭補償掩蓋 scope、binding、controller 或時鐘問題。

本文件是方法與驗收清單，不是任何候選已通過 Minecraft 的證明。2026-10-15 編寫時只有本輪原生 Blockbench baseline 的有限捕獲；candidate 原生對照與當前遊戲驗收仍待完成。舊證據保留原版本／原範圍，不自動轉移到新候選。

## 1. 來源先行，固定版本與適用範圍

1. 先讀 [PARITY-MATRIX](PARITY-MATRIX.md)、對應 [BUGS](BUGS.md) 及 canonical BP/RP；確認確切物品、情境與失敗，不重新套用整批歷史修補。
2. 記錄 Minecraft client/BDS 完整版本、平台、皮膚、FOV、Java 原作 Minecraft/loader 分支與作者版本、資產／來源 commit、檔案路徑、SHA256。依 [BASELINE-MAINTENANCE](BASELINE-MAINTENANCE.md) 檢查現行 Java 上游；固定一份舊 fixture 不代表已跟上作者。
3. 優先讀 Microsoft 定義／範例、Mojang 同版本 vanilla pack、Blockbench 官方指南／release／實作。以匹配版本的 trident 或 spyglass 等真實 attachable 校準；不得把 `main`/`master` 當成不可變版本，下載後固定 commit 與內容 SHA256。沒有匹配版本時明列差距，不假稱校準通過。
4. 社群文章、論壇回答與 issue 只提供待驗假設。記錄作者／URL／日期／版本、最小重現、獨立驗證結果及與官方契約的差異，確認適用後才採用。第三方預覽器不是引擎正確性的裁判；不要為了複製其畫面增加不明常數。
5. 每個改動寫明：官方依據 → 原始失敗 → 最小修補 → 可重現驗證 → 尚未驗證。分開「原作來源支持」「editor 實作支持」「Minecraft 實測支持」。

### 已核對的編輯器來源基準

- Blockbench **5.2.2**，tag 對應 commit `c9ace42ef1b770bdadfe656729c7833b8feb37d2`。
- 本輪讀取官方安裝包 `resources/app.asar` 內 `dist/bundle.js.map` 的 embedded source；archive SHA256：`6d5d5ae941465ff88a58f158e1e529e428f04deaa8da2a8a40949ed0a2291123`。這是來源檢查，並未透過 eval 修改應用程式。
- 實作重點：`js/formats/bedrock/bedrock_multi_file.ts`、`js/formats/bedrock/attachable_preview.js`、`js/outliner/types/group.js`、`js/animations/animation_mode.js` 與 animation/bbmodel codec。升級 Blockbench 後重新核對，不無限沿用 5.2.2 的限制或常數。

## 2. 使用原生 scoped player + attachable

1. `File > New > Bedrock Player Model` 後 `File > Import > Import Bedrock Attachable`；或從既有 Bedrock 模型使用 `Load with Bedrock Player`。先校準 vanilla，再換成目標物品，保持玩家與鏡頭一致。
2. 確認 `multi_file_ruleset: "bedrock_attachable"`，player scope 1、attachable scope 2（其他附件使用不同 scope），分開 collections、textures、動畫。手臂 clip 屬於 player；物品 clip 屬於 attachable。核對 bone UUID 與 Animation Properties，不靠同名骨骼猜 scope。
3. 進入 Animate，選 Bedrock Animation Mode `attachable_first` 或 `attachable_third`。每次重開／換模式都重設鏡頭；僅儲存 mode 字串不保證相機已初始化。第一人稱使用可見 center-camera 按鈕，必要時 entity → first person 重新初始化。
4. 第一人稱 scoped 原生 preset：position `[0,27.41,0]`、target `[0,27.41,10]`、perspective、FOV `70.25`、aspect `16/9`。保留原生 camera lock；不要手動 orbit 後仍標記相同相機。第三人稱切到原生第三人稱模式後重新置中／設定可重現的外部觀察相機，記錄 position、target、projection、FOV 與畫幅；不可沿用第一人稱近鏡 preset 或宣稱任意 editor orbit 等於遊戲第三人稱鏡頭。
5. 只開 player `.geo.json` 不會建立 multi-file ruleset。若用離線 `.bbmodel` fallback，必須具備相同 ruleset、完整 player、各 scope／collection／texture／animation UUID，並經實際 UI import/save 檢查。結構檢查不等於成功渲染。

### 不混用座標系

原生 scoped 預覽已提供第一人稱玩家預設姿勢與 bound-root 補償；不得再疊加舊單模型教學的 holder pose／outer transform。

5.2.2 的 rightarm pivot `[-5,22,0]`、rightitem `[-6,15,1]`；leftarm／leftitem 為 `[5,22,0]`／`[6,15,1]`。第一人稱 rightarm editor rotation `[-95,45,115]`、position `[-13.5,-10,12]`，item bones position `[0,-7,0]`。這些是 editor 座標，不可直接把符號抄成 Bedrock export。

scope ≥ 2 的 explicit binding 會接到目標骨骼；bound root 起點扣 Y=24，有 parent 時改扣 parent origin。沒有 explicit binding 的同名 scope-1 骨骼 fallback 使用不同 local-position 規則，不能互換。舊 single-model camera `[0,19,-40]`、outer position／rotation 屬於另一條路徑，不適用此 scoped fixture。

Mojang player 的 `scripts.scale = 0.9375` 有來源依據，但不證明自訂 outer Y=-1.92。此流程不額外加入該縮放／位移。任何必要平台適配都要先證明所在座標層、版本與可重現誤差，再以有依據的最小改動處理。

## 3. Preview 與 runtime 分開

- **副手陷阱：** 5.2.2 native preview 的 `query.item_slot_to_bone_name(input)` 固定回傳 sentinel 85070，解析為 `rightitem`。只改 `context.item_slot` 不能驗證副手。可在獨立 preview copy 將需要的 binding 改成字面量 `'leftitem'`，記錄差異；production 保留原 slot-based binding，禁止把 stub workaround 匯出進 runtime。
- **Overrides：** `override_previous_animation` 將該動畫涉及的骨骼回到 default pose 再套用；不是清除所有 camera／outer transforms。官方建議替換 default player pose 的 player clip 使用 Override；attachable/helper 各自核對，不一律開啟。
- **Controllers：** 檢查 client entity／attachable 的動畫 aliases、scripts.animate、animation controllers、transition、blend、binding、render controllers 與 visibility 的完整引用鏈。原生 preview 中能見左臂，不代表遊戲 render controller 已允許左臂顯示。
- **Molang：** `query.is_item_equipped`、`query.equipped_item_is_attachable` 等 placeholder 只模擬輸入，不能證明 native item-use、per-hand session 或 controller graph。修改前保留原 placeholder 文字；逐項新增，避免清掉其他輸入。
- **時鐘與階段：** 固定 stage0 geometry 不會驗證逐口去塊／切圖。為 editor-time review 移除 `anim_time_update`／blend gates、拆分不同 scope 的 helper tracks，必須逐檔列為 preview-only 差異。timeline 秒數不是 native use clock；runtime bite stage、開始／取消／完成、重複食用、切槽／換手、body/camera bob 需獨立實測。
- **顯示種類：** 手持 attachable 通過不涵蓋 inventory icon、掉落物、放置內容、透明排序／光照；對受影響情境分別找官方範例與驗證。

## 4. 固定選中動畫與 playing set

5.2.2 stacking 會把「正在播放且被選中」的動畫移到最後，改選取可能改變 Override／混合結果。每組對照固定 selected animation、播放順序、playing set、scope、Override、controller state、blend weight 與 time。

`.bbmodel` codec 不保留 playing flags，重新開啟後必須恢復。此安裝版本的 MCP timeline 操作會先 `animation.select()`；改選會清除其他 `playing=true`，但保留 `playing='locked'`。先選持續作為 primary 的 clip（替換姿勢時通常是 player clip），在未選中的 secondary clip 上點播放圖示兩次：false → true → locked。之後 timeline calls 始終指向同一 primary；檢查圖示與實際合成後才捕獲。不要把「只剩單 clip」誤當修補結果。

當前 MCP schema 沒有 typed Bedrock Animation Mode setter，也沒有直接完整設定 playing set／scope／Override 的能力；使用原生 UI 或已核對 fixture。`trigger_action` 不等於能設定 BarSelect。`set_camera_angle` 未提供 aspect 欄位，須原生 reset 或匹配 view dimensions。以實際 schema 為準，不猜工具欄位。

## 5. 比較、證據與交付門檻

依序保留 vanilla 校準、baseline、candidate 的同設定對照。至少取 idle、action start/mid/end；有逐口或中斷行為時追加每個 stage 邊界、取消及恢復。第一／第三人稱、主／副手分開；按缺陷涵蓋 classic/slim、FOV、旁觀者及平台。需要最終投影驗證時，使用同版本遊戲測試包和清楚可見的軸線／landmark cubes。

證據分類沿用 [PARITY-MATRIX](PARITY-MATRIX.md) 的界線：

- 官方文件／來源閱讀及靜態結構、UUID、引用、匯出檢查是來源前置證據；Java 來源衍生 fixture 不是直接執行原 Java 純邏輯得到的黃金向量（A），也不是 Java 遊戲畫面。
- 數學模型、Python 投影及資產預覽是前置，不自動計入 A–D。B 專指守恆、冪等、交易回滾等不變量測試；使用 Node/API doubles 仍只支持該測試涵蓋的契約。Blockbench UI capture 額外標為 **editor preview**，不可升格為 Bedrock client（D）。
- BDS/native API（C）支持載入與列明的事件／狀態，不能驗證相機、畫面或聲音。
- 當前精確候選的真人 Minecraft client（D）才支持實際列明情境；有窄實測也不能外推完整聲畫、所有食物或完整家族。

失敗、未跑及受阻各自記錄。沒有新版 client 證據時保持 `client=false`、`production_ready=false`。只有 docs／tooling 變更不升包、不重啟 LIVE；真正 exported runtime 修補必須回 canonical source，走既有 PR／CI／版本／完整家族／部署與驗收流程。不得把 preview fixture 當 release input，也不得覆寫仍開放的失敗記錄。

## 6. 可複用檢查清單

- [ ] 確切失敗、物品 ID、顯示情境與舊證據範圍已記錄。
- [ ] 官方定義／範例優先；client、Java/loader、Blockbench、來源 commit/path/hash 已固定。
- [ ] 社群方案有版本、重現與獨立核對；沒有以未證實常數遮蔽問題。
- [ ] vanilla 校準與 target 使用同原生 scoped player、binding、鏡頭及畫幅。
- [ ] 第一／第三人稱各自重設；player/item/helper scopes、UUID 與 Override 已核對。
- [ ] primary selected clip、secondary locked clips、順序、time、blend／Molang 全部固定。
- [ ] offhand stub／literal leftitem、stage0、clock／gate 等 preview 差異均已列明且隔離。
- [ ] runtime controller／render visibility 與正常／取消／完成／重複操作另驗；其他物品顯示面分開。
- [ ] baseline/candidate 截圖能對應同一份收據；來源、editor、BDS、client 結論沒有混用。
- [ ] production diff 不含 preview 補償；既有版本與 CI／部署門檻保持不變。

## 7. 每次修補的收據模板

複製至該修補的公開 evidence 文檔；填實值、可存取的證據連結，未跑欄位寫 `not_run`。不得上傳私有腳本、世界、認證資料或機器日誌。

```yaml
repair: <issue/PR; symptom; item ID; display context>
source:
  canonical: <repository; baseline SHA; candidate SHA; changed paths>
  java: <Minecraft; loader; author release; source paths/revision/hash>
  bedrock: <exact client/BDS version; platform; reference pack revision/hash>
  blockbench: <version; source revision; app archive SHA256>
  references: <official URLs first; community URL/version/reproduction if used>
fixture:
  files: <baseline/candidate filenames and SHA256; asset source paths/hashes>
  ruleset: bedrock_attachable
  player: <classic/slim; scope; skin provenance>
  scopes_and_bindings: <player/item/helper; UUID mapping; original binding>
  preview_only_changes: <each clock/gate/stage/binding change, or none>
  runtime_export_checked: <result; preview-only changes excluded>
capture:
  mode: <attachable_first / attachable_third; main/offhand>
  camera: <reset performed; position; target; projection; FOV; aspect; lock>
  selected_primary: <clip>
  playing_order: <clips; scope; playing/locked; Override; blend weights>
  inputs: <controller state; all relevant Molang placeholders>
  samples: <time seconds; stage; capture path/hash for each image/video>
validation:
  source_and_structure: <pass/fail/not_run; exact check/result>
  editor_preview: <pass/fail/not_run; observed scope and evidence>
  java_logic_vectors_A: <pass/fail/not_run; exact reference evidence>
  invariants_B: <pass/fail/not_run; limitations>
  native_BDS_C: <pass/fail/not_run; limitations>
  current_client_D: <pass/fail/not_run; exact scenario and evidence>
  unresolved: <failures, omitted scenarios and next acceptance step>
  client: false
  production_ready: false
```

## 官方來源與補充參考

- [Blockbench 5.1 原生 attachable 工作流發布說明](https://github.com/JannisX11/blockbench/releases/tag/v5.1.0)：流程、scopes、camera lock、player Override、左臂 render-controller 限制；具體 5.2.2 行為另核對實作。
- [Blockbench 5.2.2 scoped 實作（固定 commit）](https://github.com/JannisX11/blockbench/blob/c9ace42ef1b770bdadfe656729c7833b8feb37d2/js/formats/bedrock/bedrock_multi_file.ts)；同 revision 的 [camera](https://github.com/JannisX11/blockbench/blob/c9ace42ef1b770bdadfe656729c7833b8feb37d2/js/formats/bedrock/attachable_preview.js)、[binding](https://github.com/JannisX11/blockbench/blob/c9ace42ef1b770bdadfe656729c7833b8feb37d2/js/outliner/types/group.js)、[stacking](https://github.com/JannisX11/blockbench/blob/c9ace42ef1b770bdadfe656729c7833b8feb37d2/js/animations/animation_mode.js)。本輪 exact installed 行為另由上述 archive source map 核對。
- [Microsoft Using Attachables](https://learn.microsoft.com/en-us/minecraft/creator/documents/attachables?view=minecraft-bedrock-stable)：官方 attachable／model binding 契約與範例。
- [Microsoft actor animation](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/actor_animation.v1.8.0?view=minecraft-bedrock-stable)：Override 與 animation 欄位定義。
- [Mojang bedrock-samples](https://github.com/Mojang/bedrock-samples)：使用前固定匹配 client 的 revision，不把預設分支當版本 pin。
- [Blockbench animation expressions](https://www.blockbench.net/wiki/guides/animation-expressions/)：placeholder 語法。
- [Bedrock Wiki attachables](https://wiki.bedrock.dev/items/attachables)：社群工作範例與歷史補償，需依上方流程獨立驗證，不能和 native scoped pose 直接疊加。
- [Blockbench render-controller 討論 #1469](https://github.com/JannisX11/blockbench/issues/1469)：問題／設計討論，不能單憑 issue 推定當前版本完整 runtime 支援。
