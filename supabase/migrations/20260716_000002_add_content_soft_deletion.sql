-- 採樣與留言採用軟刪除：保留關聯資料與治理紀錄，但公開頁面不再展示內容。
-- 作者可刪除自己的內容，超管可處理任何採樣或留言。

drop policy if exists "super admins can update posts" on public.posts;
create policy "super admins can update posts"
on public.posts for update
using (public.current_profile_role() = 'super_admin')
with check (public.current_profile_role() = 'super_admin');

drop policy if exists "super admins can update comments" on public.comments;
create policy "super admins can update comments"
on public.comments for update
using (public.current_profile_role() = 'super_admin')
with check (public.current_profile_role() = 'super_admin');

-- 留言切換成 deleted 時由資料庫統一清除原文，避免客戶端漏傳占位內容。
create or replace function public.sanitize_deleted_comment()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'deleted' and old.status is distinct from 'deleted' then
    new.content = '此留言已刪除';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_sanitize_deleted_content on public.comments;
create trigger comments_sanitize_deleted_content
before update of status on public.comments
for each row execute function public.sanitize_deleted_comment();

-- 軟刪除是 UPDATE，不是 DELETE；留言數必須跟隨狀態變化增減。
create or replace function public.update_post_comment_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.target_type = 'post' and new.status = 'published' then
    update public.posts
    set comment_count = comment_count + 1
    where id = new.post_id;
    return new;
  end if;

  if tg_op = 'DELETE' and old.target_type = 'post' and old.status = 'published' then
    update public.posts
    set comment_count = greatest(comment_count - 1, 0)
    where id = old.post_id;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.target_type = 'post' then
    if old.status = 'published' and new.status <> 'published' then
      update public.posts
      set comment_count = greatest(comment_count - 1, 0)
      where id = old.post_id;
    elsif old.status <> 'published' and new.status = 'published' then
      update public.posts
      set comment_count = comment_count + 1
      where id = new.post_id;
    end if;
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists comments_update_post_comment_count on public.comments;
drop trigger if exists comments_update_post_comment_count_on_status on public.comments;

create trigger comments_update_post_comment_count
after insert or delete on public.comments
for each row execute function public.update_post_comment_count();

create trigger comments_update_post_comment_count_on_status
after update of status on public.comments
for each row execute function public.update_post_comment_count();

-- 已刪除的主留言仍需供前端顯示占位，才能保留其他使用者的回覆脈絡。
-- 同時驗證目標仍然公開，避免已刪除採樣的留言被單獨讀取。
drop policy if exists "published comments are publicly readable" on public.comments;
drop policy if exists "visible comments are publicly readable" on public.comments;
create policy "visible comments are publicly readable"
on public.comments for select
using (
  status in ('published', 'deleted')
  and (
    (
      target_type = 'post'
      and exists (
        select 1
        from public.posts
        where posts.id = comments.post_id
          and posts.status = 'published'
          and posts.visibility = 'public'
      )
    )
    or
    (
      target_type = 'video'
      and exists (
        select 1
        from public.videos
        where videos.id = comments.video_id
      )
    )
  )
);

-- 由資料庫原子地完成權限判斷與狀態更新，避免 RLS 對無權更新回傳空結果時
-- 被客戶端誤認為刪除成功。
create or replace function public.soft_delete_post(target_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.posts
  set status = 'deleted'
  where id = target_post_id
    and status = 'published'
    and (
      user_id = auth.uid()
      or public.current_profile_role() = 'super_admin'
    );

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.soft_delete_post(uuid) from public;
grant execute on function public.soft_delete_post(uuid) to authenticated;

create or replace function public.soft_delete_comment(target_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.comments
  set status = 'deleted'
  where id = target_comment_id
    and status = 'published'
    and (
      user_id = auth.uid()
      or public.current_profile_role() = 'super_admin'
    );

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.soft_delete_comment(uuid) from public;
grant execute on function public.soft_delete_comment(uuid) to authenticated;
