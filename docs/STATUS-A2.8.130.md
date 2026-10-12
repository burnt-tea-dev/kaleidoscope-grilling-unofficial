# G130：共享 Actionbar 圖形隔離

身份：**2.8.130／指南 0.3.60**；候選 tag `A2.8.130-beta.1`。

G129 的進食图形仍每幀寫共享 Actionbar，其他 addon 的訊息會覆蓋進度資料。G130 改用已安裝 UI Queue 的獨立 `kg_eating_hud` key；只觀測已存在的單一 embedded router，獨立安裝時使用零時長格式碼 title。普通 Actionbar、字幕、第三方 router 選舉與食物結算保持原用途。

JSON UI 保留獨立 catalog，每幀從 title binding 取得一次快照。後續普通／其他包的 title 不改寫該圖形；owned END 和最新 owned 幀的比對，阻止取消／完成／立即重開後舊幀復活。取消、完成、失去目前食物、關閉選项與重生只終結自己的 key，不清全域 Actionbar 或 title。期限改為有限 **6 tick／300 ms** 遺失封包回退：本輪五個共同參與 key 的排程範圍另由私有 family router 修補驗證，不能承諾任意數量或任意直接 title 寫入者都適用。

原 **102×5 Atlas、16×16 icon、25 tick 判定、90／100 tick 時間、1 ms fade**、五幀 icon 循環及 G126／G127 player clips 保持；G128 的 Uses、Numb schema 與已完成交易修補保留。UI 的終結掛鉤不扣物品、不退款、不重做結算。來源 guard 只反轉本輪八項明確 presentation 差異來核對既有不可變 G126 dispatcher witness，回傳的 authoring 文本仍保留 G130 掛鉤。

T/G 使用同一份最小 HUD bridge；AMW 與 Java Saturation 的預留出口缺少對方時解析為 typed empty。第三方包的 globals、producer、renderer 與 queue 修補屬另一份 canonical 私有整合，不包含於煙火公開下載，也不能只安裝煙火便冒充那些修補已生效。

已通過的本機針對性 source／Atlas／传输檢查保持來源範圍；完整必要 CI、家族准入、本次停服存檔副本首次載入／重啟及 LIVE 讀回由候選流程另記錄。尚未取得本版真人畫面验收：`client=false`、`production_ready=false`。不把腳本 handle、BDS loading 或舊版本短片當本版客戶端結果。

最小真人回歸：普通 Actionbar 更新時完整吃完；25 tick 前取消；取消後立即重開；90／100 tick 食物；同時顯示酒館／AMW／飽和度；一次普通標題與字幕；Classic 與 Pocket／touch。既有原生事件與完整 Java 聲畫差距依目前對照表繼續保留。
