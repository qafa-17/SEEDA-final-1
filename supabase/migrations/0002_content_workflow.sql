-- =====================================================================
-- Stage 3: team access (waiting room) and the content workflow
-- Paste this whole file into Supabase > SQL Editor and click Run.
-- Requires 0001_profiles_and_roles.sql to have been run first.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PART A. Team access: new sign-ups wait until an approver lets them in
-- ---------------------------------------------------------------------

create type public.member_access as enum ('pending', 'active', 'disabled');

alter table public.profiles
  add column access public.member_access not null default 'pending';

-- Everyone who already exists (you) keeps working.
update public.profiles set access = 'active';

comment on column public.profiles.access is
  'pending = signed up, waiting for an approver; active = can use the app; disabled = access removed.';

-- Helper: the caller's role, but ONLY if their access is active; otherwise null.
-- Every policy below uses this, so pending or disabled users can do nothing.
-- security definer lets it read profiles without tripping profiles' own RLS.
create function public.active_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid()) and p.access = 'active';
$$;

revoke execute on function public.active_role() from public, anon;
grant execute on function public.active_role() to authenticated;

-- Replace the Stage 2 read policy: active members see the team;
-- anyone signed in can always see their OWN row (the waiting page needs it).
drop policy "Signed-in users can view profiles" on public.profiles;

create policy "Members view team, everyone views self"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.active_role()) is not null);

-- Approvers manage access and roles through these functions only.
-- Nobody can change their own access or role (prevents locking out the
-- last approver, and self-promotion).
create function public.set_member_access(p_user uuid, p_access public.member_access)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.active_role()) is distinct from 'approver' then
    raise exception 'Only approvers can manage team access.' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'You cannot change your own access.' using errcode = '42501';
  end if;
  update public.profiles set access = p_access where id = p_user;
  if not found then
    raise exception 'That person was not found.' using errcode = 'P0002';
  end if;
end;
$$;

create function public.set_member_role(p_user uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.active_role()) is distinct from 'approver' then
    raise exception 'Only approvers can change roles.' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'You cannot change your own role.' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then
    raise exception 'That person was not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- The Team page: approvers need each person's email to recognise who is
-- asking to join. Emails live in auth.users, which the app cannot read, so
-- this function hands them out to approvers only.
create function public.list_team()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.app_role,
  access public.member_access,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select public.active_role()) is distinct from 'approver' then
    raise exception 'Only approvers can view the team list.' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, u.email::text, p.role, p.access, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by (p.access = 'pending') desc, p.created_at desc;
end;
$$;

revoke execute on function public.list_team() from public, anon;
grant execute on function public.list_team() to authenticated;

revoke execute on function public.set_member_access(uuid, public.member_access) from public, anon;
revoke execute on function public.set_member_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_member_access(uuid, public.member_access) to authenticated;
grant execute on function public.set_member_role(uuid, public.app_role) to authenticated;

-- ---------------------------------------------------------------------
-- PART B. Lookup lists (the "modules" from the discovery call)
-- ---------------------------------------------------------------------

create table public.content_types (
  id          smallint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label       text not null unique,
  sort_order  smallint not null default 0
);

create table public.service_areas (
  id          smallint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label       text not null unique,
  sort_order  smallint not null default 0
);

-- The three types already live on epcmst.com, and the four letters of EPCM.
insert into public.content_types (slug, label, sort_order) values
  ('whitepaper', 'Whitepaper', 1),
  ('case-study', 'Case Study', 2),
  ('technical-insight', 'Technical Insight', 3);

insert into public.service_areas (slug, label, sort_order) values
  ('engineering', 'Engineering', 1),
  ('procurement', 'Procurement', 2),
  ('construction', 'Construction', 3),
  ('management', 'Management', 4);

-- ---------------------------------------------------------------------
-- PART C. Articles
-- ---------------------------------------------------------------------

create type public.article_status as enum ('draft', 'in_review', 'approved', 'published');

