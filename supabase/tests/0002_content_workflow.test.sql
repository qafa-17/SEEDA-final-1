-- Tests for 0002_content_workflow.sql. Run after supabase_stub.sql and 0001.
-- Users are created BEFORE 0002 runs (so they start active), see run order in README.
\set ON_ERROR_STOP on

-- Helpers (test database only) ---------------------------------------
create or replace function t_expect_error(p_sql text, p_states text[], p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'EXPECTED FAILURE DID NOT HAPPEN: %', p_label;
exception when others then
  if sqlstate = 'P0001' and sqlerrm like 'EXPECTED FAILURE%' then raise; end if;
  if not (sqlstate = any(p_states)) then
    raise exception 'WRONG ERROR for %: % %', p_label, sqlstate, sqlerrm;
  end if;
end $$;
create or replace function t_rows(p_sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
grant execute on function t_expect_error(text, text[], text), t_rows(text) to anon, authenticated;

-- Fixed ids
\set APPROVER '''aaaaaaaa-0000-0000-0000-000000000001'''
\set PUB      '''aaaaaaaa-0000-0000-0000-000000000002'''
\set PUB2     '''aaaaaaaa-0000-0000-0000-000000000003'''
\set NEWBIE   '''aaaaaaaa-0000-0000-0000-000000000004'''

update public.profiles set role = 'approver' where id = :APPROVER;
-- A brand-new sign-up after 0002: starts pending.
insert into auth.users (id, email, raw_user_meta_data) values (:NEWBIE, 'n@x.com', '{"full_name":"Newbie"}');
do $$ begin
  assert (select access from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000004') = 'pending', 'new sign-ups start pending';
  assert (select access from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000002') = 'active', 'existing users became active';
  assert (select count(*) from public.content_types) = 3 and (select count(*) from public.service_areas) = 4, 'lookups seeded';
end $$;

-- 1. Anonymous visitor ------------------------------------------------
set role anon;
select t_expect_error('select * from public.articles', array['42501'], 'anon reads articles');
select t_expect_error('select public.change_article_status(gen_random_uuid(), ''approved'')', array['42501'], 'anon calls workflow');
reset role;

-- 2. Pending user: sees only themselves, can do nothing ------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000004', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'pending user sees only own profile';
  assert (select count(*) from public.content_types) = 0, 'pending user sees no lookups';
end $$;
select t_expect_error($q$insert into public.articles (drive_file_id) values ('pendingdoc123')$q$, array['42501'], 'pending inserts article');
select t_expect_error($q$select public.set_member_access('aaaaaaaa-0000-0000-0000-000000000004','active')$q$, array['42501'], 'pending approves self');
reset role;

-- 3. Approver manages the team ---------------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select public.set_member_access('aaaaaaaa-0000-0000-0000-000000000004', 'active');
select t_expect_error($q$select public.set_member_access('aaaaaaaa-0000-0000-0000-000000000001','disabled')$q$, array['42501'], 'approver disables self');
select t_expect_error($q$select public.set_member_role('aaaaaaaa-0000-0000-0000-000000000001','publisher')$q$, array['42501'], 'approver demotes self');
select t_expect_error($q$update public.profiles set access='active' where id='aaaaaaaa-0000-0000-0000-000000000004'$q$, array['42501'], 'direct access update');
do $$ begin
  assert (select count(*) from public.list_team()) = 4, 'approver lists team';
  assert (select email from public.list_team() where full_name='Newbie') = 'n@x.com', 'approver sees emails';
end $$;
reset role;
do $$ begin assert (select access from public.profiles where id='aaaaaaaa-0000-0000-0000-000000000004')='active', 'newbie approved'; end $$;

-- Publisher cannot manage the team
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
select t_expect_error($q$select public.set_member_role('aaaaaaaa-0000-0000-0000-000000000003','approver')$q$, array['42501'], 'publisher promotes other');
select t_expect_error($q$select * from public.list_team()$q$, array['42501'], 'publisher lists emails');

-- 4. Publisher creates a draft -----------------------------------------
insert into public.articles (drive_file_id, title, body_markdown) values ('docPUB0000001', 'Short', 'one two  three');
select t_expect_error($q$insert into public.articles (drive_file_id, status) values ('docPUB0000002','approved')$q$, array['42501'], 'insert with status');
select t_expect_error($q$insert into public.articles (drive_file_id, owner_id) values ('docPUB0000003','aaaaaaaa-0000-0000-0000-000000000003')$q$, array['42501'], 'insert as someone else');
select t_expect_error($q$insert into public.articles (drive_file_id) values ('docPUB0000001')$q$, array['23505'], 'same doc twice');
select t_expect_error($q$insert into public.articles (drive_file_id) values ('bad id!')$q$, array['23514'], 'bad drive id');
select t_expect_error($q$update public.articles set slug='Not A Slug' where drive_file_id='docPUB0000001'$q$, array['23514'], 'bad slug format');
select t_expect_error($q$update public.articles set status='approved' where drive_file_id='docPUB0000001'$q$, array['42501'], 'direct status update');
do $$ begin
  assert (select owner_id from public.articles where drive_file_id='docPUB0000001') = 'aaaaaaaa-0000-0000-0000-000000000002', 'owner set automatically';
  assert (select word_count from public.articles where drive_file_id='docPUB0000001') = 3, 'word count';
  assert (select count(*) from public.article_events) = 1, 'created event logged';
end $$;
select t_expect_error($q$insert into public.article_events (article_id, kind, to_status) select id,'approved','approved' from public.articles limit 1$q$, array['42501'], 'forge history');
reset role;

-- PUB2 has a draft of their own
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
set role authenticated;
insert into public.articles (drive_file_id, title) values ('docPUB2000001', 'Other person');
do $$ begin
  assert t_rows($q$update public.articles set title='hijack' where drive_file_id='docPUB0000001'$q$) = 0, 'cannot edit others draft';
  assert t_rows($q$delete from public.articles where drive_file_id='docPUB0000001'$q$) = 0, 'cannot delete others draft';
  assert (select count(*) from public.articles) = 2, 'shared board: sees all';
end $$;
select t_expect_error($q$insert into public.article_checks (article_id, rule_key, result, message) select id,'has_h2','pass','ok' from public.articles where drive_file_id='docPUB0000001'$q$, array['42501'], 'write checks on others draft');
reset role;

-- 5. Submit: blocked until complete ------------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
select t_expect_error($q$select public.change_article_status((select id from public.articles where drive_file_id='docPUB0000001'),'in_review')$q$, array['23514'], 'submit incomplete');
insert into public.article_checks (article_id, rule_key, result, message) select id,'has_h2','warn','No subheading yet.' from public.articles where drive_file_id='docPUB0000001';
update public.articles set
  title = 'Modular Construction for Remote Mine Sites',
  slug = 'modular-construction-remote-mine-sites',
  meta_description = 'How modular construction cuts schedule risk and camp costs on remote Alberta mine sites, with lessons from recent EPCM projects.',
  content_type_id = (select id from public.content_types where slug='technical-insight'),
  service_area_id = (select id from public.service_areas where slug='construction'),
  target_keyword = 'modular construction', author_name = 'EPCMst Team', publish_date = '2026-10-15',
  body_markdown = '## Why modular' || repeat(' word', 400)
where drive_file_id='docPUB0000001';
select t_expect_error($q$select public.change_article_status((select id from public.articles where drive_file_id='docPUB0000001'),'approved')$q$, array['22023'], 'skip review');
select public.change_article_status((select id from public.articles where drive_file_id='docPUB0000001'), 'in_review');
-- Now frozen for edits and deletes
do $$ begin
  assert t_rows($q$update public.articles set title='Edited after submit, should not stick' where drive_file_id='docPUB0000001'$q$) = 0, 'in-review is frozen';
  assert t_rows($q$delete from public.articles where drive_file_id='docPUB0000001'$q$) = 0, 'cannot delete in review';
end $$;
select t_expect_error($q$select public.change_article_status((select id from public.articles where drive_file_id='docPUB0000001'),'approved')$q$, array['42501'], 'publisher approves');
reset role;

-- 6. Approver: request changes needs a reason --------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select t_expect_error($q$select public.change_article_status((select id from public.articles where drive_file_id='docPUB0000001'),'draft')$q$, array['23502'], 'request changes without reason');
select public.change_article_status((select id from public.articles where drive_file_id='docPUB0000001'), 'draft', 'Add a section on winter logistics.');
reset role;

-- Publisher resubmits, approver approves
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
select public.change_article_status((select id from public.articles where drive_file_id='docPUB0000001'), 'in_review');
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select public.change_article_status((select id from public.articles where drive_file_id='docPUB0000001'), 'approved');
select t_expect_error($q$select public.change_article_status((select id from public.articles where drive_file_id='docPUB0000001'),'published')$q$, array['22023'], 'publish via workflow fn');
do $$ begin
  assert t_rows($q$update public.articles set title='Approver edit after approval' where drive_file_id='docPUB0000001'$q$) = 0, 'approved is frozen even for approver';
end $$;

-- Self-approval: allowed, and recorded
insert into public.articles (drive_file_id, title, slug, meta_description, content_type_id, service_area_id, target_keyword, author_name, publish_date, body_markdown)
select 'docAPPROVER01', 'Procurement Risk in Long-Lead Equipment', 'procurement-risk-long-lead-equipment',
       repeat('Long-lead equipment drives schedule risk. ', 3), 1, 2, 'long-lead equipment', 'Max', '2026-11-01', 'Body text here.';
select public.change_article_status((select id from public.articles where drive_file_id='docAPPROVER01'), 'in_review');
select public.change_article_status((select id from public.articles where drive_file_id='docAPPROVER01'), 'approved');
reset role;

do $$
declare kinds text;
begin
  select string_agg(kind::text, ',' order by id) into kinds from public.article_events
    where article_id = (select id from public.articles where drive_file_id='docPUB0000001');
  assert kinds = 'created,submitted,changes_requested,submitted,approved', 'history: ' || kinds;
  assert (select note from public.article_events where kind='changes_requested') = 'Add a section on winter logistics.', 'reason stored';
  assert (select approved_by from public.articles where drive_file_id='docAPPROVER01') = 'aaaaaaaa-0000-0000-0000-000000000001', 'self-approval recorded';
  assert (select title from public.articles where drive_file_id='docPUB0000001') = 'Modular Construction for Remote Mine Sites', 'frozen title unchanged';
end $$;

-- 7. Owner reopens an approved article (needs a reason) -----------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
select t_expect_error($q$select public.change_article_status((select id from public.articles where drive_file_id='docPUB0000001'),'draft','  ')$q$, array['23502'], 'reopen with blank reason');
select public.change_article_status((select id from public.articles where drive_file_id='docPUB0000001'), 'draft', 'Client sent new figures.');
do $$ begin
  assert (select approved_by is null and status='draft' from public.articles where drive_file_id='docPUB0000001'), 'approval cleared on reopen';
end $$;
reset role;

-- 8. Disabled user loses everything -------------------------------------
update public.profiles set access='disabled' where id='aaaaaaaa-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
set role authenticated;
do $$ begin assert (select count(*) from public.articles) = 0, 'disabled sees nothing'; end $$;
reset role;

-- 9. Owners with articles can't be deleted by accident -------------------
select t_expect_error($q$delete from auth.users where id='aaaaaaaa-0000-0000-0000-000000000002'$q$, array['23503'], 'delete owner with articles');

select 'ALL WORKFLOW TESTS PASSED' as result;
