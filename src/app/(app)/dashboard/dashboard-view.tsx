import Link from "next/link";
import type { IconType } from "react-icons";
import { PiArrowDownBold, PiArrowUpBold, PiCaretUpDownBold, PiGlobeHemisphereWestBold, PiHourglassMediumBold, PiMagnifyingGlassBold, PiPencilSimpleLineBold, PiPlusBold, PiSealCheckBold } from "react-icons/pi";
import { Pagination } from "@/components/pagination";
import { FormMessage } from "@/components/form-fields";
import { StatusBadge, CountChip } from "@/components/status-badge";
import { blockingProblemsFor } from "@/lib/content/rules";
import { siteContextFor } from "@/lib/content/site-context";
import { STATUSES, statusMeta, timeAgo, FORMER_MEMBER, type ArticleStatus } from "@/lib/content/status";
import { PAGE_SIZE, type BoardParams, type loadBoard } from "@/lib/content/board-query";
import type { Overview } from "@/lib/content/overview-math";
import { ActivityPanel, Sparkline } from "./dashboard-charts";

/** Build a dashboard link that keeps the current filters but changes some of them. */
function boardHref(p: BoardParams, change: Partial<Record<keyof BoardParams, string | number | undefined>>, hash = "") {
  const merged: Record<string, string | number | undefined> = { ...p, ...change };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === "" || (k === "status" && v === "all") || (k === "sort" && v === "updated") || (k === "page" && v === 1)) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return (s ? `/dashboard?${s}` : "/dashboard") + hash;
}

function greeting(now: number) {
  const hour = Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hourCycle: "h23", timeZone: "America/Edmonton" }).format(now));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

const fieldClass = "h-9 rounded-lg border border-border bg-background px-3 text-sm";

const TILE_ICONS: Record<ArticleStatus, IconType> = {
  draft: PiPencilSimpleLineBold,
  in_review: PiHourglassMediumBold,
  approved: PiSealCheckBold,
  published: PiGlobeHemisphereWestBold,
};
const TILE_CHIPS: Record<ArticleStatus, string> = {
  draft: "bg-status-draft/15 text-status-draft",
  in_review: "bg-status-review/15 text-status-review",
  approved: "bg-status-approved/15 text-status-approved",
  published: "bg-status-published/15 text-status-published",
};

export type DashboardViewProps = {
  userId: string;
  fullName: string;
  sp: Record<string, string | string[] | undefined>;
  params: BoardParams;
  board: Awaited<ReturnType<typeof loadBoard>>;
  overview: Overview;
  now: number;
};

