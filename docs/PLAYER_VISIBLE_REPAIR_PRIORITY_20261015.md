# 玩家可見差距：修復優先序與本批交付

## 範圍與目前狀態

依使用者 2026-10-15 指示，優先處理玩家容易發現的圖標、各人稱持握／進食、碰撞／選取框、物品與放置模型。除複製／丟失物品等阻斷問題外，不讓新的內部整理取代這些可見缺陷。

本批只改兩個方塊的 collision_box / selection_box，共六個數值。沒有修改配方、腳本、物品 ID、材質、模型、動畫、HUD 或既有存檔；不覆蓋 PR #215 的進食修補。基於 #215 的來源提交 712c8481811db85117b890858eb8ff920ae914c5；兩個目標檔案與先前核對的 68baf3ef33afeb0e291c329b5eb5687b2388c453 完全同 blob。

此分支是 **source-only 整合草稿，不是 G143 發行版**。G143 已凍結，不改寫其歷史雜湊、不重包同版號、不部署 live。合併到發行分支前，必須配置未使用的新版本、更新成對 manifests／baseline／append-only history、完成完整 CI 與打包檢查。原有 gate 保持啟用；本批的局部綠燈不能替代那些 gate。

## 本批已實作

### 烤架：移除模型上方多出的判定

Java GrillBlock 的 FLAT_Z = (0,0,2)-(16,4,14)，FLAT_X = (2,0,0)-(14,4,16)。LEGS_Z / LEGS_X 加入的四個小方框均被 FLAT 包含，不需要用更高包圍盒近似。

基岩原本碰撞高度 6、選取高度 8；兩者現在都為 4，北向 origin [-8,0,-6]、size [16,4,12]。沿用原有四方向 transformation。保留點燃／熄滅與支腳狀態、貼圖、發光及刷油／放串流程。

### 高級廚具架：判定貼牆，不佔據前方空氣

Java AdvancedRackBlock 北向框為 (1,5,11)-(15,14,16)。原本基岩使用置中的 14 深框；兩種判定都改成北向 origin [-7,5,3]、size [14,9,5]，四方向沿用既有 transformation。保留所有 spice_level、seasoning_occupancy / high、bone_visibility 及顯示模型。

來源測試同時檢查前方原本的隱形阻擋已清除，以及靠牆最後一段仍可命中，避免只縮小卻縮錯位置。

## 後續可見問題優先序（不是完成清單）

1. **P0：烤串持握與進食明顯失真。** 以 #215 的 owner-context／副手時鐘成果為基礎，不另外重做同一套。追蹤近鏡頭過大、結束時平面殘影／切換、第一／第三人稱與主副手一致性、連續食用及中斷／切槽後恢復。來源或模擬預覽不等於原生畫面通過。
2. **P1：原生背包／快捷欄圖標。** 自訂烤串目前仍是 Java 模板的固定顏色 fallback，尚未按每串食材／熟度／隨機外觀顯示；沿用 #166，不因能生成 PNG 或 HUD 預覽便關閉。原生 GUI 圖標與 held-UV 材質必須分開，不可把平面圖直接覆蓋模型 UV。
3. **P1：碰撞、選取及放置對齊。** 本批完成上述兩個來源修補。其餘方塊必須同時核對 Java getShape、getCollisionShape 及註冊 Properties；不能只量可見模型就推導碰撞。餐盤的 Java 選取高度確實為 7，不能縮成盤子模型高度 2；其碰撞繼承需另行核實。
4. **P1：物品／世界模型。** 花椒樹葉缺失、穿串前後材料及 UV、固定／自訂烤串與瓶子、餐盤、廚具架的 held / placed / ground 狀態，保留既有玩家失敗紀錄。只在確認資源和渲染路徑的根因後修改，不以全域縮放遮掩骨架／人稱上下文錯誤。

## 驗證證據與限制

`development/gameplay_core/test_visible_block_shapes.py` 直接讀候選 JSON；以釘選 Java 數值為獨立 oracle，解析本批實際用到的 permutation 等式，拒絕未知語法或未審閱的 scale / translation。

同一套 6 個測試：修補前退出碼 1（兩個方塊的差距被抓到；12 個失敗 assertion / subtest，不是 12 個獨立 bug）；修補後退出碼 0，6/6 通過。覆蓋烤架 16 種狀態、廚具架 640 種狀態、各自的碰撞和選取框、空間射線與餐盤選取的反例保護。這些是數學／來源檢查，不是 Minecraft 原生物理、Blockbench 畫面或玩家輸入測試。

另對 G142 的成功 CI 匯出包做圖標資源檢查：249 個 item、248 個顯式 icon，未發現缺檔或全透明圖。唯一無顯式 icon 的 pepper_leaves 使用 block-placer 路徑，不能直接列為圖標缺失。這是路徑／透明度檢查，不是所有圖標皆符合 Java 的結論，也不是對 G143 全部內容的重跑。

本輪未建立可用的 Blockbench MCP／原生 Minecraft 會話，也未啟動多代理；不宣稱原生視覺驗收完成。保留既有失敗證據，不要求使用者重複提交同一批客戶端 probes。

## 釘選來源

原始倉庫：breezeth-CN/KaleidoscopeGrilling，commit 9a1acdab27698457bec16c9362678e574895a28c。

- forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/grill/GrillBlock.java
- neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/grill/GrillBlock.java
- forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/rack/AdvancedRackBlock.java
- neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/rack/AdvancedRackBlock.java
- forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModBlocks.java
- forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/SkewerPlateBlock.java

現有圖標實作：本倉庫 tools/build_skewer_inventory_icons.py（明確列為 static fallback）。
