-- Align an existing profiles table with the MVP profile shape.
-- Some early projects already had profiles, so create table if not exists did not add these columns.

alter table public.profiles add column if not exists display_name text not null default '策展人';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists aesthetic_tags text[] not null default '{}';
alter table public.profiles add column if not exists message_permission text not null default 'followers';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_message_permission_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_message_permission_check
    check (message_permission in ('everyone', 'followers', 'none'));
  end if;
end;
$$;
