> **歷史快照（2026-10-17整理標記）。** 本頁及其舊版本／JSON配套保留原始證據，不再提供現行進度。當前來源與交付見[家族主索引](https://github.com/casama233/kaleidoscope-tavern-unofficial/blob/main/family/BASELINE-STATUS.md)；目前行為差距見[PARITY-MATRIX.md](PARITY-MATRIX.md)，PR承接見[audit/PR-TRIAGE.md](audit/PR-TRIAGE.md)。以下「當前／最新」只指原記錄日期。

> 2026-10-05：目前 canonical 為 2.8.61。最新功能面審查與 G01–G14 修復計畫見 [Java／Bedrock 審查](JAVA-PARITY-AUDIT-20261005.md)；本頁以下保留 2.8.51 歷史，不代表當前 live 或完整客戶端驗收。

# 歷史全面審查修復與驗收矩陣：追蹤至 2.8.51

2.8.51 完整保留 2.8.48 聲畫與 canonical 2.8.47 第三人稱進食，新增 [跨包接口 v1](BEDROCK-INTEGRATION-API.md)。其 BDS／Windows／遷移證據按當次完整收據另記；舊版非玩家證據不繼承為新的候選驗收。

本表對應 2026-10-02 全面審查的 F01–F16，以 2.8.45 核心修復為基準，加入 2.8.46 物品系列標籤及 2.8.47 第三人稱進食抬手。canonical 2.8.42 的角色效果快取與 2.8.43 第一人稱骨架校正均保留。實際版本與完整相依以各庫 baseline.json 及酒館 family/upstream.lock.json 為準；本頁不是某次 live 部署或真人驗收收據。Cookery 出料／砧板擴充仍須以已登記 API 的完整家族組裝，單獨作者原包不提供這些擴充。

| 發現 | canonical 修復／現況 | 未閉合條件 |
| --- | --- | --- |
| F01 HUD | 酒館 0.6.88／世界名酒 0.1.52 已修復 root panel 相容；本輪不改 HUD 原生根 | 全家族 Windows 進食条、效果圖示、血量／飢餓條 |
| F02 效果生命週期 | 2.8.41 奶／重生清除與 2.8.42 角色身份快取保留；2.8.45 同步解除原生龍血生命上限 | 真人奶解除、中毒例外、死亡、重生、斷線再登入 |
| F03 熱食可見資訊 | 2.8.41 背包熱槽排程與精確 lore 到期保留；食用權威期限在完成時重查 | 背包、箱取出與主副手期限；關閉容器內現有 UI 的文字刷新仍受引擎限制 |
| F04 炒／燉完成結算 | 2.8.45 六種料理完成時按權威期限計算熱度；deadline equality 按冷食 | 真人跨期限完成食用 |
| F05 秘製串組合  | 2.8.45 主副手各三食材 client_sync 索引與 213 個已核對圖像保留；2.8.51 提供持久跨包 catalog 別名註冊與查核。 | Windows 實際呈現；動態背包 GUI、原作 tint／實體食材模型及新作者圖像仍需資源包發行。 |
| F06 隨機吃法 | 2.8.45 每次共享 THREE／ALT 與正在使用的手；模型、咬點和扣料使用同一分支。2.8.47 在原生抬手進度為零時補第三人稱使用手的抬手姿勢，停止使用即結束。 | Windows 抬手／咬點／聲畫同步、中斷、副手與雙人旁觀；原作精確手臂曲線與脫離第二截模型仍未等價。 |
| F07 廚具架流程 | 2.8.41 一層槽位直接交換／歸還與管理入口保留 | Windows 快速操作；Java CapsLock 按住／鬆開選單沒有同等 Bedrock 按鍵 API |
| F08 內容投影與規模  | 既有 bounded helper 排程保留；2.8.51 公開逐堆 projection carrier、跨包 provider 註冊與實際物品查核，兩堆同 ID 可保留不同 data。 | 作者須在真正 producer callback 公開實際 aux；私人資料不可推斷。變體與多人負載仍需 Windows 真人。 |
| F09 龍血效果 | 2.8.45 原生 health groups max 20／26／30；初次補 6／10、升級補 4、刷新不再治療；移除有限傷害池代理；最小原生非玩家測試經真正停服重啟，max 26／HP 16／等級標記及同步 properties 保留，重啟後刷新／升級／解除通過。 | 真玩家心形、護甲／傷害順序、奶／死亡與其他包效果相容；其他引擎代理效果未全面 Java 等價 |
| F10 要塞自然替換  | 2.8.51 提供可信新生成宿主的 Nether fortress bounds／wart 座標接口，原 Java signed-long 哈希 25%、紅色與年齡映射、持久序號與失敗回復。 | 原版新區塊／要塞 callback 仍無穩定來源；自動自然 25% 替換未完成，不能把人工批次測試當自然生成。 |
| F11 期限精度 | 2.8.41 出料、寫入與合併保留精確 tick；2.8.45 完成判定採同一期限 | 真人邊界食用及產出／合併 |
| F12 多語與瓶 | 2.8.41 三語動態 lore／架文字與既有瓶變體保留 | Windows zh_TW／zh_CN／en_US、待搖瓶外觀 |
| F13 聲畫操作 | 原作 17 OGG 與既有生命週期保留；2.8.45 修正兩手／兩視角分支 dispatch；2.8.47 補入第三人稱進食使用手抬手。 2.8.48 補单粒特效、黃金／無敵／成功盾與工作站音效。 | 音量、聲源、停止、透明排序、雙人觀察均須 Windows 真人 |
| F14 配置與整合  | 2.8.51 提供 producer／projection／held catalog／fresh generation 及確認／重啟收據 API；熔爐熱食 false／30 秒設定與既有 public oil／secret-food 接口保留。 | 原生熔爐仍需真正 producer 宿主 callback；Create／女僕／KubeJS／JEI／Jade／Iceberg 等 Java 選用模組未變成同名 Bedrock 模組。 |
| F15 交付矩陣 | 本頁與 CURRENT-REPAIR-STATUS.json 統一對應原審查 F01–F16；歷史 F01–F12／R01–R14 不混用 | 正式部署與真人結果按具體完整收據另記，Git 合併不等同正式已更新 |
| F16 家族漂移與負載 | 保留 canonical 2.8.42 修復與既有家族來源；家族組裝器拒絕重複 BP minecraft:player，逐檔收據保留唯一來源 | 候選自身的 static／BDS／存檔演練／Windows client 四關；真人負載仍未完成 |

來源純邏輯測試、資產契約、原生 BDS 非玩家探針與 Windows 真人驗收分別記錄。非玩家原生 health 測試能證明引擎傷害／治療與最大生命屬性，不能證明玩家事件與畫面。新的候選不繼承舊收據延期部署權限，client=false 時 production_ready=false。

[2.8.48 聲畫回饋](STATUS-A2.8.48.md) · [2.8.45 核心修復](STATUS-A2.8.45.md) · [2.8.47 抬手修復](STATUS-A2.8.47.md) · [基線維護](BASELINE-MAINTENANCE.md)

[龍血原生非玩家停服／重啟摘要](evidence/dragon-health-persistence-2.8.45.json) 是最小獨立測試包證據，沒有真人、模擬玩家或家族准入宣稱；玩家重新登入與心形仍待 Windows 驗收。
