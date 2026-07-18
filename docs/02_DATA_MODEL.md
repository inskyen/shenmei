# 02_DATA_MODEL：審美者資料模型草案

## 1. 建模原則

審美者採用 `video` + `post` 雙核心。

因此資料模型必須拆開：

```text
videos = 影片本體資料，負責內容沉澱
posts = 使用者對某支影片的一次採樣推薦，負責信息流傳播與個人審美表達
```

同一支影片可以被不同使用者用不同推薦理由多次採樣。

## 2. MVP 優先資料表

第一階段優先實作：

```text
profiles
videos
posts
modules
post_modules
comments
reactions
user_channel_preferences
feed_impressions
```

第二階段再實作：

```text
follows
notifications
conversations
conversation_members
messages
blocks
reports
```

## 3. 關係總覽

```text
profiles 1 - n posts
videos 1 - n posts
posts n - n modules through post_modules
posts 1 - n comments
videos 1 - n comments
posts 1 - n reactions
profiles 1 - n comments
profiles 1 - n reactions
profiles n - n profiles through follows
profiles n - n conversations through conversation_members
conversations 1 - n messages
profiles n - n modules through user_channel_preferences
profiles 1 - n feed_impressions
```

## 4. profiles

使用者公開資料。對應 Supabase Auth 的使用者。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 對應 `auth.users.id` |
| username | text | 是 | 唯一審美號，用於 `/u/[username]`；註冊時自動生成數字，前端不可自行修改 |
| display_name | text | 是 | 顯示名稱 |
| avatar_url | text | 否 | 頭像 |
| bio | text | 否 | 個人簡介 |
| aesthetic_tags | text[] | 否 | 審美標籤，後續使用 |
| message_permission | text | 是 | 私訊權限，預設 `followers` |
| created_at | timestamptz | 是 | 建立時間 |
| updated_at | timestamptz | 是 | 更新時間 |

### 約束

- `username` 唯一。
- 註冊時自動生成唯一數字型 `username`，目前作為穩定審美號與路由識別，不允許前端自行修改。
- `username` 目前作為穩定審美號與路由識別，不提供使用者自行修改。
- `message_permission` 建議值：
  - `everyone`
  - `followers`
  - `none`

### MVP 狀態

必做，但 `aesthetic_tags` 和 `message_permission` 可先預留。

## 5. videos

影片本體資料。  
同一個 B 站影片只應存一筆。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | bigint | 是 | 主鍵；沿用既有 `videos.id` 數字型資料 |
| bvid | text | 否 | 舊欄位，保留以兼容現有資料 |
| source_platform | text | 是 | 來源平台，MVP 預設 `bilibili` |
| external_id | text | 是 | 平台內部 ID，B 站即 BVID |
| source_url | text | 是 | 原始連結 |
| title | text | 是 | 影片標題 |
| cover | text | 否 | 舊封面欄位，保留以兼容現有資料 |
| cover_url | text | 否 | 封面 |
| up_name | text | 否 | 舊 UP 主欄位，保留以兼容現有資料 |
| author_name | text | 否 | UP 主 / 作者名稱 |
| duration_seconds | integer | 否 | 影片長度，後續使用 |
| metadata | jsonb | 否 | 平台原始資料，後續使用 |
| created_at | timestamptz | 是 | 建立時間 |
| updated_at | timestamptz | 是 | 更新時間 |

### 約束

- `source_platform + external_id` 唯一。

### 與現有程式的對應

目前前端使用欄位：

```text
bvid
title
cover
up_name
```

建議正式模型改為：

```text
external_id
title
cover_url
author_name
```

前端可在過渡期做欄位映射。

### 既有資料兼容

遠端 Supabase 已有 `videos` 舊表，且有資料。  
正式 SQL 不應刪表或重建 `videos`，而是：

- 保留舊欄位。
- 補 `source_platform / external_id / source_url / cover_url / author_name / duration_seconds / metadata / updated_at`。
- 將 `bvid` 回填到 `external_id`。
- 將 `cover` 回填到 `cover_url`。
- 將 `up_name` 回填到 `author_name`。

## 6. posts

