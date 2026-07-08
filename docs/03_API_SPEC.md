# 03_API_SPEC：審美者 API / Supabase 契約

## 1. 目標

這份文檔定義前端如何讀寫 Supabase 資料。

審美者第一版以 Supabase 為主要後端：

- 前端透過 Supabase client 讀寫資料。
- 必要時再補 Next.js API route 做服務端代理。
- RLS 權限由 Supabase SQL 階段落地。

## 2. 核心資料流

第一版核心閉環：

```text
登入
→ 發布 B 站影片
→ 寫入 videos / posts / post_modules
→ 回到大廳最新流
→ 讀取 posts + videos + profiles
```

## 3. 命名約定

正式欄位使用資料模型中的命名：

```text
external_id
cover_url
author_name
note
```

現有前端舊欄位：

```text
bvid
cover
up_name
```

過渡期可做欄位映射，但新功能應使用正式欄位。

## 4. Auth

### 4.1 註冊

操作：

```text
supabase.auth.signUp({ email, password })
```

成功後：

1. 建立 auth user。
2. 建立 `profiles`。
3. `username` 自動生成數字字串。
4. `display_name` 可先使用 `策展人` 或 email 前綴。

### 4.2 登入

操作：

```text
supabase.auth.signInWithPassword({ email, password })
```

成功後：

- 回到上一頁或 `/`。
- 取得目前 session。

### 4.3 登出

操作：

```text
supabase.auth.signOut()
```

## 5. 大廳最新流 `/`

### 5.1 需求

讀取全站最新公開策展動態。

### 5.2 查詢目標

主資料是 `posts`，不是 `videos`。

需要連帶：

```text
profiles
videos
modules
like_count
comment_count
```

### 5.3 建議查詢

概念：

```text
posts
  select id, note, created_at, like_count, comment_count, visibility, status
  join profiles
  join videos
  join post_modules -> modules
  where status = published
  where visibility = public
  order created_at desc
```

### 5.4 回傳資料形狀

```json
{
  "posts": [
    {
      "id": "post_uuid",
      "note": "推薦理由",
      "created_at": "2026-07-08T00:00:00Z",
      "like_count": 0,
      "comment_count": 0,
      "profile": {
        "id": "user_uuid",
        "username": "12345678",
        "display_name": "策展人",
        "avatar_url": null
      },
      "video": {
        "id": 6,
        "source_platform": "bilibili",
        "external_id": "BVxxxx",
        "title": "影片標題",
        "cover_url": "https://...",
        "author_name": "UP 主"
      },
      "modules": [
        {
          "id": "module_uuid",
          "slug": "blue-hour",
          "name": "藍色時刻"
        }
      ]
    }
  ]
}
```

## 6. 發布策展 `/submit`

### 6.1 需求

登入使用者發布一條策展動態。

### 6.2 表單輸入

必填：

- B 站連結或 BVID。
- 推薦理由 `note`。

選填：

- 小館 IDs。

### 6.3 前端校驗

- 必須登入。
- BVID 必須能解析。
- `note` 至少 10 個字。
- 小館可不選。

### 6.4 寫入流程

```text
1. 解析 BVID
2. 查 videos 是否存在 source_platform = bilibili + external_id = BVID
3. 若不存在，建立 videos
4. 建立 posts
5. 若選擇小館，建立 post_modules
6. 若未選小館，不建立 post_modules
7. 發布成功後跳回 `/`
8. 大廳最新流展示剛發布的 post
```

### 6.5 videos upsert

條件：

```text
source_platform = bilibili
external_id = BVID
```

若需要手動填入影片資料，至少要有：

```text
title
source_url
external_id
```

建議後續補 B 站資料解析。

### 6.6 posts insert

需要寫入：

```json
{
  "user_id": "current_user_id",
  "video_id": 6,
  "note": "推薦理由",
  "visibility": "public",
  "status": "published"
}
```

## 7. 影片主頁 `/v/[id]`

### 7.1 需求

以 `video` 為中心沉澱內容。

### 7.2 查詢資料

```text
video
posts for this video
profiles for those posts
comments where target_type = video
modules related through posts
```

