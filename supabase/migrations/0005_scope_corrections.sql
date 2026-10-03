-- =====================================================================
-- Scope corrections from the project owner's documents (Oct 2026):
-- real service pages, tags, 1 to 3 target keywords, the keyword library,
-- the live site's pages (for link checks and reserved URLs), and where
-- each article came from.
-- Paste into Supabase > SQL Editor and click Run. Requires 0001 to 0004.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Service areas = the 12 service pages on epcmst.com (/services/<slug>)
-- ---------------------------------------------------------------------
update public.service_areas set slug = 'project-management', label = 'Project Management' where slug = 'management';

insert into public.service_areas (slug, label) values
  ('c2b-c2c-contracts', 'C2B and C2C Contracts'),
  ('civil-engineering', 'Civil Engineering'),
  ('facilities-engineering', 'Facilities Engineering'),
  ('pipeline-engineering', 'Pipeline Engineering'),
  ('specialists', 'Specialists'),
  ('structural-engineering', 'Structural Engineering'),
  ('water-management', 'Water Management'),
  ('worksite-management', 'Worksite Management');

-- Alphabetical order in menus.
update public.service_areas s set sort_order = o.rn
from (select id, row_number() over (order by label) as rn from public.service_areas) o
where o.id = s.id;

-- ---------------------------------------------------------------------
-- 2. The live site's pages: used to check internal links and to stop an
--    article taking a URL that already exists.
-- ---------------------------------------------------------------------
create table public.site_pages (
  path        text primary key check (path ~ '^/[a-z0-9/_-]*$' and char_length(path) <= 200),
  title       text not null,
  kind        text not null check (kind in ('page', 'service', 'resource', 'legal')),
  -- Set when the page was published from this hub.
  article_id  uuid references public.articles (id) on delete set null
);

insert into public.site_pages (path, title, kind) values
  ('/', 'Homepage', 'page'),
  ('/about', 'About', 'page'),
  ('/how-it-works', 'How It Works', 'page'),
  ('/pricing', 'Pricing', 'page'),
  ('/careers', 'Careers', 'page'),
  ('/contact', 'Contact', 'page'),
  ('/request-consultation', 'Request a Consultation', 'page'),
  ('/services', 'Services', 'service'),
  ('/services/c2b-c2c-contracts', 'C2B and C2C Contracts', 'service'),
  ('/services/civil-engineering', 'Civil Engineering', 'service'),
  ('/services/construction', 'Construction', 'service'),
  ('/services/engineering', 'Engineering', 'service'),
  ('/services/facilities-engineering', 'Facilities Engineering', 'service'),
  ('/services/pipeline-engineering', 'Pipeline Engineering', 'service'),
  ('/services/procurement', 'Procurement', 'service'),
  ('/services/project-management', 'Project Management', 'service'),
  ('/services/specialists', 'Specialists', 'service'),
  ('/services/structural-engineering', 'Structural Engineering', 'service'),
  ('/services/water-management', 'Water Management', 'service'),
  ('/services/worksite-management', 'Worksite Management', 'service'),
  ('/resources', 'Resources', 'resource'),
  ('/resources/case-study-how-bill-c-5-could-impact-a-major-canadian-infrastructure-project', 'Case Study: How Bill C-5 Could Impact a Major Canadian Infrastructure Project', 'resource'),
  ('/resources/the-agentic-shift-in-contracts-how-smart-management-is-saving-2026-capex', 'The Agentic Shift in Contracts: How Smart Management Is Saving 2026 CAPEX', 'resource'),
  ('/resources/the-untapped-potential-how-ai-can-revolutionize-epc-risk-management', 'The Untapped Potential: How AI Can Revolutionize EPC Risk Management', 'resource'),
  ('/client-protection', 'Client Protection', 'legal'),
  ('/privacy-policy', 'Privacy Policy', 'legal'),
  ('/terms-of-service', 'Terms of Service', 'legal');

alter table public.site_pages enable row level security;
revoke all on public.site_pages from anon, authenticated;
grant select on public.site_pages to authenticated;
create policy "Members read site pages" on public.site_pages
  for select to authenticated using ((select public.active_role()) is not null);