create table public.articles (
  id                 uuid primary key default gen_random_uuid(),

  -- Where it came from. One article per Google Doc.
  drive_file_id      text not null unique check (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  drive_modified_at  timestamptz,

  -- Front matter. Nullable while a draft is being filled in; the FORMAT is
  -- checked whenever a value is present, and COMPLETENESS is checked when
  -- the article is submitted for review (see article_blocking_problems).
  title              text check (title is null or char_length(title) between 1 and 200),
  slug               text unique check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80)),
  meta_description   text check (meta_description is null or char_length(meta_description) <= 300),
  content_type_id    smallint references public.content_types (id),
  service_area_id    smallint references public.service_areas (id),
  target_keyword     text check (target_keyword is null or char_length(target_keyword) <= 80),
  author_name        text check (author_name is null or char_length(author_name) <= 100),
  publish_date       date,

  -- The article body, converted from the Doc to Markdown.
  body_markdown      text not null default '' check (char_length(body_markdown) <= 200000),
  word_count         integer generated always as (
                       coalesce(array_length(regexp_split_to_array(btrim(body_markdown), '\s+'), 1), 0)
                       - case when btrim(body_markdown) = '' then 1 else 0 end
                     ) stored,

  -- Workflow. Never set directly by users; see change_article_status().
  status             public.article_status not null default 'draft',
  -- restrict: a person who owns articles can't be deleted until they're reassigned.
  owner_id           uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  submitted_at       timestamptz,
  approved_by        uuid references public.profiles (id) on delete set null,
  approved_at        timestamptz,
  published_at       timestamptz,
  published_url      text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.articles is 'One Knowledge Hub article, imported from one Google Doc, moving draft -> in_review -> approved -> published.';

create index articles_status_idx on public.articles (status);
create index articles_owner_idx on public.articles (owner_id);
create index articles_updated_idx on public.articles (updated_at desc);

create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

-- The rules that would break the site build if missing or wrong.
-- These are the database's copy of the Astro/Zod front-matter schema, so no
-- one (not even a hand-made request) can submit an article that fails them.
-- Returns an empty array when the article is ready.
create function public.article_blocking_problems(a public.articles)
returns text[]
language sql
stable
set search_path = ''
as $$
  select array_remove(array[
    case when a.title is null or char_length(btrim(a.title)) < 10 then 'Title must be at least 10 characters.' end,
    case when char_length(a.title) > 70 then 'Title must be 70 characters or fewer.' end,
    case when a.slug is null then 'Add a URL slug.' end,
    case when a.meta_description is null or char_length(a.meta_description) < 70 then 'Meta description must be at least 70 characters.' end,
    case when char_length(a.meta_description) > 160 then 'Meta description must be 160 characters or fewer.' end,
    case when a.content_type_id is null then 'Choose a content type.' end,
    case when a.service_area_id is null then 'Choose a service area.' end,
    case when a.target_keyword is null or char_length(btrim(a.target_keyword)) < 2 then 'Add a target keyword.' end,
    case when a.author_name is null or btrim(a.author_name) = '' then 'Add an author.' end,
    case when a.publish_date is null then 'Add a publish date.' end,
    case when a.word_count < 1 then 'The article body is empty.' end
  ], null);
$$;

revoke execute on function public.article_blocking_problems(public.articles) from public, anon;
grant execute on function public.article_blocking_problems(public.articles) to authenticated;

-- ---------------------------------------------------------------------
-- PART D. Checks, history, publish attempts
-- ---------------------------------------------------------------------

create type public.check_result as enum ('pass', 'warn', 'fail');

-- Latest result of each guideline rule (keyword in title, has an H2, ...).
-- Informational: shown to the publisher and approver. The hard rules that
-- block submission live in article_blocking_problems() above.
create table public.article_checks (
  article_id  uuid not null references public.articles (id) on delete cascade,
  rule_key    text not null check (rule_key ~ '^[a-z0-9_]{2,60}$'),
  result      public.check_result not null,
  message     text not null check (char_length(message) <= 500),
  checked_at  timestamptz not null default now(),
  primary key (article_id, rule_key)
);

create type public.article_event_kind as enum (
  'created', 'submitted', 'approved', 'changes_requested', 'withdrawn', 'reopened', 'published'
);

-- Permanent, append-only history. Only database functions write here.
create table public.article_events (
  id           bigint generated always as identity primary key,
  article_id   uuid not null references public.articles (id) on delete cascade,
  kind         public.article_event_kind not null,
  from_status  public.article_status,
  to_status    public.article_status not null,
  actor_id     uuid references public.profiles (id) on delete set null,
  note         text check (note is null or char_length(note) <= 1000),
  created_at   timestamptz not null default now()
);

create index article_events_article_idx on public.article_events (article_id, created_at desc);

