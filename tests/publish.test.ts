// Publish: the article file matches the website's format exactly.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { articleFile, readFrontmatter } from "../src/lib/publish/file";

const tricky = articleFile({
  title: 'Bill C-5: What "Fast-Track" Means for #Pipelines',
  slug: "bill-c-5-fast-track-pipelines",
  meta_description: "What owners need to know: approvals, timelines\nand procurement — in plain terms.",
  publish_date: "2026-11-03",
  author_name: "EPCMst Team",
  tags: ["Bill C-5", "Pipeline Engineering", "U.S. Gulf Coast"],
  body_markdown: "Opening paragraph.\r\n\r\n## Section\r\n\r\n- **Point:** detail\r\n",
  category: "Technical Insight",
});

assert.equal(tricky.path, "src/content/resources/bill-c-5-fast-track-pipelines.md");
assert.ok(tricky.content.startsWith("---\n") && tricky.content.includes("\n---\n\nOpening paragraph."), "front matter, then the body");
assert.ok(!tricky.content.includes("\r"), "Unix line endings");
assert.ok(tricky.content.endsWith("- **Point:** detail\n"));
assert.deepEqual(readFrontmatter(tricky.content), {
  title: 'Bill C-5: What "Fast-Track" Means for #Pipelines',
  description: "What owners need to know: approvals, timelines and procurement — in plain terms.",
  publishDate: "2026-11-03",
  category: "Technical Insight",
  tags: ["Bill C-5", "Pipeline Engineering", "U.S. Gulf Coast"],
  draft: false,
  author: "EPCMst Team",
});

// Refused: anything the site's content collection would reject.
const base = { title: "T", slug: "ok-slug", meta_description: "D", publish_date: "2026-11-03", author_name: "A", tags: [], body_markdown: "B", category: "C" };
assert.throws(() => articleFile({ ...base, slug: "../../etc/passwd" }), "no path tricks in the slug");
assert.throws(() => articleFile({ ...base, publish_date: "next week" }), "real date");
assert.throws(() => articleFile({ ...base, title: "" }), "title needed");

// For the end-to-end check against the demo site's real build (see the stage notes).
if (process.env.WRITE_SAMPLE) writeFileSync(process.env.WRITE_SAMPLE, tricky.content);

console.log("publish tests passed");
