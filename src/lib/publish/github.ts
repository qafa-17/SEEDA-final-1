import "server-only";

// Publishing to the website's GitHub repository, through GitHub's REST API.
// The token lives only in the server's environment (GITHUB_TOKEN). It should
// be a fine-grained token limited to the one website repository, with
// "Contents" and "Pull requests" set to read and write.

const API = "https://api.github.com";
const TIMEOUT_MS = 20_000;

/** Which repository and site to publish to. Not secret; can be changed in Vercel. */
export function publishTarget() {
  const repo = process.env.PUBLISH_REPO?.trim() || "qafa-17/epcmst-demo-site";
  const site = (process.env.PUBLISH_SITE_URL?.trim() || "https://epcmst-demo-site.vercel.app").replace(/\/+$/, "");
  const branch = process.env.PUBLISH_BRANCH?.trim() || "main";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || !/^https:\/\/[^/\s]+$/.test(site) || !/^[A-Za-z0-9/_.-]+$/.test(branch)) {
    throw new PublishError("config");
  }
  return { repo, site, branch };
}

export const isPublishConfigured = () => Boolean(process.env.GITHUB_TOKEN?.trim());

export type PublishErrorKind = "not_configured" | "config" | "auth" | "forbidden" | "not_found" | "exists" | "conflict" | "unavailable";

export class PublishError extends Error {
  constructor(public kind: PublishErrorKind, public detail?: string) {
    super(kind);
  }
}

/** What to tell a person, for each kind of failure. Never shows GitHub's raw errors or the token. */
export function publishErrorMessage(e: unknown): string {
  const kind = e instanceof PublishError ? e.kind : "unavailable";
  switch (kind) {
    case "not_configured":
      return "Publishing isn't connected yet. An admin needs to add the GitHub token in Vercel.";
    case "config":
      return "The publishing settings in Vercel aren't valid. An admin should check PUBLISH_REPO and PUBLISH_SITE_URL.";
    case "auth":
      return "GitHub refused the publishing token. It may have expired; an admin should create a new one.";
    case "forbidden":
      return "The publishing token can't write to the website's repository. It needs Contents and Pull requests set to read and write.";
    case "not_found":
      return "The website's repository couldn't be found. An admin should check PUBLISH_REPO and that the token covers it.";
    case "exists":
      return "The website already has a page at this address. Change the URL slug (reopen the article to edit it) and publish again.";
    case "conflict":
      return "GitHub couldn't merge the change. Check the pull request on GitHub, then try again.";
    default:
      return "GitHub didn't respond. Wait a moment and try again.";
  }
}

async function gh<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) throw new PublishError("not_configured");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "epcmst-content-operations",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new PublishError("unavailable");
  }
  const data = (await res.json().catch(() => null)) as T;
  if (res.status === 401) throw new PublishError("auth");
  if (res.status === 403) throw new PublishError("forbidden");
  return { status: res.status, data };
}

const enc = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/**
 * Add the article's file through a pull request, then merge it:
 *   1. refuse if the site already has a file at that path
 *   2. branch from the main branch, add the file, open a pull request
 *   3. merge it (squash, so the site's history has one commit per article)
 * `onOpened` runs once the pull request exists, so its link is recorded even
 * if the merge then fails.
 */
export async function publishFile(opts: {
  path: string;
  content: string;
  branchName: string;
  title: string;
  body: string;
  onOpened: (pr: { number: number; url: string }) => Promise<void>;
}): Promise<{ number: number; url: string }> {
  const { repo, branch: base } = publishTarget();

  const existing = await gh<unknown>("GET", `/repos/${repo}/contents/${enc(opts.path)}?ref=${encodeURIComponent(base)}`);
  if (existing.status === 200) throw new PublishError("exists");
  if (existing.status !== 404) throw new PublishError("unavailable");

  const ref = await gh<{ object?: { sha?: string } }>("GET", `/repos/${repo}/git/ref/heads/${enc(base)}`);
  if (ref.status === 404) throw new PublishError("not_found");
  const sha = ref.data?.object?.sha;
  if (ref.status !== 200 || !sha) throw new PublishError("unavailable");

  const made = await gh<unknown>("POST", `/repos/${repo}/git/refs`, { ref: `refs/heads/${opts.branchName}`, sha });
  if (made.status !== 201 && made.status !== 422) throw new PublishError(made.status === 404 ? "not_found" : "unavailable");

  const put = await gh<unknown>("PUT", `/repos/${repo}/contents/${enc(opts.path)}`, {
    message: `Publish: ${opts.title}`,
    content: Buffer.from(opts.content, "utf8").toString("base64"),
    branch: opts.branchName,
  });
  if (put.status === 422) throw new PublishError("exists");
  if (put.status !== 201 && put.status !== 200) throw new PublishError("unavailable");

  const pr = await gh<{ number?: number; html_url?: string }>("POST", `/repos/${repo}/pulls`, {
    title: `Publish: ${opts.title}`,
    head: opts.branchName,
    base,
    body: opts.body,
  });
  if (pr.status !== 201 || !pr.data?.number || !pr.data.html_url) throw new PublishError("unavailable");
  const opened = { number: pr.data.number, url: pr.data.html_url };
  await opts.onOpened(opened);

  // GitHub may need a moment to work out whether the pull request can merge.
  for (let attempt = 0; attempt < 3; attempt++) {
    const merge = await gh<{ merged?: boolean }>("PUT", `/repos/${repo}/pulls/${opened.number}/merge`, { merge_method: "squash" });
    if (merge.status === 200 && merge.data?.merged) {
      await gh("DELETE", `/repos/${repo}/git/refs/heads/${enc(opts.branchName)}`).catch(() => undefined);
      return opened;
    }
    if (merge.status !== 405 && merge.status !== 409) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new PublishError("conflict");
}

/** Is the page live, and is it in the site's sitemap? */
export async function checkLive(pageUrl: string, slug: string): Promise<{ httpStatus: number; inSitemap: boolean }> {
  const { site } = publishTarget();
  const get = (url: string) =>
    fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "epcmst-content-operations" } }).catch(() => null);
  const [page, sitemap] = await Promise.all([get(pageUrl), get(`${site}/sitemap-0.xml`)]);
  const xml = sitemap && sitemap.ok ? await sitemap.text() : "";
  // Matched by path, so it still works if the site's address in Vercel differs from its configured one.
  return { httpStatus: page?.status ?? 0, inSitemap: new RegExp(`<loc>[^<]*/resources/${slug}/?</loc>`).test(xml) };
}
