# 本機維護工具

## B站收藏夾採樣器

此工具會讀取一個公開 B站收藏夾，並依序完成：

1. 依 BVID 去重並新增 `videos`。
2. 以指定審美者身份新增缺少的 `posts`。
3. 將 B站發布時間為 2021 年及以前的影片歸入「B站2021」頻道。
4. 保留失效影片、已有影片、已有採樣及頻道衝突的統計，不覆蓋既有內容。

### 第一次使用

在專案根目錄執行：

```bash
python3 scripts/import_bilibili_favorite.py
```

依提示輸入收藏夾 ID 或完整連結。第一次會要求選擇採樣發布者，確認後可將其審美號保存到本機 `.env.local`：

```text
SHENMEI_IMPORT_USERNAME=您的審美號
```

之後每次只需要輸入收藏夾 ID。工具會先展示預覽，只有輸入大寫 `YES` 才會寫入資料庫。

### 直接帶入收藏夾 ID

```bash
python3 scripts/import_bilibili_favorite.py 2456935435
```

也可以貼入完整收藏夾連結：

```bash
python3 scripts/import_bilibili_favorite.py 'https://space.bilibili.com/.../favlist?fid=2456935435&ftype=create'
```

### 必要本機配置

`.env.local` 必須存在以下配置：

```text
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
```

Secret Key 僅供本機工具使用，不可放入前端、提交到 Git 或貼到聊天中。

### 安全與重跑

- 重複執行同一收藏夾不會重複建立影片或同一發布者的採樣。
- 已經屬於其他頻道的採樣不會被強制移動，只會列為「頻道衝突」。
- B站失效、隱藏或私人影片會跳過。
- 每一頁讀取完成後都會保存本機續傳點；若 B站連線中斷，重新執行同一指令會從失敗頁繼續。
- 工具會對 SSL 斷線自動進行最多 8 次指數退避重試，降低大型收藏夾讀到一半失敗的機率。
- 成功寫入資料庫後會自動清除續傳點；取消預覽或寫入失敗時則保留。
- 如需放棄續傳資料並從第一頁重讀，可加上 `--fresh`：

```bash
python3 scripts/import_bilibili_favorite.py 2456935435 --fresh
```
