import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { FormMessage } from "@/components/form-fields";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, requestNow, timeAgo, FORMER_MEMBER } from "@/lib/content/status";
import { LIMITS, REGIONS, REGION_SLUGS, countryLabel, regionBySlug, trendsUrl, type RegionSlug } from "@/lib/ideas/regions";
import { isSearchConfigured } from "@/lib/ideas/search";
import { isAiConfigured, summarySchema } from "@/lib/ideas/summarize";
import { ResultView } from "./result-view";
import { SearchForm } from "./search-form";
import { IdeasMap, type MapArea } from "./ideas-map";
import { HeadlinePanel } from "./headline-panel";
import { PlannedArticles } from "./planned-articles";
import { storedHeadlines } from "@/lib/drafts/headlines";
import { DRAFT_LIMITS } from "@/lib/drafts/style";

export const metadata: Metadata = { title: "Ideas" };

// Writing a draft can take the AI up to a minute or two.
export const maxDuration = 120;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Saved rows are checked again before they are shown, the same way they
// were checked before they were saved.
const resultsSchema = z.array(z.object({ title: z.string().max(200), url: z.string().regex(/^https?:\/\//i).max(500), snippet: z.string().max(500) })).max(10);

type Row = {
  id: string;
  keyword: string;
  region: RegionSlug;
  results: unknown;
  summary: unknown;
  ai_status: "ok" | "failed" | "not_configured";
  created_at: string;
  requested_by: string | null;
  requester: { full_name: string } | null;
};
const COLUMNS = "id, keyword, region, results, summary, ai_status, created_at, requested_by, requester:profiles(full_name)";
const HEADLINE_COLUMNS = "id, headlines, created_at, requested_by, requester:profiles(full_name)";
type HeadlineRow = { id: string; headlines: unknown; created_at: string; requested_by: string | null; requester: { full_name: string } | null };

export default async function IdeasPage({ searchParams }: PageProps<"/ideas">) {
  await requireActiveUser();
  const sp = await searchParams;
  const searchId = z.uuid().optional().catch(undefined).parse(first(sp.search) || undefined);
  const presetKeyword = (first(sp.keyword) ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const presetRegion = z.enum(REGION_SLUGS).catch("alberta").parse(first(sp.region) ?? "alberta");
  // Recent research as a list (default) or on a map.
  const view = z.enum(["list", "map"]).catch("list").parse(first(sp.view) ?? "list");

  const headlinesId = z.uuid().optional().catch(undefined).parse(first(sp.headlines) || undefined);

  const supabase = await createClient();
  const [keywordsRes, usageRes, recentRes, selectedRes, headlineRes, draftUsageRes, areasRes, typesRes] = await Promise.all([
    supabase.from("keywords").select("phrase").eq("status", "active").order("phrase"),
    supabase.rpc("idea_search_usage").single(),
    view === "map"
      ? supabase.from("idea_searches").select("id, keyword, region, ai_status, created_at").order("created_at", { ascending: false }).limit(500)
      : supabase.from("idea_searches").select(COLUMNS).order("created_at", { ascending: false }).limit(12),
    searchId ? supabase.from("idea_searches").select(COLUMNS).eq("id", searchId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    // The headlines asked for in this link, or else the latest ones for this research.
    searchId
      ? (headlinesId
          ? supabase.from("draft_requests").select(HEADLINE_COLUMNS).eq("id", headlinesId).eq("search_id", searchId)
          : supabase.from("draft_requests").select(HEADLINE_COLUMNS).eq("search_id", searchId).eq("kind", "headlines").eq("status", "ok").order("created_at", { ascending: false }).limit(1)
        ).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.rpc("draft_request_usage").single(),
    supabase.from("service_areas").select("slug, label"),
    supabase.from("content_types").select("slug, label"),
  ]);

  const usage = usageRes.data as { mine_today: number; team_this_month: number } | null;
  const usedToday = Number(usage?.mine_today ?? 0);
  const usedMonth = Number(usage?.team_this_month ?? 0);
  const recent = (recentRes.data ?? []) as unknown as Row[];
  const viewHref = (v: "list" | "map") => {
    const q = new URLSearchParams();
    if (searchId) q.set("search", searchId);
    if (v === "map") q.set("view", "map");
    const s = q.toString();
    return s ? `/ideas?${s}` : "/ideas";
  };
  const selected = selectedRes.data as unknown as Row | null;
  const now = requestNow();

  const results = selected ? resultsSchema.safeParse(selected.results) : null;
  const summary = selected?.ai_status === "ok" ? summarySchema.safeParse(selected.summary) : null;
  const region = selected ? regionBySlug(selected.region) : null;
  const who = (r: { requested_by: string | null; requester: { full_name: string } | null }) => (r.requested_by ? r.requester?.full_name || "Unnamed member" : FORMER_MEMBER);

  const headlineRow = headlineRes.data as unknown as HeadlineRow | null;
  const headlineList = headlineRow ? storedHeadlines.safeParse(headlineRow.headlines) : null;
  const savedHeadlines = headlineRow && headlineList?.success && headlineList.data.length
    ? { requestId: headlineRow.id, headlines: headlineList.data, byline: `suggested for ${who(headlineRow)} ${timeAgo(headlineRow.created_at, now)}` }
    : null;
  const draftUsage = draftUsageRes.data as { drafts_today: number; drafts_this_month: number } | null;
  const allowance = draftUsage
    ? `You have ${Math.max(0, DRAFT_LIMITS.draftsPerPersonPerDay - Number(draftUsage.drafts_today))} of ${DRAFT_LIMITS.draftsPerPersonPerDay} drafts left today; the team has written ${Number(draftUsage.drafts_this_month)} of ${DRAFT_LIMITS.draftsTeamPerMonth} this month.`
    : "";
  const labels = (rows: { slug: string; label: string }[] | null) => Object.fromEntries((rows ?? []).map((r) => [r.slug, r.label]));

  return (
    <>
      <PageHeader title="Ideas" description="Pick a keyword and an area. The hub searches the web, then explains what people searching for it want and suggests article angles." />

      {!isSearchConfigured() ? (
        <div className="mb-4">
          <FormMessage message="Web search isn't connected yet. An admin needs to add the search key before research can run. Earlier research is still shown below." />
        </div>
      ) : !isAiConfigured() ? (
        <div className="mb-4">
          <FormMessage tone="success" message="The AI summary isn't connected yet, so research shows the search results only." />
        </div>
      ) : null}

      <SearchForm
        key={`${selected?.id ?? presetKeyword}`}
        keywords={((keywordsRes.data ?? []) as { phrase: string }[]).map((k) => k.phrase)}
        regions={REGIONS.map((r) => ({ slug: r.slug, label: r.label, country: r.country }))}
        defaultKeyword={selected?.keyword ?? presetKeyword}
        defaultRegion={selected?.region ?? presetRegion}
        disabled={!isSearchConfigured()}
      />
      <p className="mt-2 text-xs text-muted">
        {usageRes.error
          ? "Couldn't load the allowance."
          : `You have ${Math.max(0, LIMITS.perPersonPerDay - usedToday)} of ${LIMITS.perPersonPerDay} research requests left today. The team has used ${usedMonth} of ${LIMITS.teamPerMonth} web searches this month.`}{" "}
        Research from the last {LIMITS.reuseDays} days is reused instead of searched again.
      </p>

      {searchId && !selected ? (
        <div className="mt-6">
          <FormMessage message="That research couldn't be found. It may have been a mistyped link." />
        </div>
      ) : null}

      {selected && region ? (
        <ResultView
          keyword={selected.keyword}
          regionLabel={region.label}
          trendsHref={trendsUrl(selected.keyword, region.country)}
          byline={`Researched by ${who(selected)} · ${formatDateTime(selected.created_at)}${first(sp.reused) ? " · reused, no new search was needed" : ""}`}
          trendsCountry={countryLabel(region.country)}
          aiStatus={selected.ai_status}
          summary={summary?.success ? summary.data : null}
          results={results?.success ? results.data : null}
        />
      ) : null}

      {selected && region ? (
        <HeadlinePanel
          searchId={selected.id}
          saved={savedHeadlines}
          areaLabels={labels(areasRes.data as { slug: string; label: string }[] | null)}
          typeLabels={labels(typesRes.data as { slug: string; label: string }[] | null)}
          allowance={allowance}
          disabled={!isAiConfigured()}
        />
      ) : (
        <PlannedArticles />
      )}

      <section aria-labelledby="recent" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent" className="font-semibold">Recent research by the team</h2>
          {/* Two ways to see the same research: a list, or by area on a map. */}
          <nav aria-label="How to show research" className="flex rounded-full border border-border bg-surface p-1 text-sm">
            {(["list", "map"] as const).map((v) => (
              <Link
                key={v}
                href={viewHref(v)}
                scroll={false}
                aria-current={view === v ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 font-medium transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
              >
                {v === "list" ? "List" : "Map"}
              </Link>
            ))}
          </nav>
        </div>
        {view === "map" ? (
          recentRes.error ? (
            <div className="mt-2"><FormMessage message="Couldn't load earlier research. Refresh the page to try again." /></div>
          ) : (
            <div className="mt-3">
              <IdeasMap
                initial={first(sp.region) ? presetRegion : selected?.region}
                areas={REGIONS.map((r): MapArea => {
                  const here = recent.filter((x) => x.region === r.slug);
                  return {
                    slug: r.slug,
                    label: r.label,
                    country: r.country,
                    count: here.length,
                    research: here.slice(0, 6).map((x) => ({ id: x.id, keyword: x.keyword, when: timeAgo(x.created_at, now), resultsOnly: x.ai_status !== "ok" })),
                  };
                })}
              />
            </div>
          )
        ) : (
          <>
        {recentRes.error ? (
            <div className="mt-2"><FormMessage message="Couldn't load earlier research. Refresh the page to try again." /></div>
          ) : recent.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center">
              <p className="font-medium">No research yet</p>
              <p className="mt-1 text-sm text-muted">Research a keyword above and it will be saved here for the whole team.</p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/ideas?search=${r.id}`} aria-current={r.id === selected?.id ? "page" : undefined} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-background ${r.id === selected?.id ? "bg-background" : ""}`}>
                    <span className="min-w-0">
                      <span className="font-medium">{r.keyword}</span>
                      <span className="text-muted"> · {regionBySlug(r.region)?.label ?? r.region}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {r.ai_status !== "ok" ? <span className="rounded-full bg-warning/10 px-2 py-0.5 font-semibold text-warning">Results only</span> : null}
                      {who(r)} · {timeAgo(r.created_at, now)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          </>
        )}
      </section>
    </>
  );
}
