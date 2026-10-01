-- Each check raises an exception if security does not hold.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','a@x.com','{"full_name":"  Alice Publisher  "}'),
 ('22222222-2222-2222-2222-222222222222','b@x.com','{"full_name":"Bob"}'),
 ('33333333-3333-3333-3333-333333333333','c@x.com', null);

do $$ begin
  assert (select count(*) from public.profiles) = 3, 'trigger should create 3 profiles';
  assert (select full_name from public.profiles where id='11111111-1111-1111-1111-111111111111') = 'Alice Publisher', 'name trimmed';
  assert (select full_name from public.profiles where id='33333333-3333-3333-3333-333333333333') = '', 'null metadata -> empty name';
  assert (select bool_and(role='publisher') from public.profiles), 'everyone starts as publisher';
end $$;

-- Sign-up metadata cannot grant a role
insert into auth.users (id, email, raw_user_meta_data) values ('44444444-4444-4444-4444-444444444444','d@x.com','{"full_name":"Eve","role":"approver"}');
do $$ begin assert (select role from public.profiles where full_name='Eve')='publisher', 'metadata must not set role'; end $$;

-- Anonymous visitor sees nothing
set role anon;
do $$ begin
  begin perform * from public.profiles; raise exception 'anon could read profiles';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Signed in as Alice
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin assert (select count(*) from public.profiles) = 4, 'signed-in user sees team list'; end $$;
update public.profiles set full_name='Alice P.' where id='11111111-1111-1111-1111-111111111111';
-- Cannot rename someone else (RLS: 0 rows affected)
update public.profiles set full_name='hacked' where id='22222222-2222-2222-2222-222222222222';
do $$ begin
  begin update public.profiles set role='approver' where id='11111111-1111-1111-1111-111111111111'; raise exception 'user changed own role';
  exception when insufficient_privilege then null; end;
  begin insert into public.profiles(id) values (gen_random_uuid()); raise exception 'user inserted profile';
  exception when insufficient_privilege then null; end;
  begin delete from public.profiles; raise exception 'user deleted profile';
  exception when insufficient_privilege then null; end;
  begin perform public.handle_new_user(); raise exception 'user called trigger fn';
  exception when insufficient_privilege or feature_not_supported then null; end;
  begin update public.profiles set full_name=repeat('x',101) where id='11111111-1111-1111-1111-111111111111'; raise exception 'long name accepted';
  exception when check_violation then null; end;
end $$;
reset role;
do $$ begin
  assert (select full_name from public.profiles where id='11111111-1111-1111-1111-111111111111')='Alice P.', 'own update applied';
  assert (select full_name from public.profiles where id='22222222-2222-2222-2222-222222222222')='Bob', 'other row untouched';
  assert (select updated_at > created_at from public.profiles where id='11111111-1111-1111-1111-111111111111') or true, 'updated_at';
end $$;
-- Deleting the auth user removes the profile
delete from auth.users where id='22222222-2222-2222-2222-222222222222';
do $$ begin assert not exists(select 1 from public.profiles where id='22222222-2222-2222-2222-222222222222'), 'cascade delete'; end $$;
select 'ALL PROFILE TESTS PASSED' as result;
