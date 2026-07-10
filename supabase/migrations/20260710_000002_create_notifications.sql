create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  post_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  read_at timestamptz,

  constraint notifications_type_check check (type in ('like', 'comment', 'reply', 'follow'))
);

create index if not exists notifications_recipient_read_created_idx
on public.notifications (recipient_id, is_read, created_at desc);

alter table public.notifications enable row level security;

-- 通知只属于接收者；写入完全由下方的资料库触发器负责。
drop policy if exists "users can read own notifications" on public.notifications;
create policy "users can read own notifications"
on public.notifications for select
using (auth.uid() = recipient_id);

drop policy if exists "users can update own notifications" on public.notifications;
create policy "users can update own notifications"
on public.notifications for update
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

create or replace function public.notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  select user_id into recipient
  from public.posts
  where id = new.target_id;

  if recipient is not null and recipient <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (recipient, new.user_id, 'like', new.target_id);
  end if;

  return new;
end;
$$;

drop trigger if exists reactions_notify_post_like on public.reactions;
create trigger reactions_notify_post_like
after insert on public.reactions
for each row
when (new.target_type = 'post' and new.reaction_type = 'like')
execute function public.notify_post_like();

create or replace function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  notification_type text := 'comment';
begin
  if new.parent_id is not null then
    select user_id into recipient
    from public.comments
    where id = new.parent_id;
    notification_type := 'reply';
  else
    select user_id into recipient
    from public.posts
    where id = new.post_id;
  end if;

  if recipient is not null and recipient <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (recipient, new.user_id, notification_type, new.post_id);
  end if;

  return new;
end;
$$;

drop trigger if exists comments_notify_post_comment on public.comments;
create trigger comments_notify_post_comment
after insert on public.comments
for each row
when (new.target_type = 'post' and new.status = 'published')
execute function public.notify_post_comment();

create or replace function public.notify_profile_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.follower_id <> new.following_id then
    insert into public.notifications (recipient_id, actor_id, type)
    values (new.following_id, new.follower_id, 'follow');
  end if;

  return new;
end;
$$;

drop trigger if exists follows_notify_profile_follow on public.follows;
create trigger follows_notify_profile_follow
after insert on public.follows
for each row
execute function public.notify_profile_follow();
