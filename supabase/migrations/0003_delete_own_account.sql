-- =====================================================================
-- Stage 3b: people can delete their own account
-- Paste this whole file into Supabase > SQL Editor and click Run.
-- Requires 0001 and 0002.
-- =====================================================================

-- 1. Articles outlive the person who imported them. When an account is
--    deleted, its articles stay and their owner becomes empty, shown in
--    the app as "Former member". Approvers can still act on them.
alter table public.articles alter column owner_id drop not null;
alter table public.articles drop constraint articles_owner_id_fkey;
alter table public.articles
  add constraint articles_owner_id_fkey
  foreign key (owner_id) references public.profiles (id) on delete set null;

comment on column public.articles.owner_id is 'Who imported it. Empty when that person deleted their account.';

-- 2. Re-create the workflow function with one fix: an article with no
--    owner must count as "not yours" (a plain comparison with an empty
--    owner gives "unknown", which must never be treated as permission).
create or replace function public.change_article_status(
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

  select * into v_article from public.articles where id = p_article_id for update;
  if not found then
    raise exception 'Article not found.' using errcode = 'P0002';
  end if;

  v_is_owner := coalesce(v_article.owner_id = v_uid, false);

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

-- 3. Delete my own account. Removes the sign-in record; the profile goes
--    with it automatically, articles keep an empty owner, history keeps
--    the event with an empty actor. The email can be used to sign up again.
create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  -- Never remove the last active approver: nobody could let people in.
  if exists (select 1 from public.profiles where id = v_uid and role = 'approver' and access = 'active')
     and not exists (select 1 from public.profiles where id <> v_uid and role = 'approver' and access = 'active') then
    raise exception 'You are the only approver. Make someone else an approver first.' using errcode = 'P0001', hint = 'last_approver';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
