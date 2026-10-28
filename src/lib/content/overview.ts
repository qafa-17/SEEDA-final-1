import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildOverview, type Overview, type OverviewRow } from "./overview-math";

export type { Overview } from "./overview-math";

/**
 * Team-wide numbers for the top of the Dashboard. These ignore the list's
 * search and filters on purpose: they answer "how is the Knowledge Hub
 * doing?", while the list below answers "where is this article?".
 */
export async function loadOverview(now: number): Promise<Overview> {
  const supabase = await createClient();
  const [articlesRes, areasRes] = await Promise.all([
    supabase.from("articles").select("status, created_at, submitted_at, published_at, service_area_id").limit(5000),
    supabase.from("service_areas").select("id, slug, label").order("sort_order"),
  ]);
  return {
    ...buildOverview((articlesRes.data ?? []) as OverviewRow[], areasRes.data ?? [], now),
    error: Boolean(articlesRes.error || areasRes.error),
  };
}

