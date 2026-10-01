// The Knowledge Hub content rules, in one place.
//
// BLOCKING rules mirror public.article_blocking_problems() in the database
// (supabase/migrations/0002). The database is the real gate; this copy lets
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
  recommendedWords: 600,
} as const;

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
};

/** Same count as the database's generated word_count column. */
export function wordCount(body: string): number {
  const trimmed = body.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** Plain-language problems that stop submission. Empty array = ready. */
export function blockingProblems(a: ArticleFields): string[] {
  const p: string[] = [];
  if (a.title === null || a.title.trim().length < LIMITS.titleMin) p.push(`Title must be at least ${LIMITS.titleMin} characters.`);
  if (a.title !== null && a.title.length > LIMITS.titleMax) p.push(`Title must be ${LIMITS.titleMax} characters or fewer.`);
  if (a.slug === null) p.push("Add a URL slug.");
  if (a.meta_description === null || a.meta_description.length < LIMITS.metaMin)
    p.push(`Meta description must be at least ${LIMITS.metaMin} characters.`);
  if (a.meta_description !== null && a.meta_description.length > LIMITS.metaMax)
    p.push(`Meta description must be ${LIMITS.metaMax} characters or fewer.`);
  if (a.content_type_id === null) p.push("Choose a content type.");
  if (a.service_area_id === null) p.push("Choose a service area.");
  if (a.target_keyword === null || a.target_keyword.trim().length < LIMITS.keywordMin) p.push("Add a target keyword.");
  if (a.author_name === null || a.author_name.trim() === "") p.push("Add an author.");
  if (a.publish_date === null) p.push("Add a publish date.");
  if (wordCount(a.body_markdown) < 1) p.push("The article body is empty.");
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

/** Guideline checks for findability. Needs a keyword to judge most of them. */
export function guidelineChecks(a: ArticleFields): GuidelineCheck[] {
  const kw = (a.target_keyword ?? "").trim();
  const words = wordCount(a.body_markdown);
  const noKw = "Add a target keyword first.";
  const check = (rule_key: string, label: string, ok: boolean, pass: string, warn: string): GuidelineCheck => ({
    rule_key,
    label,
    result: ok ? "pass" : "warn",
    message: ok ? pass : warn,
  });

  return [
    check("keyword_in_title", "Keyword in title", includesCI(a.title, kw), "The title uses the keyword.",
      kw ? `Use "${kw}" in the title so searchers see it.` : noKw),
    check("keyword_in_slug", "Keyword in URL", kw !== "" && includesCI(a.slug, slugify(kw)), "The URL contains the keyword.",
      kw ? `Include "${slugify(kw)}" in the URL slug.` : noKw),
    check("keyword_in_meta", "Keyword in meta description", includesCI(a.meta_description, kw),
      "The meta description uses the keyword.", kw ? `Mention "${kw}" in the meta description.` : noKw),
    check("keyword_in_intro", "Keyword in first paragraph", includesCI(firstParagraph(a.body_markdown), kw),
      "The first paragraph uses the keyword.", kw ? `Mention "${kw}" in the first paragraph.` : noKw),
    check("min_length", "Length", words >= LIMITS.recommendedWords, `${words} words.`,
      `${words} words. Articles of ${LIMITS.recommendedWords} or more words tend to rank better.`),
    check("has_subheading", "Has subheadings", /^##\s+\S/m.test(a.body_markdown), "The article is broken into sections.",
      "Add at least one subheading (a Heading 2 in the Doc)."),
    check("internal_link", "Links to another EPCMst page", /\]\(\/[^)\s]*\)/.test(a.body_markdown),
      "Links to another page on the site.", "Add at least one link to another EPCMst page, such as a service page."),
  ];
}