create type public.publish_state as enum ('queued', 'pr_open', 'merged', 'verified', 'failed');

-- Each attempt to publish (Stage 8 fills these in from the server).
create table public.publish_jobs (
  id              uuid primary key default gen_random_uuid(),
  article_id      uuid not null references public.articles (id) on delete cascade,
  requested_by    uuid references public.profiles (id) on delete set null,
  state           public.publish_state not null default 'queued',
  branch          text,
  pr_number       integer,
  pr_url          text,
  live_url        text,
  http_status     smallint,
  in_sitemap      boolean,
  error_message   text check (error_message is null or char_length(error_message) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index publish_jobs_article_idx on public.publish_jobs (article_id, created_at desc);

create trigger publish_jobs_set_updated_at
  before update on public.publish_jobs
  for each row execute function public.set_updated_at();

-- Log a 'created' event whenever an article is inserted.
create function public.log_article_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.article_events (article_id, kind, from_status, to_status, actor_id)
  values (new.id, 'created', null, new.status, new.owner_id);
  return new;
end;
$$;

create trigger articles_log_created
  after insert on public.articles
  for each row execute function public.log_article_created();

revoke execute on function public.log_article_created() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- PART E. The workflow rules
-- ---------------------------------------------------------------------

-- The ONLY way an article's status changes from the app.
--   draft      -> in_review  owner or approver, and no blocking problems
--   in_review  -> approved   approver (may be the owner; it is logged)
--   in_review  -> draft      approver with a reason (changes requested),
--                            or the owner (withdraw)
--   approved   -> draft      owner or approver, with a reason (reopen to edit)
--   anything   -> published  not allowed here; only the publish process (Stage 8)
create function public.change_article_status(
  p_article_id uuid,
  p_to public.article_status,
  p_note text default null
)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role     public.app_role := (select public.active_role());
  v_uid      uuid := (select auth.uid());
  v_article  public.articles;
  v_is_owner boolean;
  v_kind     public.article_event_kind;
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_problems text[];
begin
  if v_role is null then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;
  if char_length(v_note) > 1000 then
    raise exception 'Keep the note under 1000 characters.' using errcode = '22001';
  end if;

  -- Lock the row so two people can't move the same article at once.
  select * into v_article from public.articles where id = p_article_id for update;
  if not found then
    raise exception 'Article not found.' using errcode = 'P0002';
  end if;

  v_is_owner := v_article.owner_id = v_uid;

  if v_article.status = 'draft' and p_to = 'in_review' then
    if not (v_is_owner or v_role = 'approver') then
      raise exception 'Only the owner or an approver can submit this article.' using errcode = '42501';
    end if;
    v_problems := public.article_blocking_problems(v_article);
    if cardinality(v_problems) > 0 then
      raise exception 'Fix these first: %', array_to_string(v_problems, ' ') using errcode = '23514';
    end if;
    v_kind := 'submitted';
    update public.articles set status = p_to, submitted_at = now() where id = p_article_id;

  elsif v_article.status = 'in_review' and p_to = 'approved' then
    if v_role <> 'approver' then
      raise exception 'Only an approver can approve.' using errcode = '42501';
    end if;
    -- Re-check: rules might have tightened since submission.
    v_problems := public.article_blocking_problems(v_article);
    if cardinality(v_problems) > 0 then
      raise exception 'Fix these first: %', array_to_string(v_problems, ' ') using errcode = '23514';
    end if;
    v_kind := 'approved';
    update public.articles set status = p_to, approved_by = v_uid, approved_at = now() where id = p_article_id;

  elsif v_article.status = 'in_review' and p_to = 'draft' then
    if v_role = 'approver' and not v_is_owner then
      if v_note is null then
        raise exception 'Say what needs to change.' using errcode = '23502';
      end if;
      v_kind := 'changes_requested';
    elsif v_is_owner then
      v_kind := 'withdrawn';
    else
      raise exception 'Only the owner or an approver can do this.' using errcode = '42501';
    end if;
    update public.articles set status = p_to, submitted_at = null where id = p_article_id;

  elsif v_article.status = 'approved' and p_to = 'draft' then
    if not (v_is_owner or v_role = 'approver') then
      raise exception 'Only the owner or an approver can reopen this article.' using errcode = '42501';
    end if;
    if v_note is null then
      raise exception 'Say why it is being reopened.' using errcode = '23502';
    end if;
    v_kind := 'reopened';
    update public.articles
      set status = p_to, submitted_at = null, approved_by = null, approved_at = null
      where id = p_article_id;

  else
    raise exception 'An article cannot move from % to %.', v_article.status, p_to using errcode = '22023';
  end if;

  insert into public.article_events (article_id, kind, from_status, to_status, actor_id, note)
  values (p_article_id, v_kind, v_article.status, p_to, v_uid, v_note);

  select * into v_article from public.articles where id = p_article_id;
  return v_article;
end;
$$;

revoke execute on function public.change_article_status(uuid, public.article_status, text) from public, anon;
grant execute on function public.change_article_status(uuid, public.article_status, text) to authenticated;

-- ---------------------------------------------------------------------
-- PART F. Row Level Security and column permissions
-- ---------------------------------------------------------------------

alter table public.content_types  enable row level security;
alter table public.service_areas  enable row level security;
alter table public.articles       enable row level security;
alter table public.article_checks enable row level security;
alter table public.article_events enable row level security;
alter table public.publish_jobs   enable row level security;

-- Start from nothing, then grant exactly what each role needs.
revoke all on public.content_types, public.service_areas, public.articles,
              public.article_checks, public.article_events, public.publish_jobs
  from anon, authenticated;

-- Lookups: read-only for active members (edited by admins in the dashboard).
grant select on public.content_types, public.service_areas to authenticated;
create policy "Members read content types" on public.content_types
  for select to authenticated using ((select public.active_role()) is not null);
create policy "Members read service areas" on public.service_areas
  for select to authenticated using ((select public.active_role()) is not null);

-- Articles: every active member sees every article (shared board).
grant select on public.articles to authenticated;
create policy "Members read articles" on public.articles
  for select to authenticated using ((select public.active_role()) is not null);

-- Insert: any active member, and only these columns. status, owner_id and
-- the approval fields are NOT insertable, so a new article is always a
-- draft owned by whoever created it.
grant insert (drive_file_id, drive_modified_at, title, slug, meta_description, content_type_id,
              service_area_id, target_keyword, author_name, publish_date, body_markdown)
  on public.articles to authenticated;
create policy "Members create articles" on public.articles
  for insert to authenticated
  with check ((select public.active_role()) is not null and owner_id = (select auth.uid()));

-- Update: only the content columns, only while it is a draft, and only by
-- the owner or an approver. Approved articles are therefore frozen.
grant update (drive_modified_at, title, slug, meta_description, content_type_id, service_area_id,
              target_keyword, author_name, publish_date, body_markdown)
  on public.articles to authenticated;
create policy "Owner or approver edits drafts" on public.articles
  for update to authenticated
  using (
    status = 'draft'
    and ((select public.active_role()) = 'approver'
         or (owner_id = (select auth.uid()) and (select public.active_role()) is not null))
  )
  with check (status = 'draft');

-- Delete: drafts only, by owner or approver.
grant delete on public.articles to authenticated;
create policy "Owner or approver deletes drafts" on public.articles
  for delete to authenticated
  using (
    status = 'draft'
    and ((select public.active_role()) = 'approver'
         or (owner_id = (select auth.uid()) and (select public.active_role()) is not null))
  );

-- Checks: everyone reads; whoever may edit the draft may record its checks.
grant select, insert, update, delete on public.article_checks to authenticated;
create policy "Members read checks" on public.article_checks
  for select to authenticated using ((select public.active_role()) is not null);
create policy "Editors write checks" on public.article_checks
  for all to authenticated
  using (exists (
    select 1 from public.articles a
    where a.id = article_id and a.status = 'draft'
      and ((select public.active_role()) = 'approver'
           or (a.owner_id = (select auth.uid()) and (select public.active_role()) is not null))))
  with check (exists (
    select 1 from public.articles a
    where a.id = article_id and a.status = 'draft'
      and ((select public.active_role()) = 'approver'
           or (a.owner_id = (select auth.uid()) and (select public.active_role()) is not null))));

-- History and publish jobs: read-only for members. Written only by
-- database functions or the server (Stage 8).
grant select on public.article_events, public.publish_jobs to authenticated;
create policy "Members read history" on public.article_events
  for select to authenticated using ((select public.active_role()) is not null);
create policy "Members read publish jobs" on public.publish_jobs
  for select to authenticated using ((select public.active_role()) is not null);
