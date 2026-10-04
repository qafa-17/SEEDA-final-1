// Cleans the Markdown that Google Docs exports, so it is safe to store,
// show and later publish. Pure function: no network, easy to test.

export const MAX_BODY_CHARS = 200_000;

export type Converted = { markdown: string; imagesRemoved: number; truncated: boolean };

/** Hostnames treated as EPCMst's own site: links to them become site-relative (/services/...). */
const OWN_HOSTS = /^https?:\/\/(?:www\.)?epcmst\.com(?=\/|$)/i;

export function cleanDocMarkdown(raw: string, docTitle: string): Converted {
  let md = raw.replace(/\r\n?/g, "\n");
  let imagesRemoved = 0;

  // 1. Images. Google puts them inline as base64 or as reference definitions
  //    at the end ([image1]: <data:image/png;base64,...>). Both are removed;
  //    images are handled separately later, and base64 would bloat the page.
  md = md.replace(/^\s*\[[^\]\n]+\]:\s*<?data:image\/[^\s>]+>?\s*$/gim, () => "");
  md = md.replace(/!\[[^\]\n]*\]\[[^\]\n]*\]/g, () => {
    imagesRemoved++;
    return "";
  });
  md = md.replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, () => {
    imagesRemoved++;
    return "";
  });

  // 2. Raw HTML tags are dropped (text inside them is kept). The site is
  //    built from Markdown, and HTML from a Doc must never reach a page.
  //    Web and email addresses written as <https://...> are links, not tags.
  md = md.replace(/<\/?[a-zA-Z][^<>\n]*>/g, (tag) => (/^<(?:https?:\/\/|mailto:|[^\s<>@]+@[^\s<>@]+\.)/i.test(tag) ? tag : ""));

  // 3. Links to EPCMst's own site become relative, so they count as internal
  //    links and keep working on preview builds.
  md = md.replace(/\]\(\s*(https?:\/\/[^)\s]+)\s*\)/g, (_m, url: string) => {
    if (!OWN_HOSTS.test(url)) return `](${url})`;
    const path = url.replace(OWN_HOSTS, "") || "/";
    return `](${path.startsWith("/") ? path : `/${path}`})`;
  });
  // Links with unsafe schemes are reduced to their text.
  md = md.replace(/\[([^\]\n]*)\]\(\s*(?:javascript|data|vbscript):[^)]*\)/gi, "$1");

  // 4. The Doc's own title usually opens the export as a Heading 1. The title
  //    lives in the article's details, so a matching first heading is removed.
  const lines = md.split("\n");
  const firstText = lines.findIndex((l) => l.trim() !== "");
  if (firstText >= 0) {
    const h1 = /^#\s+(.+?)\s*#*\s*$/.exec(lines[firstText]);
    const norm = (s: string) => s.replace(/\\(.)/g, "$1").replace(/[*_`]/g, "").trim().toLowerCase();
    if (h1 && norm(h1[1]) === norm(docTitle)) lines.splice(firstText, 1);
  }
  // 5. The page's title is its only Heading 1. If the writer used Heading 1
  //    for sections, every heading moves down one level (1 becomes 2, 2
  //    becomes 3...), so the outline stays the same shape.
  const isFence = (l: string) => /^\s*(```|~~~)/.test(l);
  let inCode = false;
  const hasH1 = lines.some((l) => {
    if (isFence(l)) inCode = !inCode;
    return !inCode && /^#\s+\S/.test(l);
  });
  inCode = false;
  md = lines
    .map((l) => {
      if (isFence(l)) inCode = !inCode;
      return hasH1 && !inCode && /^#{1,5}\s+\S/.test(l) ? `#${l}` : l;
    })
    .join("\n");

  // 6. Tidy whitespace. Two spaces at the end of a line mean "new line, same
  //    paragraph" (Shift+Enter in the Doc), so exactly those are kept.
  md = md
    .split("\n")
    .map((l) => {
      const text = l.replace(/[ \t]+$/g, "");
      return text !== "" && / {2,}$/.test(l) ? `${text}  ` : text;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  let truncated = false;
  if (md.length > MAX_BODY_CHARS) {
    md = md.slice(0, MAX_BODY_CHARS);
    truncated = true;
  }

  return { markdown: md, imagesRemoved, truncated };
}

/** A Doc's file name, made safe as an article title (the details form can change it). */
export function titleFromDocName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 200);
}
