import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_PREFIX, type SiteContext } from "./rules";

export type SitePage = { path: string; article_id: string | null };

/** Every page on the live site, from the site_pages table. */
export async function loadSitePages(supabase: SupabaseClient): Promise<SitePage[]> {
  const { data } = await supabase.from("site_pages").select("path, article_id");
  return (data ?? []) as SitePage[];
}

/**
 * The page list in the shape the content rules need. Pass the article being
 * judged so its own published page (if any) doesn't count as "someone else
 * already has this URL".
 */
export function siteContextFor(pages: SitePage[], articleId?: string): SiteContext {
  return {
    sitePaths: pages.map((r) => r.path),
    reservedSlugs: pages
      .filter((r) => r.path.startsWith(SITE_PREFIX) && (!articleId || r.article_id !== articleId))
      .map((r) => r.path.slice(SITE_PREFIX.length)),
  };
}

export async function loadSiteContext(supabase: SupabaseClient, articleId?: string): Promise<SiteContext> {
  return siteContextFor(await loadSitePages(supabase), articleId);
}
