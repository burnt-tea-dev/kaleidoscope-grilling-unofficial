# 煙火內建指南內容源

`catalog.a3.json` 是玩家指南唯一可編輯內容源。A3 是 catalog schema；內容版本以檔內 `version` 為準，不是獨立 addon 版本。

指南隨 canonical Grilling BP/RP 安裝，透過 `kg_a1:grilling` 註冊為既有 Cookery 指南的一個煙火章節。不新增實體書、平行 UI 或宿主全檔替換；六個根類、三語與生存取得規則見 [GUIDE-STANDARD](../../../docs/GUIDE-STANDARD.md)。

## 建置與檢查

```sh
python tools/build_grilling_guide.py
python tools/build_grilling_guide.py --check
python tools/check_grilling_guide.py
```

產生的 payload 在 `gameplay_core/behavior_pack/scripts/guide/`，語言與 icon 在 `gameplay_core/resource_pack/`；`main.js` 載入 `guide/main.js` 一次。`--check` 保留 catalog／來源、payload、三語、icon 與序列化的實際驗證。分類以 catalog 為準，不再生成第二份文件索引。

catalog 的 `source_refs` 對應實際來源檔或 [PARITY 的歷史來源索引](../../../docs/PARITY.md#指南內容的歷史來源索引)；歷史資料維持原候選，不認證今日原生或真人流程。靜態檢查不能代替觸控、排版、多語、返回路徑與多人隔離驗收。

## 歷史與發布

舊的獨立指南包、一次性遷移與版本打包指令不再是目前入口。[收斂前記錄](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/df0ff11de5fbff8f0c64324d8e2c3bf7d618084b/projects/grilling/guide/README.md)保留當時整合與 Cookery 版本限制；`builtin-integration.verified.json` 也只保留原本的證據身份。

目前安裝、精確相依與發布規則見 [RELEASING](../../../docs/RELEASING.md)。P2 的 provenance 引用整理不改指南內容或 canonical pack bytes，不升版、不部署。
