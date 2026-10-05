// The areas EPCMst wants to be found in. `search` is how the area is written
// into the web search; `country` limits results to that country and picks
// the country Google Trends opens for.
export const REGIONS = [
  { slug: "alberta", label: "Alberta", search: "Alberta", country: "canada" },
  { slug: "british-columbia", label: "British Columbia", search: "British Columbia", country: "canada" },
  { slug: "saskatchewan", label: "Saskatchewan", search: "Saskatchewan", country: "canada" },
  { slug: "manitoba", label: "Manitoba", search: "Manitoba", country: "canada" },
  { slug: "western-canada", label: "Western Canada (all)", search: "Western Canada", country: "canada" },
  { slug: "us-gulf-coast", label: "U.S. Gulf Coast (Texas, Louisiana)", search: "Gulf Coast Texas Louisiana", country: "united states" },
  { slug: "permian-basin", label: "U.S. Permian Basin", search: "Permian Basin", country: "united states" },
  { slug: "pacific-northwest", label: "U.S. Pacific Northwest", search: "Pacific Northwest", country: "united states" },
] as const;

export type RegionSlug = (typeof REGIONS)[number]["slug"];
export type Country = (typeof REGIONS)[number]["country"];
export const REGION_SLUGS = REGIONS.map((r) => r.slug) as [RegionSlug, ...RegionSlug[]];
export const regionBySlug = (slug: string) => REGIONS.find((r) => r.slug === slug);
export const countryLabel = (c: Country) => (c === "canada" ? "Canada" : "the United States");

/**
 * Opens Google Trends for this keyword. Trends only shows a chart when a
 * phrase is searched often enough, and niche industry keywords in a single
 * province or state over one year usually are not. So the link asks for the
 * widest useful view: the whole country over five years. The page then
 * breaks interest down by province or state where it has the data.
 */
export function trendsUrl(keyword: string, country: Country = "canada"): string {
  return `https://trends.google.com/trends/explore?${new URLSearchParams({ date: "today 5-y", geo: country === "canada" ? "CA" : "US", q: keyword })}`;
}

// Allowances. The search service's free plan is 1,000 searches a month;
// the hub stops at 900 to leave a margin, and no one person can use it all.
export const LIMITS = { perPersonPerDay: 15, teamPerMonth: 900, reuseDays: 7 } as const;
