// The areas EPCMst wants to be found in. `search` is how the area is written
// into the web search.
export const REGIONS = [
  { slug: "alberta", label: "Alberta", search: "Alberta" },
  { slug: "british-columbia", label: "British Columbia", search: "British Columbia" },
  { slug: "saskatchewan", label: "Saskatchewan", search: "Saskatchewan" },
  { slug: "manitoba", label: "Manitoba", search: "Manitoba" },
  { slug: "western-canada", label: "Western Canada (all)", search: "Western Canada" },
] as const;

export type RegionSlug = (typeof REGIONS)[number]["slug"];
export const REGION_SLUGS = REGIONS.map((r) => r.slug) as [RegionSlug, ...RegionSlug[]];
export const regionBySlug = (slug: string) => REGIONS.find((r) => r.slug === slug);

/**
 * Opens Google Trends for this keyword. Trends only shows a chart when a
 * phrase is searched often enough, and niche industry keywords in a single
 * province over one year usually are not. So the link asks for the widest
 * useful view: all of Canada over five years. The page then breaks interest
 * down by province where it has the data.
 */
export function trendsUrl(keyword: string): string {
  return `https://trends.google.com/trends/explore?${new URLSearchParams({ date: "today 5-y", geo: "CA", q: keyword })}`;
}

// Allowances. The search service's free plan is 1,000 searches a month;
// the hub stops at 900 to leave a margin, and no one person can use it all.
export const LIMITS = { perPersonPerDay: 15, teamPerMonth: 900, reuseDays: 7 } as const;
