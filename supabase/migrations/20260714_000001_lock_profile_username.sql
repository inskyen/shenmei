-- 審美號是註冊時分配的公開 ID；一般使用者不能從前端自行修改。
create or replace function public.prevent_client_username_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.username is distinct from old.username then
    raise exception '審美號暫不支援修改';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_client_username_change on public.profiles;
create trigger profiles_prevent_client_username_change
before update on public.profiles
for each row execute function public.prevent_client_username_change();

-- 以八位數隨機號建立新帳號資料。unique 約束是最終防線；若剛好與並發註冊撞號則重新抽取。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_username text;
begin
  loop
    generated_username := public.generate_numeric_username();

    begin
      insert into public.profiles (id, username, display_name)
      values (
        new.id,
        generated_username,
        coalesce(
          nullif(new.raw_user_meta_data ->> 'display_name', ''),
          split_part(new.email, '@', 1),
          '策展人'
        )
      );

      return new;
    exception
      when unique_violation then
        -- 同一 auth user 已有 profile 時維持原本的冪等行為；其餘唯一衝突則重新抽號。
        if exists (select 1 from public.profiles where id = new.id) then
          return new;
        end if;
    end;
  end loop;
end;
$$;
