// The Knowledge Hub content rules, in one place.
//
// BLOCKING rules mirror public.article_blocking_problems() in the database
// (supabase/migrations/0005). The database is the real gate; this copy lets
// the app show the same messages live as people type. Change both together.
//
// GUIDELINE checks are advice for findability. They never block; the
// approver sees them and decides.

export const LIMITS = {
  titleMin: 10,
  titleMax: 70,
  slugMax: 80,
  metaMin: 70,
  metaMax: 160,
  keywordMin: 2,
  keywordMax: 80,
  maxSecondaryKeywords: 2,
  maxTags: 8,
  recommendedWords: 600,
} as const;

/** Where articles live on the site: epcmst.com/resources/<slug>. */
export const SITE_PREFIX = "/resources/";
export const SITE_HOSTS = ["epcmst.com", "www.epcmst.com"];

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Same pattern as public.valid_tags() in the database. */
export const TAG_PATTERN = /^[a-z0-9][a-z0-9 &-]{1,29}$/;

export type ArticleFields = {
  title: string | null;
  slug: string | null;
  meta_description: string | null;
  content_type_id: number | null;
  service_area_id: number | null;
  target_keyword: string | null;
  author_name: string | null;
  publish_date: string | null;
  body_markdown: string;
  tags: string[];
  secondary_keywords: string[];
};

/**
 * What the rules need to know about the live site. Loaded from the
 * site_pages table (see loadSiteContext); empty when not known.
 */
export type SiteContext = {
  /** Every page path on the live site, e.g. "/services/procurement". */
  sitePaths: string[];
  /** Slugs under /resources/ already taken by a page that isn't this article. */
  reservedSlugs: string[];
};
export const NO_SITE: SiteContext = { sitePaths: [], reservedSlugs: [] };

/** "EPC, Cost Control , epc" -> ["epc", "cost control"]. Tidies, never rejects. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(",")) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (t) seen.add(t);
  }
  return [...seen];
}

/** Same count as the database's generated word_count column. */
export function wordCount(body: string): number {
  const trimmed = body.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** Same as ArticleFields, but with the database's word count instead of the full body (for lists). */
export type ArticleSummary = Omit<ArticleFields, "body_markdown" | "secondary_keywords"> & { word_count: number };

export type FieldName ="title" | "slug" | "meta_description" | "content_type_id" | "service_area_id" | "target_keyword" | "tags" | "author_name" | "publish_date" | "body_markdown";
export type Issue = { field: FieldName; message: string };

/** Plain-language problems that stop submission. Empty array = ready. */
export function blockingProblems(a: ArticleFields, site: SiteContext = NO_SITE): string[] {
  return blockingIssues({ ...a, word_count: wordCount(a.body_markdown) }, site).map((i) => i.message);
}

export function blockingProblemsFor(a: ArticleSummary, site: SiteContext = NO_SITE): string[] {
  return blockingIssues(a, site).map((i) => i.message);
}

/** The same problems, each tied to the field it belongs to. Same order as the database. */
export function blockingIssues(a: ArticleSummary, site: SiteContext = NO_SITE): Issue[] {
  const p: Issue[] = [];
  const add = (field: FieldName, message: string) => p.push({ field, message });
  if (a.title === null || a.title.trim().length < LIMITS.titleMin) add("title", `Title must be at least ${LIMITS.titleMin} characters.`);
  if (a.title !== null && a.title.length > LIMITS.titleMax) add("title", `Title must be ${LIMITS.titleMax} characters or fewer.`);
  if (a.slug === null) add("slug", "Add a URL slug.");
  if (a.slug !== null && site.reservedSlugs.includes(a.slug)) add("slug", "That URL is already used by a page on the live site.");
  if (a.meta_description === null || a.meta_description.length < LIMITS.metaMin)
    add("meta_description", `Meta description must be at least ${LIMITS.metaMin} characters.`);
  if (a.meta_description !== null && a.meta_description.length > LIMITS.metaMax)
    add("meta_description", `Meta description must be ${LIMITS.metaMax} characters or fewer.`);
  if (a.content_type_id === null) add("content_type_id", "Choose a content type.");
  if (a.service_area_id === null) add("service_area_id", "Choose a service area.");
  if (a.target_keyword === null || a.target_keyword.trim().length < LIMITS.keywordMin) add("target_keyword", "Add a target keyword.");
  if (a.tags.length < 1) add("tags", "Add at least one tag.");
  if (a.author_name === null || a.author_name.trim() === "") add("author_name", "Add an author.");
  if (a.publish_date === null) add("publish_date", "Add a publish date.");
  if (a.word_count < 1) add("body_markdown", "The article body is empty.");
  return p;
}

/** Turn any text into a valid slug (used to suggest one from the title). */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.slugMax)
    .replace(/-+$/g, "");
}

