-- Tests for 0003. Run after 0001, the three test users, 0002, and 0003.
\set ON_ERROR_STOP on

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
grant execute on function t_expect_error(text, text[], text) to anon, authenticated;

update public.profiles set role = 'approver' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Pat (publisher) owns a draft and a submitted article
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
insert into public.articles (drive_file_id, title) values ('docPATdraft01', 'Pat draft');
insert into public.articles (drive_file_id, title, slug, meta_description, content_type_id, service_area_id, target_keyword, author_name, publish_date, body_markdown)
values ('docPATreview1', 'Winter Logistics for Northern Mine Sites', 'winter-logistics-northern-mine-sites',
        repeat('Planning winter supply runs for northern mines. ', 2), 1, 3, 'winter logistics', 'Pat', '2026-11-01', 'Body.');
select public.change_article_status((select id from public.articles where drive_file_id = 'docPATreview1'), 'in_review');
reset role;

-- Anonymous visitor cannot call it
set role anon;
select t_expect_error('select public.delete_own_account()', array['42501'], 'anon deletes');
reset role;

-- The only approver cannot delete themselves
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select t_expect_error('select public.delete_own_account()', array['P0001'], 'last approver deletes');
reset role;

-- Pat deletes their account
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
set role authenticated;
select public.delete_own_account();
reset role;

do $$ begin
  assert not exists (select 1 from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'auth user removed';
  assert not exists (select 1 from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'profile removed';
  assert (select count(*) from public.articles where drive_file_id in ('docPATdraft01','docPATreview1') and owner_id is null) = 2, 'articles kept, owner emptied';
  assert (select count(*) from public.article_events where actor_id is null and kind in ('created','submitted')) >= 3, 'history kept, actor emptied';
end $$;

-- The same email can sign up again
insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'p@x.com', '{"full_name":"Pat again"}');
do $$ begin
  assert (select access from public.profiles where full_name = 'Pat again') = 'pending', 'returning person starts pending';
  assert not exists (select 1 from public.articles where owner_id = (select id from public.profiles where full_name = 'Pat again')), 'old articles not handed back';
end $$;

-- A publisher cannot act on an ownerless article (the null-owner fix)
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
set role authenticated;
select t_expect_error($q$select public.change_article_status((select id from public.articles where drive_file_id='docPATdraft01'),'in_review')$q$, array['42501'], 'publisher submits ownerless draft');
select t_expect_error($q$select public.change_article_status((select id from public.articles where drive_file_id='docPATreview1'),'draft')$q$, array['42501'], 'publisher withdraws ownerless article');
do $$ begin
  assert (select count(*) from public.articles where drive_file_id = 'docPATdraft01') = 1, 'publisher sees ownerless article';
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
set role authenticated;
update public.articles set title = 'hijack' where drive_file_id = 'docPATdraft01';
reset role;
do $$ begin assert (select title from public.articles where drive_file_id = 'docPATdraft01') = 'Pat draft', 'publisher cannot edit ownerless draft'; end $$;

-- The approver can still act on it
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select public.change_article_status((select id from public.articles where drive_file_id='docPATreview1'), 'approved');
reset role;

-- With a second approver, the first may delete themselves
update public.profiles set role = 'approver' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select public.delete_own_account();
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'approver deleted when another exists';
  assert (select approved_by is null from public.articles where drive_file_id='docPATreview1'), 'approval kept, approver emptied';
end $$;

select 'ALL DELETE-ACCOUNT TESTS PASSED' as result;
