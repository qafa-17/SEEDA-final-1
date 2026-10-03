-- Tests for 0005. Run after 0001, the three test users, 0002, 0003, 0004, 0005.
\set ON_ERROR_STOP on
create or replace function t_expect_error(p_sql text, p_states text[], p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'EXPECTED FAILURE DID NOT HAPPEN: %', p_label;
exception when others then
  if sqlstate = 'P0001' and sqlerrm like 'EXPECTED FAILURE%' then raise; end if;
  if not (sqlstate = any(p_states)) then raise exception 'WRONG ERROR for %: % %', p_label, sqlstate, sqlerrm; end if;
end $$;
grant execute on function t_expect_error(text, text[], text) to anon, authenticated;

-- Max = approver (…01), Pat = publisher (…02), Newbie pending (…04)
update public.profiles set role = 'approver' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into auth.users (id, email, raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-000000000004', 'n@x.com', '{"full_name":"Newbie"}');

-- Reference data ------------------------------------------------------
do $$ begin
  assert (select count(*) from public.service_areas) = 12, 'twelve service areas';
  assert not exists (select 1 from public.service_areas where slug = 'management'), 'management renamed';
  assert not exists (
    select 1 from public.service_areas s
    where not exists (select 1 from public.site_pages p where p.path = '/services/' || s.slug)
  ), 'every service area is a real /services page';
  assert (select count(distinct sort_order) from public.service_areas) = 12, 'distinct sort order';
  assert (select count(*) from public.site_pages) = 27, 'site pages';
  assert (select count(*) from public.keyword_categories) = 7, 'keyword categories';
  assert (select count(*) from public.keywords) = 78, 'keywords';
  assert not exists (select 1 from public.keyword_categories c where not exists (select 1 from public.keywords k where k.category_id = c.id)), 'no empty category';
end $$;

-- Tag and keyword formats ----------------------------------------------
do $$ begin
  assert public.valid_tags('{}'), 'empty tags ok';
  assert public.valid_tags(array['epc', 'project controls', 'q&a', 'bill-c-5']), 'normal tags ok';
  assert not public.valid_tags(array['EPC']), 'uppercase tag refused';
  assert not public.valid_tags(array['a']), 'one-letter tag refused';
  assert not public.valid_tags(array['<script>']), 'markup tag refused';
  assert not public.valid_tags(array['ok', null]), 'null tag refused';
  assert not public.valid_tags(array['a1','a2','a3','a4','a5','a6','a7','a8','a9']), 'nine tags refused';
  assert public.valid_secondary_keywords(array['EPC services', 'Cost control']), 'two extra keywords ok';
  assert not public.valid_secondary_keywords(array['aa', 'bb', 'cc']), 'three extra keywords refused';
  assert not public.valid_secondary_keywords(array['x']), 'too-short keyword refused';
end $$;

-- Pat (publisher) -----------------------------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;

do $$ begin
  assert (select count(*) from public.site_pages) = 27, 'member reads site pages';
  assert (select count(*) from public.keywords) = 78, 'member reads keywords';
end $$;
select t_expect_error($$insert into public.site_pages (path, title, kind) values ('/x', 'X', 'page')$$, array['42501'], 'member cannot add site pages');
select t_expect_error($$update public.site_pages set title = 'Hacked'$$, array['42501'], 'member cannot edit site pages');
select t_expect_error($$delete from public.keywords$$, array['42501'], 'member cannot delete keywords');
select t_expect_error($$insert into public.keywords (category_id, phrase) values (1, 'spam')$$, array['42501'], 'member cannot add keywords');

-- An article that is complete except for tags.
insert into public.articles (drive_file_id, title, slug, meta_description, content_type_id, service_area_id, target_keyword, author_name, publish_date, body_markdown, source)
values ('docPATscope001', 'Cost Control on Alberta Pipeline Projects', 'cost-control-alberta-pipeline-projects',
        repeat('How owners keep pipeline budgets on track. ', 2), 1, 1, 'Cost control', 'Pat', '2026-11-01', 'Body.', 'ai_draft');
do $$ begin
  assert (select public.article_blocking_problems(a) from public.articles a where drive_file_id = 'docPATscope001')
         = array['Add at least one tag.'], 'only the tag is missing';
end $$;
select t_expect_error($$select public.change_article_status((select id from public.articles where drive_file_id='docPATscope001'), 'in_review')$$,
  array['23514'], 'cannot submit without a tag');

-- Bad values are refused by the table itself.
select t_expect_error($$update public.articles set tags = array['Not Lowercase'] where drive_file_id='docPATscope001'$$, array['23514'], 'bad tag');
select t_expect_error($$update public.articles set secondary_keywords = array['aa','bb','cc'] where drive_file_id='docPATscope001'$$, array['23514'], 'too many keywords');
-- Where an article came from can't be rewritten later.
select t_expect_error($$update public.articles set source = 'google_doc' where drive_file_id='docPATscope001'$$, array['42501'], 'source is fixed');

-- A slug that is already a page on the live site blocks submission.
update public.articles set tags = array['pipeline-engineering', 'cost control'], secondary_keywords = array['EPC project'],
  slug = 'the-untapped-potential-how-ai-can-revolutionize-epc-risk-management'
  where drive_file_id = 'docPATscope001';
do $$ begin
  assert (select public.article_blocking_problems(a) from public.articles a where drive_file_id = 'docPATscope001')
         = array['That URL is already used by a page on the live site.'], 'reserved URL';
end $$;
select t_expect_error($$select public.change_article_status((select id from public.articles where drive_file_id='docPATscope001'), 'in_review')$$,
  array['23514'], 'cannot submit a URL the live site already has');

-- Fixed: now it goes through.
update public.articles set slug = 'cost-control-alberta-pipeline-projects' where drive_file_id = 'docPATscope001';
select public.change_article_status((select id from public.articles where drive_file_id='docPATscope001'), 'in_review');
do $$ begin
  assert (select status from public.articles where drive_file_id = 'docPATscope001') = 'in_review', 'submitted';
  assert (select source from public.articles where drive_file_id = 'docPATscope001') = 'ai_draft', 'source kept';
end $$;
-- Keyword coverage counts the main keyword and the extra one, once each.
do $$ begin
  assert (select article_count from public.keyword_usage() u join public.keywords k on k.id = u.keyword_id where k.phrase = 'Cost control') = 1, 'main keyword counted';
  assert (select article_count from public.keyword_usage() u join public.keywords k on k.id = u.keyword_id where k.phrase = 'EPC project') = 1, 'extra keyword counted';
  assert (select published_count from public.keyword_usage() u join public.keywords k on k.id = u.keyword_id where k.phrase = 'Cost control') = 0, 'not published yet';
  assert (select count(*) from public.keyword_usage()) = 78, 'one row per keyword';
  assert (select sum(article_count) from public.keyword_usage()) = 2, 'nothing else counted';
  assert (select count(*) from public.articles_for_keyword((select id from public.keywords where phrase = 'Cost control'))) = 1, 'articles for a keyword';
  assert (select is_main from public.articles_for_keyword((select id from public.keywords where phrase = 'Cost control'))), 'main keyword flagged';
  assert not (select is_main from public.articles_for_keyword((select id from public.keywords where phrase = 'EPC project'))), 'extra keyword flagged';
end $$;
reset role;

-- The page an article was itself published to does not block that article.
insert into public.site_pages (path, title, kind, article_id)
select '/resources/' || slug, title, 'resource', id from public.articles where drive_file_id = 'docPATscope001';
do $$ begin
  assert (select cardinality(public.article_blocking_problems(a)) from public.articles a where drive_file_id = 'docPATscope001') = 0, 'own page is fine';
end $$;

-- Newbie (pending) sees nothing ----------------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000004', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.site_pages) = 0, 'pending cannot read site pages';
  assert (select count(*) from public.keywords) = 0, 'pending cannot read keywords';
  assert (select count(*) from public.keyword_categories) = 0, 'pending cannot read categories';
  assert (select count(*) from public.keyword_usage()) = 0, 'pending gets no keyword coverage';
  assert (select count(*) from public.articles_for_keyword(1)) = 0, 'pending gets no keyword articles';
end $$;
reset role;

-- Signed-out visitors have no access at all ----------------------------
set role anon;
select t_expect_error($$select 1 from public.site_pages$$, array['42501'], 'anon site pages');
select t_expect_error($$select 1 from public.keywords$$, array['42501'], 'anon keywords');
select t_expect_error($$select * from public.keyword_usage()$$, array['42501'], 'anon keyword coverage');
reset role;

\echo 0005 tests passed
