-- =====================================================================
-- Sign in with GitHub: fill in a new person's name from whichever field
-- their sign-in method provides. Email sign-up and Google send full_name;
-- GitHub sends name, and only user_name when someone has no display name.
-- Paste into Supabase > SQL Editor and click Run. Requires 0001.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'user_name'), ''),
      ''
    ), 100)
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
