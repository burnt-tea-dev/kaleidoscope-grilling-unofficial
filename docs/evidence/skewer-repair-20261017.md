# G151 串製作、內容顯示與進食整合修補

日期：2026-10-17。來源基底為 [G150／PR230 合併](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/aa091a1e91035d1510b579af11254a9bc9f86e6b)。本次玩家回報為「串的配方匹配有問題」「秘製串已穿料仍沒有顯示，還會吃空氣」。附圖可見第一人稱手持竹籤而沒有食材；圖片本身不足以辨識物品 ID、設定、使用階段或安裝版本。

本候選為 **G151／2.8.151，Cookery 1.6.1，family API 0.2.12**。三個代理分別修補配方／原料生產、食材顯示與進食資料，主整合保留三方變更並核對完整流程。

## 可重現的來源缺陷

| 玩家流程 | G150 的具體缺陷 | 本次修補與保留行為 |
| --- | --- | --- |
| 取得牛肉塊／雞皮後穿固定串 | Cookery 1.6.1 的牛肉砧板基線是內臟 ×3；雞肉改成肉塊 ×3、骨頭 ×1 的多產出。G 的兩份舊基線均為單產出 ×2，嚴格選擇器拒絕接入。 | 精確匹配目前作者聲明；牛肉仍按 Grilling 契約輸出兩塊牛肉，雞肉保留作者全部主產出再補雞皮。Board API 保存 schema 0.1.0、舊存檔合約和交易回滾保留。 |
| 看配方需要多少料／继续穿串 | 進度計算以 3 為 reduce 初值，單料／雙料配方仍顯示需要 3；寫 lore 也固定 `/3`。已有食材的 native snapshot 未全部在扣新料前核對。 | 按匹配中的配方顯示 1／2／3 料目標。扣料前預先還原整份結果；空或不完整秘製串不能作為嵌套食材。Java 的 20 組有序匹配維持。 |
| 關閉自訂進食動畫後拿秘製串 | preparation 會把秘製串轉到 `secret_skewer_native_plain`；手持資料仍存在，但 RP 沒有這個 alias 的 ingredient attachable。 | 增加 exact alias 的竹籤＋三食材投影，保留原生 25 tick 和靜態 FP／TP 姿勢；沒有加入 Java bite clock、helper 手臂或末段 latch。 |
| 穿入新 Cookery 食物 | 有限食材顯示目錄仍停在 113 個 Cookery 食品，漏掉 1.6.1 的四項。 | 追加 `tea_egg`、`butter_tea`、`clay_pot_milk_tea`、`mystery_tea`，涵蓋手持、烤架、餐盤及相關顏色投影；原 213 項編號保留。 |
| 開始、取消／換槽、完成食用 | 原版已有 before-use 三料檢查；後續 start／complete／settlement 沒有共同核對完整內容和當前持有權。已知 legacy ID-only 食材缺營養欄時也會落入零值。 | 同一解碼器校驗原始／熟料三槽，原生完成核對原槽位、完整物品身分及合法單份扣量；辨識得到的缺欄只補缺值，不覆蓋明確零值。營養、效果與容器回傳讀同份內容。 |

`secretFood` 的最低 1 營養是既有 Java 行為：三個合法而零營養的食材仍可使用。驗證不以可視化目錄作食用白名單；合法外部物品仍由實際已安裝 ItemStack 與保存資料判定。

## 來源與相容性

2026-10-17 核對 Java Grilling 作者 main 仍為 [`9a1acdab27698457bec16c9362678e574895a28c`](https://github.com/breezeth-CN/KaleidoscopeGrilling/tree/9a1acdab27698457bec16c9362678e574895a28c)。目前正式 1.1.1 檔案分別為 [Forge 1.20.1／8726006](https://www.curseforge.com/minecraft/mc-mods/kaleidoscope-grilling/files/8726006) 與 [NeoForge 1.21.1／8726014](https://www.curseforge.com/minecraft/mc-mods/kaleidoscope-grilling/files/8726014)。保留各 loader 證據的原本範圍。

實際下載並讀取作者 [Cookery Bedrock 1.6.1／9123386](https://www.curseforge.com/minecraft-bedrock/addons/kaleidoscope-cookery-unofficial/files/9123386)，原檔 SHA256 為 `5b01865d4dd9a455cd80dae4ddc94dc45964e074025f7d24c6f0c5e35f0fbe52`，與現行 descriptor 及家族鎖相同。只提交必要的兩份砧板聲明、食材 ID／tag／來源摘要和有限顯示衍生資料；完整作者包與腳本留在 Git 外。

新顯示食材的 raw indices 為 214–217，helper 使用未佔用的 markers 221–224，再解回原料索引；調料瓶 214、slime 215–219、failure 220 保持各自所有權。沿用相同 player properties，擴展所需數值上限，不增加同步欄位。家族組裝器拒絕多份 behavior `minecraft:player`，沒有靜默合併或讓 Tavern 覆蓋 G 的範圍。

家族的穩定作者准入採精確的 API declaration 和 copied helper hashes；因此 Tavern 需追加 0.2.12 的完整 profile。舊 0.2.11 profile、私有修補原始證據及既有前置關係保留。新來源不得借用舊候選的 editor／client 接受結果。

## 驗證範圍

配方與生產的實際作者包比對、取得／穿串／拆串／烤製／食用及失敗回滾，見 [原料修補紀錄](skewer-input-repair-20261017.md)。整合後 `test_full_skewer_flow.mjs` 已直接執行，含三代理交界的空串嵌套拒絕、合法三份零營養、保存內容、取消與交易守恆，沒有失敗或跳過。

進食代理執行了既有 food snapshot、native completion、Java use gates、skewer integration、fourth-flip snapshot 與 ingredient-effects 檢查；有效資料、缺料、air、未知 ID、native 版本／ID 不符、失效快照、換槽、替換物品及異常扣量分別覆蓋。使用 production callbacks 與 API doubles，沒有模擬 Minecraft 玩家。

顯示修補使用實際 held writer 與 render-controller expressions 做邊界核對；生成器使用倉庫固定 Pillow 12.3.0。新增 catalog 邊界、雙手互斥及舊項目保留由受影響的既有檢查驗證。完整必要 source／Dash export／baseline checks 由此 PR 的 canonical CI 執行，結果以 GitHub 對該精確來源樹的 checks 為準。

本次沒有取得原生 Blockbench 編輯器操作證據、Minecraft 客戶端畫面或完整家族 stopped-world/BDS/LIVE 讀回。`afterEvents` 拒絕補營養的腳本結果也不證明能追溯取消已開始的原生動畫。維持 `client=false`、`production_ready=false`，實際部署與人工作業在家族主索引另記。

## 同一候選的後續操作場景

1. 用正常生存砧板取得牛肉塊／雞皮；固定串按原作順序穿入，單料／雙料配方的進度與結果一致，錯序不誤配。
2. 使用既有普通食材及四個新增 Cookery 食材，對照穿串後、烤架、餐盤、主副手與重登後的內容；分別開啟及關閉自訂進食動畫。
3. 秘製串完整食用、取消、換槽、連吃與重載，觀察一份扣量、營養／效果及容器回傳；空／损壞資料不能成為可結算食物或嵌套穿串原料。

這些場景定義待驗證範圍，不把玩家附圖或來源檢查改標為修後驗收。每 stack 自訂背包圖示、任意未知外部貼圖及其餘既有顯示缺口保持原追蹤。
