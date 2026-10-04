import "server-only";
import { z } from "zod";

// Web search through Tavily (https://docs.tavily.com). The key lives only
// in the server's environment; the browser never sees it or talks to Tavily.

const ENDPOINT = "https://api.tavily.com/search";
const TIMEOUT_MS = 15_000;
export const MAX_RESULTS = 8;

export type SearchResult = { title: string; url: string; snippet: string };
export type SearchErrorKind = "not_configured" | "auth" | "rate_limited" | "out_of_credit" | "unavailable";

export class SearchError extends Error {
  constructor(public kind: SearchErrorKind) {
    super(kind);
  }
}

/** What to tell a person, for each kind of failure. Never shows the service's raw errors. */
export function searchErrorMessage(e: unknown): string {
  const kind = e instanceof SearchError ? e.kind : "unavailable";
  switch (kind) {
    case "not_configured":
      return "Web search isn't connected yet. An admin needs to add the search key.";
    case "auth":
      return "The hub couldn't sign in to the search service. An admin should check the search key.";
    case "rate_limited":
      return "The search service is busy right now. Wait a minute and try again.";
    case "out_of_credit":
      return "This month's free web searches are used up. Research opens again next month.";
    default:
      return "The search service didn't respond. Try again in a moment.";
  }
}

export const isSearchConfigured = () => Boolean(process.env.TAVILY_API_KEY?.trim());

const responseSchema = z.object({
  results: z.array(z.object({ title: z.string(), url: z.string(), content: z.string().optional() })),
});

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** Only ordinary web links are kept, so a result can never be a script or data link. */
function safeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) throw new SearchError("not_configured");

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
      // "basic" depth costs 1 credit per search; results are limited to Canada.
      body: JSON.stringify({ query, search_depth: "basic", topic: "general", max_results: MAX_RESULTS, country: "canada" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new SearchError("unavailable");
  }
  if (res.status === 401 || res.status === 403) throw new SearchError("auth");
  if (res.status === 429) throw new SearchError("rate_limited");
  if (res.status === 432 || res.status === 433) throw new SearchError("out_of_credit");
  if (!res.ok) throw new SearchError("unavailable");

  const parsed = responseSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new SearchError("unavailable");

  const out: SearchResult[] = [];
  for (const r of parsed.data.results) {
    const url = safeUrl(r.url);
    const title = clip(oneLine(r.title), 160);
    if (!url || !title) continue;
    out.push({ title, url, snippet: clip(oneLine(r.content ?? ""), 400) });
    if (out.length === MAX_RESULTS) break;
  }
  return out;
}
