"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/form-fields";
import {
  DEFAULT_AUTHOR, LIMITS, SITE_PREFIX, SLUG_PATTERN, TAG_PATTERN, blockingIssues, guidelineChecks, parseTags, slugify, wordCount,
  type ArticleFields, type FieldName, type SiteContext,
} from "@/lib/content/rules";
import { changeStatus, deleteDraft, refreshFromDoc, saveArticle, type ActionState } from "./actions";

type Option = { id: number; label: string };
type Values = {
  title: string;
  slug: string;
  meta_description: string;
  content_type_id: string;
  service_area_id: string;
  target_keyword: string;
  secondary_keyword_1: string;
  secondary_keyword_2: string;
  tags: string;
  publish_date: string;
};

const toValues = (a: ArticleFields): Values => ({
  title: a.title ?? "",
  slug: a.slug ?? "",
  meta_description: a.meta_description ?? "",
  content_type_id: a.content_type_id ? String(a.content_type_id) : "",
  service_area_id: a.service_area_id ? String(a.service_area_id) : "",
  target_keyword: a.target_keyword ?? "",
  secondary_keyword_1: a.secondary_keywords[0] ?? "",
  secondary_keyword_2: a.secondary_keywords[1] ?? "",
  tags: a.tags.join(", "),
  publish_date: a.publish_date ?? "",
});

const toFields = (v: Values, body: string): ArticleFields => ({
  title: v.title.trim() === "" ? null : v.title.trim(),
  slug: v.slug.trim() === "" ? null : v.slug.trim(),
  meta_description: v.meta_description.trim() === "" ? null : v.meta_description.trim(),
  content_type_id: v.content_type_id ? Number(v.content_type_id) : null,
  service_area_id: v.service_area_id ? Number(v.service_area_id) : null,
  target_keyword: v.target_keyword.trim() === "" ? null : v.target_keyword.trim(),
  author_name: DEFAULT_AUTHOR,
  publish_date: v.publish_date === "" ? null : v.publish_date,
  body_markdown: body,
  tags: parseTags(v.tags),
  secondary_keywords: [v.secondary_keyword_1, v.secondary_keyword_2].map((k) => k.trim()).filter(Boolean),
});

const inputClass = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";

function Counter({ length, min, max }: { length: number; min?: number; max: number }) {
  const bad = length > max || (min !== undefined && length > 0 && length < min);
  return (
    <span className={`text-xs ${bad ? "font-semibold text-danger" : "text-muted"}`} aria-live="polite">
      {length} / {min !== undefined ? `${min} to ${max}` : max}
    </span>
  );
}

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !dirty}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
    </button>
  );
}

