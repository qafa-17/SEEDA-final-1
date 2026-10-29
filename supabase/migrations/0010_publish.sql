-- =====================================================================
-- Publish: an approver sends an approved article to the website.
--
--   start_publish        approved article -> a new publish job (queued)
--   update_publish_job   queued -> pr_open -> merged, or -> failed
--   finish_publish       merged + the page is live and in the sitemap
--                        -> job verified, article Published
--
-- The server does the GitHub and website steps and records each one
-- through these functions. Publishing is an approver's job, so every
-- function refuses anyone else. Nothing else can set an article to
-- Published (change_article_status refuses it).
-- Paste into Supabase > SQL Editor and click Run. Requires 0001 to 0009.
-- =====================================================================

create function public.start_publish(p_article_id uuid)
returns public.publish_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_article public.articles;
  v_problems text[];
  v_job public.publish_jobs;
begin
  if (select public.active_role()) is distinct from 'approver' then
    raise exception 'Only an approver can publish.' using errcode = '42501';
  end if;

  select * into v_article from public.articles where id = p_article_id for update;
  if not found then
    raise exception 'Article not found.' using errcode = 'P0002';
  end if;
  if v_article.status <> 'approved' then
    raise exception 'Only approved articles can be published.' using errcode = '22023';
  end if;
  v_problems := public.article_blocking_problems(v_article);
  if cardinality(v_problems) > 0 then
    raise exception 'Fix these first: %', array_to_string(v_problems, ' ') using errcode = '23514';
  end if;

  -- One attempt at a time. An attempt stuck for over 30 minutes no longer counts.
  if exists (
    select 1 from public.publish_jobs j
    where j.article_id = p_article_id and j.state in ('queued', 'pr_open', 'merged')
      and j.updated_at > now() - interval '30 minutes'
  ) then
    raise exception 'This article is already being published.' using errcode = '55P03';
  end if;
  update public.publish_jobs
    set state = 'failed', error_message = 'Stopped: no progress for 30 minutes.'
    where article_id = p_article_id and state in ('queued', 'pr_open', 'merged');

  insert into public.publish_jobs (article_id, requested_by, state)
  values (p_article_id, (select auth.uid()), 'queued')
  returning * into v_job;
  return v_job;
end;
$$;

create function public.update_publish_job(
  p_job_id uuid,
  p_state public.publish_state,
  p_branch text default null,
  p_pr_number integer default null,
  p_pr_url text default null,
  p_error text default null
)
returns public.publish_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.publish_jobs;
begin
  if (select public.active_role()) is distinct from 'approver' then
    raise exception 'Only an approver can publish.' using errcode = '42501';
  end if;
  select * into v_job from public.publish_jobs where id = p_job_id for update;
  if not found then
    raise exception 'Publish attempt not found.' using errcode = 'P0002';
  end if;

  -- Forward only; verified is set by finish_publish.
  if not (
    (v_job.state = 'queued' and p_state in ('pr_open', 'failed'))
    or (v_job.state = 'pr_open' and p_state in ('merged', 'failed'))
    or (v_job.state = 'merged' and p_state = 'failed')
  ) then
    raise exception 'A publish attempt cannot move from % to %.', v_job.state, p_state using errcode = '22023';
  end if;
  if p_pr_url is not null and p_pr_url !~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+$' then
    raise exception 'That is not a GitHub pull request link.' using errcode = '22023';
  end if;
  if p_branch is not null and p_branch !~ '^[A-Za-z0-9/_.-]{1,120}$' then
    raise exception 'Invalid branch name.' using errcode = '22023';
  end if;

  update public.publish_jobs set
    state = p_state,
    branch = coalesce(p_branch, branch),
    pr_number = coalesce(p_pr_number, pr_number),
    pr_url = coalesce(p_pr_url, pr_url),
    error_message = case when p_state = 'failed' then left(coalesce(p_error, 'Publishing failed.'), 2000) else null end
  where id = p_job_id
  returning * into v_job;
  return v_job;
end;
$$;

create function public.finish_publish(
  p_job_id uuid,
  p_live_url text,
  p_http_status smallint,
  p_in_sitemap boolean
)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.publish_jobs;
  v_article public.articles;
begin
  if (select public.active_role()) is distinct from 'approver' then
    raise exception 'Only an approver can publish.' using errcode = '42501';
  end if;
  select * into v_job from public.publish_jobs where id = p_job_id for update;
  if not found then
    raise exception 'Publish attempt not found.' using errcode = 'P0002';
  end if;
  if v_job.state <> 'merged' then
    raise exception 'This publish attempt is not waiting for the site.' using errcode = '22023';
  end if;
  select * into v_article from public.articles where id = v_job.article_id for update;
  if v_article.status <> 'approved' then
    raise exception 'The article is no longer approved.' using errcode = '22023';
  end if;
  if p_http_status <> 200 or p_in_sitemap is not true then
    raise exception 'The page must load and be in the sitemap before it counts as published.' using errcode = '23514';
  end if;
  if p_live_url !~ '^https://' or p_live_url not like '%/resources/' || v_article.slug then
    raise exception 'The live link does not match the article''s address.' using errcode = '22023';
  end if;

  update public.publish_jobs
    set state = 'verified', live_url = p_live_url, http_status = p_http_status, in_sitemap = p_in_sitemap, error_message = null
    where id = p_job_id;

  update public.articles
    set status = 'published', published_at = now(), published_url = p_live_url
    where id = v_article.id
    returning * into v_article;

  insert into public.article_events (article_id, kind, from_status, to_status, actor_id)
  values (v_article.id, 'published', 'approved', 'published', (select auth.uid()));

  -- The page is now part of the site: link checks and reserved URLs know about it.
  insert into public.site_pages (path, title, kind, article_id)
  values ('/resources/' || v_article.slug, v_article.title, 'resource', v_article.id)
  on conflict (path) do update set title = excluded.title, article_id = excluded.article_id;

  return v_article;
end;
$$;

revoke execute on function public.start_publish(uuid) from public, anon;
revoke execute on function public.update_publish_job(uuid, public.publish_state, text, integer, text, text) from public, anon;
revoke execute on function public.finish_publish(uuid, text, smallint, boolean) from public, anon;
grant execute on function public.start_publish(uuid) to authenticated;
grant execute on function public.update_publish_job(uuid, public.publish_state, text, integer, text, text) to authenticated;
grant execute on function public.finish_publish(uuid, text, smallint, boolean) to authenticated;
