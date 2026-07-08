# 06_CHANGELOG：審美者更新記錄

## 2026-07-08

### 類型

文檔整理 / 產品定義 / 施工前準備

### 完成內容

- 建立 `00_AI_PRODUCT_CONTEXT.md`，作為交接給其他 AI 的產品理解文檔。
- 建立 `docs/README.md`，作為文檔索引。
- 重寫 `00_PRODUCT_BRIEF.md`，統一產品簡報。
- 重寫 `01_PRD.md`，明確 MVP、模組與第一版邊界。
- 新增 `02_DATA_MODEL.md`，定義資料表、欄位、關係與 RLS 原則。
- 新增 `03_ROUTES.md`，定義頁面與路由責任。
- 重寫 `03_API_SPEC.md`，補齊 Supabase/API 讀寫契約。
- 重寫 `04_TECH_GUIDE.md`，補齊技術規範、文案規範與施工順序。
- 重寫 `07_ROADMAP.md`，整理階段路線圖。
- 將前端展示文字切換為台灣繁中。

### 已確認產品決策

- 審美者採用 `video + post` 雙核心。
- `video` 負責影片沉澱，對應 `/v/[id]`。
- `post` 負責信息流傳播與審美表達，對應 `/p/[id]`。
- 第一版註冊 / 登入後即可發布。
- 第一版只支援 B 站影片。
- 推薦理由必填。
- 小館由管理員建立。
- 發布時可選小館，不選則發到大廳最新流。
- 發布成功後跳回 `/` 大廳最新流，讓使用者立即看到自己剛發布的內容。
- `reactions` 第一版只做 `like`。
- 底部 `探索` 進入 `/search`，用於搜尋 `video`。
- 頂部 `小館` 進入 `/m`。
- 私訊與通知拆分：`/messages` 與 `/notifications`。
- `/u/[username]` 第一版做極簡使用者頁。
- `username` 註冊時自動生成數字，後續允許修改。
- `modules.owner_id` 第一版保留但不做館主管理功能，可為空。

### 驗證

- 已跑 `npm run lint`。
- 結果：0 errors，2 warnings。
- warning 來源：現有 `pages/index.js` 使用 `<img>`，屬 Next.js 圖片最佳化提醒，非本次文案或文檔修改造成。

### 下一步

建議進入正式代碼施工：

1. 建立 `lib/supabase/client.js`。
2. 修正 `pages/login.js` 的 Supabase 硬編碼。
3. 生成 Supabase SQL。
4. 實作 `/submit` 發布策展。
5. 將首頁資料源從 `videos` 過渡到 `posts`。

### 追加施工：Supabase client 地基

- 新增 `lib/supabase/client.js`，統一初始化前端 Supabase client。
- 修正 `pages/login.js`，移除硬編碼 Supabase URL 與 anon key。
- 調整 `pages/api/videos.js`，暫時共用同一個 Supabase client，並標記此接口為過渡接口。
- 登入頁保留詳細註解，方便後續接 profile 自動建立流程。

### 追加施工：Supabase MVP SQL 初版

- 新增 `supabase/migrations/20260708_000001_create_mvp_schema.sql`。
- SQL 包含 `profiles / videos / posts / modules / post_modules / comments / reactions`。
- SQL 包含 `updated_at` trigger、數字 username 生成、auth user 建立 profile trigger。
- SQL 包含 like/comment count trigger 初版。
- SQL 包含 MVP RLS policy 初版。
- 尚未執行到遠端 Supabase，需人工確認後再套用。

### 追加修正：兼容既有 videos 舊資料

- 只讀查詢遠端 `videos` 表，確認目前有 20 條舊資料。
- 舊表字段包含 `id / bvid / title / cover / up_name / up_mid / duration / play_count / fav_time / added_by / status / curator_id`。
- 已將 SQL 改為保留既有 `videos` 表並補新欄位，不刪表、不重建。
- 已加入 legacy posts 回填，讓舊 `videos` 在未來首頁切到 `posts` 後仍可顯示。
- `posts.video_id` 改為引用既有數字型 `videos.id`。
- `comments` 改為使用 `post_id / video_id`，避免 `post` uuid 與 `video` 數字 id 混用。

### 遠端 Supabase 遷移驗收

- 使用 Supabase anon client 只讀驗收遠端資料表。
- `videos`：20 條，舊資料保留成功。
- `posts`：20 條，legacy posts 回填成功。
- `profiles / modules / post_modules / comments / reactions`：表存在，目前 0 條。
- `videos` 新欄位 `external_id / cover_url / author_name` 已從舊欄位回填成功。
- `posts -> videos` 關聯查詢成功，未來首頁 feed 可讀 `posts` 並連帶取得影片資料。

### 追加施工：頁面可點擊原型

- 新增 `pages/api/feed.js`，讓首頁改讀 `posts + videos` 的大廳最新流。
- 新增 `components/PageShell.js`，提供過渡期頁面殼與統一占位提示。
- 新增 `/following`、`/search`、`/submit`、`/messages`、`/notifications`、`/m`、`/m/[slug]`、`/p/[id]`、`/v/[id]`、`/u/[username]`。
- 首頁頂部 `追蹤 / 小館 / 搜尋 / 頭像` 已接到對應頁面。
- 首頁卡片可進入 `/p/[id]`，影片標題可進入 `/v/[id]`，封面仍保留沉浸播放。
- 底部 `大廳 / 探索 / 發佈 / 訊息 / 我的` 已接到對應頁面。
- 右側懸浮入口改為通知入口 `/notifications`，避免和底部發佈按鈕重複。
