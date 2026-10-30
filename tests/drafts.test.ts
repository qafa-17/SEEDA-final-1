// Generate draft: headline checking and draft clean-up.
import assert from "node:assert/strict";
import { buildHeadlinePrompt, cleanHeadlines, plannedFor, type HeadlineContext } from "../src/lib/drafts/headlines";
import { allowedLink, blocksToMarkdown, buildDraftPrompt, cleanDraft, restoreLineBreaks } from "../src/lib/drafts/write";
import { PLANNED } from "../src/lib/drafts/style";
import { LIMITS, guidelineChecks } from "../src/lib/content/rules";

const ctx: HeadlineContext = {
  keyword: "Cost control",
  areaLabel: "Alberta, Canada",
  summary: null,
  results: [{ title: "R", url: "https://example.com/r", snippet: "S" }],
  library: ["Cost control", "EPC project", "CAPEX optimization services"],
  serviceAreas: [{ slug: "procurement", label: "Procurement" }, { slug: "project-management", label: "Project Management" }],
  contentTypes: [{ slug: "blog-post", label: "Blog Post" }, { slug: "technical-insight", label: "Technical Insight" }],
  existingTitles: ["Cost Control on Alberta Pipeline Projects"],
};

// Headlines: corrected to the hub's lists, duplicates and existing titles dropped.
const cleaned = cleanHeadlines(
  [
    { title: "  “Cost Control Basics for Alberta Owners” ", keyword: "cost CONTROL", extra_keywords: ["epc project", "Made up keyword", "Cost control", "CAPEX optimization services", "EPC project"], service_area: "procurement", content_type: "technical-insight", angle: "A practical angle for owners." },
    { title: "Cost Control Basics for Alberta Owners", keyword: "x", extra_keywords: [], service_area: "procurement", content_type: "blog-post", angle: "Duplicate of the first." },
    { title: "Cost Control on Alberta Pipeline Projects", keyword: "Cost control", extra_keywords: [], service_area: "procurement", content_type: "blog-post", angle: "Already written." },
    { title: "Five Ways to Hold a CAPEX Budget", keyword: "Invented", extra_keywords: [], service_area: "nowhere", content_type: "poem", angle: "Unknown lists get fixed." },
  ],
  ctx,
);
assert.equal(cleaned.length, 2);
assert.deepEqual(cleaned[0], {
  title: "Cost Control Basics for Alberta Owners",
  keyword: "Cost control",
  extra_keywords: ["EPC project", "CAPEX optimization services"],
  service_area: "procurement",
  content_type: "technical-insight",
  angle: "A practical angle for owners.",
});
assert.equal(cleaned[1].keyword, "Cost control", "unknown keyword falls back to the researched one");
assert.equal(cleaned[1].service_area, null, "unknown service left for a person to choose");
assert.equal(cleaned[1].content_type, "blog-post", "unknown type falls back to Blog Post");

// The owner's planned articles fit the hub's rules.
for (const p of PLANNED) {
  assert.ok(p.title.length <= LIMITS.titleMax, `planned title within ${LIMITS.titleMax}: ${p.title}`);
  assert.ok(p.extra_keywords.length <= LIMITS.maxSecondaryKeywords);
}
assert.equal(plannedFor("short-term epcm staffing western canada")?.planned, true);
assert.equal(plannedFor("Cost control"), null);

// Untrusted web text is fenced off in both prompts.
assert.match(buildHeadlinePrompt(ctx), /<results>[\s\S]*<\/results>/);
const prompt = buildDraftPrompt({ headline: cleaned[0], areaLabel: "Alberta, Canada", service: { label: "Procurement", path: "/services/procurement" }, typeLabel: "Technical Insight", summary: null, results: ctx.results });
assert.match(prompt, /<sources>[\s\S]*https:\/\/example\.com\/r[\s\S]*<\/sources>/);
assert.match(prompt, /\/services\/procurement/);

// Links: sources, site pages and the support email only.
const site = ["/services/procurement", "/request-consultation", "/"];
assert.ok(allowedLink("https://example.com/r/", ["https://example.com/r"], site), "source (trailing slash ignored)");
assert.ok(allowedLink("/services/procurement", [], site));
assert.ok(allowedLink("https://www.epcmst.com/services/procurement/", [], site));
assert.ok(allowedLink("mailto:support@epcmst.com", [], site));
assert.ok(!allowedLink("/services/made-up", [], site), "page that doesn't exist");
assert.ok(!allowedLink("https://evil.example/x", ["https://example.com/r"], site), "unknown site");
assert.ok(!allowedLink("javascript:alert(1)", [], site));
assert.ok(!allowedLink("mailto:someone@else.com", [], site));

