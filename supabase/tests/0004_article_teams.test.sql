-- Tests for 0004. Run after 0001, the three test users, 0002, 0003, 0004.
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

-- Max = approver (…01), Pat = publisher (…02), Quinn = publisher (…03), Newbie pending (…04)
update public.profiles set role = 'approver' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into auth.users (id, email, raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-000000000004', 'n@x.com', '{"full_name":"Newbie"}');

-- Pat writes an article, Max requests changes then approves it.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
insert into public.articles (drive_file_id, title, slug, meta_description, content_type_id, service_area_id, target_keyword, author_name, publish_date, body_markdown)
values ('docPATteam001', 'Winter Logistics for Northern Mine Sites', 'winter-logistics-northern-mine-sites',
        repeat('Planning winter supply runs for northern mines. ', 2), 1, 3, 'winter logistics', 'Pat', '2026-11-01', 'Body.');
select public.change_article_status((select id from public.articles where drive_file_id='docPATteam001'), 'in_review');
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select public.change_article_status((select id from public.articles where drive_file_id='docPATteam001'), 'draft', 'Add a section on ice roads.');
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
select public.change_article_status((select id from public.articles where drive_file_id='docPATteam001'), 'in_review');
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select public.change_article_status((select id from public.articles where drive_file_id='docPATteam001'), 'approved');
reset role;

-- Quinn writes a separate article, alone.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
set role authenticated;
insert into public.articles (drive_file_id, title) values ('docQUINNsolo1', 'Quinn solo draft');
reset role;

-- Pat sees only Pat's article team: Pat (owner) + Max (approved, strongest part).
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
do $$ begin
  assert (select count(distinct article_id) from public.article_teams()) = 1, 'publisher sees only own teams';
  assert (select part from public.article_teams() where full_name = 'Pat') = 'owner', 'Pat is owner';
  assert (select part from public.article_teams() where full_name = 'Max') = 'approved', 'Max strongest part is approved';
  assert not exists (select 1 from public.article_teams() where title = 'Quinn solo draft'), 'cannot see Quinn team';
end $$;
reset role;

-- Quinn sees only Quinn's team, and is not shown Pat's.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.article_teams()) = 1, 'Quinn sees one team of one';
  assert not exists (select 1 from public.article_teams() where full_name in ('Pat','Max')), 'Quinn does not see Pat or Max';
end $$;
reset role;

-- The approver sees every team.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
do $$ begin assert (select count(distinct article_id) from public.article_teams()) = 2, 'approver sees all teams'; end $$;
reset role;

-- Pending users and visitors get nothing.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000004', false);
set role authenticated;
select t_expect_error('select * from public.article_teams()', array['42501'], 'pending user');
reset role;
set role anon;
select t_expect_error('select * from public.article_teams()', array['42501'], 'anon');
reset role;

-- A deleted member drops out of the team, the article stays.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
select public.delete_own_account();
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
do $$ begin
  assert not exists (select 1 from public.article_teams() where full_name = 'Pat'), 'deleted member gone from teams';
  assert exists (select 1 from public.article_teams() where title = 'Winter Logistics for Northern Mine Sites'), 'article team remains';
end $$;
reset role;

select 'ALL TEAM TESTS PASSED' as result;
