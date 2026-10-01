import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { FormMessage } from "@/components/form-fields";
import { StatusBadge, CountChip } from "@/components/status-badge";
import { requireActiveUser } from "@/lib/auth";
import { blockingProblemsFor } from "@/lib/content/rules";
import { STATUSES, statusMeta, timeAgo, requestNow, FORMER_MEMBER } from "@/lib/content/status";
import { loadBoard, parseBoardParams, PAGE_SIZE, type BoardParams } from "@/lib/content/board-query";

export const metadata: Metadata = { title: "Board" };

/** Build a board link that keeps the current filters but changes some of them. */
function boardHref(p: BoardParams, change: Partial<Record<keyof BoardParams, string | number | undefined>>) {
  const merged: Record<string, string | number | undefined> = { ...p, ...change };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === "" || (k === "status" && v === "all") || (k === "sort" && v === "updated") || (k === "page" && v === 1)) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `/board?${s}` : "/board";
}

const selectClass = "rounded-md border border-border bg-background px-3 py-2 text-sm";

export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  const user = await requireActiveUser();
  const sp = await searchParams;
  const params = parseBoardParams(sp);
  const board = await loadBoard(params, user.id);
  const now = requestNow();

  const filtersActive = Boolean(params.q || params.type || params.area || params.owner);
  const firstShown = board.total === 0 ? 0 : (params.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(params.page * PAGE_SIZE, board.total);
  const lastPage = Math.max(1, Math.ceil(board.total / PAGE_SIZE));

  const tiles = [
    { key: "all" as const, label: "All articles", count: board.counts.all, dot: "bg-primary" },
    ...STATUSES.map((s) => ({ key: s, label: statusMeta[s].label, count: board.counts[s], dot: statusMeta[s].dot })),
  ];

  return (
    <>
      {sp.deleted ? (
        <div className="mb-4">
          <FormMessage tone="success" message="The draft was deleted." />
        </div>
      ) : null}
      {sp.passwordUpdated ? (
        <div className="mb-4">
          <FormMessage tone="success" message="Your password has been updated." />
        </div>
      ) : null}

      <PageHeader
        title="Board"
        description="Every Knowledge Hub article and exactly where it stands."
        action={
          <Link href="/import" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            New article from Drive
          </Link>
        }
      />

      {/* Status tiles: counts follow the search and filters below. */}
      <nav aria-label="Filter by status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => {
          const active = params.status === t.key;
          return (
            <Link
              key={t.key}
              href={boardHref(params, { status: t.key, page: 1 })}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg border bg-surface px-4 py-3 transition-colors ${
                active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
              }`}
            >
              <span className="flex items-center gap-2 text-sm text-muted">
                <span aria-hidden className={`h-2 w-2 rounded-full ${t.dot}`} />
                {t.label}
              </span>
              <span className="mt-1 block font-display text-2xl font-bold">{t.count}</span>
            </Link>
          );
        })}
      </nav>

      {/* Search and filters: a plain form, so it works even before scripts load. */}
      <form method="get" action="/board" className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
        {params.status !== "all" ? <input type="hidden" name="status" value={params.status} /> : null}
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="block text-xs font-medium text-muted">
            Search title, keyword or URL
          </label>
          <input id="q" name="q" type="search" defaultValue={params.q} maxLength={100} placeholder="e.g. modular construction" className={`mt-1 w-full ${selectClass}`} />
        </div>
        <div>
          <label htmlFor="type" className="block text-xs font-medium text-muted">Type</label>
          <select id="type" name="type" defaultValue={params.type ?? ""} className={`mt-1 ${selectClass}`}>
            <option value="">All types</option>
            {board.typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="area" className="block text-xs font-medium text-muted">Service area</label>
          <select id="area" name="area" defaultValue={params.area ?? ""} className={`mt-1 ${selectClass}`}>
            <option value="">All areas</option>
            {board.areaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="owner" className="block text-xs font-medium text-muted">Owner</label>
          <select id="owner" name="owner" defaultValue={params.owner ?? ""} className={`mt-1 ${selectClass}`}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
            {board.ownerOptions.filter((o) => o.value !== user.id).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="block text-xs font-medium text-muted">Sort by</label>
          <select id="sort" name="sort" defaultValue={params.sort} className={`mt-1 ${selectClass}`}>
            <option value="updated">Recently updated</option>
            <option value="created">Recently imported</option>
            <option value="title">Title A to Z</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Search
          </button>
          {filtersActive ? (
            <Link href={boardHref({ ...params, q: "", type: undefined, area: undefined, owner: undefined }, { page: 1 })} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-border/40">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {board.error ? (
        <div className="mt-6">
          <FormMessage message="Couldn't load articles. Refresh the page to try again." />
        </div>
      ) : null}

      <p className="mt-6 text-sm text-muted" aria-live="polite">
        {board.total === 0 ? "No articles match." : `Showing ${firstShown} to ${lastShown} of ${board.total}`}
      </p>

      {board.rows.length === 0 && !board.error ? (
        <div className="mt-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="font-medium">{filtersActive || params.status !== "all" ? "Nothing matches these filters" : "No articles yet"}</p>
          <p className="mt-1 text-sm text-muted">
            {filtersActive || params.status !== "all" ? (
              <Link href="/board" className="font-medium text-primary underline underline-offset-2">Show all articles</Link>
            ) : (
              "Import a finished Google Doc to get started."
            )}
          </p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
          {board.rows.map((a) => {
            const problems = a.status === "draft" ? blockingProblemsFor(a).length : 0;
            const warnings = a.article_checks.filter((c) => c.result !== "pass").length;
            return (
              <li key={a.id}>
                <Link href={`/articles/${a.id}`} className="flex flex-wrap items-start justify-between gap-3 p-4 hover:bg-background">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={a.status} />
                      <span className={`font-medium ${a.title ? "" : "italic text-muted"}`}>{a.title || "Untitled draft"}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {[a.content_types?.label, a.service_areas?.label].filter(Boolean).join(" · ") || "No type or area yet"}
                      {" · "}
                      {a.owner_id ? a.owner?.full_name || "Unnamed member" : FORMER_MEMBER}
                      {" · "}updated {timeAgo(a.updated_at, now)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {a.status === "draft" ? (
                      problems > 0 ? (
                        <CountChip tone="danger">{problems} to fix</CountChip>
                      ) : (
                        <CountChip tone="success">Ready to submit</CountChip>
                      )
                    ) : null}
                    {warnings > 0 ? <CountChip tone="warning">{warnings} {warnings === 1 ? "tip" : "tips"}</CountChip> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {board.total > PAGE_SIZE ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          {params.page > 1 ? (
            <Link href={boardHref(params, { page: params.page - 1 })} className="rounded-md border border-border bg-surface px-3 py-1.5 font-medium hover:bg-border/40">
              Previous
            </Link>
          ) : (
            <span className="rounded-md border border-border px-3 py-1.5 text-muted opacity-50" aria-disabled="true">Previous</span>
          )}
          <span className="text-muted">
            Page {params.page} of {lastPage}
          </span>
          {params.page < lastPage ? (
            <Link href={boardHref(params, { page: params.page + 1 })} className="rounded-md border border-border bg-surface px-3 py-1.5 font-medium hover:bg-border/40">
              Next
            </Link>
          ) : (
            <span className="rounded-md border border-border px-3 py-1.5 text-muted opacity-50" aria-disabled="true">Next</span>
          )}
        </nav>
      ) : null}
    </>
  );
}