採樣動態。  
這是信息流傳播與個人審美表達的核心內容單位。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主鍵 |
| user_id | uuid | 否 | 發布者，關聯 `profiles.id`；舊資料遷移時可暫時為空 |
| legacy_added_by | text | 否 | 舊 videos.added_by 文字來源，用於保留舊資料脈絡 |
| video_id | bigint | 是 | 對應影片，關聯 `videos.id` |
| note | text | 是 | 推薦理由 |
| visibility | text | 是 | 可見性，預設 `public` |
| status | text | 是 | 狀態，預設 `published` |
| like_count | integer | 是 | 喜歡數快取，預設 0 |
| comment_count | integer | 是 | 留言數快取，預設 0 |
| created_at | timestamptz | 是 | 發布時間 |
| updated_at | timestamptz | 是 | 更新時間 |

### 約束

- `user_id` 和 `legacy_added_by` 至少要有一個。
- `note` 必填。
- 建議前端限制 `note` 至少 10 個字。
- `visibility` 建議值：
  - `public`
  - `followers`
  - `private`
- `status` 建議值：
  - `draft`
  - `published`
  - `hidden`
  - `deleted`

### MVP 狀態

必做。

## 7. modules

頻道 / 板塊 / 主題空間。對應 `/m/[slug]`。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主鍵 |
| slug | text | 是 | URL slug |
| name | text | 是 | 頻道名稱 |
| description | text | 否 | 頻道介紹 |
| cover_url | text | 否 | 封面 |
| theme_color | text | 否 | 主色 |
| owner_id | uuid | 否 | 頻道建立者；第一版保留欄位但不提供頻道管理功能 |
| sort_order | integer | 是 | 頻道展示順序；數字越小越靠前，預設 `1000` |
| status | text | 是 | 狀態，預設 `active` |
| created_at | timestamptz | 是 | 建立時間 |
| updated_at | timestamptz | 是 | 更新時間 |

### 約束

- `slug` 唯一。
- 第一版由管理員建立頻道。
- 第一版保留 `owner_id`，但可為空；若有建立者資料則記錄，介面暫不提供頻道管理員功能。

### MVP 狀態

建議必做基礎表。頁面可以先簡化。

## 8. post_modules

採樣動態與頻道的多對多關係。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| post_id | uuid | 是 | 關聯 `posts.id` |
| module_id | uuid | 是 | 關聯 `modules.id` |
| added_by | uuid | 否 | 歸類者 |
| created_at | timestamptz | 是 | 建立時間 |

### 約束

- `post_id + module_id` 唯一。

### MVP 狀態

必做，因為一篇採樣動態可以屬於多個頻道。

## 9. comments

留言。支持圍繞 `post` 或 `video`。

- `target_type = post`：評論某個人的推薦理由。
- `target_type = video`：評論影片本身，沉澱在影片主頁。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主鍵 |
| target_type | text | 是 | `post` 或 `video` |
| post_id | uuid | 否 | `target_type = post` 時使用 |
| video_id | bigint | 否 | `target_type = video` 時使用 |
| user_id | uuid | 是 | 留言者 |
| parent_id | uuid | 否 | 回覆某則留言，MVP 可不使用 |
| content | text | 是 | 留言內容 |
| status | text | 是 | 狀態，預設 `published` |
| created_at | timestamptz | 是 | 建立時間 |
| updated_at | timestamptz | 是 | 更新時間 |

### MVP 狀態

可做簡版：

- 優先支持 `target_type = post`。
- 同時保留 `target_type = video`，供第二階段影片主頁公共評論使用；第一版不在影片頁開放留言入口。
- `post` 與 `video` 的 ID 型別不同，因此 comments 不使用單一 `target_id`，而是使用 `post_id / video_id`。
- 只支持一層留言。
- `parent_id` 先預留。

## 10. reactions

喜歡 / 後續其他反應。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主鍵 |
| user_id | uuid | 是 | 操作者 |
| target_type | text | 是 | 目標類型，MVP 預設 `post` |
| target_id | uuid | 是 | 目標 ID |
| reaction_type | text | 是 | 反應類型，MVP 預設 `like` |
| created_at | timestamptz | 是 | 建立時間 |

### 約束

- `user_id + target_type + target_id + reaction_type` 唯一。

### MVP 狀態

第一版只做 `like`。

`reaction_type` 仍保留是為了資料表可擴展，但產品與介面不提前提供多種表情反應。

## 11. follows

追蹤關係。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主鍵 |
| follower_id | uuid | 是 | 追蹤者 |
| target_type | text | 是 | `profile` 或 `module` |
| target_id | uuid | 是 | 被追蹤目標 |
| created_at | timestamptz | 是 | 建立時間 |

### 約束

- `follower_id + target_type + target_id` 唯一。

### MVP 狀態

資料表可預留，功能後做。

## 12. conversations