-- ---------------------------------------------------------------------
-- 3. Keyword library (the owner's list, in his 7 categories)
-- ---------------------------------------------------------------------
create table public.keyword_categories (
  id          smallint generated always as identity primary key,
  name        text not null unique,
  sort_order  smallint not null default 0
);

create table public.keywords (
  id           integer generated always as identity primary key,
  category_id  smallint not null references public.keyword_categories (id) on delete cascade,
  phrase       text not null check (char_length(btrim(phrase)) between 2 and 80)
);
create unique index keywords_phrase_unique on public.keywords (lower(phrase));

alter table public.keyword_categories enable row level security;
alter table public.keywords enable row level security;
revoke all on public.keyword_categories, public.keywords from anon, authenticated;
grant select on public.keyword_categories, public.keywords to authenticated;
create policy "Members read keyword categories" on public.keyword_categories
  for select to authenticated using ((select public.active_role()) is not null);
create policy "Members read keywords" on public.keywords
  for select to authenticated using ((select public.active_role()) is not null);

insert into public.keyword_categories (name, sort_order) values
  ('EPC Consulting & Advisory', 1),
  ('Calgary & Regional Local SEO', 2),
  ('Project & Construction Management', 3),
  ('Core Engineering Disciplines', 4),
  ('EPC Construction & Contracting', 5),
  ('Contractors, Build & Specialized Tools', 6),
  ('EPCMst Core & High-Intent Conversion', 7);

insert into public.keywords (category_id, phrase)
select c.id, k.phrase
from (values
  (1, 'EPC consulting services'), (1, 'EPC consultancy firm'), (1, 'Expert EPC consultants'),
  (1, 'Strategic EPC consulting'), (1, 'Professional EPC consultants'), (1, 'EPC consulting solutions'),
  (1, 'EPC project management consultants'), (1, 'EPC consulting specialists'), (1, 'Top EPC consultants'),
  (1, 'EPC consulting firms'), (1, 'EPC advisory and consulting'), (1, 'EPC implementation consultants'),
  (1, 'Comprehensive EPC consultancy'), (1, 'EPC management advisory'), (1, 'Specialized ECPM consultancy'),
  (1, 'EPC strategy consulting'), (1, 'Custom EPC consulting solutions'), (1, 'Engineering consultancy'),
  (1, 'Engineering, Procurement, and Construction Management consultant'),
  (1, 'Consultation for Engineering, Procurement, and Construction Management'),
  (2, 'Calgary engineering company'), (2, 'Calgary EPC Services'), (2, 'Engineering companies calgary'),
  (2, 'Engineering firms calgary'), (2, 'Calgary engineering companies'), (2, 'Calgary alberta canada'),
  (2, 'Calgary project management consulting'), (2, 'Pipeline engineering specialists in Alberta'),
  (3, 'Construction management'), (3, 'Project management in construction'),
  (3, 'Building construction project management'), (3, 'Construction project management'),
  (3, 'Agile project management'), (3, 'Construction and Project Management'), (3, 'Project coordinator'),
  (3, 'Project planner'), (3, 'Project development plan'), (3, 'Cost control'), (3, 'Audit'), (3, 'Claims'),
  (3, 'Interim project controls management'),
  (4, 'Civil engineering'), (4, 'Structural engineer'), (4, 'Pipeline engineering specialists'),
  (4, 'Facilities engineering'), (4, 'Environmental engineering compliance'), (4, 'Industrial water engineering'),
  (4, 'Chemical engineering'),
  (5, 'EPC construction'), (5, 'EPC company'), (5, 'EPC engineering'), (5, 'EPC services'), (5, 'EPC contracting'),
  (5, 'EPC project'), (5, 'EPC engineering company'), (5, 'EPC companies oil and gas'), (5, 'EPC contracts'),
  (5, 'EPFC (Engineering, Procurement, Fabrication, and Construction)'), (5, 'Engineering consultants group'),
  (5, 'Integrated EPC solutions'), (5, 'Workface construction'),
  (6, 'Design build'), (6, 'Pre construction'), (6, 'Design'), (6, 'Carbon capture solutions'), (6, 'Procurement'),
  (6, 'SeeRem construction software'),
  (7, 'Pre-vetted EPCM specialists'), (7, 'Fractional engineer'), (7, 'Consultant'), (7, 'Agile expert network'),
  (7, 'Independent peer review engineering'), (7, 'CAPEX optimization services'), (7, 'EPC delivery'),
  (7, 'EPCMst expert network portal'), (7, 'Efficient EPC workflow solutions'), (7, 'EPC consultancy'),
  (7, 'Direct local engineering support')
) as k(sort_order, phrase)
join public.keyword_categories c on c.sort_order = k.sort_order;

-- ---------------------------------------------------------------------
-- 4. Articles: tags, extra keywords, and where the article came from
-- ---------------------------------------------------------------------
create type public.article_source as enum ('google_doc', 'ai_draft');

-- A tag is short lowercase text: letters, numbers, spaces, & and hyphens.
create function public.valid_tags(t text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(t), 0) <= 8
     and not exists (select 1 from unnest(t) as x where x is null or x !~ '^[a-z0-9][a-z0-9 &-]{1,29}$');
$$;

create function public.valid_secondary_keywords(k text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(k), 0) <= 2
     and not exists (select 1 from unnest(k) as x where x is null or char_length(btrim(x)) not between 2 and 80);
$$;

alter table public.articles
  add column tags text[] not null default '{}' check (public.valid_tags(tags)),
  add column secondary_keywords text[] not null default '{}' check (public.valid_secondary_keywords(secondary_keywords)),
  add column source public.article_source not null default 'google_doc';

comment on column public.articles.target_keyword is 'The primary target keyword. Up to two more live in secondary_keywords.';
comment on column public.articles.source is 'google_doc = imported from a Doc someone wrote; ai_draft = generated in the hub, then saved as a Doc.';

-- People may set the new content columns; source can be set when creating
-- an article but never changed afterwards.
grant insert (tags, secondary_keywords, source) on public.articles to authenticated;
grant update (tags, secondary_keywords) on public.articles to authenticated;

-- Existing articles: give each one a first tag from its service area and
-- fix the old /knowledge-hub/ addresses, without touching "last updated".
alter table public.articles disable trigger articles_set_updated_at;
update public.articles a set tags = array[s.slug]
  from public.service_areas s
  where a.service_area_id = s.id and cardinality(a.tags) = 0;
update public.articles set published_url = replace(published_url, '/knowledge-hub/', '/resources/')
  where published_url like '%/knowledge-hub/%';
alter table public.articles enable trigger articles_set_updated_at;
update public.publish_jobs set live_url = replace(live_url, '/knowledge-hub/', '/resources/')
  where live_url like '%/knowledge-hub/%';

-- ---------------------------------------------------------------------
-- 5. The blocking rules, with the two new ones
-- ---------------------------------------------------------------------
create or replace function public.article_blocking_problems(a public.articles)
returns text[]
language sql
stable
set search_path = ''
as $$
  select array_remove(array[
    case when a.title is null or char_length(btrim(a.title)) < 10 then 'Title must be at least 10 characters.' end,
    case when char_length(a.title) > 70 then 'Title must be 70 characters or fewer.' end,
    case when a.slug is null then 'Add a URL slug.' end,
    case when a.slug is not null and exists (
           select 1 from public.site_pages sp
           where sp.path = '/resources/' || a.slug and sp.article_id is distinct from a.id)
         then 'That URL is already used by a page on the live site.' end,
    case when a.meta_description is null or char_length(a.meta_description) < 70 then 'Meta description must be at least 70 characters.' end,
    case when char_length(a.meta_description) > 160 then 'Meta description must be 160 characters or fewer.' end,
    case when a.content_type_id is null then 'Choose a content type.' end,
    case when a.service_area_id is null then 'Choose a service area.' end,
    case when a.target_keyword is null or char_length(btrim(a.target_keyword)) < 2 then 'Add a target keyword.' end,
    case when cardinality(a.tags) < 1 then 'Add at least one tag.' end,
    case when a.author_name is null or btrim(a.author_name) = '' then 'Add an author.' end,
    case when a.publish_date is null then 'Add a publish date.' end,
    case when a.word_count < 1 then 'The article body is empty.' end
  ], null);
$$;

-- ---------------------------------------------------------------------
-- 6. Keyword coverage: how many articles target each library keyword
--    (as the main keyword or an extra one). Runs with the caller's own
--    permissions, so it can only count articles that person may see.
-- ---------------------------------------------------------------------
create function public.keyword_usage()
returns table (keyword_id integer, article_count bigint, published_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select k.id,
         count(a.id),
         count(a.id) filter (where a.status = 'published')
  from public.keywords k
  left join public.articles a
    on lower(btrim(a.target_keyword)) = lower(k.phrase)
    or exists (select 1 from unnest(a.secondary_keywords) as s where lower(btrim(s)) = lower(k.phrase))
  group by k.id;
$$;

revoke execute on function public.keyword_usage() from public, anon;
grant execute on function public.keyword_usage() to authenticated;

-- The articles behind one keyword's count, newest first.
create function public.articles_for_keyword(p_keyword_id integer)
returns table (id uuid, title text, status public.article_status, is_main boolean, updated_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.title, a.status,
         coalesce(lower(btrim(a.target_keyword)) = lower(k.phrase), false),
         a.updated_at
  from public.keywords k
  join public.articles a
    on lower(btrim(a.target_keyword)) = lower(k.phrase)
    or exists (select 1 from unnest(a.secondary_keywords) as s where lower(btrim(s)) = lower(k.phrase))
  where k.id = p_keyword_id
  order by a.updated_at desc
  limit 200;
$$;

revoke execute on function public.articles_for_keyword(integer) from public, anon;
grant execute on function public.articles_for_keyword(integer) to authenticated;
