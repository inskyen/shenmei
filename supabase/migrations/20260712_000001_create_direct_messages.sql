create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  initiator_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_no_self_message check (initiator_id <> recipient_id)
);

create unique index if not exists conversations_direct_pair_unique_idx
  on public.conversations (least(initiator_id, recipient_id), greatest(initiator_id, recipient_id));

create index if not exists conversations_initiator_last_message_idx
  on public.conversations (initiator_id, last_message_at desc);

create index if not exists conversations_recipient_last_message_idx
  on public.conversations (recipient_id, last_message_at desc);

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

alter table public.messages
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
  add column if not exists read_at timestamptz;

alter table public.messages
  alter column conversation_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_sender_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_sender_id_fkey
      foreign key (sender_id) references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_receiver_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_receiver_id_fkey
      foreign key (receiver_id) references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_no_self_message'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_no_self_message check (sender_id <> receiver_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_content_length_check'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_content_length_check
      check (char_length(trim(content)) between 1 and 1000);
  end if;
end;
$$;

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

create index if not exists messages_receiver_unread_idx
  on public.messages (receiver_id, read_at, created_at desc)
  where read_at is null;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversation participants can read conversations" on public.conversations;
create policy "conversation participants can read conversations"
on public.conversations for select
using (auth.uid() = initiator_id or auth.uid() = recipient_id);

drop policy if exists "conversation participants can read messages" on public.messages;
create policy "conversation participants can read messages"
on public.messages for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

alter table public.notifications
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like', 'comment', 'reply', 'follow', 'message'));

create or replace function public.send_direct_message(
  target_user_id uuid,
  message_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_user_id uuid := auth.uid();
  conversation_id uuid;
  target_permission text;
  normalized_content text := trim(message_content);
begin
  if sender_user_id is null then
    raise exception '請先登入，才能傳送私訊。';
  end if;

  if target_user_id is null or target_user_id = sender_user_id then
    raise exception '無法向自己傳送私訊。';
  end if;

  if char_length(normalized_content) < 1 or char_length(normalized_content) > 1000 then
    raise exception '訊息長度需介於 1 到 1000 字之間。';
  end if;

  select id into conversation_id
  from public.conversations
  where (initiator_id = sender_user_id and recipient_id = target_user_id)
     or (initiator_id = target_user_id and recipient_id = sender_user_id)
  limit 1;

  if conversation_id is null then
    select message_permission into target_permission
    from public.profiles
    where id = target_user_id;

    if target_permission is null then
      raise exception '找不到這位審美者。';
    end if;

    if target_permission = 'none' then
      raise exception '對方目前不接收新的私訊。';
    end if;

    if target_permission = 'followers' and not exists (
      select 1
      from public.follows
      where follower_id = sender_user_id
        and following_id = target_user_id
    ) then
      raise exception '對方只接收追蹤者的私訊。';
    end if;

    insert into public.conversations (initiator_id, recipient_id)
    values (sender_user_id, target_user_id)
    on conflict do nothing
    returning id into conversation_id;

    if conversation_id is null then
      select id into conversation_id
      from public.conversations
      where (initiator_id = sender_user_id and recipient_id = target_user_id)
         or (initiator_id = target_user_id and recipient_id = sender_user_id)
      limit 1;
    end if;
  end if;

  insert into public.messages (conversation_id, sender_id, receiver_id, content)
  values (conversation_id, sender_user_id, target_user_id, normalized_content);

  update public.conversations
  set last_message_at = now()
  where id = conversation_id;

  insert into public.notifications (recipient_id, actor_id, type, conversation_id)
  values (target_user_id, sender_user_id, 'message', conversation_id);

  return conversation_id;
end;
$$;

revoke all on function public.send_direct_message(uuid, text) from public;
grant execute on function public.send_direct_message(uuid, text) to authenticated;

create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入，才能標記訊息。';
  end if;

  update public.messages
  set read_at = coalesce(read_at, now())
  where conversation_id = target_conversation_id
    and receiver_id = auth.uid();
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
