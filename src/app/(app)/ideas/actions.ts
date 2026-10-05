"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LIMITS, REGION_SLUGS, countryLabel, regionBySlug } from "@/lib/ideas/regions";
import { searchErrorMessage, webSearch, type SearchResult } from "@/lib/ideas/search";
import { summarize } from "@/lib/ideas/summarize";

export type IdeaState = { message?: string; fieldErrors?: { keyword?: string } };

const input = z.object({
  keyword: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(2, "Type a keyword of at least 2 characters.")
        .max(80, "Keep the keyword under 80 characters.")
        // These characters mean "match anything" in a database search.
        .regex(/^[^*%_\\<>]+$/, "Use letters, numbers and ordinary punctuation only."),
    ),
  region: z.enum(REGION_SLUGS).catch("alberta"),
});

type Stored = { id: string; results: SearchResult[]; ai_status: string };

/**
 * Research one keyword in one area:
 *   1. If the team researched it in the last week, show that (costs nothing).
 *   2. Otherwise check the allowances, search the web, and ask the AI what
 *      searchers want. If the AI fails, the search results are still saved.
 * Then go to the saved result's page.
 */
export async function researchKeyword(_prev: IdeaState, fd: FormData): Promise<IdeaState> {
  await requireActiveUser();
  const parsed = input.safeParse({ keyword: String(fd.get("keyword") ?? ""), region: String(fd.get("region") ?? "") });
  if (!parsed.success) return { fieldErrors: { keyword: parsed.error.issues[0]?.message } };
  const { keyword, region } = parsed.data;
  const regionInfo = regionBySlug(region)!;

  const supabase = await createClient();

  // 1. Recent research for the same keyword and area.
  const since = new Date(Date.now() - LIMITS.reuseDays * 86_400_000).toISOString();
  const { data: recent, error: recentError } = await supabase
    .from("idea_searches")
    .select("id, results, ai_status")
    .ilike("keyword", keyword) // same keyword in any capitalisation; wildcards are refused above
    .eq("region", region)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  if (recentError) return { message: "Couldn't check earlier research. Please try again." };
  const earlier = (recent ?? []) as Stored[];
  const complete = earlier.find((r) => r.ai_status === "ok");
  if (complete) redirect(`/ideas?search=${complete.id}&reused=1`);

  // 2. Allowances, counted by the database.
  const { data: usage, error: usageError } = await supabase.rpc("idea_search_usage").single();
  if (usageError || !usage) return { message: "Couldn't check today's allowance. Please try again." };
  const { mine_today, team_this_month } = usage as { mine_today: number; team_this_month: number };
  if (Number(mine_today) >= LIMITS.perPersonPerDay) {
    return { message: `You've used today's ${LIMITS.perPersonPerDay} research requests. They free up 24 hours after each one.` };
  }

  // Results from an earlier attempt whose AI summary failed are reused, so
  // trying again doesn't spend another web search.
  const reusable = earlier.find((r) => r.results.length > 0);
  let results: SearchResult[];
  if (reusable) {
    results = reusable.results;
  } else {
    if (Number(team_this_month) >= LIMITS.teamPerMonth) {
      return { message: "The team has used this month's web searches. Research opens again on the 1st." };
    }
    try {
      results = await webSearch(`${keyword} ${regionInfo.search}`, regionInfo.country);
    } catch (e) {
      return { message: searchErrorMessage(e) };
    }
  }

  const ai = results.length > 0 ? await summarize(keyword, `${regionInfo.label}, ${countryLabel(regionInfo.country)}`, results) : ({ status: "failed", summary: null } as const);

  const { data: created, error } = await supabase
    .from("idea_searches")
    .insert({ keyword, region, results, summary: ai.summary, ai_status: ai.status, used_search: !reusable })
    .select("id")
    .single();
  if (error || !created) return { message: "The research ran but couldn't be saved. Please try again." };

  revalidatePath("/ideas");
  redirect(`/ideas?search=${created.id}`);
}