export type CheckResult = "pass" | "warn";
export type GuidelineCheck = { rule_key: string; label: string; result: CheckResult; message: string };

const includesCI = (haystack: string | null, needle: string) =>
  haystack !== null && needle !== "" && haystack.toLowerCase().includes(needle.toLowerCase());

/** First paragraph of real text (skips headings, blank lines and list markers). */
function firstParagraph(body: string): string {
  for (const block of body.split(/\n\s*\n/)) {
    const t = block.trim();
    if (t && !t.startsWith("#")) return t;
  }
  return "";
}

/**
 * Links in the text that point at the EPCMst site, as plain paths:
 * "/services/procurement/", "https://epcmst.com/about#team" -> "/services/procurement", "/about".
 */
export function internalLinks(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)) {
    let target = m[1];
    const abs = /^https?:\/\/([^/?#]+)(.*)$/i.exec(target);
    if (abs) {
      if (!SITE_HOSTS.includes(abs[1].toLowerCase())) continue;
      target = abs[2] || "/";
    }
    if (!target.startsWith("/") || target.startsWith("//")) continue;
    const path = target.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
    out.add(path.toLowerCase());
  }
  return [...out];
}

/** Guideline checks for findability. Needs a keyword to judge most of them. */
export function guidelineChecks(a: ArticleFields, site: SiteContext = NO_SITE): GuidelineCheck[] {
  const kw = (a.target_keyword ?? "").trim();
  const words = wordCount(a.body_markdown);
  const noKw = "Add a target keyword first.";
  const check = (rule_key: string, label: string, ok: boolean, pass: string, warn: string): GuidelineCheck => ({
    rule_key,
    label,
    result: ok ? "pass" : "warn",
    message: ok ? pass : warn,
  });

  const extras = a.secondary_keywords.map((k) => k.trim()).filter(Boolean);
  const unusedExtras = extras.filter((k) => !includesCI(a.body_markdown, k) && !includesCI(a.title, k));
  const links = internalLinks(a.body_markdown);
  // Only judged when the site's page list is known.
  const broken = site.sitePaths.length > 0 ? links.filter((l) => !site.sitePaths.includes(l)) : [];

  return [
    check("keyword_in_title", "Keyword in title", includesCI(a.title, kw), "The title uses the keyword.",
      kw ? `Use "${kw}" in the title so searchers see it.` : noKw),
    check("keyword_in_slug", "Keyword in URL", kw !== "" && includesCI(a.slug, slugify(kw)), "The URL contains the keyword.",
      kw ? `Include "${slugify(kw)}" in the URL slug.` : noKw),
    check("keyword_in_meta", "Keyword in meta description", includesCI(a.meta_description, kw),
      "The meta description uses the keyword.", kw ? `Mention "${kw}" in the meta description.` : noKw),
    check("keyword_in_intro", "Keyword in first paragraph", includesCI(firstParagraph(a.body_markdown), kw),
      "The first paragraph uses the keyword.", kw ? `Mention "${kw}" in the first paragraph.` : noKw),
    check("extra_keywords_used", "Extra keywords in the text", unusedExtras.length === 0,
      extras.length ? "The text uses every extra keyword." : "No extra keywords set (optional, up to two).",
      `Not found in the text: ${unusedExtras.map((k) => `"${k}"`).join(", ")}.`),
    check("min_length", "Length", words >= LIMITS.recommendedWords, `${words} words.`,
      `${words} words. Articles of ${LIMITS.recommendedWords} or more words tend to rank better.`),
    check("has_subheading", "Has subheadings", /^##\s+\S/m.test(a.body_markdown), "The article is broken into sections.",
      "Add at least one subheading (a Heading 2 in the Doc)."),
    check("internal_link", "Links to another EPCMst page", links.length > 0,
      "Links to another page on the site.", "Add at least one link to another EPCMst page, such as a service page."),
    check("links_work", "Links point to real pages", broken.length === 0,
      links.length ? "Every link to the EPCMst site matches a real page." : "No links to the EPCMst site to check.",
      `No page on the site at: ${broken.slice(0, 5).join(", ")}${broken.length > 5 ? ` and ${broken.length - 5} more` : ""}.`),
  ];
}
