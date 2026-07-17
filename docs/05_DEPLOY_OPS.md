# 05_DEPLOY_OPS：部署與運維手冊

> 更新時間：2026-07-16
> 當前部署：Vercel + Supabase，正式域名 `https://shenmei.org`

## 1. 架構

```text
瀏覽器 / PWA 外殼
→ Next.js Pages Router（Vercel）
→ Supabase Auth / Postgres / Realtime
→ Bilibili 公開影片資料與播放器
```

前端使用 Supabase anon key，資料安全依賴 RLS。Service role key 不得出現在前端。

## 2. 環境變數

本地 `.env.local` 與 Vercel Production 至少需要：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

要求：

- `.env.local` 不提交到 Git。
- Vercel Preview 與 Production 必須連到明確的 Supabase 專案。
- 不得在 `pages/`、`components/` 或公開 bundle 中放 service role key。

## 3. 本地開發

```bash
npm install
npm run dev
```

若已有 dev server 佔用 `3000`，先停止舊程序，不要同時啟動多個 Next dev server 共用 `.next`。

提交前：

```bash
npm run lint
npm run build
```

目前專案尚未建立自動化測試與 CI，核心流程仍需人工驗證。

## 4. Supabase migrations

migration 位於 `supabase/migrations/`，必須依檔名順序執行。

當前 migration：

```text
20260708_000001_create_mvp_schema.sql
20260709_000001_allow_profile_self_insert.sql
20260709_000002_align_profiles_columns.sql
20260710_000001_create_profile_follows.sql
20260710_000002_create_notifications.sql
20260711_000001_add_module_rules.sql
20260712_000001_create_direct_messages.sql
20260712_000002_default_message_permission_everyone.sql
20260713_000001_add_curation_roles.sql
20260714_000001_lock_profile_username.sql
20260715_000001_rename_modules_to_channels.sql
20260716_000001_add_module_sort_order.sql
20260716_000002_add_content_soft_deletion.sql
```

目前仍由 Supabase SQL Editor 手動執行，因此每次操作都要記錄：

- migration 檔名。
- 執行日期。
- 執行專案。
- 返回結果。
- 驗證人與驗證項目。

不要只依賴「Success. No rows returned.」；還要驗證欄位、函式、policy 與實際功能。

## 5. Migration 驗證清單

每次新增 migration 後至少檢查：

- [ ] 新欄位、constraint 與 index 存在。
- [ ] 訪客只能讀取允許公開的內容。
- [ ] 普通使用者不能提升自己的角色。
- [ ] 使用者只能修改或刪除自己的內容。
- [ ] 超管治理 policy 生效。
- [ ] 留言、喜歡與未讀計數 trigger 正常。
- [ ] Realtime publication 未重複添加資料表。
- [ ] 舊資料仍可讀取，沒有被 migration 誤刪。

最新軟刪除 migration 需要驗證：

- 作者可刪除自己的採樣與留言。
- 超管可刪除其他人的採樣與留言。
- 普通使用者不能刪除他人內容。
- 刪除採樣後影片仍存在。
- 刪除留言後 `comment_count` 正確減一。
- 有回覆的主留言顯示占位，回覆仍存在。

## 6. Vercel 部署流程

1. 確認 migration 已先執行，或確認本次提交不依賴新資料庫結構。
2. 執行 `npm run lint`。
3. 執行 `npm run build`。
4. 提交並 push 到連接 Vercel 的分支。
5. 等待 Vercel build 完成。
6. 打開正式域名進行 smoke test。

禁止先部署依賴新欄位的前端，再忘記執行 migration。

## 7. 正式環境 Smoke Test

### 訪客

- [ ] 首頁、頻道、影片頁、採樣頁與使用者頁可讀。
- [ ] 受限操作會提示登入。
- [ ] 分享標題、圖標與封面正常。

### 帳號

- [ ] 註冊、六位 OTP、登入與登出正常。
- [ ] profile 自動建立，審美號唯一。
- [ ] 修改暱稱、頭像、簡介與私訊權限正常。

### 內容

- [ ] 普通使用者可向大廳採樣。
- [ ] 審美者可選頻道。
- [ ] 新採樣立即出現在最新流。
- [ ] 喜歡、留言、回覆與刪除正常。

### 關係

- [ ] 追蹤與追蹤流正常。
- [ ] 通知可生成並標記已讀。
- [ ] 私訊列表、未讀與 Realtime 正常。

### 超管

- [ ] 可建立、排序與關閉頻道。
- [ ] 可移出頻道內容。
- [ ] 可刪除違規採樣與留言。

## 8. 已知公開測試阻斷項

- 尚未建立完整的註冊、採樣、留言與私訊限流。
- 尚未完成檢舉、封鎖與封禁流程。
- `/api/bilibili` 的短連結解析需要限制可信域名、超時與請求頻率。
- `next.config.mjs` 尚未配置完整安全響應頭。
- 尚未接入錯誤監控與可查詢的前端異常記錄。
- 尚未發布隱私政策、使用者協議與社區規範。
- 尚未建立自動化測試與 CI。

上述項目不阻止熟人種子內測，但阻止大規模公開運營。

## 9. 備份與回滾

公開測試前必須確認 Supabase 方案提供的備份能力與保留週期。

最低要求：

- 重要 migration 執行前匯出 schema。
- 破壞性資料操作前備份目標資料。
- migration 優先使用可重複執行或向前修復的方式。
- 不直接刪除 `videos`、`posts` 等核心資料；產品刪除優先採軟刪除。
- 前端部署失敗時可在 Vercel 回退至上一個成功 deployment。

每個 migration 應準備回滾思路；如果無法安全回滾，必須在執行記錄中註明。

## 10. 監控與事故處理

公開測試前至少建立：

- Vercel function error 觀察入口。
- 前端錯誤監控。
- Supabase Auth、Database、Realtime 異常檢查方式。
- 使用者聯絡與問題回報入口。
- 資料丟失、垃圾訊息、騷擾與侵權內容的處理人。

事故優先級：

```text
P0：資料外洩、越權、資料大量丟失
P1：無法登入、無法採樣、私訊大面積失效
P2：單頁錯誤、播放失敗、計數或樣式異常
```

P0 發生時應立即關閉受影響入口、保留日誌並停止繼續部署。
