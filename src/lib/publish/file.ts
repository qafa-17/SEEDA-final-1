import { z } from "zod";

// The file an approved article becomes on the website: one Markdown file at
// src/content/resources/<slug>.md, with the front matter from EPCMst's
// "Publish New Article" guide (9 Oct 2026). The demo site's
// src/content.config.ts checks the same fields, so a file that passes here
// builds there.

export const RESOURCES_DIR = "src/content/resources";

/** The site's front matter, as its content collection defines it. */
export const siteFrontmatter = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(300),
  publishDate: z.iso.date(),
  category: z.string().min(1).max(60),
  tags: z.array(z.string().min(1).max(30)).max(8),
  draft: z.literal(false),
  author: z.string().min(1).max(100),
});
export type SiteFrontmatter = z.infer<typeof siteFrontmatter>;

export type PublishableArticle = {
  title: string;
  slug: string;
  meta_description: string;
  publish_date: string;
  author_name: string;
  tags: string[];
  body_markdown: string;
  /** The content type's label ("Technical Insight"), used as the site's category. */
  category: string;
};

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Write the article as the site's Markdown file. Every value is written as a
 * JSON string, which is also a valid quoted YAML string, so quotes, colons or
 * a leading "#" in a title can never break the front matter.
 */
export function articleFile(a: PublishableArticle): { path: string; content: string; frontmatter: SiteFrontmatter } {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) throw new Error("Invalid slug");
  const frontmatter = siteFrontmatter.parse({
    title: oneLine(a.title),
    description: oneLine(a.meta_description),
    publishDate: a.publish_date,
    category: oneLine(a.category),
    tags: a.tags.map(oneLine),
    draft: false,
    author: oneLine(a.author_name),
  });
  const yaml = [
    `title: ${JSON.stringify(frontmatter.title)}`,
    `description: ${JSON.stringify(frontmatter.description)}`,
    `publishDate: ${frontmatter.publishDate}`,
    `category: ${JSON.stringify(frontmatter.category)}`,
    `tags: ${JSON.stringify(frontmatter.tags)}`,
    `draft: false`,
    `author: ${JSON.stringify(frontmatter.author)}`,
  ].join("\n");
  const body = a.body_markdown.replace(/\r\n?/g, "\n").trim();
  return { path: `${RESOURCES_DIR}/${a.slug}.md`, content: `---\n${yaml}\n---\n\n${body}\n`, frontmatter };
}

/** Read the front matter back (used by the tests to prove the file is well formed). */
export function readFrontmatter(content: string): Record<string, unknown> {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(content);
  if (!m) throw new Error("No front matter");
  const out: Record<string, unknown> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(": ");
    const key = line.slice(0, i);
    const value = line.slice(i + 2);
    out[key] = key === "publishDate" ? value : JSON.parse(value);
  }
  return out;
}
