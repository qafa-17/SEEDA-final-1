-- Run after loading all seed parts. Every assertion must hold.
\set ON_ERROR_STOP on
do $$
declare bad int;
begin
  assert (select count(*) from public.articles where drive_file_id like 'seed\_%') = 150, 'article count';
  -- Every non-draft passes the same blocking rules the database enforces at submit.
  select count(*) into bad from public.articles a where a.status <> 'draft' and cardinality(public.article_blocking_problems(a)) > 0;
  assert bad = 0, 'non-drafts with blocking problems: ' || bad;
  assert (select count(*) from public.articles a where a.status = 'draft' and cardinality(public.article_blocking_problems(a)) > 0) > 20, 'drafts with problems exist';
  -- Status fields agree with status
  assert not exists (select 1 from public.articles where status = 'published' and (published_at is null or approved_by is null or published_url is null)), 'published fields';
  assert not exists (select 1 from public.articles where status in ('draft') and (approved_by is not null or published_at is not null)), 'draft fields';
  -- History: starts with created, ends at the current status, never in the future, in time order
  assert not exists (select 1 from public.articles a where (select e.to_status from public.article_events e where e.article_id = a.id order by e.created_at desc, e.id desc limit 1) <> a.status), 'last event matches status';
  assert not exists (select 1 from public.articles a where (select e.kind from public.article_events e where e.article_id = a.id order by e.created_at, e.id limit 1) <> 'created'), 'first event is created';
  assert not exists (select 1 from public.article_events where created_at > now()), 'no future events';
  assert (select count(*) from public.article_checks) = 1050, 'checks';
  assert (select count(*) from public.profiles where access = 'pending') >= 1, 'a pending person for the Team badge';
  assert not exists (select 1 from public.articles where owner_id is null and drive_file_id like 'seed\_%'), 'every seeded article has an owner';
end $$;
select 'SEED CHECKS PASSED' as result;
