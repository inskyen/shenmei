# 07_ROADMAP：審美者路線圖

## 當前狀態

專案已有 Next.js 原型：

- 首頁信息流 UI 已存在。
- Supabase 已接入，當前讀取 `videos` 表。
- B 站 iframe 播放已存在。
- 登入 / 註冊頁已有初版。
- 前端顯示文字已切成台灣繁中。

目前正在從原型進入正式施工前整理階段。

## Phase 0：施工圖整理

目標：讓產品方向、資料模型、頁面路由清楚。

已完成：

- `00_AI_PRODUCT_CONTEXT.md`
- `00_PRODUCT_BRIEF.md`
- `01_PRD.md`
- `02_DATA_MODEL.md`
- `03_ROUTES.md`
- `docs/README.md`

待補：

- `03_API_SPEC.md`
- `04_TECH_GUIDE.md`
- `06_CHANGELOG.md`

完成標準：

- 任何 AI 或開發者讀文檔後，都知道審美者不是普通影片站。
- 能理解 `video + post` 雙核心。
- 能按文檔進入 SQL 與功能開發。

## Phase 1：地基整理

目標：修好正式開發前的基礎問題。

任務：

- 登入頁改用環境變數初始化 Supabase。
- 建立共用 Supabase client。
- 清理預設示例接口。
- README 改為審美者項目說明。
- 建立初版資料庫 SQL。
- 建立 `profiles / videos / posts / modules / post_modules / comments / reactions`。

完成標準：

- 登入配置不再硬編碼。
- 資料表可支撐 MVP。
- 首頁可以逐步從 `videos` 過渡到 `posts`。

## Phase 2：策展發布 MVP

目標：完成第一個真正產品閉環。

任務：

- 新增 `/submit`。
- 支持輸入 B 站連結 / BVID。
- 必填推薦理由。
- 可選小館。
- 寫入 `videos` 與 `posts`。
- 未選小館時進入大廳最新流。
- 發布成功後跳回 `/`，並看到剛發布內容。

完成標準：

- 使用者能發布一支影片並留下推薦理由。
- 首頁最新流展示剛發布的 post。
- 同一支 video 可以被多個 post 推薦。

## Phase 3：影片頁與推薦詳情

目標：落地 `video + post` 雙核心頁面。

任務：

- 新增 `/v/[id]` 影片主頁。
- 新增 `/p/[id]` 策展動態詳情。
- `/v/[id]` 展示播放、影片資料與所有推薦；第一版不開放影片公共留言。
- `/p/[id]` 展示某次推薦與針對該推薦的留言。

完成標準：

- 使用者能分清「看影片」和「看某人的推薦」。
- `post` 評論可支援 `target_type = post`；資料模型保留未來 `target_type = video` 的擴充空間。

## Phase 4：小館與搜尋

目標：建立主題空間與影片搜尋入口。

任務：

- 新增 `/m` 小館列表。
- 新增 `/m/[slug]` 小館頁。
- 小館由管理員建立。
- 新增 `/search` 占位，未來用於搜尋 video。

完成標準：

- 頂部 `小館` 能進入小館列表。
- 底部 `探索` 能進入搜尋頁。
- 小館和搜尋分工清楚。

## Phase 5：使用者頁與互動

目標：讓策展內容能回到人。

任務：

- 新增 `/u/[username]` 極簡使用者頁。
- 展示使用者資料與發布列表。
- 支持 like。
- 支持簡版留言。

完成標準：

- 每條 post 都能點進推薦者。
- 使用者能看到某個人的策展痕跡。

## Phase 6：私訊與通知

目標：從內容互動走向關係互動。

任務：

- `/messages` 私訊入口。
- `/notifications` 通知入口。
- 第二版再做文字私訊與未讀。
- 通知包含評論、回覆、喜歡、追蹤等。

完成標準：

- 私訊和通知路由拆分清楚。
- 後續可以安全擴展即時消息。

## 近期最推薦下一步

先補：

1. `03_API_SPEC.md`
2. `04_TECH_GUIDE.md`
3. `06_CHANGELOG.md`

然後進入：

```text
Supabase SQL → 登入地基 → 發布策展 MVP
```
