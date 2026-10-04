import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { FormMessage } from "@/components/form-fields";
import { StatusBadge, CountChip } from "@/components/status-badge";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ArticleStatus } from "@/lib/content/status";

export const metadata: Metadata = { title: "Keywords" };

type Category = { id: number; name: string };
type Keyword = { id: number; category_id: number; phrase: string };
type Usage = { keyword_id: number; article_count: number; published_count: number };
type KeywordArticle = { id: string; title: string | null; status: ArticleStatus; is_main: boolean };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The owner's keyword library, with how well the hub's articles cover it.
 * A keyword nobody has written about yet is the next article idea.
 */
export default async function KeywordsPage({ searchParams }: PageProps<"/keywords">) {
  await requireActiveUser();
  const sp = await searchParams;
  const show = z.enum(["all", "unused", "used"]).catch("all").parse(first(sp.show) ?? "all");
  const selectedId = z.coerce.number().int().positive().optional().catch(undefined).parse(first(sp.keyword) || undefined);

  const supabase = await createClient();
  const [categoriesRes, keywordsRes, usageRes, articlesRes] = await Promise.all([
    supabase.from("keyword_categories").select("id, name").order("sort_order"),
    supabase.from("keywords").select("id, category_id, phrase").order("phrase"),
    supabase.rpc("keyword_usage"),
    selectedId ? supabase.rpc("articles_for_keyword", { p_keyword_id: selectedId }) : Promise.resolve({ data: [], error: null }),
  ]);

  const failed = Boolean(categoriesRes.error || keywordsRes.error || usageRes.error);
  const categories = (categoriesRes.data ?? []) as Category[];
  const keywords = (keywordsRes.data ?? []) as Keyword[];
  const usage = new Map(((usageRes.data ?? []) as Usage[]).map((u) => [u.keyword_id, u]));
  const count = (k: Keyword) => Number(usage.get(k.id)?.article_count ?? 0);
  const published = (k: Keyword) => Number(usage.get(k.id)?.published_count ?? 0);

  const covered = keywords.filter((k) => count(k) > 0).length;
  const live = keywords.filter((k) => published(k) > 0).length;
  const selected = keywords.find((k) => k.id === selectedId);
  const selectedArticles = (articlesRes.data ?? []) as KeywordArticle[];

  const href = (change: { show?: string; keyword?: number | null }) => {
    const p = new URLSearchParams();
    const nextShow = change.show ?? show;
    const nextKeyword = change.keyword === undefined ? selectedId : change.keyword;
    if (nextShow !== "all") p.set("show", nextShow);
    if (nextKeyword) p.set("keyword", String(nextKeyword));
    const s = p.toString();
    return s ? `/keywords?${s}` : "/keywords";
  };

  const tabs = [
    { key: "all", label: "All", n: keywords.length },
    { key: "unused", label: "No article yet", n: keywords.length - covered },
    { key: "used", label: "Has an article", n: covered },
  ];
  const visible = (k: Keyword) => show === "all" || (show === "used" ? count(k) > 0 : count(k) === 0);

  return (
    <>
      <PageHeader title="Keywords" description="The search phrases EPCMst wants to be found for, and which ones the hub's articles already target." />

      {failed ? (
        <FormMessage message="Couldn't load the keyword library. Refresh the page to try again." />
      ) : keywords.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="font-medium">No keywords yet</p>
          <p className="mt-1 text-sm text-muted">The keyword library is empty. An admin needs to load it.</p>
        </div>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Keywords in the library", value: keywords.length },
              { label: "Targeted by an article", value: `${covered} of ${keywords.length}` },
              { label: "Live on the site", value: `${live} of ${keywords.length}` },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-surface p-4">
                <dt className="text-sm text-muted">{s.label}</dt>
                <dd className="mt-1 font-display text-2xl font-bold">{s.value}</dd>
              </div>
            ))}
          </dl>

          {selectedId ? (
            <section aria-labelledby="keyword-articles" className="mt-6 rounded-lg border border-primary/40 bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 id="keyword-articles" className="font-semibold">
                  {selected ? <>Articles targeting “{selected.phrase}”</> : "That keyword isn't in the library"}
                </h2>
                <Link href={href({ keyword: null })} className="text-sm font-medium text-primary underline underline-offset-2">Close</Link>
              </div>
              {articlesRes.error ? (
                <p role="alert" className="mt-2 text-sm text-danger">Couldn&apos;t load these articles. Refresh the page to try again.</p>
              ) : selected && selectedArticles.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No article targets this keyword yet. It&apos;s a good candidate for the next one.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {selectedArticles.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <StatusBadge status={a.status} />
                      <Link href={`/articles/${a.id}`} className={`font-medium text-primary underline underline-offset-2 ${a.title ? "" : "italic"}`}>
                        {a.title || "Untitled draft"}
                      </Link>
                      <span className="text-xs text-muted">{a.is_main ? "main keyword" : "extra keyword"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <nav aria-label="Filter keywords" className="mt-6 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={href({ show: t.key })}
                aria-current={show === t.key ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${show === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-border/40"}`}
              >
                {t.label} <span className="opacity-80">({t.n})</span>
              </Link>
            ))}
          </nav>

          <div className="mt-4 space-y-6">
            {categories.map((c) => {
              const inCategory = keywords.filter((k) => k.category_id === c.id);
              const shown = inCategory.filter(visible);
              const done = inCategory.filter((k) => count(k) > 0).length;
              return (
                <section key={c.id} aria-labelledby={`cat-${c.id}`} className="rounded-lg border border-border bg-surface">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                    <h2 id={`cat-${c.id}`} className="font-semibold">{c.name}</h2>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-border" aria-hidden>
                        <div className="h-full bg-primary" style={{ width: `${inCategory.length ? Math.round((done / inCategory.length) * 100) : 0}%` }} />
                      </div>
                      <span className="text-sm text-muted">{done} of {inCategory.length} targeted</span>
                    </div>
                  </div>
                  {shown.length === 0 ? (
                    <p className="p-4 text-sm text-muted">
                      {show === "unused" ? "Every keyword in this group has an article." : "No keyword in this group has an article yet."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {shown.map((k) => (
                        <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                          <span className={k.id === selectedId ? "font-semibold" : ""}>{k.phrase}</span>
                          <span className="flex items-center gap-3">
                          {count(k) > 0 ? (
                            <Link href={href({ keyword: k.id })} className="flex items-center gap-2 underline-offset-2 hover:underline" aria-label={`See the articles targeting ${k.phrase}`}>
                              <CountChip tone="success">
                                {count(k)} {count(k) === 1 ? "article" : "articles"}
                              </CountChip>
                              <span className="text-xs text-muted">{published(k)} live</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted">No article yet</span>
                          )}
                          <Link href={`/ideas?${new URLSearchParams({ keyword: k.phrase })}`} className="text-xs font-medium text-primary underline underline-offset-2" aria-label={`Research ${k.phrase}`}>
                            Research
                          </Link>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted">
            A keyword counts as targeted when an article uses it as its main keyword or one of its two extra keywords.
          </p>
        </>
      )}
    </>
  );
}
