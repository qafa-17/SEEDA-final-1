-- =====================================================================
-- Generate draft: the hub writes article drafts from keyword research.
--   1. AI drafts live in the hub, so they need no Google Doc.
--   2. Tags may use capitals, the way the live site writes them
--      ("CAPEX Risk", "Bill C-5").
--   3. The live CAPEX article joins the list of site pages.
--   4. Keywords from the owner's website analysis (9 Oct 2026).
--   5. A log of headline and draft requests, which is also how the hub
--      keeps inside the AI service's free allowance.
-- Paste into Supabase > SQL Editor and click Run. Requires 0001 to 0008.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. AI drafts have no Doc behind them
-- ---------------------------------------------------------------------
alter table public.articles alter column drive_file_id drop not null;
alter table public.articles add constraint articles_doc_or_ai_draft
  check (drive_file_id is not null or source = 'ai_draft');
comment on column public.articles.source is
  'google_doc = imported from a Doc someone wrote; ai_draft = written in the hub from keyword research, then edited by a person.';

-- ---------------------------------------------------------------------
-- 2. Tags: capitals allowed, plus full stops ("U.S."), and no tag twice
--    in different capitalisation ("EPC" and "epc").
-- ---------------------------------------------------------------------
create or replace function public.valid_tags(t text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(t), 0) <= 8
     and not exists (select 1 from unnest(t) as x where x is null or x !~ '^[A-Za-z0-9][A-Za-z0-9 &.-]{1,29}$')
     and (select count(distinct lower(x)) from unnest(t) as x) = coalesce(cardinality(t), 0);
$$;

-- ---------------------------------------------------------------------
-- 3. The first real article on the live site (published 9 Oct 2026).
--    The site's other /resources pages are test pages, but their URLs are
--    still taken, so they stay on the list.
-- ---------------------------------------------------------------------
insert into public.site_pages (path, title, kind) values
  ('/resources/managing-capex-risks-2026-procurement-specialists',
   'Managing CAPEX Risks in 2026: The Role of On-Demand Procurement Specialists in Western Canada', 'resource')
on conflict (path) do nothing;

-- ---------------------------------------------------------------------
-- 4. Keywords from the owner's website analysis
-- ---------------------------------------------------------------------
insert into public.keywords (category_id, phrase, status, added_by)
select c.id, k.phrase, 'active', null
from (values
  (7, 'Short-term EPCM staffing Western Canada'),
  (7, 'On-demand pipeline engineering consultants'),
  (3, 'C2B capital project management'),
  (2, 'Direct hire EPCM experts Calgary'),
  (2, 'Short term EPCM staffing Calgary'),
  (6, 'Industrial capital project procurement Western Canada'),
  (1, 'EPC procurement risk mitigation'),
  (1, 'Bill C-5 infrastructure compliance'),
  (3, 'Managing material cost increases industrial projects'),
  (2, 'Worksite management services Alberta'),
  (3, 'Industrial project execution consultants'),
  (4, 'Short-term pipeline engineering specialists'),
  (3, 'Onsite contractor management Western Canada')
) as k(sort_order, phrase)
join public.keyword_categories c on c.sort_order = k.sort_order
on conflict ((lower(phrase))) do nothing;

-- ---------------------------------------------------------------------
-- 5. Headline and draft requests
--    kind = 'headlines': the AI suggested headlines for one piece of
--                        research (kept here, so they can be picked later)
--    kind = 'draft':     the AI wrote one draft (article_id points to it)
-- ---------------------------------------------------------------------
create table public.draft_requests (
  id            uuid primary key default gen_random_uuid(),
  requested_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  kind          text not null check (kind in ('headlines', 'draft')),
  search_id     uuid references public.idea_searches (id) on delete set null,
  headlines     jsonb check (headlines is null or (jsonb_typeof(headlines) = 'array'
                  and jsonb_array_length(headlines) <= 8 and pg_column_size(headlines) <= 20000)),
  -- set null: the log stays (and keeps counting) if the draft is deleted.
  article_id    uuid references public.articles (id) on delete set null,
  status        text not null check (status in ('ok', 'failed')),
  created_at    timestamptz not null default now(),
  check (kind = 'headlines' or headlines is null),
  check (kind = 'draft' or article_id is null)
);

create index draft_requests_by_search on public.draft_requests (search_id, created_at desc);
create index draft_requests_by_person on public.draft_requests (requested_by, created_at desc);

alter table public.draft_requests enable row level security;
revoke all on public.draft_requests from anon, authenticated;

grant select on public.draft_requests to authenticated;
create policy "Members read draft requests" on public.draft_requests
  for select to authenticated using ((select public.active_role()) is not null);

-- Rows are added in the person's own name and never edited or deleted,
-- so the allowance can't be wound back.
grant insert (kind, search_id, headlines, article_id, status) on public.draft_requests to authenticated;
create policy "Members add their own draft requests" on public.draft_requests
  for insert to authenticated
  with check ((select public.active_role()) is not null and requested_by = (select auth.uid()));

-- Allowance used: by this person in the last 24 hours, and by the team
-- this calendar month. Returns numbers only.
create function public.draft_request_usage()
returns table (headlines_today bigint, drafts_today bigint, drafts_this_month bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where r.kind = 'headlines' and r.requested_by = (select auth.uid()) and r.created_at >= now() - interval '24 hours'),
    count(*) filter (where r.kind = 'draft' and r.requested_by = (select auth.uid()) and r.created_at >= now() - interval '24 hours'),
    count(*) filter (where r.kind = 'draft' and r.created_at >= date_trunc('month', now()))
  from public.draft_requests r
  where (select public.active_role()) is not null;
$$;

revoke execute on function public.draft_request_usage() from public, anon;
grant execute on function public.draft_request_usage() to authenticated;
