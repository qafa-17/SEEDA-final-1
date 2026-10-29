-- Tests for 0009. Run after 0001, the three test users, 0002 to 0009.
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

insert into auth.users (id, email, raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-000000000004', 'n@x.com', '{"full_name":"Newbie"}');

-- Reference data ------------------------------------------------------
do $$ begin
  assert (select count(*) from public.keywords) = 91, '13 keywords added';
  assert exists (select 1 from public.keywords where phrase = 'Worksite management services Alberta' and status = 'active' and added_by is null), 'added by the database';
  assert exists (select 1 from public.site_pages where path = '/resources/managing-capex-risks-2026-procurement-specialists'), 'CAPEX article listed';
end $$;

-- Tags ---------------------------------------------------------------
do $$ begin
  assert public.valid_tags(array['CAPEX Risk', 'EPC Procurement', 'Bill C-5', 'Western Canada', 'U.S. Gulf Coast']), 'site-style tags ok';
  assert public.valid_tags(array['epc', 'cost control']), 'lowercase still ok';
  assert public.valid_tags('{}'), 'no tags ok';
  assert not public.valid_tags(array['EPC', 'epc']), 'same tag twice in different case';
  assert not public.valid_tags(array['<b>bold</b>']), 'markup refused';
  assert not public.valid_tags(array['-leading']), 'must start with a letter or number';
  assert not public.valid_tags(array['ok', null]), 'null refused';
end $$;

-- Pat (publisher) ----------------------------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;

-- An AI draft needs no Doc; an imported one still does.
insert into public.articles (title, body_markdown, source, tags) values ('An AI draft about cost control', 'Body.', 'ai_draft', array['CAPEX Risk']);
select t_expect_error($$insert into public.articles (title, body_markdown) values ('No doc and not AI', 'Body.')$$, array['23514'], 'imported article needs a Doc');
do $$ begin
  assert (select count(*) from public.articles where source = 'ai_draft' and drive_file_id is null) = 1, 'AI draft saved';
end $$;

insert into public.idea_searches (keyword, region, results, ai_status) values ('Cost control', 'alberta', '[]', 'failed');
insert into public.draft_requests (kind, search_id, headlines, status)
  select 'headlines', id, '[{"title":"T"}]', 'ok' from public.idea_searches limit 1;
insert into public.draft_requests (kind, article_id, status)
  select 'draft', id, 'ok' from public.articles where source = 'ai_draft';
insert into public.draft_requests (kind, status) values ('draft', 'failed');
do $$ begin
  assert (select headlines_today from public.draft_request_usage()) = 1, 'headline requests counted';
  assert (select drafts_today from public.draft_request_usage()) = 2, 'failed drafts count too';
  assert (select drafts_this_month from public.draft_request_usage()) = 2, 'team month';
  assert (select requested_by from public.draft_requests limit 1) = 'aaaaaaaa-0000-0000-0000-000000000002', 'own name';
end $$;

select t_expect_error($$insert into public.draft_requests (requested_by, kind, status) values ('aaaaaaaa-0000-0000-0000-000000000003', 'draft', 'ok')$$, array['42501'], 'not in someone else''s name');
select t_expect_error($$insert into public.draft_requests (kind, status, created_at) values ('draft', 'ok', now() - interval '2 days')$$, array['42501'], 'cannot back-date');
select t_expect_error($$insert into public.draft_requests (kind, headlines, status) values ('draft', '[]', 'ok')$$, array['23514'], 'only headline requests keep headlines');
select t_expect_error($$insert into public.draft_requests (kind, status) values ('summary', 'ok')$$, array['23514'], 'unknown kind');
select t_expect_error($$update public.draft_requests set status = 'failed'$$, array['42501'], 'cannot edit');
select t_expect_error($$delete from public.draft_requests$$, array['42501'], 'cannot delete');

-- Deleting the draft keeps the log, so the allowance still counts it.
delete from public.articles where source = 'ai_draft';
do $$ begin
  assert (select drafts_today from public.draft_request_usage()) = 2, 'deleted draft still counted';
end $$;
reset role;

-- Quinn: shared log, own daily count ----------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.draft_requests) = 3, 'shared';
  assert (select drafts_today from public.draft_request_usage()) = 0, 'own day';
  assert (select drafts_this_month from public.draft_request_usage()) = 2, 'team month';
end $$;
reset role;

-- Pending and signed-out ----------------------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000004', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.draft_requests) = 0, 'pending reads nothing';
  assert (select drafts_this_month from public.draft_request_usage()) = 0, 'pending sees no usage';
end $$;
select t_expect_error($$insert into public.draft_requests (kind, status) values ('draft', 'ok')$$, array['42501'], 'pending cannot add');
reset role;
set role anon;
select t_expect_error($$select 1 from public.draft_requests$$, array['42501'], 'anon');
select t_expect_error($$select * from public.draft_request_usage()$$, array['42501'], 'anon usage');
reset role;

\echo 0009 tests passed
