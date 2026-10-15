# 進度獎勵的所有權與 XP 重試

2026-10-13；G132，維持原作 Grilling 1.1.1 / `9a1acdab27698457bec16c9362678e574895a28c`。
修補前讀取 BSM Java 查核 `2026-10-12T22:23:03.909303+00:00`；Forge 1.20.1 / CF8726006、NeoForge 1.21.1 / CF8726014 均 metadata current、parity pending。

原作 [ModAdvancements.java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModAdvancements.java) 的 `pepperPicked` 呼叫 `award`，最後進入 `PlayerAdvancements.award`。
原作 [mountain_fragrance.json](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/advancement/mountain_fragrance.json) 的獎勵是 25 XP。
已讀取的兩個 Git blob 分別是 `2791f158caf5885946d377da0b2a3686dcc89146`、`bf1cdf32fbba604779f7204ba6d63661c1696ac7`。
官方 Minecraft 1.21.1 client JAR（SHA1 `30c73b1c5da787909b2f73340419fdf13b9def88`）及官方 mappings 的 `PlayerAdvancements` / `akz` bytecode 中，`award` 先要求 `AdvancementProgress.grantProgress` 成功，再在新完成邊界呼叫 `AdvancementRewards.grant`。這是原作狀態／獎勵順序的證據，不證明磁碟 flush 原子性。

舊 Bedrock adapter 先 `addExperience` 再寫完成；完成寫入失敗會讓下一個相同事件再次發 XP。此外 `addExperience` 若已生效後 throw，舊 command fallback 可能再發一次。動態屬性讀取失敗也被視為未完成。這些是實際 source 的故障邊界，未宣稱 LIVE 已重現該故障。

G132 沿用原有每項進度的 dynamic property，先寫 `{version:1,state:"pending",xp}` 並 exact readback，才呼叫一次 native `addExperience`。即使 setter throw，只有讀回一致才接受寫入。XP throw 不用 command fallback。成功後僅在 claim 仍相同時寫既有 boolean `true`，再次讀回後才通知。既有 `true` 不改，`false`／缺值可領取；未知值、不可讀及 pending 不自動清除／重發。正常 XP 數量、觸發事件及公告 keys 不變。

共用 `awardOneShotAdvancement` 同時服務山野芬芳、穿串／油／調料／熱食／陳列的六項 event 進度，及七項 challenge 進度；沒有分別更改配方或獎勵。正常 25 XP 路徑及 helper 的 0 XP 路徑保留，0 XP 不呼叫 XP API。

八項 API 故障 regression 執行實際 production adapter：正常與 legacy／零 XP、不可讀／未知值、claim 拒寫與生效後 throw、未知 readback、XP 生效前後 throw、完成寫入失敗、claim 被替換、重入及重新載入。測試由 `verify_a28132.py` 接入既有 canonical CI，不是 Minecraft 模擬玩家、原生保存或真人接受。

限制：dynamic property 和 XP 是不同 API，沒有跨 API 原子交易。此修補保證已確認 claim 後至多一次 XP 嘗試，並保留不明結果；**不保證 exactly-once 獎勵送達**。XP 未生效的 throw 或 claim 後中斷可能留下 pending 而未得到 XP；沒有安全證據時不自動重發。原生持久化／重啟故障與人工修復流程仍未驗收。`client=false`、`production_ready=false`。
