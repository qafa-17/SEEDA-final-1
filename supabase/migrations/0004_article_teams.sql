-- =====================================================================
-- Stage 5a+: article teams
-- An article's team = its current owner plus everyone who has acted on it
-- (imported, submitted, approved, requested changes, reopened, published).
-- Worked out from history, so it is always accurate and needs no upkeep.
--
-- Visibility rule:
--   approvers  see every article's team;
--   publishers see only the teams of articles they are on.
-- Paste into Supabase > SQL Editor and click Run. Requires 0001 to 0003.
-- =====================================================================

create function public.article_teams()
returns table (
  article_id    uuid,
  title         text,
  status        public.article_status,
  updated_at    timestamptz,
  member_id     uuid,
  full_name     text,
  member_role   public.app_role,
  part          text,          -- what this person did on the article (their strongest part)
  last_activity timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid  uuid := (select auth.uid());
  v_role public.app_role := (select public.active_role());
begin
  if v_role is null then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  return query
  with involvement as (
    -- the current owner
    select a.id as article_id, a.owner_id as member_id, 'owner'::text as part, a.updated_at as at
    from public.articles a
    where a.owner_id is not null
    union all
    -- everyone in the history
    select e.article_id, e.actor_id,
           case e.kind
             when 'approved' then 'approved'
             when 'published' then 'published'
             when 'changes_requested' then 'reviewed'
             else 'contributed'
           end,
           e.created_at
    from public.article_events e
    where e.actor_id is not null
  ),
  per_person as (
    select i.article_id, i.member_id,
           -- strongest part wins: owner > approved > published > reviewed > contributed
           (array_agg(i.part order by case i.part
              when 'owner' then 1 when 'approved' then 2 when 'published' then 3
              when 'reviewed' then 4 else 5 end))[1] as part,
           max(i.at) as last_activity
    from involvement i
    group by i.article_id, i.member_id
  ),
  visible as (
    -- approvers: all articles; everyone else: only articles they are on
    select distinct pp.article_id
    from per_person pp
    where v_role = 'approver' or pp.member_id = v_uid
  )
  select a.id, a.title, a.status, a.updated_at,
         p.id, p.full_name, p.role, pp.part, pp.last_activity
  from visible v
  join public.articles a on a.id = v.article_id
  join per_person pp on pp.article_id = a.id
  join public.profiles p on p.id = pp.member_id
  order by a.updated_at desc, a.id, pp.part = 'owner' desc, p.full_name;
end;
$$;

revoke execute on function public.article_teams() from public, anon;
grant execute on function public.article_teams() to authenticated;
