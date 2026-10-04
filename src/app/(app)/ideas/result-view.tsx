import type { IdeaSummary } from "@/lib/ideas/summarize";

const intentLabels: Record<string, string> = {
  informational: "Wants to learn",
  commercial: "Comparing options",
  transactional: "Ready to hire or buy",
  navigational: "Looking for a specific company",
  mixed: "Mixed",
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** One piece of saved research: the AI's reading on the left, the raw search results on the right. */
export function ResultView({
  keyword,
  regionLabel,
  trendsHref,
  byline,
  aiStatus,
  summary,
  results,
}: {
  keyword: string;
  regionLabel: string;
  trendsHref: string;
  byline: string;
  aiStatus: "ok" | "failed" | "not_configured";
  summary: IdeaSummary | null;
  results: { title: string; url: string; snippet: string }[] | null; // null = stored results unreadable
}) {
  return (
    <section aria-labelledby="result" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="result" className="font-display text-xl font-bold">“{keyword}” in {regionLabel}</h2>
          <p className="mt-1 text-sm text-muted">{byline}</p>
        </div>
        <a
          href={trendsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-border/40"
        >
          See interest over time in Google Trends
        </a>
      </div>
      <p className="mt-2 text-xs text-muted sm:text-right">
        Trends opens for all of Canada over five years. If it says there isn&apos;t enough data, the phrase is searched too rarely to chart, which is normal for specialist keywords and not a fault.
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          {summary ? (
            <>
              <div className="rounded-lg border border-border bg-surface p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">What searchers want</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{intentLabels[summary.intent]}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{summary.intent_summary}</p>
                <p className="mt-3 text-sm"><span className="font-medium">Who is searching: </span>{summary.audience}</p>
              </div>

              <div className="rounded-lg border border-border bg-surface p-5">
                <h3 className="font-semibold">Article angles</h3>
                <ol className="mt-3 space-y-3">
                  {summary.angles.map((a, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">{i + 1}</span>
                      <span>
                        <span className="font-medium">{a.title}</span>
                        <span className={`ml-2 whitespace-nowrap text-xs ${a.title.length > 70 ? "text-warning" : "text-muted"}`}>{a.title.length} / 70</span>
                        <span className="mt-0.5 block text-muted">{a.why}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {summary.questions.length > 0 ? (
                <div className="rounded-lg border border-border bg-surface p-5">
                  <h3 className="font-semibold">Questions the article should answer</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {summary.questions.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </div>
              ) : null}
              <p className="text-xs text-muted">
                Written by AI from the search results shown beside it. It can be wrong: treat it as a starting point and check anything you rely on.
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-5 text-sm">
              <p className="font-semibold">
                {aiStatus === "not_configured" ? "The AI summary isn't connected yet" : "The AI summary isn't available for this search"}
              </p>
              <p className="mt-1">
                {results && results.length === 0
                  ? "The web search found nothing for this keyword in this area, so there was nothing to summarise. Try a broader keyword or the whole of Western Canada."
                  : aiStatus === "not_configured"
                    ? "The search results are still shown. Once an admin adds the AI key, research this keyword again to get the summary. The saved results are reused, so it won't spend another search."
                    : "The AI service didn't give a usable answer. The search results are still shown. Research this keyword again to retry. The saved results are reused, so it won't spend another search."}
              </p>
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-border bg-surface p-5 lg:self-start">
          <h3 className="font-semibold">Top results now</h3>
          {!results ? (
            <p className="mt-2 text-sm text-danger">These results couldn&apos;t be read.</p>
          ) : results.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No results were found.</p>
          ) : (
            <ol className="mt-2 space-y-3 text-sm">
              {results.map((r, i) => (
                <li key={i} className="min-w-0">
                  <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-primary underline underline-offset-2">{r.title}</a>
                  <span className="block truncate text-xs text-muted">{hostOf(r.url)}</span>
                  {r.snippet ? <span className="mt-0.5 line-clamp-3 block text-xs">{r.snippet}</span> : null}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-muted">These pages are the competition for this keyword. Links open in a new tab.</p>
        </aside>
      </div>
    </section>
  );
}
