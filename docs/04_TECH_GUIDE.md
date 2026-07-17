# 04_TECH_GUIDE：審美者技術與風格規範

## 1. 技術棧

目前專案：

- Next.js Pages Router
- React
- Supabase
- Tailwind CSS 4（已安裝；現有頁面主要使用 inline style 與 `styles/globals.css`）

第一階段繼續使用 Pages Router，不急著遷移 App Router。

## 2. 開發原則

### 2.1 小步施工

每次只做一個可驗證的小閉環。

推薦節奏：

```text
寫文檔
→ 建資料表
→ 修 client
→ 實作一個頁面
→ 跑 lint
→ 手動驗證
→ 記錄 changelog
```

### 2.2 不做大爆炸重構

首頁主要邏輯仍集中在 `pages/index.js`。後續應在不破壞緩存、預載與滑動狀態的前提下逐步拆元件，不做一次性大重寫。

### 2.3 先保留產品氣質

技術重構不能破壞目前克制、黑白、內容優先、略帶冷感的移動端社區氣質。

## 3. 當前目錄結構

```text
lib/
  supabase/
    client.js
    server.js        # 若需要服務端使用
  auth/
  cache/
  comments/
  follows/
  messages/
  notifications/
  posts/
  reactions/

components/
  AppBottomNav.js
  ActionSheet.js
  ConfirmDialog.js
  DirectMessageThread.js
  ImmersiveVideoPlayer.js

pages/
  index.js
  submit.js
  v/[id].js
  p/[id].js
  m/index.js
  m/[slug].js
  u/[username].js
  search.js
  messages/index.js
  notifications.js
```

## 4. Supabase client 規範

### 4.1 不要在頁面硬編碼 Supabase 設定

目前已統一使用：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 4.2 共用 client

檔案：

```text
lib/supabase/client.js
```

`lib/supabase/client.js` 已建立，用途：

- 前端頁面共用。
- 避免每個頁面重複 `createClient`。
- 方便後續替換或加錯誤處理。

### 4.3 Service role key 禁止放前端

若未來需要 service role，只能在服務端 API route 或後端環境使用，不可暴露到瀏覽器。

## 5. 資料命名規範

正式資料欄位使用 snake_case：

```text
source_platform
external_id
cover_url
author_name
created_at
updated_at
```

React state / props 可沿用資料欄位，避免頻繁轉換。

舊欄位過渡：

```text
bvid       → external_id
cover      → cover_url
up_name    → author_name
added_by   → profile.display_name
```

## 6. 路由規範

正式路由：

```text
/                 大廳最新流
/submit           發佈採樣
/v/[id]           影片主頁
/p/[id]           採樣動態詳情
/m                頻道列表
/m/[slug]         頻道頁
/u/[username]     使用者頁
/search           搜尋 video
/messages         私訊
/notifications    通知
/login            登入 / 註冊
```

## 7. UI 文案規範

產品語言使用台灣繁中。

### 7.1 常用詞

| 避免 | 使用 |
| --- | --- |
| 登录 | 登入 |
| 注册 | 註冊 |
| 邮箱 | 信箱 |
| 账号 | 帳號 |
| 评论 | 留言 |
| 动态 | 動態 |
| 详情 | 詳情 |
| 搜索 | 搜尋 |
| 消息 | 訊息 |
| 关注 | 追蹤 |
| 收藏 | 收藏 |
| 点赞 | 喜歡 |
| 板块 | 頻道 |

### 7.2 導航文字

頂部：

```text
追蹤 / 最新 / 頻道
```

底部：

```text
發現 / 頻道 / 採樣 / 私訊 / 我的
```

注意：

- 首頁右上角搜尋入口對應 `/search`。
- 首頁 `頻道` 在頁內切換頻道列表；其他頁面的底部 `頻道` 對應 `/m`。

### 7.3 語氣

語氣要：

- 柔和。
- 安靜。
- 有採樣感。
- 不要太工具化。
- 不要太吵鬧社群。

例：

```text
流雲正載著美好趕來...
還沒有採樣動態。成為第一個留下審美痕跡的人。
已發布，這支影片有了新的審美註解。
```

## 8. 視覺風格

目前主色方向：

```text
背景：#F0F4F8
主文字：#2A527A
輔助文字：#87ACCA
品牌藍：#6B99C3
邊框霧藍：#C2D6E6
點綴柔桃：#F4D8CD
```

第一階段先保留內聯樣式也可以，但拆元件時應逐步整理成：

- CSS module
- 或 Tailwind class
- 或集中 style tokens

不要在不同頁面發明太多新顏色。

## 9. 元件拆分順序

建議順序：

1. `BottomNav`
2. `TopTabs`
3. `PostCard`
4. `VideoPlayer`
5. `PostFeed`
6. `CommentList`

不要先拆太細，避免抽象過早。

## 10. B 站處理規範

### 10.1 BVID 解析

應支持：

```text
BVxxxx
https://www.bilibili.com/video/BVxxxx
https://b23.tv/...
```

第一版可以先支持明確 BVID 和標準 B 站連結。短鏈後續做。

### 10.2 播放器

目前使用 iframe：

```text
//player.bilibili.com/player.html?bvid=BVxxxx
```

正式欄位使用：

```text
video.external_id
```

## 11. 表單規範

發布表單：

- B 站連結 / BVID 必填。
- 推薦理由必填，至少 10 個字。
- 頻道可選，不選則發到大廳。

錯誤提示：

```text
請先登入再發布。
請輸入有效的 B 站連結或 BVID。
推薦理由至少需要 10 個字。
發布失敗，請稍後再試。
```

## 12. 驗證流程

每次功能修改後至少跑：

```bash
npm run lint
```

如涉及 build 或部署前，再跑：

```bash
npm run build
```

手動驗證：

- 頁面能打開。
- 文案為繁中。
- Supabase 讀寫成功。
- 未登入狀態有正確處理。

## 13. Changelog 規範

每次完成一個小階段，在 `06_CHANGELOG.md` 記錄：

```text
日期
修改內容
驗證方式
下一步
```

## 14. 不要做的事

第一階段不要：

- 一次遷移 App Router。
- 一次重寫所有 UI。
- 提前做即時私訊。
- 提前做多反應表情。
- 提前做复杂推薦算法。
- 把 service role key 放到前端。

## 15. 下一步施工建議

正式寫代碼時建議順序：

1. 建立 `lib/supabase/client.js`。
2. 修正 `pages/login.js` 硬編碼。
3. 建立資料庫 SQL。
4. 新增 `/submit`。
5. 將首頁資料源從 `videos` 過渡到 `posts`。
