import { z } from "zod";
import { LIMITS, SLUG_PATTERN, TAG_PATTERN, type ArticleFields } from "./rules";

// The front matter every article file on the site must have. The site's
// own content collection uses the same shape, so a file that passes here
// cannot break the site's build. The plain-language version of these rules
// (shown to people as they type) is blockingIssues() in rules.ts, and
// tests/schema.test.ts proves the two always agree.

export const frontmatterSchema = z.object({
  title: z.string().trim().min(LIMITS.titleMin).max(LIMITS.titleMax),
  description: z.string().min(LIMITS.metaMin).max(LIMITS.metaMax),
  slug: z.string().regex(SLUG_PATTERN).max(LIMITS.slugMax),
  pubDate: z.iso.date(),
  author: z.string().trim().min(1).max(100),
  type: z.string().regex(SLUG_PATTERN),
  service: z.string().regex(SLUG_PATTERN),
  tags: z.array(z.string().regex(TAG_PATTERN)).min(1).max(LIMITS.maxTags),
  keyword: z.string().trim().min(LIMITS.keywordMin).max(LIMITS.keywordMax),
  extraKeywords: z.array(z.string().trim().min(LIMITS.keywordMin).max(LIMITS.keywordMax)).max(LIMITS.maxSecondaryKeywords),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;

/** An article's details in the site's front-matter shape (unchecked). */
export function toFrontmatter(a: ArticleFields, typeSlug: string | null, serviceSlug: string | null) {
  return {
    title: a.title ?? "",
    description: a.meta_description ?? "",
    slug: a.slug ?? "",
    pubDate: a.publish_date ?? "",
    author: a.author_name ?? "",
    type: typeSlug ?? "",
    service: serviceSlug ?? "",
    tags: a.tags,
    keyword: a.target_keyword ?? "",
    extraKeywords: a.secondary_keywords,
  };
}
