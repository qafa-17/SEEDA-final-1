// The Zod front-matter schema and the plain-language blocking rules must
// agree: an article passes one exactly when it passes the other.
import assert from "node:assert/strict";
import { blockingIssues, guidelineChecks, internalLinks, parseTags, wordCount, type ArticleFields, type SiteContext } from "../src/lib/content/rules";
import { frontmatterSchema, toFrontmatter } from "../src/lib/content/schema";
import { pageList } from "../src/lib/pagination";

const good: ArticleFields = {
  title: "Cost Control on Alberta Pipeline Projects",
  slug: "cost-control-alberta-pipeline-projects",
  meta_description: "How owners keep pipeline budgets on track, with practical steps from EPCM teams in Alberta.",
  content_type_id: 1,
  service_area_id: 2,
  target_keyword: "Cost control",
  author_name: "Pat",
  publish_date: "2026-11-01",
  body_markdown: "Cost control starts early.\n\n## Why\n\nSee [procurement](/services/procurement/) and [about](https://epcmst.com/about#team).",
  tags: ["pipeline-engineering", "cost control"],
  secondary_keywords: ["EPC project"],
};
const site: SiteContext = { sitePaths: ["/", "/about", "/services/procurement", "/resources/taken-slug"], reservedSlugs: ["taken-slug"] };

const issuesOf = (a: ArticleFields, s = site) => blockingIssues({ ...a, word_count: wordCount(a.body_markdown) }, s);
const schemaOk = (a: ArticleFields) =>
  frontmatterSchema.safeParse(toFrontmatter(a, a.content_type_id ? "whitepaper" : null, a.service_area_id ? "procurement" : null)).success;

assert.deepEqual(issuesOf(good), []);
assert.ok(schemaOk(good));

// Each broken field is caught by both, and reported against the right field.
const broken: [Partial<ArticleFields>, string][] = [
  [{ title: "Short" }, "title"],
  [{ title: "x".repeat(71) }, "title"],
  [{ title: null }, "title"],
  [{ slug: null }, "slug"],
  [{ meta_description: "Too short." }, "meta_description"],
  [{ meta_description: "y".repeat(161) }, "meta_description"],
  [{ content_type_id: null }, "content_type_id"],
  [{ service_area_id: null }, "service_area_id"],
  [{ target_keyword: null }, "target_keyword"],
  [{ target_keyword: " a " }, "target_keyword"],
  [{ tags: [] }, "tags"],
  [{ author_name: "  " }, "author_name"],
  [{ publish_date: null }, "publish_date"],
];
for (const [change, field] of broken) {
  const a = { ...good, ...change };
  const issues = issuesOf(a);
  assert.equal(issues.length, 1, `one issue for ${JSON.stringify(change)}`);
  assert.equal(issues[0].field, field);
  assert.equal(schemaOk(a), false, `schema also rejects ${JSON.stringify(change)}`);
}

// Rules only the hub can judge (they need the article text or the live site).
assert.deepEqual(issuesOf({ ...good, body_markdown: "  " }).map((i) => i.field), ["body_markdown"]);
assert.deepEqual(issuesOf({ ...good, slug: "taken-slug" }).map((i) => i.message), ["That URL is already used by a page on the live site."]);
assert.deepEqual(issuesOf({ ...good, slug: "taken-slug" }, { sitePaths: [], reservedSlugs: [] }), []);

// Tags are tidied, not rejected.
assert.deepEqual(parseTags(" EPC,  Cost   Control ,epc,, Q&A "), ["epc", "cost control", "q&a"]);

// Links: trailing slashes, anchors and the full site address are all understood.
assert.deepEqual(internalLinks(good.body_markdown), ["/services/procurement", "/about"]);
assert.deepEqual(internalLinks("[x](https://example.com/about) [y](//evil.com) [z](mailto:a@b.c) [home](https://www.epcmst.com)"), ["/"]);

const checks = Object.fromEntries(guidelineChecks(good, site).map((c) => [c.rule_key, c.result]));
assert.equal(checks.internal_link, "pass");
assert.equal(checks.links_work, "pass");
assert.equal(checks.extra_keywords_used, "warn"); // "EPC project" isn't in the text
const withBadLink = guidelineChecks({ ...good, body_markdown: good.body_markdown + " [old](/knowledge-hub/thing)" }, site);
const linkCheck = withBadLink.find((c) => c.rule_key === "links_work")!;
assert.equal(linkCheck.result, "warn");
assert.match(linkCheck.message, /\/knowledge-hub\/thing/);
// Without the site's page list, links are not judged.
assert.equal(guidelineChecks({ ...good, body_markdown: "[old](/nope)" }).find((c) => c.rule_key === "links_work")!.result, "pass");

// Page numbers: first, last, current and neighbours; any page is one click away.
assert.deepEqual(pageList(1, 1), [1]);
assert.deepEqual(pageList(1, 6), [1, 2, "gap", 5, 6]);
assert.deepEqual(pageList(6, 12), [1, 2, "gap", 5, 6, 7, "gap", 11, 12]);
assert.deepEqual(pageList(4, 6), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(pageList(12, 12), [1, 2, "gap", 11, 12]);

console.log("schema and rules tests passed");
