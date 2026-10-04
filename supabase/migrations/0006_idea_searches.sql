-- =====================================================================
-- Ideas: keyword research. Each row is one web search for a keyword in
-- a region, with the AI's reading of what searchers want. The table is
-- also the usage log: it is how the hub keeps inside the free limits of
-- the search and AI services.
-- Paste into Supabase > SQL Editor and click Run. Requires 0001 to 0005.
-- =====================================================================

create table public.idea_searches (
  id            uuid primary key default gen_random_uuid(),
  -- set null: research stays useful after the person who ran it leaves.
  requested_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  keyword       text not null check (char_length(btrim(keyword)) between 2 and 80),
  region        text not null check (region in ('alberta', 'british-columbia', 'saskatchewan', 'manitoba', 'western-canada')),
  -- What the search returned: [{ "title", "url", "snippet" }]
  results       jsonb not null check (jsonb_typeof(results) = 'array' and jsonb_array_length(results) <= 10 and pg_column_size(results) <= 20000),
  -- The AI's summary, or null when it failed or isn't set up.
  summary       jsonb check (summary is null or (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 10000)),
  ai_status     text not null check (ai_status in ('ok', 'failed', 'not_configured')),
  -- false when the results were reused from an earlier search (no search credit spent).
  used_search   boolean not null default true,
  created_at    timestamptz not null default now(),
  check ((ai_status = 'ok') = (summary is not null))
);

create index idea_searches_lookup on public.idea_searches (lower(keyword), region, created_at desc);
create index idea_searches_by_person on public.idea_searches (requested_by, created_at desc);

alter table public.idea_searches enable row level security;
revoke all on public.idea_searches from anon, authenticated;

-- Research is shared: every active member can read all of it.
grant select on public.idea_searches to authenticated;
create policy "Members read idea searches" on public.idea_searches
  for select to authenticated using ((select public.active_role()) is not null);

-- Members add rows in their own name only. Rows are never edited or
-- deleted, so the usage count can't be wound back.
grant insert (keyword, region, results, summary, ai_status, used_search) on public.idea_searches to authenticated;
create policy "Members add their own idea searches" on public.idea_searches
  for insert to authenticated
  with check ((select public.active_role()) is not null and requested_by = (select auth.uid()));

-- How much of the allowance is used: by this person today, and by the
-- whole team this calendar month (the search service's free plan is monthly).
-- Security definer so the team total is right even if read rules change;
-- it returns two numbers and nothing else.
create function public.idea_search_usage()
returns table (mine_today bigint, team_this_month bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where s.requested_by = (select auth.uid()) and s.created_at >= now() - interval '24 hours'),
    count(*) filter (where s.used_search and s.created_at >= date_trunc('month', now()))
  from public.idea_searches s
  where (select public.active_role()) is not null;
$$;

revoke execute on function public.idea_search_usage() from public, anon;
grant execute on function public.idea_search_usage() to authenticated;
