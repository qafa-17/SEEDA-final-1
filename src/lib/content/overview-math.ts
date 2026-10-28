// The Dashboard summary numbers, worked out from plain rows. No database
// access here, so this file can be tested directly (tests/overview.test.ts).
import { STATUSES, type ArticleStatus } from "./status";

const DAY = 86_400_000;
const TZ = "America/Edmonton"; // EPCMst is in Calgary

export type ActivityPoint = { label: string; published: number; imported: number };
export type RangeKey = "3m" | "6m" | "1y" | "all";
export const RANGE_LABELS: Record<RangeKey, string> = { "3m": "3M", "6m": "6M", "1y": "1Y", all: "All" };

export type Overview = {
  counts: Record<ArticleStatus, number>;
  /** Drafts imported in the last 30 days. */
  newDrafts30: number;
  /** Days the longest-waiting article has been in review, or null if none. */
  oldestReviewDays: number | null;
  published30: number;
  publishedPrev30: number;
  /** Published per month, last six months, oldest first (for the small chart). */
  publishedMonths: { label: string; value: number }[];
  activity: Record<RangeKey, ActivityPoint[]>;
  areas: { slug: string; label: string; published: number; total: number }[];
  error: boolean;
};

export type OverviewRow = {
  status: ArticleStatus;
  created_at: string;
  submitted_at: string | null;
  published_at: string | null;
  service_area_id: number | null;
};

const monthKey = (t: number) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: TZ }).format(t);
const monthLabel = (t: number, withYear: boolean) =>
  new Intl.DateTimeFormat("en-CA", { month: "short", ...(withYear ? { year: "2-digit" } : {}), timeZone: TZ }).format(t);
const dayLabel = (t: number) => new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: TZ }).format(t);

/** Weekly buckets ending today, oldest first. */
function weekly(rows: OverviewRow[], now: number, weeks: number): ActivityPoint[] {
  const start = now - weeks * 7 * DAY;
  const out: ActivityPoint[] = Array.from({ length: weeks }, (_, i) => ({ label: dayLabel(start + i * 7 * DAY), published: 0, imported: 0 }));
  const slot = (iso: string | null) => {
    if (!iso) return -1;
    const t = Date.parse(iso);
    return t < start || t > now ? -1 : Math.min(weeks - 1, Math.floor((t - start) / (7 * DAY)));
  };
  for (const r of rows) {
    const p = slot(r.published_at);
    if (p >= 0) out[p].published++;
    const c = slot(r.created_at);
    if (c >= 0) out[c].imported++;
  }
  return out;
}

/** Monthly buckets, `months` long (or from the first article when null), oldest first. */
function monthly(rows: OverviewRow[], now: number, months: number | null): ActivityPoint[] {
  let count = months ?? 1;
  if (months === null) {
    const first = Math.min(now, ...rows.map((r) => Date.parse(r.created_at)));
    const a = new Date(first), b = new Date(now);
    count = Math.max(2, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1);
  }
  const base = new Date(now);
  const keys: number[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 15));
  const spansYears = new Date(keys[0]).getUTCFullYear() !== base.getUTCFullYear();
  const index = new Map(keys.map((t, i) => [monthKey(t), i]));
  const out: ActivityPoint[] = keys.map((t) => ({ label: monthLabel(t, spansYears), published: 0, imported: 0 }));
  for (const r of rows) {
    const p = r.published_at ? index.get(monthKey(Date.parse(r.published_at))) : undefined;
    if (p !== undefined) out[p].published++;
    const c = index.get(monthKey(Date.parse(r.created_at)));
    if (c !== undefined) out[c].imported++;
  }
  return out;
}

/** The numbers themselves, worked out from plain rows (no database), so they can be tested. */
export function buildOverview(rows: OverviewRow[], areaList: { id: number; slug: string; label: string }[], now: number): Overview {

  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<ArticleStatus, number>;
  for (const r of rows) counts[r.status]++;

  const within = (iso: string | null, fromDays: number, toDays: number) => {
    if (!iso) return false;
    const age = now - Date.parse(iso);
    return age >= fromDays * DAY && age < toDays * DAY;
  };
  const reviewAges = rows.filter((r) => r.status === "in_review" && r.submitted_at).map((r) => now - Date.parse(r.submitted_at!));

  const sixMonths = monthly(rows, now, 6);

  const areas = areaList.map((a) => {
    const mine = rows.filter((r) => r.service_area_id === a.id);
    return { slug: a.slug, label: a.label, total: mine.length, published: mine.filter((r) => r.status === "published").length };
  });
  areas.sort((x, y) => y.published - x.published || y.total - x.total || x.label.localeCompare(y.label));

  return {
    counts,
    newDrafts30: rows.filter((r) => r.status === "draft" && within(r.created_at, 0, 30)).length,
    oldestReviewDays: reviewAges.length ? Math.floor(Math.max(...reviewAges) / DAY) : null,
    published30: rows.filter((r) => within(r.published_at, 0, 30)).length,
    publishedPrev30: rows.filter((r) => within(r.published_at, 30, 60)).length,
    publishedMonths: sixMonths.map((p) => ({ label: p.label, value: p.published })),
    activity: {
      "3m": weekly(rows, now, 13),
      "6m": weekly(rows, now, 26),
      "1y": monthly(rows, now, 12),
      all: monthly(rows, now, null),
    },
    areas,
    error: false,
  };
}
