// The areas EPCMst wants to be found in. `geo` is Google Trends' code for
// the area; `search` is how the area is written into the web search.
export const REGIONS = [
  { slug: "alberta", label: "Alberta", search: "Alberta", geo: "CA-AB" },
  { slug: "british-columbia", label: "British Columbia", search: "British Columbia", geo: "CA-BC" },
  { slug: "saskatchewan", label: "Saskatchewan", search: "Saskatchewan", geo: "CA-SK" },
  { slug: "manitoba", label: "Manitoba", search: "Manitoba", geo: "CA-MB" },
  { slug: "western-canada", label: "Western Canada (all)", search: "Western Canada", geo: "CA" },
] as const;

export type RegionSlug = (typeof REGIONS)[number]["slug"];
export const REGION_SLUGS = REGIONS.map((r) => r.slug) as [RegionSlug, ...RegionSlug[]];
export const regionBySlug = (slug: string) => REGIONS.find((r) => r.slug === slug);

/** Opens Google Trends for this keyword in this area (last 12 months). */
export function trendsUrl(keyword: string, region: RegionSlug): string {
  const geo = regionBySlug(region)?.geo ?? "CA";
  return `https://trends.google.com/trends/explore?${new URLSearchParams({ date: "today 12-m", geo, q: keyword })}`;
}

// Allowances. The search service's free plan is 1,000 searches a month;
// the hub stops at 900 to leave a margin, and no one person can use it all.
export const LIMITS = { perPersonPerDay: 15, teamPerMonth: 900, reuseDays: 7 } as const;
