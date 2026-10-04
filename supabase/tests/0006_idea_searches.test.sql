-- Tests for 0006. Run after 0001, the three test users, 0002 to 0006.
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

-- Pat (publisher) runs two searches ------------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
insert into public.idea_searches (keyword, region, results, summary, ai_status)
values ('Cost control', 'alberta', '[{"title":"T","url":"https://example.com","snippet":"S"}]', '{"intent":"informational"}', 'ok');
insert into public.idea_searches (keyword, region, results, summary, ai_status, used_search)
values ('Cost control', 'alberta', '[]', null, 'failed', false);
do $$ begin
  assert (select count(*) from public.idea_searches) = 2, 'member reads searches';
  assert (select requested_by from public.idea_searches limit 1) = 'aaaaaaaa-0000-0000-0000-000000000002', 'recorded in own name';
  assert (select mine_today from public.idea_search_usage()) = 2, 'both count toward my day';
  assert (select team_this_month from public.idea_search_usage()) = 1, 'only real searches count toward the month';
end $$;

select t_expect_error($$insert into public.idea_searches (requested_by, keyword, region, results, ai_status) values ('aaaaaaaa-0000-0000-0000-000000000003', 'x y', 'alberta', '[]', 'failed')$$, array['42501'], 'cannot record a search in someone else''s name');
select t_expect_error($$insert into public.idea_searches (keyword, region, results, ai_status) values ('x y', 'ontario', '[]', 'failed')$$, array['23514'], 'unknown region');
select t_expect_error($$insert into public.idea_searches (keyword, region, results, ai_status) values ('x', 'alberta', '[]', 'failed')$$, array['23514'], 'keyword too short');
select t_expect_error($$insert into public.idea_searches (keyword, region, results, ai_status) values ('x y', 'alberta', '{}', 'failed')$$, array['23514'], 'results must be a list');
select t_expect_error($$insert into public.idea_searches (keyword, region, results, ai_status) values ('x y', 'alberta', '[]', 'ok')$$, array['23514'], 'ok needs a summary');
select t_expect_error($$insert into public.idea_searches (keyword, region, results, ai_status, created_at) values ('x y', 'alberta', '[]', 'failed', now() - interval '2 days')$$, array['42501'], 'cannot back-date a search');
select t_expect_error($$update public.idea_searches set keyword = 'changed'$$, array['42501'], 'cannot edit');
select t_expect_error($$delete from public.idea_searches$$, array['42501'], 'cannot delete (usage can''t be wound back)');
reset role;

-- Quinn sees Pat's research but has her own daily count -----------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.idea_searches) = 2, 'research is shared';
  assert (select mine_today from public.idea_search_usage()) = 0, 'own daily count';
  assert (select team_this_month from public.idea_search_usage()) = 1, 'team monthly count';
end $$;
reset role;

-- Newbie (pending) gets nothing ----------------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000004', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.idea_searches) = 0, 'pending cannot read';
  assert (select team_this_month from public.idea_search_usage()) = 0, 'pending sees no usage';
end $$;
select t_expect_error($$insert into public.idea_searches (keyword, region, results, ai_status) values ('x y', 'alberta', '[]', 'failed')$$, array['42501'], 'pending cannot add');
reset role;

set role anon;
select t_expect_error($$select 1 from public.idea_searches$$, array['42501'], 'anon read');
select t_expect_error($$select * from public.idea_search_usage()$$, array['42501'], 'anon usage');
reset role;

-- Leaving the team keeps the research.
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from public.idea_searches where requested_by is null) = 2, 'research kept, person cleared';
end $$;

\echo 0006 tests passed