/** Everything the Dashboard shows, given its data (kept apart from loading so it can be previewed). */
export function DashboardView({ userId, fullName, sp, params, board, overview, now }: DashboardViewProps) {
  const user = { id: userId, fullName };
  const filtersActive = Boolean(params.q || params.type || params.area || params.owner);
  const firstShown = board.total === 0 ? 0 : (params.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(params.page * PAGE_SIZE, board.total);
  const lastPage = Math.max(1, Math.ceil(board.total / PAGE_SIZE));
  const firstName = (user.fullName || "").trim().split(/\s+/)[0];

  // The detail line under each number.
  const trend = overview.published30 - overview.publishedPrev30;
  const details: Record<ArticleStatus, React.ReactNode> = {
    draft: overview.newDrafts30 > 0 ? <><b className="font-semibold text-foreground">{overview.newDrafts30}</b> imported in the last 30 days</> : "None imported in the last 30 days",
    in_review:
      overview.oldestReviewDays === null ? "Nothing waiting for review" :
      overview.oldestReviewDays === 0 ? "All submitted today" :
      <>Oldest waiting <b className="font-semibold text-foreground">{overview.oldestReviewDays} {overview.oldestReviewDays === 1 ? "day" : "days"}</b></>,
    approved: overview.counts.approved > 0 ? "Ready to publish" : "Nothing waiting to publish",
    published: (
      <>
        {trend !== 0 ? (
          <span className={`inline-flex items-center gap-0.5 font-semibold ${trend > 0 ? "text-success" : "text-danger"}`}>
            {trend > 0 ? <PiArrowUpBold aria-hidden /> : <PiArrowDownBold aria-hidden />}
            <span className="sr-only">{trend > 0 ? "up" : "down"}</span>
          </span>
        ) : null}{" "}
        <b className="font-semibold text-foreground">{overview.published30}</b> in the last 30 days
      </>
    ),
  };

  const tabs = [{ key: "all" as const, label: "All", count: board.counts.all }, ...STATUSES.map((s) => ({ key: s, label: statusMeta[s].label, count: board.counts[s] }))];
  const mostPublished = Math.max(1, ...overview.areas.map((a) => a.published));
  const emptyAreas = overview.areas.filter((a) => a.published === 0).length;

  const sortLink = (key: "title" | "updated", label: string) => {
    const on = params.sort === key;
    return (
      <Link href={boardHref(params, { sort: key, page: 1 }, "#articles")} scroll={false} className={`inline-flex items-center gap-1 hover:text-foreground ${on ? "text-foreground" : ""}`} aria-label={`Sort by ${label.toLowerCase()}`}>
        {label}
        <PiCaretUpDownBold aria-hidden className={on ? "text-primary" : "opacity-60"} />
      </Link>
    );
  };

  return (
    // page-wide: this page uses the full width of the window (see the app layout).
    <div className="page-wide grid gap-4">
      {sp.deleted ? <FormMessage tone="success" message="The draft was deleted." /> : null}
      {sp.passwordUpdated ? <FormMessage tone="success" message="Your password has been updated." /> : null}

      {/* Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted">
            {greeting(now)}{firstName ? `, ${firstName}` : ""}. Here is where every Knowledge Hub article stands.
          </p>
        </div>
        <Link href="/import" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.15)] hover:opacity-90">
          <PiPlusBold aria-hidden /> New article from Drive
        </Link>
      </header>

      {overview.error ? <FormMessage message="Couldn't load the summary. Refresh the page to try again." /> : null}

      {/* Stat tiles: team-wide, each one opens the list filtered to that stage. */}
      <nav aria-label="Articles by stage" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {STATUSES.map((s) => {
          const Icon = TILE_ICONS[s];
          return (
            <Link
              key={s}
              href={boardHref(params, { status: s, page: 1 }, "#articles")}
              className={`group flex min-h-28 flex-col justify-between gap-3 rounded-2xl bg-surface p-3 sm:p-4 shadow-card transition hover:-translate-y-0.5 ${params.status === s ? "ring-2 ring-primary/40" : ""}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-muted">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] ${TILE_CHIPS[s]}`}>
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  {statusMeta[s].label}
                </span>
                {s === "published" ? <Sparkline values={overview.publishedMonths} /> : null}
              </span>
              <span>
                <span className="block font-display text-2xl sm:text-3xl font-semibold tracking-tight">{overview.counts[s]}</span>
                <span className="mt-1 block text-sm text-muted">{details[s]}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Activity chart and service-area coverage */}
      <div className="grid gap-3 xl:grid-cols-4">
        <ActivityPanel activity={overview.activity} />

        <section className="flex flex-col gap-2 rounded-2xl bg-surface p-2 shadow-card" aria-labelledby="areas-title">
          <div className="flex items-center justify-between gap-2 px-3 pt-2">
            <h2 id="areas-title" className="text-lg font-semibold">Service areas</h2>
            <span className="text-xs text-muted">published</span>
          </div>
          <ul className="flex-1 divide-y divide-border rounded-xl bg-background/60 px-3 shadow-card">
            {overview.areas.slice(0, 7).map((a) => (
              <li key={a.slug}>
                <Link href={boardHref(params, { area: a.slug, status: "all", page: 1 }, "#articles")} className="block py-2.5 hover:text-primary">
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{a.label}</span>
                    <span className="shrink-0 tabular-nums"><b className="font-semibold">{a.published}</b><span className="text-muted"> / {a.total}</span></span>
                  </span>
                  <span aria-hidden className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-border/70">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(a.published / mostPublished) * 100}%` }} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="px-3 pb-1 text-xs text-muted">
            {emptyAreas > 0 ? `${emptyAreas} of ${overview.areas.length} areas have nothing published yet.` : `Every area has at least one published article.`}
          </p>
        </section>
      </div>

      {/* The article list: search, filters, stage tabs and a sortable table. */}
      <section id="articles" className="scroll-mt-6 rounded-2xl bg-surface p-2 shadow-card" aria-labelledby="articles-title">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-2">
          <h2 id="articles-title" className="text-lg font-semibold">Articles</h2>
          <p className="text-sm text-muted" aria-live="polite">
            {board.total === 0 ? "No articles match." : `Showing ${firstShown} to ${lastShown} of ${board.total}`}
          </p>
        </div>

        <div className="mt-2 rounded-xl bg-background/60 p-3 shadow-card">
          {/* A plain form, so it works even before scripts load. */}
          <form method="get" action="/dashboard#articles" className="flex flex-wrap items-end gap-2">
            {params.status !== "all" ? <input type="hidden" name="status" value={params.status} /> : null}
            {params.sort !== "updated" ? <input type="hidden" name="sort" value={params.sort} /> : null}
            <div className="relative min-w-52 flex-1">
              <label htmlFor="q" className="sr-only">Search title, keyword or URL</label>
              <PiMagnifyingGlassBold aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input id="q" name="q" type="search" defaultValue={params.q} maxLength={100} placeholder="Search title, keyword or URL" className={`w-full pl-9 ${fieldClass}`} />
            </div>
            <label className="sr-only" htmlFor="type">Type</label>
            <select id="type" name="type" defaultValue={params.type ?? ""} className={fieldClass}>
              <option value="">All types</option>
              {board.typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label className="sr-only" htmlFor="area">Service area</label>
            <select id="area" name="area" defaultValue={params.area ?? ""} className={fieldClass}>
              <option value="">All areas</option>
              {board.areaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label className="sr-only" htmlFor="owner">Owner</label>
            <select id="owner" name="owner" defaultValue={params.owner ?? ""} className={fieldClass}>
              <option value="">Anyone</option>
              <option value="me">Me</option>
              {board.ownerOptions.filter((o) => o.value !== user.id).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="submit" className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">Search</button>
            {filtersActive ? (
              <Link href={boardHref({ ...params, q: "", type: undefined, area: undefined, owner: undefined }, { page: 1 }, "#articles")} className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-border/40">
                Clear
              </Link>
            ) : null}
          </form>

          {/* Stage tabs: counts follow the search and filters. */}
          <nav aria-label="Filter by stage" className="mt-3 flex flex-wrap gap-1">
            {tabs.map((t) => {
              const on = params.status === t.key;
              return (
                <Link
                  key={t.key}
                  href={boardHref(params, { status: t.key, page: 1 }, "#articles")}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${on ? "bg-surface text-foreground shadow-card" : "text-muted hover:text-foreground"}`}
                >
                  {t.key !== "all" ? <span aria-hidden className={`h-2 w-2 rounded-full ${statusMeta[t.key].dot}`} /> : null}
                  {t.label}
                  <span className="tabular-nums text-xs text-muted">{t.count}</span>
                </Link>
              );
            })}
          </nav>

          {board.error ? (
            <div className="mt-3"><FormMessage message="Couldn't load articles. Refresh the page to try again." /></div>
          ) : null}

          {board.rows.length === 0 && !board.error ? (
            <div className="mt-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
              <p className="font-medium">{filtersActive || params.status !== "all" ? "Nothing matches these filters" : "No articles yet"}</p>
              <p className="mt-1 text-sm text-muted">
                {filtersActive || params.status !== "all" ? (
                  <Link href="/dashboard#articles" className="font-medium text-primary underline underline-offset-2">Show all articles</Link>
                ) : (
                  "Import a finished Google Doc to get started."
                )}
              </p>
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-background text-muted">
                  <tr>
                    <th scope="col" className="h-9 px-3 font-medium">{sortLink("title", "Article")}</th>
                    <th scope="col" className="hidden h-9 px-3 font-medium sm:table-cell">Stage</th>
                    <th scope="col" className="hidden h-9 px-3 font-medium lg:table-cell">Type and area</th>
                    <th scope="col" className="hidden h-9 px-3 font-medium md:table-cell">Owner</th>
                    <th scope="col" className="hidden h-9 px-3 font-medium md:table-cell">{sortLink("updated", "Updated")}</th>
                    <th scope="col" className="h-9 px-3 text-right font-medium"><span className="sr-only">Checks</span></th>
                  </tr>
                </thead>
                <tbody>
                  {board.rows.map((a) => {
                    const problems = a.status === "draft" ? blockingProblemsFor(a, siteContextFor(board.sitePages, a.id)).length : 0;
                    const warnings = a.article_checks.filter((c) => c.result !== "pass").length;
                    return (
                      <tr key={a.id} className="relative border-t border-border bg-surface transition-colors hover:bg-background/70">
                        <td className="px-3 py-3">
                          {/* The whole row is clickable: this link stretches over it. */}
                          <Link href={`/articles/${a.id}`} className="font-medium after:absolute after:inset-0 after:content-['']">
                            <span className={a.title ? "" : "italic text-muted"}>{a.title || "Untitled draft"}</span>
                          </Link>
                          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="sm:hidden"><StatusBadge status={a.status} /></span>
                            {a.target_keyword ? <span>{a.target_keyword}</span> : null}
                            {a.source === "ai_draft" ? <span className="rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">AI draft</span> : null}
                          </span>
                        </td>
                        <td className="hidden px-3 py-3 sm:table-cell"><StatusBadge status={a.status} /></td>
                        <td className="hidden px-3 py-3 text-muted lg:table-cell">
                          {[a.content_types?.label, a.service_areas?.label].filter(Boolean).join(" · ") || "Not set yet"}
                        </td>
                        <td className="hidden px-3 py-3 md:table-cell">{a.owner_id ? a.owner?.full_name || "Unnamed member" : FORMER_MEMBER}</td>
                        <td className="hidden whitespace-nowrap px-3 py-3 text-muted md:table-cell">{timeAgo(a.updated_at, now)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className="inline-flex flex-wrap justify-end gap-1.5">
                            {a.status === "draft" ? (
                              problems > 0 ? <CountChip tone="danger">{problems} to fix</CountChip> : <CountChip tone="success">Ready</CountChip>
                            ) : null}
                            {warnings > 0 ? <CountChip tone="warning">{warnings} {warnings === 1 ? "tip" : "tips"}</CountChip> : null}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination current={params.page} last={lastPage} hrefFor={(page) => boardHref(params, { page }, "#articles")} />
        </div>
      </section>
    </div>
  );
}
