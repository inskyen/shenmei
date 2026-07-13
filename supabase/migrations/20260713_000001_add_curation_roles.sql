-- 角色模型：未登入者是訪客；登入者預設為 member；可投遞小館者為 aesthete；管理者為 super_admin。
alter table public.profiles
  add column if not exists role text not null default 'member';

update public.profiles
set role = 'member'
where role is null;

alter table public.profiles
  alter column role set default 'member',
  alter column role set not null;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('member', 'aesthete', 'super_admin'));

-- 所有新建或補建的個人檔案只能從普通使用者開始，不能自行指定更高角色。
drop policy if exists "authenticated users can insert own profile" on public.profiles;
create policy "authenticated users can insert own member profile"
on public.profiles for insert
with check (
  auth.uid() = id
  and role = 'member'
);

-- 供 RLS 使用的角色讀取函式。角色仍由 profiles 公開提供，但這個函式可避免每條策略重複子查詢。
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

revoke all on function public.current_profile_role() from public;
grant execute on function public.current_profile_role() to authenticated;

-- 客戶端只能改自己的公開資料，不能直接把自己升級為審美者或超管。
create or replace function public.prevent_client_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception '角色只能由管理者調整';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_client_role_change on public.profiles;
create trigger profiles_prevent_client_role_change
before update on public.profiles
for each row execute function public.prevent_client_role_change();

-- 被降為普通使用者時，保留其動態，但自動移出全部小館、回到大廳。
create or replace function public.remove_demoted_user_posts_from_modules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role in ('aesthete', 'super_admin') and new.role = 'member' then
    delete from public.post_modules
    using public.posts
    where post_modules.post_id = posts.id
      and posts.user_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_remove_demoted_posts_from_modules on public.profiles;
create trigger profiles_remove_demoted_posts_from_modules
after update of role on public.profiles
for each row execute function public.remove_demoted_user_posts_from_modules();

-- 關閉的小館仍可閱讀歷史內容；前端仍只會把 active 小館列為可投遞選項。
drop policy if exists "active modules are publicly readable" on public.modules;
create policy "active and archived modules are publicly readable"
on public.modules for select
using (status in ('active', 'archived'));

-- 超管未來可透過管理介面建立、編輯或將小館標為 archived；第一版仍由 Supabase 後台手動操作。
drop policy if exists "super admins can create modules" on public.modules;
create policy "super admins can create modules"
on public.modules for insert
with check (public.current_profile_role() = 'super_admin');

drop policy if exists "super admins can update modules" on public.modules;
create policy "super admins can update modules"
on public.modules for update
using (public.current_profile_role() = 'super_admin')
with check (public.current_profile_role() = 'super_admin');

-- 只有審美者與超管可以把自己的動態投遞至仍在啟用中的小館。
drop policy if exists "users can attach modules to own posts" on public.post_modules;
create policy "aesthetes can attach modules to own posts"
on public.post_modules for insert
with check (
  auth.uid() = added_by
  and public.current_profile_role() in ('aesthete', 'super_admin')
  and exists (
    select 1
    from public.posts
    where posts.id = post_modules.post_id
      and posts.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.modules
    where modules.id = post_modules.module_id
      and modules.status = 'active'
  )
);

-- 超管可將單篇內容移出小館，保留原動態並回歸大廳。
drop policy if exists "super admins can remove posts from modules" on public.post_modules;
create policy "super admins can remove posts from modules"
on public.post_modules for delete
using (public.current_profile_role() = 'super_admin');
