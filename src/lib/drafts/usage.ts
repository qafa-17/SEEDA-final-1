import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * How much of the AI allowance is used. Only drafts that were actually
 * written count: an attempt the AI service didn't finish is logged (in
 * draft_requests) but doesn't use up anyone's allowance.
 */
export async function draftUsage(supabase: Supabase, userId: string) {
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const written = () => supabase.from("draft_requests").select("id", { count: "exact", head: true }).eq("kind", "draft").eq("status", "ok");
  const [rpc, mine, team] = await Promise.all([
    supabase.rpc("draft_request_usage").single(),
    written().eq("requested_by", userId).gte("created_at", dayAgo),
    written().gte("created_at", monthStart),
  ]);
  if (rpc.error || !rpc.data || mine.error || team.error) return null;
  return {
    headlinesToday: Number((rpc.data as { headlines_today: number }).headlines_today),
    draftsToday: mine.count ?? 0,
    draftsMonth: team.count ?? 0,
  };
}
