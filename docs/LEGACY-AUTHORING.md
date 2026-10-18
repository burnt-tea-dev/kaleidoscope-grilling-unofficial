# 歷史生成器的使用界線

現行 release 直接封裝 `baseline.json` 指向的 canonical BP/RP：

```sh
python3 development/gameplay_core/package_current.py --output-dir artifacts/review
```

`development/gameplay_core/build.py` 是 A2.0／Cookery 1.0.6 的歷史重建器，不是現行建置入口。沒有明確輸出參數時，它在讀來源、取上游或寫檔前拒絕執行。若需要研究舊產物，必須指定全新的絕對路徑，且不得位於任何 Git checkout／worktree 內：

```sh
python3 development/gameplay_core/build.py --legacy-output /tmp/grilling-a2-legacy-new
```

此命令會讀取鎖定的舊上游與本機歷史素材。輸出只供歷史研究，不能用作現行 release／家族候選／部署來源。既有目錄一律拒絕；重建器不再刪除輸出。上游或生成失敗可能留下不完整目錄，下一次應另選新路徑。

65 個退休 `augment_*.py` 已從當前樹移除；它們僅接受 A2.0–A2.7.59 的指定前版，不是現行 G155 的建置入口。歷史版本及其 report／manifest 身份檢查保留在 Git commit，歷史 YAML 保留原用途；研究舊版須讀取對應 commit 並隔離處理，不能把舊輸出複製回 canonical。

`augment_a21.py` 和 `build.py` 仍保留，因 `test_bottle_item_offhand_sources.py` 執行其瓶物品 AST 表達式，並檢查當前 67 種瓶物品的副手屬性。保留 AST 輸入不代表它們成為現行建置步驟。現行 `--check` 素材工具及產品行為測試保留。逐檔刪除前證據見 [清理收據](audit/LEGACY-CLEANUP-20261019.json)。

兩個舊語言自動寫入流程已移到 `docs/legacy_workflows/localization-a2728-a114.yml` 和 `localization-a2729-a115.yml`。它們保留歷史內容供閱讀，已不在 GitHub 可執行的 `.github/workflows` 中。現行 release 與 CI 不透過這兩個舊增補流程。

這些工具／文件修補不改 canonical runtime、版本、UUID 或 release history，無需升包或重啟 LIVE。來源、發版、候選、備份、遷移及部署的完整性關卡保持原流程。
