# 05_DEPLOY_OPS：部署與運維手冊

## 1. 狀態

此文檔暫未正式展開。

目前專案仍處於 MVP 早期施工階段，部署方案可在以下內容完成後補齊：

- Auth / Profile 流程完成。
- `/submit` 發布採樣 MVP 完成。
- 首頁資料源從 `videos` 過渡到 `posts`。

## 2. Supabase SQL

目前已有可審閱的 MVP schema：

```text
supabase/migrations/20260708_000001_create_mvp_schema.sql
```

此 SQL 尚未在遠端 Supabase 執行。

執行前應人工確認：

- 現有 `videos` 表是否已有資料需要遷移。
- 已確認遠端 `videos` 表有舊資料；migration 應保留舊表並補欄位，不可刪表重建。
- migration 會將舊 `videos` 回填為 legacy `posts`，避免首頁切到 posts 後舊資料消失。
- 是否允許改造現有表。
- RLS policy 是否符合目前 Supabase 專案設定。
- `auth.users` trigger 是否會影響既有使用者。

## 3. 後續需要補的內容

- 環境變數清單。
- Supabase 專案設定。
- RLS policy 檢查清單。
- 本地開發啟動方式。
- 正式部署方式。
- 回滾策略。
- 備份與資料安全。

## 4. 目前已知環境變數

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

注意：

- 不要把 service role key 放到前端。
- 不要在頁面中硬編碼 Supabase URL 或 key。
