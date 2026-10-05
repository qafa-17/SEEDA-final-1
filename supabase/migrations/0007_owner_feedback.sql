-- =====================================================================
-- Changes from the project owner's review (5 Oct 2026):
-- more content types, one shared byline, U.S. research areas, and a
-- keyword list the team can grow (approvers add, publishers suggest).
-- Paste into Supabase > SQL Editor and click Run. Requires 0001 to 0006.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Content types
-- ---------------------------------------------------------------------
insert into public.content_types (slug, label, sort_order) values
  ('blog-post', 'Blog Post', 4),
  ('industry-commentary', 'Industry Commentary', 5),
  ('project-highlight', 'Project Highlight', 6),
  ('best-practices-guide', 'Best Practices Guide', 7);

-- ---------------------------------------------------------------------
-- 2. Byline: every article is credited to the team, not a person.
--    "Last updated" is left alone.
-- ---------------------------------------------------------------------
alter table public.articles alter column author_name set default 'EPCMst Team';
alter table public.articles disable trigger articles_set_updated_at;
update public.articles set author_name = 'EPCMst Team' where author_name is distinct from 'EPCMst Team';
alter table public.articles enable trigger articles_set_updated_at;

-- ---------------------------------------------------------------------
-- 3. Research areas: three U.S. regions join Western Canada
-- ---------------------------------------------------------------------
alter table public.idea_searches drop constraint idea_searches_region_check;
alter table public.idea_searches add constraint idea_searches_region_check check (region in (
  'alberta', 'british-columbia', 'saskatchewan', 'manitoba', 'western-canada',
  'us-gulf-coast', 'permian-basin', 'pacific-northwest'));

-- ---------------------------------------------------------------------
-- 4. A keyword list the team can grow
--    active    = on the list (suggested in the editor, counted for coverage)
--    suggested = proposed by a publisher, waiting for an approver
-- ---------------------------------------------------------------------
alter table public.keywords
  add column status text not null default 'active' check (status in ('active', 'suggested')),
  add column added_by uuid default auth.uid() references public.profiles (id) on delete set null,
  add column created_at timestamptz not null default now();

-- The owner's original list was loaded by the database itself, not a person.
update public.keywords set added_by = null;

-- Tidy phrases on the way in, so " EPC   services " and "EPC services" are one keyword.
create function public.keywords_tidy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.phrase := btrim(regexp_replace(new.phrase, '\s+', ' ', 'g'));
  return new;
end;
$$;
create trigger keywords_tidy before insert or update of phrase on public.keywords
  for each row execute function public.keywords_tidy();

-- Approvers add keywords directly; publishers may only suggest.
grant insert (category_id, phrase, status) on public.keywords to authenticated;
create policy "Approvers add, publishers suggest" on public.keywords
  for insert to authenticated
  with check (
    added_by = (select auth.uid())
    and (
      (select public.active_role()) = 'approver'
      or ((select public.active_role()) = 'publisher' and status = 'suggested')
    )
  );

-- Only approvers accept a suggestion (or move a keyword to another group).
grant update (status, category_id) on public.keywords to authenticated;
create policy "Approvers review keywords" on public.keywords
  for update to authenticated
  using ((select public.active_role()) = 'approver')
  with check ((select public.active_role()) = 'approver');

-- Only approvers remove a keyword or dismiss a suggestion.
grant delete on public.keywords to authenticated;
create policy "Approvers remove keywords" on public.keywords
  for delete to authenticated
  using ((select public.active_role()) = 'approver');
