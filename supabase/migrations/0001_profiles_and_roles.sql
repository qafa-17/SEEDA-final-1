-- =====================================================================
-- Stage 2: user profiles and roles
-- Paste this whole file into Supabase > SQL Editor and click Run.
-- Safe to run once on a fresh project.
-- =====================================================================

-- 1. Roles in the publishing workflow.
--    publisher: imports articles, fills metadata, submits for review.
--    approver:  everything a publisher can do, plus approve and publish.
create type public.app_role as enum ('publisher', 'approver');

-- 2. One profile row per account. auth.users (managed by Supabase) holds
--    the email and password; this table holds what the app needs.
--    Email is deliberately NOT copied here, so other users can never read it.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default ''
              check (char_length(full_name) <= 100),
  role        public.app_role not null default 'publisher',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'App-level user data. One row per auth user, created automatically on sign-up.';
comment on column public.profiles.role is 'Only changeable by an admin in the Supabase dashboard, never by the app.';

-- 3. Row Level Security: with RLS on and no policy, nobody can touch a row.
--    We then open exactly what is needed, nothing more.
alter table public.profiles enable row level security;

-- Signed-in users can see team members' names and roles
-- (the board shows who owns each article).
create policy "Signed-in users can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update only their own row ...
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ... and only the full_name column. Column privileges make the role
-- column impossible to change from the app, even with a hand-made request.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
-- No insert or delete grants: rows are created by the trigger below and
-- removed automatically when the auth user is deleted.

-- 4. Create the profile automatically when someone signs up.
--    security definer: runs with the owner's rights so it can insert even
--    though app users cannot. search_path = '' blocks schema hijacking.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''), 100)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Keep updated_at accurate on every change.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 6. These functions are for triggers only; nobody should call them directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
