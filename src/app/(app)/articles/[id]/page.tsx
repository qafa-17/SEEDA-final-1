import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { z } from "zod";
import { StatusBadge, CountChip } from "@/components/status-badge";
import { FormMessage } from "@/components/form-fields";
import { requireActiveUser } from "@/lib/auth";
import { ArticleEditor } from "./editor";
import { WorkflowActions } from "./workflow";
import { createClient } from "@/lib/supabase/server";
import { LIMITS, SITE_PREFIX, blockingProblems, type ArticleFields } from "@/lib/content/rules";
import { loadSiteContext } from "@/lib/content/site-context";
import {
  eventLabels, publishStateLabels, formatDate, formatDateTime, FORMER_MEMBER, type ArticleStatus,
} from "@/lib/content/status";

export const metadata: Metadata = { title: "Article" };

type ArticleRow = ArticleFields & {
  id: string;
  drive_file_id: string;
  source: "google_doc" | "ai_draft";
  status: ArticleStatus;
  word_count: number;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  published_url: string | null;
  content_types: { label: string } | null;
  service_areas: { label: string } | null;
  owner: { full_name: string } | null;
};
type EventRow = { id: number; kind: string; note: string | null; created_at: string; actor_id: string | null; actor: { full_name: string } | null };
type CheckRow = { rule_key: string; result: "pass" | "warn" | "fail"; message: string };
type JobRow = { id: string; state: string; pr_url: string | null; live_url: string | null; http_status: number | null; in_sitemap: boolean | null; error_message: string | null; created_at: string };

const checkLabels: Record<string, string> = {
  keyword_in_title: "Keyword in title",
  keyword_in_slug: "Keyword in URL",
  keyword_in_meta: "Keyword in meta description",
  keyword_in_intro: "Keyword in first paragraph",
  extra_keywords_used: "Extra keywords in the text",
  min_length: "Length",
  has_subheading: "Has subheadings",
  internal_link: "Links to another EPCMst page",
  links_work: "Links point to real pages",
};

function Field({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr]">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm">
        {value ?? <span className="italic text-muted">Not set</span>}
        {hint ? <span className="ml-2 text-xs text-muted">{hint}</span> : null}
      </dd>
    </div>
  );
}

