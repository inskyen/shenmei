-- 「頻道」是 modules 在產品介面中的正式名稱。
-- 內部資料表、關聯欄位與 /m 路由維持不變，避免破壞既有資料與連結。
update public.modules
set
  name = replace(name, '小館', '頻道'),
  updated_at = now()
where name like '%小館%';
