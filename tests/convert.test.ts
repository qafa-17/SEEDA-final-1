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
eq("different H1 kept", cleanDocMarkdown("# Something else\n\nBody", "Doc name").markdown.startsWith("# Something else"), true);
eq("escaped H1 still matched", cleanDocMarkdown("# Winter \\- Logistics\n\nBody", "Winter - Logistics").markdown, "Body");
eq("inline base64 image", cleanDocMarkdown("Text ![chart](data:image/png;base64,AAAA) more", "x"), { markdown: "Text  more", imagesRemoved: 1, truncated: false });
eq("bare domain link", cleanDocMarkdown("[Home](https://epcmst.com)", "x").markdown, "[Home](/)");
eq("lookalike domain NOT treated as own", cleanDocMarkdown("[x](https://epcmst.com.evil.io/a)", "x").markdown, "[x](https://epcmst.com.evil.io/a)");
eq("windows line endings", cleanDocMarkdown("a\r\n\r\n\r\nb", "x").markdown, "a\n\nb");
eq("empty doc", cleanDocMarkdown("", "x"), { markdown: "", imagesRemoved: 0, truncated: false });
eq("a < b is not a tag", cleanDocMarkdown("if a < b and c > d", "x").markdown, "if a < b and c > d");
const big = cleanDocMarkdown("word ".repeat(60_000), "x");
eq("truncated at limit", [big.markdown.length <= MAX_BODY_CHARS, big.truncated], [true, true]);

console.log(failed ? `${failed} FAILED` : "ALL CONVERTER TESTS PASSED");
process.exit(failed ? 1 : 0);
