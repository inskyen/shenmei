# 本機維護工具

## B站评论区审美者探针

此工具会登录 B站，扫描某个视频评论区里的用户主页，并标记：

1. 用户收藏夹是否公开。
2. 默认收藏夹可见视频数量。
3. 默认收藏夹视频数大于 100 的 `HIGH_VALUE` 用户。

### Termux 终端界面

手机 Termux 上推荐使用菜单入口：

```bash
python3 scripts/bili_aesthete_tui.py
```

它会自动启用 Rich 仪表盘界面；如需纯文本兜底：

```bash
python3 scripts/bili_aesthete_tui.py --plain
```

TUI 会维护一个长期候选池：

```text
.local/bilibili_user_scan/candidate_board.json
```

扫描结果会合并进候选池。你可以在菜单 4 里隐藏某个用户、恢复用户、修改展示权重、添加备注；后续新扫描会继续更新默认收藏夹数量等动态信息，但不会覆盖人工设置的权重、状态和备注。

候选池还包含 `library_status`：

```text
pending   未入库
imported  已入库
```

菜单 4 里用 `i` 可以切换已入库/未入库。菜单 5 写入 Supabase 时会默认跳过 `imported` 项。

部署说明见：

```text
scripts/TERMUX.md
```

### 一键扫描并查看用户/fid

推荐先用 TUI 菜单 1。它会完成扫描，并展示高默认收藏夹用户和默认收藏夹 ID，不会写 Supabase：

```bash
python3 scripts/bili_aesthete_tui.py
```

如果确认后续要写入，再在菜单 5 单独执行。CLI 合并命令仍保留给自动化使用：

```bash
python3 scripts/scan_and_import_bilibili_defaults.py 'https://www.bilibili.com/video/BVxxxx' \
  --limit 1 \
  --commit \
  --yes
```

常用控制参数：

```bash
python3 scripts/scan_and_import_bilibili_defaults.py BVxxxx \
  --comment-pages 5 \
  --user-limit 100 \
  --limit 3 \
  --user-delay 2.0,4.0
```

### 第一次使用

在项目根目录执行：

```bash
python3 scripts/scan_bilibili_comment_users.py BVxxxx --login
```

脚本会在终端显示二维码。用 B站 App 扫码确认后，Cookie 会保存到：

```text
.local/bilibili_user_scan/cookies.json
```

`.local/` 已被 `.gitignore` 忽略，不会进入 Git。

### 常规扫描

```bash
python3 scripts/scan_bilibili_comment_users.py 'https://www.bilibili.com/video/BVxxxx'
```

常用参数：

```bash
python3 scripts/scan_bilibili_comment_users.py BVxxxx \
  --comment-pages 8 \
  --user-limit 150 \
  --comment-delay 1.0,2.0 \
  --user-delay 2.0,4.0
```

输出位置：

```text
.local/bilibili_user_scan/outputs/
```

会同时生成 CSV 和 JSON，CSV 可直接用表格工具打开。扫描只读取公开可见信息；如果 B站接口返回风控或频繁失败，应降低页数、减少用户数、增大 `--user-delay`。

扫描结果里会包含：

```text
default_favorite_id
default_favorite_title
default_favorite_url
import_command
```

其中 `import_command` 可以把该默认收藏夹继续交给下方的收藏夹采样器导入 Supabase，例如：

```bash
python3 scripts/import_bilibili_favorite.py 2456935435
```

### 批量导入扫描出来的默认收藏夹

扫描完成后，可以让批量入库器读取最新一份扫描结果。默认只处理 `HIGH_VALUE`，且只跑预览：

```bash
python3 scripts/import_scanned_default_favorites.py
```

限制本次只预览前 3 个：

```bash
python3 scripts/import_scanned_default_favorites.py --limit 3
```

确认要真正写入 Supabase 时，必须显式传入两个开关：

```bash
python3 scripts/import_scanned_default_favorites.py --limit 3 --commit --yes
```

跳过排序后的第一个收藏夹：

```bash
python3 scripts/import_scanned_default_favorites.py .local/bilibili_user_scan/outputs/BVxxxx_comment_users_20260719_230000.csv --skip 1
```

排除指定收藏夹 ID：

```bash
python3 scripts/import_scanned_default_favorites.py .local/bilibili_user_scan/outputs/BVxxxx_comment_users_20260719_230000.csv --exclude-fid 1465102531
```

也可以指定某一份扫描结果：

```bash
python3 scripts/import_scanned_default_favorites.py .local/bilibili_user_scan/outputs/BVxxxx_comment_users_20260719_230000.csv
```

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

只看預覽、不進入寫入確認：

```bash
python3 scripts/import_bilibili_favorite.py 2456935435 --preview
```

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
