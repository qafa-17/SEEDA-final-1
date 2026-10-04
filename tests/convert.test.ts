// Run: npx tsx tests/convert.test.ts
import { cleanDocMarkdown, MAX_BODY_CHARS } from "../src/lib/content/convert";

let failed = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { failed++; console.log(`FAIL ${label}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`); }
};

// A realistic Google Docs export
const doc = `# Modular Construction on Remote Sites

Modular construction cuts camp costs.

## Why it matters

See [our construction services](https://www.epcmst.com/services/construction) and [AACE](https://web.aacei.org/).

![][image1]

* First point
* Second point

<span style="color:red">Red text</span> stays as text.

[bad](javascript:alert(1))



Final line.   

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==>`;

const r = cleanDocMarkdown(doc, "Modular Construction on Remote Sites");
eq("title heading removed", r.markdown.startsWith("Modular construction cuts camp costs."), true);
eq("subheading kept", r.markdown.includes("## Why it matters"), true);
eq("own link made relative", r.markdown.includes("[our construction services](/services/construction)"), true);
eq("outside link kept", r.markdown.includes("[AACE](https://web.aacei.org/)"), true);
eq("image counted", r.imagesRemoved, 1);
eq("no base64 left", r.markdown.includes("base64"), false);
eq("no image ref left", r.markdown.includes("![]"), false);
eq("html tag removed, text kept", r.markdown.includes("Red text stays as text."), true);
eq("no angle-bracket tags", /<\/?[a-z]/i.test(r.markdown), false);
eq("javascript link reduced to text", r.markdown.includes("javascript:"), false);
eq("blank lines collapsed", /\n{3,}/.test(r.markdown), false);
eq("trailing spaces trimmed", r.markdown.endsWith("Final line."), true);
eq("lists kept", r.markdown.includes("* First point"), true);

// Title heading only removed when it matches the Doc name
eq("different H1 kept, as a Heading 2", cleanDocMarkdown("# Something else\n\nBody", "Doc name").markdown.startsWith("## Something else"), true);
eq("escaped H1 still matched", cleanDocMarkdown("# Winter \\- Logistics\n\nBody", "Winter - Logistics").markdown, "Body");
eq("inline base64 image", cleanDocMarkdown("Text ![chart](data:image/png;base64,AAAA) more", "x"), { markdown: "Text  more", imagesRemoved: 1, truncated: false });
eq("bare domain link", cleanDocMarkdown("[Home](https://epcmst.com)", "x").markdown, "[Home](/)");
eq("lookalike domain NOT treated as own", cleanDocMarkdown("[x](https://epcmst.com.evil.io/a)", "x").markdown, "[x](https://epcmst.com.evil.io/a)");
eq("windows line endings", cleanDocMarkdown("a\r\n\r\n\r\nb", "x").markdown, "a\n\nb");
eq("empty doc", cleanDocMarkdown("", "x"), { markdown: "", imagesRemoved: 0, truncated: false });
eq("a < b is not a tag", cleanDocMarkdown("if a < b and c > d", "x").markdown, "if a < b and c > d");
// Formatting that must survive
const fmt = cleanDocMarkdown(
  "# My Doc\n\n# Section one\n\nLine one  \nline two \n\n## Detail\n\n```\n# not a heading\n```\n\nSee <https://example.com> or <a@b.co>, **bold**, *italic*, ~~gone~~.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n> Quote\n\n1. One\n   * Nested",
  "My Doc",
).markdown;
eq("section Heading 1 becomes Heading 2", fmt.includes("\n## Section one") || fmt.startsWith("## Section one"), true);
eq("lower headings move down too", fmt.includes("### Detail"), true);
eq("code blocks are not touched", fmt.includes("```\n# not a heading\n```"), true);
eq("line break inside a paragraph kept", fmt.includes("Line one  \nline two\n"), true);
eq("plain links kept", fmt.includes("<https://example.com>") && fmt.includes("<a@b.co>"), true);
eq("bold, italic, strikethrough kept", fmt.includes("**bold**, *italic*, ~~gone~~"), true);
eq("tables kept", fmt.includes("| A | B |\n| - | - |\n| 1 | 2 |"), true);
eq("quotes and nested lists kept", fmt.includes("> Quote") && fmt.includes("1. One\n   * Nested"), true);
eq("headings left alone when there is no Heading 1", cleanDocMarkdown("## A\n\ntext\n\n### B", "T").markdown, "## A\n\ntext\n\n### B");

// Bare line ends inside a paragraph become real line breaks; structure is untouched.
eq("bare line ends become line breaks", cleanDocMarkdown("Suite 100\n123 Main St\nCalgary\n\nNext para", "T").markdown, "Suite 100  \n123 Main St  \nCalgary\n\nNext para");
eq("backslash breaks left alone", cleanDocMarkdown("one\\\ntwo", "T").markdown, "one\\\ntwo");
const structure = "## Head\ntext\n\n* a\n* b\n\n| A |\n| - |\n| 1 |\n\n```\nx\ny\n```\n\n> q\n> r";
eq("headings, lists, tables, code and quotes untouched", cleanDocMarkdown(structure, "T").markdown, structure);

const big = cleanDocMarkdown("word ".repeat(60_000), "x");
eq("truncated at limit", [big.markdown.length <= MAX_BODY_CHARS, big.truncated], [true, true]);

console.log(failed ? `${failed} FAILED` : "ALL CONVERTER TESTS PASSED");
process.exit(failed ? 1 : 0);
