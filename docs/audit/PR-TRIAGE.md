# 煙火 PR 現行承接與歷史處置

## 2026-10-17：以G150覆核開放草稿

核對main [2422c2ab](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/2422c2ab217aadc0d4ca56b6fd560ad9ed233a1f)。四個draft仍保持原GitHub狀態，來源吸收不寫成PR已合併。家族版本、交付與接續順序見[主索引](https://github.com/casama233/kaleidoscope-tavern-unofficial/blob/main/family/BASELINE-STATUS.md)。

| PR | 當前來源核對 | 處置 |
| --- | --- | --- |
| [#214](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/214) | plate_transaction_core回滾仍缺完整signature ownership／未知結果停止更早退款；pepper採果仍缺清果／出料確認 | 仍有獨立差異；保留review，從G150接續，舊身份不可直接合併或發布 |
| [#217](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/217) | grill與advanced_rack兩個runtime JSON與G150同blob；G150／#229承接 | 主體已吸收；核對剩餘工具／文檔再收束 |
| [#220](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/220) | THREE core、20-ID資料、player clip與20套helper幾何／貼圖已納入後續composition，owner／offhand另有後續修補 | 主體已吸收；只檢查殘餘獨有差異，不整支舊G143覆寫 |
| [#222](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/222) | 18個runtime檔中16個與main相同，另2個為舊manifest；sprite與碰撞均已承接 | 主體已吸收；核對工具／文檔殘餘後收束，不作另一個G144候選 |

來源：[all-skewer followup](../evidence/all-skewer-followup-20261015.md)、[G150 collision](../evidence/collision-shapes-20261016.md)、[目前plate transaction](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/2422c2ab217aadc0d4ca56b6fd560ad9ed233a1f/projects/grilling/gameplay_core/behavior_pack/scripts/plate_transaction_core.js)、[目前pepper runtime](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/2422c2ab217aadc0d4ca56b6fd560ad9ed233a1f/projects/grilling/gameplay_core/behavior_pack/scripts/a2748_pepper_tree_runtime.js)。本次未運行新native或client測試，原PR的故障注入證據保持原head。

## 歷史處置原文

以下2026-10-09與更早的「目前／未合併／已部署」保留其原時點，不能代替上方G150覆核。

# 煙火舊 PR 處置與保留工作

更新：2026-10-09（香港）；追加 G118/G119 來源承接進度。18 個舊 head 的重新比對基準仍為 **2.8.116／`b4bd3229f254adf58be1ee413f89daa1ab9c4df0`**。
18個舊草稿的原head列在下表；`ahead`、版號落後與PR是否開啟都不是功能已被承接的判據。
本頁更新處置依據，**沒有在本地文件中宣告任何PR已關閉或合併**；GitHub操作與當時head應另行讀回。

[原Phase 0快照](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/b4bd3229f254adf58be1ee413f89daa1ab9c4df0/docs/audit/PR-TRIAGE.md)保留G114當時的判斷。
G116已承接#148的餐盤營養界限與#150的防誤食，不能再把這兩項列為未修。
G117瓶保存與手持營養、G118放置盤／串譜顯示及G119手持盤各有獨立來源實作，詳見[現況表](../PARITY-MATRIX.md)。以下舊head與原生診斷身份保持；不以新增實作代表原生／真人已接受。

## 18個草稿的逐項處置

「已吸收」只指本列列明的有效差異，不表示整份舊head已合併或真人畫面已驗收。
所有原head均以完整commit連結固定；關閉舊草稿時保留這些來源及原分支，不刪除尚有用的原型。

| PR／固定head | 處置 | 現行來源與仍須保留的內容 | 承接位置 |
| --- | --- | --- | --- |
| [#119](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/119)／[4ee97f04e81d](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/4ee97f04e81dcdc2d00653e2bb907f6c1b1f0d6a) | 已吸收，可關閉舊草稿 | 花椒自然生成兩個核心module與原head相同；現行載入seed、Java/native eating模組並使用`nativeEatingCompleted`。保留原生花椒及有限進食觀察；不聲稱126個舊檔案全部承接。 | 現行runtime；進食未驗證範圍見EATING-ACCEPTANCE。 |
| [#142](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/142)／[bf66b15416d7](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/bf66b15416d78910d43cf5799e30e4d055caf404) | 已吸收，可關閉舊草稿 | `build_direct_rack_geometry.py`與五份`advanced_rack_0..4.geo.json`和現行相同；G81已用新identity承接反射X投影。保留原G79原生證據，不重用舊G80收據。 | 現行掛架模型與G81歷史。 |
| [#145](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/145)／[908233e17a95](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/908233e17a9549362f1901d460c2b595734b0181) | 文檔證據歸檔 | 只有G81 bounded eating／relog／offhand文檔；沒有runtime差異。原候選主手結算／正常relog有限成功，普通副手air-use未啟動；不能拿來認證今日版本。 | 下方固定文檔連結；EATING-ACCEPTANCE仍開放。 |
| [#146](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/146)／[69bfc1b97531](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/69bfc1b97531679e10ed7d225992a1c5985e0a14) | 保留功能來源，重提current-main修補 | 獨立`plate_visual_core.js`、完整餐盤串mesh與成功放置後dirty通知未入基準；現行`station_contents_visual_runtime.js`仍走generic路由。舊G83與canonical G83不是同identity。 | PLATE-PLACED-DISPLAY。 |
| [#147](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/147)／[7eef713cbc2c](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/7eef713cbc2cf1089c7bac6f99c29674e10525b4) | 保留顯示差異與原診斷 | `body_rotation_always_follows_head`及reward substage診斷屬舊餐盤線；body alignment仍須評估，營養故障已由G116另修。QA模組不作生產玩法引入。 | body alignment併入PLATE-PLACED-DISPLAY；reward trace歸檔。 |
| [#148](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/148)／[07208cd8b8a0](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/07208cd8b8a047ed3e5be9a38596054b1818dcdc) | 營養已吸收，保留其顯示差異 | G116的`addSecretNutrition`已在hunger後重取saturation／effectiveMax並保留失敗回滾；原越界trace保留。`initialRotation`屬未承接的placed顯示線。 | PLATE-SATURATION已修來源；initialRotation併入PLATE-PLACED-DISPLAY。 |
| [#149](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/149)／[6e714853d029](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/6e714853d029f93f0186efa2e96e192e87735a74) | 舊整合線由分項工作取代 | 主要是#146–148與當時Java palette的union，沒有獨立新玩法delta。營養已吸收，placed顯示未入基準；現行另有後續素材／料理適配。 | 從PLATE-PLACED-DISPLAY承接有效差異，保留現行palette。 |
| [#150](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/150)／[39e6dd145a84](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/39e6dd145a84abdf921382aef9c90833061aa955) | 防誤食已吸收，保留helper顯示差異 | G116已用`skewerUseTargetsPlate`仲裁block／item-use，另保留較近entity、前景outline與合法air-use。count-transition helper清理／yaw仍屬未入基準的專用renderer。 | PLATE-USE-ARBITRATION已修來源；cleanup／yaw併入PLATE-PLACED-DISPLAY。 |
| [#152](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/152)／[fdc9892edcb7](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/fdc9892edcb714c22e1b014943b4ce86c4a2570d) | 保留功能來源，重提current-main修補 | ordinary model115完整mesh、source nativeYaw四朝向仍未入基準。原G89只觀察普通串／五牛肉四朝向，不代表all variants。 | PLATE-PLACED-DISPLAY。 |
| [#153](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/153)／[6fbc56f9b49d](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/6fbc56f9b49d033f5df106123311096ee39f8702) | 保留未完成的新功能來源 | 原五行／八word原型未整包導入；G119已從G118建立新的core、builder、geometry與controller，採每份兩word＋獨立count。舊secret-alt／native解碼診斷保留，仍需新候選原生驗收。 | PLATE-HELD-CONTENTS及DECODE；[G119來源承接](../STATUS-A2.8.119.md)，C/D待驗。 |
| [#155](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/155)／[b29737b25054](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/b29737b250544fea2e3ab712bad30c2c04498809) | Cloud已吸收，保留held診斷 | Cloud語法由canonical G101 scalar contract承接／改進；plate raw-word及first-person診斷仍屬未入基準的#153子系統。保留G90 secret-alt空／四牛肉可見的對照。 | PLATE-HELD-CONTENTS；不以Cloud已修代表整份PR已完成。 |
| [#156](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/156)／[9d7185abc8ec](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/9d7185abc8ec98a53aa315cc18b13ea51c074786) | 診斷證據歸檔 | G92 default-off client canary、四posts、state53 control與legend；無已驗收生產玩法。 | 下方G92文檔；PLATE-HELD-DECODE。 |
| [#158](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/158)／[44c5fd8a786a](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/44c5fd8a786addf6cf1881ba5f7d665f0f492b0c) | 診斷證據歸檔 | G93 raw word4=1、marker133及owner-bank輸入；G92服務端flag正確但client controls缺失。reciprocal-boundary只是當时假設。 | 下方G93文檔；PLATE-HELD-DECODE。 |
| [#161](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/161)／[4014645d132e](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/4014645d132ec676791b2aa39752db37d84abb2e) | 診斷證據歸檔 | 舊G94二進位QA板的identity是`4014645d…`，不是canonical G94；8×8幾何控制板未入基準。原raw/native結果仍不可解讀。 | 下方獨立G94文檔；PLATE-HELD-DECODE。 |
| [#163](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/163)／[ca6a2d077706](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/ca6a2d0777066b4bcdce278d1d0f501a39fbc2c5) | 診斷證據歸檔 | G95只改善QA板opaque UV、backing與label；packing／storage／arithmetic沒有新修補。後續stored1／4讀0／3故障需保留。 | 下方G95文檔；PLATE-HELD-DECODE。 |
| [#164](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/164)／[90b8a624474e](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/90b8a624474e4f2fd526df2b633408a7ad5f3f1f) | 保留未驗證的held修補候選 | count-only `+0.5`只適用未入基準的held decoder；native stored1／4讀0／3已記錄，但G96候選未有原生驗收，palette低位仍未確定。 | G119另建有界word與獨立count，未套用舊+0.5；舊原生診斷續留。 |
| [#172](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/172)／[39a7c9adf459](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/39a7c9adf45968b48d1213287a37766a57cf6829) | 已吸收，可關閉舊草稿 | 兩個bottle pose animation、held-pose generator／review工具與現行相同；消費時`seasoningLore`已有ingredient count。原G109identity不能回填。 | 現行瓶路徑；SEASONING-FLOW仍需真人復驗。 |
| [#174](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/174)／[57d9068a5a08](https://github.com/casama233/kaleidoscope-grilling-unofficial/commit/57d9068a5a08262661ec050b22cc694114ad3f59) | 已吸收，可關閉舊草稿 | 加料／取回derived lore與missing-base chat已由G113承接，G114另修singleton RawMessage正規化、保留metadata。舊簽名不得覆蓋現在更完整的RawMessage支援。 | 現行`refreshBottleIngredientLore`／`warnMissingSeasoningBase`及G114回歸。 |

## 尚未完成工作的固定入口

G117起點的可執行承接issue已建立：[放置餐盤 #181](https://github.com/casama233/kaleidoscope-grilling-unofficial/issues/181)與[手持餐盤內容／解碼 #182](https://github.com/casama233/kaleidoscope-grilling-unofficial/issues/182)。兩條線保留完整舊head、限定移植範圍與source／native／client驗收要求；G118已補placed來源、G119補held來源，兩者皆保留獨立原生／client邊界。建立追蹤或有新實作都不表示已驗收。

| 工作 | 保留來源 | 從現行來源接續的要求 |
| --- | --- | --- |
| [PLATE-PLACED-DISPLAY](../BUGS.md#plate-placed-display已放置餐盤缺完整內容投影) | #146／147／148顯示部分／149／150顯示部分／152 | 完整mesh、ordinary串、source FIXED布局、四朝向、initial/body rotation、成功交易後dirty與helper清理失敗守恆。保留現行palette、ownership及G116餐盤營養／防誤食，不引入舊QA主檔。 |
| [PLATE-HELD-CONTENTS／DECODE](../BUGS.md#plate-held-contentsdecodeg119-手持盤來源實作原生待驗) | 功能#153；#155 held診斷；#164 count候選 | G119已新增五份真實內容、每手owner、普通／秘製串與獨立份數投影；接續需同一候選的原生同步、secret-alt、兩手切換及真人呈現，不能僅靠生成器接受。 |
| [PLATE-HELD-DECODE](../BUGS.md#plate-held-contentsdecodeg119-手持盤來源實作原生待驗) | #156／158／161／163原生控制與#164候選 | 從可讀控制開始定位stored1／4→0／3及palette低位；區分JS／float32推算、native引擎與真人顯示。`+0.5`不得當作已驗收答案。 |
| [EATING-ACCEPTANCE](../BUGS.md#eating-acceptance逐口雙手停止與離線) | #145 bounded原候選文檔 | 保留主手結算／正常relog與未啟動副手的事實；以新候選補真正原生事件／客戶端入口，無模擬玩家。 |
| [SEASONING-FLOW](../BUGS.md#seasoning-flow自填瓶取回搖勻撒料) | #172／174已承接來源與G114修補 | 真人同瓶取回→80-tick搖勻→撒料、實際count、姿態及GUI仍有獨立驗收範圍。已吸收源碼不等於全部聲畫／client通過。 |

## 診斷與原生證據歸檔

下列連結固定到原候選完整SHA；保存原有版本、來源及限制，不修改成新候選成功證據。
不複製私有world、完整作者腳本、機器路徑或原始玩家日誌。

| 來源 | 固定文檔 | 保留的證據界線 |
| --- | --- | --- |
| #145／G81 | [NATIVE-EATING-G81-BOUNDED](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/908233e17a9549362f1901d460c2b595734b0181/docs/NATIVE-EATING-G81-BOUNDED-20261007.md) | 有限主手結算／relog、普通副手air-use未啟動；沒有native tick trace、完整D02、聲音或完整Java對照。 |
| #152／placed線 | [G83](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/fdc9892edcb714c22e1b014943b4ce86c4a2570d/docs/NATIVE-PLATE-G83-BOUNDED-20261007.md)、[G88](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/fdc9892edcb714c22e1b014943b4ce86c4a2570d/docs/NATIVE-PLATE-G88-BOUNDED-20261007.md)、[G89](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/fdc9892edcb714c22e1b014943b4ce86c4a2570d/docs/NATIVE-PLATE-G89-BOUNDED-20261007.md) | 原餐盤reward fault、count／四朝向有限觀察；不是今日client接受。 |
| #156／G92 | [STATUS-A2.8.92](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/9d7185abc8ec98a53aa315cc18b13ea51c074786/docs/STATUS-A2.8.92.md) | default-off canary／marker控制，未證實native接受。 |
| #158／G93 | [STATUS-A2.8.93](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/44c5fd8a786addf6cf1881ba5f7d665f0f492b0c/docs/STATUS-A2.8.93.md) | raw-bank讀取、控制缺失與未能辨讀；不是已修算術。 |
| #161／診斷G94 | [STATUS-A2.8.94](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/4014645d132ec676791b2aa39752db37d84abb2e/docs/STATUS-A2.8.94.md) | 保留與canonical G94不同的identity、binary QA控制；不共用收據。 |
| #163／G95 | [STATUS-A2.8.95](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/ca6a2d0777066b4bcdce278d1d0f501a39fbc2c5/docs/STATUS-A2.8.95.md) | QA可讀性改善與原count控制；仍不是production功能。 |
| #164／G96 | [STATUS-A2.8.96](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/90b8a624474e4f2fd526df2b633408a7ad5f3f1f/docs/STATUS-A2.8.96.md) | 已知count failure與未native驗收的`+0.5`候選，palette問題仍開放。 |

## 關閉順序與保留條件

1. 本索引到達canonical remote後，可先關閉已吸收的 **#119、#142、#172、#174**，記錄由哪一段現行來源承接。
2. **#145、#156、#158、#161、#163** 可按「證據已歸檔」關閉；上述immutable文檔連結與對應BUGS必須保留。#145也可只移植原文檔，無runtime升版或LIVE重啟需要。不能將歸檔稱為剩餘工作已修。
3. **#146、#147、#148、#149、#150、#152** 的唯一顯示差異保留在PLATE-PLACED-DISPLAY；**#153、#155、#164**保留在PLATE-HELD-CONTENTS／DECODE。建立current-main替代issue或PR並帶齊上表來源後，再以superseded關閉舊線；不合併整份舊union、不刪原分支。
4. 後續功能按現行canonical流程提交、檢查、分配新release identity及完整家族准入；不能只改版號或把文檔歸檔當作玩法還原。真人驗收前維持`client=false`、`production_ready=false`。

本文檔整理沒有新增runtime驗收。已有成功且輸入未變的證據不重跑；只為可重現且既有檢查不能攔住的具體故障新增最小回歸。
