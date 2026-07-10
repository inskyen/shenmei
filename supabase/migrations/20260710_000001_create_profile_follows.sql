-- 第一版只支援「使用者追蹤使用者」；小館追蹤日後另建關係表，避免多型 target 欄位讓查詢與權限變複雜。
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint follows_unique_pair unique (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_following_created_idx
on public.follows (following_id, created_at desc);

create index if not exists follows_follower_created_idx
on public.follows (follower_id, created_at desc);

alter table public.follows enable row level security;

-- 追蹤名單與追蹤數為公開的社交資訊，訪客也能讀取個人頁統計。
drop policy if exists "follows are publicly readable" on public.follows;
create policy "follows are publicly readable"
on public.follows for select
using (true);

-- 只能用目前登入者身分建立追蹤；資料庫同時阻擋自行追蹤。
drop policy if exists "users can follow from their own account" on public.follows;
create policy "users can follow from their own account"
on public.follows for insert
with check (
  auth.uid() = follower_id
  and follower_id <> following_id
);

-- 取消追蹤只能刪除自己建立的關係。
drop policy if exists "users can unfollow from their own account" on public.follows;
create policy "users can unfollow from their own account"
on public.follows for delete
using (auth.uid() = follower_id);
