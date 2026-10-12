# Kaleidoscope Grilling Gameplay Core

本分支 canonical runtime：**A2.8.129 Shared HUD Catalog Repair**。見 [本批修復與驗證邊界](../../../docs/STATUS-A2.8.129.md)；歷史版本紀錄保留供追溯。

這個目錄下的 `behavior_pack/` 與 `resource_pack/` 是目前真正要編譯、驗證與打包的來源。歷史 `development/gameplay_core/aXX*`、`verify_aXX*` 與已封存的版本 workflow 保留作追溯；**不要再從舊 augment/workflow 生成回來覆寫 canonical runtime**。

## Canonical 路徑

```text
projects/grilling/gameplay_core/behavior_pack
projects/grilling/gameplay_core/resource_pack
        │
        ├─ python development/gameplay_core/verify_current.py
        ├─ bridge Dash v1.2.0 build
        ├─ python development/gameplay_core/verify_current.py --compiled
        └─ python development/gameplay_core/package_current.py
                 ↓
           artifacts/review/*.mcaddon
           artifacts/review/*.brproject
           artifacts/review/SHA256SUMS.txt
```

GitHub canonical gate 為 `.github/workflows/gameplay-core.yml`，直接監聽正式來源。普通 PR／main 驗證會產生 review artifacts；正式發佈須經精確來源 CI 與家族驗證後，以手動 publish 模式及 `.github/release-request.json` 執行。Prerelease 不等於穩定版或實機驗收。

## 互動架構

原作 Java 是規格。`core_logic.js` 與 `*_core.js` 負責規則，`main.js` 與 adapters 負責 Minecraft API／事件／交易，attachable、geometry、animation 與 HUD provider 負責顯示。

Grill 與 Seasoning Bottle 共用 hand intent。A2.7.62 將 signature／capture／recheck 拆成純 `a2762_interaction_intent_core.js` 與 Minecraft adapter，延後執行前重新確認槽位和物品資料。

穿串仍有 item/block/entity 事件來源，但它們只作適配，實際玩法收斂到同一個 `scheduleSkewerAction` executor，保留同 tick 去重。

## A2.7.66 調料狀態與 Cookery 交易

補齊特製調料瓶尚缺的 22 種物品與 attachable：現在 8 個剩餘量分級 × 8 個變體共 64 種均有定義，覆蓋 128 組有效使用次數／變體輸入。新增狀態重用原模型，三張 palette 只複製既有貼圖的對應填充色塊，不另改手持偏移。

切換外觀保留配料、使用次數、變體、名稱、原始 lore、dynamic properties 與物品限制；資料複製失敗不返回半成品。Cookery 調味先準備新瓶，再提交背包與鍋具，失敗嘗試回滾；延後期间换槽或改變手持內容會取消。

放置瓶的世界外觀、Typed Oil Pot 世界外觀與 MAXIM tooltip 仍有待續作，不能以本批手持狀態完成取代它們。

## A2.7.65 烤串手持成果保留

39 個烤串 attachable／150 個 bite-stage geometry 已轉成 A2764 baked hand-space 路線，正式 runtime 不再引用 A2725 first/third-person root hold animation。A2.7.66 保留該成果並做結構回歸，不聲稱實際第一／第三人稱位置已通過 Minecraft 驗收。

## Legacy workflow 封存

A2.0～A2.7.60 的 65 條版本化 `gameplay-core-a*.yml` 原 blob 保存在 `docs/legacy_workflows/`，不再由 Actions 註冊。不要搬回 `.github/workflows/`；canonical gate 會拒絕重新出現的舊 workflow。

## 版本與資料相容

保留 BP/RP/module UUID、既有物品與方塊 identifier、world dynamic-property key 和 Cookery 1.0.6 依賴。新版本須在 `verify_current.py` 註冊對應 verifier，不能只改 manifest 後跳過檢查。

## 驗證邊界

Node／Python／Dash／CI 只能證明規則、語法、資源引用、編譯與打包；**不能證明 Minecraft/BDS 實機、Android 畫面、透明排序、動畫與多人可靠性**。A2.7.66 的 15 項 runtime 測試使用模擬 Minecraft API；各項實機旗標仍為 false。

`reports/build.json` 是早期歷史基線。當前變更請讀 `reports/a2766-seasoning-state-completion.json` 與 `docs/STATUS-A2.7.66.md`。