### 7.3 頁面資料形狀

```json
{
  "video": {
    "id": 6,
    "external_id": "BVxxxx",
    "title": "影片標題",
    "cover_url": "https://...",
    "author_name": "UP 主",
    "source_url": "https://..."
  },
  "recommendations": [
    {
      "id": "post_uuid",
      "note": "某個人的推薦理由",
      "profile": {
        "username": "12345678",
        "display_name": "策展人"
      }
    }
  ],
  "comments": []
}
```

## 8. 策展動態詳情 `/p/[id]`

### 8.1 需求

以 `post` 為中心展示某個人的一次推薦。

### 8.2 查詢資料

```text
post
profile
video
modules
comments where target_type = post
current_user reaction state
```

### 8.3 頁面資料形狀

```json
{
  "post": {
    "id": "post_uuid",
    "note": "推薦理由",
    "created_at": "2026-07-08T00:00:00Z",
    "like_count": 0,
    "comment_count": 0
  },
  "profile": {},
  "video": {},
  "modules": [],
  "comments": [],
  "viewer": {
    "liked": false
  }
}
```

## 9. 小館列表 `/m`

### 9.1 需求

展示所有 active 小館。

### 9.2 查詢資料

```text
modules
post_count
latest_post_at
```

第一版如果統計成本高，可先只讀 `modules`。

## 10. 小館頁 `/m/[slug]`

### 10.1 需求

展示某個小館下的策展動態。

### 10.2 查詢資料

```text
module by slug
post_modules
posts
profiles
videos
```

排序：

```text
posts.created_at desc
```

## 11. 搜尋 `/search`

### 11.1 MVP 狀態

第一版可先占位。

### 11.2 未來搜尋目標

- 站內已收錄 `videos`。
- 未收錄 B 站影片，後續可解析外部來源。

## 12. 使用者頁 `/u/[username]`

### 12.1 需求

極簡使用者頁。

### 12.2 查詢資料

```text
profile by username
posts by profile.id
videos for posts
```

## 13. 喜歡 like

### 13.1 需求

第一版只做 `like`。

### 13.2 操作

按喜歡：

```text
insert reactions
target_type = post
reaction_type = like
```

取消喜歡：

```text
delete reactions
where user_id = current user
and target_type = post
and target_id = post id
and reaction_type = like
```

### 13.3 計數

第一版可用：

- 寫入/刪除 reaction 後更新 `posts.like_count`。
- 或查詢時計算數量。

建議先用快取欄位 `like_count`，後續用 trigger 維護。

## 14. 留言 comments

### 14.1 需求

留言支持兩種目標：

```text
target_type = post
target_type = video
```

### 14.2 建立留言

```json
{
  "target_type": "post",
  "post_id": "post_uuid",
  "user_id": "current_user_id",
  "content": "留言內容",
  "status": "published"
}
```

### 14.3 第一版限制

- 只做一層留言。
- `parent_id` 先預留。
- 留言建立後更新對應 count。

## 15. 私訊與通知

### 15.1 `/messages`

第一版占位。

後續讀：

```text
conversations
conversation_members
messages
```

### 15.2 `/notifications`

第一版占位。

後續讀：

```text
notifications
```

通知類型：

- 喜歡。
- 留言。
- 回覆。
- 追蹤。

## 16. API route 使用原則

優先使用 Supabase client 直連。

需要 Next.js API route 的情況：

- 解析 B 站資料。
- 需要保護 service role key。
- 需要聚合複雜資料。
- 需要繞過前端不應執行的敏感邏輯。

第一版可先保留 `pages/api/videos.js` 過渡，但正式資料流應轉向 `posts`。

## 17. 錯誤處理

前端需要處理：

- 未登入。
- BVID 無效。
- 推薦理由太短。
- Supabase 讀寫失敗。
- 權限不足。

錯誤文案使用台灣繁中。

例：

```text
請先登入再發布。
推薦理由至少需要 10 個字。
影片資料讀取失敗，請稍後再試。
```

## 18. 待補

SQL 階段需要補：

- 實際 RLS policy。
- trigger 或 function 維護 count。
- profile 自動建立機制。
- username 數字生成機制。
