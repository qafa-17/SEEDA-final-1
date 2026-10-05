-- Tests for 0007. Run after 0001, the three test users, 0002 to 0007.
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
create or replace function t_rows(p_sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
grant execute on function t_expect_error(text, text[], text), t_rows(text) to anon, authenticated;

-- Max = approver (…01), Pat = publisher (…02), Newbie pending (…04)
update public.profiles set role = 'approver' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into auth.users (id, email, raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-000000000004', 'n@x.com', '{"full_name":"Newbie"}');

do $$ begin
  assert (select count(*) from public.content_types) = 7, 'seven content types';
  assert (select count(*) from public.keywords where status = 'active' and added_by is null) = 78, 'original list is active and unowned';
end $$;

-- Pat (publisher): may suggest, nothing else ----------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
insert into public.keywords (category_id, phrase, status) values (1, '  Owner''s   engineer  ', 'suggested');
do $$ begin
  assert (select count(*) from public.keywords where phrase = 'Owner''s engineer' and status = 'suggested'
          and added_by = 'aaaaaaaa-0000-0000-0000-000000000002') = 1, 'suggestion saved, tidied, in own name';
  -- New articles get the team byline without anyone typing it.
  insert into public.articles (drive_file_id, title) values ('docPATbyline0001', 'Byline check');
  assert (select author_name from public.articles where drive_file_id = 'docPATbyline0001') = 'EPCMst Team', 'default byline';
end $$;
select t_expect_error($$insert into public.keywords (category_id, phrase, status) values (1, 'Sneaky active', 'active')$$, array['42501'], 'publisher cannot add directly');
select t_expect_error($$insert into public.keywords (category_id, phrase) values (1, 'Sneaky default')$$, array['42501'], 'publisher cannot rely on the default status');
select t_expect_error($$insert into public.keywords (category_id, phrase, status, added_by) values (1, 'As someone else', 'suggested', 'aaaaaaaa-0000-0000-0000-000000000003')$$, array['42501'], 'cannot suggest in another name');
select t_expect_error($$insert into public.keywords (category_id, phrase, status) values (1, 'cost CONTROL', 'suggested')$$, array['23505'], 'duplicate of an existing keyword, any capitalisation');
select t_expect_error($$insert into public.keywords (category_id, phrase, status) values (1, 'Bad status', 'approved')$$, array['23514', '42501'], 'unknown status');
do $$ begin
  assert t_rows($q$update public.keywords set status = 'active' where phrase = 'Owner''s engineer'$q$) = 0, 'publisher cannot approve own suggestion';
  assert t_rows($q$delete from public.keywords where phrase = 'Claims'$q$) = 0, 'publisher cannot remove keywords';
end $$;
select t_expect_error($$update public.keywords set phrase = 'Rewritten' where id = 1$$, array['42501'], 'nobody rewrites a phrase');
reset role;

-- Max (approver): adds, approves, removes --------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
insert into public.keywords (category_id, phrase, status) values (2, 'Edmonton engineering firms', 'active');
do $$ begin
  assert t_rows($q$update public.keywords set status = 'active' where phrase = 'Owner''s engineer'$q$) = 1, 'approver accepts a suggestion';
  assert (select count(*) from public.keywords where status = 'active') = 80, 'both are now on the list';
  assert t_rows($q$delete from public.keywords where phrase = 'Edmonton engineering firms'$q$) = 1, 'approver removes a keyword';
end $$;
select t_expect_error($$update public.keywords set phrase = 'Rewritten' where id = 1$$, array['42501'], 'approver cannot rewrite a phrase either');

-- New research areas are accepted; unknown ones still are not.
insert into public.idea_searches (keyword, region, results, ai_status) values ('EPC services', 'us-gulf-coast', '[]', 'failed');
select t_expect_error($$insert into public.idea_searches (keyword, region, results, ai_status) values ('EPC services', 'ontario', '[]', 'failed')$$, array['23514'], 'unknown region');
reset role;

-- Newbie (pending) and signed-out visitors: nothing ----------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000004', false);
set role authenticated;
select t_expect_error($$insert into public.keywords (category_id, phrase, status) values (1, 'From a pending user', 'suggested')$$, array['42501'], 'pending cannot suggest');
reset role;
set role anon;
select t_expect_error($$insert into public.keywords (category_id, phrase, status) values (1, 'From nobody', 'suggested')$$, array['42501'], 'anon cannot suggest');
reset role;

\echo 0007 tests passed