私訊會話。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主鍵 |
| type | text | 是 | `direct` 或後續 `group` |
| last_message_at | timestamptz | 否 | 最後訊息時間 |
| created_at | timestamptz | 是 | 建立時間 |
| updated_at | timestamptz | 是 | 更新時間 |

### MVP 狀態

第一版可不做，只預留設計。

## 13. conversation_members

會話成員。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| conversation_id | uuid | 是 | 關聯 `conversations.id` |
| user_id | uuid | 是 | 成員 |
| last_read_at | timestamptz | 否 | 最後已讀時間 |
| created_at | timestamptz | 是 | 加入時間 |

### 約束

- `conversation_id + user_id` 唯一。

## 14. messages

私訊訊息。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主鍵 |
| conversation_id | uuid | 是 | 所屬會話 |
| sender_id | uuid | 是 | 發送者 |
| content | text | 是 | 訊息內容 |
| status | text | 是 | 狀態，預設 `sent` |
| created_at | timestamptz | 是 | 發送時間 |

### MVP 狀態

後續做。

## 15. notifications

通知。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主鍵 |
| user_id | uuid | 是 | 接收者 |
| actor_id | uuid | 否 | 觸發者 |
| type | text | 是 | 通知類型 |
| target_type | text | 否 | 目標類型 |
| target_id | uuid | 否 | 目標 ID |
| read_at | timestamptz | 否 | 已讀時間 |
| created_at | timestamptz | 是 | 建立時間 |

### 通知類型

- `post_liked`
- `post_commented`
- `followed`
- `message_received`

### MVP 狀態

後續做。

## 16. blocks

封鎖關係。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主鍵 |
| blocker_id | uuid | 是 | 封鎖者 |
| blocked_id | uuid | 是 | 被封鎖者 |
| created_at | timestamptz | 是 | 建立時間 |

### MVP 狀態

私訊前建議補上，第一版可不做。

## 17. reports

檢舉。

### 欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主鍵 |
| reporter_id | uuid | 是 | 檢舉者 |
| target_type | text | 是 | 目標類型 |
| target_id | uuid | 是 | 目標 ID |
| reason | text | 否 | 檢舉原因 |
| status | text | 是 | 狀態，預設 `open` |
| created_at | timestamptz | 是 | 建立時間 |

### MVP 狀態

後續做，但資料設計先保留。

## 18. 首頁資料查詢形態

首頁最新流應查 `posts`，並連帶取得：

```text
post
profile
video
modules
like_count
comment_count
```

不要直接查 `videos` 作為首頁主資料源。

影片主頁 `/v/[id]` 應查 `videos`，並連帶取得：

```text
video
posts for this video
profiles for those posts
comments where target_type = video
modules related through posts
```

## 19. 發布資料寫入流程

```text
1. 使用者輸入 B 站連結 / BVID
2. 系統取得或手動填入影片資料
3. 檢查 videos 是否已有 source_platform + external_id
4. 若沒有，建立 videos
5. 建立 posts
6. 若使用者選擇頻道，建立 post_modules
7. 若未選頻道，不建立 post_modules，該 post 仍出現在大廳最新流
8. 發布成功後返回大廳最新流，並將最新發布的 post 排在前列
```

## 20. RLS 權限草案

Supabase RLS 應在 SQL 階段細化。初步原則：

- `profiles`：公開可讀，使用者只能更新自己。
- `videos`：公開可讀，登入使用者可建立。
- `posts`：公開 `published` 可讀，登入使用者可建立；作者與超管可將內容軟刪除為 `deleted`，但不連帶刪除 `videos`。
- `modules`：公開可讀，管理員可建立/更新。
- `comments`：公開可讀，登入使用者可建立；作者與超管可軟刪除。已刪除的主留言以占位形式保留其他人的回覆脈絡，並從 `comment_count` 扣除。
- `reactions`：登入使用者可建立/刪除自己的。
- 私訊相關表：只有會話成員可讀寫。

## 21. 已確認決策

以下決策已確認，正式 SQL 時應照此落地：

- 已確認：發布時允許一篇 post 無頻道；未選頻道時預設發到大廳最新流。
- 已確認：`reactions` 第一版只做 `like`，不提前支持多反應。
- 已確認：`profiles.username` 註冊時自動生成唯一數字審美號；目前前端與資料庫禁止使用者自行修改。
- 已確認：`modules.owner_id` 第一版保留但不提供頻道管理功能，可為空。

## 22. 仍待確認

暫無。