function PendingButton({ label, pendingLabel, disabled, tone = "accent" }: { label: string; pendingLabel: string; disabled?: boolean; tone?: "accent" | "danger" }) {
  const { pending } = useFormStatus();
  const tones = { accent: "bg-accent text-accent-foreground", danger: "bg-danger text-danger-foreground" };
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ArticleEditor({
  article,
  updatedAt,
  types,
  areas,
  afterForm,
  canRefresh,
  site,
  keywords,
  children,
}: {
  article: ArticleFields & { id: string };
  updatedAt: string;
  types: Option[];
  areas: Option[];
  afterForm: React.ReactNode; // the article text, shown under the form
  canRefresh: boolean; // has a real Google Doc behind it
  site: SiteContext; // the live site's pages, for URL and link checks
  keywords: string[]; // the keyword library, offered as suggestions
  children: React.ReactNode; // server-rendered history etc., shown in the side column
}) {
  const [saved, setSaved] = useState<Values>(() => toValues(article));
  const [values, setValues] = useState<Values>(saved);
  const [version, setVersion] = useState(updatedAt);
  // On a successful save, exactly what was sent becomes the new "saved" copy
  // (not what's on screen now, in case someone kept typing while it saved).
  const [saveState, saveAction] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await saveArticle(prev, fd);
    if (result.ok && result.savedAt) {
      const sent = Object.fromEntries((Object.keys(saved) as (keyof Values)[]).map((k) => [k, String(fd.get(k) ?? "")])) as Values;
      setSaved(sent);
      setVersion(result.savedAt);
    }
    return result;
  }, {} as ActionState);
  const [submitState, submitAction] = useActionState(changeStatus, {} as ActionState);
  // Refreshing the text changes the article's version, so keep ours in step.
  const [refreshState, refreshAction] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await refreshFromDoc(prev, fd);
    if (result.ok && result.savedAt) setVersion(result.savedAt);
    return result;
  }, {} as ActionState);
  const [deleteState, deleteAction] = useActionState(deleteDraft, {} as ActionState);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const fields = useMemo(() => toFields(values, article.body_markdown), [values, article.body_markdown]);
  const issues = useMemo(() => blockingIssues({ ...fields, word_count: wordCount(fields.body_markdown) }, site), [fields, site]);
  const problems = issues.map((i) => i.message);
  const tips = useMemo(() => guidelineChecks(fields, site), [fields, site]);
  const tagList = fields.tags;
  const badTags = tagList.filter((t) => !TAG_PATTERN.test(t));
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const slugInvalid = values.slug.trim() !== "" && !SLUG_PATTERN.test(values.slug.trim());
  // What to show under a field: the server's complaint about the last save
  // first, otherwise the rule the field currently breaks.
  const err = (k: string) => saveState.fieldErrors?.[k];
  const issue = (k: FieldName) => issues.find((i) => i.field === k)?.message;
  const border = (bad: boolean) => (bad ? "border-danger" : "border-border");
  const note = (k: FieldName, extra?: string) => {
    const message = err(k) ?? extra ?? issue(k);
    return message ? <p id={`${k}-error`} className="mt-1 text-xs text-danger">{message}</p> : null;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-6">
        <form action={saveAction} className="rounded-lg border border-border bg-surface p-5" noValidate>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Details</h2>
            <span className={`text-xs ${dirty ? "font-semibold text-warning" : "text-muted"}`} aria-live="polite">
              {dirty ? "Unsaved changes" : "All changes saved"}
            </span>
          </div>
          <input type="hidden" name="id" value={article.id} />
          <input type="hidden" name="updatedAt" value={version} />

          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="title" className="text-sm font-medium">Title</label>
                <Counter length={values.title.trim().length} min={LIMITS.titleMin} max={LIMITS.titleMax} />
              </div>
              <input id="title" name="title" value={values.title} onChange={set("title")} maxLength={200} aria-describedby="title-error" className={`${inputClass} ${border(Boolean(err("title") ?? issue("title")))}`} />
              {note("title")}
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="slug" className="text-sm font-medium">URL slug</label>
                <button
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, slug: slugify(v.title) }))}
                  disabled={!values.title.trim()}
                  className="text-xs font-medium text-primary underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
                >
                  Make from title
                </button>
              </div>
              <div className={`mt-1 flex items-center rounded-md border bg-background text-sm ${border(slugInvalid || Boolean(err("slug") ?? issue("slug")))}`}>
                <span className="shrink-0 whitespace-nowrap pl-3 text-muted">{SITE_PREFIX}</span>
                <input id="slug" name="slug" value={values.slug} onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value.toLowerCase() }))} maxLength={80} aria-describedby="slug-help" className={`min-w-0 flex-1 rounded-r-md bg-transparent px-1 py-2 outline-none ${slugInvalid ? "text-danger" : ""}`} />
              </div>
              <p id="slug-help" className={`mt-1 text-xs ${slugInvalid || err("slug") || issue("slug") ? "text-danger" : "text-muted"}`}>
                {err("slug") ?? (slugInvalid ? "Use lowercase letters, numbers and single hyphens only." : issue("slug") ?? "Lowercase words joined by hyphens. This becomes the page's address.")}
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="meta_description" className="text-sm font-medium">Meta description</label>
                <Counter length={values.meta_description.trim().length} min={LIMITS.metaMin} max={LIMITS.metaMax} />
              </div>
              <textarea id="meta_description" name="meta_description" value={values.meta_description} onChange={set("meta_description")} maxLength={300} rows={3} aria-describedby="meta_description-error" className={`${inputClass} ${border(Boolean(err("meta_description") ?? issue("meta_description")))}`} />
              {note("meta_description") ?? <p className="mt-1 text-xs text-muted">The short summary search engines show under the title.</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="content_type_id" className="text-sm font-medium">Type</label>
                <select id="content_type_id" name="content_type_id" value={values.content_type_id} onChange={set("content_type_id")} className={`${inputClass} ${border(Boolean(issue("content_type_id")))}`}>
                  <option value="">Choose a type</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                {note("content_type_id")}
              </div>
              <div>
                <label htmlFor="service_area_id" className="text-sm font-medium">Service area</label>
                <select id="service_area_id" name="service_area_id" value={values.service_area_id} onChange={set("service_area_id")} className={`${inputClass} ${border(Boolean(issue("service_area_id")))}`}>
                  <option value="">Choose a service area</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                {note("service_area_id")}
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Target keywords</legend>
              <p className="text-xs text-muted">One main keyword, plus up to two more. Start typing to pick from the keyword library, or write your own.</p>
              <div className="mt-1 grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="target_keyword" className="text-xs text-muted">Main keyword</label>
                  <input id="target_keyword" name="target_keyword" list="keyword-library" value={values.target_keyword} onChange={set("target_keyword")} maxLength={80} placeholder="e.g. EPC consulting services" className={`${inputClass} ${border(Boolean(err("target_keyword") ?? issue("target_keyword")))}`} />
                </div>
                <div>
                  <label htmlFor="secondary_keyword_1" className="text-xs text-muted">Second (optional)</label>
                  <input id="secondary_keyword_1" name="secondary_keyword_1" list="keyword-library" value={values.secondary_keyword_1} onChange={set("secondary_keyword_1")} maxLength={80} className={`${inputClass} ${border(Boolean(err("secondary_keywords")))}`} />
                </div>
                <div>
                  <label htmlFor="secondary_keyword_2" className="text-xs text-muted">Third (optional)</label>
                  <input id="secondary_keyword_2" name="secondary_keyword_2" list="keyword-library" value={values.secondary_keyword_2} onChange={set("secondary_keyword_2")} maxLength={80} className={`${inputClass} ${border(Boolean(err("secondary_keywords")))}`} />
                </div>
              </div>
              <datalist id="keyword-library">
                {keywords.map((k) => <option key={k} value={k} />)}
              </datalist>
              {note("target_keyword", err("secondary_keywords"))}
            </fieldset>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="tags" className="text-sm font-medium">Tags</label>
                <span className={`text-xs ${tagList.length > LIMITS.maxTags ? "font-semibold text-danger" : "text-muted"}`}>{tagList.length} / {LIMITS.maxTags}</span>
              </div>
              <input id="tags" name="tags" value={values.tags} onChange={set("tags")} maxLength={400} placeholder="e.g. pipeline engineering, alberta, cost control" aria-describedby="tags-help" className={`${inputClass} ${border(Boolean(err("tags") ?? issue("tags")) || badTags.length > 0)}`} />
              {tagList.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags as they will be saved">
                  {tagList.map((t) => (
                    <li key={t} className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_PATTERN.test(t) ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>{t}</li>
                  ))}
                </ul>
              ) : null}
              {note("tags", badTags.length > 0 ? "Tags are 2 to 30 characters: letters, numbers, spaces, & and hyphens." : tagList.length > LIMITS.maxTags ? `Use ${LIMITS.maxTags} tags or fewer.` : undefined) ?? (
                <p id="tags-help" className="mt-1 text-xs text-muted">Separate tags with commas. They group related articles on the site.</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Author</p>
                <p className="mt-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-muted">{DEFAULT_AUTHOR}</p>
                <p className="mt-1 text-xs text-muted">Every article is credited to the team.</p>
              </div>
              <div>
                <label htmlFor="publish_date" className="text-sm font-medium">Publish date</label>
                <input id="publish_date" name="publish_date" type="date" value={values.publish_date} onChange={set("publish_date")} className={`${inputClass} ${border(Boolean(err("publish_date") ?? issue("publish_date")))}`} />
                {note("publish_date")}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <SaveButton dirty={dirty} />
            {dirty ? (
              <button type="button" onClick={() => setValues(saved)} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-border/40">
                Undo changes
              </button>
            ) : null}
          </div>
          <div className="mt-3">
            <FormMessage message={saveState.message} />
          </div>
        </form>
        {canRefresh ? (
          <form action={refreshAction} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4">
            <input type="hidden" name="id" value={article.id} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Edited the Google Doc since importing?</p>
              <p className="text-xs text-muted">Bring in its latest text. Your details above are kept.</p>
            </div>
            <PendingButton label="Refresh from Doc" pendingLabel="Fetching…" />
            {refreshState.message ? (
              <p role={refreshState.ok ? "status" : "alert"} className={`w-full text-sm ${refreshState.ok ? "text-success" : "text-danger"}`}>
                {refreshState.message}
              </p>
            ) : null}
          </form>
        ) : null}
        {afterForm}
      </div>

      <aside className="space-y-6">
        <section aria-labelledby="ready" className="rounded-lg border border-border bg-surface p-5">
          <h2 id="ready" className="font-semibold">Ready to submit?</h2>
          {problems.length === 0 ? (
            <p className="mt-2 text-sm text-success">Everything the site needs is filled in correctly.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm" aria-live="polite">
              {problems.map((p) => (
                <li key={p} className="flex gap-2">
                  <span aria-hidden className="text-danger">●</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}

          <form action={submitAction} className="mt-4">
            <input type="hidden" name="id" value={article.id} />
            <input type="hidden" name="to" value="in_review" />
            <input type="hidden" name="note" value="" />
            <PendingButton label="Submit for review" pendingLabel="Submitting…" disabled={dirty || problems.length > 0} />
            <p className="mt-2 text-xs text-muted">
              {dirty ? "Save your changes first." : problems.length > 0 ? "Fix the items above first." : "An approver will be able to review it."}
            </p>
            <div className="mt-2">
              <FormMessage message={submitState.message} />
            </div>
          </form>
        </section>

        <section aria-labelledby="tips" className="rounded-lg border border-border bg-surface p-5">
          <h2 id="tips" className="font-semibold">Findability tips</h2>
          <ul className="mt-2 space-y-2 text-sm" aria-live="polite">
            {tips.map((c) => (
              <li key={c.rule_key} className="flex gap-2">
                <span aria-hidden className={`w-4 shrink-0 text-center ${c.result === "pass" ? "text-success" : "text-warning"}`}>{c.result === "pass" ? "✓" : "!"}</span>
                <span>
                  <span className="font-medium">{c.label}</span>
                  <span className="block text-xs text-muted">{c.message}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Tips are advice, not requirements. The approver sees them too.</p>
        </section>

        {children}

        <section aria-labelledby="delete" className="rounded-lg border border-danger/30 bg-surface p-5">
          <h2 id="delete" className="font-semibold text-danger">Delete this draft</h2>
          <p className="mt-1 text-xs text-muted">Removes it from the hub. The Google Doc is not touched.</p>
          {confirmDelete ? (
            <form action={deleteAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={article.id} />
              <input type="hidden" name="confirm" value="yes" />
              <PendingButton label="Yes, delete it" pendingLabel="Deleting…" tone="danger" />
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-border/40">
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="mt-3 rounded-md border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10">
              Delete draft
            </button>
          )}
          <div className="mt-2">
            <FormMessage message={deleteState.message} />
          </div>
        </section>
      </aside>
    </div>
  );
}
