# 森羅物語：煙火 — 非官方 Bedrock 移植

Kaleidoscope Grilling 的 Minecraft 基岩版移植：從準備食材、穿串、刷油與調味，到烤製、擺盤和享用料理。

[下載 / Downloads](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases) · [更新紀錄](CHANGELOG.md)

## 功能

- 組合食材製作烤串，管理火候、翻面、油與調料。
- 製作食用油，種植相關作物並利用加工副產物。
- 使用餐盤、料理架等器具取放料理。
- 透過 Cookery 指南中的煙火入口查閱分類與配方。

**重建仍在進行，尚非完整 Java 1.1.1 還原。** 部分原生操作、食用呈現及效能仍待修復或真人驗證；具體差異見[功能對照](docs/PARITY.md)與[已知問題](docs/KNOWN-ISSUES.md)。

## 安裝

1. 備份世界，從 **Releases** 下載 `.mcaddon`；GitHub 原始碼 ZIP 不是安裝包。
2. 依該版說明取得指定版本的 **Cookery BP／RP 與相容宿主整合**，再啟用煙火的 BP／RP。
3. 使用所選版本要求的 Minecraft 版本與實驗設定。開發主線已使用 Beta APIs，不能套用舊版安裝條件。

**煙火目前不是單獨匯入即可完整使用的 addon。** 普通 `.mcaddon` 匯入不會替 Cookery 安裝所需宿主 API；僅放入原作者 Cookery 包仍不等於完成整合。下載只含煙火自有內容，不含 Cookery 或私有家族整合。詳見[安裝與發布](docs/RELEASING.md)。

## 語言

資源文字與指南資料提供 **English、简体中文、繁體中文**。資源文字跟隨 Minecraft 客戶端語言，指南由 Cookery 宿主呈現；部分指南標題及包資訊仍有本地化缺口，尚非全部介面都已翻譯。

## 開發

需要 Python 3 與 Node.js；CI 使用 Python 3.12／Node.js 22。正式來源在 [`projects/grilling/gameplay_core`](projects/grilling/gameplay_core/)，Java 配方、時長和效果資料在 [`data/java`](data/java/)。

先讀 [AGENTS.md](AGENTS.md) 與[重建計畫](docs/REBUILD-PLAN.md)，再執行相關功能測試及基本檢查：

```sh
python3 tools/baseline_gate.py check
python3 tools/guards/save_compat.py check
python3 tools/guards/growth_ratchet.py check
```

[`baseline.json`](baseline.json) 記錄來源版本、精確相依及實驗要求。保留既有物品與存檔身份；不要用增加物品變體、平行互動監聽或逐版補丁代替共用功能修復。

## 問題回報

請提供煙火／Cookery／Minecraft 版本、宿主整合方式、實驗設定、重現步驟和預期結果。食用、手持或動畫問題請附短片；勿公開世界、憑證或第三方完整包。

## 鳴謝與授權

原作：**breezeth** 的 [KaleidoscopeGrilling](https://github.com/breezeth-CN/KaleidoscopeGrilling)，並包含 Kaleidoscope Cookery 團隊素材。本專案並非原作者或 Minecraft 官方發布。

原始程式碼採 [BSD-3-Clause](data/java/LICENSE-CODE)，原始及衍生美術採 [CC BY-NC-SA 4.0](data/java/LICENSE-ASSETS)；工具另依各自授權。完整出處見 [ATTRIBUTION](projects/grilling/ATTRIBUTION.md)。
