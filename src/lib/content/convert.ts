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
  md = md.replace(/<\/?[a-zA-Z][^<>\n]*>/g, "");

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
  md = lines.join("\n");

  // 5. Tidy whitespace.
  md = md
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
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
