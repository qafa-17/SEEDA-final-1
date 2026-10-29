-- Tests for 0010. Run after 0001, the three test users, 0002 to 0010.
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

-- Max = approver (…01), Pat = publisher (…02)
update public.profiles set role = 'approver' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Pat writes and submits an article; Max approves it.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
insert into public.articles (drive_file_id, title, slug, meta_description, content_type_id, service_area_id, target_keyword, publish_date, body_markdown, tags)
values ('docPUBLISH0001', 'Cost Control on Alberta Pipeline Projects', 'cost-control-alberta-pipelines',
        repeat('How owners keep pipeline budgets on track. ', 2), 1, 1, 'Cost control', '2026-11-01', 'Body text.', array['Cost Control']);
select public.change_article_status((select id from public.articles where drive_file_id = 'docPUBLISH0001'), 'in_review');
-- A publisher cannot publish.
select t_expect_error($$select public.start_publish((select id from public.articles where drive_file_id = 'docPUBLISH0001'))$$, array['42501'], 'publisher cannot publish');
reset role;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select t_expect_error($$select public.start_publish((select id from public.articles where drive_file_id = 'docPUBLISH0001'))$$, array['22023'], 'not approved yet');
select public.change_article_status((select id from public.articles where drive_file_id = 'docPUBLISH0001'), 'approved');

-- Writing the job table directly is not allowed; only through the functions.
select t_expect_error($$insert into public.publish_jobs (article_id) select id from public.articles limit 1$$, array['42501'], 'no direct insert');
select t_expect_error($$update public.publish_jobs set state = 'verified'$$, array['42501'], 'no direct update');
-- And Published can't be set through the normal workflow.
select t_expect_error($$select public.change_article_status((select id from public.articles where drive_file_id = 'docPUBLISH0001'), 'published')$$, array['22023'], 'no shortcut to published');

-- Start: one attempt at a time.
create temp table t_job as select (public.start_publish((select id from public.articles where drive_file_id = 'docPUBLISH0001'))).id;
select t_expect_error($$select public.start_publish((select id from public.articles where drive_file_id = 'docPUBLISH0001'))$$, array['55P03'], 'already being published');

-- Forward only, and links must look right.
select t_expect_error($$select public.update_publish_job((select id from t_job), 'merged')$$, array['22023'], 'cannot skip the pull request');
select t_expect_error($$select public.update_publish_job((select id from t_job), 'pr_open', 'publish/x', 3, 'https://evil.example/pull/3')$$, array['22023'], 'not a GitHub link');
select t_expect_error($$select public.update_publish_job((select id from t_job), 'pr_open', 'bad branch; drop', 3, null)$$, array['22023'], 'bad branch name');
select public.update_publish_job((select id from t_job), 'pr_open', 'publish/cost-control', 3, 'https://github.com/qafa-17/epcmst-demo-site/pull/3');

-- Can't finish before the merge.
select t_expect_error($$select public.finish_publish((select id from t_job), 'https://demo.example/resources/cost-control-alberta-pipelines', 200::smallint, true)$$, array['22023'], 'not merged yet');
select public.update_publish_job((select id from t_job), 'merged');

-- Can't finish unless the page is really live, at the article's own address.
select t_expect_error($$select public.finish_publish((select id from t_job), 'https://demo.example/resources/cost-control-alberta-pipelines', 404::smallint, true)$$, array['23514'], 'page not loading');
select t_expect_error($$select public.finish_publish((select id from t_job), 'https://demo.example/resources/cost-control-alberta-pipelines', 200::smallint, false)$$, array['23514'], 'not in sitemap');
select t_expect_error($$select public.finish_publish((select id from t_job), 'https://demo.example/resources/another-article', 200::smallint, true)$$, array['22023'], 'wrong address');
select t_expect_error($$select public.finish_publish((select id from t_job), 'http://demo.example/resources/cost-control-alberta-pipelines', 200::smallint, true)$$, array['22023'], 'https only');

select public.finish_publish((select id from t_job), 'https://demo.example/resources/cost-control-alberta-pipelines', 200::smallint, true);
do $$ begin
  assert (select status from public.articles where drive_file_id = 'docPUBLISH0001') = 'published', 'published';
  assert (select published_url from public.articles where drive_file_id = 'docPUBLISH0001') = 'https://demo.example/resources/cost-control-alberta-pipelines', 'link saved';
  assert (select state from public.publish_jobs where id = (select id from t_job)) = 'verified', 'job verified';
  assert exists (select 1 from public.article_events e join public.articles a on a.id = e.article_id where a.drive_file_id = 'docPUBLISH0001' and e.kind = 'published'), 'history';
  assert exists (select 1 from public.site_pages where path = '/resources/cost-control-alberta-pipelines' and article_id is not null), 'site page added';
  assert cardinality((select public.article_blocking_problems(a) from public.articles a where drive_file_id = 'docPUBLISH0001')) = 0, 'its own page does not block it';
end $$;
select t_expect_error($$select public.update_publish_job((select id from t_job), 'failed')$$, array['22023'], 'finished jobs are final');
select t_expect_error($$select public.start_publish((select id from public.articles where drive_file_id = 'docPUBLISH0001'))$$, array['22023'], 'already published');
-- Published is frozen: the edit matches no editable row.
update public.articles set title = 'Changed after publishing' where drive_file_id = 'docPUBLISH0001';
do $$ begin
  assert (select title from public.articles where drive_file_id = 'docPUBLISH0001') = 'Cost Control on Alberta Pipeline Projects', 'unchanged';
end $$;

-- A failure is recorded with its reason, and a new attempt can start.
insert into public.articles (drive_file_id, title, slug, meta_description, content_type_id, service_area_id, target_keyword, publish_date, body_markdown, tags)
values ('docPUBLISH0002', 'Second Article About Cost Control', 'second-article-cost-control',
        repeat('How owners keep pipeline budgets on track. ', 2), 1, 1, 'Cost control', '2026-11-02', 'Body text.', array['Cost Control']);
select public.change_article_status((select id from public.articles where drive_file_id = 'docPUBLISH0002'), 'in_review');
select public.change_article_status((select id from public.articles where drive_file_id = 'docPUBLISH0002'), 'approved');
create temp table t_job2 as select (public.start_publish((select id from public.articles where drive_file_id = 'docPUBLISH0002'))).id;
select public.update_publish_job((select id from t_job2), 'failed', null, null, null, 'The GitHub token was refused.');
do $$ begin
  assert (select error_message from public.publish_jobs where id = (select id from t_job2)) = 'The GitHub token was refused.', 'reason kept';
  assert (select status from public.articles where drive_file_id = 'docPUBLISH0002') = 'approved', 'still approved';
end $$;
select public.start_publish((select id from public.articles where drive_file_id = 'docPUBLISH0002'));
reset role;

-- Anonymous visitors can't call any of it.
set role anon;
select t_expect_error($$select public.start_publish(gen_random_uuid())$$, array['42501'], 'anon start');
select t_expect_error($$select public.finish_publish(gen_random_uuid(), 'https://x/resources/y', 200::smallint, true)$$, array['42501'], 'anon finish');
reset role;

\echo 0010 tests passed
