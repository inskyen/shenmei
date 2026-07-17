# 審美者（採樣器）

審美者是一個以 Bilibili 影片為內容入口的審美採樣社交產品。

使用者發布的不是單純影片連結，而是：

```text
一支影片 + 一段推薦理由 + 可選頻道
```

產品採用 `video + post` 雙核心：

- `video`：影片本體與長期沉澱，對應 `/v/[id]`。
- `post`：使用者的一次採樣與討論，對應 `/p/[id]`。

## 當前階段

截至 2026-07-16：

- 核心 MVP 已完成，可進行小規模種子內測。
- 正在補齊公開測試前的反濫用、檢舉治理、安全與運維能力。
- 暫不建議在缺少治理工具的情況下完全開放註冊並大規模宣傳。

詳細進度請讀：

- `docs/README.md`
- `docs/07_ROADMAP.md`
- `docs/05_DEPLOY_OPS.md`

## 已完成功能

- Email / Password 註冊登入與六位 Email OTP。
- profile、數字審美號、角色權限與資料設定。
- 首頁「追蹤／最新／頻道」、分頁載入與頁面預熱。
- B站影片採樣發布、影片搜索與使用者搜索。
- `/v/[id]` 影片主頁與 `/p/[id]` 採樣詳情。
- 頻道建立、排序、投遞與角色限制。
- 喜歡、留言、回覆與軟刪除。
- 使用者追蹤、通知、即時私訊與未讀狀態。
- 行動端底部導航、沉浸播放與 App 化頁面過渡。

## 技術棧

- Next.js 16 Pages Router
- React 19
- Supabase Auth / Database / Realtime
- Vercel

## 本地啟動

建立 `.env.local`：

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

安裝與啟動：

```bash
npm install
npm run dev
```

檢查：

```bash
npm run lint
npm run build
```

## 資料庫

SQL migration 位於 `supabase/migrations/`，目前仍採 Supabase SQL Editor 手動執行。

每次部署前必須確認：

1. 新 migration 已在目標 Supabase 專案執行。
2. RLS policy 與 trigger 已生效。
3. 前端程式與遠端資料庫版本一致。

不要把 Supabase service role key 放進前端或提交到 Git。
