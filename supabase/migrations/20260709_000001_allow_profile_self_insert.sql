-- Allow older auth users to create their missing profile row from the client.
-- New users still use the auth trigger from the main MVP migration.

drop policy if exists "authenticated users can insert own profile" on public.profiles;
create policy "authenticated users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);
