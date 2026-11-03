# Held status 只讀 observer

這是隔離 QA 工具。它只接受兩個完整 BP bytes 與 manifest identity 都核對過的 profile，安裝、收據和還原共用同一流程：

| Profile | 用途 | 伺服器讀回內容 |
| --- | --- | --- |
| `g194-native32` | A 正式舊功能組，G194 | 逐欄讀 `entities/player.json` 宣告的 32 個 `player.getProperty` 值；frame/cache 明確為 `null`。 |
| `g206-cache24` | B/C 正式組，G206 | 在 transport lexical scope 讀雙手 cache，各 12 words 和實際 frame。 |
| `g208-cache24` | 續審後完整組，G208 | 相同的唯讀 cache／frame 路徑；以 G208 完整 BP 與 manifest 指紋獨立識別。 |

G194 的 BP 完整指紋 `f2b79963…5e47e0a` / 787 檔與 repo `release-history.json` 的 2.8.194 BP 記錄相同；manifest SHA256 `db5cf2c6…f0bc82c`。G206 使用固定 2.8.206 完整指紋、manifest SHA 和 append-only release-history 核對；不會因主線後續包版本改變而改選另一個 runtime。未知 bytes/profile 會被拒絕，不按版本猜測。

兩種 profile 都在 G BP API 脈絡直接讀原主/副手 ItemStack 的 type、amount、name、lore 和該 G context 可讀的全部 dynamic property。這是目前 G pack API 可讀的直接物品屬性；不表示能跨 UUID 讀取其他 pack 的私有資料。輸出不宣稱 renderer ACK。

## 安裝

1. 把對應正式 BP 複製到隔離測試服 UUID pack 目錄。A、B、C 的目錄格式為 `behavior_packs/<BP UUID>`。確認隔離 BDS 已停止；工具不檢查 BDS 狀態，主代理會用既有 `assert_quiet` 獨立核對。
2. 執行同一命令，工具按完整 hash、manifest 與 schema 自動選 profile：

   ```sh
   python3 tools/qa/held_status_observer.py install \
     --pack /isolated/server/behavior_packs/c68005c5-23ff-54e8-a3ff-da6349ad43c2 \
     --live-root /caller-supplied/host/live/root \
     --live-root /caller-supplied/container/live/alias \
     --bds-stopped
   ```

   `--bds-stopped` 只記錄呼叫者聲明，不證明服務已停止。呼叫者須用既有 `assert_quiet` 核實，並提供所有 LIVE root 路徑；可重複 `--live-root` 列出主機與容器 alias。私有 S1 wrapper 負責傳入實際路徑。工具會拒絕這些 roots 之下的目標及 canonical G206 source，不碰 `entities/player.json`。

3. 保留收據路徑。G206 只注入 transport；G194 在 `scripts/main.js` 接入唯讀事件。工具備份並 hash 核對每個修改檔，不啟停服務。

## 查詢

在隔離服 server console 對一位真人執行：

```text
scriptevent kg_held_qa:status <玩家名稱>
```

console 只記錄指定玩家，不廣播。G194 回報 32 個 native properties，並以 `frame:null`、`transport.words:null` 明示沒有 snapshot cache；這些值不是 24 個 cache words。G206 回報 cache words 與 frame。server readback 不能證明畫面、renderer ACK、完整物品 envelope 呈現或真人驗收。不要使用舊 C1 probe 的 seed/pose/replay。

## 還原

由呼叫者先以既有方式核實隔離 BDS 已停止，再以相同 pack 目錄和所有 LIVE roots 執行：

```sh
python3 tools/qa/held_status_observer.py restore \
  --pack /isolated/server/behavior_packs/c68005c5-23ff-54e8-a3ff-da6349ad43c2 \
  --live-root /caller-supplied/host/live/root \
  --live-root /caller-supplied/container/live/alias \
  --bds-stopped
```

工具只在所有注入檔仍與收據 hash 完全相同時還原。回報會分開列出注入檔還原結果、G206 transport 還原狀態與完整 BP baseline fingerprint。若其他檔案已改，會保留那些修改並回報 `full_baseline_restored:false`；不覆蓋其他檔案。

完整 C 驗證仍需真人 32 列觀察、TACZ 效能、28 格有效 player、保存及重開檢查。QA 工具結果不等於真人畫面驗收。


本機若要跑 G194 A 原包整合測試，先設定 `SENLUO_QA_CONTROL_ARCHIVE` 指向控制包 ZIP；未設定時只略過這項本機整合測試。