const draft = cleanDraft(
  {
    meta_description: "  A practical guide to cost control for Alberta project owners, with steps you can take this quarter to protect your CAPEX budget and schedule from overruns.  ",
    tags: ["CAPEX Risk", "capex risk", "Bill C-5", "<b>x</b>", "Western Canada!", "a"],
    body_markdown: `# Cost Control Basics for Alberta Owners

Opening about **cost control** in Alberta.<script>alert(1)</script>

# The Landscape

Costs rose [15%](https://example.com/r) and see [our page](/services/procurement), [a rival](https://rival.example), and [bad](javascript:alert(1)).

![chart](https://example.com/c.png)



Email [support@epcmst.com](mailto:support@epcmst.com).`,
  },
  { title: "Cost Control Basics for Alberta Owners", sourceUrls: ["https://example.com/r"], sitePaths: site },
);
assert.ok(!draft.body.includes("Cost Control Basics for Alberta Owners"), "title not repeated");
assert.ok(draft.body.startsWith("Opening about"), "starts with the opening paragraph");
assert.ok(draft.body.includes("## The Landscape") && !/^# /m.test(draft.body), "no heading 1");
assert.ok(!draft.body.includes("<"), "no HTML");
assert.ok(draft.body.includes("[15%](https://example.com/r)"), "source link kept");
assert.ok(draft.body.includes("[our page](/services/procurement)"), "site link kept");
assert.ok(draft.body.includes(" a rival,") && !draft.body.includes("rival.example"), "outside link reduced to its text");
assert.ok(!draft.body.includes("javascript:"), "script link removed");
assert.ok(!draft.body.includes("c.png"), "image removed");
assert.ok(!/\n{3,}/.test(draft.body), "blank lines tidied");
assert.equal(draft.linksRemoved, 3);
assert.ok(draft.meta.length <= LIMITS.metaMax && !draft.meta.endsWith(" "), "meta within limit, cut at a word");
assert.deepEqual(draft.tags, ["CAPEX Risk", "Bill C-5", "Western Canada"]);

// A cleaned draft still gets the usual guideline checks; the sourced figure passes.
const checks = Object.fromEntries(
  guidelineChecks({ title: "Cost Control Basics for Alberta Owners", slug: "cost-control-basics", meta_description: draft.meta, content_type_id: 1, service_area_id: 1, target_keyword: "Cost control", author_name: "EPCMst Team", publish_date: null, body_markdown: draft.body, tags: draft.tags, secondary_keywords: [] }, { sitePaths: site, reservedSlugs: [] })
    .map((c) => [c.rule_key, c.result]),
);
assert.equal(checks.figures_sourced, "pass");
assert.equal(checks.links_work, "pass");
assert.equal(checks.internal_link, "pass");

// Blocks become Markdown with every line break in place.
const md = blocksToMarkdown([
  { kind: "paragraph", text: "Opening   paragraph\nwith a break.", items: [], rows: [] },
  { kind: "heading2", text: "## The **Landscape**", items: [], rows: [] },
  { kind: "numbered", text: "", items: ["1. **Slow placement:** weeks pass.", "**Markups:** high."], rows: [] },
  { kind: "quote", text: "“Execution beats capacity.”", items: [], rows: [] },
  { kind: "bullets", text: "", items: ["- **Email our team:** [support@epcmst.com](mailto:support@epcmst.com)"], rows: [] },
  { kind: "table", text: "", items: [], rows: [{ cells: ["Model", "Speed"] }, { cells: ["Agency | firm", "Slow"] }, { cells: ["EPCMst"] }] },
  { kind: "heading3", text: "", items: [], rows: [] },
]);
assert.equal(md, [
  "Opening paragraph with a break.",
  "## The Landscape",
  "1. **Slow placement:** weeks pass.\n2. **Markups:** high.",
  "> Execution beats capacity.",
  "- **Email our team:** [support@epcmst.com](mailto:support@epcmst.com)",
  "| Model | Speed |\n| --- | --- |\n| Agency / firm | Slow |\n| EPCMst |  |",
].join("\n\n"));

// Text that lost its line breaks (every break became two spaces) gets them back.
const flat = "Opening paragraph about cost control in Alberta, long enough to look like a real article body. ".repeat(4) +
  " ## The Landscape  Intro line:  1. **One:** a.  2. **Two:** b.  > A pull quote.  - **Point:** c.  - **Point two:** d.  | A | B |  | --- | --- |  | x | y |  ### Next  Closing.";
assert.equal(restoreLineBreaks(flat).split("\n\n").slice(1).join("\n\n"), [
  "## The Landscape", "Intro line:", "1. **One:** a.\n2. **Two:** b.", "> A pull quote.",
  "- **Point:** c.\n- **Point two:** d.", "| A | B |\n| --- | --- |\n| x | y |", "### Next", "Closing.",
].join("\n\n"));
assert.equal(restoreLineBreaks(md), md, "proper Markdown is left alone");
assert.equal(restoreLineBreaks("Short text.  Two spaces here."), "Short text.  Two spaces here.", "ordinary double spaces are left alone");
assert.equal(cleanDraft({ meta_description: "x".repeat(80), tags: [], body_markdown: "Fact here [2]. And [a link](/services/procurement)." }, { title: "T", sourceUrls: [], sitePaths: [] }).body,
  "Fact here. And [a link](/services/procurement).\n", "bare source numbers removed");

console.log("drafts tests passed");