export default async function ArticlePage({ params, searchParams }: PageProps<"/articles/[id]">) {
  const user = await requireActiveUser();
  const { id } = await params;
  const notes = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [articleRes, eventsRes, checksRes, jobsRes, typesRes, areasRes, keywordsRes, site] = await Promise.all([
    supabase
      .from("articles")
      .select("id, drive_file_id, title, slug, meta_description, content_type_id, service_area_id, target_keyword, secondary_keywords, tags, source, author_name, publish_date, body_markdown, word_count, status, owner_id, created_at, updated_at, published_url, content_types(label), service_areas(label), owner:profiles!articles_owner_id_fkey(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("article_events").select("id, kind, note, created_at, actor_id, actor:profiles(full_name)").eq("article_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }),
    supabase.from("article_checks").select("rule_key, result, message").eq("article_id", id),
    supabase.from("publish_jobs").select("id, state, pr_url, live_url, http_status, in_sitemap, error_message, created_at").eq("article_id", id).order("created_at", { ascending: false }),
    supabase.from("content_types").select("id, label").order("sort_order"),
    supabase.from("service_areas").select("id, label").order("sort_order"),
    supabase.from("keywords").select("phrase").order("phrase"),
    loadSiteContext(supabase, id),
  ]);

  const a = articleRes.data as unknown as ArticleRow | null;
  if (!a) notFound();

  const events = (eventsRes.data ?? []) as unknown as EventRow[];
  const checks = ((checksRes.data ?? []) as CheckRow[]).sort(
    (x, y) => Object.keys(checkLabels).indexOf(x.rule_key) - Object.keys(checkLabels).indexOf(y.rule_key),
  );
  const jobs = (jobsRes.data ?? []) as JobRow[];
  const problems = blockingProblems(a, site);
  const isSample = a.drive_file_id.startsWith("seed_");
  const ownerName = a.owner_id ? a.owner?.full_name || "Unnamed member" : FORMER_MEMBER;
  const isOwner = a.owner_id === user.id;
  const isApprover = user.role === "approver";
  // Mirrors the database rules; the database still has the final say.
  const canEdit = a.status === "draft" && (isOwner || isApprover);

  const articleText = (
    <section aria-labelledby="body" className="rounded-lg border border-border bg-surface p-5">
      <h2 id="body" className="font-semibold">Article text</h2>
      {a.body_markdown.trim() ? (
        // react-markdown never renders raw HTML, so text from a Doc cannot inject scripts.
        <div className="mt-3 space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_h2]:mt-5 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">
          <Markdown>{a.body_markdown}</Markdown>
        </div>
      ) : (
        <p className="mt-3 text-sm italic text-muted">No text yet. It appears here once the Doc is converted.</p>
      )}
    </section>
  );

  const historyAndPublishing = (
    <>
          <section aria-labelledby="history" className="rounded-lg border border-border bg-surface p-5">
            <h2 id="history" className="font-semibold">History</h2>
            <ol className="mt-2 space-y-3 border-l border-border pl-4 text-sm">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span aria-hidden className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <p className="font-medium">{eventLabels[e.kind] ?? e.kind}</p>
                  <p className="text-xs text-muted">
                    {e.actor_id ? e.actor?.full_name || "Unnamed member" : FORMER_MEMBER} · {formatDateTime(e.created_at)}
                  </p>
                  {e.note ? <p className="mt-1 rounded-md bg-background px-2 py-1 text-xs">“{e.note}”</p> : null}
                </li>
              ))}
            </ol>
          </section>

          {jobs.length > 0 ? (
            <section aria-labelledby="publishing" className="rounded-lg border border-border bg-surface p-5">
              <h2 id="publishing" className="font-semibold">Publish attempts</h2>
              <ul className="mt-2 space-y-3 text-sm">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <div className="flex items-center gap-2">
                      <CountChip tone={j.state === "verified" ? "success" : j.state === "failed" ? "danger" : "warning"}>
                        {publishStateLabels[j.state] ?? j.state}
                      </CountChip>
                    </div>
                    <p className="mt-1 text-xs text-muted">{formatDateTime(j.created_at)}</p>
                    {j.error_message ? <p className="mt-1 text-xs text-danger">{j.error_message}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
    </>
  );

  return (
    <>
      <Link href="/board" className="text-sm font-medium text-primary underline underline-offset-2">
        Back to the board
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={a.status} />
            {a.source === "ai_draft" ? <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">AI draft, needs expert review</span> : null}
            {isSample ? <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted">Sample data</span> : null}
          </div>
          <h1 className={`mt-2 font-display text-2xl font-bold ${a.title ? "" : "italic text-muted"}`}>{a.title || "Untitled draft"}</h1>
          <p className="mt-1 text-sm text-muted">
            Owned by {ownerName} · {a.source === "ai_draft" ? "generated" : "imported"} {formatDate(a.created_at)} · updated {formatDate(a.updated_at)}
          </p>
        </div>
        {isSample ? null : (
          <a
            href={`https://docs.google.com/document/d/${encodeURIComponent(a.drive_file_id)}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-border/40"
          >
            Open in Google Docs
          </a>
        )}
      </header>

      {notes.imported ? (
        <div className="mt-4 space-y-2">
          <FormMessage tone="success" message="Imported from Google Drive as a draft. Fill in the details below, then submit it for review." />
          {notes.images ? (
            <FormMessage message={`${Number(notes.images)} image${Number(notes.images) === 1 ? " was" : "s were"} left out of the text. Images aren't supported yet.`} />
          ) : null}
          {notes.truncated ? <FormMessage message="The Doc was very long, so only the first part was imported. Consider splitting it." /> : null}
        </div>
      ) : null}
      {a.status === "in_review" || a.status === "approved" ? (
        <section aria-labelledby="next-step" className="mt-4 rounded-lg border border-border bg-surface p-4">
          <h2 id="next-step" className="text-sm font-semibold">
            {a.status === "in_review" ? "Review" : "Next step"}
          </h2>
          <div className="mt-2">
            <WorkflowActions id={a.id} status={a.status} isApprover={isApprover} isOwner={isOwner} />
          </div>
          {a.status === "approved" ? (
            <p className="mt-3 text-xs text-muted">Publishing to the site arrives in stage 8. Approved content is locked, so what was approved is exactly what will go live.</p>
          ) : null}
        </section>
      ) : null}
      {a.status === "draft" && !canEdit ? (
        <div className="mt-4">
          <FormMessage tone="success" message={`This draft belongs to ${ownerName}. Only its owner or an approver can edit it.`} />
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-6">
          <ArticleEditor
            key={a.id}
            article={a}
            updatedAt={a.updated_at}
            types={(typesRes.data ?? []) as { id: number; label: string }[]}
            areas={(areasRes.data ?? []) as { id: number; label: string }[]}
            ownerName={ownerName}
            afterForm={articleText}
            canRefresh={!isSample}
            site={site}
            keywords={((keywordsRes.data ?? []) as { phrase: string }[]).map((k) => k.phrase)}
          >
            {historyAndPublishing}
          </ArticleEditor>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-6">
          <section aria-labelledby="details" className="rounded-lg border border-border bg-surface p-5">
            <h2 id="details" className="font-semibold">Details</h2>
            <dl className="mt-2 divide-y divide-border">
              <Field label="Title" value={a.title} hint={a.title ? `${a.title.length} / ${LIMITS.titleMax}` : undefined} />
              <Field label="URL slug" value={a.slug ? <code className="text-xs">{SITE_PREFIX}{a.slug}</code> : null} />
              <Field label="Meta description" value={a.meta_description} hint={a.meta_description ? `${a.meta_description.length} / ${LIMITS.metaMax}` : undefined} />
              <Field label="Type" value={a.content_types?.label} />
              <Field label="Service area" value={a.service_areas?.label} />
              <Field label="Main keyword" value={a.target_keyword} />
              <Field label="Extra keywords" value={a.secondary_keywords.length ? a.secondary_keywords.join(", ") : <span className="italic text-muted">None</span>} />
              <Field
                label="Tags"
                value={a.tags.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {a.tags.map((t) => <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t}</span>)}
                  </span>
                ) : null}
              />
              <Field label="Author" value={a.author_name} />
              <Field label="Publish date" value={a.publish_date ? formatDate(`${a.publish_date}T12:00:00Z`) : null} />
              <Field label="Length" value={`${a.word_count} words`} />
              {a.published_url ? (
                <Field
                  label="Live page"
                  value={isSample ? <span className="break-all">{a.published_url}</span> : <a href={a.published_url} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-2">{a.published_url}</a>}
                  hint={isSample ? "(sample address)" : undefined}
                />
              ) : null}
            </dl>
          </section>

            {articleText}
          </div>

          <aside className="space-y-6">
          <section aria-labelledby="ready" className="rounded-lg border border-border bg-surface p-5">
            <h2 id="ready" className="font-semibold">Ready to submit?</h2>
            {problems.length === 0 ? (
              <p className="mt-2 text-sm text-success">Everything the site needs is filled in correctly.</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">Fix these before it can go for review:</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {problems.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden className="text-danger">●</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="tips" className="rounded-lg border border-border bg-surface p-5">
            <h2 id="tips" className="font-semibold">Findability tips</h2>
            {checks.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Not checked yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {checks.map((c) => (
                  <li key={c.rule_key} className="flex gap-2">
                    <span aria-hidden className={`w-4 shrink-0 text-center ${c.result === "pass" ? "text-success" : "text-warning"}`}>{c.result === "pass" ? "✓" : "!"}</span>
                    <span>
                      <span className="font-medium">{checkLabels[c.rule_key] ?? c.rule_key}</span>
                      <span className="block text-xs text-muted">{c.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

            {historyAndPublishing}
          </aside>
        </div>
      )}
    </>
  );
}
